import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, BookOpen, Check, CheckCircle2, CircleHelp,
  Code2, FilePenLine, BriefcaseBusiness, ShieldCheck, Sparkles,
  XCircle,
} from "lucide-react";
import { ConnectionStatus } from "@/components/connection-status";
import "./home.css";

const tools = [
  { icon: Sparkles, title: "Meu agente", label: "BUSCA ORIENTADA PELO CURRÍCULO",
    description: "Conecte seu currículo, descubra vagas relacionadas ao seu perfil e acompanhe as etapas.",
    href: "/agente", hint: "Você controla cada busca" },
  { icon: BriefcaseBusiness, title: "Acompanhar candidaturas", label: "SEU QUADRO DE VAGAS",
    description: "Salve links e acompanhe oportunidades sem criar conta ou enviar candidaturas.", href: "/candidaturas",
    hint: "Dados apenas neste navegador" },
  { icon: BriefcaseBusiness, title: "Encontrar vagas", label: "BUSCA DE OPORTUNIDADES", description: "Pesquise vagas remotas disponíveis no Brasil por uma fonte pública, sem envios automáticos.", href: "/vagas", hint: "Sem cadastro nem IA obrigatória" },
  { icon: FilePenLine, title: "Criar currículo", label: "ESTÚDIO DE CURRÍCULOS", description: "Edite por seções, visualize modelos e exporte um DOCX com texto selecionável.", href: "/studio", hint: "Sem IA obrigatória" },
  { icon: BriefcaseBusiness, title: "Preparar candidatura", label: "ATS + REQUISITOS DA VAGA", description: "Envie o currículo uma vez: verifique a leitura sem IA e compare com a vaga quando desejar.", href: "/preparar", hint: "Análise da vaga usa sua IA conectada" },
];

export default function Home() {
  return <div className="site-shell alinha-home">
    <header className="site-header">
      <div className="container header-inner">
        <Link className="brand" href="/" aria-label="Alinha, página inicial">
          <span className="brand-mark" aria-hidden="true"><ArrowUpRight size={23} strokeWidth={2.5}/></span>
          alinha<span className="brand-dot">.</span>
        </Link>
        <nav className="nav-links home-nav" aria-label="Navegação principal">
          <a href="#ferramentas">Ferramentas</a>
          <a href="https://github.com/mxthsu/alinha" target="_blank" rel="noreferrer"><Code2 size={16}/> GitHub</a>
          <ConnectionStatus variant="compact" />
        </nav>
      </div>
    </header>
    <main>
      <section className="hero">
        <div className="hero-glow" aria-hidden="true"/>
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow"><span className="eyebrow-dot"/> Sua carreira merece clareza <Sparkles size={13} aria-hidden="true"/></span>
            <h1>Seu próximo emprego começa com <em>um bom plano.</em></h1>
            <p>Importe seu currículo uma vez. O Alinha ajuda a encontrar oportunidades, entender requisitos e preparar candidaturas com mais clareza — tudo conectado.</p>
            <div className="hero-actions">
              <Link href="/agente" className="button button-primary">Explorar com meu agente <ArrowRight size={18}/></Link>
              <Link href="/studio" className="button button-outline">Meu currículo <ArrowRight size={18}/></Link>
            </div>
            <div className="hero-footnotes">
              <span><Check size={14}/> Recomendações com evidências</span>
              <span><Check size={14}/> Sem inventar experiências</span>
              <span><Check size={14}/> Código aberto e sem cadastro</span>
            </div>
          </div>
          <div className="hero-preview" aria-label="Exemplo fictício de relatório de análise">
            <div className="preview-top"><span><span className="preview-live-dot"/> PRÉVIA DO RELATÓRIO</span><span className="preview-icon"><Sparkles size={18}/></span></div>
            <p className="preview-title">Desenvolvimento Backend</p>
            <p className="preview-subtitle">Uma visão clara de cada requisito da vaga.</p>
            <div className="preview-divider"/>
            <div className="preview-row"><span><CheckCircle2 size={17} className="preview-good-icon"/> Python &amp; FastAPI</span><span className="preview-tag good">Com evidência</span></div>
            <div className="preview-row"><span><CircleHelp size={17} className="preview-medium-icon"/> Testes automatizados</span><span className="preview-tag medium">Parcial</span></div>
            <div className="preview-row"><span><XCircle size={17} className="preview-neutral-icon"/> Kubernetes</span><span className="preview-tag neutral">Não identificado</span></div>
            <div className="preview-bottom"><ShieldCheck size={18}/> Cada conclusão apoiada em trechos verificáveis.</div>
            <span className="preview-bubble" aria-hidden="true"><Sparkles size={15}/> Análise com contexto</span>
          </div>
        </div>
      </section>
      <section className="home-tools-section" id="ferramentas">
        <div className="container">
          <div className="section-heading">
            <span className="section-label">SUAS FERRAMENTAS</span>
            <h2>Uma jornada conectada, do perfil à candidatura.</h2>
            <p>O agente utiliza seu perfil para orientar a busca. Você pode continuar usando cada ferramenta separadamente quando quiser.</p>
          </div>
          <div className="home-tools-grid">
            {tools.map(({icon:Icon,title,label,description,href,hint})=>
              <Link className="home-tool" href={href} key={href}>
                <span className="home-tool-icon"><Icon size={24}/></span>
                <span className="home-tool-label">{label}</span>
                <h3>{title}</h3>
                <p>{description}</p>
                <div className="home-tool-bottom"><span>{hint}</span><span className="home-tool-arrow"><ArrowUpRight size={20}/></span></div>
              </Link>
            )}
          </div>
        </div>
      </section>
      <section className="community-section" id="codigo-aberto" aria-labelledby="community-heading">
        <div className="container">
          <div className="community-card">
            <div className="community-content">
              <span className="community-label"><Code2 size={15}/> CÓDIGO ABERTO · LICENÇA MIT</span>
              <h2 id="community-heading">A confiança começa com transparência.</h2>
              <p>O Alinha é desenvolvido em código aberto. Explore as decisões técnicas, execute no seu computador e ajude a construir análises mais claras e responsáveis.</p>
              <div className="community-actions">
                <a className="button community-primary" href="https://github.com/mxthsu/alinha" target="_blank" rel="noreferrer">Explorar o código <ArrowUpRight size={17}/></a>
                <a className="community-doc-link" href="https://github.com/mxthsu/alinha/blob/main/docs/getting-started.md" target="_blank" rel="noreferrer">Guia de instalação <BookOpen size={16}/></a>
              </div>
            </div>
            <div className="community-aside">
              <div><CheckCircle2 size={18}/> <span>Evidências verificáveis</span></div>
              <div><CheckCircle2 size={18}/> <span>Sem resultados inventados</span></div>
              <div><CheckCircle2 size={18}/> <span>Construído com a comunidade</span></div>
            </div>
          </div>
        </div>
      </section>
    </main>
    <footer className="site-footer">
      <div className="container footer-inner">
        <Link className="brand" href="/">alinha<span className="brand-dot">.</span></Link>
        <p>Software aberto para uma busca de oportunidades mais transparente.</p>
        <a href="https://github.com/mxthsu/alinha" target="_blank" rel="noreferrer">Ver projeto no GitHub <ArrowUpRight size={15}/></a>
      </div>
    </footer>
  </div>;
}
