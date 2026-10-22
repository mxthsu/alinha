import { safeJobUrl } from "./opportunity-tracker.ts";

const KEY="alinha:selected-opportunity:v2";
const LEGACY_KEY="alinha:selected-opportunity:v1";
export type SelectedOpportunity={
  title:string;company:string;url:string;source:string;excerpt:string;description?:string;
};

export function normalizeSelectedOpportunity(input:unknown):SelectedOpportunity|null{
  if(!input||typeof input!=="object"||Array.isArray(input))return null;
  const obj=input as Record<string,unknown>;
  if(typeof obj.title!=="string"||obj.title.trim().length<2||obj.title.length>180||
     typeof obj.company!=="string"||obj.company.trim().length<2||obj.company.length>180||
     typeof obj.source!=="string"||obj.source.length>100||
     typeof obj.excerpt!=="string"||obj.excerpt.length>350||
     typeof obj.url!=="string"||
     (obj.description!==undefined&&(typeof obj.description!=="string"||obj.description.length>14000)))return null;
  const url=safeJobUrl(obj.url);
  if(!url)return null;
  return {
    title:obj.title.trim(),company:obj.company.trim(),source:obj.source.trim(),
    url,excerpt:obj.excerpt.trim(),description:typeof obj.description==="string"?obj.description:undefined,
  };
}
export function selectOpportunity(input:SelectedOpportunity):boolean{
  const value=normalizeSelectedOpportunity(input);
  if(!value||typeof window==="undefined")return false;
  try{
    window.localStorage.setItem(KEY,JSON.stringify(value));
    try{window.sessionStorage.removeItem(LEGACY_KEY);}catch{}
    return true;
  }catch{return false;}
}
export function selectedOpportunity():SelectedOpportunity|null{
  if(typeof window==="undefined")return null;
  try{
    const raw=window.localStorage.getItem(KEY);
    if(raw)return raw.length<18000?normalizeSelectedOpportunity(JSON.parse(raw)):null;
    // Older selections remain available for their original tab session.
    const legacy=window.sessionStorage.getItem(LEGACY_KEY);
    return legacy&&legacy.length<18000?normalizeSelectedOpportunity(JSON.parse(legacy)):null;
  }catch{return null;}
}
export function updateSelectedOpportunityDescription(url:string,description:string):boolean{
  if(description.length>14000)return false;
  const current=selectedOpportunity();
  if(!current||current.url!==safeJobUrl(url))return false;
  return selectOpportunity({...current,description});
}
export function clearSelectedOpportunity():void{
  if(typeof window!=="undefined"){
    try{window.localStorage.removeItem(KEY);}catch{}
    try{window.sessionStorage.removeItem(LEGACY_KEY);}catch{}
  }
}
