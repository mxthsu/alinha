import test from "node:test";
import assert from "node:assert/strict";
import {approveResumeVersion,loadApprovedResume} from "../src/lib/approved-resume.ts";

function profile(){
 return {schema_version:1,
  contact:{name:"Pessoa Fictícia",headline:"Engenharia de IA",email:"",phone:"",city:"",links:[]},
  summary:"Perfil de teste",experiences:[],education:[],projects:[],skills:["Python"],languages:[]};
}
function job(){
 return {title:"Engenharia de IA",company:"Empresa Fictícia",source:"lever",
  url:"https://jobs.lever.co/Flex/record-test",excerpt:"Python"};
}
test("an approved version persists in local SQLite without changing the original profile",async()=>{
 const before=globalThis.fetch;
 let stored={value:null,revision:0};
 globalThis.fetch=async(url,opts={})=>{
  if(String(url).endsWith("/resume_versions")&&(!opts.method||opts.method==="GET"))
   return new Response(JSON.stringify(stored),{status:200});
  if(opts.method==="PUT"){
   const request=JSON.parse(opts.body);
   assert.equal(request.expected_revision,stored.revision);
   stored={value:request.value,revision:stored.revision+1};
   return new Response(JSON.stringify({revision:stored.revision}),{status:200});
  }
  throw new Error("Unexpected request");
 };
 try{
  const original=profile();
  const approved=await approveResumeVersion(job(),original,"classico");
  assert.equal(approved.job.url,job().url);
  const saved=await loadApprovedResume(job());
  assert.equal(saved?.profile.contact.name,"Pessoa Fictícia");
  assert.deepEqual(original.skills,["Python"]);
  assert.equal(stored.revision,1);
  const again=await approveResumeVersion(job(),original,"compacto");
  assert.equal(again.template,"compacto");
  assert.equal(stored.value.length,1);
  assert.equal(stored.revision,2);
 }finally{globalThis.fetch=before;}
});
