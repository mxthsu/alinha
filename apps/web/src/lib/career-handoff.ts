import { safeJobUrl } from "@/lib/opportunity-tracker";

const KEY="alinha:selected-opportunity:v1";
export type SelectedOpportunity={
  title:string;company:string;url:string;source:string;excerpt:string;
};

export function normalizeSelectedOpportunity(input:unknown):SelectedOpportunity|null{
  if(!input||typeof input!=="object"||Array.isArray(input))return null;
  const obj=input as Record<string,unknown>;
  if(typeof obj.title!=="string"||obj.title.trim().length<2||obj.title.length>180||
     typeof obj.company!=="string"||obj.company.trim().length<2||obj.company.length>180||
     typeof obj.source!=="string"||obj.source.length>100||
     typeof obj.excerpt!=="string"||obj.excerpt.length>350||
     typeof obj.url!=="string")return null;
  const url=safeJobUrl(obj.url);
  if(!url)return null;
  return {
    title:obj.title.trim(),company:obj.company.trim(),source:obj.source.trim(),
    url,excerpt:obj.excerpt.trim(),
  };
}
export function selectOpportunity(input:SelectedOpportunity):boolean{
  const value=normalizeSelectedOpportunity(input);
  if(!value||typeof window==="undefined")return false;
  try{window.sessionStorage.setItem(KEY,JSON.stringify(value));return true;}catch{return false;}
}
export function selectedOpportunity():SelectedOpportunity|null{
  if(typeof window==="undefined")return null;
  try{
    const raw=window.sessionStorage.getItem(KEY);
    return raw&&raw.length<2500?normalizeSelectedOpportunity(JSON.parse(raw)):null;
  }catch{return null;}
}
export function clearSelectedOpportunity():void{
  if(typeof window!=="undefined")try{window.sessionStorage.removeItem(KEY);}catch{}
}
