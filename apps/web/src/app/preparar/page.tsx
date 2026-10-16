"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, FileCheck2, FilePenLine, FileSearch, Info, LoaderCircle, ShieldCheck, Sparkles, AlertCircle } from "lucide-react";
import { PlatformNav } from "@/components/platform-nav";
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
const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function PrepareApplication() {
  const [mode, setMode] = useState<"file"|"text">("file");
  const [file, setFile] = useState<File|null>(null);
  const [resume, setResume] = useState("");
  const [ats, setAts] = useState<AtsReport|null>(null);
  const [job, setJob] = useState("");
  const [provider, setProvider] = useState<Provider>("gemini");
  const [model, setModel] = useState("");
  const [providerReady, setProviderReady] = useState(false);
  const [result, setResult] = useState<AnalysisResult|null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [busy, setBusy] = useState<"ats"|"job"|null>(null);
  const [error, setError] = useState("");
  const abort = useRef<AbortController|null>(null);
  const hasResume = mode === "file" ? Boolean(file) : resume.trim().length >= 50;

  function resetResume() { setAts(null);setResult(null);setShowEditor(false);setError("");abort.current?.abort();setBusy(null); }
  function changeMode(next:"file"|"text") { setMode(next);resetResume(); }
  function changeFile(next:File|null) { setFile(next);resetResume(); }
  function changeText(next:string) { setResume(next);resetResume(); }

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
      if(!controller.signal.aborted)setResult(payload as AnalysisResult);
    } catch(cause) {
      if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:"Falha na comparação.");
    } finally {
      if(abort.current===controller){setBusy(null);abort.current=null;}
    }
  }

  return <div className="platform-shell journey-shell">
    <PlatformNav/>
    <main className="platform-container journey-main">
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
        {!ats?<div className="journey-step-locked"><Info size={20}/> Verifique a leitura do currículo na etapa 1 para continuar.</div>:
          <div className="journey-columns">
            <form className="journey-form" onSubmit={compare}>
              <ConnectedProviderPicker provider={provider} onProviderChange={setProvider} model={model}
                onModelChange={setModel} onReadyChange={setProviderReady}/>
              <label className="journey-label" htmlFor="journey-job-description">Descrição da vaga</label>
              <textarea id="journey-job-description" rows={8} maxLength={14000} value={job} onChange={event=>{setJob(event.target.value);setResult(null);}}
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

      <section className="journey-finish" id="melhorar"><div><span>03 · PRÓXIMO PASSO</span><h2>Revise, melhore e exporte.</h2>
        <p>As recomendações aparecem no resultado da comparação com a vaga. Use o Studio para editar os campos do seu currículo e exportar o documento.</p></div>
        <Link href="/studio" className="journey-finish-button"><FilePenLine size={17}/> Abrir Studio <ArrowRight size={17}/></Link>
      </section>
      <p className="journey-disclaimer"><Info size={17}/> Esta jornada não garante classificação, entrevista ou contratação. As decisões dependem dos critérios de cada empresa.</p>
    </main>
  </div>;
}
