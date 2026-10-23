import test from "node:test";
import assert from "node:assert/strict";
import {prepareApplicationQueue,wantsApplicationDrafts} from "../src/lib/agent-queue.ts";
import {interpretCareerIntent,rankCareerJobs} from "../src/lib/agent-journey.ts";

const profile={schema_version:1,contact:{name:"Pessoa Simulada",headline:"Analista Python",email:"exemplo@example.test",phone:"",city:"Cidade Fictícia",links:[]},
 summary:"Profissional fictício.",experiences:[],education:[],projects:[],
 skills:["Python","SQL"],languages:[]};
function vacancy(id,url,mode="remote",description="Oportunidade para Python, SQL e Kubernetes em trabalho remoto."){
 return {opportunity:{source:"gupy",external_id:id,title:"Engenheira de IA",
  company:"Empresa Exemplo "+id,city:"Cidade Fictícia",work_mode:mode,
  contract_type:"unspecified",advertised_min_salary_brl:null,source_url:url},
  excerpt:description.slice(0,100),description,missing_information:[]};
}
const intent=interpretCareerIntent("Encontre vagas de Engenheira de IA remotas no Brasil e prepare candidaturas");
test("natural intent requests local previews without imposing AI calls",()=>{
 assert.equal(wantsApplicationDrafts(intent.role),false);
 assert.equal(wantsApplicationDrafts("Encontre vagas e prepare minhas candidaturas"),true);
 assert.equal(wantsApplicationDrafts("Somente pesquisar vagas"),false);
});
test("one run prepares up to three unique, allowed previews with unknown skills disclosed",()=>{
 const jobs=[
  vacancy("1","https://jobs.example.com/1"),
  vacancy("2","https://jobs.example.com/2"),
  vacancy("3","https://jobs.example.com/3"),
  vacancy("4","https://jobs.example.com/4"),
  vacancy("duplicate","https://jobs.example.com/1"),
  vacancy("unsafe","javascript:alert(1)"),
  vacancy("onsite","https://jobs.example.com/onsite","onsite"),
 ];
 const ranked=rankCareerJobs(jobs,profile,intent);
 const prepared=prepareApplicationQueue(ranked,profile,3);
 assert.equal(prepared.length,3);
 assert.deepEqual(new Set(prepared.map(p=>p.url)).size,3);
 assert.ok(prepared.every(p=>p.preview.externalSubmission===false&&p.preview.status==="rascunho"));
 assert.ok(prepared.every(p=>p.preview.verifiedSkills.includes("Python")));
 assert.ok(prepared.every(p=>p.preview.unknownQuestions.some(q=>q.includes("Kubernetes"))));
 assert.ok(prepared.every(p=>!p.preview.draft.includes("Kubernetes")));
 assert.ok(prepared.every(p=>!p.url.startsWith("javascript:")));
});
test("empty or excluded results do not announce prepared applications",()=>{
 assert.deepEqual(prepareApplicationQueue([],profile),[]);
 const ranked=rankCareerJobs([vacancy("onsite","https://jobs.example.com/onsite","onsite")],profile,intent);
 assert.equal(prepareApplicationQueue(ranked,profile).length,0);
});
test("CLT/PJ is enforced only when explicitly requested; unreported is review",()=>{
 const req=interpretCareerIntent("Quero trabalhar como Engenheira de IA remoto CLT");
 assert.equal(req.role,"Engenheira de IA");
 assert.equal(req.contract,"clt");
 const cases=rankCareerJobs([
  {...vacancy("pj","https://jobs.example.com/pj"),opportunity:{
   ...vacancy("pj","https://jobs.example.com/pj").opportunity,contract_type:"pj"}},
  vacancy("unknown","https://jobs.example.com/unknown"),
 ],profile,req);
 assert.equal(cases.find(c=>c.job.opportunity.external_id==="pj").status,"excluded");
 assert.ok(cases.find(c=>c.job.opportunity.external_id==="unknown").unknown.some(q=>q.includes("CLT/PJ")));
});
test("salary annual or ambiguous CLT/PJ is not falsely interpreted as confirmed monthly",()=>{
 const annual=interpretCareerIntent("Encontre vagas de IA com salário anual de R$ 120.000");
 assert.equal(annual.minSalaryBrl,null);
 assert.ok(annual.needsConfirmation.length>0);
 const ambiguous=interpretCareerIntent("Vagas de IA CLT ou PJ");
 assert.equal(ambiguous.contract,null);
 assert.ok(ambiguous.needsConfirmation.length>0);
});
