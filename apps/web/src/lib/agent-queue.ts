/** Local, bounded application drafts derived only from verified resume evidence. */
import type {ResumeProfile} from "./career-workspace.ts";
import {prepareCareerPreview,type JobJudgement,type CareerPreview} from "./agent-journey.ts";
import {safeJobUrl} from "./opportunity-tracker.ts";

export type PreparedOpportunity={
 key:string;company:string;title:string;source:string;url:string;
 preview:CareerPreview;needsReview:boolean;
};
export function wantsApplicationDrafts(intent:string):boolean{
 return /\b(?:prepar\w*|candidat\w*|rascunh\w*|aplic\w*)\b/i
  .test(intent.normalize("NFD").replace(/[\u0300-\u036f]/g,""));
}
export function prepareApplicationQueue(
 ranked:JobJudgement[],profile:ResumeProfile,max=3,
):PreparedOpportunity[]{
 const safeLimit=Math.max(0,Math.min(5,Math.floor(max)||0));
 const seen=new Set<string>();
 const queue:PreparedOpportunity[]=[];
 for(const item of ranked){
  if(queue.length>=safeLimit)break;
  if(item.status==="excluded")continue;
  const job=item.job.opportunity;
  const url=safeJobUrl(job.source_url??"");
  if(!url||seen.has(url))continue;
  seen.add(url);
  const preview=prepareCareerPreview(item,profile);
  queue.push({
   key:job.source+":"+job.external_id,company:job.company,title:job.title,
   source:job.source,url,preview,needsReview:preview.unknownQuestions.length>0,
  });
 }
 return queue;
}
