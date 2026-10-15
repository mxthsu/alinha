"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

type MatchStatus = "evidenciado" | "parcial" | "nao_identificado";
type Requirement = {
  requirement: string;
  job_evidence: string;
  status: MatchStatus;
  resume_evidence: string | null;
  recommendation: string;
};
type AnalysisResult = {
  job_title: string;
  summary: string;
  requirements: Requirement[];
  limitations: string[];
  analysis_mode: "ai" | "demo";
};

const DEMO_REPORT: AnalysisResult = {
  job_title: "Pessoa Desenvolvedora Backend",
  summary:
    "Foram analisados 3 requisitos: 1 com evidências no currículo, 1 com evidências parciais e 1 sem evidência identificada.",
  analysis_mode: "demo",
  requirements: [
    {
      requirement: "Python e FastAPI",
      job_evidence: "Experiência com desenvolvimento de APIs em Python e FastAPI",
      status: "evidenciado",
      resume_evidence: "Desenvolvimento de APIs REST com Python e FastAPI",
      recommendation:
        "Você pode detalhar resultados e impactos reais desses projetos para fortalecer o currículo.",
    },
    {
      requirement: "Testes automatizados",
      job_evidence: "Conhecimento em testes automatizados",
      status: "parcial",
      resume_evidence: "Colaboração com a equipe na validação de funcionalidades",
      recommendation:
        "Esclareça quais testes você executou e quais ferramentas utilizou, se tiver essa experiência.",
    },
    {
      requirement: "Kubernetes",
      job_evidence: "Vivência com Kubernetes em produção",
      status: "nao_identificado",
      resume_evidence: null,
      recommendation:
        "Não foi localizada evidência no currículo. Inclua uma experiência verdadeira, caso a possua.",
    },
  ],
  limitations: [
    "Este é um exemplo fictício, não uma análise de um currículo real.",
    "A classificação não equivale à pontuação de sistemas ATS.",
  ],
};

const statusLabels: Record<MatchStatus, string> = {
  evidenciado: "Com evidência",
  parcial: "Evidência parcial",
  nao_identificado: "Não identificado",
};

