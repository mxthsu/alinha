"use client";
import {resolveApiOrigin} from "@/lib/api-origin";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, FileCheck2, FilePenLine, FileSearch, Info, LoaderCircle, ShieldCheck, Sparkles, AlertCircle } from "lucide-react";
import { PlatformNav } from "@/components/platform-nav";
import { clearSelectedOpportunity, selectedOpportunity, type SelectedOpportunity } from "@/lib/career-handoff";
import { hasResumeContent, loadResumeDraft, type ResumeProfile, type ResumeTemplate } from "@/lib/career-workspace";
import { proposeTailoredResume, type TailoredProposal } from "@/lib/tailored-resume";
import { approveResumeVersion, loadApprovedResume, type ApprovedResumeVersion } from "@/lib/approved-resume";
import { TailoredResumePanel } from "@/components/tailored-resume-panel";
import { ResumeUpload } from "@/components/resume-upload";
import { ConnectedProviderPicker } from "@/components/connected-provider-picker";
import { AtsEditor } from "@/components/ats-editor";
import { AnalysisReport } from "@/components/analysis-report";
import { type AnalysisResult } from "@/lib/analysis";
import type { Provider } from "@/components/provider-selector";
import "../ats/ats.css";
import "./preparar.css";

type Finding = { code:string;severity:"important"|"attention"|"suggestion";title:string;explanation:string;action:string };
type AtsReport = { document_type:string;assessment:"review_needed"|"basic_readability_confirmed";readable_characters:number;findings:Finding[];limitations:string[] };

const severity: Record<Finding["severity"], string> = {important:"Importante",attention:"Atenção",suggestion:"Sugestão"};
const api=resolveApiOrigin();

type PreparationJourneyProps={embedded?:boolean;onClose?:()=>void};

