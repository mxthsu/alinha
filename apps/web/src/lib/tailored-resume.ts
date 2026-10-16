/** Tailor ordering, never author unverifiable resume facts from an AI result. */
import type {ResumeProfile} from "./career-workspace";
import type {AnalysisResult} from "./analysis";

export type TailoredProposal={
  profile:ResumeProfile;
  promotedSkills:string[];
  promotedHighlights:string[];
  changes:string[];
};

function normalize(s:string):string{
 return s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
}
const ignored=new Set(["com","para","uma","uns","das","dos","que","em","sobre","desde","and","the","for","with","has","experience","experiencia","desenvolvimento","conhecimento","uso","utilizando","anos","mais","entre","por","como","nos","nas","de","do","da","a","o","e"]);
function terms(s:string):string[]{
 return normalize(s).split(/[^a-z0-9+#.]+/).filter(x=>x.length>2&&!ignored.has(x));
}
function relevance(text:string, evidence:string[]):number{
 const hay=normalize(text);
 const tokens=new Set(terms(text));
 let score=0;
 for(const raw of evidence){
  const needle=normalize(raw.trim());
  if(needle.length>2&&hay.includes(needle))score+=8;
  const overlap=terms(raw).filter(x=>tokens.has(x)).length;
  score+=Math.min(overlap,5);
 }
 return score;
}
function prioritise<T>(items:T[],score:(item:T)=>number):T[]{
 // Stable on equal relevance; never remove or reword any original item.
 return items.map((item,index)=>({item,index,score:score(item)}))
  .sort((a,b)=>b.score-a.score||a.index-b.index).map(x=>x.item);
}
export function proposeTailoredResume(profile:ResumeProfile,analysis:AnalysisResult):TailoredProposal{
 if(analysis.analysis_mode!=="ai"||!Array.isArray(analysis.requirements))
  throw new Error("É necessária uma análise real da vaga.");
 const supported=analysis.requirements.filter(r=>
   (r.status==="evidenciado"||r.status==="parcial")&&
   typeof r.resume_evidence==="string"&&r.resume_evidence.trim().length>2
 );
 const cues=supported.flatMap(r=>[r.requirement,r.resume_evidence!]);
 const promotedSkills=profile.skills.filter(skill=>relevance(skill,cues)>0).slice(0,12);
 const rankedSkills=prioritise(profile.skills,skill=>relevance(skill,cues));
 const rankedExperiences=prioritise(profile.experiences,exp=>
  relevance([exp.role,exp.organization,...exp.highlights].join(" "),cues)
 ).map(exp=>({...exp,highlights:prioritise(exp.highlights,line=>relevance(line,cues))}));
 const rankedProjects=prioritise(profile.projects,project=>
  relevance(project.title+" "+project.description,cues));
 const promotedHighlights=rankedExperiences.flatMap(e=>e.highlights)
   .filter(x=>relevance(x,cues)>0).slice(0,5);
 const changes:string[]=[];
 if(JSON.stringify(rankedSkills)!==JSON.stringify(profile.skills))changes.push("Competências ordenadas conforme os requisitos encontrados");
 if(JSON.stringify(rankedExperiences)!==JSON.stringify(profile.experiences))
  changes.push("Experiências e atividades priorizadas por relevância");
 if(JSON.stringify(rankedProjects)!==JSON.stringify(profile.projects))
  changes.push("Projetos relevantes apresentados primeiro");
 if(changes.length===0)changes.push("O currículo original já está organizado de forma adequada às evidências identificadas");
 return {
  profile:{
   ...profile,
   contact:{...profile.contact,links:[...profile.contact.links]},
   skills:rankedSkills,
   languages:[...profile.languages],
   experiences:rankedExperiences,
   education:profile.education.map(x=>({...x})),
   projects:rankedProjects,
  },
  promotedSkills,promotedHighlights,changes,
 };
}
