/** Plan independent browser-to-SQLite imports without overwriting existing records. */
import type {ResumeProfile,ResumeTemplate} from "./career-workspace.ts";
import type {TrackedOpportunity} from "./opportunity-tracker.ts";
import type {ApprovedResumeVersion} from "./approved-resume.ts";

export type LegacyResume={profile:ResumeProfile;template:ResumeTemplate};
export type MigrationSnapshot={value:unknown;revision:number};
export type LocalSnapshot={
 resume:MigrationSnapshot;
 opportunities:MigrationSnapshot;
 resume_versions:MigrationSnapshot;
};
export type MigrationPreview={
 resume:LegacyResume|null;
 opportunities:TrackedOpportunity[]|null;
 resume_versions:ApprovedResumeVersion[]|null;
 expected_revisions:Record<string,number>;
 skipped:string[];
};

/** A revision > 0 includes tombstones: never overwrite an intentionally deleted record. */
export function planCommunityMigration(
 legacy:{resume:LegacyResume|null;opportunities:TrackedOpportunity[]|null;
   resume_versions:ApprovedResumeVersion[]},
 stored:LocalSnapshot,
):MigrationPreview{
 const skipped:string[]=[];
 function eligible<T>(kind:keyof LocalSnapshot,label:string,value:T|null):T|null{
  if(value===null)return null;
  const saved=stored[kind];
  if(!Number.isSafeInteger(saved.revision)||saved.revision<0)
   throw new Error("Revisão SQLite inválida para "+label+".");
  if(saved.revision>0||saved.value!==null){
   skipped.push(label);
   return null;
  }
  return value;
 }
 const resume=eligible("resume","currículo",legacy.resume);
 const opportunities=eligible("opportunities","oportunidades",
  legacy.opportunities?.length?legacy.opportunities:null);
 const resume_versions=eligible("resume_versions","versões aprovadas",
  legacy.resume_versions.length?legacy.resume_versions:null);
 return {
  resume,opportunities,resume_versions,
  expected_revisions:{
   resume:stored.resume.revision,
   opportunities:stored.opportunities.revision,
   resume_versions:stored.resume_versions.revision,
  },
  skipped,
 };
}
export function hasMigratableData(preview:MigrationPreview):boolean{
 return Boolean(preview.resume||preview.opportunities||preview.resume_versions);
}
