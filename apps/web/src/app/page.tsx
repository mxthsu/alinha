import Link from "next/link";
import { Suspense } from "react";
import { AccountActions } from "@/components/account-actions";
import { ArrowRight, FileCheck2, FilePenLine, Code2, ShieldCheck } from "lucide-react";


export default function Welcome() {
  return <Suspense fallback={<div className="entry-shell" style={{minHeight:"100vh"}}><p style={{padding:30}}>Preparando seu espaço…</p></div>}>
    <WelcomeContent/>
  </Suspense>;
}

async function WelcomeContent() {
  return <div className="entry-shell">
    <header className="entry-header">
      <Link href="/" className="platform-brand">alinha<span>.</span></Link>
      <a href="https://github.com/mxthsu/alinha" target="_blank" rel="noopener noreferrer"><Code2 size={18}/> Código aberto</a>
    </header>
    <main className="entry-main">
      <div className="entry-tag"><ShieldCheck size={15}/> ALINHA COMMUNITY · LICENÇA MIT</div>
      <h1>Seu currículo, suas oportunidades.<br/><em>Tudo em um só lugar.</em></h1>
      <p>Crie currículos profissionais, descubra problemas de leitura ATS e prepare candidaturas com a IA que você escolher.</p>
      <div className="entry-access">
        <h2>Comece por aqui</h2>
        <span className="entry-subtitle">Identifique-se para continuar ou utilize o software localmente, sem conta.</span>
        <AccountActions />
        <div className="entry-separator">ou</div>
        <Link href="/inicio" className="entry-local">Continuar no Community local <ArrowRight size={17} /></Link>
        <small>Entrar com Google é diferente de conectar uma IA. Suas chaves Gemini, Claude e OpenAI são configuradas depois, no seu computador. O Community não exige conta.</small>
      </div>
      <div className="entry-highlights">
        <span><FilePenLine size={18}/> Editor e modelos de currículo</span>
        <span><FileCheck2 size={18}/> Diagnóstico ATS transparente</span>
        <span><ShieldCheck size={18}/> Experiências verdadeiras e evidências</span>
      </div>
    </main>
  </div>;
}
