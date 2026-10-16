"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {addOpportunity,changeStatus,exportTracker,importTracker,parseTracker,TRACKER_KEY,
  type NewOpportunity,type TrackedOpportunity,type TrackerStatus} from "@/lib/opportunity-tracker";

function readSaved():TrackedOpportunity[]{
  try{
    const raw=window.localStorage.getItem(TRACKER_KEY);
    if(!raw||raw.length>320_000)return [];
    return parseTracker(JSON.parse(raw));
  }catch{return [];}
}

export function useOpportunityTracker(){
  const [items,setItems]=useState<TrackedOpportunity[]>([]);
  const [loaded,setLoaded]=useState(false);
  const [storageError,setStorageError]=useState("");
  const latest=useRef<TrackedOpportunity[]>([]);

  useEffect(()=>{
    function sync(){const next=readSaved();latest.current=next;setItems(next);}
    const frame=window.requestAnimationFrame(()=>{sync();setLoaded(true);});
    window.addEventListener("storage",sync);
    window.addEventListener("alinha-opportunities-changed",sync);
    return ()=>{window.cancelAnimationFrame(frame);window.removeEventListener("storage",sync);window.removeEventListener("alinha-opportunities-changed",sync);};
  },[]);

  const commit=useCallback((next:TrackedOpportunity[]):boolean=>{
    try{
      window.localStorage.setItem(TRACKER_KEY,JSON.stringify(next));
      latest.current=next;setItems(next);setStorageError("");
      window.dispatchEvent(new Event("alinha-opportunities-changed"));
      return true;
    }catch{
      setStorageError("O navegador não permitiu salvar. Exporte seus dados ou libere armazenamento local.");
      return false;
    }
  },[]);

  const save=useCallback((job:NewOpportunity):{ok:boolean;message:string}=>{
    const next=addOpportunity(latest.current,job,crypto.randomUUID(),new Date().toISOString());
    if(!next.added)return {ok:false,message:next.reason||"A vaga não pôde ser salva."};
    if(!commit(next.items))return {ok:false,message:"Não foi possível gravar no navegador."};
    return {ok:true,message:"Vaga salva em Acompanhar candidaturas."};
  },[commit]);

  const setStatus=useCallback((id:string,status:TrackerStatus)=>
    commit(changeStatus(latest.current,id,status,new Date().toISOString())),[commit]);
  const remove=useCallback((id:string)=>commit(latest.current.filter(job=>job.id!==id)),[commit]);
  const clear=useCallback(()=>commit([]),[commit]);

  const restore=useCallback((text:string):{ok:boolean;message:string}=>{
    try{
      const imported=importTracker(text);
      if(!commit(imported))return {ok:false,message:"Não foi possível gravar no navegador."};
      return {ok:true,message:imported.length+" vagas importadas. A lista anterior foi substituída."};
    }catch(e){return {ok:false,message:e instanceof Error?e.message:"Falha ao importar."};}
  },[commit]);

  return {items,loaded,storageError,save,setStatus,remove,clear,restore,
    backup:()=>exportTracker(latest.current)};
}
