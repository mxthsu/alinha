"use client";
import {useMemo,useRef,useState,type FormEvent} from "react";
import Link from "next/link";
import {
  ArrowRight,BookmarkCheck,BriefcaseBusiness,Check,Download,ExternalLink,
  FilePlus2,FolderOpen,LayoutDashboard,LockKeyhole,Trash2,Upload,
} from "lucide-react";
import {PlatformNav} from "@/components/platform-nav";
import {useOpportunityTracker} from "@/hooks/use-opportunity-tracker";
import {selectOpportunity} from "@/lib/career-handoff";
import {safeJobUrl,TRACKER_LABELS,TRACKER_STATUSES,type TrackerStatus} from "@/lib/opportunity-tracker";
import "./candidaturas.css";

const formatter=new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"short",year:"numeric"});

export default function Applications(){
  const {items,loaded,storageError,save,setStatus,remove,clear,restore,backup}=useOpportunityTracker();
  const [title,setTitle]=useState("");
  const [company,setCompany]=useState("");
  const [url,setUrl]=useState("");
  const [message,setMessage]=useState("");
  const [messageOk,setMessageOk]=useState(false);
  const [adding,setAdding]=useState(false);
  const importInput=useRef<HTMLInputElement|null>(null);

  const grouped=useMemo(()=>Object.fromEntries(TRACKER_STATUSES.map(status=>[
    status,items.filter(item=>item.status===status),
  ])) as Record<TrackerStatus,typeof items>,[items]);

  function add(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const normalized=safeJobUrl(url);
    if(!normalized){
      setMessageOk(false);setMessage("Use um link público HTTPS, sem senha ou token de acesso.");return;
    }
    const host=new URL(normalized).hostname;
    const result=save({title,company,url:normalized,source:host,sourceId:null});
    setMessage(result.message);setMessageOk(result.ok);
    if(result.ok){setTitle("");setCompany("");setUrl("");setAdding(false);}
  }

  function download(){
    const blob=new Blob([backup()],{type:"application/json;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const element=document.createElement("a");
    element.href=url;element.download="alinha-vagas-salvas.json";element.click();
    URL.revokeObjectURL(url);
  }

  async function importFile(file:File|undefined){
    if(!file)return;
    if(file.size>320_000){setMessageOk(false);setMessage("Arquivo excede 320 KB.");return;}
    if(!window.confirm("Importar este arquivo substituirá a lista atual de oportunidades. Continuar?"))return;
    const result=restore(await file.text());
    setMessage(result.message);setMessageOk(result.ok);
  }

  function deleteAll(){
    if(window.confirm("Apagar todas as vagas salvas neste navegador? Essa ação não pode ser desfeita.")){
      const ok=clear();setMessageOk(ok);
      setMessage(ok?"Lista local apagada.":"Não foi possível apagar a lista local.");
    }
  }

  return <div className="platform-shell">
    <PlatformNav/>
    <main className="platform-container tracker">
      <header className="tracker-header">
        <div>
          <span className="tracker-kicker"><LayoutDashboard size={15}/> ORGANIZE SUAS OPORTUNIDADES</span>
          <h1>Suas candidaturas, no seu ritmo.</h1>
          <p>Salve vagas, acompanhe o andamento e mantenha tudo organizado. Os status são informados por você — o Alinha ainda não envia candidaturas.</p>
        </div>
        <button type="button" className="tracker-add" onClick={()=>setAdding(open=>!open)} aria-expanded={adding}>
          <FilePlus2 size={17}/> {adding?"Fechar formulário":"Adicionar oportunidade"}
        </button>
      </header>
      <div className="tracker-privacy"><LockKeyhole size={18}/>
        <span><strong>Somente neste navegador.</strong> O Community guarda cargo, empresa, link, data e status no armazenamento local, sem conta ou envio ao servidor. Exporte um backup antes de limpar dados do navegador.</span>
      </div>

      {adding&&<form className="tracker-form" onSubmit={add}>
        <div className="tracker-form-header"><strong>Adicionar vaga pelo link</strong><span>Nenhuma página será acessada ou extraída automaticamente.</span></div>
        <div className="tracker-fields">
          <label>Cargo
            <input required minLength={2} maxLength={180} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: Engenharia de IA"/>
          </label>
          <label>Empresa
            <input required minLength={2} maxLength={180} value={company} onChange={e=>setCompany(e.target.value)} placeholder="Nome da empresa"/>
          </label>
          <label>Link da oportunidade
            <input required type="url" maxLength={1800} value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://..."/>
          </label>
        </div>
        <div className="tracker-form-footer"><p>Você pode guardar links de plataformas de vagas sem usar scraping ou acessar contas de terceiros.</p>
          <button type="submit"><Check size={16}/> Salvar vaga</button></div>
      </form>}

      <div className="tracker-toolbar">
        <div><strong>{loaded?items.length:"—"}</strong><span> oportunidades acompanhadas</span></div>
        <div className="tracker-toolbar-actions">
          <span className="tracker-autosave">Salvo automaticamente neste navegador</span>
          <details className="tracker-backup-menu">
            <summary>Backup e dados</summary>
            <div className="tracker-backup-actions">
              <button type="button" onClick={download} disabled={!loaded}><Download size={16}/> Exportar backup JSON</button>
              <input ref={importInput} type="file" accept=".json,application/json" hidden
                onChange={e=>{void importFile(e.target.files?.[0]);e.target.value="";}}/>
              <button type="button" onClick={()=>importInput.current?.click()}><Upload size={16}/> Restaurar backup</button>
              {items.length>0&&<button type="button" className="tracker-danger" onClick={deleteAll}><Trash2 size={16}/> Apagar todos os dados</button>}
            </div>
          </details>
        </div>
      </div>
      {(message||storageError)&&<p role="status" className={"tracker-message"+(!messageOk||storageError?" tracker-message-error":"")}>{storageError||message}</p>}

      {loaded&&items.length===0&&<div className="tracker-empty">
        <BookmarkCheck size={33}/>
        <h2>Seu acompanhamento começa por uma oportunidade.</h2>
        <p>Pesquise vagas no Alinha ou adicione manualmente um link de qualquer fonte de sua preferência.</p>
        <div><Link href="/vagas">Encontrar vagas <ArrowRight size={16}/></Link>
          <button type="button" onClick={()=>setAdding(true)}>Adicionar pelo link</button></div>
      </div>}

      {items.length>0&&<div className="tracker-board" aria-label="Quadro de oportunidades">
        {TRACKER_STATUSES.map(status=><section className="tracker-column" key={status}>
          <header><h2>{TRACKER_LABELS[status]}</h2><span>{grouped[status].length}</span></header>
          <div className="tracker-column-content">
            {grouped[status].length===0&&<p className="tracker-column-empty">Nenhuma oportunidade aqui.</p>}
            {grouped[status].map(job=><article className="tracker-card" key={job.id}>
              <div className="tracker-card-head"><span>{job.company}</span><button type="button"
                onClick={()=>{if(window.confirm("Remover esta vaga do acompanhamento?"))remove(job.id);}}
                aria-label={"Remover "+job.title}><Trash2 size={15}/></button></div>
              <h3>{job.title}</h3>
              <p className="tracker-card-date">Salva em {formatter.format(new Date(job.addedAt))}</p>
              <p className="tracker-card-origin">Origem: {job.source==="himalayas"?"Himalayas":job.source}</p>
              <a href={job.url} target="_blank" rel="noopener noreferrer" className="tracker-source">
                <ExternalLink size={14}/> Abrir vaga original
              </a>
              <Link className="tracker-prepare-link" href="/preparar" onClick={()=>selectOpportunity({
                title:job.title,company:job.company,url:job.url,source:job.source,excerpt:"",
              })}>Preparar para esta vaga <ArrowRight size={14}/></Link>
              <label>Atualizar etapa
                <select value={job.status} onChange={e=>{setStatus(job.id,e.target.value as TrackerStatus);}}>
                  {TRACKER_STATUSES.map(option=><option key={option} value={option}>{TRACKER_LABELS[option]}</option>)}
                </select>
              </label>
            </article>)}
          </div>
        </section>)}
      </div>}

      <div className="tracker-next">
        <div><BriefcaseBusiness size={21}/><span><strong>Próximo passo</strong><small>Prepare seu currículo para uma vaga antes de enviar a candidatura.</small></span></div>
        <Link href="/preparar">Preparar candidatura <ArrowRight size={16}/></Link>
      </div>
      <p className="tracker-footnote"><FolderOpen size={15}/> Os estágios deste quadro representam o acompanhamento informado pelo usuário. Nenhuma candidatura, entrevista ou proposta é confirmada automaticamente pela plataforma de origem.</p>
    </main>
  </div>;
}
