/** The AI never authorizes or executes tools. Validate the backend plan fail-closed. */
export type PlannedToolStep = {
  tool:"job.search"|"job.assess"|"application.preview";
  state:"proposed";
  requires_confirmation:boolean;
  external_submission:false;
};
export type IntentToolProposal = {
  tool:"job.search";
  query:string;
  reason:string;
  needs_confirmation:true;
  executed:false;
  external_submission:false;
  model_calls:1;
  run_id:string;
  calls_used:number;
  calls_remaining:number;
  steps:PlannedToolStep[];
};
const UUID4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const expectedTools=["job.search","job.assess","application.preview"] as const;

export function reviewIntentTool(
 value:unknown, expectedRunId?:string, previewRequested?:boolean,
):IntentToolProposal {
  if(!value || typeof value!=="object" || Array.isArray(value))
    throw new Error("A IA não retornou uma sugestão válida.");
  const obj=value as Record<string,unknown>;
  if(obj.tool!=="job.search"||obj.needs_confirmation!==true||
     obj.executed!==false||obj.external_submission!==false||obj.model_calls!==1||
     typeof obj.query!=="string"||typeof obj.reason!=="string"||
     obj.query.trim().length<2||obj.query.length>80||
     obj.reason.trim().length<2||obj.reason.length>180||
     /https?:\/\/|www\.|[@<>\n\r{}]/i.test(obj.query)||
     typeof obj.run_id!=="string"||!UUID4.test(obj.run_id)||
     (expectedRunId!==undefined&&obj.run_id!==expectedRunId)||
     !Number.isInteger(obj.calls_used)||(obj.calls_used!==1&&obj.calls_used!==2)||
     obj.calls_remaining!==2-(obj.calls_used as number)||
     !Array.isArray(obj.steps)||obj.steps.length<2||obj.steps.length>3||
     (previewRequested!==undefined&&obj.steps.length!==(previewRequested?3:2))){
    throw new Error("Sugestão rejeitada: ação, orçamento ou parâmetros não autorizados.");
  }
  const steps:PlannedToolStep[]=obj.steps.map((raw,i)=>{
    if(!raw||typeof raw!=="object"||Array.isArray(raw))
      throw new Error("Etapa não autorizada.");
    const step=raw as Record<string,unknown>;
    if(step.tool!==expectedTools[i]||step.state!=="proposed"||
       step.external_submission!==false||
       step.requires_confirmation!==(i!==1)){
      throw new Error("O plano contém ferramenta, ordem ou permissão não autorizada.");
    }
    return {tool:step.tool as PlannedToolStep["tool"],state:"proposed",
      requires_confirmation:i!==1,external_submission:false};
  });
  return {
    tool:"job.search",query:obj.query.trim(),reason:obj.reason.trim(),
    needs_confirmation:true,executed:false,external_submission:false,model_calls:1,
    run_id:obj.run_id,calls_used:obj.calls_used as number,
    calls_remaining:obj.calls_remaining as number,steps,
  };
}
