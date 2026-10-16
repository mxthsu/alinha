import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, FilePenLine, ShieldCheck } from "lucide-react";
import { PlatformNav } from "@/components/platform-nav";

const actions = [
  { href: "/candidaturas", icon: BriefcaseBusiness, title: "Acompanhar candidaturas",
    description: "Salve oportunidades e organize etapas em um quadro local, sem cadastro." },
  { href: "/vagas", icon: BriefcaseBusiness, title: "Encontrar vagas", description: "Descubra oportunidades remotas com informações de uma fonte pública autorizada." },
  { href: "/studio", icon: FilePenLine, title: "Criar currículo", description: "Edite por seções, escolha modelos e exporte seu currículo em DOCX." },
  { href: "/preparar", icon: BriefcaseBusiness, title: "Preparar candidatura", description: "Verifique a leitura ATS e compare com a vaga sem reenviar o currículo." },
];

export default function Dashboard() {
  return <div className="platform-shell">
    <PlatformNav/>
    <main className="platform-container">
      <div className="platform-kicker"><ShieldCheck size={16}/> SEU ESPAÇO · ALINHA COMMUNITY</div>
      <h1>O próximo passo da sua carreira começa aqui.</h1>
      <p className="platform-lead">Crie, revise e prepare seus currículos sem cadastro. Você controla a IA utilizada e os documentos compartilhados.</p>
      <div className="platform-section-top"><div><span>FERRAMENTAS</span><h2>O que você quer fazer?</h2></div><Link href="/">Conhecer o Alinha <ArrowRight size={16}/></Link></div>
      <div className="platform-cards">{actions.map(item => <Link key={item.href} href={item.href} className="platform-card">
        <div className="platform-icon"><item.icon size={23}/></div><h2>{item.title}</h2><p>{item.description}</p><span>Abrir ferramenta <ArrowRight size={17}/></span>
      </Link>)}</div>
      <p className="platform-footnote">Versão Community local, open source e sem login. Seus currículos só são salvos se você os exportar. O Cloud será desenvolvido separadamente.</p>
    </main>
  </div>;
}
