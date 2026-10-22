import { chromium } from "playwright";
import { resolve } from "node:path";

const url=process.env.BENCH_URL;
const resume=resolve(process.env.BENCH_CV??"");
const chrome=process.env.CHROME_PATH;
if(!url?.startsWith("http://127.0.0.1:")||!process.env.BENCH_CV||!chrome)
 throw new Error("Fixture local, CV fictício e Chromium são obrigatórios");
const runs=Math.min(30,Math.max(1,Number(process.env.BENCH_RUNS)||5));
const browser=await chromium.launch({executablePath:chrome,headless:true,args:["--no-sandbox"]});
const context=await browser.newContext();
try{
  for(let i=0;i<runs;i++){
    const start=performance.now();
    const page=await context.newPage();
    let valid=false;
    try{
      await page.goto(url);
      await page.locator("#fullname").fill("Pessoa Fictícia");
      await page.locator("#email").fill("pessoa@example.test");
      await page.locator("#phone").fill("000000000");
      await page.locator("#workmode").selectOption("remote");
      await page.locator("#timezone").selectOption("brazil");
      await page.locator("#next").click();
      await page.locator("#cv").waitFor({state:"visible"});
      await page.locator("#cv").setInputFiles(resume);
      await page.locator("#consent").check();
      await page.locator("#submit").click();
      if(!await page.locator("#confirmation").isVisible()) throw new Error("Sem confirmação do formulário fictício");
      valid=true;
    }finally{await page.close();}
    if(!valid)throw new Error("Formulário não confirmado");
    console.log(`typescript_playwright run=${i+1} latency_ms=${(performance.now()-start).toFixed(1)} valid=true ai_calls=0`);
  }
}finally{await context.close();await browser.close();}
