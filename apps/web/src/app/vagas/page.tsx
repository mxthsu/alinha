"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, ExternalLink, Globe2, LoaderCircle, MapPin, Search, ShieldCheck, SlidersHorizontal, Wallet } from "lucide-react";
import { PlatformNav } from "@/components/platform-nav";
import "./vagas.css";

type Job = {
  opportunity: {source:string; external_id:string; title:string; company:string;work_mode:string;contract_type:string;advertised_min_salary_brl:number|null;source_url:string|null};
  excerpt:string; employment_label:string|null; salary_label:string|null; missing_information:string[];
};
type Result = {jobs:Job[];source_name:string;source_url:string;description:string;limitations:string[]};
const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Jobs() {
  const [keyword,setKeyword] = useState("");
  const [workMode,setWorkMode] = useState("remote");
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
    if(workMode!=="remote"){
      setResult({jobs:[],source_name:"Himalayas",source_url:"https://himalayas.app",
        description:"Esta fonte inicial oferece apenas vagas remotas.",
        limitations:["Vagas híbridas e presenciais dependem de futuras fontes brasileiras autorizadas."]});
      setLoading(false);return;
    }
    const controller=new AbortController();abort.current=controller;
    try{
      const query=new URLSearchParams({q:keyword.trim(),page:String(pageNumber),remote_only:"true"});
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
        <p>Pesquise oportunidades reais de uma fonte pública. Você escolhe o que analisar e para onde deseja se candidatar.</p>
      </header>
      <div className="vacancies-layout">
        <form className="vacancies-filters" onSubmit={submit}>
          <div className="vacancies-filter-title"><SlidersHorizontal size={18}/> Suas preferências</div>
          <label>Cargo ou palavra-chave
            <input type="search" value={keyword} minLength={2} maxLength={80} required
              onChange={event=>setKeyword(event.target.value)} placeholder="Ex.: Engenharia de IA"/>
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
          <p className="vacancies-attribution">Fonte inicial: <a href="https://himalayas.app" target="_blank" rel="noopener noreferrer">Himalayas <ExternalLink size={12}/></a>. Vagas remotas abertas a candidatos no Brasil.</p>
        </form>
        <section className="vacancies-results" aria-live="polite">
          <div className="vacancies-results-head">
            <div><span>OPORTUNIDADES</span><h2>{result?String(result.jobs.length)+" vagas nesta página":"Explore oportunidades"}</h2></div>
            <span className="vacancies-beta">Pesquisa experimental</span>
          </div>
          {error&&<div className="vacancies-error" role="alert">{error}</div>}
          {loading&&<div className="vacancies-empty"><LoaderCircle size={32} className="vacancies-loading-icon"/><h3>Consultando vagas…</h3></div>}
          {!loading&&!result&&!error&&<div className="vacancies-empty"><BriefcaseBusiness size={34}/><h3>Encontre o próximo passo.</h3><p>Informe um cargo para pesquisar vagas reais, sem demonstrações fictícias.</p></div>}
          {!loading&&result&&<>
            {result.jobs.length===0&&<div className="vacancies-empty"><Search size={30}/><h3>Nenhuma vaga nesta consulta</h3><p>{result.description} Tente outro cargo ou modalidade.</p></div>}
            {result.jobs.map(item=>{
              const job=item.opportunity;
              const contractPending=contract!=="any"&&job.contract_type!==contract;
              const salaryPending=salary!==""&&(job.advertised_min_salary_brl===null||job.advertised_min_salary_brl<Number(salary));
              return <article className="vacancies-card" key={job.source+":"+job.external_id}>
                <div className="vacancies-card-top"><div><span>{job.company}</span><h3>{job.title}</h3></div><strong><Globe2 size={14}/> Remoto</strong></div>
                <div className="vacancies-facts"><span><MapPin size={14}/> Disponível no Brasil</span>
                  {item.employment_label&&<span><BriefcaseBusiness size={14}/> {item.employment_label}</span>}
                  {item.salary_label&&<span><Wallet size={14}/> {item.salary_label}</span>}</div>
                {item.excerpt&&<p className="vacancies-excerpt">{item.excerpt}</p>}
                {(contractPending||salaryPending||city.trim()!==""||item.missing_information.length>0)&&
                  <p className="vacancies-review">A confirmar: {contractPending?"vínculo pretendido; ":""}
                    {salaryPending?"salário mínimo mensal; ":""}{city.trim()?"localidade; ":""}
                    {item.missing_information.join("; ")}.</p>}
                <div className="vacancies-card-footer"><span>Fonte: <a href="https://himalayas.app" target="_blank" rel="noopener noreferrer">Himalayas</a></span>
                  {job.source_url&&<a className="vacancies-open" href={job.source_url} target="_blank" rel="noopener noreferrer">Ver vaga original <ExternalLink size={15}/></a>}
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
