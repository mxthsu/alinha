/** One career journey: deterministic interpretation, evidence and review; no submission. */
import type {ResumeProfile} from "./career-workspace.ts";
import {assessAgentJob,planCareerSearch,type AgentJob} from "./career-agent.ts";

export type CareerIntent={
 role:string;remoteOnly:boolean;workMode:"remote"|"hybrid"|"onsite"|null;
 city:string|null;brazilOnly:boolean;minSalaryBrl:number|null;
 contract:"clt"|"pj"|null;
 needsConfirmation:string[];
};
export type JobJudgement={
 job:AgentJob;
 matches:string[];
 missingSkills:string[];
 unknown:string[];
 excluded:string[];
 status:"relevant"|"verify"|"excluded";
};
export type CareerPreview={
 draft:string;unknownQuestions:string[];verifiedSkills:string[];
 externalSubmission:false;status:"rascunho";
};
const accent=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const currency=(s:string)=>Number(s.replace(/\./g,"").replace(",","."));
const LOCATION_RE=/\b(?:em|na cidade de)\s+([\p{L}][\p{L}\s-]{2,45}?)(?=\s+(?:com|remot|h[ií]brid|presencial|e\s+|no\s+brasil|para\s+|acima\s+)|[,.;]|$)/iu;
export function interpretCareerIntent(input:string,defaultRole=""):CareerIntent{
 const text=input.trim().slice(0,400);
 const simple=accent(text);
 const mode:"remote"|"hybrid"|"onsite"|null =
  /\bremot[oa]s?\b/.test(simple)?"remote":
  /\bhibrid[oa]s?\b/.test(simple)?"hybrid":
  /\bpresencia(?:l|is)\b/.test(simple)?"onsite":null;
 let role="";
 const match=text.match(/(?:vagas?|oportunidades?)\s+(?:de|para)\s+(.+?)(?=\s+(?:remot[oa]s?|h[ií]brid[oa]s?|presencia(?:l|is)|no\s+brasil|em\s+[\p{L}]|com\s+sal[aá]rio|acima\s+de|que\s+paguem|e\s+(?:compare|prepare)|para\s+(?:compare|preparar))|[,.;]|$)/iu)
  ??text.match(/(?:trabalhar|atuar)\s+(?:como|de)\s+(.+?)(?=\s+(?:remot[oa]s?|h[ií]brid[oa]s?|presencial|no\s+brasil|em\s+[\p{L}]|com\s+sal[aá]rio)|[,.;]|$)/iu);
 if(match)role=match[1].trim();
 else if(!/\b(?:vagas?|oportunidades?)\b/i.test(text)&&text.length<=80)role=text;
 role=(role||defaultRole).trim().slice(0,80);
 const location=text.match(LOCATION_RE);
 const city=location&&!/^(?:qualquer|todo|brasil|home office)$/i.test(location[1].trim())
  ?location[1].trim():null;
 const brazilOnly=/\b(?:no brasil|do brasil|para o brasil|brasileir[oa]s?)\b/.test(simple);
 const salaryText=text.match(/(?:r\$\s*|sal[aá]rio\s+(?:de\s+|a\s+partir\s+de\s+)?|acima\s+de\s+(?:r\$\s*)?)(\d{4,7}|\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d{1,3})(\s*k\b)?/iu);
 const parsed=salaryText?currency(salaryText[1])*(salaryText[2]?1000:1):null;
 const annual=/\b(?:por ano|ao ano|anual|anuais)\b/.test(simple);
 const minSalaryBrl=!annual&&parsed!==null&&Number.isFinite(parsed)&&parsed>=500&&parsed<=200000?parsed:null;
 const mentionsClt=/\bclt\b/.test(simple);
 const mentionsPj=/\bpj\b/.test(simple);
 const contract=mentionsClt!==mentionsPj?(mentionsClt?"clt":"pj"):null;
 const needsConfirmation:string[]=[];
 if((simple.includes("salario")||text.includes("R$")||simple.includes("acima de"))&&minSalaryBrl===null)
  needsConfirmation.push("Valor salarial não interpretado: informe um valor em reais para filtrar.");
 if((mentionsClt&&mentionsPj)||/\b(junior|pleno|senior|estagio|beneficio|beneficios|plano de saude|ingles|experiencia minima)\b/.test(simple))
  needsConfirmation.push("Vínculo, senioridade, benefícios e exigências adicionais não têm filtro automático; confira cada anúncio.");
 if(brazilOnly)needsConfirmation.push("Confirme no anúncio se a empresa admite contratação de residentes no Brasil.");
 if(city)needsConfirmation.push("A localização informada pode não indicar elegibilidade geográfica; confira o anúncio.");
 if(!role||role.length<2)needsConfirmation.push("Não foi possível identificar o cargo. Informe o cargo desejado.");
 return {role,remoteOnly:mode==="remote",workMode:mode,city,brazilOnly,minSalaryBrl,contract,needsConfirmation};
}

