import test from "node:test";
import assert from "node:assert/strict";
import {
 planCareerSearch,assessAgentJob,orderAgentJobs,COMMUNITY_AGENT_PERMISSIONS,
} from "../src/lib/career-agent.ts";
const profile={
 schema_version:1,
 contact:{name:"Pessoa Exemplo Fictícia",headline:"Engenheira de IA | Backend",
  email:"ficticio@example.test",phone:"000000",city:"Cidade Exemplo",links:[]},
 summary:"Experiência comprovada em desenvolvimento e pesquisa.",
 experiences:[{role:"Desenvolvedora Python | Empresa Fictícia",organization:"Empresa Fictícia",
  period:"2023 - atual",highlights:["Criou APIs com FastAPI e PostgreSQL."]}],
 education:[],projects:[{title:"Projeto",description:"Orquestração com LangGraph",link:""}],
 skills:["Python","Docker","Power BI"],languages:[],
};

const base={
 opportunity:{source:"himalayas",external_id:"fake-1",title:"Python Backend Engineer",
  company:"Empresa Fictícia",work_mode:"remote",contract_type:"unspecified",
  source_url:"https://himalayas.app/companies/example/jobs/python"},
 excerpt:"Build Python services with Docker and PostgreSQL.",
 missing_information:[],
};

test("suggests only literal roles without including name, e-mail or contact",()=>{
 const plan=planCareerSearch(profile);
 assert.deepEqual(plan.roleQueries,["Engenheira de IA","Desenvolvedora Python"]);
 assert.ok(plan.evidence.some(s=>s.term==="Python"&&s.source==="competencia"));
 assert.ok(plan.evidence.some(s=>s.term==="LangGraph"&&s.source==="projeto"));
 const serialized=JSON.stringify(plan);
 assert.equal(serialized.includes(profile.contact.email),false);
 assert.equal(serialized.includes(profile.contact.phone),false);
 assert.equal(serialized.includes(profile.contact.name),false);
});

test("only matches explicit profile evidence found in the actual title or excerpt",()=>{
 const plan=planCareerSearch(profile);
 const result=assessAgentJob(base,plan,"Python Backend");
 assert.equal(result.kind,"signals");
 assert.ok(result.matched.includes("Python"));
 assert.ok(result.matched.includes("Docker"));
 assert.ok(!result.matched.includes("Power BI"));
 assert.equal(result.descriptionCoverage,"excerpt_only");
});

test("missing vacancy description yields unknown relevance, never an ATS percentage",()=>{
 const plan=planCareerSearch(profile);
 const result=assessAgentJob({...base,opportunity:{...base.opportunity,title:"Operations Specialist"},excerpt:""},plan,"Engenheira de IA");
 assert.equal(result.kind,"insufficient");
 assert.deepEqual(result.matched,[]);
 assert.match(result.note,/descrição completa/);
 assert.equal("score" in result,false);
});

test("sorts signals before unknowns, without mutating provider results",()=>{
 const plan=planCareerSearch(profile);
 const unrelated={...base,opportunity:{...base.opportunity,external_id:"fake-2",title:"Office Assistant"},excerpt:""};
 const list=[unrelated,base];
 const sorted=orderAgentJobs(list,plan,"Python Backend");
 assert.equal(sorted[0].opportunity.external_id,"fake-1");
 assert.equal(list[0].opportunity.external_id,"fake-2");
});

test("does not invent roles or capabilities on sparse profiles",()=>{
 const bare={...profile,contact:{...profile.contact,headline:"",name:"Pessoa"},
   experiences:[],projects:[],skills:[],summary:"Quero uma oportunidade."};
 const plan=planCareerSearch(bare);
 assert.deepEqual(plan.roleQueries,[]);
 assert.deepEqual(plan.evidence,[]);
 assert.ok(plan.warnings.some(x=>x.includes("cargo desejado")));
});

test("agent cannot submit applications; search and draft preparation require approval",()=>{
 assert.equal(COMMUNITY_AGENT_PERMISSIONS.read_local_resume,"allow");
 assert.equal(COMMUNITY_AGENT_PERMISSIONS.search_public_jobs,"ask");
 assert.equal(COMMUNITY_AGENT_PERMISSIONS.prepare_draft,"ask");
 assert.equal(COMMUNITY_AGENT_PERMISSIONS.submit_application,"deny");
});


test("full descriptions improve evidence matching without inventing unsupported skills",()=>{
 const plan=planCareerSearch(profile);
 const job={...base,
  excerpt:"Resumo sem detalhes da vaga.",
  description:"Buscamos uma pessoa Python com Docker, PostgreSQL e LangGraph. ".repeat(3)};
 const match=assessAgentJob(job,plan,"Python Backend");
 assert.equal(match.descriptionCoverage,"full");
 assert.ok(match.matched.includes("LangGraph"));
 assert.ok(match.matched.includes("Docker"));
 assert.ok(!match.matched.includes("Power BI"));
});

test("explicit developer role in an unstructured summary starts the next search",()=>{
 const summary="Desenvolvedor(a) de backend com experiência em automações e integração. Desenvolvimento de APIs REST com Python e FastAPI.";
 const input={...profile,contact:{...profile.contact,name:"",headline:""},experiences:[],skills:[],projects:[],summary};
 const planned=planCareerSearch(input);
 assert.deepEqual(planned.roleQueries,["Desenvolvedor de backend"]);
 assert.ok(planned.evidence.some(x=>x.term==="Python"&&x.source==="resumo"));
 assert.ok(planned.evidence.some(x=>x.term==="FastAPI"&&x.source==="resumo"));
 assert.ok(!planned.evidence.some(x=>x.term==="Kubernetes"));
});
test("literal analyst role in summary can seed a search without inventing skills",()=>{
 const input={...profile,contact:{...profile.contact,headline:""},experiences:[],projects:[],skills:[],
  summary:"Analista de Dados com foco em SQL e relatórios."};
 const planned=planCareerSearch(input);
 assert.deepEqual(planned.roleQueries,["Analista de Dados"]);
 assert.ok(planned.evidence.some(x=>x.term==="SQL"));
});
test("no job title in summary does not produce a speculative role",()=>{
 const input={...profile,contact:{...profile.contact,headline:""},experiences:[],projects:[],skills:[],
  summary:"Tenho experiência com Python e automação. Procuro novos desafios."};
 const planned=planCareerSearch(input);
 assert.deepEqual(planned.roleQueries,[]);
 assert.ok(planned.evidence.some(x=>x.term==="Python"&&x.source==="resumo"));
});
