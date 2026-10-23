import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {interpretCareerIntent,rankCareerJobs,prepareCareerPreview} from "../src/lib/agent-journey.ts";

const profile={
 schema_version:1,
 contact:{name:"Pessoa Fictícia",headline:"Engenheira de IA",email:"fake@example.test",
  phone:"",city:"Cidade Teste",links:[]},
 summary:"Profissional fictícia.",experiences:[],education:[],projects:[],
 skills:["Python","FastAPI","SQL"],languages:[],
};
const job=(overrides={})=>({
 opportunity:{source:"gupy",external_id:"job-1",title:"Engenheiro de IA",
  company:"Companhia Fictícia",work_mode:"remote",contract_type:"clt",
  advertised_min_salary_brl:null,city:null,source_url:"https://example.test/vaga",...overrides},
 excerpt:"Trabalho com Python, FastAPI, SQL, Kubernetes e testes.",
 description:"Vaga remota para desenvolvimento em Python, FastAPI, SQL e Kubernetes. O contrato depende da confirmação dos requisitos.",
 missing_information:[],
});
test("natural intent extracts role, remote Brazil, salary and confirmation requirement",()=>{
 const intent=interpretCareerIntent("Encontre vagas de Engenheiro de IA remoto no Brasil, compare com meu currículo e prepare candidaturas, salário de R$ 8.000");
 assert.equal(intent.role,"Engenheiro de IA");
 assert.equal(intent.remoteOnly,true);
 assert.equal(intent.workMode,"remote");
 assert.equal(intent.brazilOnly,true);
 assert.equal(intent.minSalaryBrl,8000);
 assert.ok(intent.needsConfirmation.some(item=>item.includes("Brasil")));
});
test("location, preference and salary interpretation require explicit checks",()=>{
 const intent=interpretCareerIntent("Busque vagas de Analista de Dados híbrido em Florianópolis, CLT com plano de saúde e salário de R$ 6.500");
 assert.equal(intent.role,"Analista de Dados");
 assert.equal(intent.city,"Florianópolis");
 assert.equal(intent.workMode,"hybrid");
 assert.equal(intent.minSalaryBrl,6500);
 assert.ok(intent.needsConfirmation.some(s=>s.includes("benefícios")));
});
test("explicit mismatches are excluded but unknown salary is not invented",()=>{
 const intent=interpretCareerIntent("Encontre vagas de Engenheiro de IA remoto no Brasil com salário de R$ 8.000");
 const decisions=rankCareerJobs([
  job({external_id:"wrong-mode",work_mode:"onsite"}),
  job({external_id:"unknown-salary"}),
 ],profile,intent);
 assert.equal(decisions[0].job.opportunity.external_id,"unknown-salary");
 assert.equal(decisions[0].status,"verify");
 assert.ok(decisions[0].unknown.some(s=>s.includes("Salário")));
 assert.equal(decisions[1].status,"excluded");
});
test("realistic stored profile is used only as evidence, never claim unknown skill",()=>{
 const intent=interpretCareerIntent("Vagas de Engenheiro de IA remoto");
 const decision=rankCareerJobs([job()],profile,intent)[0];
 const preview=prepareCareerPreview(decision,profile);
 assert.deepEqual(preview.verifiedSkills,["Python","FastAPI","SQL"]);
 assert.ok(preview.unknownQuestions.some(item=>item.includes("Kubernetes")));
 assert.doesNotMatch(preview.draft,/Kubernetes/);
 assert.ok(preview.draft.includes(profile.contact.name));
 assert.equal(preview.status,"rascunho");
 assert.equal(preview.externalSubmission,false);
});
test("missing role needs explicit confirmation",()=>{
 const intent=interpretCareerIntent("Encontre vagas remotas");
 assert.equal(intent.role,"");
 assert.ok(intent.needsConfirmation.some(item=>item.includes("cargo")));
});
test("no accidental overwrite or application submission in the integrated page",()=>{
 const component=readFileSync(new URL("../src/app/agente/page.tsx",import.meta.url),"utf8");
 assert.ok(component.includes("loadResumeDraft()"));
 assert.ok(component.includes('source:"all"'));
 assert.ok(component.includes('remote_only:String(parsed.remoteOnly)'));
 assert.ok(component.includes("selectOpportunity(next)"));
 assert.ok(component.includes("<PreparationJourney"));
 assert.ok(component.includes("abort.current?.abort()"));
 assert.doesNotMatch(component,/application\.submit|api\/v1\/agent\/demo\/runs/);
});
