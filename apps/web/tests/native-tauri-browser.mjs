/** Native WebView2 smoke against an isolated Tauri + Python process.
 * Run only with WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS debugging enabled.
 * Do not connect to or manipulate a user's ordinary browser session.
 */
import assert from "node:assert/strict";
import {chromium} from "playwright";

const port=Number(process.env.ALINHA_SMOKE_CDP_PORT??"9339");
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error("Invalid CDP test port");
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`,{timeout:10000});
try {
 const context=browser.contexts()[0];
 const page=context.pages().find(p=>p.url().startsWith("http://tauri.localhost/"));
 assert.ok(page,"Only Alinha native WebView2 must be attached");
 const status=await page.evaluate(async()=>{
  const inv=window.__TAURI__?.core?.invoke;
  if(typeof inv!=="function")throw new Error("Tauri invoke unavailable");
  return await inv("desktop_status");
 });
 assert.equal(status.api_ready,true,"Rust must have authenticated Python ready");
 const metadata=await page.evaluate(async()=>{
  const invoke=window.__TAURI__.core.invoke;
  const api=await invoke("api_request",{
   method:"GET",path:"/api/v1/providers/status",contentType:"",bodyBase64:""
  });
  const refused=await invoke("api_request",{
   method:"POST",path:"/api/v1/application/submit",
   contentType:"application/json",bodyBase64:"e30="
  }).then(()=>false,()=>true);
  return {apiStatus:api.status,apiBodyIsJSON:atob(api.body_base64).startsWith("{"),
          refused,exposedApiKeys:Object.keys(window.__TAURI__)};
 });
 assert.equal(metadata.apiStatus,200,"Rust->Python authenticated GET failed");
 assert.equal(metadata.apiBodyIsJSON,true);
 assert.equal(metadata.refused,true,"No application submission may be dispatched");
 assert.ok(!metadata.exposedApiKeys.some(k=>/token|secret|session/i.test(k)));
 console.log("NATIVE_API_OK",JSON.stringify(metadata));
 await page.goto("http://tauri.localhost/agente",{waitUntil:"domcontentloaded",timeout:12000});
 await page.waitForTimeout(1500);
 const route={url:page.url(),title:await page.title(),
              headings:await page.locator("h1,h2").allTextContents(),
              fileInputs:await page.locator('input[type="file"]').count()};
 console.log("NATIVE_ROUTE",JSON.stringify(route));
 assert.ok(route.headings.some(h=>/agente|carreira|objetivo|currículo/i.test(h)),
   "Alinha agent route did not render in native WebView");
 const field=page.locator("#career-intent");
 assert.equal(await field.count(),1,"Agent intent input must exist");
 // Completely fictitious CV: exercise native file input -> JS FormData -> Rust
 // allowlisted IPC -> authenticated Python parser, without job-network calls.
 const fictionalCV=[
  "Pessoa Fictícia", "candidato@example.invalid",
  "Objetivo: Desenvolvedor Python",
  "Resumo: Perfil fictício usado somente em testes de importação.",
  "Competências: Python, SQL, FastAPI.",
  "Experiência: Projeto de demonstração fictício em 2024.",
 ].join(String.fromCharCode(10));
 await page.locator('input[type="file"]').setInputFiles({
  name:"curriculo-totalmente-ficticio.txt",mimeType:"text/plain",
  buffer:Buffer.from(fictionalCV,"utf8"),
 });
 await page.locator(".unified-profile-line").getByText(/perfil local editável/i)
  .waitFor({timeout:20000});
 const imported=await page.locator(".unified-profile-line").innerText();
 assert.match(imported,/perfil local editável/i);
 await field.fill("Encontre vagas de Desenvolvedor Python remoto no Brasil");
 assert.match(await field.inputValue(),/Python/);
 console.log("NATIVE_CV_IMPORT_OK",{length:imported.length});
 console.log("NATIVE_WEBVIEW2_JOURNEY_OK");
} finally {
 await browser.close();
}
