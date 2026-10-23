import test from "node:test";
import assert from "node:assert/strict";
import {clearSelectedOpportunity,normalizeSelectedOpportunity,selectOpportunity,
 selectedOpportunity,updateSelectedOpportunityDescription} from "../src/lib/career-handoff.ts";

function storage(initial=[]){
 const values=new Map(initial);
 return {
  getItem:key=>values.get(key)??null,
  setItem:(key,value)=>{values.set(key,String(value));},
  removeItem:key=>{values.delete(key);},
 };
}

function selected(){
 return {
  title:"Engenheira de IA",company:"Empresa de Teste",
  source:"lever",url:"https://jobs.lever.co/Flex/example",
  excerpt:"Python",description:"Descrição integral da vaga com requisitos detalhados. ".repeat(50),
 };
}
test("passes original full job description without modifications",()=>{
 const value=normalizeSelectedOpportunity(selected());
 assert.equal(value?.description,selected().description);
 assert.equal(value?.source,"lever");
});
test("rejects overly large or invalid description payload",()=>{
 assert.equal(normalizeSelectedOpportunity({...selected(),description:"x".repeat(14001)}),null);
 assert.equal(normalizeSelectedOpportunity({...selected(),description:{malicious:true}}),null);
});

test("retains a revised vacancy after the tab closes and forgets it only on explicit finish",()=>{
 const previous=globalThis.window;
 const localStorage=storage();
 try{
  globalThis.window={localStorage,sessionStorage:storage()};
  assert.equal(selectOpportunity(selected()),true);
  assert.equal(updateSelectedOpportunityDescription(selected().url,"Texto revisto da vaga"),true);
  globalThis.window={localStorage,sessionStorage:storage()};
  assert.equal(selectedOpportunity()?.description,"Texto revisto da vaga");
  assert.equal(updateSelectedOpportunityDescription("https://jobs.lever.co/Flex/outra","Outro texto"),false);
  assert.equal(selectedOpportunity()?.description,"Texto revisto da vaga");
  clearSelectedOpportunity();
  assert.equal(selectedOpportunity(),null);
 }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});

test("a new selection replaces the prior vacancy and does not revive stale session data",()=>{
 const previous=globalThis.window;
 try{
  const old=selected();
  globalThis.window={localStorage:storage(),sessionStorage:storage([
   ["alinha:selected-opportunity:v1",JSON.stringify(old)],
  ])};
  assert.equal(selectedOpportunity()?.url,old.url);
  const next={...old,title:"Outra vaga",url:"https://jobs.lever.co/Flex/outra",description:"Nova descrição"};
  assert.equal(selectOpportunity(next),true);
  assert.equal(selectedOpportunity()?.title,"Outra vaga");
  clearSelectedOpportunity();
  assert.equal(selectedOpportunity(),null);
 }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});

test("a blocked legacy session store does not prevent saving a new local selection",()=>{
 const previous=globalThis.window;
 try{
  globalThis.window={localStorage:storage(),sessionStorage:{
   removeItem(){throw new Error("Bloqueado");},
  }};
  assert.equal(selectOpportunity(selected()),true);
  assert.equal(selectedOpportunity()?.title,selected().title);
 }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});
