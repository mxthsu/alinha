"use client";
import {resolveApiOrigin} from "@/lib/api-origin";
import {useRef,useState,type ChangeEvent} from "react";
import {loadLegacyResumeDraft,hasResumeContent,type ResumeProfile,type ResumeTemplate} from "@/lib/career-workspace";
import {parseTracker,TRACKER_KEY,type TrackedOpportunity} from "@/lib/opportunity-tracker";
import {loadLegacyApprovedResumes,type ApprovedResumeVersion} from "@/lib/approved-resume";

type Resume={profile:ResumeProfile;template:ResumeTemplate};
type Snapshot={value:unknown;revision:number};
type Preview={
 resume:Resume|null;opportunities:TrackedOpportunity[]|null;
 resume_versions:ApprovedResumeVersion[]|null;
 expected_revisions:Record<string,number>;
};
const API=resolveApiOrigin();

async function localRecord(kind:"resume"|"opportunities"|"resume_versions"):Promise<Snapshot>{
 const response=await fetch(API+"/api/v1/community/data/"+kind,{cache:"no-store"});
 if(!response.ok)throw new Error("Não foi possível consultar os dados locais no SQLite.");
 return await response.json() as Snapshot;
}
async function send<T>(route:string,payload:unknown):Promise<T>{
 const response=await fetch(API+route,{
  method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),
 });
 const data=await response.json();
 if(!response.ok)throw new Error(typeof data.detail==="string"?data.detail:"A operação não pôde ser concluída.");
 return data as T;
}
function currentBrowserOpportunities():TrackedOpportunity[]|null{
 const raw=window.localStorage.getItem(TRACKER_KEY);
 if(!raw)return null;
 if(raw.length>320_000)throw new Error("Os dados antigos de oportunidades excedem o limite. Exporte-os antes de continuar.");
 let data:unknown;
 try{data=JSON.parse(raw);}catch{throw new Error("O histórico do navegador não contém JSON válido.");}
 if(!Array.isArray(data))throw new Error("O histórico antigo tem formato inesperado.");
 const parsed=parseTracker(data);
 if(parsed.length!==data.length)throw new Error("Há vagas antigas inválidas. Corrija ou exporte o histórico antes de migrar.");
 return parsed;
}
export function CommunityDataActions(){
 const [busy,setBusy]=useState(false);
 const [preview,setPreview]=useState<Preview|null>(null);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const restoreFile=useRef<HTMLInputElement|null>(null);

 async function inspect(){
  setBusy(true);setError("");setMessage("");setPreview(null);
  try{
   const draft=await loadLegacyResumeDraft();
   const resume=draft&&hasResumeContent(draft.profile)?
    {profile:draft.profile,template:draft.template}:null;
   const opportunities=currentBrowserOpportunities();
   const resume_versions=await loadLegacyApprovedResumes();
   if(!resume && (!opportunities||opportunities.length===0)&&resume_versions.length===0){
    throw new Error("Não existem currículos ou oportunidades antigos para migrar neste navegador.");
   }
   const [savedResume,savedJobs,savedVersions]=await Promise.all([
    localRecord("resume"),localRecord("opportunities"),localRecord("resume_versions"),
   ]);
   if((resume&&savedResume.value!==null)||(opportunities&&savedJobs.value!==null)||
      (resume_versions.length>0&&savedVersions.value!==null)){
    throw new Error("Já existem registros no SQLite. Faça um backup antes de resolver o conflito; nada foi substituído.");
   }
   setPreview({resume,opportunities,resume_versions:resume_versions.length?resume_versions:null,
    expected_revisions:{
     resume:savedResume.revision,opportunities:savedJobs.revision,
     resume_versions:savedVersions.revision,
    }});
  }catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível preparar a migração.");}
  finally{setBusy(false);}
 }
 async function migrate(){
  if(!preview||busy)return;
  setBusy(true);setError("");setMessage("");
  try{
   const result=await send<{revisions:Record<string,number>;backup_file:string}>(
    "/api/v1/community/migration",preview);
   const [resume,jobs,versions]=await Promise.all([
    localRecord("resume"),localRecord("opportunities"),localRecord("resume_versions"),
   ]);
   if(preview.resume&&(!resume.value||resume.revision!==result.revisions.resume)){
    throw new Error("A verificação do currículo no banco falhou. Os dados antigos permanecem preservados.");
   }
   if(preview.opportunities&&(jobs.revision!==result.revisions.opportunities||
      !Array.isArray(jobs.value)||jobs.value.length!==preview.opportunities.length)){
    throw new Error("A verificação das vagas falhou. Os dados antigos permanecem preservados.");
   }
   if(preview.resume_versions&&(versions.revision!==result.revisions.resume_versions||
       !Array.isArray(versions.value)||versions.value.length!==preview.resume_versions.length)){
    throw new Error("A verificação das versões aprovadas falhou; os originais permanecem no navegador.");
   }
   setPreview(null);
   setMessage("Migração conferida no SQLite. Os dados originais do navegador foram preservados como recuperação.");
  }catch(cause){setError(cause instanceof Error?cause.message:"Falha na migração.");}
  finally{setBusy(false);}
 }
 async function exportBackup(){
  setBusy(true);setError("");setMessage("");
  try{
   const response=await fetch(API+"/api/v1/community/backup",{cache:"no-store"});
   if(!response.ok)throw new Error("Não foi possível exportar o backup do SQLite.");
   const backup=await response.json();
   const blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json"});
   const url=URL.createObjectURL(blob);
   const anchor=document.createElement("a");
   anchor.href=url;anchor.download="alinha-community-backup.json";anchor.click();
   URL.revokeObjectURL(url);
   setMessage("Backup exportado. Guarde o arquivo em local seguro.");
  }catch(cause){setError(cause instanceof Error?cause.message:"Falha ao gerar backup.");}
  finally{setBusy(false);}
 }
 async function restore(event:ChangeEvent<HTMLInputElement>){
  const file=event.target.files?.[0];event.target.value="";
  if(!file||busy)return;
  setBusy(true);setError("");setMessage("");setPreview(null);
  try{
   if(file.size>900_000)throw new Error("O backup supera 900 KB.");
   const raw:unknown=JSON.parse(await file.text());
   if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("Arquivo de backup inválido.");
   const backup=raw as Record<string,unknown>;
   if(backup.format!=="alinha-community-backup"||backup.version!==1)
    throw new Error("Formato ou versão de backup incompatível.");
   const [r,j,v]=await Promise.all([
    localRecord("resume"),localRecord("opportunities"),localRecord("resume_versions"),
   ]);
   if(!window.confirm("Restaurar os dados deste arquivo no SQLite? Uma cópia do banco atual será criada antes."))
    return;
   await send("/api/v1/community/restore",{
    backup,expected_revisions:{resume:r.revision,opportunities:j.revision,resume_versions:v.revision},
   });
   setMessage("Backup restaurado no SQLite. Os dados anteriores foram preservados em cópia de recuperação.");
  }catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível restaurar o backup.");}
  finally{setBusy(false);}
 }
 return <div className="personal-storage-actions">
   <p className="personal-footnote">O banco local já está disponível. Após confirmar a migração, Studio, agente e candidaturas usam SQLite.
    Os registros antigos do navegador permanecem intactos.</p>
   <div className="personal-storage-buttons">
    <button type="button" onClick={()=>void inspect()} disabled={busy}>Ver dados antigos</button>
    <button type="button" onClick={()=>void exportBackup()} disabled={busy}>Exportar backup SQLite</button>
    <button type="button" onClick={()=>restoreFile.current?.click()} disabled={busy}>Restaurar backup</button>
   </div>
   <input hidden ref={restoreFile} type="file" accept=".json,application/json"
    aria-label="Selecionar backup JSON do Alinha" onChange={event=>void restore(event)}/>
   {preview&&<div className="personal-migration-preview">
    <strong>Prévia da migração</strong>
    <p>Currículo: {preview.resume?"1 perfil estruturado":"nenhum"}. Oportunidades: {preview.opportunities?.length??0}. Versões de currículo aprovadas: {preview.resume_versions?.length??0}.</p>
    <p>Nada será apagado do navegador. O Alinha salvará uma cópia do SQLite antes da importação.</p>
    <button type="button" disabled={busy} onClick={()=>void migrate()}>Confirmar migração segura</button>
   </div>}
   {busy&&<p role="status">Executando operação local…</p>}
   {error&&<p className="personal-storage-error" role="alert">{error}</p>}
   {message&&<p className="personal-storage-ok" role="status">{message}</p>}
  </div>;
}
