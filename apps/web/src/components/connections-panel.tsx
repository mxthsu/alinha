"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { ProviderSelector, type Provider } from "@/components/provider-selector";

export function ConnectionsPanel() {
  const [provider, setProvider] = useState<Provider>("gemini");
  const [model, setModel] = useState("");
  const [ready, setReady] = useState(false);
  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  return <div className="connections-layout">
    <div className="connections-card"><ProviderSelector apiUrl={api} provider={provider}
      onProviderChange={setProvider} model={model} onModelChange={setModel}
      onReadyChange={setReady} disabled={false}/></div>
    <aside className="connections-next">
      <ShieldCheck size={25}/>
      <h2>Conecte uma vez, utilize nas ferramentas.</h2>
      <p>As chaves ficam no cofre do sistema operacional. O Alinha Community não armazena seu currículo nem precisa da senha das plataformas.</p>
      <p>Para usar uma API paga, o provedor pode cobrar diretamente pela sua conta. Ollama utiliza processamento local.</p>
      <Link href="/inicio" className="connections-continue">Ir para meu espaço <ArrowRight size={17}/></Link>
      {ready && <span className="connections-ready">A conexão selecionada está pronta.</span>}
    </aside>
  </div>;
}
