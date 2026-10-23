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
const outbound=[];
const browserErrors=[];
page.on("pageerror",e=>browserErrors.push(e.message));
page.on("dialog",dialog=>dialog.accept()); // Synthetic isolated profile only.
page.on("request",request=>{
 if(request.method()==="POST" && /(?:submit|apply|application\/dispatch)/i.test(request.url()))
  outbound.push(request.url());
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
 await page.getByText("Analisar com IA conectada, verificar ATS e adaptar currículo").click();
 await page.getByText("Provedor para esta operação").waitFor({timeout:15000});
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
  result:"ok",searchCalls:searchCalls.length,results:foundCount,
  resumed:true,embeddedProvider:true,mobileOverflow:overflow,
  externalSubmissions:outbound.length,screenshots:output,
 },null,2));
}finally{
 await context.close();
 await browser.close();
}