export function PreparationJourney({embedded=false,onClose}:PreparationJourneyProps) {
  const [mode, setMode] = useState<"file"|"text">("file");
  const [file, setFile] = useState<File|null>(null);
  const [resume, setResume] = useState("");
  const [ats, setAts] = useState<AtsReport|null>(null);
  const [job, setJob] = useState("");
  const [selectedJob,setSelectedJob]=useState<SelectedOpportunity|null>(null);
  const [studioMessage,setStudioMessage]=useState("");
  const [loadingStudio,setLoadingStudio]=useState(false);
  const userSelectedSource=useRef(false);
  const [provider, setProvider] = useState<Provider>("gemini");
  const [model, setModel] = useState("");
  const [providerReady, setProviderReady] = useState(false);
  const [result, setResult] = useState<AnalysisResult|null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [structuredProfile,setStructuredProfile]=useState<ResumeProfile|null>(null);
  const [currentTemplate,setCurrentTemplate]=useState<ResumeTemplate>("classico");
  const [proposal,setProposal]=useState<TailoredProposal|null>(null);
  const [approvedVersion,setApprovedVersion]=useState<ApprovedResumeVersion|null>(null);
  const [savingVersion,setSavingVersion]=useState(false);
  const [versionNotice,setVersionNotice]=useState("");
  const [busy, setBusy] = useState<"ats"|"job"|null>(null);
  const [error, setError] = useState("");
  const abort = useRef<AbortController|null>(null);
  const hasResume = mode === "file" ? Boolean(file) : resume.trim().length >= 50;

  useEffect(()=>{
    const selected=selectedOpportunity();
    const selectionFrame=window.requestAnimationFrame(()=>{
      if(selected){setSelectedJob(selected);if(selected.description?.trim())setJob(selected.description);}
      if(selected)void loadApprovedResume(selected).then(version=>{if(active)setApprovedVersion(version);})
        .catch(()=>{if(active)setVersionNotice("Não foi possível consultar as versões salvas.");});
    });
    let active=true;
    void loadResumeDraft().then(async draft=>{
      if(!active||!draft||!hasResumeContent(draft.profile)||userSelectedSource.current)return;
      const response=await fetch(api+"/api/v1/resumes/structured/preview/text",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(draft.profile),
      });
      if(!response.ok)throw new Error("Não foi possível carregar o currículo salvo.");
      const data=await response.json() as {resume_text:string};
      if(!active||userSelectedSource.current||!data.resume_text.trim())return;
      setMode("text");setResume(data.resume_text);setFile(null);
      setStructuredProfile(draft.profile);setCurrentTemplate(draft.template);
      setStudioMessage("Seu currículo já está pronto. Confira a vaga e continue.");
      const check=await fetch(api+"/api/v1/ats/check/text",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({resume_text:data.resume_text}),
      });
      if(check.ok&&active&&!userSelectedSource.current)
        setAts(await check.json() as AtsReport);
    }).catch(()=>{
      if(active)setStudioMessage("Não foi possível recuperar o rascunho do Studio. Você ainda pode enviar outro currículo.");
    });
    return ()=>{active=false;window.cancelAnimationFrame(selectionFrame);};
  },[]);

  async function loadStudioResume(){
    if(loadingStudio||busy)return;
    setLoadingStudio(true);
    try{
      const draft=await loadResumeDraft();
      if(!draft||!hasResumeContent(draft.profile))throw new Error("Nenhum currículo salvo no Studio.");
      const response=await fetch(api+"/api/v1/resumes/structured/preview/text",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(draft.profile),
      });
      if(!response.ok)throw new Error("Não foi possível carregar o currículo do Studio.");
      const data=await response.json() as {resume_text:string};
      userSelectedSource.current=false;
      resetResume();setMode("text");setFile(null);setResume(data.resume_text);
      setStructuredProfile(draft.profile);setCurrentTemplate(draft.template);
      setStudioMessage("Currículo do Studio carregado. Verifique a leitura ATS para continuar.");
    }catch(cause){
      setStudioMessage(cause instanceof Error?cause.message:"Falha ao carregar currículo.");
    }finally{setLoadingStudio(false);}
  }
  function clearJobSelection(){
    clearSelectedOpportunity();setSelectedJob(null);setJob("");setResult(null);
    setProposal(null);setApprovedVersion(null);
  }


  function resetResume() { setAts(null);setResult(null);setProposal(null);setShowEditor(false);setError("");abort.current?.abort();setBusy(null); }
  function changeMode(next:"file"|"text") { userSelectedSource.current=true;setStructuredProfile(null);setMode(next);resetResume(); }
  function changeFile(next:File|null) { userSelectedSource.current=true;setStructuredProfile(null);setFile(next);resetResume(); }
  function changeText(next:string) { userSelectedSource.current=true;setStructuredProfile(null);setResume(next);resetResume(); }

  async function checkAts(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasResume || busy) return;
    setBusy("ats");setError("");setAts(null);setResult(null);
    try {
      let response:Response;
      if (mode === "file" && file) {
        const data = new FormData(); data.append("file",file);
        response = await fetch(api+"/api/v1/ats/check/upload",{method:"POST",body:data});
      } else {
        response = await fetch(api+"/api/v1/ats/check/text",{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({resume_text:resume}),
        });
      }
      const payload = await response.json();
      if (!response.ok) throw new Error(typeof payload.detail==="string"?payload.detail:"Não foi possível ler o currículo.");
      setAts(payload as AtsReport);
    } catch(cause) { setError(cause instanceof Error?cause.message:"Falha ao verificar o currículo."); }
    finally {setBusy(null);}
  }
  async function compare(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ats||!hasResume||!providerReady||job.trim().length<60||busy) return;
    const controller=new AbortController();abort.current=controller;
    setBusy("job");setError("");setResult(null);
    try {
      let response:Response;
      if (mode==="file" && file) {
        const data=new FormData();data.append("file",file);
        data.append("job_description",job);data.append("provider",provider);
        if(provider==="chatgpt" && model)data.append("model",model);
        response=await fetch(api+"/api/v1/analyses/upload",{method:"POST",body:data,signal:controller.signal});
      } else {
        response=await fetch(api+"/api/v1/analyses/text",{
          method:"POST",signal:controller.signal,
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({resume_text:resume,job_description:job,provider,model:provider==="chatgpt"?model||null:null}),
        });
      }
      const payload=await response.json();
      if(!response.ok)throw new Error(typeof payload.detail==="string"?payload.detail:"Não foi possível comparar com a vaga.");
      if(!controller.signal.aborted){
        const report=payload as AnalysisResult;
        setResult(report);
        setProposal(structuredProfile&&selectedJob?proposeTailoredResume(structuredProfile,report):null);
        setVersionNotice("");
      }
    } catch(cause) {
      if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:"Falha na comparação.");
    } finally {
      if(abort.current===controller){setBusy(null);abort.current=null;}
    }
  }

  async function downloadVersion(profile:ResumeProfile,template:ResumeTemplate){
    const response=await fetch(api+"/api/v1/resumes/structured/export/docx",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({profile,template}),
    });
    if(!response.ok)throw new Error("Não foi possível exportar o documento DOCX.");
    const blob=await response.blob();
    const url=URL.createObjectURL(blob);
    try{
      const anchor=document.createElement("a");
      anchor.href=url;anchor.download="alinha-curriculo-vaga.docx";
      anchor.click();
    }finally{window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
  }
  async function approveAndDownload(){
    if(!proposal||!selectedJob||savingVersion)return;
    setSavingVersion(true);setVersionNotice("");
    try{
      const saved=await approveResumeVersion(selectedJob,proposal.profile,currentTemplate);
      setApprovedVersion(saved);setVersionNotice("Versão aprovada e salva no SQLite local.");
      await downloadVersion(saved.profile,saved.template);
    }catch(cause){setVersionNotice(cause instanceof Error?cause.message:"Não foi possível concluir a exportação.");}
    finally{setSavingVersion(false);}
  }
  async function redownload(){
    if(!approvedVersion||savingVersion)return;
    setSavingVersion(true);setVersionNotice("");
    try{await downloadVersion(approvedVersion.profile,approvedVersion.template);}
    catch(cause){setVersionNotice(cause instanceof Error?cause.message:"Falha ao exportar DOCX.");}
    finally{setSavingVersion(false);}
  }

  const JourneyContainer=embedded?"section":"main";
  return <div className={embedded?"journey-shell journey-embedded":"platform-shell journey-shell"}>
    {!embedded&&<PlatformNav/>}
    <JourneyContainer className={embedded?"journey-main":"platform-container journey-main"}>
      {embedded&&<div className="journey-embedded-heading">
        <div><span>CONTINUE SEM SAIR DA JORNADA</span><h2>Prepare esta candidatura.</h2>
          <p>Verifique, compare e aprove uma versão do currículo para a vaga selecionada.</p></div>
        {onClose&&<button type="button" onClick={onClose}>Voltar às oportunidades</button>}
      </div>}
      <div className="platform-kicker"><ShieldCheck size={16}/> UMA JORNADA · DUAS VERIFICAÇÕES</div>
      <h1>Prepare sua candidatura.</h1>
      <p className="platform-lead">Comece verificando se o currículo pode ser lido. Depois, se quiser, compare-o com uma vaga usando a IA escolhida. Sem notas ou promessas de aprovação.</p>
      <div className="journey-progress" aria-label="Etapas da preparação">
        <div className="journey-progress-item current"><span>01</span><div><strong>Currículo e leitura ATS</strong><small>Sem IA</small></div>{ats&&<CheckCircle2 size={18}/>}</div>
        <div className="journey-progress-connector"/>
        <div className={"journey-progress-item"+(ats?" current":"")}><span>02</span><div><strong>Comparar com uma vaga</strong><small>Opcional · com IA</small></div></div>
        <div className="journey-progress-connector"/>
        <div className="journey-progress-item"><span>03</span><div><strong>Revisar e melhorar</strong><small>Editor e exportação</small></div></div>
      </div>

      <section className="journey-card" id="curriculo">
        <div className="journey-card-header"><span>01 · DIAGNÓSTICO DE LEITURA</span><h2>Seu currículo, uma única vez.</h2><p>Envie PDF, DOCX ou TXT, ou cole o texto. A análise ATS ocorre localmente e não consome sua cota de IA.</p></div>
        <div className="journey-columns">
          <form className="journey-form" onSubmit={checkAts}>
            <ResumeUpload mode={mode} onModeChange={changeMode} resumeText={resume}
              onResumeTextChange={changeText} file={file} onFileChange={changeFile}/>
            <div className="journey-shared-resume">
              <button type="button" disabled={loadingStudio||Boolean(busy)} onClick={()=>void loadStudioResume()}>
                <FilePenLine size={16}/> {loadingStudio?"Carregando...":"Usar currículo salvo no Studio"}
              </button>
              <Link href="/studio">Editar meu currículo <ArrowRight size={15}/></Link>
            </div>
            {studioMessage&&<p className="journey-shared-notice" role="status">{studioMessage}</p>}
            <div className="journey-privacy"><ShieldCheck size={16}/> Não armazenamos o arquivo enviado. A mesma seleção será reutilizada na próxima etapa.</div>
            {error&&<p className="journey-error" role="alert"><AlertCircle size={16}/>{error}</p>}
            <button className="journey-submit" type="submit" disabled={!hasResume||Boolean(busy)}>
              {busy==="ats"?<LoaderCircle size={17} className="journey-spin"/>:<FileCheck2 size={17}/>}
              {busy==="ats"?"Verificando documento…":"Verificar leitura ATS"} <ArrowRight size={17}/>
            </button>
          </form>
          <div className="journey-result" aria-live="polite">
            {ats ? <>
              <div className="journey-result-top"><CheckCircle2 size={18}/><span>Texto recuperado: {ats.readable_characters.toLocaleString("pt-BR")} caracteres</span></div>
              <h3>{ats.assessment==="basic_readability_confirmed"?"Leitura básica verificada":"Pontos de atenção encontrados"}</h3>
              <p>O resultado não é uma nota ATS universal nem garante leitura idêntica em todos os sistemas.</p>
              {ats.findings.length>0?<div className="journey-findings">{ats.findings.map(item=>
                <details key={item.code}><summary><span>{severity[item.severity]}</span> {item.title}</summary>
                <p>{item.explanation}</p><p><strong>Como melhorar: </strong>{item.action}</p></details>)}</div>
              :<div className="journey-ok"><CheckCircle2 size={17}/> Nenhum alerta básico identificado.</div>}
              <button type="button" className="journey-edit-link" onClick={()=>setShowEditor(value=>!value)}>
                <FilePenLine size={16}/>{showEditor?"Ocultar editor simples":"Abrir editor simples"} <ArrowRight size={16}/>
              </button>
            </> : <div className="journey-result-empty"><FileSearch size={35}/><h3>Comece pela leitura.</h3>
              <p>O Alinha verifica o texto e a estrutura do arquivo antes de qualquer comparação com vagas.</p></div>}
          </div>
        </div>
        {showEditor&&ats&&<AtsEditor apiUrl={api} sourceText={mode==="text"?resume:null} file={mode==="file"?file:null}/>}
      </section>

      <section className={"journey-card journey-job"+(!ats?" journey-locked":"")} id="vaga">
        <div className="journey-card-header"><span>02 · CORRESPONDÊNCIA COM A VAGA</span>
          <h2>Quais requisitos você já demonstra?</h2>
          <p>As sugestões serão geradas somente depois da comparação com os requisitos da vaga informada. Não precisa enviar o currículo novamente.</p></div>
              {selectedJob&&<div className="journey-selected-job">
                <div><strong>Vaga selecionada: {selectedJob.title}</strong><span>{selectedJob.company}</span></div>
                <a href={selectedJob.url} target="_blank" rel="noopener noreferrer">Ver anúncio original <ArrowRight size={14}/></a>
                <p>{selectedJob.description?
                  "Descrição da vaga carregada automaticamente da fonte. Revise o conteúdo antes de analisar.":
                  "A fonte não informou a descrição integral. Cole o anúncio completo para analisar os requisitos, sem depender só do resumo."}</p>
                <button type="button" onClick={clearJobSelection}>Remover seleção</button>
              </div>}
        {!ats?<div className="journey-step-locked"><Info size={20}/> Verifique a leitura do currículo na etapa 1 para continuar.</div>:
          <div className="journey-columns">
            <form className="journey-form" onSubmit={compare}>
              <ConnectedProviderPicker provider={provider} onProviderChange={setProvider} model={model}
                onModelChange={setModel} onReadyChange={setProviderReady}/>
              <label className="journey-label" htmlFor="journey-job-description">Descrição da vaga</label>
              <textarea id="journey-job-description" rows={8} maxLength={14000} value={job} onChange={event=>{setJob(event.target.value);setResult(null);setProposal(null);}}
                placeholder="Cole os requisitos e responsabilidades da oportunidade…"/>
              <div className="journey-counter">{job.length.toLocaleString("pt-BR")} / 14.000 caracteres · mínimo de 60</div>
              <p className="journey-privacy"><ShieldCheck size={16}/> O currículo e a vaga serão enviados apenas ao provedor selecionado nesta etapa.</p>
              {error&&<p className="journey-error" role="alert"><AlertCircle size={16}/>{error}</p>}
              <button className="journey-submit" disabled={!providerReady||job.trim().length<60||Boolean(busy)}>
                {busy==="job"?<LoaderCircle size={17} className="journey-spin"/>:<Sparkles size={17}/>}
                {busy==="job"?"Comparando requisitos…":"Comparar com esta vaga"}<ArrowRight size={17}/>
              </button>
              {busy==="job"&&<button type="button" className="journey-cancel" onClick={()=>{abort.current?.abort();setBusy(null);}}>Cancelar</button>}
            </form>
            <div className="journey-result">
              <AnalysisReport result={result} loading={busy==="job"} onReset={()=>setResult(null)}/>
            </div>
          </div>}
      </section>

      {proposal&&selectedJob&&<TailoredResumePanel
        proposal={proposal} jobTitle={selectedJob.title} busy={savingVersion}
        approved={Boolean(approvedVersion)}
        onApprove={()=>void approveAndDownload()}
        onDownload={()=>void redownload()}/>}
      {!proposal&&approvedVersion&&selectedJob&&<div className="journey-approved-existing">
        <div><CheckCircle2 size={19}/><span><strong>Você já tem uma versão aprovada para esta vaga.</strong>
          <small>Versão aprovada localmente, sem alterar o currículo principal.</small></span></div>
        <button type="button" onClick={()=>void redownload()} disabled={savingVersion}>
          <FileCheck2 size={16}/> Baixar currículo da vaga
        </button>
      </div>}
      {versionNotice&&<p role="status" className="journey-shared-notice">{versionNotice}</p>}
      <section className="journey-finish" id="melhorar"><div><span>03 · PRÓXIMO PASSO</span><h2>Revise, melhore e exporte.</h2>
        <p>O Alinha prepara uma versão específica para cada oportunidade. Aprove ou baixe seu documento aqui; abra o Studio apenas se quiser editar o perfil original.</p></div>
        <Link href="/studio" className="journey-finish-button"><FilePenLine size={17}/> Abrir Studio <ArrowRight size={17}/></Link>
      </section>
      <p className="journey-disclaimer"><Info size={17}/> Esta jornada não garante classificação, entrevista ou contratação. As decisões dependem dos critérios de cada empresa.</p>
    </JourneyContainer>
  </div>;
}

export default function PrepareApplication(){
  return <PreparationJourney/>;
}
