import test from "node:test";
import assert from "node:assert/strict";
import {
 isResumeProfile,isResumeDraft,hasResumeContent,loadResumeDraft,loadLegacyResumeDraft,
} from "../src/lib/career-workspace.ts";

function profile(){
  return {schema_version:1,contact:{name:"Pessoa Fictícia",headline:"Engenheira",email:"",
  phone:"",city:"",links:[]},summary:"",experiences:[],education:[],projects:[],skills:[],languages:[]};
}
test("validates a versioned structured profile before trusting local draft",()=>{
  const p=profile();
  assert.equal(isResumeProfile(p),true);
  assert.equal(hasResumeContent(p),true);
  assert.equal(isResumeDraft({version:1,profile:p,template:"classico",updatedAt:"2026-10-16T12:00:00Z"}),true);
});
test("an email or headline entered first is still meaningful autosave content",()=>{
  const p=profile();p.contact.name="";
  p.contact.email="pessoa@exemplo.test";
  assert.equal(hasResumeContent(p),true);
  p.contact.email="";p.contact.headline="";
  assert.equal(hasResumeContent(p),false);
});
test("refuses non-profile data, unexpected formats and oversized arrays",()=>{
  const p=profile();
  assert.equal(isResumeProfile({...p,schema_version:3}),false);
  assert.equal(isResumeProfile({...p,contact:{...p.contact,links:new Array(21).fill("test")}}),false);
  assert.equal(isResumeProfile({...p,experiences:new Array(13).fill({})}),false);
  assert.equal(isResumeProfile({...p,skills:["x".repeat(700)]}),false);
  assert.equal(isResumeDraft({version:1,profile:p,template:"unsafe",updatedAt:"2026-10-16T12:00:00Z"}),false);
  assert.equal(isResumeDraft({version:1,profile:p,template:"classico",updatedAt:"bad-date"}),false);
});
test("the local draft reader does not silently fall back to a server when IndexedDB is absent",async()=>{
  await assert.rejects(loadLegacyResumeDraft(),/navegador não disponibilizou/);
});

test("SQLite resumes take precedence after a successful migration",async()=>{
 const previous=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({
  value:{profile:profile(),template:"classico"},revision:1,
 }),{status:200,headers:{"content-type":"application/json"}});
 try{
  const draft=await loadResumeDraft();
  assert.equal(draft?.profile.contact.name,"Pessoa Fictícia");
  assert.equal(draft?.template,"classico");
 }finally{globalThis.fetch=previous;}
});
