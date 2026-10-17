"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {readCommunityRecord,saveCommunityRecord} from "@/lib/community-data";
import {addOpportunity,changeStatus,exportTracker,importTracker,parseTracker,TRACKER_KEY,
 type NewOpportunity,type TrackedOpportunity,type TrackerStatus} from "@/lib/opportunity-tracker";

type StorageMode="loading"|"sqlite"|"browser"|"unavailable";
function readBrowser():TrackedOpportunity[]{
 try{
  const raw=window.localStorage.getItem(TRACKER_KEY);
  if(!raw||raw.length>320_000)return [];
  return parseTracker(JSON.parse(raw));
 }catch{return [];}
}
function parseSQLite(value:unknown):TrackedOpportunity[]{
 if(value===null)return [];
 if(!Array.isArray(value))throw new Error("A lista SQLite está inválida.");
 const jobs=parseTracker(value);
 if(jobs.length!==value.length)throw new Error("O banco contém vagas inválidas.");
 return jobs;
}

/** One canonical store; legacy browser data is retained until explicit migration. */
export function useOpportunityTracker(){
 const [items,setItems]=useState<TrackedOpportunity[]>([]);
 const [storageBackend,setStorageBackend]=useState<StorageMode>("loading");
 const [loaded,setLoaded]=useState(false);
 const [storageError,setStorageError]=useState("");
 const latest=useRef<TrackedOpportunity[]>([]);
 const mode=useRef<StorageMode>("loading");
 const revision=useRef(0);

 const sync=useCallback(async()=>{
  try{
   const stored=await readCommunityRecord("opportunities");
   const browser=readBrowser();
   if(stored.revision>0||browser.length===0){
    latest.current=parseSQLite(stored.value);
    revision.current=stored.revision;
    mode.current="sqlite";
   }else{
    latest.current=browser;
    revision.current=stored.revision;
    mode.current="browser";
   }
   setItems(latest.current);setStorageBackend(mode.current);setStorageError("");
  }catch{
   mode.current="unavailable";setStorageBackend("unavailable");
   setStorageError("O banco local não está disponível. Os dados existentes não foram alterados.");
  }finally{setLoaded(true);}
 },[]);

 useEffect(()=>{
  let active=true;
  const frame=window.requestAnimationFrame(()=>{if(active)void sync();});
  const onStorage=()=>{if(mode.current==="browser")void sync();};
  const onFocus=()=>{void sync();};
  window.addEventListener("storage",onStorage);
  window.addEventListener("alinha-opportunities-changed",onStorage);
  window.addEventListener("focus",onFocus);
  return ()=>{active=false;window.cancelAnimationFrame(frame);
   window.removeEventListener("storage",onStorage);
   window.removeEventListener("alinha-opportunities-changed",onStorage);
   window.removeEventListener("focus",onFocus);
  };
 },[sync]);

 const commit=useCallback(async(next:TrackedOpportunity[]):Promise<boolean>=>{
  try{
   if(mode.current==="sqlite"){
    const updated=await saveCommunityRecord("opportunities",next,revision.current);
    revision.current=updated;
   }else if(mode.current==="browser"){
    window.localStorage.setItem(TRACKER_KEY,JSON.stringify(next));
   }else{
    throw new Error("Armazenamento ainda indisponível.");
   }
   latest.current=next;setItems(next);setStorageError("");
   if(mode.current==="browser")window.dispatchEvent(new Event("alinha-opportunities-changed"));
   return true;
  }catch(cause){
   setStorageError(cause instanceof Error?cause.message:"Não foi possível salvar os dados locais.");
   return false;
  }
 },[]);

 const save=useCallback(async(job:NewOpportunity):Promise<{ok:boolean;message:string}>=>{
  const next=addOpportunity(latest.current,job,crypto.randomUUID(),new Date().toISOString());
  if(!next.added)return {ok:false,message:next.reason||"A vaga não pôde ser salva."};
  if(!await commit(next.items))return {ok:false,message:"Não foi possível salvar a vaga no armazenamento local."};
  return {ok:true,message:"Vaga salva em Acompanhar candidaturas."};
 },[commit]);

 const setStatus=useCallback((id:string,status:TrackerStatus)=>
  commit(changeStatus(latest.current,id,status,new Date().toISOString())),[commit]);
 const remove=useCallback((id:string)=>commit(latest.current.filter(job=>job.id!==id)),[commit]);
 const clear=useCallback(()=>commit([]),[commit]);
 const restore=useCallback(async(text:string):Promise<{ok:boolean;message:string}>=>{
  try{
   const restored=importTracker(text);
   if(!await commit(restored))return {ok:false,message:"Não foi possível restaurar as vagas."};
   return {ok:true,message:restored.length+" vagas importadas. A lista anterior foi substituída."};
  }catch(cause){return {ok:false,message:cause instanceof Error?cause.message:"Falha ao importar."};}
 },[commit]);
 return {items,loaded,storageError,save,setStatus,remove,clear,restore,
  storageBackend,backup:()=>exportTracker(latest.current)};
}
