"use client";

import {useEffect,useMemo,useRef,useState,type ChangeEvent,type FormEvent} from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {ArrowRight,ArrowUpRight,Check,CheckCircle2,ChevronDown,
 CircleAlert,FileUp,LockKeyhole,Search,ShieldCheck,Square,X} from "lucide-react";
import {PlatformNav} from "@/components/platform-nav";
import {resolveApiOrigin} from "@/lib/api-origin";
import {loadResumeDraft,saveResumeDraft,hasResumeContent,type ResumeProfile} from "@/lib/career-workspace";
import {parseResumeImport,resumeFileProblem} from "@/lib/agent-import";
import {
 clearSelectedOpportunity,selectOpportunity,selectedOpportunity,type SelectedOpportunity,
} from "@/lib/career-handoff";
import type {AgentJob} from "@/lib/career-agent";
import {planCareerSearch} from "@/lib/career-agent";
import {
 interpretCareerIntent,rankCareerJobs,judgeCareerJob,prepareCareerPreview,
 type CareerIntent,type JobJudgement,
} from "@/lib/agent-journey";
import "./agente.css";
import "./unified.css";

const PreparationJourney=dynamic(
 ()=>import("@/app/preparar/page").then(mod=>mod.PreparationJourney),{ssr:false},
);
const API=resolveApiOrigin();
const DEFAULT_INTENT="Encontre vagas de Engenharia de IA remotas no Brasil, compare com meu currículo e prepare candidaturas";
type RemoteResult={jobs:AgentJob[];source_name:string;limitations:string[]};
type RunStatus="idle"|"searching"|"review"|"cancelled"|"failed";

function buildStoredJob(selected:SelectedOpportunity):AgentJob{
 return {
  opportunity:{source:selected.source,external_id:selected.url,title:selected.title,
   company:selected.company,work_mode:"unspecified",contract_type:"unspecified",
   source_url:selected.url},
  excerpt:selected.excerpt,description:selected.description,
  missing_information:[],
 };
}

