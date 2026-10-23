/** Typed, opt-in transport for the experimental native Desktop host.
 * Web/Community keeps using fetch. In Tauri, only the Rust allowlist can
 * forward calls to the authenticated Python loopback API; JS never sees token.
 */
type ApiReply={status:number;content_type:string;body_base64:string};
type NativeInvoke=<T>(command:string,args?:Record<string,unknown>)=>Promise<T>;
declare global{
 interface Window{__TAURI__?:{core?:{invoke:NativeInvoke}}}
}
const MAX_BODY_BYTES=10*1024*1024;
function nativeInvoke():NativeInvoke|undefined{
 return typeof window==="undefined"?undefined:window.__TAURI__?.core?.invoke;
}
function encode(bytes:Uint8Array):string{
 let out="";
 for(let i=0;i<bytes.length;i+=16384)
  out+=String.fromCharCode(...bytes.subarray(i,i+16384));
 return btoa(out);
}
function decode(value:string):Uint8Array<ArrayBuffer>{
 const str=atob(value);
 const bytes=new Uint8Array(str.length);
 for(let i=0;i<str.length;i++)bytes[i]=str.charCodeAt(i);
 return bytes;
}
function allowedOrigin(url:URL):boolean{
 return url.protocol==="http:" && url.port==="8000" &&
  (url.hostname==="localhost"||url.hostname==="127.0.0.1");
}

/** Drop-in replacement for same-origin local Alinha API fetch calls.
 * Abort stops UI waiting; the Rust request may finish within its 35s bound.
 */
export async function apiFetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>{
 const invoke=nativeInvoke();
 if(!invoke)return fetch(input,init);
 const request=new Request(input,init);
 const url=new URL(request.url);
 if(!allowedOrigin(url))throw new Error("Origem da API Desktop não autorizada");
 const body=new Uint8Array(await request.arrayBuffer());
 if(body.length>MAX_BODY_BYTES)throw new Error("Arquivo muito grande para a ponte Desktop");
 if(request.signal.aborted)throw new DOMException("Operação cancelada","AbortError");
 let onAbort:(()=>void)|undefined;
 const aborted=new Promise<never>((_,reject)=>{
  onAbort=()=>reject(new DOMException("Operação cancelada","AbortError"));
  request.signal.addEventListener("abort",onAbort,{once:true});
 });
 try{
  const native=invoke<ApiReply>("api_request",{
   method:request.method,path:url.pathname+url.search,
   contentType:request.headers.get("content-type")??"",
   bodyBase64:encode(body),
  });
  const answer=await Promise.race([native,aborted]);
  if(!Number.isInteger(answer.status)||answer.status<200||answer.status>599)
   throw new Error("Resposta inválida da API Desktop");
  const bytes=decode(answer.body_base64);
  return new Response(answer.status===204||answer.status===205||answer.status===304
   ?null:bytes,{status:answer.status,headers:{"Content-Type":answer.content_type}});
 }finally{
  if(onAbort)request.signal.removeEventListener("abort",onAbort);
 }
}
