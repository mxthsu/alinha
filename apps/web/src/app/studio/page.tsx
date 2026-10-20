"use client";
import {resolveApiOrigin} from "@/lib/api-origin";

import { useEffect, useRef, useState, type ChangeEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { clearResumeDraft, hasResumeContent, loadResumeDraft, saveResumeDraft,
  type ResumeProfile, type ResumeTemplate } from "@/lib/career-workspace";
import Link from "next/link";
import {
  ArrowRight, BriefcaseBusiness, Check, ChevronDown, ChevronLeft, ChevronRight,
  Download, Eye, FileText, FolderOpen, GraduationCap, LayoutTemplate,
  ListChecks, Plus, ShieldCheck, Trash2, UploadCloud, UserRound,
} from "lucide-react";
import "./studio.css";

type Resume = ResumeProfile;
type Template = ResumeTemplate;
type Contact = Resume["contact"];
type Experience = { role: string; organization: string; period: string; highlights: string[] };
type Education = { course: string; institution: string; period: string };
type Project = { title: string; description: string; link: string };
type Pane = "informacoes" | "experiencias" | "formacao" | "projetos" | "habilidades" | "estilo";
type ImportedDraft = { profile: Resume; source_text: string; unassigned_lines: string[]; warnings: string[]; requires_confirmation: boolean };
const blank: Resume = {
  schema_version: 1, contact: { name: "", headline: "", email: "", phone: "", city: "", links: [] },
  summary: "", experiences: [], education: [], projects: [], skills: [], languages: [],
};
const panes: { id: Pane; label: string; icon: typeof UserRound }[] = [
  { id: "informacoes", label: "Informações", icon: UserRound },
  { id: "experiencias", label: "Experiências", icon: BriefcaseBusiness },
  { id: "formacao", label: "Formação", icon: GraduationCap },
  { id: "projetos", label: "Projetos", icon: FolderOpen },
  { id: "habilidades", label: "Competências", icon: ListChecks },
  { id: "estilo", label: "Modelos e estilo", icon: LayoutTemplate },
];
const paneDescriptions: Record<Pane, string> = {
  informacoes: "Apresente quem você é e como entrar em contato.",
  experiencias: "Descreva suas experiências com atividades e resultados reais.",
  formacao: "Inclua formações que façam parte da sua trajetória.",
  projetos: "Mostre projetos relevantes e o que você desenvolveu.",
  habilidades: "Liste suas competências e os idiomas que conhece.",
  estilo: "Escolha como seu documento será apresentado.",
};
function Field({ label, value, onChange, multiline = false, hint }: {
  label: string; value: string; onChange: (value: string) => void; multiline?: boolean; hint?: string;
}) {
  return <label className="studio-field"><span>{label}</span>
    {multiline ? <textarea value={value} rows={4} onChange={e => onChange(e.target.value)} placeholder={hint} maxLength={22000}/>
      : <input value={value} onChange={e => onChange(e.target.value)} placeholder={hint} maxLength={600}/>}
  </label>;
}
function Preview({ profile, template }: { profile: Resume; template: Template }) {
  const contact = profile.contact;
  return <div className={"studio-sheet studio-sheet-" + template} aria-label="Prévia do currículo">
    <div className="studio-sheet-header"><h2>{contact.name || "Seu nome"}</h2>
      <div className="studio-sheet-role">{contact.headline || "Título profissional"}</div>
      <p>{[contact.email, contact.phone, contact.city, ...contact.links].filter(Boolean).join(" · ")}</p>
    </div>
    {profile.summary && <section><h3>Resumo profissional</h3><p>{profile.summary}</p></section>}
    {profile.experiences.length > 0 && <section><h3>Experiência profissional</h3>
      {profile.experiences.map((exp,i) => <article key={i}><div className="studio-sheet-line"><b>{[exp.role, exp.organization].filter(Boolean).join(" — ")}</b><span>{exp.period}</span></div>
        {exp.highlights.some(Boolean) && <ul className="studio-sheet-highlights">
          {exp.highlights.filter(Boolean).map((h,j) => <li key={j}>{h}</li>)}
        </ul>}</article>)}
    </section>}
    {profile.education.length > 0 && <section><h3>Formação</h3>{profile.education.map((ed,i) =>
      <article key={i}><div className="studio-sheet-line"><b>{[ed.course,ed.institution].filter(Boolean).join(" — ")}</b><span>{ed.period}</span></div></article>)}</section>}
    {profile.projects.length > 0 && <section><h3>Projetos</h3>{profile.projects.map((p,i) =>
      <article key={i}><b>{p.title}</b><p>{p.description}</p>{p.link && <p>{p.link}</p>}</article>)}</section>}
    {profile.skills.filter(Boolean).length > 0 && <section><h3>Competências</h3><p>{profile.skills.filter(Boolean).join(", ")}</p></section>}
    {profile.languages.filter(Boolean).length > 0 && <section><h3>Idiomas</h3><p>{profile.languages.filter(Boolean).join(", ")}</p></section>}
    {!contact.name && !profile.summary && !profile.experiences.length && <p className="studio-empty-preview">Preencha os campos para criar seu currículo.</p>}
  </div>;
}
export default function Studio() {
  const router=useRouter();
  const [hydrated,setHydrated]=useState(false);
  const [draftStatus,setDraftStatus]=useState("Carregando rascunho...");
  const [profile, setProfile] = useState<Resume>(blank);
  const [pane, setPane] = useState<Pane>("informacoes");
  const [template, setTemplate] = useState<Template>("classico");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const upload = useRef<HTMLInputElement>(null);
  const resumeUpload = useRef<HTMLInputElement>(null);
  const paneTabs = useRef<HTMLDivElement>(null);
  const [importError, setImportError] = useState("");
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [canUndoImport, setCanUndoImport] = useState(false);
  const [unassignedImportLines, setUnassignedImportLines] = useState<string[]>([]);
  const previousProfile = useRef<Resume | null>(null);
  const api=resolveApiOrigin();
  useEffect(()=>{
    const list=paneTabs.current;
    if(!list||!window.matchMedia("(max-width: 780px)").matches)return;
    const current=list.querySelector<HTMLElement>("button[aria-current='step']");
    if(!current)return;
    const left=current.offsetLeft-list.offsetLeft-
      Math.max(0,(list.clientWidth-current.clientWidth)/2);
    list.scrollTo({left:Math.max(0,left),behavior:
      window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});
  },[pane]);

  useEffect(()=>{
    let active=true;
    loadResumeDraft().then(draft=>{
      if(!active)return;
      if(draft){setProfile(draft.profile);setTemplate(draft.template);setDraftStatus("Rascunho recuperado");}
      else setDraftStatus("Salvamento automático neste dispositivo");
      setHydrated(true);
    }).catch(()=>{
      if(!active)return;
      setDraftStatus("Armazenamento local indisponível. Faça um backup.");
      setHydrated(true);
    });
    return ()=>{active=false;};
  },[]);

  useEffect(()=>{
    if(!hydrated)return;
    const timer=window.setTimeout(()=>{
      const operation=hasResumeContent(profile)
        ? saveResumeDraft(profile,template)
        : clearResumeDraft();
      void operation.then(()=>setDraftStatus(hasResumeContent(profile)
        ?"Salvo automaticamente neste dispositivo":"Nenhum currículo salvo"))
        .catch(()=>setDraftStatus("Não foi possível salvar. Exporte um backup."));
    },600);
    return ()=>window.clearTimeout(timer);
  },[profile,template,hydrated]);

  async function goPrepare(event:MouseEvent<HTMLAnchorElement>){
    event.preventDefault();
    try{
      if(hasResumeContent(profile))await saveResumeDraft(profile,template);
      else await clearResumeDraft();
      router.push("/preparar");
    }catch{setError("Não foi possível salvar seu currículo antes de continuar.");}
  }

  async function eraseLocalDraft(){
    if(!window.confirm("Apagar o currículo salvo neste dispositivo e limpar o editor? Essa ação não pode ser desfeita."))return;
    try {
      await clearResumeDraft();
      previousProfile.current=null;setCanUndoImport(false);
      setProfile(blank);setTemplate("classico");setUnassignedImportLines([]);
      setImportNotice(null);setPane("informacoes");setDraftStatus("Rascunho apagado");
      setSuccess("Currículo apagado deste dispositivo.");
    }catch{setError("Não foi possível apagar o rascunho local.");}
  }


  function update<K extends keyof Resume>(key: K, value: Resume[K]) {
    previousProfile.current = null; setCanUndoImport(false);
    setDraftStatus("Salvando alterações...");
    setProfile(prev => ({ ...prev, [key]: value }));
  }
  function contact(key: keyof Contact, value: string) {
    previousProfile.current = null; setCanUndoImport(false);
    setDraftStatus("Salvando alterações...");
    setProfile(prev => ({ ...prev, contact: { ...prev.contact, [key]: key === "links" ? value.split("\n") : value } }));
  }
  function changeList<T extends Experience | Education | Project>(key: "experiences" | "education" | "projects", i: number, field: keyof T, value: string) {
    const list = profile[key] as T[];
    const changed = list.map((item,j) => j === i ? { ...item, [field]: field === "highlights" ? value.split("\n") : value } : item);
    previousProfile.current = null; setCanUndoImport(false);
    setDraftStatus("Salvando alterações...");
    setProfile(prev => ({ ...prev, [key]: changed }));
  }
  function remove(key: "experiences" | "education" | "projects", i: number) {
    previousProfile.current = null; setCanUndoImport(false);
    setDraftStatus("Salvando alterações...");
    setProfile(prev => ({ ...prev, [key]: (prev[key] as unknown[]).filter((_,j) => j !== i) }));
  }
  function messages() { setError(""); setSuccess(""); }
  function saveBlob(blob: Blob, name: string) {
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=u; a.download=name; document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(u), 1000);
  }
  function saveJson() {
    messages();
    saveBlob(new Blob([JSON.stringify(profile,null,2)],{type:"application/json"}),"alinha-perfil.json");
    setSuccess("Backup exportado. Seu currículo também é salvo automaticamente neste dispositivo.");
  }
  async function loadJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    messages();
    try {
      if (file.size > 100000) throw new Error("O arquivo JSON é muito grande.");
      const data: unknown = JSON.parse(await file.text());
      const response = await fetch(api+"/api/v1/resumes/structured/preview/text",{
        method:"POST", headers:{"Content-Type":"application/json"},body:JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Arquivo incompatível com o perfil Alinha versão 1.");
      const normalized = await response.json() as { profile: Resume };
      previousProfile.current = profile; setCanUndoImport(true);
      setDraftStatus("Salvando currículo importado...");
      setProfile(normalized.profile); setImportError(""); setUnassignedImportLines([]); setImportNotice("Perfil JSON carregado. Revise os campos antes de exportar."); setPane("informacoes");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha na importação."); }
    finally { event.target.value=""; }
  }
  async function importResume(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (hasResumeContent(profile) && !window.confirm(
      "Substituir o currículo atual? Você poderá desfazer a importação enquanto permanecer nesta tela. Exporte um backup antes de trocar, se quiser conservar o perfil."
    )) {
      event.target.value = "";
      return;
    }
    messages(); setImportError(""); setBusy("import");
    try {
      if (!/\.(pdf|docx|txt)$/i.test(file.name) || file.size > 3 * 1024 * 1024 || !file.size) {
        throw new Error("Envie um PDF, DOCX ou TXT de até 3 MB.");
      }
      const uploadData = new FormData();
      uploadData.append("file", file);
      const response = await fetch(api + "/api/v1/resumes/structured/import/upload", { method:"POST", body: uploadData });
      const payload = await response.json();
      if (!response.ok) throw new Error(typeof payload.detail === "string" ? payload.detail : "Falha ao ler currículo.");
      const result = payload as ImportedDraft;
      const identified = Number(Boolean(result.profile.contact.name)) + Number(Boolean(result.profile.summary)) +
        result.profile.experiences.length + result.profile.education.length + result.profile.projects.length +
        result.profile.skills.length + result.profile.languages.length;
      if (!identified) throw new Error("Não foi possível reconhecer informações deste currículo. Tente um PDF com texto selecionável, DOCX ou TXT.");
      previousProfile.current = profile; setCanUndoImport(true);
      setDraftStatus("Salvando currículo importado...");
      setProfile(result.profile);
      setUnassignedImportLines(result.unassigned_lines);
      setPane("informacoes");
      setImportNotice("Currículo importado. Confira e edite os campos.");
      window.requestAnimationFrame(() => document.getElementById("studio-editor")?.scrollIntoView({
        behavior: "smooth", block: "start",
      }));
    } catch (cause) {
      setImportError(cause instanceof Error ? cause.message : "Falha na importação.");
    } finally { setBusy(""); event.target.value = ""; }
  }
  function undoImport() {
    if (!previousProfile.current) return;
    setDraftStatus("Salvando alterações...");
    setProfile(previousProfile.current);
    previousProfile.current = null; setCanUndoImport(false);
    setImportNotice(null);
    setUnassignedImportLines([]);
    setPane("informacoes");
  }
  async function exportDocx() {
    messages(); setBusy("docx");
    try {
      const r=await fetch(api+"/api/v1/resumes/structured/export/docx",{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({profile,template}),
      });
      if (!r.ok) { const body=await r.json(); throw new Error(typeof body.detail==="string"?body.detail:"Falha ao exportar."); }
      saveBlob(await r.blob(),"alinha-curriculo.docx");
      setSuccess("Seu DOCX foi gerado com o conteúdo que você escreveu.");
    } catch(e) { setError(e instanceof Error?e.message:"Falha na exportação."); }
    finally { setBusy(""); }
  }
  const paneIndex = panes.findIndex(item => item.id === pane);
  function navigatePane(offset: number) {
    const next = panes[paneIndex + offset];
    if (!next) return;
    setPane(next.id);
    messages();
    document.getElementById("studio-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  return <div className="studio-app">
    <header className="studio-topbar">
      <div className="studio-topbar-inner">
        <div className="studio-brand-area">
          <Link href="/" className="studio-logo" aria-label="Alinha — página inicial">alinha<span>.</span></Link>
          <div className="studio-title"><span>EDITOR DE CURRÍCULO</span><strong>Studio</strong></div>
        </div>
        <nav className="studio-global-links" aria-label="Navegação">
          <Link href="/">Início</Link>
          <Link href="/preparar" onClick={event=>void goPrepare(event)}>Preparar candidatura <ArrowRight size={15}/></Link>
        </nav>
        <div className="studio-top-actions">
          <input type="file" hidden accept=".json,application/json" ref={upload} onChange={loadJson}/>
          <input type="file" hidden accept=".pdf,.docx,.txt" ref={resumeUpload} onChange={importResume}/>
          <button type="button" className="studio-upload-action" disabled={Boolean(busy)} onClick={()=>resumeUpload.current?.click()}>
            <UploadCloud size={17}/> <span>{busy==="import" ? "Importando…" : "Importar currículo"}</span>
          </button>
          <details className="studio-file-menu">
            <summary aria-label="Opções de perfil">Opções <ChevronDown size={16}/></summary>
            <div className="studio-file-options">
              <button type="button" onClick={()=>upload.current?.click()}><FolderOpen size={16}/> Importar perfil JSON</button>
              <button type="button" onClick={saveJson}><Download size={16}/> Salvar perfil JSON</button>
              <button type="button" className="studio-delete-action" onClick={()=>void eraseLocalDraft()}><Trash2 size={16}/> Apagar rascunho local</button>
            </div>
          </details>
          <button type="button" className="studio-primary" disabled={Boolean(busy)} onClick={exportDocx}>
            <Download size={17}/> {busy==="docx"?"Exportando…":"Exportar DOCX"}
          </button>
        </div>
      </div>
    </header>
    <div className="studio-layout">
      <nav className="studio-sidebar" aria-label="Seções do currículo">
        <div className="studio-sidebar-header"><strong>Seu currículo</strong><span>Edite por seções</span></div>
        <div className="studio-sidebar-steps" ref={paneTabs}>
          {panes.map(({id,label,icon:Icon},i)=><button key={id} type="button"
            onClick={()=>{setPane(id);messages();}}
            aria-current={pane===id?"step":undefined} className={pane===id?"active":""}>
            <Icon size={18}/><span>{label}</span><small>{String(i+1).padStart(2,"0")}</small>
          </button>)}
        </div>
        <div className="studio-side-note"><ShieldCheck size={18}/><span>Rascunho salvo neste dispositivo. Evite computadores compartilhados e mantenha um backup seguro.</span></div>
      </nav>
      <main className="studio-editor" id="studio-editor">
        <div className="studio-editor-heading">
          <div className="studio-heading-top"><span>SEÇÃO {String(paneIndex+1).padStart(2,"0")} DE 06</span>
            <button type="button" className="studio-preview-toggle" onClick={()=>setPreviewOpen(open=>!open)}
              aria-expanded={previewOpen} aria-controls="studio-document-preview"><Eye size={16}/> {previewOpen?"Ocultar prévia":"Ver prévia"}
            </button>
          </div>
          <h1>{panes[paneIndex].label}</h1>
          <p>{paneDescriptions[pane]}</p>
        </div>
        <p className="studio-draft-status" role="status">{draftStatus} <span>· Sem conta ou envio para a nuvem</span></p>
        {importError && <p className="studio-import-error" role="alert">{importError}</p>}
        {importNotice && <div className="studio-import-feedback" role="status">
          <Check size={16}/><span>{importNotice}</span>
          {canUndoImport && <button type="button" onClick={undoImport}>Desfazer importação</button>}
          <button type="button" onClick={()=>setImportNotice(null)} aria-label="Fechar mensagem">Fechar</button>
        </div>}
        {error&&<div className="studio-error" role="alert">{error}</div>}
        {success&&<div className="studio-success" role="status">{success}</div>}
        {pane==="informacoes"&&<>
          <div className="studio-grid2"><Field label="Nome completo" value={profile.contact.name} onChange={v=>contact("name",v)}/>
            <Field label="Título profissional" value={profile.contact.headline} onChange={v=>contact("headline",v)}/></div>
          <div className="studio-grid2"><Field label="E-mail" value={profile.contact.email} onChange={v=>contact("email",v)}/>
            <Field label="Telefone" value={profile.contact.phone} onChange={v=>contact("phone",v)}/></div>
          <Field label="Cidade (opcional)" value={profile.contact.city} onChange={v=>contact("city",v)}/>
          <Field label="Links profissionais (um por linha)" multiline value={profile.contact.links.join("\n")} onChange={v=>contact("links",v)}/>
          <Field label="Resumo profissional" multiline value={profile.summary} onChange={v=>update("summary",v)}/>
          {unassignedImportLines.length > 0 && <details className="studio-unassigned-inline">
            <summary>Trechos do arquivo que precisam de revisão ({unassignedImportLines.length})</summary>
            <p>Alguns trechos não se encaixam nos campos existentes. Você pode copiá-los para o campo adequado.</p>
            <pre>{unassignedImportLines.join("\n")}</pre>
          </details>}
        </>}
        {pane==="experiencias"&&<>
          {profile.experiences.length===0&&<div className="studio-empty-section"><BriefcaseBusiness size={23}/><strong>Nenhuma experiência adicionada</strong><p>Inclua seu cargo, empresa, período e principais atividades.</p></div>}
          {profile.experiences.map((item,i)=><div className="studio-edit-card" key={i}>
            <div className="studio-edit-card-head"><strong>Experiência {i+1}</strong><button type="button" aria-label={"Remover experiência "+(i+1)} onClick={()=>remove("experiences",i)}><Trash2 size={17}/></button></div>
            <Field label="Cargo" value={item.role} onChange={v=>changeList<Experience>("experiences",i,"role",v)}/>
            <Field label="Organização" value={item.organization} onChange={v=>changeList<Experience>("experiences",i,"organization",v)}/>
            <Field label="Período" value={item.period} onChange={v=>changeList<Experience>("experiences",i,"period",v)}/>
            <Field label="Atividades (uma por linha)" multiline value={item.highlights.join("\n")} onChange={v=>changeList<Experience>("experiences",i,"highlights",v)}/>
          </div>)}
          <button type="button" className="studio-add" disabled={profile.experiences.length>=12} onClick={()=>update("experiences",[...profile.experiences,{role:"",organization:"",period:"",highlights:[]}])}><Plus size={17}/> Adicionar experiência</button>
        </>}
        {pane==="formacao"&&<>
          {profile.education.length===0&&<div className="studio-empty-section"><GraduationCap size={23}/><strong>Nenhuma formação adicionada</strong><p>Adicione suas formações acadêmicas ou técnicas.</p></div>}
          {profile.education.map((item,i)=><div className="studio-edit-card" key={i}>
            <div className="studio-edit-card-head"><strong>Formação {i+1}</strong><button type="button" aria-label={"Remover formação "+(i+1)} onClick={()=>remove("education",i)}><Trash2 size={17}/></button></div>
            <Field label="Curso" value={item.course} onChange={v=>changeList<Education>("education",i,"course",v)}/>
            <Field label="Instituição" value={item.institution} onChange={v=>changeList<Education>("education",i,"institution",v)}/>
            <Field label="Período" value={item.period} onChange={v=>changeList<Education>("education",i,"period",v)}/>
          </div>)}
          <button type="button" className="studio-add" disabled={profile.education.length>=10} onClick={()=>update("education",[...profile.education,{course:"",institution:"",period:""}])}><Plus size={17}/> Adicionar formação</button>
        </>}
        {pane==="projetos"&&<>
          {profile.projects.length===0&&<div className="studio-empty-section"><FolderOpen size={23}/><strong>Nenhum projeto adicionado</strong><p>Projetos são opcionais. Inclua aqueles que deseja destacar.</p></div>}
          {profile.projects.map((item,i)=><div className="studio-edit-card" key={i}>
            <div className="studio-edit-card-head"><strong>Projeto {i+1}</strong><button type="button" aria-label={"Remover projeto "+(i+1)} onClick={()=>remove("projects",i)}><Trash2 size={17}/></button></div>
            <Field label="Nome do projeto" value={item.title} onChange={v=>changeList<Project>("projects",i,"title",v)}/>
            <Field label="O que você desenvolveu" multiline value={item.description} onChange={v=>changeList<Project>("projects",i,"description",v)}/>
            <Field label="Link (opcional)" value={item.link} onChange={v=>changeList<Project>("projects",i,"link",v)}/>
          </div>)}
          <button type="button" className="studio-add" disabled={profile.projects.length>=12} onClick={()=>update("projects",[...profile.projects,{title:"",description:"",link:""}])}><Plus size={17}/> Adicionar projeto</button>
        </>}
        {pane==="habilidades"&&<>
          <Field label="Competências (uma por linha)" multiline value={profile.skills.join("\n")} onChange={v=>update("skills",v.split("\n"))}/>
          <Field label="Idiomas e níveis (um por linha)" multiline value={profile.languages.join("\n")} onChange={v=>update("languages",v.split("\n"))}/>
        </>}
        {pane==="estilo"&&<><p className="studio-tip"><FileText size={17}/> Modelos simples, com texto selecionável e estrutura de uma coluna.</p>
          <div className="studio-templates">{(["classico","compacto"] as Template[]).map(t=><button key={t} className={t===template?"selected":""} aria-pressed={t===template} type="button" onClick={()=>{setTemplate(t);setDraftStatus("Salvando alterações...");}}>
            <div className={"studio-model studio-model-"+t}><div/><span/><span/><span/></div>
            <strong>{t==="classico"?"Clássico":"Compacto"}</strong><small>{t==="classico"?"Mais respiro":"Espaçamento reduzido"}</small>
            {t===template&&<Check size={18}/>}</button>)}</div>

        </>}
        <div className="studio-step-navigation" aria-label="Navegar entre seções">
          <button type="button" disabled={paneIndex===0} onClick={()=>navigatePane(-1)}>
            <ChevronLeft size={17}/> Anterior
          </button>
          <span>{paneIndex+1} de {panes.length}</span>
          {paneIndex<panes.length-1 ?
            <button type="button" className="studio-next" onClick={()=>navigatePane(1)}>Próxima seção <ChevronRight size={17}/></button>
            : <Link className="studio-next" href="/preparar" onClick={event=>void goPrepare(event)}>Preparar candidatura <ArrowRight size={17}/></Link>}
        </div>
      </main>
      <aside className={"studio-preview"+(previewOpen?" studio-preview-visible":"")} id="studio-document-preview">
        <div className="studio-preview-heading">
          <div><span>SEU DOCUMENTO</span><strong>Prévia em tempo real</strong></div>
          <div className="studio-preview-meta"><small>{template==="classico"?"Clássico":"Compacto"}</small><small>A4</small></div>
        </div>
        <Preview profile={profile} template={template}/>

      </aside>
    </div>
    <footer className="studio-footer"><span>Alinha Community · Código aberto · Licença MIT</span><Link href="/preparar">Preparar candidatura <ChevronRight size={15}/></Link></footer>
  </div>;
}
