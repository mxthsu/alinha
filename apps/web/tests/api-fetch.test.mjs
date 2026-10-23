import test from "node:test";
import assert from "node:assert/strict";
import {apiFetch} from "../src/lib/api-fetch.ts";

function nativeBridge(handler){
 return {__TAURI__:{core:{invoke:handler}}};
}

test("Desktop sends only allowlist parameters; never sends the session token",async()=>{
 const original=globalThis.window;
 let observed=null;
 globalThis.window=nativeBridge(async(command,args)=>{
  observed={command,args};
  return {status:200,content_type:"application/json",
   body_base64:btoa('{"jobs":[]}')};
 });
 try{
  const result=await apiFetch("http://localhost:8000/api/v1/jobs/search?query=Python%20BR");
  assert.deepEqual(await result.json(),{jobs:[]});
  assert.equal(observed.command,"api_request");
  assert.deepEqual(Object.keys(observed.args).sort(),
   ["bodyBase64","contentType","method","path"]);
  assert.equal(observed.args.path,"/api/v1/jobs/search?query=Python%20BR");
  assert.equal(observed.args.method,"GET");
  assert.ok(!JSON.stringify(observed).includes("sessionToken"));
 }finally{globalThis.window=original;}
});

test("Desktop preserves JSON request and backend errors",async()=>{
 const original=globalThis.window;
 let observed=null;
 globalThis.window=nativeBridge(async(_,args)=>{
  observed=args;
  return {status:422,content_type:"application/json",
   body_base64:btoa('{"detail":"invalid"}')};
 });
 try{
  const response=await apiFetch("http://127.0.0.1:8000/api/v1/ats/check/text",{
   method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:"ficticio"}),
  });
  assert.equal(response.status,422);
  assert.deepEqual(await response.json(),{detail:"invalid"});
  assert.deepEqual(JSON.parse(atob(observed.bodyBase64)),{text:"ficticio"});
 }finally{globalThis.window=original;}
});

test("Native Desktop refuses off-loopback origins and aborted calls",async()=>{
 const original=globalThis.window;
 let calls=0;
 globalThis.window=nativeBridge(async()=>{
  calls++;
  return {status:200,content_type:"application/json",body_base64:"e30="};
 });
 try{
  await assert.rejects(()=>apiFetch("https://evil.invalid/api/v1/jobs/search"),/Origem/);
  const controller=new AbortController();
  controller.abort();
  await assert.rejects(()=>apiFetch("http://localhost:8000/api/v1/jobs/search",{
   signal:controller.signal,
  }),{name:"AbortError"});
  assert.equal(calls,0);
 }finally{globalThis.window=original;}
});

test("Community browser keeps the ordinary fetch transport",async()=>{
 const originalWindow=globalThis.window;
 const originalFetch=globalThis.fetch;
 let count=0;
 globalThis.window=undefined;
 globalThis.fetch=async()=>{count++;return new Response("ok",{status:200});};
 try{
  const r=await apiFetch("http://localhost:8000/api/v1/jobs/search");
  assert.equal(await r.text(),"ok");
  assert.equal(count,1);
 }finally{globalThis.fetch=originalFetch;globalThis.window=originalWindow;}
});
