/** Shared validation for the one-step resume import. Actual file parsing stays in the local API. */
import {hasResumeContent,isResumeProfile,type ResumeProfile} from "./career-workspace.ts";

export const RESUME_MAX_BYTES=3*1024*1024;

export function resumeFileProblem(file:{name:string;size:number}):string|null{
  if(!/\.(pdf|docx|txt)$/i.test(file.name))return "Use um arquivo PDF, DOCX ou TXT.";
  if(!Number.isSafeInteger(file.size)||file.size<=0||file.size>RESUME_MAX_BYTES)
    return "O currículo precisa ter até 3 MB e não pode estar vazio.";
  return null;
}
export type ExtractedResume={profile:ResumeProfile;unassigned_lines:string[];warnings:string[]};
export function parseResumeImport(payload:unknown):ExtractedResume{
  if(!payload||typeof payload!=="object"||Array.isArray(payload))
    throw new Error("A importação retornou informações inválidas.");
  const obj=payload as Record<string,unknown>;
  if(!isResumeProfile(obj.profile)||!hasResumeContent(obj.profile))
    throw new Error("Não foi possível identificar dados suficientes. Tente um arquivo com texto selecionável.");
  if(!Array.isArray(obj.unassigned_lines)||!Array.isArray(obj.warnings))
    throw new Error("A estrutura do currículo retornada não é válida.");
  // Do not place source lines from a private resume into telemetry or logs.
  return {
    profile:obj.profile,
    unassigned_lines:obj.unassigned_lines.filter((x):x is string=>typeof x==="string").slice(0,500),
    warnings:obj.warnings.filter((x):x is string=>typeof x==="string").slice(0,30),
  };
}
