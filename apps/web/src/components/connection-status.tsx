"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleAlert, Cpu, PlugZap, ShieldCheck } from "lucide-react";

type Status = {
  gemini: { available: boolean };
  anthropic: { available: boolean };
  openai_api: { available: boolean };
  chatgpt: { connected: boolean };
  ollama: { available: boolean };
};

const providerLabels: { id: keyof Status; name: string }[] = [
  { id: "gemini", name: "Gemini" },
  { id: "anthropic", name: "Claude" },
  { id: "openai_api", name: "OpenAI API" },
  { id: "chatgpt", name: "ChatGPT" },
  { id: "ollama", name: "Ollama" },
];

export function ConnectionStatus({ variant = "featured" }: { variant?: "featured" | "compact" }) {
  const [state, setState] = useState<"checking" | "available" | "missing" | "offline">("checking");
  const [names, setNames] = useState<string[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    fetch(api + "/api/v1/providers/status", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("API indisponível");
        return await response.json() as Status;
      })
      .then(data => {
        const ready = providerLabels.filter(({ id }) =>
          id === "chatgpt" ? data.chatgpt.connected : data[id].available
        ).map(p => p.name);
        setNames(ready);
        setState(ready.length ? "available" : "missing");
      })
      .catch(() => { if (!controller.signal.aborted) setState("offline"); });
    return () => controller.abort();
  }, []);

  if (variant === "compact") return <Link href="/conexoes" className="ai-nav-link">
    <PlugZap size={16} aria-hidden="true" />
    {state === "available" ? "IA conectada" : "Conectar IA"}
    {state === "available" && <span className="ai-nav-live" aria-label="IA disponível" />}
  </Link>;

  return <section className="ai-onboarding" aria-label="Configurar provedores de inteligência artificial">
    <div className="ai-onboarding-main">
      <span className="ai-onboarding-kicker"><span className="ai-onboarding-kicker-dot" /> ETAPA INICIAL · SUA IA, SUA ESCOLHA</span>
      <div className="ai-onboarding-icon"><PlugZap size={25} aria-hidden="true" /></div>
      <h2>{state === "available" ? "Sua IA já está conectada." : "Antes de analisar, conecte sua IA."}</h2>
      <p>Escolha Gemini, Claude, OpenAI, ChatGPT autorizado ou Ollama local. Configure uma vez e utilize nas ferramentas do Alinha — sem criar uma conta na plataforma.</p>
      <div className="ai-onboarding-steps">
        <span><CheckCircle2 size={15} /> Escolha o provedor</span>
        <span><CheckCircle2 size={15} /> Autorize sua conexão</span>
        <span><CheckCircle2 size={15} /> Use no Studio e nas vagas</span>
      </div>
      <Link href="/conexoes" className="ai-onboarding-cta">
        {state === "available" ? "Gerenciar minha IA" : "Conectar minha IA"} <ArrowRight size={18} />
      </Link>
    </div>
    <aside className="ai-onboarding-aside">
      <span className="ai-onboarding-overline">CENTRAL DE CONEXÕES</span>
      <div className="ai-onboarding-status">
        {state === "available" ? <CheckCircle2 size={19}/> : state === "offline" ? <CircleAlert size={19}/> : <Cpu size={19}/>}
        <div>
          <strong>{state === "checking" ? "Verificando conexões…" : state === "available" ? "Pronto para utilizar" : state === "offline" ? "API local indisponível" : "Nenhuma IA conectada"}</strong>
          <span>{state === "available" ? names.join(" · ") : state === "offline" ? "Inicie a API local e tente novamente." : state === "checking" ? "Consultando as credenciais disponíveis" : "Você escolhe quando e como conectar."}</span>
        </div>
      </div>
      <div className="ai-onboarding-rule"><ShieldCheck size={18} /><span>Chaves de API protegidas no cofre do seu sistema</span></div>
      <div className="ai-onboarding-rule"><ShieldCheck size={18} /><span>Sem cadastro no Alinha e sem compartilhar senhas ou cookies de sessão</span></div>
      <div className="ai-onboarding-rule"><ShieldCheck size={18} /><span>O uso de APIs externas pode gerar custos do próprio provedor</span></div>
      <p className="ai-onboarding-foot">Criar um currículo e verificar ATS continuam disponíveis mesmo sem IA.</p>
    </aside>
  </section>;
}
