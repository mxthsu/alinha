"use client";
import {useEffect,useMemo,useRef,useState,type ChangeEvent,type DragEvent} from "react";
import Link from "next/link";
import {
 ArrowRight,ArrowUpRight,BookmarkPlus,BriefcaseBusiness,Check,CheckCircle2,
 CircleAlert,Clock3,FileCheck2,FileUp,LockKeyhole,Search,ShieldCheck,
 SlidersHorizontal,Sparkles,WandSparkles,
} from "lucide-react";
import {PlatformNav} from "@/components/platform-nav";
import {useOpportunityTracker} from "@/hooks/use-opportunity-tracker";
import {loadResumeDraft,saveResumeDraft,hasResumeContent,type ResumeProfile} from "@/lib/career-workspace";
import {parseResumeImport,resumeFileProblem} from "@/lib/agent-import";
import {selectOpportunity} from "@/lib/career-handoff";
import {planCareerSearch,assessAgentJob,orderAgentJobs,
 COMMUNITY_AGENT_PERMISSIONS,type AgentJob,type AgentSearchPlan} from "@/lib/career-agent";
import "./agente.css";

type RemoteResult={jobs:(AgentJob&{employment_label:string|null;salary_label:string|null})[];
 source_name:string;limitations:string[]};
type RunState="ready"|"searching"|"completed"|"failed";
const API=process.env.NEXT_PUBLIC_API_URL||"http://localhost:8000";
const emptyPlan:AgentSearchPlan={roleQueries:[],evidence:[],warnings:[]};

