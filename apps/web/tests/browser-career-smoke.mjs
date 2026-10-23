/** Real Chrome smoke, synthetic-only fixtures; never calls a live job source. */
import {chromium} from "playwright";
import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {resolve} from "node:path";

const web=process.env.ALINHA_SMOKE_WEB??"http://127.0.0.1:3000";
const output=resolve(process.cwd(),".browser-smoke");
const profile=[
 "Pessoa Fictícia","Desenvolvedora Python","E-mail: ficticio@example.test",
 "Resumo profissional","Desenvolvedora Python com experiência em FastAPI e SQL.",
 "Experiência profissional","Engenheira de Software - Empresa Modelo",
 "2023 - 2025","Desenvolvimento com Python, FastAPI e SQL.",
 "Competências","Python","FastAPI","SQL","Formação",
 "Bacharelado em Computação - Faculdade Exemplo",
].join("\n");
const jobs={
 jobs:[
  {opportunity:{
   source:"gupy",external_id:"fictional-job-01",title:"Engenheiro de IA",
   company:"Empresa Horizonte (fictícia)",city:"Florianópolis, SC",
   work_mode:"remote",contract_type:"clt",source_url:"https://jobs.example.com/positions/fictional-job-01",
   advertised_min_salary_brl:null,
  },excerpt:"Trabalhe com Python, FastAPI, SQL e Kubernetes.",
   description:"Vaga fictícia para Engenheiro de IA remoto. Trabalhe com Python, FastAPI, SQL e Kubernetes. O contrato depende de aprovação da empresa.",
   missing_information:[],employment_label:"CLT",salary_label:null},
  {opportunity:{
   source:"lever",external_id:"fictional-job-02",title:"Engenheiro de IA",
   company:"Equipe Fictícia",city:"São Paulo, SP",work_mode:"onsite",
   contract_type:"unspecified",source_url:"https://jobs.example.com/positions/fictional-job-02",
   advertised_min_salary_brl:null,
  },excerpt:"Vaga presencial.",description:"Vaga fictícia presencial em São Paulo.",
   missing_information:[],employment_label:null,salary_label:null},
 ],
 source_name:"Fontes de teste (interceptadas no navegador)",
 limitations:["Resultados completamente fictícios. Nenhuma fonte de vagas externa foi consultada."],
};
const browser=await chromium.launch({
 headless:true,channel:"chrome",args:["--disable-extensions","--no-first-run"],
});
const context=await browser.newContext({
 viewport:{width:1366,height:900},locale:"pt-BR",permissions:["clipboard-read","clipboard-write"],
});
const page=await context.newPage();
const searchCalls=[];
const intentCalls=[];
const outbound=[];
const browserErrors=[];
page.on("pageerror",e=>browserErrors.push(e.message));
page.on("dialog",dialog=>dialog.accept()); // Synthetic isolated profile only.
page.on("request",request=>{
 if(request.method()==="POST" && /(?:submit|apply|application\/dispatch)/i.test(request.url()))
  outbound.push(request.url());
});
await page.route(/\/api\/v1\/providers\/status$/,route=>route.fulfill({
 status:200,contentType:"application/json",
 body:JSON.stringify({
  gemini:{available:true},openai_api:{available:false},
  anthropic:{available:false},ollama:{available:false},
  chatgpt:{connected:false},
 }),
}));
await page.route(/\/api\/v1\/agent\/interpret$/,route=>{
 const request=route.request().postDataJSON();
 intentCalls.push(request);
 return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
  tool:"job.search",query:"Engenheiro de IA",reason:"Cargo encontrado no objetivo.",
  needs_confirmation:true,executed:false,external_submission:false,model_calls:1,
  run_id:request.run_id,calls_used:1,calls_remaining:1,
  steps:[
   {tool:"job.search",state:"proposed",requires_confirmation:true,external_submission:false},
   {tool:"job.assess",state:"proposed",requires_confirmation:false,external_submission:false},
   ...(request.preview_requested?[{
    tool:"application.preview",state:"proposed",requires_confirmation:true,external_submission:false,
   }]:[]),
  ],
 })});
});
await page.route(/\/api\/v1\/jobs\/search\?/,async route=>{
 searchCalls.push(route.request().url());
 await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(jobs)});
});
try{
 await mkdir(output,{recursive:true});
 await page.goto(web+"/agente",{waitUntil:"networkidle",timeout:40000});
 assert.match(await page.locator("main h1").innerText(),/carreira/);
 await page.locator('input[type="file"]').setInputFiles({
  name:"curriculo-ficticio.txt",mimeType:"text/plain",buffer:Buffer.from(profile,"utf8"),
 });
 await page.getByText(/Perfil importado/).waitFor({timeout:25000});
 await page.locator("#career-intent").fill(
  "Encontre vagas de Engenheiro de IA remoto no Brasil, compare com meu currículo e prepare candidaturas"
 );
 await page.locator(".unified-ai-assist summary").click();
 await page.getByRole("button",{name:"Sugerir cargo com IA"}).click();
 await page.getByText("Sugestão para sua revisão: Engenheiro de IA").waitFor();
 assert.equal(intentCalls.length,1,"Interpretation requires explicit click");
 assert.deepEqual(Object.keys(intentCalls[0]).sort(),
  ["objective","preview_requested","provider","request_id","run_id"],
  "Only an objective, anonymous identifiers and scope may reach the planner API");
 assert.equal(intentCalls[0].preview_requested,true);
 assert.equal(typeof intentCalls[0].run_id,"string");
 assert.equal(searchCalls.length,0,"Model proposal must not start a search");
 assert.equal(await page.locator(".unified-ai-step-list li").count(),3);
 await page.getByText("Interpretações restantes nesta jornada: 1/2").waitFor();
 await page.screenshot({path:resolve(output,"ai-proposal.png"),fullPage:false});
 await page.getByRole("button",{name:"Usar cargo sugerido"}).click();
 await page.getByText("Cargo confirmado por você:").waitFor();
 await page.getByRole("checkbox").check();
 await page.getByRole("button",{name:/Encontrar e comparar vagas/}).click();
 await page.locator("#career-results").getByText("Empresa Horizonte (fictícia)").waitFor({timeout:25000});
 assert.equal(searchCalls.length,1,"Uma ação não deve repetir a consulta");
 assert.match(new URL(searchCalls[0]).searchParams.get("q"),/Engenheiro de IA/);
 assert.equal(new URL(searchCalls[0]).searchParams.get("remote_only"),"true");
 const cards=page.locator(".unified-result");
 const foundCount=await cards.count();
 assert.equal(foundCount,2);
 assert.match(await cards.nth(1).getAttribute("class"),/muted/);
 const prepared=page.getByRole("region",{name:"Candidaturas preparadas"});
 assert.equal(await prepared.locator("li").count(),1,"Vaga presencial deve ser excluída das prévias");
 await prepared.getByRole("button",{name:/Revisar rascunho/}).click();
 await page.getByText("RASCUNHO · NÃO ENVIADO").waitFor();
 const draft=await page.locator("#career-draft").inputValue();
 assert.match(draft,/Python/);
 assert.doesNotMatch(draft,/Kubernetes/);
 assert.match(await page.locator(".unified-unknown").innerText(),/Kubernetes/);
 await page.screenshot({path:resolve(output,"desktop.png"),fullPage:true});
 await page.getByRole("button",{name:/Pausar/}).click();
 await page.reload({waitUntil:"networkidle"});
 await page.getByRole("button",{name:/Retomar nesta tela/}).waitFor({timeout:20000});
 await page.getByRole("button",{name:/Retomar nesta tela/}).click();
 await page.getByText("RASCUNHO · NÃO ENVIADO").waitFor();
 const resumedDraft=await page.locator("#career-draft").inputValue();
 assert.match(resumedDraft,/Python|Engenheiro de IA/,
  "Resuming must restore a safe evidence-based draft instead of an empty editor");
 await page.getByText("Analisar com IA conectada, verificar ATS e adaptar currículo").click();
 await page.getByText("Provedor para esta operação").waitFor({timeout:15000});
 const embedded=page.locator(".journey-embedded");
 await embedded.getByText("Currículo salvo na jornada").waitFor({timeout:15000});
 assert.equal(await embedded.locator('input[type="file"]').count(),0,
  "Embedded mode must reuse the imported profile, not show a second upload");
 assert.equal(await embedded.locator(".journey-progress").count(),0,
  "Embedded mode must not present a second progress wizard");
 assert.equal(await embedded.locator(".journey-finish").count(),0,
  "Embedded mode must not present a second final step");
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:resolve(output,"mobile.png"),fullPage:true});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
 assert.ok(overflow<=2,"Overflow horizontal no mobile: "+overflow+"px");
 // Simulate connector failure without touching an external site.
 await page.unroute(/\/api\/v1\/jobs\/search\?/);
 await page.route(/\/api\/v1\/jobs\/search\?/,route=>route.fulfill({
  status:503,contentType:"application/json",body:JSON.stringify({detail:"Fonte fictícia indisponível"}),
 }));
 await page.getByRole("checkbox").check();
 await page.getByRole("button",{name:/Encontrar e comparar vagas/}).click();
 await page.getByText("Fonte fictícia indisponível").waitFor();
 // A delayed read can be cancelled locally; no external submission is retried.
 await page.unroute(/\/api\/v1\/jobs\/search\?/);
 await page.route(/\/api\/v1\/jobs\/search\?/,async route=>{
  await new Promise(done=>setTimeout(done,1800));
  try{await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(jobs)});}
  catch{ /* Aborted request; no live network */ }
 });
 await page.getByRole("button",{name:/Encontrar e comparar vagas/}).click();
 await page.getByRole("button",{name:/Cancelar/}).click();
 await page.getByText("A busca foi cancelada.").waitFor();
 assert.deepEqual(outbound,[],"Nunca disparar envio de candidatura");
 assert.deepEqual(browserErrors,[],"Sem erros Javascript no navegador");
 console.log(JSON.stringify({
  result:"ok",intentCalls:intentCalls.length,searchCalls:searchCalls.length,results:foundCount,
  resumed:true,embeddedProvider:true,mobileOverflow:overflow,
  externalSubmissions:outbound.length,screenshots:output,
 },null,2));
}finally{
 await context.close();
 await browser.close();
}
