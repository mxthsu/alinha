"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, BookOpen, Check, CheckCircle2, CircleHelp,
  ClipboardList, Code2, FileText, KeyRound, LoaderCircle, SearchCheck,
  ShieldCheck, Sparkles, XCircle,
} from "lucide-react";
import { ResumeUpload } from "@/components/resume-upload";
import { ProviderSelector, type Provider } from "@/components/provider-selector";
import { AnalysisReport } from "@/components/analysis-report";
import { type AnalysisResult, DEMO_REPORT } from "@/lib/analysis";

function scrollToSection(id: string) {
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
  document.getElementById(id)?.scrollIntoView({ behavior });
}

const steps = [
  { number: "01", icon: KeyRound, title: "Conecte sua IA", description: "Primeiro, escolha um provedor e conecte sua conta autorizada, chave de API ou modelo local." },
  { number: "02", icon: FileText, title: "Compartilhe seu currículo", description: "Envie PDF, DOCX ou TXT, ou cole seu texto diretamente no formulário." },
  { number: "03", icon: ClipboardList, title: "Informe a vaga", description: "Cole a descrição para identificar os requisitos publicados." },
  { number: "04", icon: SearchCheck, title: "Entenda as evidências", description: "Compare requisitos, trechos do currículo e sugestões fundamentadas." },
];

