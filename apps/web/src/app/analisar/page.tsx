"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, FileSearch, LoaderCircle, ShieldCheck, XCircle } from "lucide-react";
import { ResumeUpload } from "@/components/resume-upload";
import { AnalysisReport } from "@/components/analysis-report";
import { ConnectedProviderPicker } from "@/components/connected-provider-picker";
import type { Provider } from "@/components/provider-selector";
import { type AnalysisResult, DEMO_REPORT } from "@/lib/analysis";
import { PlatformNav } from "@/components/platform-nav";

export default function AnalyzePage() {
  const [mode, setMode] = useState<"text" | "file">("text");
  const [resumeText, setResumeText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState("");
  const [provider, setProvider] = useState<Provider>("gemini");
  const [model, setModel] = useState("");
  const [ready, setReady] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const canAnalyze = ready && job.trim().length >= 60 && (mode === "file" ? Boolean(file) : resumeText.trim().length >= 50);

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAnalyze || loading) return;
    const abort = new AbortController();
    controller.current = abort;
    setLoading(true); setError(""); setResult(null);
    let endpoint = "/api/v1/analyses/text";
    let options: RequestInit;
    if (mode === "file" && file) {
      const payload = new FormData();
      payload.append("file", file);
      payload.append("job_description", job);
      payload.append("provider", provider);
      if (provider === "chatgpt" && model) payload.append("model", model);
      endpoint = "/api/v1/analyses/upload";
      options = { method: "POST", body: payload, signal: abort.signal };
    } else {
      options = { method: "POST", signal: abort.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_text: resumeText, job_description: job, provider,
          model: provider === "chatgpt" ? model || null : null,
        }),
      };
    }
    try {
      const response = await fetch(api + endpoint, options);
      const payload: unknown = await response.json();
      if (!response.ok) {
        const detail = payload && typeof payload === "object" && "detail" in payload
          ? (payload as { detail?: unknown }).detail : null;
        throw new Error(typeof detail === "string" ? detail : "Não foi possível analisar a vaga.");
      }
      if (abort.signal.aborted) return;
      setResult(payload as AnalysisResult);
    } catch (caught) {
      if (!abort.signal.aborted) setError(caught instanceof Error ? caught.message : "Falha inesperada ao analisar a vaga.");
    } finally {
      if (controller.current === abort) { controller.current = null; setLoading(false); }
    }
  }
  return <div className="platform-shell">
    <PlatformNav/>
    <main className="platform-container">
      <div className="platform-kicker"><FileSearch size={17}/> ANÁLISE DE OPORTUNIDADES</div>
      <h1>Compare seu currículo com uma vaga.</h1>
      <p className="platform-lead">Veja os requisitos publicados, as evidências do currículo e os pontos que merecem atenção. Sem notas ATS fictícias.</p>
      <div className="analysis-layout">
        <form onSubmit={analyze} className="analysis-form">
          <ConnectedProviderPicker provider={provider} onProviderChange={setProvider} model={model} onModelChange={setModel} onReadyChange={setReady}/>
          <div className="analysis-divider"/>
          <div className="panel-heading"><span className="panel-index">01</span><h3>Seu currículo</h3></div>
          <ResumeUpload mode={mode} onModeChange={setMode}
            resumeText={resumeText} onResumeTextChange={setResumeText}
            file={file} onFileChange={setFile}/>
          <div className="analysis-divider"/>
          <div className="panel-heading"><span className="panel-index">02</span><h3>Descrição da vaga</h3></div>
          <label className="field-label" htmlFor="analysis-job">Requisitos e responsabilidades publicados</label>
          <textarea id="analysis-job" className="text-area" value={job} onChange={event => setJob(event.target.value)}
            rows={8} maxLength={14000} placeholder="Cole aqui a descrição completa da oportunidade…"/>
          <div className="analysis-field-meta">{job.trim().length >= 60 ? <span><CheckCircle2 size={14}/> Descrição pronta para análise</span> : <span>Mínimo de 60 caracteres</span>}<span>{job.length.toLocaleString("pt-BR")} / 14.000</span></div>
          {!ready && <p className="analysis-connect-note"><ShieldCheck size={17}/> É preciso configurar a IA em <Link href="/conexoes">Conexões de IA</Link> antes de analisar.</p>}
          <p className="analysis-privacy"><ShieldCheck size={16}/> O conteúdo é processado pelo provedor selecionado, exceto quando você utiliza Ollama local.</p>
          {error && <p className="analysis-error" role="alert"><XCircle size={16}/> {error}</p>}
          <button type="submit" className="analysis-submit" disabled={!canAnalyze || loading}>
            {loading ? <LoaderCircle className="spinner" size={17}/> : <FileSearch size={17}/>}
            {loading ? "Analisando…" : "Analisar correspondência"} <ArrowRight size={16}/>
          </button>
          {loading && <button className="analysis-cancel" type="button" onClick={() => { controller.current?.abort(); setLoading(false); }}>Cancelar análise</button>}
        </form>
        <section className="analysis-result" aria-label="Resultado da comparação" aria-live="polite">
          <AnalysisReport result={result} loading={loading} onDemo={() => setResult(DEMO_REPORT)} onReset={() => {setResult(null);setError("");}}/>
        </section>
      </div>
    </main>
  </div>;
}
