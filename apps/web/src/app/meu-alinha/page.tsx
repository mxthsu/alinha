"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {ArrowRight,CheckCircle2,Database,HardDrive,KeyRound,LockKeyhole,
  RefreshCw,Settings2,ShieldCheck} from "lucide-react";
import {PlatformNav} from "@/components/platform-nav";
import "./meu-alinha.css";

type Settings={
 version:1;
 ai:{preferred_provider:"gemini"|"anthropic"|"openai_api"|"ollama"|"chatgpt"|null};
 agent:{search:"assisted";applications:"review_only"};
 connectors:{himalayas:{enabled:boolean}};
};
const API=process.env.NEXT_PUBLIC_API_URL||"http://localhost:8000";

export default function MyAlinha(){
 const [settings,setSettings]=useState<Settings|null>(null);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");
 useEffect(()=>{
  let active=true;
  void fetch(API+"/api/v1/community/settings",{cache:"no-store"})
   .then(async response=>{
    if(!response.ok)throw new Error("As configurações locais não estão disponíveis.");
    return await response.json() as Settings;
   })
   .then(data=>{if(active)setSettings(data);})
   .catch(cause=>{if(active)setError(cause instanceof Error?cause.message:"Falha ao carregar configurações.");})
   .finally(()=>{if(active)setLoading(false);});
  return ()=>{active=false;};
 },[]);
 async function toggleHimalayas(){
  if(!settings||saving)return;
  setSaving(true);setNotice("");setError("");
  const next={...settings,connectors:{himalayas:{enabled:!settings.connectors.himalayas.enabled}}};
  try{
   const response=await fetch(API+"/api/v1/community/settings",{
    method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(next),
   });
   if(!response.ok)throw new Error("Não foi possível atualizar o conector.");
   const saved=await response.json() as Settings;
   setSettings(saved);setNotice("Preferência salva neste computador.");
  }catch(cause){
   setError(cause instanceof Error?cause.message:"Falha ao salvar preferência.");
  }finally{setSaving(false);}
 }
 return <div className="platform-shell"><PlatformNav/>
  <main className="platform-container personal-settings">
   <div className="personal-kicker"><Settings2 size={15}/> PERSONALIZE SUA EXPERIÊNCIA</div>
   <div className="personal-header">
    <div><h1>Meu Alinha.</h1><p>Suas conexões, suas preferências e seus dados, organizados em um só lugar.</p></div>
    <span><LockKeyhole size={15}/> Configuração local</span>
   </div>
   <div className="personal-grid">
    <section className="personal-card">
     <div className="personal-card-heading"><div className="personal-card-icon"><KeyRound size={20}/></div>
      <div><h2>Inteligência artificial</h2><p>Escolha e gerencie sua conexão com segurança.</p></div></div>
     <div className="personal-card-body"><ShieldCheck size={18}/><div>
      <strong>Suas credenciais estão protegidas.</strong>
      <p>As chaves são guardadas no cofre de credenciais do sistema operacional, não no arquivo de configuração.</p>
     </div></div>
     <Link className="personal-link" href="/conexoes">Gerenciar minha IA <ArrowRight size={16}/></Link>
    </section>
    <section className="personal-card">
     <div className="personal-card-heading"><div className="personal-card-icon"><RefreshCw size={20}/></div>
      <div><h2>Fontes de vagas</h2><p>Você escolhe quais fontes deseja consultar.</p></div></div>
     <div className="personal-toggle-row">
      <div><strong>Himalayas</strong><p>Vagas remotas disponíveis na fonte pública.</p></div>
      <button type="button" role="switch" aria-label="Habilitar pesquisa Himalayas"
       aria-checked={settings?.connectors.himalayas.enabled??false}
       disabled={loading||saving||!settings} onClick={()=>void toggleHimalayas()}
       className={"personal-switch"+(settings?.connectors.himalayas.enabled?" selected":"")}>
       <span/>
      </button>
     </div>
     <p className="personal-footnote">Desativar esta fonte impede novas pesquisas nela; as vagas já salvas continuam disponíveis.</p>
    </section>
    <section className="personal-card">
     <div className="personal-card-heading"><div className="personal-card-icon"><HardDrive size={20}/></div>
      <div><h2>Currículo e dados</h2><p>Continue de onde parou sem depender de arquivos JSON.</p></div></div>
     <div className="personal-card-body"><Database size={18}/><div>
      <strong>Armazenamento local em implantação.</strong>
      <p>O Community já possui a base SQLite. Seus rascunhos atuais continuam no navegador até uma migração confirmada, sem perda de dados.</p>
     </div></div>
     <Link className="personal-link" href="/studio">Ver meu currículo <ArrowRight size={16}/></Link>
    </section>
    <section className="personal-card">
     <div className="personal-card-heading"><div className="personal-card-icon"><ShieldCheck size={20}/></div>
      <div><h2>Controle do agente</h2><p>O Alinha trabalha com limites claros de autorização.</p></div></div>
     <div className="personal-policy"><span>Pesquisar vagas</span><strong>Com sua autorização</strong></div>
     <div className="personal-policy"><span>Adaptar currículo</span><strong>Você revisa</strong></div>
     <div className="personal-policy"><span>Enviar candidatura</span><strong>Desativado</strong></div>
    </section>
   </div>
   {(notice||error)&&<p className={"personal-status"+(error?" error":"")} role="status">
    {error?error:<><CheckCircle2 size={16}/>{notice}</>}
   </p>}
   <div className="personal-next"><div><strong>Quer encontrar oportunidades agora?</strong>
     <p>Seu currículo e as preferências do agente continuam conectados.</p></div>
    <Link href="/agente">Abrir Meu agente <ArrowRight size={16}/></Link>
   </div>
  </main>
 </div>;
}
