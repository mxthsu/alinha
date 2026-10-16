"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, ChevronRight,
  FileCheck2, FileText, Info, LoaderCircle, ShieldCheck, UploadCloud,
} from "lucide-react";
import "./ats.css";

type Finding = {
  code: string;
  severity: "important" | "attention" | "suggestion";
  title: string;
  explanation: string;
  action: string;
};
type Report = {
  document_type: "pdf" | "docx" | "txt" | "text";
  assessment: "review_needed" | "basic_readability_confirmed";
  readable_characters: number;
  findings: Finding[];
  limitations: string[];
};

const labels: Record<Finding["severity"], string> = {
  important: "Importante",
  attention: "Atenção",
  suggestion: "Sugestão",
};

export default function AtsCheck() {
  const [mode, setMode] = useState<"file" | "text">("file");
  const [file, setFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || (mode === "file" && !file) || (mode === "text" && !resumeText.trim())) return;

    setLoading(true);
    setError("");
    setReport(null);
    try {
      let url: string;
      let options: RequestInit;
      if (mode === "file" && file) {
        if (file.size > 3 * 1024 * 1024) {
          throw new Error("O arquivo deve ter até 3 MB.");
        }
        if (!/\.(pdf|docx|txt)$/i.test(file.name)) {
          throw new Error("Envie PDF, DOCX ou TXT.");
        }
        const data = new FormData();
        data.append("file", file);
        url = "/api/v1/ats/check/upload";
        options = { method: "POST", body: data };
      } else {
        url = "/api/v1/ats/check/text";
        options = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resume_text: resumeText }),
        };
      }
      const response = await fetch(apiUrl + url, options);
      const body: unknown = await response.json();
      if (!response.ok) {
        const detail = body && typeof body === "object" && "detail" in body
          ? (body as { detail: unknown }).detail : null;
        throw new Error(typeof detail === "string" ? detail : "Não foi possível verificar o documento.");
      }
      setReport(body as Report);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ocorreu um erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ats-shell">
      <header className="ats-header">
        <div className="ats-container">
          <Link href="/" className="ats-brand" aria-label="Alinha, página inicial">
            <span className="ats-mark"><ArrowRight size={19} aria-hidden="true" /></span>
            alinha<span>.</span>
          </Link>
          <Link href="/" className="ats-back"><ArrowLeft size={16} aria-hidden="true" /> Voltar ao Alinha</Link>
        </div>
      </header>

      <main className="ats-main">
        <div className="ats-container">
          <div className="ats-heading">
            <div className="ats-eyebrow"><ShieldCheck size={16} aria-hidden="true" /> LEITURA E COMPATIBILIDADE ATS</div>
            <h1>Seu currículo pode ser <em>lido com clareza?</em></h1>
            <p>Verifique características que podem dificultar a leitura do arquivo por plataformas de recrutamento. Sem notas ATS inventadas e sem consumir sua IA.</p>
          </div>

          <div className="ats-columns">
            <form className="ats-inputPanel" onSubmit={submit}>
              <div className="ats-panelHeading">
                <span className="ats-number">01</span>
                <div><h2>Verifique seu documento</h2><p>A checagem acontece na API local, sem enviar o currículo para um modelo de IA.</p></div>
              </div>
              <div className="ats-modeSwitch" role="group" aria-label="Origem do currículo">
                <button type="button" className={mode === "file" ? "ats-current" : ""} aria-pressed={mode === "file"}
                  onClick={() => { setMode("file"); setReport(null); setError(""); }}>
                  <UploadCloud size={16} aria-hidden="true" /> Enviar arquivo
                </button>
                <button type="button" className={mode === "text" ? "ats-current" : ""} aria-pressed={mode === "text"}
                  onClick={() => { setMode("text"); setReport(null); setError(""); }}>
                  <FileText size={16} aria-hidden="true" /> Colar texto
                </button>
              </div>
              {mode === "file" ? (
                <div className="ats-fileBox">
                  <label htmlFor="ats-file">
                    <UploadCloud size={29} aria-hidden="true" />
                    <strong>{file ? file.name : "Selecione seu currículo"}</strong>
                    <span>{file ? `${(file.size / 1024).toFixed(0)} KB selecionados` : "PDF, DOCX ou TXT · até 3 MB"}</span>
                  </label>
                  <input id="ats-file" type="file" accept=".pdf,.docx,.txt" disabled={loading}
                    onChange={event => { setFile(event.target.files?.[0] || null); setReport(null); setError(""); }} />
                </div>
              ) : (
                <div className="ats-textBox">
                  <label htmlFor="ats-resume">Conteúdo do currículo</label>
                  <textarea id="ats-resume" value={resumeText} maxLength={22000} rows={10}
                    placeholder="Cole aqui o texto que deseja verificar…"
                    onChange={event => { setResumeText(event.target.value); setReport(null); setError(""); }}
                    disabled={loading} />
                  <small>{resumeText.length.toLocaleString("pt-BR")} / 22.000 caracteres</small>
                </div>
              )}
              <div className="ats-privacy"><ShieldCheck size={18} aria-hidden="true" />
                O diagnóstico não armazena o documento nem utiliza sua chave Gemini.</div>
              {error && <p role="alert" className="ats-error"><AlertCircle size={17} aria-hidden="true" />{error}</p>}
              <button className="ats-submit" disabled={loading || (mode === "file" ? !file : !resumeText.trim())}>
                {loading ? <LoaderCircle size={18} className="ats-spin" aria-hidden="true" /> : <FileCheck2 size={18} aria-hidden="true" />}
                {loading ? "Verificando documento…" : "Verificar compatibilidade"}
                {!loading && <ArrowRight size={17} aria-hidden="true" />}
              </button>
            </form>

            <section className="ats-results" aria-live="polite" aria-label="Diagnóstico de legibilidade ATS">
              {report ? (
                <>
                  <div className="ats-reportTop"><span className="ats-eyebrow">02 · DIAGNÓSTICO</span><span className="ats-reportType">{report.document_type.toUpperCase()}</span></div>
                  <h2>{report.assessment === "basic_readability_confirmed" ? "Nenhum problema básico identificado" : "Pontos para revisar"}</h2>
                  <p>O Alinha conseguiu recuperar {report.readable_characters.toLocaleString("pt-BR")} caracteres de texto. Isso não garante a interpretação por todos os ATS.</p>
                  {report.findings.length ? (
                    <div className="ats-findings">
                      {report.findings.map(finding => (
                        <article className="ats-finding" key={finding.code}>
                          <div className="ats-findingTop"><AlertCircle size={18} aria-hidden="true" />
                            <span>{labels[finding.severity]}</span>
                          </div>
                          <h3>{finding.title}</h3>
                          <p>{finding.explanation}</p>
                          <div className="ats-action"><strong>Como melhorar:</strong> {finding.action}</div>
                        </article>
                      ))}
                    </div>
                  ) : <div className="ats-ok"><CheckCircle2 size={20} /> A checagem básica não identificou alertas neste documento.</div>}
                  <div className="ats-limitations">
                    <Info size={17} aria-hidden="true" />
                    <div>{report.limitations.map(item => <p key={item}>{item}</p>)}</div>
                  </div>
                  <Link href="/" className="ats-analyze">Comparar com uma vaga <ChevronRight size={18} /></Link>
                </>
              ) : (
                <div className="ats-empty">
                  <div className="ats-symbol"><FileCheck2 size={29} aria-hidden="true" /></div>
                  <span className="ats-eyebrow">02 · RESULTADO</span>
                  <h2>Um currículo mais fácil de interpretar.</h2>
                  <p>Envie o arquivo para identificar problemas de extração de texto, tabelas, cabeçalhos e organização de seções.</p>
                  <div className="ats-features">
                    <div><CheckCircle2 size={17} /> Leitura de PDF, DOCX e TXT</div>
                    <div><CheckCircle2 size={17} /> Recomendações com motivo claro</div>
                    <div><CheckCircle2 size={17} /> Sem pontuação ATS fictícia</div>
                  </div>
                </div>
              )}
            </section>
          </div>
          <div className="ats-disclaimer">
            <Info size={18} aria-hidden="true" />
            Compatibilidade de leitura é diferente de aprovação em uma vaga. Os critérios e decisões variam entre plataformas e empregadores.
          </div>
        </div>
      </main>
    </div>
  );
}
