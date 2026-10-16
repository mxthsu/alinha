/* Client-only Community resume draft. Never store provider credentials or PDFs here. */
export type ResumeProfile = {
  schema_version: 1;
  contact: {name:string;headline:string;email:string;phone:string;city:string;links:string[]};
  summary:string;
  experiences:{role:string;organization:string;period:string;highlights:string[]}[];
  education:{course:string;institution:string;period:string}[];
  projects:{title:string;description:string;link:string}[];
  skills:string[];
  languages:string[];
};
export type ResumeTemplate = "classico"|"compacto";
export type ResumeDraft = {version:1;profile:ResumeProfile;template:ResumeTemplate;updatedAt:string};
const DB_NAME="alinha-community";
const STORE_NAME="drafts";
const KEY="active-resume";
const MAX_BYTES=300_000;

function isText(value:unknown, max:number):value is string {
  return typeof value==="string"&&value.length<=max;
}
function isStrings(value:unknown,maxItems:number,maxLength:number):value is string[]{
  return Array.isArray(value)&&value.length<=maxItems&&value.every(item=>isText(item,maxLength));
}
function isRecord(value:unknown):value is Record<string,unknown>{
  return !!value&&typeof value==="object"&&!Array.isArray(value);
}
export function isResumeProfile(value:unknown):value is ResumeProfile {
  if (!isRecord(value)||value.schema_version!==1||!isRecord(value.contact))return false;
  const c=value.contact;
  if (!isText(c.name,600)||!isText(c.headline,600)||!isText(c.email,600)||
      !isText(c.phone,600)||!isText(c.city,600)||!isStrings(c.links,20,600)||
      !isText(value.summary,22_000)||!isStrings(value.skills,150,600)||
      !isStrings(value.languages,50,600))return false;
  if (!Array.isArray(value.experiences)||value.experiences.length>12||
      !value.experiences.every(e=>isRecord(e)&&isText(e.role,600)&&isText(e.organization,600)&&
        isText(e.period,600)&&isStrings(e.highlights,60,22_000)))return false;
  if (!Array.isArray(value.education)||value.education.length>10||
      !value.education.every(e=>isRecord(e)&&isText(e.course,600)&&isText(e.institution,600)&&isText(e.period,600)))return false;
  if (!Array.isArray(value.projects)||value.projects.length>12||
      !value.projects.every(e=>isRecord(e)&&isText(e.title,600)&&isText(e.description,22_000)&&isText(e.link,600)))return false;
  return true;
}
export function isResumeDraft(value:unknown):value is ResumeDraft{
  if(!isRecord(value)||value.version!==1||!isResumeProfile(value.profile)||
    (value.template!=="classico"&&value.template!=="compacto")||
    !isText(value.updatedAt,40)||!Number.isFinite(Date.parse(value.updatedAt)))return false;
  return JSON.stringify(value).length<=MAX_BYTES;
}
export function hasResumeContent(p:ResumeProfile):boolean{
  return Boolean(Object.values(p.contact).some(value=>Array.isArray(value)?value.some(item=>item.trim()):value.trim())||p.summary.trim()||p.experiences.length||
    p.education.length||p.projects.length||p.skills.some(Boolean)||p.languages.some(Boolean));
}
function requestResult<T>(request:IDBRequest<T>):Promise<T>{
  return new Promise((resolve,reject)=>{
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error("Falha ao acessar armazenamento."));
  });
}
async function db():Promise<IDBDatabase>{
  if(typeof indexedDB==="undefined")throw new Error("O navegador não disponibilizou armazenamento local.");
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>{
      const database=request.result;
      if(!database.objectStoreNames.contains(STORE_NAME))database.createObjectStore(STORE_NAME);
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error("Não foi possível abrir os rascunhos."));
    request.onblocked=()=>reject(new Error("Feche outras abas do Alinha e tente novamente."));
  });
}
export async function loadResumeDraft():Promise<ResumeDraft|null>{
  const database=await db();
  try {
    const value=await requestResult(database.transaction(STORE_NAME,"readonly").objectStore(STORE_NAME).get(KEY));
    return isResumeDraft(value)?value:null;
  }finally{database.close();}
}
export async function saveResumeDraft(profile:ResumeProfile,template:ResumeTemplate):Promise<string>{
  const draft:ResumeDraft={version:1,profile,template,updatedAt:new Date().toISOString()};
  if(!isResumeDraft(draft))throw new Error("O rascunho excede os limites de armazenamento seguro.");
  const database=await db();
  try{
    const transaction=database.transaction(STORE_NAME,"readwrite");
    const saved=new Promise<void>((resolve,reject)=>{
      transaction.oncomplete=()=>resolve();
      transaction.onerror=()=>reject(transaction.error||new Error("Falha ao salvar o rascunho."));
      transaction.onabort=()=>reject(transaction.error||new Error("Falha ao salvar o rascunho."));
    });
    transaction.objectStore(STORE_NAME).put(draft,KEY);
    await saved;
    return draft.updatedAt;
  }finally{database.close();}
}
export async function clearResumeDraft():Promise<void>{
  const database=await db();
  try{
    const transaction=database.transaction(STORE_NAME,"readwrite");
    const cleared=new Promise<void>((resolve,reject)=>{
      transaction.oncomplete=()=>resolve();
      transaction.onerror=()=>reject(transaction.error||new Error("Falha ao apagar o rascunho."));
      transaction.onabort=()=>reject(transaction.error||new Error("Falha ao apagar o rascunho."));
    });
    transaction.objectStore(STORE_NAME).delete(KEY);
    await cleared;
  }finally{database.close();}
}
