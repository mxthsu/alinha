"use client";
import {apiFetch} from "@/lib/api-fetch";

import { useEffect, useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Download, FilePenLine, RotateCcw, ShieldCheck } from "lucide-react";
import "./ats-editor.css";

type AtsFinding = { code: string; severity: string; title: string };
type AtsReport = { findings: AtsFinding[]; assessment: string };

type Props = {
  apiUrl: string;
  sourceText: string | null;
  file: File | null;
};

function errorDetail(payload: unknown): string {
  if (payload && typeof payload === "object" && "detail" in payload) {
    const value = (payload as { detail: unknown }).detail;
    if (typeof value === "string") return value;
  }
  return "Não foi possível completar a operação.";
}

export function AtsEditor({ apiUrl, sourceText, file }: Props) {
  const [original, setOriginal] = useState(sourceText || "");
  const [draft, setDraft] = useState(sourceText || "");
  const [loading, setLoading] = useState(Boolean(file));
  const [action, setAction] = useState<"check" | "download" | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [report, setReport] = useState<AtsReport | null>(null);

  useEffect(() => {
    let active = true;
    if (!file) return () => { active = false; };
    const data = new FormData();
    data.append("file", file);
    apiFetch(apiUrl + "/api/v1/ats/editor/import", { method: "POST", body: data })
      .then(async response => {
        const payload: unknown = await response.json();
        if (!response.ok) throw new Error(errorDetail(payload));
        return payload as { resume_text: string };
      })
      .then(payload => {
        if (!active) return;
        setOriginal(payload.resume_text);
        setDraft(payload.resume_text);
      })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível importar o documento.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [apiUrl, file, sourceText]);

  async function recheck() {
    if (action || draft.trim().length < 50) return;
    setAction("check");
    setError("");
    setFeedback("");
    try {
      const response = await apiFetch(apiUrl + "/api/v1/ats/check/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_text: draft }),
      });
      const payload: unknown = await response.json();
      if (!response.ok) throw new Error(errorDetail(payload));
      setReport(payload as AtsReport);
      setFeedback("Texto reavaliado. Confira os alertas antes de exportar.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível reavaliar.");
    } finally {
      setAction(null);
    }
  }

  async function exportDocx() {
    if (action || draft.trim().length < 50) return;
    setAction("download");
    setError("");
    try {
      const response = await apiFetch(apiUrl + "/api/v1/ats/editor/export/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_text: draft }),
      });
      if (!response.ok) {
        const payload: unknown = await response.json();
        throw new Error(errorDetail(payload));
      }
      const blob = await response.blob();
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = "alinha-curriculo.docx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback("DOCX gerado a partir do texto que você aprovou.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível exportar o DOCX.");
    } finally {
      setAction(null);
    }
  }

  const changed = draft !== original;
  return (
    <section id="ats-editor" className="ats-editor" aria-label="Editor manual de currículo">
      <div className="ats-editor-top">
        <div>
          <span className="ats-editor-eyebrow"><FilePenLine size={16} aria-hidden="true" /> PRÓXIMA ETAPA · PREPARAR CURRÍCULO</span>
          <h2>Edite, revise e exporte.</h2>
          <p>O Alinha preserva o conteúdo original. Somente as alterações que você fizer serão incluídas no DOCX final.</p>
        </div>
        <span className="ats-editor-local"><ShieldCheck size={15} aria-hidden="true" /> Sem chamada de IA</span>
      </div>
      {loading ? <p className="ats-editor-message">Importando o texto para edição…</p> : error && !original ? (
        <p className="ats-editor-error" role="alert"><AlertCircle size={16} /> {error}</p>
      ) : (
        <>
          <div className="ats-editor-columns">
            <div className="ats-editor-pane">
              <div className="ats-editor-label"><strong>Original extraído</strong><span>Somente leitura</span></div>
              <pre className="ats-editor-original">{original}</pre>
            </div>
            <div className="ats-editor-pane">
              <div className="ats-editor-label"><label htmlFor="ats-draft"><strong>Versão para candidatura</strong></label><span>{draft.length.toLocaleString("pt-BR")} / 22.000</span></div>
              <textarea id="ats-draft" value={draft} maxLength={22000} rows={18}
                onChange={event => { setDraft(event.target.value); setReport(null); setFeedback(""); }}
                placeholder="Escreva uma versão fiel às suas experiências reais." spellCheck />
              <div className="ats-editor-status">
                {changed ? <><CheckCircle2 size={15} /> Alterações ainda não exportadas</> : "Nenhuma alteração feita"}
              </div>
            </div>
          </div>
          {report && (
            <div className="ats-editor-review" role="status">
              <strong>Nova verificação: {report.findings.length} {report.findings.length === 1 ? "ponto identificado" : "pontos identificados"}</strong>
              {report.findings.length > 0 && <ul>{report.findings.map(item => <li key={item.code}>{item.title}</li>)}</ul>}
              {!report.findings.length && <p>Nenhum alerta nas verificações básicas. Isso não garante aprovação em sistemas ATS.</p>}
            </div>
          )}
          {error && <p className="ats-editor-error" role="alert"><AlertCircle size={16} /> {error}</p>}
          {feedback && <p className="ats-editor-message" role="status">{feedback}</p>}
          <div className="ats-editor-actions">
            <button type="button" className="ats-editor-secondary" onClick={() => {setDraft(original); setReport(null); setFeedback("");}} disabled={!changed || Boolean(action)}>
              <RotateCcw size={16} /> Restaurar original
            </button>
            <div className="ats-editor-right">
              <button type="button" className="ats-editor-secondary" onClick={recheck} disabled={Boolean(action) || draft.trim().length < 50}>
                Revalidar texto <ArrowRight size={15} />
              </button>
              <button type="button" className="ats-editor-primary" onClick={exportDocx} disabled={Boolean(action) || draft.trim().length < 50}>
                <Download size={17} /> {action === "download" ? "Exportando…" : "Exportar DOCX"}
              </button>
            </div>
          </div>
          <p className="ats-editor-disclaimer">A exportação é um modelo simples de coluna única, não uma garantia de aprovação. Confira o arquivo gerado antes de enviar sua candidatura. PDF com texto selecionável será incluído numa próxima etapa.</p>
        </>
      )}
    </section>
  );
}
