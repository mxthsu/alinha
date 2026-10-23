"use client";
import {apiFetch} from "@/lib/api-fetch";
import {resolveApiOrigin} from "@/lib/api-origin";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, ExternalLink, Globe2, LoaderCircle, MapPin, Search, ShieldCheck, SlidersHorizontal, Wallet } from "lucide-react";
import { PlatformNav } from "@/components/platform-nav";
import { useOpportunityTracker } from "@/hooks/use-opportunity-tracker";
import { selectOpportunity } from "@/lib/career-handoff";
import { opportunityFingerprint } from "@/lib/opportunity-tracker";
import {evaluateVacancy,jobSource,titleRelevance,parseSavedJobPreferences,type SavedJobPreferences} from "@/lib/job-preferences";
import "./vagas.css";

type Job = {
  opportunity: {source:string; external_id:string; title:string; company:string;city:string|null;work_mode:string;contract_type:string;advertised_min_salary_brl:number|null;source_url:string|null};
  excerpt:string; description:string|null; employment_label:string|null; salary_label:string|null; missing_information:string[];
};
type Result = {jobs:Job[];source_name:string;source_url:string;description:string;limitations:string[]};
const api=resolveApiOrigin();

export default function Jobs() {
  const {items:tracked,save:saveOpportunity,storageError}=useOpportunityTracker();
  const [saveNotice,setSaveNotice]=useState("");
  const [keyword,setKeyword] = useState("");
  const [workMode,setWorkMode] = useState("remote");
  const [source,setSource] = useState("all");
  const [contract,setContract] = useState("any");
  const [city,setCity] = useState("");
  const [salary,setSalary] = useState("");
  const [storedPrefs,setStoredPrefs]=useState(false);
  const [prefsBusy,setPrefsBusy]=useState(false);
  const [prefsStatus,setPrefsStatus]=useState("");
  const [prefsError,setPrefsError]=useState("");
  const changedPrefs=useRef(false);
  // Read-only hydration: unapproved preferences remain temporary and never persist implicitly.
  useEffect(()=>{
    let active=true;
    void apiFetch(api+"/api/v1/community/settings",{cache:"no-store"})
      .then(async response=>{
        if(!response.ok)throw new Error("Configuração local indisponível.");
        return await response.json() as {job_preferences?:unknown};
      })
      .then(data=>{
        if(!active)return;
        const previous=parseSavedJobPreferences(data.job_preferences);
        if(!previous)return;
        setStoredPrefs(true);
        if(changedPrefs.current)return;
        setSource(previous.source);
        setWorkMode(previous.workMode);
        setContract(previous.contract);
        setCity(previous.city);
        setSalary(previous.salary);
      })
      .catch(()=>{ /* Searching without saved preferences must still work offline. */ });
    return ()=>{active=false;};
  },[]);
  async function updateSavedPreferences(clear:boolean){
    if(prefsBusy)return;
    setPrefsBusy(true);setPrefsError("");setPrefsStatus("");
    try{
      const choice:SavedJobPreferences|null=clear?null:parseSavedJobPreferences({
        source,workMode,contract,city:city.trim(),salary,
      });
      if(!clear&&!choice)throw new Error("Revise a cidade e o salário antes de salvar.");
      // Read the latest settings so toggles and provider options are not replaced by stale UI state.
      const response=await apiFetch(api+"/api/v1/community/settings",{cache:"no-store"});
      if(!response.ok)throw new Error("Não foi possível acessar a configuração local.");
      const current=await response.json() as Record<string,unknown>;
      const written=await apiFetch(api+"/api/v1/community/settings",{
        method:"PUT",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({...current,job_preferences:choice}),cache:"no-store",
      });
      if(!written.ok)throw new Error("Não foi possível atualizar as preferências locais.");
      const verified=await written.json() as {job_preferences?:unknown};
      if(clear?verified.job_preferences!==null:
        JSON.stringify(parseSavedJobPreferences(verified.job_preferences))!==JSON.stringify(choice)){
          throw new Error("A confirmação do salvamento não corresponde ao solicitado.");
      }
      setStoredPrefs(!clear);
      setPrefsStatus(clear?
        "Preferências salvas apagadas deste computador. Os filtros atuais continuam temporários.":
        "Preferências salvas apenas neste computador. Você pode apagá-las a qualquer momento.");
    }catch(cause){
      setPrefsError(cause instanceof Error?cause.message:"Não foi possível salvar suas escolhas.");
    }finally{setPrefsBusy(false);}
  }
  const [result,setResult] = useState<Result|null>(null);
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(false);
  const [page,setPage] = useState(1);
  const abort=useRef<AbortController|null>(null);
  const resultsRef=useRef<HTMLElement|null>(null);
  function revealMobileResults(){
    if(typeof window==="undefined"||!window.matchMedia("(max-width: 900px)").matches)return;
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(()=>resultsRef.current?.scrollIntoView({
      block:"start",behavior:reduced?"instant":"smooth",
    }));
  }
  const [searchedTerm,setSearchedTerm]=useState("");
  useEffect(()=>()=>abort.current?.abort(),[]);
  // Missing facts need confirmation; only proven incompatibilities are excluded.
  const filteredJobs=result?result.jobs.map(item=>({
    item,decision:evaluateVacancy(item,{workMode,contract,city,salary}),
  })).filter(({decision})=>decision.status!=="exclude")
    .sort((a,b)=>titleRelevance(b.item.opportunity.title,searchedTerm)-
                 titleRelevance(a.item.opportunity.title,searchedTerm)):[];
  const reviewCount=filteredJobs.filter(({decision})=>decision.status==="review").length;

  async function search(pageNumber:number){
    if(loading || keyword.trim().length<2) return;
    abort.current?.abort();setLoading(true);setError("");setResult(null);setPage(pageNumber);
    if(source==="himalayas" && workMode!=="remote"){
      setResult({jobs:[],source_name:"Himalayas",source_url:"https://himalayas.app",
        description:"Esta fonte inicial oferece apenas vagas remotas.",
        limitations:["Vagas híbridas e presenciais dependem de outras fontes autorizadas."]});
      setLoading(false);return;
    }
    const controller=new AbortController();abort.current=controller;
    try{
      const query=new URLSearchParams({q:keyword.trim(),page:String(pageNumber),remote_only:String(workMode==="remote"),source});
      const response=await apiFetch(api+"/api/v1/jobs/search?"+query.toString(),
        {signal:controller.signal,cache:"no-store"});
      const json=await response.json();
      if(!response.ok)throw new Error(typeof json.detail==="string"?json.detail:"Não foi possível consultar vagas.");
      setResult(json as Result);setSearchedTerm(keyword.trim());revealMobileResults();
    }catch(cause){
      if(!controller.signal.aborted){setError(cause instanceof Error?cause.message:"Falha de conexão.");revealMobileResults();}
    }finally{if(!controller.signal.aborted)setLoading(false);}
  }
  function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();void search(1);}
  return <div className="platform-shell">
    <PlatformNav/>
    <main className="platform-container vacancies">
      <header className="vacancies-heading">
        <span><Search size={16}/> DESCOBERTA DE OPORTUNIDADES</span>
        <h1>Encontre vagas que fazem sentido para você.</h1>
        <p>Pesquise oportunidades reais de fontes públicas. Você escolhe o que analisar e para onde deseja se candidatar.</p>
      </header>
      <div className="vacancies-agent-entry">
        <div><strong>Já tem currículo no Alinha?</strong><p>Deixe o agente sugerir buscas a partir do seu perfil profissional.</p></div>
        <Link href="/agente">Buscar com meu currículo <ArrowRight size={15}/></Link>
      </div>
      <div className="vacancies-layout">
        <form className="vacancies-filters" onSubmit={submit}>
          <div className="vacancies-filter-title"><SlidersHorizontal size={18}/> Suas preferências</div>
          <label>Cargo ou palavra-chave
            <input type="search" name="q" autoComplete="off" value={keyword} minLength={2} maxLength={80} required
              onChange={event=>setKeyword(event.target.value)} placeholder="Ex.: Engenharia de IA"/>
          </label>
          <label>Fonte de vagas
            <select name="source" value={source} onChange={event=>{changedPrefs.current=true;setSource(event.target.value);}}>
              <option value="all">Todas as fontes</option>
              <option value="gupy">Gupy · Brasil</option>
              <option value="lever">Lever · empresas no Brasil</option>
              <option value="github">Comunidades GitHub · Brasil</option>
              <option value="greenhouse">Greenhouse — empresas no Brasil</option>
              <option value="ashby">Ashby — empresas no Brasil</option>
              <option value="himalayas">Himalayas · remoto</option>
            </select>
          </label>
          <label>Modalidade
            <select name="workMode" value={workMode} onChange={event=>{changedPrefs.current=true;setWorkMode(event.target.value);}}>
              <option value="remote">Remoto</option><option value="hybrid">Híbrido</option><option value="onsite">Presencial</option>
            </select>
          </label>
          <label>Contrato desejado
            <select name="contract" value={contract} onChange={event=>{changedPrefs.current=true;setContract(event.target.value);}}>
              <option value="any">Não filtrar</option><option value="clt">CLT</option><option value="pj">PJ</option>
              <option value="internship">Estágio</option><option value="trainee">Trainee</option>
            </select>
          </label>
          <label>Cidade de preferência
            <input name="city" autoComplete="address-level2" value={city} maxLength={120} onChange={event=>{changedPrefs.current=true;setCity(event.target.value);}} placeholder="Ex.: Florianópolis, SC"/>
          </label>
          <label>Salário mínimo mensal pretendido (R$)
            <input type="number" name="salary" inputMode="numeric" value={salary} min={0} max={1000000} step={100}
              onChange={event=>{changedPrefs.current=true;setSalary(event.target.value);}} placeholder="Opcional"/>
          </label>
          <p className="vacancies-privacy"><ShieldCheck size={17}/> {storedPrefs?"Suas últimas preferências salvas foram recuperadas. Mudanças na tela só serão salvas ao confirmar.":"Suas preferências são temporárias até você escolher salvá-las."} Dados que a vaga não informa ficam pendentes de confirmação.</p>
          <button className="vacancies-search" disabled={loading||keyword.trim().length<2} type="submit">
            {loading?<LoaderCircle className="vacancies-loading-icon" size={17}/>:<Search size={17}/>}
            {loading?"Buscando…":"Buscar oportunidades"}
          </button>
          <div className="vacancies-preferences-store">
            <p>Salve modalidade, contrato, cidade, salário e fonte apenas se quiser reutilizá-los.
              A palavra-chave pesquisada não é salva.</p>
            <div>
              <button type="button" disabled={prefsBusy}
                onClick={()=>void updateSavedPreferences(false)}>Salvar preferências neste computador</button>
              {storedPrefs&&<button type="button" className="vacancies-preferences-clear" disabled={prefsBusy}
                onClick={()=>void updateSavedPreferences(true)}>Apagar preferências salvas</button>}
            </div>
            {prefsStatus&&<p role="status" className="vacancies-prefs-notice">{prefsStatus}</p>}
            {prefsError&&<p role="alert" className="vacancies-prefs-error">{prefsError}</p>}
          </div>
          <p className="vacancies-attribution">A pesquisa reúne fontes públicas selecionadas, incluindo comunidades brasileiras de vagas. Confira sempre o anúncio original, o vínculo e a localização.</p>
        </form>
        <section ref={resultsRef} className="vacancies-results" aria-live="polite" tabIndex={-1}>
          <div className="vacancies-results-head">
            <div><span>OPORTUNIDADES</span><h2>{result?String(filteredJobs.length)+" vagas para conferir":"Explore oportunidades"}</h2>
            {result&&<p className="vacancies-page-summary">Busca: {searchedTerm} · {filteredJobs.length} de {result.jobs.length} vagas nesta página
             {reviewCount>0?" · "+reviewCount+" com dados para confirmar":""}</p>}</div>
            <span className="vacancies-beta">Pesquisa experimental</span>
          </div>
          {error&&<div className="vacancies-error" role="alert">{error}</div>}
          {(saveNotice||storageError)&&<p className="vacancies-save-feedback" role="status">{storageError||saveNotice}</p>}
          {loading&&<div className="vacancies-empty"><LoaderCircle size={32} className="vacancies-loading-icon"/><h3>Consultando vagas…</h3></div>}
          {!loading&&!result&&!error&&<div className="vacancies-empty"><BriefcaseBusiness size={34}/><h3>Encontre o próximo passo.</h3><p>Informe um cargo para pesquisar vagas reais, sem demonstrações fictícias.</p></div>}
          {!loading&&result&&<>
            {filteredJobs.length===0&&<div className="vacancies-empty"><Search size={30}/><h3>Nenhuma vaga atende à busca e aos filtros</h3><p>Tente outro cargo ou ajuste modalidade, contrato e cidade. Dados ausentes não são tratados como incompatíveis.</p></div>}
            {filteredJobs.map(({item,decision})=>{
              const job=item.opportunity;
              const sourceInfo=jobSource(job.source);
              return <article className="vacancies-card" key={job.source+":"+job.external_id}>
                <div className="vacancies-card-top"><div><span>{job.company}</span><h3>{job.title}</h3></div><strong><Globe2 size={14}/> {job.work_mode==="remote"?"Remoto":job.work_mode==="hybrid"?"Híbrido":job.work_mode==="onsite"?"Presencial":"A confirmar"}</strong></div>
                <div className="vacancies-facts"><span><MapPin size={14}/> {job.city||"Localidade a confirmar"}</span>
                  {item.employment_label&&<span><BriefcaseBusiness size={14}/> {item.employment_label}</span>}
                  {item.salary_label&&<span><Wallet size={14}/> {item.salary_label}</span>}</div>
                {item.excerpt&&<p className="vacancies-excerpt">{item.excerpt}</p>}
                {(decision.pending.length>0||item.missing_information.length>0)&&
                  <p className="vacancies-review"><strong>Verifique antes de se candidatar:</strong>{" "}
                    {[...new Set([...decision.pending,...item.missing_information])].join("; ")}.</p>}
                <div className="vacancies-card-footer"><span>Fonte: {sourceInfo.url?
                     <a href={sourceInfo.url} target="_blank" rel="noopener noreferrer">{sourceInfo.label}</a>:
                     sourceInfo.label}</span>
                  <div className="vacancies-card-actions">
                    {job.source_url&&<Link href="/preparar" className="vacancies-prepare" onClick={()=>
                      selectOpportunity({title:job.title,company:job.company,url:job.source_url!,
                        source:job.source,excerpt:item.excerpt,description:item.description??undefined})
                    }>Preparar candidatura <ArrowRight size={14}/></Link>}
                    {job.source_url&&<button type="button"
                      disabled={tracked.some(saved=>opportunityFingerprint(saved.source,saved.sourceId,saved.url)===opportunityFingerprint(job.source,job.external_id,job.source_url!))}
                      onClick={async()=>{
                        const response=await saveOpportunity({title:job.title,company:job.company,url:job.source_url!,
                          source:job.source,sourceId:job.external_id});
                        setSaveNotice(response.message);
                      }}>
                      {tracked.some(saved=>opportunityFingerprint(saved.source,saved.sourceId,saved.url)===opportunityFingerprint(job.source,job.external_id,job.source_url!))?"Salva":"Salvar vaga"}
                    </button>}
                    {job.source_url&&<a className="vacancies-open" href={job.source_url} target="_blank" rel="noopener noreferrer">Ver vaga original <ExternalLink size={15}/></a>}
                  </div>
                </div>
              </article>;
            })}
            {result.jobs.length>0&&page<5&&<button type="button" className="vacancies-more" onClick={()=>void search(page+1)}>Próxima página <ArrowRight size={16}/></button>}
            <p className="vacancies-limits">{result.limitations.join(" ")}</p>
          </>}
        </section>
      </div>
      <div className="vacancies-next"><div><strong>Uma vaga chamou sua atenção?</strong><p>Compare seus requisitos com o currículo antes de prosseguir.</p></div><Link href="/preparar">Preparar candidatura <ArrowRight size={16}/></Link></div>
    </main>
  </div>;
}
