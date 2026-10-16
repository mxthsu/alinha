import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, BookOpen, Check, CheckCircle2, CircleHelp,
  Code2, FilePenLine, FileSearch, BriefcaseBusiness, ShieldCheck, Sparkles,
  XCircle, PlugZap,
} from "lucide-react";
import { ConnectionStatus } from "@/components/connection-status";
import "./home.css";

const steps = [
  { number: "01", icon: PlugZap, title: "Conecte sua IA", text: "Escolha o provedor que você prefere. Essa etapa é necessária apenas para recursos com IA." },
  { number: "02", icon: FilePenLine, title: "Organize seu currículo", text: "Preencha suas experiências reais, escolha o modelo e visualize o resultado." },
  { number: "03", icon: FileSearch, title: "Revise a legibilidade", text: "Identifique obstáculos comuns de leitura ATS, sem prometer aprovação." },
  { number: "04", icon: BriefcaseBusiness, title: "Prepare sua candidatura", text: "Compare seu perfil com a vaga e revise evidências e orientações." },
];
const tools = [
  { icon: FilePenLine, title: "Criar currículo", label: "ESTÚDIO DE CURRÍCULOS", description: "Edite por seções, visualize modelos e exporte um DOCX com texto selecionável.", href: "/studio", hint: "Sem IA obrigatória" },
  { icon: FileSearch, title: "Verificar ATS", label: "COMPATIBILIDADE DE LEITURA", description: "Descubra limitações de texto e estrutura que podem atrapalhar a interpretação do currículo.", href: "/ats", hint: "Sem IA obrigatória" },
  { icon: BriefcaseBusiness, title: "Analisar uma vaga", label: "REVISÃO COM EVIDÊNCIAS", description: "Compare requisitos da oportunidade com seu currículo e receba recomendações verificáveis.", href: "/analisar", hint: "Requer IA conectada" },
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
          <a href="#como-funciona">Como funciona</a>
          <a href="#ferramentas">Ferramentas</a>
          <a href="https://github.com/mxthsu/alinha" target="_blank" rel="noreferrer"><Code2 size={16}/> GitHub</a>
          <Link href="/conexoes" className="home-nav-ai"><PlugZap size={16}/> Conectar IA <ArrowUpRight size={15}/></Link>
        </nav>
      </div>
    </header>
    <main>
      <section className="hero">
        <div className="hero-glow" aria-hidden="true"/>
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow"><span className="eyebrow-dot"/> Sua carreira merece clareza <Sparkles size={13} aria-hidden="true"/></span>
            <h1>Seu currículo tem uma história. <em>Faça ela contar.</em></h1>
            <p>Compare sua experiência com os requisitos de uma vaga, veja o que está comprovado e descubra como apresentar melhor seu potencial.</p>
            <div className="hero-actions">
              <Link href="/conexoes" className="button button-primary">Conectar minha IA <ArrowUpRight size={18}/></Link>
              <Link href="/studio" className="button button-outline">Criar currículo <ArrowRight size={18}/></Link>
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
      <section className="home-ai-section" id="conectar-ia">
        <div className="container">
          <ConnectionStatus/>
        </div>
      </section>
      <section className="intro-section" id="como-funciona">
        <div className="container">
          <div className="section-heading">
            <span className="section-label">COMO FUNCIONA</span>
            <h2>Menos achismo. Mais contexto.</h2>
            <p>Um fluxo simples para transformar experiências reais em candidaturas bem preparadas. Sem login no Community e sem promessas sobre resultados seletivos.</p>
          </div>
          <div className="steps">
            {steps.map(({number,icon:Icon,title,text})=>
              <article className="step" key={number}>
                <div className="step-top"><span className="step-icon"><Icon size={21} strokeWidth={1.8}/></span><span className="step-num">{number}</span></div>
                <h3>{title}</h3><p>{text}</p><span className="step-bottom-line" aria-hidden="true"/>
              </article>
            )}
          </div>
        </div>
      </section>
      <section className="home-tools-section" id="ferramentas">
        <div className="container">
          <div className="section-heading">
            <span className="section-label">SUAS FERRAMENTAS</span>
            <h2>Uma ferramenta para cada momento.</h2>
            <p>Escolha por onde começar. Currículos e diagnóstico ATS são independentes da conexão com IA.</p>
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
          <Link className="home-hub-link" href="/inicio">Ver meu espaço de trabalho <ArrowRight size={17}/></Link>
        </div>
      </section>
      <section className="community-section" aria-labelledby="community-heading">
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
