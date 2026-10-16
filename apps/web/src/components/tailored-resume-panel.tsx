"use client";
import {CheckCircle2,Download,FileCheck2,ShieldCheck,Sparkles} from "lucide-react";
import type {TailoredProposal} from "@/lib/tailored-resume";

export function TailoredResumePanel({proposal,jobTitle,busy,approved,onApprove,onDownload}:{
 proposal:TailoredProposal;jobTitle:string;busy:boolean;approved:boolean;
 onApprove:()=>void;onDownload:()=>void;
}){
 return <section className="tailored-panel" aria-label="Versão do currículo para a vaga">
  <div className="tailored-heading">
   <div className="tailored-mark"><Sparkles size={22}/></div>
   <div><span>PRONTO PARA SUA REVISÃO</span>
    <h3>Seu currículo, preparado para esta vaga.</h3>
    <p>{jobTitle}</p></div>
  </div>
  <div className="tailored-evidence">
   <div><strong>O que foi priorizado</strong>
    <p>O Alinha reorganizou apenas informações já presentes no seu currículo original.</p></div>
   <div className="tailored-changes">
    {proposal.changes.map(change=><span key={change}><CheckCircle2 size={15}/>{change}</span>)}
   </div>
  </div>
  {proposal.promotedSkills.length>0&&<div className="tailored-highlight">
   <strong>Competências destacadas</strong>
   <div>{proposal.promotedSkills.map(skill=><span key={skill}>{skill}</span>)}</div>
  </div>}
  {proposal.promotedHighlights.length>0&&<div className="tailored-highlight">
   <strong>Atividades e realizações priorizadas</strong>
   <ul>{proposal.promotedHighlights.slice(0,3).map((line,i)=><li key={i}>{line}</li>)}</ul>
  </div>}
  <p className="tailored-guarantee"><ShieldCheck size={16}/>
   O currículo principal não será alterado. Nenhuma experiência, formação ou competência foi inventada.
  </p>
  <div className="tailored-actions">
   <button type="button" onClick={onApprove} disabled={busy} className="tailored-approve">
    <FileCheck2 size={17}/>{busy?"Preparando arquivo…":approved?"Aprovar nova versão e baixar DOCX":"Aprovar versão e baixar DOCX"}
   </button>
   {approved&&<button type="button" onClick={onDownload} disabled={busy} className="tailored-download">
    <Download size={16}/> Baixar novamente
   </button>}
  </div>
 </section>;
}
