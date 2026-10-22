"use client";

import {CheckCircle2, CircleAlert, LockKeyhole, X} from "lucide-react";
import {useMemo} from "react";
import type {ResumeProfile} from "@/lib/career-workspace";
import {PREVIEW_ONLY_FIELDS,prepareApplicationDraft} from "@/lib/application-draft";

type Props={
  profile:ResumeProfile;
  title:string;
  company:string;
  onClose:()=>void;
};

/** A local readiness preview, not a remote ATS capture or submitted application. */
export function ApplicationPreview({profile,title,company,onClose}:Props){
  const draft=useMemo(()=>prepareApplicationDraft(profile,PREVIEW_ONLY_FIELDS),[profile]);
  return <section className="agent-application-preview" id="agent-application-preview"
    aria-labelledby="agent-preview-title">
    <div className="agent-preview-heading">
      <div>
        <span className="agent-section-eyebrow">PRÉVIA LOCAL DO AGENTE</span>
        <h3 id="agent-preview-title">Preparando seu perfil para {company}</h3>
        <p>{title} · Prévia de informações reaproveitáveis, sem abrir o formulário da empresa.</p>
      </div>
      <button type="button" className="agent-preview-close" onClick={onClose}
        aria-label="Fechar prévia"><X size={18}/></button>
    </div>
    <div className="agent-preview-stats">
      <span><CheckCircle2 size={16}/>{draft.readyCount} dados identificados no currículo</span>
      <span><CircleAlert size={16}/>{draft.reviewCount} exemplos a confirmar</span>
      <span><LockKeyhole size={16}/>0 chamadas de IA</span>
    </div>
    <div className="agent-preview-fields">
      {draft.fields.map(field=><div key={field.id} className="agent-preview-field">
        <div>
          <strong>{field.label}</strong>
          <small>{field.status==="ready"?"Origem: seu perfil salvo":field.reason}</small>
        </div>
        <span className={field.status==="ready"?"agent-preview-ready":"agent-preview-review"}>
          {field.status==="ready"?field.value:"A confirmar"}
        </span>
      </div>)}
    </div>
    <p className="agent-preview-limitation">
      Esta é uma prévia local com campos ilustrativos, não uma leitura do site da vaga.
      O Alinha ainda não acessou o formulário externo, não anexou documentos e não enviou candidatura.
      Quando o executor autorizado estiver conectado, as perguntas reais aparecerão aqui para revisão.
    </p>
  </section>;
}
