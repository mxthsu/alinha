import Link from "next/link";
import { Suspense } from "react";
import { auth, googleLoginConfigured } from "@/auth";
import { PlatformNav } from "@/components/platform-nav";
import { ArrowRight, BriefcaseBusiness, FilePenLine, ShieldCheck, PlugZap, FileSearch, UserRound } from "lucide-react";


const actions = [
  { href: "/studio", icon: FilePenLine, title: "Meus currículos", description: "Monte seu currículo por seções, visualize e exporte versões." },
  { href: "/ats", icon: FileSearch, title: "Verificar ATS", description: "Identifique obstáculos de leitura e obtenha orientações." },
  { href: "/analisar", icon: BriefcaseBusiness, title: "Analisar vaga", description: "Compare seu currículo com requisitos e evidências publicados." },
  { href: "/conexoes", icon: PlugZap, title: "Conexões de IA", description: "Conecte Gemini, Claude, OpenAI, Ollama ou ChatGPT local autorizado." },
];

export default function Dashboard() {
  return <Suspense fallback={<div className="platform-shell" style={{minHeight:"100vh"}}><p style={{padding:30}}>Preparando seu espaço…</p></div>}>
    <DashboardContent/>
  </Suspense>;
}

async function DashboardContent() {
  const session = googleLoginConfigured ? await auth() : null;
  return <div className="platform-shell">
    <PlatformNav />
    <main className="platform-container">
      <div className="platform-kicker"><ShieldCheck size={16}/> SEU ESPAÇO PROFISSIONAL</div>
      <h1>{session?.user?.name ? `Olá, ${session.user.name.split(" ")[0]}.` : "Bem-vindo ao Alinha."}</h1>
      <p className="platform-lead">Prepare uma candidatura de cada vez, sem perder o controle sobre seu currículo e os dados que compartilha.</p>
      <div className="platform-first"><UserRound size={21}/><div><strong>{session?.user ? "Conta Google conectada" : "Modo Community local"}</strong>
        <span>{session?.user ? "Sua identidade está autenticada. As conexões de IA são configuradas separadamente." : "Você pode usar as ferramentas sem login. Currículos só são salvos quando você exporta JSON ou DOCX."}</span></div></div>
      <div className="platform-cards">{actions.map(item => <Link key={item.href} href={item.href} className="platform-card">
        <div className="platform-icon"><item.icon size={23}/></div>
        <h2>{item.title}</h2><p>{item.description}</p>
        <span>Explorar <ArrowRight size={17}/></span>
      </Link>)}</div>
      <p className="platform-footnote">O Alinha Cloud não está disponível. Este ambiente executa a versão Community open source.</p>
    </main>
  </div>;
}
