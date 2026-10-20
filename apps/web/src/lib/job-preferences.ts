/** Pure, explainable vacancy filtering. Unknown facts require review, not invented matches. */
export type VacancyFacts = {
  opportunity:{
    source:string;
    external_id:string;
    city:string|null;
    work_mode:string;
    contract_type:string;
    advertised_min_salary_brl:number|null;
    source_url:string|null;
  };
};
export type VacancyPreferences = {
  workMode:string;
  contract:string;
  city:string;
  salary:string;
};
export type VacancyDecision = {
  status:"eligible"|"review"|"exclude";
  pending:string[];
};

const SOURCE_PAGES:Record<string,{label:string;url:string}> = {
  himalayas:{label:"Himalayas",url:"https://himalayas.app"},
  lever:{label:"Lever",url:"https://jobs.lever.co"},
  gupy:{label:"Gupy",url:"https://portal.gupy.io"},
  "github-vagas":{label:"Comunidades GitHub",url:"https://github.com/backend-br/vagas"},
};
export function jobSource(source:string):{label:string;url:string|null}{
  const known=SOURCE_PAGES[source];
  return known ? known : {label:"Fonte externa",url:null};
}

function normalized(value:string):string{
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/\s+/g," ").trim();
}
function normalizedCity(value:string):string{
  return normalized(value.split(/[,\/-]/)[0]);
}
function cityMatches(advertised:string,requested:string):boolean{
  const desired=normalizedCity(requested);
  const found=normalizedCity(advertised);
  if(!desired||!found)return false;
  return found===desired||found.startsWith(desired+" ")||desired.startsWith(found+" ");
}

export function evaluateVacancy(
  job:VacancyFacts,preferences:VacancyPreferences,
):VacancyDecision{
  const facts=job.opportunity;
  const pending:string[]=[];
  if(preferences.workMode!=="any"){
    if(facts.work_mode==="unspecified")pending.push("modalidade não informada");
    else if(facts.work_mode!==preferences.workMode)return {status:"exclude",pending:[]};
  }
  if(preferences.contract!=="any"){
    if(facts.contract_type==="unspecified")pending.push("tipo de contrato não informado");
    else if(facts.contract_type!==preferences.contract)return {status:"exclude",pending:[]};
  }
  const city=preferences.city.trim();
  if(city&&preferences.workMode!=="remote"){
    if(!facts.city)pending.push("cidade não informada");
    else if(!cityMatches(facts.city,city))return {status:"exclude",pending:[]};
  }
  const salary=Number(preferences.salary);
  if(preferences.salary.trim()!==""&&Number.isFinite(salary)&&salary>0){
    if(facts.advertised_min_salary_brl===null){
      pending.push("salário não informado");
    }else if(facts.advertised_min_salary_brl<salary){
      // A published minimum below the preference doesn't prove the full range is below it.
      pending.push("faixa salarial não confirmada para sua preferência");
    }
  }
  return {status:pending.length>0?"review":"eligible",pending};
}


/** Explainable, stable ranking: role words in the title appear first. */
export function titleRelevance(title:string,query:string):number{
  const stop=new Set(["de","da","do","das","dos","para","com","and","the","em"]);
  const words=normalized(query).split(/\s+/).filter(t=>t.length>=2&&!stop.has(t));
  if(!words.length)return 0;
  const haystack=normalized(title);
  return words.filter(word=>haystack.includes(word)).length/words.length;
}

/** Only known, bounded values are sent to local JSONC after consent. */
export type SavedJobPreferences=VacancyPreferences&{
 source:"all"|"gupy"|"lever"|"github"|"himalayas";
 workMode:"remote"|"hybrid"|"onsite";
 contract:"any"|"clt"|"pj"|"internship"|"trainee";
};
const sources=new Set(["all","gupy","lever","github","himalayas"]);
const modes=new Set(["remote","hybrid","onsite"]);
const contracts=new Set(["any","clt","pj","internship","trainee"]);
export function parseSavedJobPreferences(value:unknown):SavedJobPreferences|null{
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const v=value as Record<string,unknown>;
 if(Object.keys(v).some(key=>!["source","workMode","contract","city","salary"].includes(key)))return null;
 if(typeof v.source!=="string"||!sources.has(v.source)||
    typeof v.workMode!=="string"||!modes.has(v.workMode)||
    typeof v.contract!=="string"||!contracts.has(v.contract))return null;
 if(typeof v.city!=="string"||v.city.length>100||/[\x00-\x1f@]/.test(v.city))return null;
 if(typeof v.salary!=="string"||!/^\d{0,7}$/.test(v.salary)||
    (v.salary!==""&&Number(v.salary)>1_000_000))return null;
 return v as SavedJobPreferences;
}
