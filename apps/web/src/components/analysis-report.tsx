"use client";

import { useState } from "react";
import {
  AlertCircle, ArrowRight, CheckCircle2, ChevronDown, CircleHelp,
  ClipboardCheck, FileSearch, RotateCcw, Sparkles, WandSparkles,
} from "lucide-react";
import { type AnalysisResult, type MatchStatus, statusLabels } from "@/lib/analysis";

const statusIcons = {
  evidenciado: CheckCircle2,
  parcial: CircleHelp,
  nao_identificado: AlertCircle,
};

type AnalysisReportProps = {
  result: AnalysisResult | null;
  loading: boolean;
  onDemo: () => void;
  onReset: () => void;
};

export function AnalysisReport({ result, loading, onDemo, onReset }: AnalysisReportProps) {
  const [expanded, setExpanded] = useState<number | null>(0);

  if (loading) {
    return (
      <div className="loading-result" role="status" aria-live="polite">
        <span className="loading-orb"><Sparkles size={26} aria-hidden="true" /></span>
        <span className="result-kicker">ANÁLISE EM ANDAMENTO</span>
        <h3>Conectando experiências e oportunidades.</h3>
        <p>Consultando a IA e verificando as evidências. Isso pode levar alguns instantes.</p>
        <div className="loading-skeleton" aria-hidden="true"><div /><div /><div /></div>
        <div className="indeterminate-progress" aria-hidden="true"><span /></div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="empty-result">
        <div className="empty-illustration" aria-hidden="true">
          <div className="empty-orbit orbit-one" />
          <div className="empty-orbit orbit-two" />
          <div className="empty-icon"><FileSearch size={29} strokeWidth={1.7} /></div>
          <span className="floating-check"><CheckCircle2 size={17} /></span>
        </div>
        <span className="result-kicker">A PRÓXIMA ETAPA COMEÇA AQUI</span>
        <h3>Conheça os pontos fortes da sua trajetória.</h3>
        <p>Preencha os campos ao lado para descobrir quais requisitos estão descritos no seu currículo e onde você pode trazer mais contexto.</p>
        <div className="empty-divider" />
        <button className="text-link" type="button" onClick={onDemo}>
          Explorar um resultado de exemplo <ArrowRight size={17} aria-hidden="true" />
        </button>
      </div>
    );
  }

  const count = (status: MatchStatus) =>
    result.requirements.filter((item) => item.status === status).length;

  return (
    <div className="report-content" key={result.analysis_mode}>
      <div className="result-header">
        <div className="report-topline">
          <span className={`result-kicker ${result.analysis_mode === "demo" ? "demo-kicker" : ""}`}>
            {result.analysis_mode === "demo"
              ? <><Sparkles size={13} aria-hidden="true" /> EXEMPLO FICTÍCIO</>
              : <><ClipboardCheck size={13} aria-hidden="true" /> ANÁLISE COM IA</>}
          </span>
          <button type="button" className="reset-button" onClick={onReset}>
            <RotateCcw size={14} aria-hidden="true" /> Nova análise
          </button>
        </div>
        <h3>{result.job_title}</h3>
        <p>{result.summary}</p>
      </div>
      <div className="result-stats" aria-label="Resumo dos requisitos">
        <div className="stat-good"><CheckCircle2 size={16} aria-hidden="true" /><strong>{count("evidenciado")}</strong><span>Com evidência</span></div>
        <div className="stat-medium"><CircleHelp size={16} aria-hidden="true" /><strong>{count("parcial")}</strong><span>Parciais</span></div>
        <div className="stat-neutral"><AlertCircle size={16} aria-hidden="true" /><strong>{count("nao_identificado")}</strong><span>Não identificados</span></div>
      </div>
      <div className="requirements-heading">
        <span>REQUISITOS ANALISADOS</span>
        <span>{result.requirements.length} {result.requirements.length === 1 ? "item" : "itens"}</span>
      </div>
      <div className="requirements">
        {result.requirements.map((item, index) => {
          const Icon = statusIcons[item.status];
          const isExpanded = expanded === index;
          const panelId = `requirement-panel-${index}`;
          return (
            <article className={`requirement ${isExpanded ? "expanded" : ""}`} key={`${item.requirement}-${index}`}>
              <button
                type="button" className="requirement-trigger"
                onClick={() => setExpanded(isExpanded ? null : index)}
                aria-expanded={isExpanded}
                aria-controls={panelId}
              >
                <span className={`requirement-status-icon status-${item.status}`}>
                  <Icon size={17} aria-hidden="true" />
                </span>
                <span className="requirement-trigger-text">
                  <strong>{item.requirement}</strong>
                  <span className={`status status-${item.status}`}>{statusLabels[item.status]}</span>
                </span>
                <ChevronDown size={17} className={`chevron ${isExpanded ? "open" : ""}`} aria-hidden="true" />
              </button>
              <div className={`requirement-body ${isExpanded ? "visible" : ""}`} id={panelId} hidden={!isExpanded}>
                <div className="evidence-row"><span className="evidence-label">NA VAGA</span><p>“{item.job_evidence}”</p></div>
                {item.resume_evidence && (
                  <div className="evidence-row"><span className="evidence-label">NO CURRÍCULO</span><p>“{item.resume_evidence}”</p></div>
                )}
                <div className="recommendation">
                  <WandSparkles size={17} aria-hidden="true" />
                  <div><strong>Sugestão para você</strong><p>{item.recommendation}</p></div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <div className="limitation">
        <div className="limitation-title"><CircleHelp size={16} aria-hidden="true" /><strong>Sobre esta análise</strong></div>
        {result.limitations.map((item, index) => <p key={index}>{item}</p>)}
      </div>
    </div>
  );
}
