/** Versioned local SQLite API, shared by Studio and opportunity tracking. */
export type CommunityKind="resume"|"opportunities"|"resume_versions";
export type CommunityRecord={value:unknown;revision:number};
const API=process.env.NEXT_PUBLIC_API_URL||"http://localhost:8000";

async function responseOrThrow(response:Response):Promise<Record<string,unknown>>{
 const body:unknown=await response.json();
 if(!response.ok){
  const message=body&&typeof body==="object"&&"detail" in body?
   (body as {detail:unknown}).detail:null;
  throw new Error(typeof message==="string"?message:"O armazenamento local não está disponível.");
 }
 if(!body||typeof body!=="object"||Array.isArray(body))
  throw new Error("O armazenamento local retornou dados inesperados.");
 return body as Record<string,unknown>;
}
export async function readCommunityRecord(kind:CommunityKind):Promise<CommunityRecord>{
 const body=await responseOrThrow(await fetch(
  API+"/api/v1/community/data/"+kind,{cache:"no-store"},
 ));
 if(!Number.isInteger(body.revision)||typeof body.revision!=="number"||body.revision<0)
  throw new Error("Revisão local inválida.");
 return {value:body.value,revision:body.revision};
}
export async function saveCommunityRecord(kind:CommunityKind,value:unknown,expected_revision:number):Promise<number>{
 const body=await responseOrThrow(await fetch(API+"/api/v1/community/data/"+kind,{
  method:"PUT",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({expected_revision,value}),cache:"no-store",
 }));
 if(typeof body.revision!=="number")throw new Error("Confirmação de salvamento ausente.");
 return body.revision;
}
export async function clearCommunityRecord(kind:CommunityKind,expected_revision:number):Promise<number>{
 const body=await responseOrThrow(await fetch(
  API+"/api/v1/community/data/"+kind+"?expected_revision="+expected_revision,{
   method:"DELETE",cache:"no-store",
  }));
 if(typeof body.revision!=="number")throw new Error("Confirmação de exclusão ausente.");
 return body.revision;
}
