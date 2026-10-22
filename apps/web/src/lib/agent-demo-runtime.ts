/** Typed transport for the synthetic, explicitly authorized career-agent demo. */
export type DemoStatus="planning"|"running"|"needs_review"|"completed"|"failed"|"cancelled";
export type DemoTool="resume.read"|"job.search"|"job.assess"|"resume.prepare"|"application.preview";
export type DemoAction={schema_version:1;action_id:string;tool:DemoTool;args:Record<string,unknown>;reason:string};
export type DemoEvent={
 schema_version:1;run_id:string;sequence:number;step:string;status:DemoStatus;
 summary:string;external_submission:false;
};
export type DemoSnapshot={
 schema_version:1;run_id:string;status:DemoStatus;intent:string;next_step:number;
 plan:DemoAction[];events:DemoEvent[];
 profile:null|{name:string;headline:string;skills:string[];summary:string};
 jobs:{id:string;title:string;company:string;location:string;requirements:string[];description:string}[];
 matches:{job_id:string;matched:string[];unverified:string[]}[];
 draft_text:string|null;
 preview:null|{job_id:string;company:string;role:string;verified_skills:string[];
  draft_text:string;unknown_questions:string[];answers:Record<string,string>;
  status:"rascunho";external_submission:false};
 external_submission:false;
};
export const DEMO_STATUS_LABEL:Record<DemoStatus,string>={
 planning:"Planejando",running:"Executando",needs_review:"Revisão necessária",
 completed:"Revisão concluída",failed:"Falha na jornada",cancelled:"Cancelada",
};
export const DEMO_TOOL_LABEL:Record<DemoTool,string>={
 "resume.read":"Ler perfil fictício","job.search":"Encontrar vagas fictícias",
 "job.assess":"Conferir evidências","resume.prepare":"Preparar rascunho",
 "application.preview":"Gerar prévia para revisão",
};
export const DEMO_TERMINAL=new Set<DemoStatus>(["cancelled","completed","failed","needs_review"]);

export function demoCanAdvance(snapshot:DemoSnapshot):boolean{
 return !DEMO_TERMINAL.has(snapshot.status)&&snapshot.next_step<snapshot.plan.length;
}
type FetchLike=typeof fetch;

async function send(
 origin:string,path:string,payload:unknown,signal?:AbortSignal,fetcher:FetchLike=fetch,
):Promise<DemoSnapshot>{
 const response=await fetcher(origin+path,{method:"POST",cache:"no-store",signal,
  headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
 const data:unknown=await response.json();
 if(!response.ok){
  const detail=data&&typeof data==="object"&&"detail" in data?(data as {detail:unknown}).detail:null;
  throw new Error(typeof detail==="string"?detail:"Não foi possível executar a jornada fictícia.");
 }
 if(!data||typeof data!=="object"||!("external_submission" in data)||
    (data as {external_submission:unknown}).external_submission!==false){
  throw new Error("Resposta insegura: estado de envio não confirmado.");
 }
 return data as DemoSnapshot;
}
export function startDemo(
 origin:string,intent:string,requestId:string,fetcher?:FetchLike,signal?:AbortSignal,
):Promise<DemoSnapshot>{
 return send(origin,"/api/v1/agent/demo/runs",{
  schema_version:1,request_id:requestId,intent,mode:"assisted",
  search_authorized:true,draft_authorized:true,limits:{max_ai_calls:1,max_jobs:3,max_elapsed_ms:60000},
 },signal,fetcher);
}
export function advanceDemo(
 origin:string,snapshot:DemoSnapshot,fetcher?:FetchLike,signal?:AbortSignal,
):Promise<DemoSnapshot>{
 return send(origin,"/api/v1/agent/demo/runs/"+encodeURIComponent(snapshot.run_id)+"/advance",
  {expected_step:snapshot.next_step},signal,fetcher);
}
export function cancelDemo(
 origin:string,runId:string,fetcher?:FetchLike,
):Promise<DemoSnapshot>{
 return send(origin,"/api/v1/agent/demo/runs/"+encodeURIComponent(runId)+"/cancel",{},undefined,fetcher);
}
export function reviewDemo(
 origin:string,runId:string,fetcher?:FetchLike,
):Promise<DemoSnapshot>{
 return send(origin,"/api/v1/agent/demo/runs/"+encodeURIComponent(runId)+"/review",
  {confirm_review:true,availability:"a_combinar"},undefined,fetcher);
}