export default function Home() {
  const [mode, setMode] = useState<"text" | "file">("text");
  const [resumeText, setResumeText] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canAnalyze =
    jobDescription.trim().length >= 60 &&
    (mode === "file" ? resumeFile !== null : resumeText.trim().length >= 50);

  function showDemo() {
    setError("");
    setResult(DEMO_REPORT);
    document.getElementById("resultado")?.scrollIntoView({ behavior: "smooth" });
  }

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAnalyze) return;
    setLoading(true);
    setError("");
    setResult(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    let endpoint: string;
    let options: RequestInit;

    if (mode === "file" && resumeFile) {
      const formData = new FormData();
      formData.append("file", resumeFile);
      formData.append("job_description", jobDescription);
      endpoint = "/api/v1/analyses/upload";
      options = { method: "POST", body: formData };
    } else {
      endpoint = "/api/v1/analyses/text";
      options = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_text: resumeText, job_description: jobDescription }),
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
      setResult(payload as AnalysisResult);
      setTimeout(() => document.getElementById("resultado")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (caught) {
      setError(
        caught instanceof TypeError
          ? "Não foi possível conectar à API. Confira se o servidor está em execução."
          : caught instanceof Error
            ? caught.message
            : "Ocorreu um erro inesperado.",
      );
    } finally {
      setLoading(false);
    }
  }

  const count = (status: MatchStatus) =>
    result?.requirements.filter((item) => item.status === status).length ?? 0;

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="container header-inner">
          <Link className="brand" href="/" aria-label="Alinha, página inicial">
            <span className="brand-mark" aria-hidden="true">↗</span>
            alinha<span className="brand-dot">.</span>
          </Link>
          <nav className="nav-links" aria-label="Navegação principal">
            <a href="#como-funciona">Como funciona</a>
            <a href="#analisar">Analisar currículo</a>
            <a href="https://github.com/mxthsu/alinha" target="_blank" rel="noreferrer">
              GitHub <span aria-hidden="true">↗</span>
            </a>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <span className="eyebrow"><span className="eyebrow-dot" /> Sua carreira merece clareza</span>
              <h1>Seu currículo tem uma história. <em>Faça ela contar.</em></h1>
              <p>
                Compare sua experiência com os requisitos de uma vaga, veja o que está
                comprovado e descubra como apresentar melhor seu potencial.
              </p>
              <div className="hero-actions">
                <a href="#analisar" className="button button-primary">
                  Analisar meu currículo <span aria-hidden="true">↗</span>
                </a>
                <button className="button button-outline" type="button" onClick={showDemo}>
                  Ver uma demonstração
                </button>
              </div>
              <div className="hero-footnotes">
                <span>✓ Recomendações com evidências</span>
                <span>✓ Sem inventar experiências</span>
                <span>✓ Código aberto</span>
              </div>
            </div>
            <div className="hero-preview" aria-hidden="true">
              <div className="preview-top"><span>VISÃO GERAL DA ANÁLISE</span><span className="preview-icon">✳</span></div>
              <p className="preview-title">Desenvolvimento Backend</p>
              <div className="preview-divider" />
              <div className="preview-row"><span>Python & FastAPI</span><span className="preview-tag good">Com evidência</span></div>
              <div className="preview-row"><span>Testes automatizados</span><span className="preview-tag medium">Parcial</span></div>
              <div className="preview-row"><span>Kubernetes</span><span className="preview-tag neutral">Não identificado</span></div>
              <div className="preview-bottom"><span className="preview-light">✦</span> Cada conclusão apoiada em trechos verificáveis.</div>
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
              <article className="step"><span className="step-num">01</span><h3>Compartilhe seu currículo</h3><p>Envie PDF, DOCX, TXT ou cole o texto. Não armazenamos seu documento nesta versão.</p></article>
              <article className="step"><span className="step-num">02</span><h3>Informe a vaga</h3><p>Cole a descrição da oportunidade para identificar os requisitos que realmente foram publicados.</p></article>
              <article className="step"><span className="step-num">03</span><h3>Entenda as evidências</h3><p>Receba uma comparação por requisito, com trechos do currículo, limitações e próximos passos.</p></article>
            </div>
          </div>
        </section>

        <section className="workspace-section" id="analisar">
          <div className="container">
            <div className="section-heading">
              <span className="section-label">SUA ANÁLISE</span>
              <h2>Veja seu perfil com mais clareza.</h2>
              <p>Comece gratuitamente. Para análises reais, a API precisa estar configurada com um provedor de IA.</p>
            </div>
            <div className="workspace">
              <form className="form-panel" onSubmit={analyze}>
                <div className="panel-heading"><span className="panel-index">01</span><h3>Seu currículo</h3></div>
                <div className="mode-switch" role="group" aria-label="Forma de envio do currículo">
                  <button type="button" className={mode === "text" ? "active" : ""} onClick={() => setMode("text")} aria-pressed={mode === "text"}>Colar texto</button>
                  <button type="button" className={mode === "file" ? "active" : ""} onClick={() => setMode("file")} aria-pressed={mode === "file"}>Enviar arquivo</button>
                </div>
                {mode === "text" ? (
                  <>
                    <label htmlFor="resume-text" className="field-label">Conteúdo do currículo</label>
                    <textarea id="resume-text" className="text-area" placeholder="Cole aqui suas experiências profissionais, habilidades e projetos..." value={resumeText} onChange={(event) => setResumeText(event.target.value)} rows={6} maxLength={22000} />
                  </>
                ) : (
                  <div className="upload-box">
                    <label htmlFor="resume-file" className="upload-label">
                      <span className="upload-symbol" aria-hidden="true">↑</span>
                      <strong>{resumeFile ? resumeFile.name : "Escolher currículo"}</strong>
                      <small>PDF, DOCX ou TXT • até 3 MB</small>
                    </label>
                    <input id="resume-file" type="file" accept=".pdf,.docx,.txt" onChange={(event) => setResumeFile(event.target.files?.[0] ?? null)} />
                  </div>
                )}
                <div className="panel-heading second-heading"><span className="panel-index">02</span><h3>A vaga desejada</h3></div>
                <label htmlFor="job-text" className="field-label">Descrição da oportunidade</label>
                <textarea id="job-text" className="text-area" placeholder="Cole a descrição completa da vaga, incluindo responsabilidades e requisitos..." value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} rows={7} maxLength={14000} />
                <div className="form-note">Seus dados são enviados para análise, mas não são armazenados pela API. O provedor de IA processa o conteúdo conforme seus próprios termos.</div>
                {error && <div className="error-message" role="alert">{error}</div>}
                <button type="submit" className="button button-dark submit-button" disabled={!canAnalyze || loading}>
                  {loading ? "Analisando os documentos..." : "Analisar correspondência"} <span aria-hidden="true">↗</span>
                </button>
              </form>

              <section className="result-panel" id="resultado" aria-live="polite" aria-label="Resultado da análise">
                {result ? (
                  <>
                    <div className="result-header">
                      <span className="result-kicker">{result.analysis_mode === "demo" ? "EXEMPLO FICTÍCIO" : "ANÁLISE COM IA"}</span>
                      <h3>{result.job_title}</h3>
                      <p>{result.summary}</p>
                    </div>
                    <div className="result-stats">
                      <div><strong>{count("evidenciado")}</strong><span>Com evidência</span></div>
                      <div><strong>{count("parcial")}</strong><span>Parciais</span></div>
                      <div><strong>{count("nao_identificado")}</strong><span>Não identificados</span></div>
                    </div>
                    <div className="requirements">
                      {result.requirements.map((item, index) => (
                        <article className="requirement" key={index}>
                          <div className="requirement-heading"><h4>{item.requirement}</h4><span className={"status status-" + item.status}>{statusLabels[item.status]}</span></div>
                          <p className="evidence"><strong>Na vaga:</strong> “{item.job_evidence}”</p>
                          {item.resume_evidence && <p className="evidence"><strong>No currículo:</strong> “{item.resume_evidence}”</p>}
                          <p className="recommendation">{item.recommendation}</p>
                        </article>
                      ))}
                    </div>
                    <div className="limitation"><strong>Importante</strong>{result.limitations.map((item, index) => <p key={index}>{item}</p>)}</div>
                  </>
                ) : (
                  <div className="empty-result">
                    <div className="empty-icon" aria-hidden="true">✳</div>
                    <span className="result-kicker">A PRÓXIMA ETAPA COMEÇA AQUI</span>
                    <h3>Conheça os pontos fortes da sua trajetória.</h3>
                    <p>Preencha os campos ao lado para descobrir quais requisitos estão descritos no seu currículo e onde você pode trazer mais contexto.</p>
                    <div className="empty-divider" />
                    <button className="text-link" type="button" onClick={showDemo}>Explorar um resultado de exemplo <span aria-hidden="true">↗</span></button>
                  </div>
                )}
              </section>
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer"><div className="container footer-inner"><Link className="brand" href="/">alinha<span className="brand-dot">.</span></Link><p>Software aberto para uma busca de oportunidades mais transparente.</p><a href="https://github.com/mxthsu/alinha" target="_blank" rel="noreferrer">Ver projeto no GitHub ↗</a></div></footer>
    </div>
  );
}