export default function Home() {
  const [mode, setMode] = useState<"text" | "file">("text");
  const [resumeText, setResumeText] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<Provider>("gemini");
  const [model, setModel] = useState("");
  const [providerReady, setProviderReady] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<"connect" | "analyze">("connect");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const controllerRef = useRef<AbortController | null>(null);

  const canAnalyze =
    providerReady && jobDescription.trim().length >= 60 &&
    (mode === "file" ? resumeFile !== null : resumeText.trim().length >= 50);

  function showDemo() {
    setWorkspaceTab("analyze");
    if (loading) controllerRef.current?.abort();
    setLoading(false);
    setError("");
    setResult(DEMO_REPORT);
    requestAnimationFrame(() => scrollToSection("resultado"));
  }

  function resetReport() {
    setWorkspaceTab("analyze");
    setResult(null);
    setError("");
    requestAnimationFrame(() => scrollToSection("analisar"));
  }

  function cancelAnalysis() {
    controllerRef.current?.abort();
    setLoading(false);
  }

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAnalyze || loading) return;

    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError("");
    setResult(null);

    let endpoint: string;
    let options: RequestInit;

    if (mode === "file" && resumeFile) {
      const formData = new FormData();
      formData.append("file", resumeFile);
      formData.append("job_description", jobDescription);
      formData.append("provider", provider);
      if (provider === "chatgpt" && model) formData.append("model", model);
      endpoint = "/api/v1/analyses/upload";
      options = { method: "POST", body: formData, signal: controller.signal };
    } else {
      endpoint = "/api/v1/analyses/text";
      options = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_text: resumeText, job_description: jobDescription, provider, model: provider === "chatgpt" ? model || null : null }),
        signal: controller.signal,
      };
    }

    try {
      const response = await fetch(apiUrl + endpoint, options);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof payload.detail === "string"
            ? payload.detail
            : "Não foi possível analisar os documentos. Confira os dados enviados.",
        );
      }
      if (controller.signal.aborted) return;
      setResult(payload as AnalysisResult);
      requestAnimationFrame(() => scrollToSection("resultado"));
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(
        caught instanceof TypeError
          ? "Não foi possível conectar à API. Confira se o servidor está em execução."
          : caught instanceof Error
            ? caught.message
            : "Ocorreu um erro inesperado.",
      );
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setLoading(false);
      }
    }
  }

  const jobProgress = Math.min(100, (jobDescription.trim().length / 60) * 100);

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="container header-inner">
          <Link className="brand" href="/" aria-label="Alinha, página inicial">
            <span className="brand-mark" aria-hidden="true"><ArrowUpRight size={23} strokeWidth={2.5} /></span>
            alinha<span className="brand-dot">.</span>
          </Link>
          <nav className="nav-links" aria-label="Navegação principal">
            <a href="#como-funciona">Como funciona</a>
            <Link href="/ats">Verificar ATS</Link>
            <Link href="/studio">Criar currículo</Link>
            <a className="nav-featured" href="#analisar" onClick={() => setWorkspaceTab("connect")}>Começar <ArrowUpRight size={14} aria-hidden="true" /></a>
            <a href="https://github.com/mxthsu/alinha" target="_blank" rel="noreferrer">
              <Code2 size={16} aria-hidden="true" /> <span>GitHub</span>
            </a>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-glow" aria-hidden="true" />
          <div className="container hero-grid">
            <div className="hero-copy">
              <span className="eyebrow"><span className="eyebrow-dot" /> Sua carreira merece clareza <Sparkles size={13} aria-hidden="true" /></span>
              <h1>Seu currículo tem uma história. <em>Faça ela contar.</em></h1>
              <p>
                Compare sua experiência com os requisitos de uma vaga, veja o que está
                comprovado e descubra como apresentar melhor seu potencial.
              </p>
              <div className="hero-actions">
                <a href="#analisar" className="button button-primary" onClick={() => setWorkspaceTab("connect")}>
                  Começar pela conexão <ArrowUpRight size={18} aria-hidden="true" />
                </a>
                <button className="button button-outline" type="button" onClick={showDemo}>
                  <Sparkles size={16} aria-hidden="true" /> Ver uma demonstração
                </button>
              </div>
              <div className="hero-footnotes">
                <span><Check size={14} aria-hidden="true" /> Recomendações com evidências</span>
                <span><Check size={14} aria-hidden="true" /> Sem inventar experiências</span>
                <span><Check size={14} aria-hidden="true" /> Código aberto</span>
              </div>
            </div>

            <div className="hero-preview" aria-label="Ilustração de um relatório de análise">
              <div className="preview-top"><span><span className="preview-live-dot" /> PRÉVIA DO RELATÓRIO</span><span className="preview-icon"><Sparkles size={18} /></span></div>
              <p className="preview-title">Desenvolvimento Backend</p>
              <p className="preview-subtitle">Uma visão clara de cada requisito da vaga.</p>
              <div className="preview-divider" />
              <div className="preview-row"><span><CheckCircle2 size={17} className="preview-good-icon" /> Python &amp; FastAPI</span><span className="preview-tag good">Com evidência</span></div>
              <div className="preview-row"><span><CircleHelp size={17} className="preview-medium-icon" /> Testes automatizados</span><span className="preview-tag medium">Parcial</span></div>
              <div className="preview-row"><span><XCircle size={17} className="preview-neutral-icon" /> Kubernetes</span><span className="preview-tag neutral">Não identificado</span></div>
              <div className="preview-bottom"><ShieldCheck size={18} aria-hidden="true" /> Cada conclusão apoiada em trechos verificáveis.</div>
              <span className="preview-bubble" aria-hidden="true"><Sparkles size={15} /> Análise com contexto</span>
            </div>
          </div>
        </section>

        <section className="intro-section" id="como-funciona">
          <div className="container">
            <div className="section-heading">
              <span className="section-label">COMO FUNCIONA</span>
              <h2>Menos achismo. Mais contexto.</h2>
              <p>Uma análise transparente, pensada para ajudar — não para prometer aprovação em processos seletivos.</p>
            </div>
            <div className="steps">
              {steps.map(({ number, icon: Icon, title, description }) => (
                <article className="step" key={number}>
                  <div className="step-top"><span className="step-icon"><Icon size={21} strokeWidth={1.8} aria-hidden="true" /></span><span className="step-num">{number}</span></div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <span className="step-bottom-line" aria-hidden="true" />
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="workspace-section" id="analisar">
          <div className="container">
            <div className="section-heading">
              <span className="section-label">COMECE POR AQUI</span>
              <h2>Primeiro, conecte sua IA.</h2>
              <p>Conecte uma conta autorizada ou uma chave de API. Depois envie seu currículo e a vaga para receber a análise.</p>
            </div>
            <div className="workspace-tabs" role="tablist" aria-label="Etapas do Alinha">
              <button id="tab-connect" role="tab" type="button" aria-selected={workspaceTab === "connect"}
                aria-controls="panel-connect" className={workspaceTab === "connect" ? "active" : ""}
                onClick={() => setWorkspaceTab("connect")}>
                <span className="workspace-tab-number">01</span> Conectar IA {providerReady && <CheckCircle2 size={16} color="#418c51" aria-label="Conectado" />}
              </button>
              <button id="tab-analyze" role="tab" type="button" aria-selected={workspaceTab === "analyze"}
                aria-controls="panel-analyze" className={workspaceTab === "analyze" ? "active" : ""}
                onClick={() => setWorkspaceTab("analyze")}>
                <span className="workspace-tab-number">02</span> Analisar currículo <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="connection-workspace" id="panel-connect" role="tabpanel" aria-labelledby="tab-connect" hidden={workspaceTab !== "connect"}>
              <div className="connection-main">
                <div className="form-panel-top"><span className="form-status-dot" /> PRIMEIRA ETAPA · CONEXÃO</div>
                <ProviderSelector apiUrl={apiUrl} provider={provider} onProviderChange={setProvider} model={model} onModelChange={setModel} onReadyChange={setProviderReady} disabled={loading} />
                <div className="connection-next">
                  <button type="button" className="button button-dark" disabled={!providerReady}
                    onClick={() => setWorkspaceTab("analyze")}>
                    Continuar para análise <ArrowRight size={17} aria-hidden="true" />
                  </button>
                  {!providerReady && <span>Conecte um provedor para continuar.</span>}
                </div>
              </div>
              <aside className="connection-guide">
                <span className="connection-guide-icon"><ShieldCheck size={23} aria-hidden="true" /></span>
                <h3>Sua IA, sua escolha.</h3>
                <p>Use a conta ChatGPT quando autorizada, uma chave própria de API ou o Ollama no computador.</p>
                <div className="connection-guide-rule"><Check size={16} aria-hidden="true" /> Chaves protegidas no cofre do sistema</div>
                <div className="connection-guide-rule"><Check size={16} aria-hidden="true" /> Sem copiar cookies ou senhas</div>
                <div className="connection-guide-rule"><Check size={16} aria-hidden="true" /> O uso da API pode ter cobrança</div>
              </aside>
            </div>
            <div className="workspace" id="panel-analyze" role="tabpanel" aria-labelledby="tab-analyze" hidden={workspaceTab !== "analyze"}>
              <form className="form-panel" onSubmit={analyze}>
                <div className="form-panel-top"><span className="form-status-dot" /> Suas informações</div>
                <div className="panel-heading"><span className="panel-index">01</span><h3>Seu currículo</h3></div>
                <ResumeUpload
                  mode={mode} onModeChange={setMode}
                  resumeText={resumeText} onResumeTextChange={setResumeText}
                  file={resumeFile} onFileChange={setResumeFile}
                />
                <div className="form-divider" />
                <div className="panel-heading second-heading"><span className="panel-index">02</span><h3>A vaga desejada</h3></div>
                <div className="field-header">
                  <label htmlFor="job-text" className="field-label">Descrição da oportunidade</label>
                  <span className="field-counter">{jobDescription.length.toLocaleString("pt-BR")} / 14.000</span>
                </div>
                <textarea
                  id="job-text" className="text-area" rows={7} maxLength={14000}
                  placeholder="Cole a descrição completa da vaga, incluindo responsabilidades e requisitos…"
                  value={jobDescription} onChange={(event) => setJobDescription(event.target.value)}
                  aria-describedby="job-help"
                />
                <div className="field-meta">
                  <span id="job-help">{jobDescription.trim().length >= 60 ? <><Check size={13} aria-hidden="true" /> Descrição pronta para análise</> : "Mínimo de 60 caracteres"}</span>
                  <span className="mini-progress" aria-hidden="true"><span style={{ width: `${jobProgress}%` }} /></span>
                </div>
                {!providerReady && (
                  <div className="connection-required" role="status">
                    <KeyRound size={18} aria-hidden="true" />
                    <span>Para analisar, você precisa conectar uma IA primeiro.</span>
                    <button type="button" onClick={() => setWorkspaceTab("connect")}>Conectar agora <ArrowRight size={14} aria-hidden="true" /></button>
                  </div>
                )}
                <p className="form-note"><ShieldCheck size={16} aria-hidden="true" /> Seus documentos não são armazenados no Alinha. O conteúdo é enviado ao provedor escolhido, exceto com Ollama local.</p>
                {error && <div className="error-message" role="alert"><XCircle size={18} aria-hidden="true" /><span>{error}</span><button className="icon-button" type="button" onClick={() => setError("")} aria-label="Fechar aviso"><XCircle size={16} aria-hidden="true" /></button></div>}
                <button type="submit" className="button button-dark submit-button" disabled={!canAnalyze || loading} aria-busy={loading}>
                  {loading ? <><LoaderCircle className="spinner" size={18} aria-hidden="true" /> Analisando…</> : <>Analisar correspondência <ArrowRight size={18} aria-hidden="true" /></>}
                </button>
                {loading && <button type="button" className="cancel-button" onClick={cancelAnalysis}>Cancelar análise</button>}
              </form>

              <section className="result-panel" id="resultado" aria-live="polite" aria-label="Resultado da análise">
                <AnalysisReport result={result} loading={loading} onDemo={showDemo} onReset={resetReport} />
              </section>
            </div>
          </div>
        </section>

        <section className="community-section" aria-labelledby="community-heading">
          <div className="container">
            <div className="community-card">
              <div className="community-content">
                <span className="community-label"><Code2 size={15} aria-hidden="true" /> CÓDIGO ABERTO · LICENÇA MIT</span>
                <h2 id="community-heading">A confiança começa com transparência.</h2>
                <p>O Alinha é desenvolvido em código aberto. Explore as decisões técnicas, execute no seu computador e ajude a construir análises mais claras e responsáveis.</p>
                <div className="community-actions">
                  <a className="button community-primary" href="https://github.com/mxthsu/alinha" target="_blank" rel="noreferrer">
                    Explorar o código <ArrowUpRight size={17} aria-hidden="true" />
                  </a>
                  <a className="community-doc-link" href="https://github.com/mxthsu/alinha/blob/main/docs/getting-started.md" target="_blank" rel="noreferrer">
                    Guia de instalação <BookOpen size={16} aria-hidden="true" />
                  </a>
                </div>
              </div>
              <div className="community-aside">
                <div><CheckCircle2 size={18} aria-hidden="true" /> <span>Evidências verificáveis</span></div>
                <div><CheckCircle2 size={18} aria-hidden="true" /> <span>Sem resultados inventados</span></div>
                <div><CheckCircle2 size={18} aria-hidden="true" /> <span>Construído com a comunidade</span></div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <Link className="brand" href="/">alinha<span className="brand-dot">.</span></Link>
          <p>Software aberto para uma busca de oportunidades mais transparente.</p>
          <a href="https://github.com/mxthsu/alinha" target="_blank" rel="noreferrer">
            Ver projeto no GitHub <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </div>
      </footer>
    </div>
  );
}
