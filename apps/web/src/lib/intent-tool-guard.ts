/** Untrusted model output is a proposal, never a tool execution authorization. */
export type IntentToolProposal = {
  tool:"job.search";
  query:string;
  reason:string;
  needs_confirmation:true;
  executed:false;
  external_submission:false;
  model_calls:1;
};
export function reviewIntentTool(value:unknown):IntentToolProposal {
  if(!value || typeof value!=="object" || Array.isArray(value))
    throw new Error("A IA não retornou uma sugestão válida.");
  const obj=value as Record<string,unknown>;
  if(obj.tool!=="job.search"||obj.needs_confirmation!==true||
     obj.executed!==false||obj.external_submission!==false||obj.model_calls!==1||
     typeof obj.query!=="string"||typeof obj.reason!=="string"||
     obj.query.trim().length<2||obj.query.length>80||
     obj.reason.trim().length<2||obj.reason.length>180||
     /https?:\/\/|www\.|[@<>\n\r{}]/i.test(obj.query)){
    throw new Error("Sugestão rejeitada: ação ou parâmetros não autorizados.");
  }
  return {
    tool:"job.search",query:obj.query.trim(),reason:obj.reason.trim(),
    needs_confirmation:true,executed:false,external_submission:false,model_calls:1,
  };
}
