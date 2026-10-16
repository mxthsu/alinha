/** Local-only approved CV versions keyed to original job URLs. Does not overwrite Studio. */
import {isResumeProfile,type ResumeProfile,type ResumeTemplate} from "./career-workspace.ts";
import type {SelectedOpportunity} from './career-handoff';
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
export async function loadApprovedResume(job:SelectedOpportunity):Promise<ApprovedResumeVersion|null>{
 const database=await db();
 try {
  return await new Promise((resolve,reject)=>{
   const req=database.transaction(STORE,"readonly").objectStore(STORE).get(key(job));
   req.onsuccess=()=>resolve(isApprovedResumeVersion(req.result)?req.result:null);
   req.onerror=()=>reject(req.error||new Error("Falha ao recuperar versão."));
  });
 }finally{database.close();}
}
export async function approveResumeVersion(job:SelectedOpportunity,profile:ResumeProfile,template:ResumeTemplate):Promise<ApprovedResumeVersion>{
 const normalized=normalizeSelectedOpportunity(job);
 if(!normalized)throw new Error("Selecione uma vaga com link válido.");
 const version:ApprovedResumeVersion={version:1,job:normalized,profile,template,approvedAt:new Date().toISOString()};
 if(!isApprovedResumeVersion(version))throw new Error("Os dados da versão não são válidos.");
 const database=await db();
 try{
  await new Promise<void>((resolve,reject)=>{
   const txn=database.transaction(STORE,"readwrite");
   txn.objectStore(STORE).put(version,key(normalized));
   txn.oncomplete=()=>resolve();
   txn.onabort=()=>reject(txn.error||new Error("Falha ao salvar."));
   txn.onerror=()=>reject(txn.error||new Error("Falha ao salvar."));
  });
  return version;
 }finally{database.close();}
}
