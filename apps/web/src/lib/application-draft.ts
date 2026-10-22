/** Deterministic, side-effect-free first pass for a future application-form executor.
 * The host must collect accessible field descriptions from an authorized source.
 * This module does not fetch, browse, call an LLM, persist, or submit forms.
 */
import type {ResumeProfile} from "./career-workspace";

export type ApplicationFieldKind =
  "text"|"email"|"tel"|"url"|"textarea"|"select"|"checkbox"|"radio"|"file"|"password";
export type ApplicationField={
  id:string;label:string;kind:ApplicationFieldKind;required?:boolean;
};
export type ApplicationAnswer={
  id:string;label:string;kind:ApplicationFieldKind;required:boolean;
  status:"ready"|"needs_review";
  value:string|null;
  evidence:string|null;
  reason:string|null;
};
export type ApplicationDraft={
  status:"ready_for_review"|"needs_information";
  fields:ApplicationAnswer[];
  readyCount:number;
  reviewCount:number;
  aiCalls:number;
};

function normalize(label:string):string {
  return label.normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/[\s_*:!?]+/g," ").trim();
}
const matches:Record<string,string[]>={
  "contact.name":["nome completo","nome e sobrenome","full name","candidate name"],
  "contact.email":["email","e mail","endereco de email","email address","your email"],
  "contact.phone":["telefone","celular","telefone celular","phone","phone number","mobile phone"],
  "contact.city":["cidade","cidade atual","cidade de residencia","city","current city"],
  "linkedin":["linkedin","perfil linkedin","linkedin profile","linkedin url"],
};
function fieldSource(label:string):keyof typeof matches|null {
  const candidate=normalize(label);
  for(const [key,aliases] of Object.entries(matches)){
    if(aliases.includes(candidate))return key;
  }
  return null;
}
function linkedinLink(links:string[]):string {
  for(const link of links){
    try{
      const url=new URL(link);
      if(url.protocol==="https:"&&["linkedin.com","www.linkedin.com"].includes(url.hostname)
        &&/^\/(?:in|pub)\//.test(url.pathname))return url.href;
    }catch{/* Invalid links must never be submitted. */}
  }
  return "";
}
function sourceValue(profile:ResumeProfile,source:string):string {
  if(source==="contact.name")return profile.contact.name.trim();
  if(source==="contact.email")return profile.contact.email.trim();
  if(source==="contact.phone")return profile.contact.phone.trim();
  if(source==="contact.city")return profile.contact.city.trim();
  if(source==="linkedin")return linkedinLink(profile.contact.links);
  return "";
}
const safeKinds:Record<string,ApplicationFieldKind[]>={
  "contact.name":["text"],"contact.email":["email","text"],
  "contact.phone":["tel","text"],"contact.city":["text"],
  "linkedin":["url","text"],
};

/** Unknown, sensitive, legal, choice and freeform questions remain for the applicant. */
export function prepareApplicationDraft(
  profile:ResumeProfile,
  fields:ApplicationField[],
):ApplicationDraft {
  if(fields.length>80)throw new Error("Formulário acima do limite de campos permitido.");
  const seen=new Set<string>();
  const answers=fields.map(field=>{
    if(!field.id||field.id.length>120||seen.has(field.id)||field.label.length>180
      ||!field.label.trim()){
      throw new Error("Os campos do formulário são inválidos ou duplicados.");
    }
    seen.add(field.id);
    const source=fieldSource(field.label);
    const allowed=source!==null&&safeKinds[source].includes(field.kind);
    const value=allowed?sourceValue(profile,source):"";
    // Do not emit strings with control characters into browser inputs.
    const cleanValue=value.replace(/[\u0000-\u001f\u007f]/g," ").trim();
    const safe=Boolean(cleanValue)&&cleanValue.length<=600;
    return {
      id:field.id,label:field.label,kind:field.kind,required:Boolean(field.required),
      status:safe?"ready":"needs_review",
      value:safe?cleanValue:null,
      evidence:safe?source:null,
      reason:safe?null:
        ["checkbox","radio","select"].includes(field.kind)
          ?"Escolha ou consentimento exige confirmação da pessoa."
          :field.kind==="file"?"O anexo deve ser selecionado e conferido."
          :field.kind==="password"?"Credenciais nunca são preenchidas a partir do currículo."
          :"Informação não comprovada no perfil ou campo não reconhecido.",
    } satisfies ApplicationAnswer;
  });
  const readyCount=answers.filter(answer=>answer.status==="ready").length;
  return {
    status:readyCount===answers.length?"ready_for_review":"needs_information",
    fields:answers,readyCount,reviewCount:answers.length-readyCount,aiCalls:0,
  };
}

/** A representative local preview, NOT fields detected on an external ATS. */
export const PREVIEW_ONLY_FIELDS:ApplicationField[]=[
  {id:"full-name",label:"Nome completo",kind:"text",required:true},
  {id:"email",label:"E-mail",kind:"email",required:true},
  {id:"phone",label:"Telefone",kind:"tel",required:true},
  {id:"city",label:"Cidade",kind:"text"},
  {id:"linkedin",label:"LinkedIn",kind:"url"},
  {id:"salary",label:"Pretensão salarial",kind:"text"},
  {id:"privacy",label:"Aceite da política de privacidade",kind:"checkbox",required:true},
];