export default function CareerAgent(){
 const [profile,setProfile]=useState<ResumeProfile|null>(null);
 const [plan,setPlan]=useState<AgentSearchPlan>(emptyPlan);
 const [loadingProfile,setLoadingProfile]=useState(true);
 const [profileError,setProfileError]=useState("");
 const [importing,setImporting]=useState(false);
 const [importNotice,setImportNotice]=useState("");
 const [reviewNotice,setReviewNotice]=useState("");
 const [dragged,setDragged]=useState(false);
 const fileInput=useRef<HTMLInputElement|null>(null);
 const [query,setQuery]=useState("");
 const [searchedQuery,setSearchedQuery]=useState("");
 const [run,setRun]=useState<RunState>("ready");
 const [jobs,setJobs]=useState<RemoteResult|null>(null);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const abort=useRef<AbortController|null>(null);
 const {items:tracked,save:saveOpportunity}=useOpportunityTracker();

 useEffect(()=>{
  let active=true;
  const frame=requestAnimationFrame(()=>{
   void loadResumeDraft().then(draft=>{
    if(!active)return;
    if(draft&&hasResumeContent(draft.profile)){
     const next=planCareerSearch(draft.profile);
     setProfile(draft.profile);setPlan(next);setQuery(next.roleQueries[0]||"");
    }
   }).catch(()=>{
    if(active)setProfileError("Não foi possível acessar o currículo salvo neste dispositivo.");
   }).finally(()=>{if(active)setLoadingProfile(false);});
  });
  return ()=>{active=false;cancelAnimationFrame(frame);abort.current?.abort();};
 },[]);

 const ordered=useMemo(()=>jobs?orderAgentJobs(jobs.jobs,plan,searchedQuery):[],[jobs,plan,searchedQuery]);
 const firstName=profile?.contact.name.trim().split(/\s+/)[0]||"";
 const canRun=query.trim().length>=2&&query.trim().length<=80&&run!=="searching"&&!importing;

 async function execute(roleOverride?:string){
  const term=(roleOverride??query).trim();
  if(term.length<2||term.length>80||run==="searching"||
    COMMUNITY_AGENT_PERMISSIONS.search_public_jobs!=="ask")return;
  abort.current?.abort();
  const controller=new AbortController();abort.current=controller;
  setRun("searching");setError("");setNotice("");setJobs(null);
  try{
   const search=new URLSearchParams({q:term,page:"1",remote_only:"false",source:"all"});
   const response=await fetch(API+"/api/v1/jobs/search?"+search,{signal:controller.signal,cache:"no-store"});
   const data=await response.json();
   if(!response.ok)throw new Error(typeof data.detail==="string"?data.detail:"Falha na consulta à fonte de vagas.");
   if(!controller.signal.aborted){setSearchedQuery(term);setJobs(data as RemoteResult);setRun("completed");}
  }catch(cause){
   if(!controller.signal.aborted){
    setError(cause instanceof Error?cause.message:"Não foi possível concluir a pesquisa.");
    setRun("failed");
   }
  }
 }
 async function uploadResume(file:File){
  if(importing||run==="searching")return;
  if(profile&&!window.confirm("Substituir o currículo salvo por este novo documento? Seu perfil anterior será trocado após a importação."))return;
  const problem=resumeFileProblem(file);
  if(problem){setProfileError(problem);return;}
  setImporting(true);setProfileError("");setImportNotice("");setReviewNotice("");
  try{
    const data=new FormData();
    data.append("file",file);
    const response=await fetch(API+"/api/v1/resumes/structured/import/upload",{
      method:"POST",body:data,
    });
    const payload:unknown=await response.json();
    if(!response.ok){
      const detail=payload&&typeof payload==="object"&&"detail" in payload
        ?(payload as {detail:unknown}).detail:null;
      throw new Error(typeof detail==="string"?detail:"Não foi possível ler o currículo.");
    }
    const imported=parseResumeImport(payload);
    // Save only the structured profile, not the raw PDF, text or parser metadata.
    await saveResumeDraft(imported.profile,"classico");
    const nextPlan=planCareerSearch(imported.profile);
    setProfile(imported.profile);setPlan(nextPlan);setQuery(nextPlan.roleQueries[0]||"");
    const needsReview=imported.unassigned_lines.length>0||imported.warnings.length>0;
    setReviewNotice(needsReview
      ?"Algumas informações não foram classificadas com segurança. Você pode conferir no Studio quando quiser."
      :"");
    if(nextPlan.roleQueries[0]){
      setImportNotice("Currículo organizado. Procurando oportunidades para seu perfil…");
      await execute(nextPlan.roleQueries[0]);
      setImportNotice('Currículo importado e salvo automaticamente.');
    }else{
      setImportNotice("Currículo organizado. Informe o cargo desejado para encontrar vagas.");
    }
  }catch(cause){
    setProfileError(cause instanceof Error?cause.message:"Não foi possível processar o currículo.");
  }finally{setImporting(false);}
 }
 function acceptFile(event:ChangeEvent<HTMLInputElement>){
  const selected=event.target.files?.[0];
  event.target.value="";
  if(selected)void uploadResume(selected);
 }
 function dropFile(event:DragEvent<HTMLDivElement>){
  event.preventDefault();setDragged(false);
  if(event.dataTransfer.files.length!==1){
    setProfileError("Envie apenas um currículo por vez.");return;
  }
  void uploadResume(event.dataTransfer.files[0]);
 }
 const progress=[
  {name:"Perfil profissional",detail:profile?"Lido no seu dispositivo":"Aguardando currículo",done:Boolean(profile)},
  {name:"Planejamento da busca",detail:query.trim()?"Cargo: "+query.trim():"Defina um cargo para pesquisar",done:Boolean(query.trim())},
  {name:"Consulta à fonte",detail:run==="searching"?"Consultando vagas autorizadas":run==="completed"?"Consulta concluída":"Requer sua confirmação",done:run==="completed"},
  {name:"Verificação de evidências",detail:run==="completed"?"Sinais organizados para revisão":"Sem pontuação artificial",done:run==="completed"},
 ];

 return <div className="platform-shell"><PlatformNav/>
  <main className="platform-container agent-page">
   <input ref={fileInput} type="file" className="agent-file-input"
     accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
     aria-label="Selecionar currículo PDF, DOCX ou TXT" onChange={acceptFile} disabled={importing}/>

   <div className="agent-topline"><span><Sparkles size={15}/> SEU AGENTE DE CARREIRA</span>
    <span className="agent-privacy"><LockKeyhole size={14}/> Currículo preservado no dispositivo</span></div>
   <section className="agent-hero">
    <div className="agent-hero-copy"><span className="agent-hero-eyebrow"><span className="agent-live-dot"/> Jornada conectada</span>
     <h1>{firstName?"Vamos encontrar seu próximo passo, "+firstName+".":"Sua carreira, com menos trabalho repetitivo."}</h1>
     <p>O Alinha parte do seu currículo para sugerir buscas, encontrar oportunidades e ajudar a preparar candidaturas. Você acompanha as etapas e mantém o controle.</p>
     <div className="agent-hero-actions">
      <a href="#agent-workspace" className="agent-hero-primary">
        {profile?"Explorar minhas oportunidades":"Começar pelo currículo"} <ArrowRight size={17}/>
      </a>
      <Link href="/studio">Editar meu currículo <ArrowUpRight size={17}/></Link>
     </div></div>
    <div className="agent-hero-art" aria-hidden="true">
     <div className="agent-orbit agent-orbit-one"/><div className="agent-orbit agent-orbit-two"/>
     <div className="agent-center-mark"><WandSparkles size={34}/></div>
     <div className="agent-orbit-label agent-orbit-label-top"><FileCheck2 size={15}/> Currículo</div>
     <div className="agent-orbit-label agent-orbit-label-left"><Search size={15}/> Oportunidades</div>
     <div className="agent-orbit-label agent-orbit-label-bottom"><ShieldCheck size={15}/> Você decide</div>
    </div>
   </section>

   <section className="agent-workspace" id="agent-workspace">
    <div className="agent-workspace-header"><div><span className="agent-section-eyebrow">SEU ESPAÇO DE TRABALHO</span>
     <h2>Uma busca que parte de você.</h2><p>Informações reais e próximas etapas claras, sem tarefas repetidas.</p></div>
     <span className="agent-mode"><ShieldCheck size={15}/> Modo assistido</span></div>
    <div className="agent-columns"><div className="agent-main">
     <div className="agent-profile-card">
      <div className="agent-card-heading"><span className="agent-number">01</span><div>
       <h3>Seu perfil profissional</h3><p>Informações já confirmadas no Studio.</p></div></div>
      {loadingProfile?<div className="agent-profile-wait">Recuperando seu currículo…</div>:
       profileError?<div role="alert" className="agent-error">{profileError} <Link href="/studio">Abrir Studio</Link></div>:
       !profile?<div className={"agent-onboarding agent-dropzone"+(dragged?" agent-dropzone-active":"")}
         onDragOver={event=>{event.preventDefault();if(!importing)setDragged(true);}}
         onDragLeave={()=>setDragged(false)}
         onDrop={dropFile}>
        <div className="agent-onboarding-icon"><FileUp size={27}/></div>
        <strong>{importing?"Organizando seu perfil…":"Seu currículo é o ponto de partida."}</strong>
        <p>Envie seu arquivo e deixe o Alinha organizar as informações e procurar vagas relacionadas.</p>
        <button type="button" disabled={importing} onClick={()=>fileInput.current?.click()}>
          {importing?"Importando currículo…":"Enviar currículo e encontrar vagas"} <ArrowRight size={16}/>
        </button>
        <small>PDF, DOCX ou TXT, até 3 MB. Você também pode arrastar o arquivo aqui.</small>
        <Link href="/studio">Prefiro criar ou editar meu currículo</Link>
       </div>:
       <div className="agent-profile-ready">
        <div className="agent-profile-status"><CheckCircle2 size={17}/><strong>Currículo conectado</strong><span>Salvo neste dispositivo</span></div>
        <p>{profile.contact.headline||"Perfil profissional cadastrado"}</p>
        <div className="agent-profile-facts">
         <span><BriefcaseBusiness size={14}/>{profile.experiences.length} experiências</span>
         <span><FileCheck2 size={14}/>{profile.skills.length} competências declaradas</span></div>
        <div className="agent-profile-actions">
          <button type="button" disabled={importing||run==="searching"} onClick={()=>fileInput.current?.click()}>
            <FileUp size={14}/>{importing?"Importando…":"Trocar currículo"}
          </button>
          <Link href="/studio">Editar informações <ArrowRight size={14}/></Link>
        </div>
       </div>}
     </div>
     {importNotice&&<div className="agent-import-notice" role="status"><CheckCircle2 size={16}/>{importNotice}</div>}
     {reviewNotice&&<div className="agent-review-notice"><CircleAlert size={16}/><span>{reviewNotice} <Link href="/studio">Revisar currículo</Link></span></div>}
     <div className="agent-search-card">
      <div className="agent-card-heading"><span className="agent-number">02</span><div>
       <h3>O que você quer encontrar?</h3><p>Revise a sugestão baseada no seu perfil antes de pesquisar.</p></div></div>
      <label className="agent-query-label" htmlFor="agent-role">Cargo desejado</label>
      <div className="agent-query-row"><Search size={18}/>
       <input id="agent-role" type="search" maxLength={80} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ex.: Engenharia de IA"/>
       <button type="button" disabled={run!=="searching"&&!canRun}
        onClick={()=>{if(run==="searching"){abort.current?.abort();setRun("ready");}
          else void execute();}}>
        {run==="searching"?"Parar busca":"Encontrar vagas"} <ArrowRight size={17}/></button></div>
      {profile&&plan.roleQueries.length>0&&<div className="agent-role-suggestions">
       <span>SUGESTÕES DO SEU CURRÍCULO</span>
       <div>{plan.roleQueries.map(role=><button key={role} type="button"
        className={query===role?"active":""} onClick={()=>setQuery(role)}>{role}</button>)}</div></div>}
      {profile&&plan.evidence.length>0&&<div className="agent-evidence">
       <span>COMPETÊNCIAS DECLARADAS</span>
       <div>{plan.evidence.slice(0,7).map(e=><small key={e.term}>{e.term}</small>)}</div></div>}
      <p className="agent-search-privacy"><LockKeyhole size={15}/>
       Apenas o cargo digitado é enviado à fonte pública. Seu currículo e contatos não são compartilhados.</p>
      {!profile&&<p className="agent-search-hint"><CircleAlert size={15}/>
       Você pode pesquisar manualmente, mas precisará importar o currículo para sugestões personalizadas.</p>}
     </div>

     {run==="failed"&&<div role="alert" className="agent-error">{error}</div>}
     {run==="completed"&&<section className="agent-matches">
      <div className="agent-results-heading"><div><span className="agent-section-eyebrow">RESULTADOS DA BUSCA</span>
       <h3>{ordered.length} {ordered.length===1?"oportunidade":"oportunidades"} para conferir</h3>
       <p>Busca: {searchedQuery}. Ordenação por sinais literais no anúncio, não por nota ATS.</p></div>
       <span className="agent-source-tag">Fontes: {jobs?.source_name||"selecionadas"}</span></div>
      {ordered.length===0&&<div className="agent-no-results"><Search size={28}/>
       <strong>Nenhum resultado nesta busca.</strong><p>Tente outro cargo ou confira as fontes habilitadas em Meu Alinha.</p></div>}
      {ordered.map(item=>{
       const job=item.opportunity,match=assessAgentJob(item,plan,searchedQuery);
       const alreadySaved=tracked.some(saved=>saved.source===job.source&&saved.sourceId===job.external_id);
       return <article className="agent-job-card" key={job.source+":"+job.external_id}>
        <div className="agent-job-top"><div><span>{job.company}</span><h4>{job.title}</h4></div>
         <span className={"agent-match-tag "+match.kind}>{match.label}</span></div>
        {item.excerpt&&<p className="agent-job-excerpt">{item.excerpt}</p>}
        <div className="agent-match-details">
         {match.matched.length>0?<><strong>Sinais encontrados no anúncio</strong>
          <div>{match.matched.map(term=><span key={term}><Check size={12}/>{term}</span>)}</div></>:
          <p>Não encontramos correspondências suficientes neste resumo.</p>}
         <small>{match.note}</small>
        </div>
        <div className="agent-job-actions">
         {job.source_url&&<Link href="/preparar" onClick={()=>selectOpportunity({
          title:job.title,company:job.company,url:job.source_url!,source:job.source,excerpt:item.excerpt,
          description:item.description??undefined,
         })}>Preparar para esta vaga <ArrowRight size={15}/></Link>}
         {job.source_url&&<button type="button" disabled={alreadySaved}
          onClick={async()=>{const response=await saveOpportunity({title:job.title,company:job.company,
           url:job.source_url!,source:job.source,sourceId:job.external_id});setNotice(response.message);}}>
          <BookmarkPlus size={15}/>{alreadySaved?"Salva":"Salvar"}</button>}
         {job.source_url&&<a href={job.source_url} target="_blank" rel="noopener noreferrer">
          Ver anúncio <ArrowUpRight size={14}/></a>}
        </div></article>;
      })}
      {notice&&<p className="agent-notice" role="status">{notice}</p>}
      {jobs&&<p className="agent-results-limitations">{jobs.limitations.join(" ")}</p>}
     </section>}
    </div>

    <aside className="agent-sidebar">
     <div className="agent-steps-card">
      <div className="agent-sidebar-heading"><div className="agent-sidebar-icon"><SlidersHorizontal size={18}/></div>
       <div><strong>Plano de execução</strong><span>Visível e sob seu controle</span></div></div>
      <ol>{progress.map((step,i)=><li key={step.name} className={step.done?"done":""}>
       <div className="agent-step-dot">{step.done?<Check size={13}/>:String(i+1).padStart(2,"0")}</div>
       <div><strong>{step.name}</strong><small>{step.detail}</small></div></li>)}</ol>
      <div className="agent-execution-status"><Clock3 size={15}/>
       {run==="searching"?"Executando uma consulta…":run==="completed"?"Busca concluída":"Aguardando sua decisão para pesquisar"}</div>
     </div>
     <div className="agent-safety-card"><ShieldCheck size={22}/><strong>Você mantém o controle.</strong>
      <p>O agente pode ler seu perfil local e organizar resultados. A pesquisa exige sua ação, e candidaturas automáticas permanecem desativadas.</p>
      <div><span>Buscar vagas</span><strong>Você autoriza</strong></div>
      <div><span>Adaptar currículo</span><strong>Você revisa</strong></div>
      <div><span>Enviar candidatura</span><strong>Desativado</strong></div></div>
     <div className="agent-next-card"><span>DEPOIS DA BUSCA</span>
      <strong>Uma candidatura melhor começa com contexto.</strong>
      <p>Abra uma vaga, confira os requisitos completos e adapte seu currículo sem inventar experiências.</p>
      <Link href="/candidaturas">Ver meu acompanhamento <ArrowRight size={14}/></Link></div>
    </aside>
   </div>
  </section>
  </main></div>;
}
