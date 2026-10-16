import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, FilePenLine, FileSearch, ShieldCheck } from "lucide-react";
import { PlatformNav } from "@/components/platform-nav";
import { ConnectionStatus } from "@/components/connection-status";

const actions = [
  { href: "/studio", icon: FilePenLine, title: "Criar currículo", description: "Edite por seções, escolha modelos e exporte seu currículo em DOCX." },
  { href: "/ats", icon: FileSearch, title: "Verificar ATS", description: "Confira legibilidade e obstáculos de leitura sem depender de IA." },
  { href: "/analisar", icon: BriefcaseBusiness, title: "Analisar vaga", description: "Compare seu currículo com uma oportunidade utilizando a IA conectada." },
];

export default function Dashboard() {
  return <div className="platform-shell">
    <PlatformNav/>
    <main className="platform-container">
      <div className="platform-kicker"><ShieldCheck size={16}/> SEU ESPAÇO · ALINHA COMMUNITY</div>
      <h1>O próximo passo da sua carreira começa aqui.</h1>
      <p className="platform-lead">Crie, revise e prepare seus currículos sem cadastro. Você controla a IA utilizada e os documentos compartilhados.</p>
      <ConnectionStatus/>
      <div className="platform-section-top"><div><span>FERRAMENTAS</span><h2>O que você quer fazer?</h2></div><Link href="/">Conhecer o Alinha <ArrowRight size={16}/></Link></div>
      <div className="platform-cards">{actions.map(item => <Link key={item.href} href={item.href} className="platform-card">
        <div className="platform-icon"><item.icon size={23}/></div><h2>{item.title}</h2><p>{item.description}</p><span>Abrir ferramenta <ArrowRight size={17}/></span>
      </Link>)}</div>
      <p className="platform-footnote">Versão Community local, open source e sem login. Seus currículos só são salvos se você os exportar. O Cloud será desenvolvido separadamente.</p>
    </main>
  </div>;
}
