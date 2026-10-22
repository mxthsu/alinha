import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 startDemo,advanceDemo,cancelDemo,reviewDemo,demoCanAdvance,DEMO_TOOL_LABEL,
} from "../src/lib/agent-demo-runtime.ts";

const seed={schema_version:1,run_id:"demo-fictional-01",status:"planning",next_step:0,
 plan:[{schema_version:1,action_id:"demo-step-0",tool:"resume.read",args:{},reason:"Demonstração"}],
 events:[],jobs:[],matches:[],profile:null,preview:null,external_submission:false,
 intent:"Encontre vagas Python fictícias",
};
function transport(data=seed){
 const calls=[];
 const fake=async(url,options)=>{
  calls.push({url,options,body:JSON.parse(options.body)});
  return new Response(JSON.stringify(data),{status:200,headers:{"Content-Type":"application/json"}});
 };
 return {fake,calls};
}

test("start sends only the bounded synthetic intent with explicit fake search grant",async()=>{
 const {fake,calls}=transport();
 const run=await startDemo("http://localhost:8000","Encontre vagas Python remotas","synthetic-request-001",fake);
 assert.equal(run.external_submission,false);
 assert.equal(calls.length,1);
 assert.match(calls[0].url,/\/api\/v1\/agent\/demo\/runs$/);
 assert.equal(calls[0].body.search_authorized,true);
 assert.equal(calls[0].body.draft_authorized,true);
 assert.equal(calls[0].body.limits.max_jobs,3);
 assert.equal(calls[0].body.limits.max_ai_calls,1);
 assert.equal("resume" in calls[0].body,false);
 assert.equal("contact" in calls[0].body,false);
});

test("advance, cancel and review use separate safe endpoints, never submit",async()=>{
 const {fake,calls}=transport();
 await advanceDemo("http://localhost:8000",seed,fake);
 await cancelDemo("http://localhost:8000",seed.run_id,fake);
 await reviewDemo("http://localhost:8000",seed.run_id,fake);
 assert.deepEqual(calls.map(call=>call.url.split("/").at(-1)),["advance","cancel","review"]);
 assert.deepEqual(calls[0].body,{expected_step:0});
 assert.deepEqual(calls[1].body,{});
 assert.deepEqual(calls[2].body,{confirm_review:true,availability:"a_combinar"});
 assert.ok(calls.every(call=>!call.url.includes("submit")));
});

test("never accept a response implying an external submission",async()=>{
 const {fake}=transport({...seed,external_submission:true});
 await assert.rejects(()=>startDemo("http://localhost:8000",seed.intent,"synthetic-002",fake),
  /estado de envio não confirmado/);
});

test("finished run cannot advance; labels remain in pt-BR",()=>{
 assert.equal(demoCanAdvance(seed),true);
 assert.equal(demoCanAdvance({...seed,status:"needs_review"}),false);
 assert.equal(demoCanAdvance({...seed,status:"cancelled"}),false);
 assert.equal(demoCanAdvance({...seed,next_step:seed.plan.length}),false);
 assert.equal(DEMO_TOOL_LABEL["application.preview"],"Gerar prévia para revisão");
});

test("UI requires a distinct search approval and review before confirmation",()=>{
 const component=readFileSync(new URL("../src/components/agent-demo-journey.tsx",import.meta.url),"utf8");
 const page=readFileSync(new URL("../src/app/agente/page.tsx",import.meta.url),"utf8");
 assert.match(component,/authorized\|\|intent\.trim\(\)\.length/);
 assert.match(component,/reviewConfirmed\|\|availability/);
 assert.match(component,/Cancelar execução/);
 assert.match(component,/não enviado/);
 assert.match(page,/<AgentDemoJourney\/>/);
});
