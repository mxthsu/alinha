import test from "node:test";
import assert from "node:assert/strict";
import {evaluateVacancy,jobSource,titleRelevance} from "../src/lib/job-preferences.ts";

const vacancy={
  opportunity:{
    source:"lever",external_id:"fake-1",city:"Florianópolis, SC",
    work_mode:"hybrid",contract_type:"clt",
    advertised_min_salary_brl:5000,
    source_url:"https://jobs.lever.co/example/1",
  },
};
const p={workMode:"hybrid",contract:"clt",city:"Florianopolis, SC",salary:"4500"};
const check=(changes={},prefs={})=>evaluateVacancy(
  {opportunity:{...vacancy.opportunity,...changes}},{...p,...prefs},
);

test("keeps documented matches",()=>{
  assert.deepEqual(check(),{status:"eligible",pending:[]});
});
test("explicit mismatch excludes only that vacancy",()=>{
  assert.equal(check({work_mode:"onsite"}).status,"exclude");
  assert.equal(check({contract_type:"pj"}).status,"exclude");
  assert.equal(check({city:"Curitiba, PR"}).status,"exclude");
});
test("unreported facts remain visible as needing confirmation",()=>{
  const result=check({work_mode:"unspecified",contract_type:"unspecified",city:null});
  assert.equal(result.status,"review");
  assert.ok(result.pending.includes("modalidade não informada"));
  assert.ok(result.pending.includes("tipo de contrato não informado"));
  assert.ok(result.pending.includes("cidade não informada"));
});
test("a salary floor below preference is NOT interpreted as a certain mismatch",()=>{
  const result=check({advertised_min_salary_brl:3500});
  assert.equal(result.status,"review");
  assert.ok(result.pending.some(s=>s.includes("faixa salarial")));
});
test("remote vacancies are not rejected for a city difference",()=>{
  assert.equal(check({work_mode:"remote",city:"Recife, PE"},{workMode:"remote"}).status,"eligible");
});
test("accent and punctuation insensitive city matching",()=>{
  assert.equal(check({city:"São José, Santa Catarina"},{city:"Sao Jose, SC"}).status,"eligible");
});
test("source attribution is not hardcoded to Himalayas",()=>{
  assert.deepEqual(jobSource("github-vagas"),{
    label:"Comunidades GitHub",url:"https://github.com/backend-br/vagas",
  });
  assert.deepEqual(jobSource("unknown"),{label:"Fonte externa",url:null});
});

test("job titles matching a search outrank generic multi-role listings",()=>{
  const explicit=titleRelevance("Desenvolvedor Python Backend","python");
  const generic=titleRelevance("13 vagas internacionais em tecnologia","python");
  assert.ok(explicit>generic);
});
test("relevance ignores accents and common connector words",()=>{
  assert.equal(titleRelevance("Engenharia de Inteligência Artificial","inteligencia artificial"),1);
  assert.equal(titleRelevance("Desenvolvedor de Software","de software"),1);
});
