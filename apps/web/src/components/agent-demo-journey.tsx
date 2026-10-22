"use client";

import {useEffect,useRef,useState,type FormEvent} from "react";
import {ArrowRight,Check,CheckCircle2,CircleAlert,ClipboardCheck,FileText,OctagonX,ShieldCheck,Square} from "lucide-react";
import {resolveApiOrigin} from "@/lib/api-origin";
import {
 advanceDemo,cancelDemo,demoCanAdvance,DEMO_STATUS_LABEL,DEMO_TOOL_LABEL,
 reviewDemo,startDemo,type DemoSnapshot,
} from "@/lib/agent-demo-runtime";
import "./agent-demo-journey.css";

const API=resolveApiOrigin();
const EXAMPLE_INTENT="Encontre vagas Python remotas, compare com meu perfil e prepare uma candidatura";
function aborted(signal:AbortSignal):Promise<void>{
 return new Promise((resolve,reject)=>{
  if(signal.aborted){reject(new DOMException("Cancelado","AbortError"));return;}
  const timer=setTimeout(()=>{signal.removeEventListener("abort",cancel);resolve();},260);
  function cancel(){clearTimeout(timer);reject(new DOMException("Cancelado","AbortError"));}
  signal.addEventListener("abort",cancel,{once:true});
 });
}

