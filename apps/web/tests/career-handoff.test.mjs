import test from "node:test";
import assert from "node:assert/strict";
import {normalizeSelectedOpportunity} from "../src/lib/career-handoff.ts";

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
