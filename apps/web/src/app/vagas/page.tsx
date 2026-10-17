"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, ExternalLink, Globe2, LoaderCircle, MapPin, Search, ShieldCheck, SlidersHorizontal, Wallet } from "lucide-react";
import { PlatformNav } from "@/components/platform-nav";
import { useOpportunityTracker } from "@/hooks/use-opportunity-tracker";
import { selectOpportunity } from "@/lib/career-handoff";
import { opportunityFingerprint } from "@/lib/opportunity-tracker";
import "./vagas.css";

type Job = {
  opportunity: {source:string; external_id:string; title:string; company:string;city:string|null;work_mode:string;contract_type:string;advertised_min_salary_brl:number|null;source_url:string|null};
  excerpt:string; employment_label:string|null; salary_label:string|null; missing_information:string[];
};
type Result = {jobs:Job[];source_name:string;source_url:string;description:string;limitations:string[]};
const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Jobs() {
  const {items:tracked,save:saveOpportunity,storageError}=useOpportunityTracker();
  const [saveNotice,setSaveNotice]=useState("");
  const [keyword,setKeyword] = useState("");
  const [workMode,setWorkMode] = useState("remote");
  const [source,setSource] = useState("all");
  const [contract,setContract] = useState("any");
  const [city,setCity] = useState("");
  const [salary,setSalary] = useState("");
  const [result,setResult] = useState<Result|null>(null);
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(false);
  const [page,setPage] = useState(1);
  const abort=useRef<AbortController|null>(null);

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
      const response=await fetch(api+"/api/v1/jobs/search?"+query.toString(),
        {signal:controller.signal,cache:"no-store"});
      const json=await response.json();
      if(!response.ok)throw new Error(typeof json.detail==="string"?json.detail:"Não foi possível consultar vagas.");
      setResult(json as Result);
    }catch(cause){
      if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:"Falha de conexão.");
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
            <input type="search" value={keyword} minLength={2} maxLength={80} required
              onChange={event=>setKeyword(event.target.value)} placeholder="Ex.: Engenharia de IA"/>
          </label>
          <label>Fonte de vagas
            <select value={source} onChange={event=>setSource(event.target.value)}>
              <option value="all">Todas as fontes</option>
              <option value="gupy">Gupy · Brasil</option>
              <option value="lever">Lever · empresas no Brasil</option>
              <option value="himalayas">Himalayas · remoto</option>
            </select>
          </label>
          <label>Modalidade
            <select value={workMode} onChange={event=>setWorkMode(event.target.value)}>
              <option value="remote">Remoto</option><option value="hybrid">Híbrido</option><option value="onsite">Presencial</option>
            </select>
          </label>
          <label>Contrato desejado
            <select value={contract} onChange={event=>setContract(event.target.value)}>
              <option value="any">Não filtrar</option><option value="clt">CLT</option><option value="pj">PJ</option>
              <option value="internship">Estágio</option><option value="trainee">Trainee</option>
            </select>
          </label>
          <label>Cidade de preferência
            <input value={city} maxLength={120} onChange={event=>setCity(event.target.value)} placeholder="Ex.: Florianópolis, SC"/>
          </label>
          <label>Salário mínimo mensal pretendido (R$)
            <input type="number" value={salary} min={0} max={1000000} step={100}
              onChange={event=>setSalary(event.target.value)} placeholder="Opcional"/>
          </label>
          <p className="vacancies-privacy"><ShieldCheck size={17}/> Preferências temporárias. Dados que a vaga não informa ficam pendentes de confirmação.</p>
          <button className="vacancies-search" disabled={loading||keyword.trim().length<2} type="submit">
            {loading?<LoaderCircle className="vacancies-loading-icon" size={17}/>:<Search size={17}/>}
            {loading?"Buscando…":"Buscar oportunidades"}
          </button>
          <p className="vacancies-attribution">Fontes: Gupy (experimental), Lever (Brasil) e <a href="https://himalayas.app" target="_blank" rel="noopener noreferrer">Himalayas <ExternalLink size={12}/></a>. Confira os dados na vaga original.</p>
        </form>
        <section className="vacancies-results" aria-live="polite">
          <div className="vacancies-results-head">
            <div><span>OPORTUNIDADES</span><h2>{result?String(result.jobs.length)+" vagas nesta página":"Explore oportunidades"}</h2></div>
            <span className="vacancies-beta">Pesquisa experimental</span>
          </div>
          {error&&<div className="vacancies-error" role="alert">{error}</div>}
          {(saveNotice||storageError)&&<p className="vacancies-save-feedback" role="status">{storageError||saveNotice}</p>}
          {loading&&<div className="vacancies-empty"><LoaderCircle size={32} className="vacancies-loading-icon"/><h3>Consultando vagas…</h3></div>}
          {!loading&&!result&&!error&&<div className="vacancies-empty"><BriefcaseBusiness size={34}/><h3>Encontre o próximo passo.</h3><p>Informe um cargo para pesquisar vagas reais, sem demonstrações fictícias.</p></div>}
          {!loading&&result&&<>
            {result.jobs.length===0&&<div className="vacancies-empty"><Search size={30}/><h3>Nenhuma vaga nesta consulta</h3><p>{result.description} Tente outro cargo ou modalidade.</p></div>}
            {result.jobs.map(item=>{
              const job=item.opportunity;
              const contractPending=contract!=="any"&&job.contract_type!==contract;
              const salaryPending=salary!==""&&(job.advertised_min_salary_brl===null||job.advertised_min_salary_brl<Number(salary));
              if(workMode!=="remote" && job.work_mode!==workMode) return null;
              return <article className="vacancies-card" key={job.source+":"+job.external_id}>
                <div className="vacancies-card-top"><div><span>{job.company}</span><h3>{job.title}</h3></div><strong><Globe2 size={14}/> {job.work_mode==="remote"?"Remoto":job.work_mode==="hybrid"?"Híbrido":job.work_mode==="onsite"?"Presencial":"A confirmar"}</strong></div>
                <div className="vacancies-facts"><span><MapPin size={14}/> {job.city||"Brasil"}</span>
                  {item.employment_label&&<span><BriefcaseBusiness size={14}/> {item.employment_label}</span>}
                  {item.salary_label&&<span><Wallet size={14}/> {item.salary_label}</span>}</div>
                {item.excerpt&&<p className="vacancies-excerpt">{item.excerpt}</p>}
                {(contractPending||salaryPending||city.trim()!==""||item.missing_information.length>0)&&
                  <p className="vacancies-review">A confirmar: {contractPending?"vínculo pretendido; ":""}
                    {salaryPending?"salário mínimo mensal; ":""}{city.trim()?"localidade; ":""}
                    {item.missing_information.join("; ")}.</p>}
                <div className="vacancies-card-footer"><span>Fonte: <a href={job.source==="gupy"?"https://portal.gupy.io/":job.source==="lever"?"https://jobs.lever.co/Flex":"https://himalayas.app"} target="_blank" rel="noopener noreferrer">{job.source==="gupy"?"Gupy":job.source==="lever"?"Lever":"Himalayas"}</a></span>
                  <div className="vacancies-card-actions">
                    {job.source_url&&<Link href="/preparar" className="vacancies-prepare" onClick={()=>
                      selectOpportunity({title:job.title,company:job.company,url:job.source_url!,
                        source:job.source,excerpt:item.excerpt})
                    }>Preparar candidatura <ArrowRight size={14}/></Link>}
                    {job.source_url&&<button type="button"
                      disabled={tracked.some(saved=>opportunityFingerprint(saved.source,saved.sourceId,saved.url)===opportunityFingerprint(job.source,job.external_id,job.source_url!))}
                      onClick={()=>{
                        const response=saveOpportunity({title:job.title,company:job.company,url:job.source_url!,
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
