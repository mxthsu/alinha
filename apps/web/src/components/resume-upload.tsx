"use client";

import { useRef, useState } from "react";
import { Check, FileText, FileUp, PencilLine, UploadCloud, X } from "lucide-react";

const MAX_FILE_SIZE = 3 * 1024 * 1024;

type ResumeUploadProps = {
  mode: "text" | "file";
  onModeChange: (mode: "text" | "file") => void;
  resumeText: string;
  onResumeTextChange: (value: string) => void;
  file: File | null;
  onFileChange: (file: File | null) => void;
};

export function ResumeUpload({
  mode, onModeChange, resumeText, onResumeTextChange, file, onFileChange,
}: ResumeUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState("");

  function acceptFile(selected: File | null) {
    setDragging(false);
    setFileError("");
    if (!selected) {
      onFileChange(null);
      return;
    }
    if (!/\.(pdf|docx|txt)$/i.test(selected.name)) {
      onFileChange(null);
      setFileError("Formato não aceito. Envie um PDF, DOCX ou TXT.");
      return;
    }
    if (selected.size > MAX_FILE_SIZE || selected.size === 0) {
      onFileChange(null);
      setFileError("O arquivo deve ter entre 1 byte e 3 MB.");
      return;
    }
    onFileChange(selected);
  }

  function clearFile() {
    onFileChange(null);
    setFileError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <>
      <div className="mode-switch" role="group" aria-label="Forma de envio do currículo">
        <span className={`mode-indicator ${mode === "file" ? "is-file" : ""}`} aria-hidden="true" />
        <button type="button" className={mode === "text" ? "active" : ""} onClick={() => onModeChange("text")} aria-pressed={mode === "text"}>
          <PencilLine size={15} aria-hidden="true" /> Colar texto
        </button>
        <button type="button" className={mode === "file" ? "active" : ""} onClick={() => onModeChange("file")} aria-pressed={mode === "file"}>
          <FileUp size={15} aria-hidden="true" /> Enviar arquivo
        </button>
      </div>
      {mode === "text" ? (
        <div className="field-enter">
          <div className="field-header">
            <label htmlFor="resume-text" className="field-label">Conteúdo do currículo</label>
            <span className="field-counter">{resumeText.length.toLocaleString("pt-BR")} / 22.000</span>
          </div>
          <textarea
            id="resume-text" className="text-area" rows={6} maxLength={22000}
            placeholder="Conte sobre sua experiência profissional, habilidades, projetos e resultados…"
            value={resumeText} onChange={(event) => onResumeTextChange(event.target.value)}
            aria-describedby="resume-help"
          />
          <div className="field-meta">
            <span id="resume-help">{resumeText.trim().length >= 50 ? <><Check size={13} aria-hidden="true" /> Texto pronto para análise</> : "Mínimo de 50 caracteres"}</span>
            <span className="mini-progress" aria-hidden="true">
              <span style={{ width: `${Math.min(100, (resumeText.trim().length / 50) * 100)}%` }} />
            </span>
          </div>
        </div>
      ) : (
        <div className="field-enter">
          <div
            className={`upload-box ${dragging ? "drag-over" : ""} ${file ? "has-file" : ""}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={(event) => { event.preventDefault(); setDragging(false); }}
            onDrop={(event) => { event.preventDefault(); acceptFile(event.dataTransfer.files[0] ?? null); }}
          >
            <input
              ref={inputRef} id="resume-file" type="file" accept=".pdf,.docx,.txt"
              onChange={(event) => acceptFile(event.target.files?.[0] ?? null)}
              aria-describedby="upload-help"
            />
            {file ? (
              <div className="selected-file">
                <span className="selected-file-icon"><FileText size={22} aria-hidden="true" /></span>
                <div className="selected-file-info">
                  <strong title={file.name}>{file.name}</strong>
                  <span>{(file.size / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} KB · Arquivo selecionado</span>
                </div>
                <button type="button" className="icon-button" onClick={clearFile} aria-label="Remover currículo selecionado">
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <label htmlFor="resume-file" className="upload-label">
                <span className="upload-symbol"><UploadCloud size={26} strokeWidth={1.8} aria-hidden="true" /></span>
                <strong>{dragging ? "Solte seu currículo aqui" : "Arraste ou escolha seu currículo"}</strong>
                <small id="upload-help">PDF, DOCX ou TXT · até 3 MB</small>
                <span className="upload-action">Escolher arquivo <FileUp size={14} aria-hidden="true" /></span>
              </label>
            )}
          </div>
          {fileError && <p className="inline-error" role="alert">{fileError}</p>}
        </div>
      )}
    </>
  );
}
