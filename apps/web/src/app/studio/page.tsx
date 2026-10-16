"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import {
  BriefcaseBusiness, Check, ChevronRight, Download,
  FilePenLine, FolderOpen, GraduationCap, LayoutTemplate, Lightbulb, ListChecks,
  Plus, ShieldCheck, Sparkles, Trash2, UploadCloud, UserRound,
} from "lucide-react";
import "./studio.css";
import { type Provider } from "@/components/provider-selector";
import { ConnectedProviderPicker } from "@/components/connected-provider-picker";
import { ConnectionStatus } from "@/components/connection-status";

type Contact = { name: string; headline: string; email: string; phone: string; city: string; links: string[] };
type Experience = { role: string; organization: string; period: string; highlights: string[] };
type Education = { course: string; institution: string; period: string };
type Project = { title: string; description: string; link: string };
type Resume = { schema_version: 1; contact: Contact; summary: string; experiences: Experience[]; education: Education[]; projects: Project[]; skills: string[]; languages: string[] };
type Pane = "informacoes" | "experiencias" | "formacao" | "projetos" | "habilidades" | "estilo" | "ia";
type Template = "classico" | "compacto";
type Suggestion = { requirement: string; job_evidence: string; resume_evidence: string | null; status: string; guidance: string };
type Review = { summary: string; suggestions: Suggestion[]; limitations: string[] };
type ImportedDraft = { profile: Resume; source_text: string; unassigned_lines: string[]; warnings: string[]; requires_confirmation: boolean };
const blank: Resume = {
  schema_version: 1, contact: { name: "", headline: "", email: "", phone: "", city: "", links: [] },
  summary: "", experiences: [], education: [], projects: [], skills: [], languages: [],
};
const demo: Resume = {
  schema_version: 1,
  contact: { name: "Pessoa Candidata", headline: "Desenvolvedora Backend", email: "pessoa@exemplo.com", phone: "(48) 99999-9999", city: "Cidade fictícia", links: ["linkedin.com/in/exemplo"] },
  summary: "Profissional com experiência fictícia em APIs REST, automação e testes de software.",
  experiences: [{ role: "Desenvolvedora Python", organization: "Empresa Exemplo", period: "2024 – 2026", highlights: ["Desenvolveu APIs REST em Python e FastAPI.", "Implementou testes com pytest e documentou integrações."] }],
  education: [{ course: "Bacharelado em Sistemas de Informação", institution: "Universidade Fictícia", period: "2020 – 2024" }],
  projects: [{ title: "Projeto demonstrativo", description: "Criou uma API de exemplo com documentação e testes.", link: "" }],
  skills: ["Python", "FastAPI", "SQL", "Git"], languages: ["Português", "Inglês intermediário"],
};
const panes: { id: Pane; label: string; icon: typeof UserRound }[] = [
  { id: "informacoes", label: "Informações", icon: UserRound },
  { id: "experiencias", label: "Experiências", icon: BriefcaseBusiness },
  { id: "formacao", label: "Formação", icon: GraduationCap },
  { id: "projetos", label: "Projetos", icon: FolderOpen },
  { id: "habilidades", label: "Competências", icon: ListChecks },
  { id: "estilo", label: "Modelos e estilo", icon: LayoutTemplate },
  { id: "ia", label: "Melhorias com IA", icon: Sparkles },
];
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
        {exp.highlights.filter(Boolean).map((h,j) => <p key={j}>• {h}</p>)}</article>)}
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
  const [profile, setProfile] = useState<Resume>(blank);
  const [pane, setPane] = useState<Pane>("informacoes");
  const [template, setTemplate] = useState<Template>("classico");
  const [job, setJob] = useState("");
  const [provider, setProvider] = useState<Provider>("gemini");
  const [model, setModel] = useState("");
  const [providerReady, setProviderReady] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [checked, setChecked] = useState<number[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const upload = useRef<HTMLInputElement>(null);
  const resumeUpload = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<ImportedDraft | null>(null);
  const [importError, setImportError] = useState("");
  const [pendingReplace, setPendingReplace] = useState(false);
  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  function update<K extends keyof Resume>(key: K, value: Resume[K]) {
    setProfile(prev => ({ ...prev, [key]: value })); setReview(null);
  }
  function contact(key: keyof Contact, value: string) {
    setProfile(prev => ({ ...prev, contact: { ...prev.contact, [key]: key === "links" ? value.split("\n") : value } })); setReview(null);
  }
  function changeList<T extends Experience | Education | Project>(key: "experiences" | "education" | "projects", i: number, field: keyof T, value: string) {
    const list = profile[key] as T[];
    const changed = list.map((item,j) => j === i ? { ...item, [field]: field === "highlights" ? value.split("\n") : value } : item);
    setProfile(prev => ({ ...prev, [key]: changed })); setReview(null);
  }
  function remove(key: "experiences" | "education" | "projects", i: number) {
    setProfile(prev => ({ ...prev, [key]: (prev[key] as unknown[]).filter((_,j) => j !== i) })); setReview(null);
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
    setSuccess("Perfil salvo no seu computador. Você poderá importá-lo depois.");
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
      setProfile(normalized.profile); setImportPreview(null); setImportError(""); setPendingReplace(false); setReview(null); setChecked([]);
      setSuccess("Perfil importado. Revise os dados antes de exportar.");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha na importação."); }
    finally { event.target.value=""; }
  }
  async function importResume(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    messages(); setImportError(""); setBusy("import"); setImportPreview(null); setPendingReplace(false);
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
      const hasDraft = Boolean(Object.values(profile.contact).some(value =>
        Array.isArray(value) ? value.length : value.trim()) || profile.summary ||
        profile.experiences.length || profile.education.length || profile.projects.length ||
        profile.skills.length || profile.languages.length);
      setImportPreview(result);
      if (hasDraft) {
        setPendingReplace(true);
      } else {
        setProfile(result.profile);
        setPane("informacoes");
        setReview(null); setChecked([]);
        setSuccess("Campos preenchidos. Revise as seções antes de exportar.");
      }
    } catch (cause) {
      setImportError(cause instanceof Error ? cause.message : "Falha na importação.");
    } finally { setBusy(""); event.target.value = ""; }
  }
  function applyImportedResume() {
    if (!importPreview || !pendingReplace) return;
    setProfile(importPreview.profile);
    setPendingReplace(false); setReview(null); setChecked([]); setPane("informacoes");
    messages(); setSuccess("Currículo substituído. Revise os campos antes de exportar.");
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
  async function reviewWithAI() {
    if (job.trim().length<60 || busy || !providerReady) return;
    messages(); setBusy("ia"); setReview(null); setChecked([]);
    try {
      const r=await fetch(api+"/api/v1/resumes/structured/review",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({profile,job_description:job,provider,model:provider==="chatgpt"?model||null:null}),
      });
      const body=await r.json();
      if (!r.ok) throw new Error(typeof body.detail==="string"?body.detail:"Não foi possível gerar orientações.");
      setReview(body as Review);
    } catch(e) { setError(e instanceof Error?e.message:"Erro de análise."); }
    finally { setBusy(""); }
  }
  return <div className="studio-app">
    <header className="studio-topbar"><Link href="/" className="studio-logo">alinha<span>.</span></Link><div className="studio-title">Currículo Studio</div><div className="studio-global-links"><Link href="/">Início</Link><Link href="/preparar">Preparar candidatura</Link><ConnectionStatus variant="compact" /></div>
      <div className="studio-top-actions">
        <input type="file" hidden accept=".json,application/json" ref={upload} onChange={loadJson}/>
        <input type="file" hidden accept=".pdf,.docx,.txt" ref={resumeUpload} onChange={importResume}/>
        <button type="button" onClick={()=>upload.current?.click()}><FolderOpen size={16}/> <span>Importar JSON</span></button>
        <button type="button" onClick={saveJson}><Download size={16}/> <span>Salvar perfil</span></button>
        <button type="button" className="studio-primary" disabled={Boolean(busy)} onClick={exportDocx}><Download size={16}/> {busy==="docx"?"Exportando…":"Exportar DOCX"}</button>
      </div>
    </header>
    <section className="studio-import" aria-label="Importar currículo existente">
      <div className="studio-import-intro">
        <div className="studio-import-symbol"><UploadCloud size={20}/></div>
        <div><strong>Já tem um currículo?</strong>
          <p>Importe um PDF, DOCX ou TXT e edite os campos preenchidos. Sem uso de IA.</p></div>
      </div>
      <div className="studio-import-choices">
        <button type="button" className="studio-example" disabled={Boolean(busy)}
          onClick={()=>{setProfile(demo);setImportPreview(null);setPendingReplace(false);setPane("informacoes");setReview(null);messages();}}>
          <FilePenLine size={15}/> Usar exemplo
        </button>
        <button type="button" disabled={Boolean(busy)} onClick={() => resumeUpload.current?.click()} className="studio-import-button">
          <UploadCloud size={16}/>{busy === "import" ? "Lendo arquivo…" : "Preencher com meu currículo"}
        </button>
      </div>
      {importError && <p className="studio-import-error" role="alert">{importError}</p>}
      {importPreview && <div className="studio-import-preview" role="region" aria-label="Resultado da importação">
        {pendingReplace ? <>
          <strong>Substituir o currículo atual?</strong>
          <p>Encontramos {importPreview.profile.experiences.length} experiência(s), {importPreview.profile.education.length} formação(ões) e {importPreview.profile.skills.length} competência(s). O rascunho que você está editando será substituído.</p>
          <div className="studio-import-actions">
            <button type="button" onClick={applyImportedResume}>Substituir e revisar campos</button>
            <button type="button" onClick={()=>{setImportPreview(null);setPendingReplace(false);}}>Manter meu currículo</button>
          </div>
        </> : <>
          <div className="studio-import-result"><Check size={17}/> Currículo preenchido. Revise os campos usando as seções abaixo.
            <button type="button" onClick={()=>setImportPreview(null)} aria-label="Dispensar resultado da importação">Fechar</button>
          </div>
          {importPreview.unassigned_lines.length > 0 &&
            <details className="studio-import-unassigned">
              <summary>{importPreview.unassigned_lines.length} trecho(s) precisam de revisão</summary>
              <pre>{importPreview.unassigned_lines.join("\n")}</pre>
            </details>}
        </>}
      </div>}
    </section>
    <div className="studio-layout">
      <nav className="studio-sidebar" aria-label="Partes do currículo"><div className="studio-sidebar-label">EDITAR CURRÍCULO</div>
        {panes.map(({id,label,icon:Icon},i)=><button key={id} type="button" onClick={()=>{setPane(id);messages();}} aria-current={pane===id?"step":undefined} className={pane===id?"active":""}>
          <Icon size={18}/><span>{label}</span><small>{String(i+1).padStart(2,"0")}</small></button>)}
        <div className="studio-side-note"><ShieldCheck size={18}/> Não armazenamos seus dados. Exporte JSON para continuar depois.</div>
      </nav>
      <main className="studio-editor">
        <div className="studio-editor-heading"><span>ETAPA {String(panes.findIndex(item=>item.id===pane)+1).padStart(2,"0")}</span>
          <h2>{panes.find(item=>item.id===pane)?.label}</h2>
          <p>{pane==="ia"?"A IA sugere com evidências, mas nunca modifica seu perfil automaticamente.":"Preencha apenas informações verdadeiras, que possa comprovar."}</p></div>
        {pane==="informacoes"&&<>
          <div className="studio-grid2"><Field label="Nome completo" value={profile.contact.name} onChange={v=>contact("name",v)}/>
            <Field label="Título profissional" value={profile.contact.headline} onChange={v=>contact("headline",v)}/></div>
          <div className="studio-grid2"><Field label="E-mail" value={profile.contact.email} onChange={v=>contact("email",v)}/>
            <Field label="Telefone" value={profile.contact.phone} onChange={v=>contact("phone",v)}/></div>
          <Field label="Cidade (opcional)" value={profile.contact.city} onChange={v=>contact("city",v)}/>
          <Field label="Links profissionais (um por linha)" multiline value={profile.contact.links.join("\n")} onChange={v=>contact("links",v)}/>
          <Field label="Resumo profissional" multiline value={profile.summary} onChange={v=>update("summary",v)}/>
        </>}
        {pane==="experiencias"&&<>
          {profile.experiences.map((item,i)=><div className="studio-edit-card" key={i}>
            <div className="studio-edit-card-head"><strong>Experiência {i+1}</strong><button type="button" aria-label={"Remover experiência "+(i+1)} onClick={()=>remove("experiences",i)}><Trash2 size={17}/></button></div>
            <Field label="Cargo" value={item.role} onChange={v=>changeList<Experience>("experiences",i,"role",v)}/>
            <Field label="Organização" value={item.organization} onChange={v=>changeList<Experience>("experiences",i,"organization",v)}/>
            <Field label="Período" value={item.period} onChange={v=>changeList<Experience>("experiences",i,"period",v)}/>
            <Field label="Atividades (uma por linha)" multiline value={item.highlights.join("\n")} onChange={v=>changeList<Experience>("experiences",i,"highlights",v)}/>
          </div>)}
          <button type="button" className="studio-add" onClick={()=>update("experiences",[...profile.experiences,{role:"",organization:"",period:"",highlights:[]}])}><Plus size={17}/> Adicionar experiência</button>
        </>}
        {pane==="formacao"&&<>
          {profile.education.map((item,i)=><div className="studio-edit-card" key={i}>
            <div className="studio-edit-card-head"><strong>Formação {i+1}</strong><button type="button" aria-label={"Remover formação "+(i+1)} onClick={()=>remove("education",i)}><Trash2 size={17}/></button></div>
            <Field label="Curso" value={item.course} onChange={v=>changeList<Education>("education",i,"course",v)}/>
            <Field label="Instituição" value={item.institution} onChange={v=>changeList<Education>("education",i,"institution",v)}/>
            <Field label="Período" value={item.period} onChange={v=>changeList<Education>("education",i,"period",v)}/>
          </div>)}
          <button type="button" className="studio-add" onClick={()=>update("education",[...profile.education,{course:"",institution:"",period:""}])}><Plus size={17}/> Adicionar formação</button>
        </>}
        {pane==="projetos"&&<>
          {profile.projects.map((item,i)=><div className="studio-edit-card" key={i}>
            <div className="studio-edit-card-head"><strong>Projeto {i+1}</strong><button type="button" aria-label={"Remover projeto "+(i+1)} onClick={()=>remove("projects",i)}><Trash2 size={17}/></button></div>
            <Field label="Nome do projeto" value={item.title} onChange={v=>changeList<Project>("projects",i,"title",v)}/>
            <Field label="O que você desenvolveu" multiline value={item.description} onChange={v=>changeList<Project>("projects",i,"description",v)}/>
            <Field label="Link (opcional)" value={item.link} onChange={v=>changeList<Project>("projects",i,"link",v)}/>
          </div>)}
          <button type="button" className="studio-add" onClick={()=>update("projects",[...profile.projects,{title:"",description:"",link:""}])}><Plus size={17}/> Adicionar projeto</button>
        </>}
        {pane==="habilidades"&&<>
          <Field label="Competências (uma por linha)" multiline value={profile.skills.join("\n")} onChange={v=>update("skills",v.split("\n"))}/>
          <Field label="Idiomas e níveis (um por linha)" multiline value={profile.languages.join("\n")} onChange={v=>update("languages",v.split("\n"))}/>
        </>}
        {pane==="estilo"&&<><p className="studio-tip">Dois modelos de uma coluna, sem imagens, tabelas ou caixas de texto.</p>
          <div className="studio-templates">{(["classico","compacto"] as Template[]).map(t=><button key={t} className={t===template?"selected":""} aria-pressed={t===template} type="button" onClick={()=>setTemplate(t)}>
            <div className={"studio-model studio-model-"+t}><div/><span/><span/><span/></div>
            <strong>{t==="classico"?"Clássico":"Compacto"}</strong><small>{t==="classico"?"Mais respiro":"Espaçamento reduzido"}</small>
            {t===template&&<Check size={18}/>}</button>)}</div>
          <p className="studio-tip">O modelo escolhido também será aplicado ao DOCX. A prévia é ilustrativa; a paginação final depende do editor de documentos.</p>
        </>}
        {pane==="ia"&&<>
          <div className="studio-provider-connection">
            <ConnectedProviderPicker provider={provider} onProviderChange={setProvider}
              model={model} onModelChange={setModel} onReadyChange={setProviderReady} />
          </div>
          <p className="studio-provider-ready" role="status">
            {providerReady
              ? "Provedor pronto. Sua revisão utilizará a conexão escolhida."
              : "Conecte um provedor acima para habilitar a revisão por IA."}
          </p>
          <Field label="Descrição da vaga" multiline value={job} onChange={v=>{setJob(v);setReview(null);}} hint="Cole aqui a descrição da oportunidade…" />
          <div className="studio-tip"><ShieldCheck size={18}/> Uma análise é feita somente quando você solicitar. Pode consumir o limite de seu provedor; o limitador do Gemini permanece ativo.</div>
          <button type="button" className="studio-add studio-ai-start" disabled={Boolean(busy)||job.trim().length<60||!providerReady} onClick={reviewWithAI}><Sparkles size={17}/> {busy==="ia"?"Analisando…":"Gerar orientações com evidências"}</button>
          {review&&<div className="studio-review"><h3>{review.summary}</h3>{review.suggestions.map((item,i)=><article key={i}>
            <div className="studio-review-header"><span>{item.status==="evidenciado"?"Com evidência":item.status==="parcial"?"Parcial":"Não identificado"}</span><strong>{item.requirement}</strong></div>
            <p><b>Da vaga:</b> {item.job_evidence}</p>{item.resume_evidence&&<p><b>Do currículo:</b> {item.resume_evidence}</p>}
            <div className="studio-review-guidance"><Lightbulb size={16}/> {item.guidance}</div>
            <button type="button" onClick={()=>setChecked(prev=>prev.includes(i)?prev.filter(x=>x!==i):[...prev,i])}>{checked.includes(i)?<Check size={15}/>:<Plus size={15}/>} {checked.includes(i)?"Marcada para revisão manual":"Marcar para revisar"}</button>
          </article>)}<small>{checked.length} sugestão(ões) marcadas; edite os campos manualmente para aprovar qualquer alteração.</small>{review.limitations.map((lim,i)=><small key={i}>{lim}</small>)}</div>}
        </>}
        {error&&<div className="studio-error" role="alert">{error}</div>}
        {success&&<div className="studio-success" role="status">{success}</div>}
        <div className="studio-editor-footer"><ShieldCheck size={17}/> Sem salvamento automático ou alterações ocultas no seu currículo.</div>
      </main>
      <aside className="studio-preview"><div className="studio-preview-heading"><div><span>VISUALIZAÇÃO</span><strong>Prévia em tempo real</strong></div><small>A4</small></div>
        <Preview profile={profile} template={template}/>
        <p>O documento DOCX usará texto selecionável e estrutura de uma coluna. Isso não garante aprovação em ATS.</p>
      </aside>
    </div>
    <footer className="studio-footer"><span>Alinha Community · Código aberto · Licença MIT</span><Link href="/preparar">Preparar candidatura <ChevronRight size={15}/></Link></footer>
  </div>;
}
