import test from "node:test";
import assert from "node:assert/strict";
import {
  addOpportunity, changeStatus, exportTracker, importTracker, opportunityFingerprint,
  parseTracker, safeJobUrl, TRACKER_LIMIT,
} from "../src/lib/opportunity-tracker.ts";

const now="2026-10-16T18:00:00Z";
const valid={
  title:"Engenheira de Software",company:"Empresa de Exemplo",
  url:"https://jobs.example.com/jobs/123?utm_source=alinha",
  source:"example",sourceId:"123",
};

test("allows only public HTTPS job URLs and never preserves known sensitive query data",()=>{
  assert.equal(safeJobUrl("https://jobs.example.com/jobs/123?utm_source=x"),"https://jobs.example.com/jobs/123");
  for(const bad of [
    "javascript:alert(1)","http://jobs.example.com/jobs/1",
    "https://localhost/jobs","https://127.0.0.1/a",
    "https://192.168.1.2/jobs","https://portal.internal/jobs",
    "https://user:password@example.com/jobs",
    "https://jobs.example.com/job?access_token=SECRET",
    "https://jobs.example.com/job?session=abc",
    "file:///etc/passwd","https://[::1]/",
  ]) assert.equal(safeJobUrl(bad),null,bad);
});

test("saves a real-looking synthetic opportunity with no candidate data",()=>{
  const result=addOpportunity([],valid,"job-1",now);
  assert.equal(result.added,true);
  assert.equal(result.items.length,1);
  assert.equal(result.items[0].status,"saved");
  assert.equal(result.items[0].url,"https://jobs.example.com/jobs/123");
  assert.equal(result.items[0].sourceId,"123");
});

test("deduplication survives source identifiers, trackers and trailing slashes",()=>{
  const existing=addOpportunity([],valid,"job-1",now).items;
  const duplicate=addOpportunity(existing,{...valid,sourceId:"different",url:"https://jobs.example.com/jobs/123/"}, "job-2",now);
  assert.equal(duplicate.added,false);
  assert.equal(duplicate.items.length,1);
  assert.match(duplicate.reason,/já está/);
  assert.equal(opportunityFingerprint("example","x","https://jobs.example.com/jobs/123/"),
    opportunityFingerprint("other","y","https://jobs.example.com/jobs/123"));
});

test("changing status is explicit and does not overwrite unrelated items",()=>{
  const original=addOpportunity([],valid,"job-1",now).items;
  const updated=changeStatus(original,"job-1","interview","2026-10-17T09:00:00Z");
  assert.equal(original[0].status,"saved");
  assert.equal(updated[0].status,"interview");
  assert.equal(updated[0].updatedAt,"2026-10-17T09:00:00Z");
  assert.equal(changeStatus(updated,"missing","offer",now)[0].status,"interview");
});

test("import/export roundtrip is versioned and rejects tampered or duplicate items",()=>{
  const items=addOpportunity([],valid,"job-1",now).items;
  const file=exportTracker(items);
  assert.deepEqual(importTracker(file),items);
  const obj=JSON.parse(file);
  obj.items.push(obj.items[0]);
  assert.throws(()=>importTracker(JSON.stringify(obj)),/duplicados/);
  assert.throws(()=>importTracker(JSON.stringify({version:5,items:[]})),/Formato/);
  assert.throws(()=>importTracker("not json"),/JSON válido/);
});

test("rejects invalid JSON data, unwanted keys, unsafe links and non-ISO status",()=>{
  const obj=addOpportunity([],valid,"job-1",now).items[0];
  for(const patch of [
    {status:"confirmed_by_company"},
    {url:"javascript:alert(1)"},
    {title:""},
    {sourceId:100},
    {addedAt:"no-date"},
  ]) assert.equal(parseTracker([{...obj,...patch}]).length,0,JSON.stringify(patch));
});

test("the tracker never trusts arbitrary imported objects or oversized lists",()=>{
  assert.deepEqual(parseTracker({items:[]}),[]);
  assert.deepEqual(parseTracker(new Array(TRACKER_LIMIT+1).fill(null)),[]);
  const full=new Array(TRACKER_LIMIT).fill(null);
  assert.equal(parseTracker(full).length,0);
  assert.throws(()=>importTracker(" ".repeat(320_001)),/grande/);
});

test("manual links from Brazilian platforms are bookmarks, never scraping instructions",()=>{
  const job={title:"Analista de Dados",company:"Empresa Brasileira",
    url:"https://empresa.gupy.io/jobs/12345",source:"empresa.gupy.io",sourceId:null};
  const result=addOpportunity([],job,"job-local-1",now);
  assert.equal(result.added,true);
  assert.equal(result.items[0].url,job.url);
  assert.equal(result.items[0].status,"saved");
});

test("one source identifier or imported record ID cannot control multiple cards",()=>{
  const first=addOpportunity([],valid,"job-one",now).items;
  const sameSourceDifferentUrl=addOpportunity(first,{...valid,url:"https://jobs.example.com/jobs/new"},
    "job-two",now);
  assert.equal(sameSourceDifferentUrl.added,false);
  const second=addOpportunity(first,{...valid,sourceId:"newid",url:"https://jobs.example.com/jobs/new"},
    "job-two",now);
  assert.equal(second.added,true);
  assert.equal(parseTracker([{...first[0]},{...second.items[1],id:"job-one"}]).length,1);
});