export function AgentDemoJourney(){
 const [intent,setIntent]=useState(EXAMPLE_INTENT);
 const [authorized,setAuthorized]=useState(false);
 const [snapshot,setSnapshot]=useState<DemoSnapshot|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [reviewConfirmed,setReviewConfirmed]=useState(false);
 const [availability,setAvailability]=useState("unknown");
 const controller=useRef<AbortController|null>(null);
 const runId=useRef<string|null>(null);
 const isMounted=useRef(true);

 useEffect(()=>{
  isMounted.current=true;
  return ()=>{isMounted.current=false;controller.current?.abort();
   if(runId.current)void cancelDemo(API,runId.current).catch(()=>undefined);};
 },[]);

 async function execute(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(busy||!authorized||intent.trim().length<8||intent.trim().length>240)return;
  controller.current?.abort();
  const active=new AbortController();
  controller.current=active;runId.current=null;
  setBusy(true);setError("");setSnapshot(null);setReviewConfirmed(false);setAvailability("unknown");
  try{
   let next=await startDemo(API,intent.trim(),crypto.randomUUID(),undefined,active.signal);
   runId.current=next.run_id;
   if(isMounted.current)setSnapshot(next);
   while(demoCanAdvance(next)&&!active.signal.aborted){
    await aborted(active.signal);
    next=await advanceDemo(API,next,undefined,active.signal);
    if(isMounted.current)setSnapshot(next);
   }
  }catch(cause){
   if(!active.signal.aborted&&isMounted.current){
    setError(cause instanceof Error?cause.message:"A demonstração não foi concluída.");
   }
  }finally{
   if(active.signal.aborted&&runId.current){
    try{
     const cancelled=await cancelDemo(API,runId.current);
     if(isMounted.current)setSnapshot(cancelled);
    }catch{
     if(isMounted.current)setError("Não foi possível confirmar o cancelamento no serviço local.");
    }
   }
   if(isMounted.current&&controller.current===active)setBusy(false);
  }
 }
 function stop(){
  if(!busy)return;
  controller.current?.abort();
 }
 async function confirm(){
  if(!snapshot||snapshot.status!=="needs_review"||
   !reviewConfirmed||availability!=="a_combinar"||busy)return;
  setBusy(true);setError("");
  try{
   const reviewed=await reviewDemo(API,snapshot.run_id);
   if(isMounted.current)setSnapshot(reviewed);
  }catch(cause){
   if(isMounted.current)setError(cause instanceof Error?cause.message:"Falha ao registrar a revisão.");
  }finally{if(isMounted.current)setBusy(false);}
 }
 return <section className="agent-demo" id="agent-demo" aria-labelledby="agent-demo-heading">
  <div className="agent-demo-heading">
   <div><span className="agent-section-eyebrow">JORNADA INTEGRADA · DEMONSTRAÇÃO SEGURA</span>
    <h2 id="agent-demo-heading">Delegue um objetivo. Acompanhe cada etapa.</h2>
    <p>Experimente o agente completo com currículo, vagas e respostas inteiramente fictícios.
     Seu currículo salvo não será lido, alterado ou enviado nesta demonstração.</p>
   </div>
   <span className="agent-demo-offline"><ShieldCheck size={16}/> Sem chave de IA ou conta externa</span>
  </div>
  <div className="agent-demo-layout">
   <div className="agent-demo-primary">
    <form onSubmit={execute} className="agent-demo-form">
     <label htmlFor="agent-demo-intent">O que você quer que o Alinha faça?</label>
     <textarea id="agent-demo-intent" value={intent} rows={3} maxLength={240}
      disabled={busy} onChange={e=>setIntent(e.target.value)}
      placeholder="Ex.: Encontre vagas Python e prepare uma prévia para revisão"/>
     <label className="agent-demo-consent"><input type="checkbox" checked={authorized}
      onChange={e=>setAuthorized(e.target.checked)} disabled={busy}/>
      <span>Autorizo a busca na fonte <strong>fictícia</strong> e a criação de uma prévia local. Nenhuma candidatura será enviada.</span>
     </label>
     <div className="agent-demo-form-actions">
      <button type="submit" className="agent-demo-primary-button"
       disabled={busy||!authorized||intent.trim().length<8}>
       {busy?"Executando jornada…":"Iniciar jornada de exemplo"} <ArrowRight size={16}/>
      </button>
      {busy&&<button type="button" className="agent-demo-stop" onClick={stop}>
       <Square size={12}/> Cancelar execução</button>}
     </div>
    </form>
    {error&&<div className="agent-demo-error" role="alert"><OctagonX size={16}/>{error}</div>}
    {snapshot&&<div className="agent-demo-output">
     <div className="agent-demo-output-head">
      <strong>Resultado da jornada</strong>
      <span role="status" aria-live="polite">{DEMO_STATUS_LABEL[snapshot.status]}</span>
     </div>
     {snapshot.profile&&<div className="agent-demo-profile">
      <FileText size={18}/><div><strong>{snapshot.profile.name} — {snapshot.profile.headline}</strong>
       <small>Currículo fictício; competências declaradas: {snapshot.profile.skills.join(", ")}</small></div>
     </div>}
     {snapshot.jobs.length>0&&<div className="agent-demo-jobs">
      <h3>Vagas encontradas ({snapshot.jobs.length})</h3>
      {snapshot.jobs.map(job=>{
       const match=snapshot.matches.find(item=>item.job_id===job.id);
       return <article key={job.id} className="agent-demo-job">
        <div><strong>{job.title}</strong><span>{job.company} · {job.location}</span></div>
        {match&&<div className="agent-demo-tags">
         {match.matched.map(skill=><span key={skill} className="verified"><Check size={12}/>{skill} confirmado no perfil</span>)}
         {match.unverified.map(skill=><span key={skill} className="unverified">{skill}: não comprovado</span>)}
        </div>}
       </article>;
      })}
     </div>}
     {snapshot.preview&&<div className="agent-demo-preview">
      <div className="agent-demo-preview-head"><ClipboardCheck size={19}/>
       <div><strong>Prévia para {snapshot.preview.company}</strong>
        <span>Rascunho · não enviado</span></div></div>
      <p>{snapshot.preview.draft_text}</p>
      <div className="agent-demo-unknown">
       <strong><CircleAlert size={15}/> Informações que exigem revisão</strong>
       {snapshot.preview.unknown_questions.map(question=><p key={question}>{question} — não informado no currículo.</p>)}
       {snapshot.status==="needs_review"&&<>
        <label htmlFor="agent-demo-availability">Disponibilidade (apenas exemplo)</label>
        <select id="agent-demo-availability" value={availability}
         onChange={e=>setAvailability(e.target.value)}>
         <option value="unknown">Selecione uma resposta fictícia</option>
         <option value="a_combinar">A combinar</option>
        </select>
        <label className="agent-demo-consent"><input type="checkbox" checked={reviewConfirmed}
         onChange={e=>setReviewConfirmed(e.target.checked)}/>
         <span>Revisei este rascunho fictício. Sei que confirmar não envia uma candidatura.</span>
        </label>
        <button type="button" className="agent-demo-primary-button"
         disabled={busy||!reviewConfirmed||availability!=="a_combinar"} onClick={()=>void confirm()}>
         Confirmar revisão local <CheckCircle2 size={16}/>
        </button>
       </>}
       {snapshot.status==="completed"&&
        <p className="agent-demo-reviewed"><CheckCircle2 size={16}/> Revisão registrada. Nenhuma candidatura enviada.</p>}
      </div>
     </div>}
     {(snapshot.status==="cancelled"||snapshot.status==="failed")&&
      <p className="agent-demo-end" role="status">Jornada {snapshot.status==="cancelled"?"cancelada":"interrompida"}; nenhuma ação externa ocorreu.</p>}
    </div>}
   </div>
   <aside className="agent-demo-timeline" aria-label="Plano e eventos da execução">
    <div className="agent-demo-timeline-title"><strong>Plano do agente</strong>
     <small>Política verificada antes de cada etapa</small></div>
    <ol>{(snapshot?.plan??[
     {tool:"resume.read"},{tool:"job.search"},{tool:"job.assess"},
     {tool:"resume.prepare"},{tool:"application.preview"},
    ]).map((action,index)=>{
     const passed=Boolean(snapshot&&snapshot.next_step>index);
     const active=Boolean(snapshot&&snapshot.next_step===index&&busy);
     return <li key={action.tool} className={passed?"done":active?"active":""}>
      <span className="agent-demo-step-dot">{passed?<Check size={13}/>:index+1}</span>
      <span>{DEMO_TOOL_LABEL[action.tool as keyof typeof DEMO_TOOL_LABEL]}</span>
     </li>;
    })}</ol>
    <div className="agent-demo-events"><strong>Registro de execução</strong>
     {!snapshot&&<p>Os eventos aparecem aqui após iniciar uma jornada.</p>}
     {snapshot?.events.map(event=><p key={event.sequence}>
      <small>{String(event.sequence).padStart(2,"0")}</small>{event.summary}</p>)}
    </div>
    <div className="agent-demo-no-send"><ShieldCheck size={16}/>
     <span>Envio de candidatura permanentemente desativado nesta demonstração.</span></div>
   </aside>
  </div>
 </section>;
}
