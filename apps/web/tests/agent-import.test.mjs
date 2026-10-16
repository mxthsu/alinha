import test from "node:test";
import assert from "node:assert/strict";
import {resumeFileProblem,parseResumeImport,RESUME_MAX_BYTES} from "../src/lib/agent-import.ts";

const profile={
  schema_version:1,
  contact:{name:"Pessoa Fictícia",headline:"Analista de Dados",email:"",phone:"",city:"",links:[]},
  summary:"",experiences:[],education:[],projects:[],skills:["SQL","Python"],languages:[],
};

test("accepts supported documents up to 3 MiB and rejects other formats",()=>{
  for(const extension of ["pdf","DOCX","txt"]){
    assert.equal(resumeFileProblem({name:"curriculo."+extension,size:1000}),null);
  }
  assert.match(resumeFileProblem({name:"curriculo.exe",size:100}),/PDF/);
  assert.match(resumeFileProblem({name:"curriculo.pdf",size:0}),/3 MB/);
  assert.match(resumeFileProblem({name:"curriculo.pdf",size:RESUME_MAX_BYTES+1}),/3 MB/);
});

test("validates imported profile and discards raw resume text and extra metadata",()=>{
  const result=parseResumeImport({
    profile,source_text:"CONFIDENTIAL DOCUMENT RAW",
    unassigned_lines:[],warnings:[],requires_confirmation:true,
  });
  assert.deepEqual(result.profile,profile);
  assert.equal("source_text" in result,false);
  assert.equal("requires_confirmation" in result,false);
});

test("fails closed if structured import does not identify meaningful profile data",()=>{
  const empty={...profile,contact:{...profile.contact,name:"",headline:""},skills:[]};
  assert.throws(()=>parseResumeImport({profile:empty,unassigned_lines:[],warnings:[]}),/dados suficientes/);
  assert.throws(()=>parseResumeImport({profile:null,unassigned_lines:[],warnings:[]}),/dados suficientes/);
  assert.throws(()=>parseResumeImport({profile,unassigned_lines:"broken",warnings:[]}),/não é válida/);
});
