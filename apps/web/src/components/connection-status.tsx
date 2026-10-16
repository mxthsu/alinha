"use client";

import Link from "next/link";
import { ArrowUpRight, CheckCircle2, CircleAlert, LoaderCircle, PlugZap } from "lucide-react";
import { useProviderStatus } from "@/hooks/use-provider-status";

export function ConnectionStatus({ variant = "compact" }: { variant?: "hero" | "compact" }) {
  const { phase, providers } = useProviderStatus();
  const connected = phase === "available";
  const loading = phase === "checking";
  const offline = phase === "offline";
  const label = connected
    ? "IA conectada"
    : loading ? "Verificando IA…"
    : offline ? "Ver conexões de IA"
    : "Conectar IA";

  const icon = loading
    ? <LoaderCircle size={17} className="ai-spin" aria-hidden="true" />
    : connected ? <CheckCircle2 size={17} aria-hidden="true" />
    : offline ? <CircleAlert size={17} aria-hidden="true" />
    : <PlugZap size={17} aria-hidden="true" />;

  if (variant === "hero") {
    return <div className="hero-provider-action" aria-live="polite">
      <Link href="/conexoes" className={"button button-primary hero-ai-button" + (connected ? " connected" : "")}>
        {icon}<span>{label}</span><ArrowUpRight size={18} aria-hidden="true" />
      </Link>
      <span className="hero-provider-caption">
        {connected ? providers.join(" · ") + " pronto para usar"
          : loading ? "Consultando seus provedores locais"
          : offline ? "Confira a API local nas conexões"
          : "Configure sua IA quando precisar"}
      </span>
    </div>;
  }
  return <Link href="/conexoes" className={"ai-nav-link" + (connected ? " ai-nav-connected" : "")}
    aria-label={connected ? "IA conectada. Gerenciar provedores: " + providers.join(", ") : label}
    title={connected ? "Conectado: " + providers.join(", ") : "Gerenciar provedores de IA"}>
    {icon}
    <span>{label}</span>
    {connected && <span className="ai-nav-live" aria-hidden="true" />}
  </Link>;
}
