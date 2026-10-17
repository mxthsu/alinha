import {readCommunityRecord,saveCommunityRecord} from "./community-data.ts";
/** Local-only approved CV versions keyed to original job URLs. Does not overwrite Studio. */
import {isResumeProfile,type ResumeProfile,type ResumeTemplate} from "./career-workspace.ts";
import type {SelectedOpportunity} from './career-handoff.ts';
import {safeJobUrl} from './opportunity-tracker.ts';

export type ApprovedResumeVersion={
 version:1;
 job:SelectedOpportunity;
 profile:ResumeProfile;
 template:ResumeTemplate;
 approvedAt:string;
};
const DB="alinha-community", STORE="drafts",PREFIX="approved-job:";
function normalizeSelectedOpportunity(job:unknown):SelectedOpportunity|null {
 if(!job||typeof job!=="object"||Array.isArray(job))return null;
 const data=job as Record<string,unknown>;
 if(typeof data.title!=="string"||data.title.length<2||data.title.length>180||
    typeof data.company!=="string"||data.company.length<2||data.company.length>180||
    typeof data.source!=="string"||data.source.length>100||
    typeof data.excerpt!=="string"||data.excerpt.length>350||
    typeof data.url!=="string")return null;
 const url=safeJobUrl(data.url);
 return url?{title:data.title,company:data.company,source:data.source,excerpt:data.excerpt,url}:null;
}
function record(value:unknown):value is Record<string,unknown>{
 return !!value&&typeof value==="object"&&!Array.isArray(value);
}
export function isApprovedResumeVersion(value:unknown):value is ApprovedResumeVersion{
 if(!record(value)||value.version!==1||!isResumeProfile(value.profile)||
    (value.template!=="classico"&&value.template!=="compacto")||
    !record(value.job)||!normalizeSelectedOpportunity(value.job)||
    typeof value.approvedAt!=="string"||!Number.isFinite(Date.parse(value.approvedAt)))return false;
 return JSON.stringify(value).length<=300_000;
}
function key(job:SelectedOpportunity):string{
 const normalized=normalizeSelectedOpportunity(job);
 if(!normalized)throw new Error("Vaga sem link válido.");
 return PREFIX+normalized.url;
}
async function db():Promise<IDBDatabase>{
 if(typeof indexedDB==="undefined")throw new Error("Armazenamento local indisponível.");
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))
   req.result.createObjectStore(STORE);};
  req.onerror=()=>reject(req.error||new Error("Falha ao abrir dados."));
  req.onblocked=()=>reject(new Error("Feche outras abas do Alinha."));
  req.onsuccess=()=>resolve(req.result);
 });
}
async function loadLegacyApprovedResume(job:SelectedOpportunity):Promise<ApprovedResumeVersion|null>{
 const database=await db();
 try {
  return await new Promise((resolve,reject)=>{
   const req=database.transaction(STORE,"readonly").objectStore(STORE).get(key(job));
   req.onsuccess=()=>resolve(isApprovedResumeVersion(req.result)?req.result:null);
   req.onerror=()=>reject(req.error||new Error("Falha ao recuperar versão."));
  });
 }finally{database.close();}
}


/** Reads only versioned, previously approved legacy objects; never deletes the originals. */
export async function loadLegacyApprovedResumes():Promise<ApprovedResumeVersion[]>{
 const database=await db();
 try{
  return await new Promise((resolve,reject)=>{
   const req=database.transaction(STORE,"readonly").objectStore(STORE).getAll();
   req.onsuccess=()=>{
    const values=(req.result as unknown[]).filter(
     candidate=>isApprovedResumeVersion(candidate)
    ) as ApprovedResumeVersion[];
    const unique=new Map<string,ApprovedResumeVersion>();
    for(const value of values){
     const url=value.job.url.toLowerCase().replace(/\/$/,"");
     unique.set(url,value);
    }
    resolve([...unique.values()]);
   };
   req.onerror=()=>reject(req.error||new Error("Falha ao recuperar versões antigas."));
  });
 }finally{database.close();}
}

export async function loadApprovedResume(job:SelectedOpportunity):Promise<ApprovedResumeVersion|null>{
 const normalized=normalizeSelectedOpportunity(job);
 if(!normalized)throw new Error("Vaga inválida.");
 const stored=await readCommunityRecord("resume_versions");
 if(stored.revision>0&&stored.value!==null){
  if(!Array.isArray(stored.value)||!stored.value.every(isApprovedResumeVersion))
   throw new Error("As versões do SQLite estão inconsistentes. Restaure um backup.");
  const found=(stored.value as ApprovedResumeVersion[]).find(
   item=>item.job.url.replace(/\/$/,"").toLowerCase()===normalized.url.replace(/\/$/,"").toLowerCase()
  );
  if(found)return found;
 }
 // Legacy versions remain available until explicit import, never silently erased.
 return loadLegacyApprovedResume(normalized);
}

export async function approveResumeVersion(
 job:SelectedOpportunity,profile:ResumeProfile,template:ResumeTemplate
):Promise<ApprovedResumeVersion>{
 const normalized=normalizeSelectedOpportunity(job);
 if(!normalized)throw new Error("Selecione uma vaga com link válido.");
 const version:ApprovedResumeVersion={
  version:1,job:normalized,profile,template,approvedAt:new Date().toISOString(),
 };
 if(!isApprovedResumeVersion(version))throw new Error("Os dados da versão não são válidos.");
 const saved=await readCommunityRecord("resume_versions");
 if(saved.value!==null&&!Array.isArray(saved.value))
  throw new Error("O histórico SQLite de versões está inválido.");
 const existing=saved.value===null?[]:saved.value;
 if(!existing.every(isApprovedResumeVersion))
  throw new Error("Não é possível atualizar versões locais inconsistentes.");
 const records=existing as ApprovedResumeVersion[];
 const unique=records.filter(
  item=>item.job.url.replace(/\/$/,"").toLowerCase()!==normalized.url.replace(/\/$/,"").toLowerCase()
 );
 unique.push(version);
 if(unique.length>16)throw new Error("Limite de 16 versões salvas. Exporte um backup antes de reorganizá-las.");
 const revision=await saveCommunityRecord("resume_versions",unique,saved.revision);
 const verified=await readCommunityRecord("resume_versions");
 if(verified.revision!==revision||!Array.isArray(verified.value)||
   !(verified.value as unknown[]).some(item=>isApprovedResumeVersion(item)&&
     item.job.url===normalized.url&&item.approvedAt===version.approvedAt)){
  throw new Error("Não foi possível confirmar a versão aprovada no SQLite.");
 }
 return version;
}