export default function CareerAgent(){
 const [profile,setProfile]=useState<ResumeProfile|null>(null);
 const [loadingProfile,setLoadingProfile]=useState(true);
 const [profileError,setProfileError]=useState("");
 const [importing,setImporting]=useState(false);
 const [intentText,setIntentText]=useState(DEFAULT_INTENT);
 const [authorized,setAuthorized]=useState(false);
 const [status,setStatus]=useState<RunStatus>("idle");
 const [error,setError]=useState("");
 const [results,setResults]=useState<RemoteResult|null>(null);
 const [runIntent,setRunIntent]=useState<CareerIntent|null>(null);
 const [runPlanRole,setRunPlanRole]=useState("");
 const [selected,setSelected]=useState<SelectedOpportunity|null>(null);
 const [reviewing,setReviewing]=useState(false);
 const [advanced,setAdvanced]=useState(false);
 const [draft,setDraft]=useState("");
 const [reviewed,setReviewed]=useState(false);
 const [notice,setNotice]=useState("");
 const fileInput=useRef<HTMLInputElement|null>(null);
 const abort=useRef<AbortController|null>(null);
 const generation=useRef(0);
 const intentEdited=useRef(false);
 const isMounted=useRef(true);
 const parsed=useMemo(()=>interpretCareerIntent(intentText),[intentText]);
 const ranked=useMemo(()=>profile&&runIntent&&results?
  rankCareerJobs(results.jobs,profile,runIntent):[],[results,profile,runIntent]);
 const chosen=useMemo(()=>{
  if(!selected||!profile)return null;
  const item=ranked.find(i=>i.job.opportunity.source_url===selected.url);
  return item??judgeCareerJob(buildStoredJob(selected),profile,
   runIntent??interpretCareerIntent(selected.title,selected.title));
 },[profile,ranked,runIntent,selected]);

 useEffect(()=>{
  isMounted.current=true;
  let alive=true;
  const frame=requestAnimationFrame(()=>{
   setSelected(selectedOpportunity());
   void loadResumeDraft().then(data=>{
    if(!alive)return;
    if(data&&hasResumeContent(data.profile)){
     setProfile(data.profile);
     const suggestion=planCareerSearch(data.profile).roleQueries[0];
     if(suggestion&&!intentEdited.current)setIntentText("Encontre vagas de "+suggestion+" remotas no Brasil, compare com meu currículo e prepare candidaturas");
    }
   }).catch(()=>{if(alive)setProfileError("Falha ao ler o currículo local. Verifique a conexão com a API.");})
     .finally(()=>{if(alive)setLoadingProfile(false);});
  });
  return ()=>{alive=false;isMounted.current=false;cancelAnimationFrame(frame);abort.current?.abort();};
 },[]);

 async function importResume(event:ChangeEvent<HTMLInputElement>){
  const file=event.target.files?.[0];event.target.value="";
  if(!file||importing||status==="searching")return;
  const issue=resumeFileProblem(file);
  if(issue){setProfileError(issue);return;}
  if(profile&&!window.confirm("Substituir o currículo salvo? A importação criará um perfil editável e não altera versões aprovadas."))return;
  setImporting(true);setProfileError("");setNotice("");
  try{
   const body=new FormData();body.append("file",file);
   const response=await fetch(API+"/api/v1/resumes/structured/import/upload",{method:"POST",body});
   if(!response.ok)throw new Error("Falha ao importar currículo. Confira o formato do arquivo.");
   const imported=parseResumeImport(await response.json());
   await saveResumeDraft(imported.profile,"classico");
   setProfile(imported.profile);
   setResults(null);setRunIntent(null);setStatus("idle");
   const roles=planCareerSearch(imported.profile).roleQueries;
   if(roles[0]&&!intentEdited.current)setIntentText("Encontre vagas de "+roles[0]+" remotas no Brasil, compare com meu currículo e prepare candidaturas");
   setNotice(imported.unassigned_lines.length||imported.warnings.length?
    "Perfil importado com trechos que exigem revisão. Confira no Studio antes de preparar candidaturas.":
    "Perfil importado e editável. Confira os dados no Studio antes de começar.");
  }catch(e){setProfileError(e instanceof Error?e.message:"Falha na importação.");}
  finally{setImporting(false);}
 }

 async function search(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!authorized||!profile||loadingProfile||status==="searching"||parsed.role.length<2)return;
  const controller=new AbortController();
  abort.current?.abort();abort.current=controller;
  const current=++generation.current;
  setStatus("searching");setResults(null);setRunIntent(null);setError("");setReviewed(false);
  setRunPlanRole(parsed.role);
  try{
   // Source adapters, settings and rate limits are enforced by the existing local API.
   const qs=new URLSearchParams({q:parsed.role,source:"all",page:"1",remote_only:String(parsed.remoteOnly)});
   const response=await fetch(API+"/api/v1/jobs/search?"+qs.toString(),{signal:controller.signal,cache:"no-store"});
   if(!response.ok){
    let detail="Não foi possível consultar as fontes públicas autorizadas.";
    try{const body=await response.json() as {detail?:unknown};if(typeof body.detail==="string")detail=body.detail;}catch{}
    throw new Error(detail);
   }
   const data=await response.json() as RemoteResult;
   if(!Array.isArray(data.jobs))throw new Error("A fonte não retornou uma lista válida de oportunidades.");
   if(controller.signal.aborted||current!==generation.current)return;
   setResults({...data,jobs:data.jobs.slice(0,30)});
   setRunIntent(parsed);setStatus("review");
  }catch(e){
   if(!controller.signal.aborted&&current===generation.current){
    setStatus("failed");setError(e instanceof Error?e.message:"Erro desconhecido na busca.");
   }
  }
 }

 function cancel(){
  if(status!=="searching")return;
  generation.current++;
  abort.current?.abort();
  setStatus("cancelled");setError("");
 }

 function choose(item:JobJudgement){
  if(!profile||!item.job.opportunity.source_url||item.status==="excluded")return;
  const opp=item.job.opportunity;
  const url=opp.source_url;
  if(!url)return;
  const next:SelectedOpportunity={
   title:opp.title,company:opp.company,url,source:opp.source,
   excerpt:item.job.excerpt,description:item.job.description??undefined,
  };
  if(!selectOpportunity(next)){setError("A vaga não pôde ser guardada com segurança no dispositivo.");return;}
  setSelected(next);setReviewing(true);setAdvanced(false);setReviewed(false);
  setDraft(prepareCareerPreview(item,profile).draft);
  window.requestAnimationFrame(()=>document.getElementById("career-preview")?.scrollIntoView({behavior:"smooth",block:"start"}));
 }
 function resumeSelected(){
  if(!selected||!chosen||!profile)return;
  setReviewing(true);setAdvanced(false);setReviewed(false);
  setDraft(prepareCareerPreview(chosen,profile).draft);
 }
 function clear(){
  if(status==="searching")cancel();
  clearSelectedOpportunity();setSelected(null);setReviewing(false);setAdvanced(false);
  setDraft("");setReviewed(false);
 }
 const steps=[
  {label:"Ler currículo",detail:profile?"Perfil disponível":"Currículo pendente"},
  {label:"Entender objetivo",detail:runPlanRole||parsed.role||"Cargo não informado"},
  {label:"Consultar vagas",detail:status==="searching"?"Buscando nas fontes autorizadas":results?"Consulta realizada":"Aguardando autorização"},
  {label:"Conferir requisitos",detail:results?"Evidências e critérios organizados":"Sem suposições"},
  {label:"Revisar candidatura",detail:reviewing?"Prévia local disponível":"Nenhum envio externo"},
 ];

 return <div className="platform-shell"><PlatformNav/>
  <main className="platform-container unified-agent">
   <div className="unified-topline"><span><ShieldCheck size={16}/> ALINHA · AGENTE DE CARREIRA</span>
    <span><LockKeyhole size={14}/> Modo assistido · sem envio automático</span></div>
   <div className="unified-heading">
    <div><h1>O que vamos fazer pela sua carreira?</h1>
     <p>Descreva seu objetivo. O Alinha busca vagas, confere o que consta no seu perfil e prepara uma prévia para você revisar, tudo aqui.</p></div>
    <Link href="/conexoes">Gerenciar IA <ArrowUpRight size={15}/></Link>
   </div>

   <section className="unified-primary" aria-label="Sua jornada">
    <div className="unified-profile-line">
     <div><span className="unified-profile-icon"><FileUp size={19}/></span>
      <div><strong>{loadingProfile?"Carregando currículo…":profile?(profile.contact.headline||profile.contact.name||"Currículo salvo"):"Comece com seu currículo"}</strong>
       <small>{profile?"Perfil local editável · "+profile.skills.length+" competências declaradas":"PDF, DOCX ou TXT · até 3 MB"}</small></div></div>
     <div className="unified-profile-actions">
      <input ref={fileInput} type="file" accept=".pdf,.docx,.txt" aria-label="Importar currículo"
       className="agent-file-input" onChange={e=>void importResume(e)} disabled={importing||status==="searching"}/>
      <button type="button" onClick={()=>fileInput.current?.click()} disabled={importing||status==="searching"}>
       {importing?"Importando…":profile?"Trocar currículo":"Importar currículo"}</button>
      {profile&&<Link href="/studio">Revisar perfil <ArrowRight size={14}/></Link>}
     </div>
    </div>
    {profileError&&<p role="alert" className="unified-error">{profileError}</p>}
    {notice&&<p role="status" className="unified-notice">{notice}</p>}
    <form onSubmit={e=>void search(e)} className="unified-intent-form">
     <label htmlFor="career-intent">Seu objetivo</label>
     <textarea id="career-intent" rows={3} maxLength={400} value={intentText}
      onChange={e=>{intentEdited.current=true;setIntentText(e.target.value);}} disabled={status==="searching"}
      placeholder="Ex.: Encontre vagas de Engenheiro de IA remoto no Brasil, com salário a partir de R$ 8.000…"/>
     <div className="unified-understanding">
      <strong>Entendi o seguinte:</strong>
      <div className="unified-chips">
       <span>Cargo: {parsed.role||"precisa informar"}</span>
       {parsed.workMode&&<span>{parsed.workMode==="remote"?"Remoto":parsed.workMode==="hybrid"?"Híbrido":"Presencial"}</span>}
       {parsed.city&&<span>Cidade: {parsed.city}</span>}
       {parsed.brazilOnly&&<span>Brasil</span>}
       {parsed.minSalaryBrl!==null&&<span>A partir de {parsed.minSalaryBrl.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</span>}
      </div>
      {parsed.needsConfirmation.length>0&&<details className="unified-uncertainties">
       <summary><CircleAlert size={15}/> {parsed.needsConfirmation.length} condição(ões) que precisam de confirmação <ChevronDown size={14}/></summary>
       <ul>{parsed.needsConfirmation.map(text=><li key={text}>{text}</li>)}</ul>
      </details>}
     </div>
     <label className="unified-consent"><input type="checkbox" checked={authorized}
      disabled={status==="searching"} onChange={e=>setAuthorized(e.target.checked)}/>
      <span>Autorizo consultar as fontes públicas de vagas habilitadas. Apenas o cargo e o filtro de modalidade são enviados à busca; meu currículo não é transmitido às fontes.</span>
     </label>
     <div className="unified-submit-row"><button type="submit" className="unified-cta"
      disabled={!authorized||!profile||parsed.role.length<2||status==="searching"||importing}>
      <Search size={17}/>{status==="searching"?"Buscando oportunidades…":"Encontrar e comparar vagas"}
      <ArrowRight size={16}/></button>
      {status==="searching"&&<button type="button" className="unified-cancel" onClick={cancel}><Square size={13}/> Cancelar</button>}
     </div>
    </form>
   </section>

   <section className="unified-progress" aria-label="Progresso do agente">
    <div className="unified-section-head"><h2>Progresso</h2>
     <span role="status" aria-live="polite">{status==="searching"?"Consultando fontes…":
      status==="review"?"Oportunidades prontas para revisão":
      status==="failed"?"Consulta interrompida por erro":
      status==="cancelled"?"Busca cancelada": "Aguardando seu pedido"}</span></div>
    <ol>{steps.map((step,index)=>{const done=index===0?Boolean(profile):index===1?Boolean(runPlanRole):
     index===2?Boolean(results):index===3?Boolean(results&&runIntent):Boolean(reviewing&&chosen);
     return <li key={step.label} className={done?"done":""}>
     <span>{done?<Check size={13}/>:index+1}</span><div><strong>{step.label}</strong><small>{step.detail}</small></div></li>;})}</ol>
   </section>
   {(status==="failed"||status==="cancelled")&&<p role="alert" className="unified-error">
    {status==="failed"?error:"A busca foi cancelada. Nenhuma candidatura foi enviada; você pode começar outra quando quiser."}</p>}
   {results&&runIntent&&<section className="unified-results" id="career-results">
    <div className="unified-section-head"><div><h2>Oportunidades encontradas</h2>
     <p>{results.jobs.length} vagas · {results.source_name}. A ordem considera sinais literais e incertezas; não é pontuação ATS.</p></div></div>
    {ranked.length===0&&<p>Nenhuma vaga encontrada. Revise o objetivo ou tente outra busca.</p>}
    <div className="unified-list">{ranked.map(item=>{
     const job=item.job.opportunity;
     return <article key={job.source+":"+job.external_id} className={"unified-result "+(item.status==="excluded"?"muted":"")}>
      <div className="unified-result-head"><div><small>{job.company} · {job.source}</small>
       <h3>{job.title}</h3><p>{job.city||"Local não informado"} · {job.work_mode==="unspecified"?"Modalidade não confirmada":job.work_mode}</p></div>
       <span>{item.status==="excluded"?"Fora do filtro":item.status==="verify"?"Precisa conferir":"Sinais relevantes"}</span></div>
      {item.job.description&&<p className="unified-excerpt">{item.job.description.slice(0,300)}{item.job.description.length>300?"…":""}</p>}
      <div className="unified-tags">{item.matches.map(term=><small key={term}><Check size={12}/>{term} no currículo</small>)}</div>
      {(item.unknown.length>0||item.missingSkills.length>0||item.excluded.length>0)&&
       <details className="unified-uncertainties"><summary><CircleAlert size={14}/>
        {item.unknown.length+item.missingSkills.length+item.excluded.length} ponto(s) para verificar <ChevronDown size={13}/></summary>
        <ul>{item.excluded.concat(item.unknown,item.missingSkills.map(s=>"Competência não comprovada: "+s)).map(s=><li key={s}>{s}</li>)}</ul>
       </details>}
      <div className="unified-result-actions">
       <button type="button" disabled={!job.source_url||item.status==="excluded"} onClick={()=>choose(item)}>
        Preparar prévia <ArrowRight size={15}/></button>
       {job.source_url&&<a href={job.source_url} target="_blank" rel="noopener noreferrer">Ver anúncio <ArrowUpRight size={14}/></a>}
      </div>
     </article>;
    })}</div>
    {results.limitations.length>0&&<p className="unified-limitation">{results.limitations.join(" ")}</p>}
   </section>}

   {selected&&!reviewing&&<section className="unified-resume" aria-label="Preparação salva">
    <div><small>CONTINUAR PREPARAÇÃO</small><h2>{selected.title}</h2>
     <p>{selected.company}. A vaga e a descrição revisada foram recuperadas do dispositivo. Uma análise anterior com IA não é reaproveitada automaticamente.</p></div>
    <div><button type="button" onClick={resumeSelected} disabled={!profile}>Retomar nesta tela <ArrowRight size={15}/></button>
     <button type="button" className="unified-light-button" onClick={clear}>Descartar seleção</button></div>
   </section>}
   {selected&&reviewing&&chosen&&profile&&<section className="unified-preview" id="career-preview">
    <div className="unified-section-head"><div><span className="unified-eyebrow">RASCUNHO · NÃO ENVIADO</span>
     <h2>Prepare sua candidatura</h2><p>{selected.title} — {selected.company}</p></div>
     <button type="button" className="unified-light-button" onClick={()=>{setReviewing(false);setAdvanced(false);}}>
      <X size={15}/> Pausar</button></div>
    <div className="unified-preview-content">
     <label htmlFor="career-draft">Texto inicial baseado no currículo</label>
     <textarea id="career-draft" rows={5} value={draft} maxLength={3000}
      onChange={e=>{setDraft(e.target.value);setReviewed(false);}}/>
     <div className="unified-unknown"><strong><CircleAlert size={16}/> Revise antes de usar</strong>
      <ul>{prepareCareerPreview(chosen,profile).unknownQuestions.map(question=><li key={question}>{question}</li>)}</ul>
      <p>O texto é uma sugestão editável. O Alinha não confirma respostas desconhecidas nem envia esta candidatura.</p>
     </div>
     <div className="unified-result-actions"><button type="button" onClick={()=>{
       if(!draft.trim())return;void navigator.clipboard.writeText(draft).then(()=>setReviewed(true))
        .catch(()=>setError("Não foi possível copiar. Selecione o texto manualmente."));
      }}>Copiar rascunho para revisar</button>
      {reviewed&&<span role="status"><CheckCircle2 size={15}/> Texto copiado. Não enviado.</span>}</div>
    </div>
    <details className="unified-advanced" open={advanced} onToggle={e=>setAdvanced(e.currentTarget.open)}>
     <summary>Analisar com IA conectada, verificar ATS e adaptar currículo <ChevronDown size={16}/></summary>
     {advanced&&<PreparationJourney key={selected.url} embedded opportunity={selected}
      onClose={()=>setAdvanced(false)}
      onClearSelection={()=>{setSelected(null);setReviewing(false);setAdvanced(false);}}/>}
    </details>
   </section>}
   {error&&status!=="failed"&&<p className="unified-error" role="alert">{error}</p>}
   <footer className="unified-footer"><ShieldCheck size={16}/>
    <span>Você decide cada etapa. Nenhuma ação de candidatura externa está habilitada.</span>
    <Link href="/vagas">Busca manual</Link><Link href="/studio">Editar currículo</Link></footer>
  </main></div>;
}