export function judgeCareerJob(job:AgentJob,profile:ResumeProfile,intent:CareerIntent):JobJudgement{
 const plan=planCareerSearch(profile);
 const assessed=assessAgentJob(job,plan,intent.role);
 const matched=assessed.matched;
 const opportunity=job.opportunity;
 const unknown:string[]=[];
 const excluded:string[]=[];
 const work=opportunity.work_mode;
 if(intent.contract&&opportunity.contract_type!==intent.contract){
  if(opportunity.contract_type==="unspecified")unknown.push("Vínculo CLT/PJ não confirmado pela fonte.");
  else excluded.push("Tipo de contrato diferente do solicitado.");
 }
 if(intent.workMode&&work!==intent.workMode){
  if(work==="unspecified")unknown.push("Modalidade não informada pela fonte.");
  else excluded.push("Modalidade diferente do solicitado.");
 }
 if(intent.city&&work!=="remote"){
  const city=opportunity.city?.trim();
  if(!city)unknown.push("Cidade não informada pela fonte.");
  else if(!accent(city).includes(accent(intent.city)))excluded.push("Cidade diferente da solicitada.");
 }
 if(intent.city&&work==="remote")unknown.push("Verifique se a vaga aceita profissionais na localidade desejada.");
 if(intent.brazilOnly)unknown.push("Elegibilidade para residentes no Brasil precisa ser confirmada.");
 if(intent.minSalaryBrl!==null){
  const reported=opportunity.advertised_min_salary_brl;
  if(typeof reported!=="number")unknown.push("Salário não informado ou sem valor mensal confirmado em reais.");
  else if(reported<intent.minSalaryBrl)
   unknown.push("Piso anunciado abaixo do desejado; não é possível concluir o teto salarial.");
 }
 if(!assessed.roleRelated)unknown.push("Relação do cargo com a busca precisa ser conferida.");
 if(assessed.descriptionCoverage==="excerpt_only")
  unknown.push("Descrição completa indisponível; confira os requisitos na origem.");
 const skillEvidence=new Set(matched.map(accent));
 const description=(typeof job.description==="string"&&job.description.length>=60)?job.description:job.excerpt;
 const recognized=["Python","FastAPI","SQL","Docker","React","TypeScript","Java",
  "Kubernetes","AWS","Azure","GCP","Machine Learning","Power BI","Pandas","LangChain"];
 const normalizedText=" "+accent(description).replace(/[^a-z0-9+#]/g," ")+" ";
 const missingSkills=recognized.filter(skill=>{
  const token=accent(skill);
  return normalizedText.includes(" "+token+" ")&&!skillEvidence.has(token);
 });
 return {job,matches:matched,missingSkills,unknown:[...new Set(unknown)],
  excluded,status:excluded.length?"excluded":unknown.length?"verify":"relevant"};
}
export function rankCareerJobs(jobs:AgentJob[],profile:ResumeProfile,intent:CareerIntent):JobJudgement[]{
 const ranks={relevant:0,verify:1,excluded:2};
 return jobs.map(job=>judgeCareerJob(job,profile,intent))
  .sort((a,b)=>ranks[a.status]-ranks[b.status]||b.matches.length-a.matches.length);
}
export function prepareCareerPreview(judgement:JobJudgement,profile:ResumeProfile):CareerPreview{
 const name=profile.contact.name.trim();
 const skills=judgement.matches;
 const draft=[
  "Olá, tenho interesse na oportunidade de "+judgement.job.opportunity.title+".",
  name?"Meu nome é "+name+".":"",
  skills.length?"Meu currículo declara competências em "+skills.join(", ")+".":"",
  "Gostaria de conversar sobre os requisitos e as próximas etapas do processo seletivo.",
 ].filter(Boolean).join(" ");
 const unknownQuestions=[
  ...judgement.missingSkills.map(skill=>"Requisito "+skill+" não comprovado no currículo."),
  ...judgement.unknown,
  "Disponibilidade, pretensão salarial e perguntas específicas da empresa não foram confirmadas.",
 ];
 return {draft,unknownQuestions:[...new Set(unknownQuestions)],verifiedSkills:skills,
  externalSubmission:false,status:"rascunho"};
}
