/** Read-only career search planner and evidence-based ranking.
 * No model inference, resume upload, background work or application submission.
 */
import type {ResumeProfile} from "./career-workspace";

export type AgentSignal={term:string;source:"competencia"|"experiencia"|"projeto"|"resumo"};
export type AgentSearchPlan={roleQueries:string[];evidence:AgentSignal[];warnings:string[]};
export type AgentJob={
  opportunity:{source:string;external_id:string;title:string;company:string;
    work_mode:string;contract_type:string;source_url:string|null;
    city?:string|null;advertised_min_salary_brl?:number|null};
  excerpt:string;description?:string|null;missing_information:string[];
};
export type AgentAssessment={
  kind:"signals"|"some_signals"|"insufficient";label:string;matched:string[];
  roleRelated:boolean;descriptionCoverage:"excerpt_only"|"full";note:string;
};
const NOISE=new Set(["de","da","do","das","dos","em","para","com","e","the","of","for","and","a","an"]);
function clean(text:string):string{
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
}
function words(text:string):string[]{
  return clean(text).replace(/[^a-z0-9+#.]/g," ").split(/\s+/).filter(t=>t.length>=2&&!NOISE.has(t));
}
function normalizeRole(text:string):string{
  return text.split(/\s*[|•·]\s*/)[0].trim().replace(/\(a\)/gi,"").replace(/\s+\b(?:at|na|no|@)\s+.{3,}$/i,"").replace(/\s+/g," ").slice(0,80);
}
function validRole(role:string):boolean{
  return role.length>=3&&role.length<=80&&words(role).length>=1&&!role.includes("@")&&!/^https?:/i.test(role);
}
function boundedTerm(term:string):RegExp{
  const escaped=term.replace(/[.*+?^$()|[\]{}\\]/g,"\\$&");
  return new RegExp("(^|[^a-z0-9])"+escaped+"($|[^a-z0-9])");
}
/** Only explicit job titles at the beginning of a CV summary; not guessed from skills. */
function roleFromSummary(summary:string):string|null{
  const first=summary.trim().split(/[.!?](?:\s|$)/)[0].slice(0,160);
  const match=first.match(/^(?:(?:sou|atuo como|trabalho como)\s+)?(desenvolvedor(?:\(a\)|a)?|engenheir(?:o(?:\(a\))?|a)|analista|cientista de dados|designer|pesquisador(?:a)?|especialista|consultor(?:a)?|arquiteto(?:a)?|programador(?:a)?)(?=\s|[,:.;]|$)/i);
  if(!match)return null;
  // Keep only a short, explicitly written specialization before narrative phrases.
  const tail=first.slice(match[0].length)
    .split(/\s+(?=com\b|experi[eê]ncia\b|especializad[oa]\b|atuando\b|respons[aá]vel\b|que\b|trabalhando\b|focado\b)/i)[0]
    .split(/[,:;]/)[0].trim();
  const rest=tail.split(/\s+/).filter(Boolean);
  if(rest.length>4||rest.some(word=>/[0-9@]/.test(word)))return null;
  const role=normalizeRole(match[1]+(rest.length?" "+rest.join(" "):""));
  return validRole(role)?role:null;
}

export function planCareerSearch(profile:ResumeProfile):AgentSearchPlan{
  const roles=[profile.contact.headline,...profile.experiences.map(e=>e.role)]
    .map(normalizeRole).filter(validRole);
  if(!roles.length){
    const explicitlyStated=roleFromSummary(profile.summary);
    if(explicitlyStated)roles.push(explicitlyStated);
  }
  const seen=new Set<string>();
  const roleQueries=roles.filter(role=>{
    const key=clean(role);if(seen.has(key))return false;seen.add(key);return true;
  }).slice(0,4);
  const evidence:AgentSignal[]=[];
  const evidenceSeen=new Set<string>();
  const sources:[AgentSignal["source"],string[]][]=[
    ["competencia",profile.skills],
    ["experiencia",profile.experiences.flatMap(e=>e.highlights)],
    ["projeto",profile.projects.map(p=>p.description)],
    ["resumo",[profile.summary]],
  ];
  const tech=[
    "Python","FastAPI","Java","JavaScript","TypeScript","React","Node.js",
    "SQL","PostgreSQL","Docker","Kubernetes","AWS","Azure","GCP",
    "Machine Learning","LangChain","LangGraph","RPA","Power BI",
    "Pandas","PyTorch","TensorFlow","NLP","Spark","Airflow","Django",
    "Flask","C#","C++","Go","Rust","Excel","ETL","Git","Figma",
  ];
  for(const [source,texts] of sources){
    for(const term of tech){
      const needle=clean(term);
      if(evidenceSeen.has(needle)||!texts.some(t=>boundedTerm(needle).test(clean(t))))continue;
      evidenceSeen.add(needle);evidence.push({term,source});
    }
  }
  const warnings:string[]=[];
  if(!roleQueries.length)warnings.push("Informe o cargo desejado para iniciar a busca.");
  if(!evidence.length)warnings.push("Poucas competências técnicas explícitas: os resultados exigirão revisão.");
  warnings.push("A cobertura das fontes é parcial; confirme localização e requisitos no anúncio original.");
  return {roleQueries,evidence:evidence.slice(0,14),warnings};
}
export function assessAgentJob(job:AgentJob,plan:AgentSearchPlan,query:string):AgentAssessment{
  const full=typeof job.description==="string"&&job.description.trim().length>=60;
  const text=clean(job.opportunity.title+" "+(full?job.description:job.excerpt));
  const matched=plan.evidence.filter(signal=>boundedTerm(clean(signal.term)).test(text))
    .map(s=>s.term).slice(0,8);
  const titleWords=words(job.opportunity.title);
  const roleRelated=words(query).some(token=>token.length>=3&&titleWords.includes(token));
  const kind=matched.length>=2&&roleRelated?"signals":
    matched.length>=1||roleRelated?"some_signals":"insufficient";
  return {
    kind,
    label:kind==="signals"?"Sinais relevantes":kind==="some_signals"?"Alguns sinais":"Precisa de revisão",
    matched,roleRelated,descriptionCoverage:full?"full":"excerpt_only",
    note:kind==="insufficient"
      ?full?"Não há evidências explícitas suficientes nos requisitos publicados. Revise a vaga.":
        "O resumo disponível não permite avaliar a aderência. Abra a descrição completa."
      :full?"Indícios identificados na descrição da vaga. Verifique cada requisito antes de adaptar o currículo.":
        "Indícios identificados no título ou resumo. Confirme os requisitos completos antes de adaptar o currículo.",
  };
}
export function orderAgentJobs(jobs:AgentJob[],plan:AgentSearchPlan,query:string):AgentJob[]{
  const ranks={signals:0,some_signals:1,insufficient:2};
  return [...jobs].sort((a,b)=>{
    const aa=assessAgentJob(a,plan,query),bb=assessAgentJob(b,plan,query);
    return ranks[aa.kind]-ranks[bb.kind]||bb.matched.length-aa.matched.length;
  });
}
export type AgentAction="read_local_resume"|"search_public_jobs"|"evaluate_evidence"|"prepare_draft"|"submit_application";
export type AgentPermission="allow"|"ask"|"deny";
export const COMMUNITY_AGENT_PERMISSIONS:Record<AgentAction,AgentPermission>={
  read_local_resume:"allow",
  search_public_jobs:"ask",
  evaluate_evidence:"allow",
  prepare_draft:"ask",
  submit_application:"deny",
};
