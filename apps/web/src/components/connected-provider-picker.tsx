"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, KeyRound } from "lucide-react";
import type { Provider } from "@/components/provider-selector";

type Status = {
  gemini: { available: boolean };
  anthropic: { available: boolean };
  openai_api: { available: boolean };
  chatgpt: { connected: boolean; enabled: boolean };
  ollama: { available: boolean };
};
const providerNames: Record<Provider, string> = {
  gemini: "Gemini", anthropic: "Claude API", openai_api: "OpenAI API", chatgpt: "ChatGPT", ollama: "Ollama",
};
export function ConnectedProviderPicker({ provider, onProviderChange, model, onModelChange, onReadyChange }: {
  provider: Provider; onProviderChange: (p: Provider) => void;
  model: string; onModelChange: (m: string) => void; onReadyChange: (ready: boolean) => void;
}) {
  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const [available, setAvailable] = useState<Provider[]>([]);
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    fetch(api + "/api/v1/providers/status", { cache: "no-store" })
      .then(res => { if (!res.ok) throw new Error("API indisponível"); return res.json() as Promise<Status>; })
      .then(status => {
        if (!alive) return;
        const next: Provider[] = (Object.keys(providerNames) as Provider[]).filter(p =>
          p === "chatgpt" ? status.chatgpt.connected : status[p].available);
        setAvailable(next);
        if (!next.includes(provider) && next.length) onProviderChange(next[0]);
      })
      .catch(() => { if (alive) setError("Não foi possível consultar as conexões locais."); });
    return () => { alive = false; };
  }, [api, provider, onProviderChange]);
  useEffect(() => {
    let alive = true;
    if (provider !== "chatgpt" || !available.includes("chatgpt")) return;
    fetch(api + "/api/v1/providers/chatgpt/models")
      .then(res => res.json()).then(payload => { if (alive) {
        const next = (payload.models || []) as {id:string;name:string}[];
        setModels(next);
        if (!next.some(item=>item.id===model) && next.length) onModelChange(next[0].id);
      } }).catch(() => {});
    return () => { alive = false; };
  }, [api, provider, available, model, onModelChange]);
  const ready = available.includes(provider) && (provider !== "chatgpt" || Boolean(model && models.some(item=>item.id===model)));
  useEffect(() => { onReadyChange(ready); }, [ready, onReadyChange]);
  return <div className="connected-picker">
    <div className="connected-picker-head"><KeyRound size={18}/><strong>Provedor para esta operação</strong></div>
    {available.length ? <>
      <label>Conexão disponível
        <select aria-label="Selecionar provedor conectado" value={available.includes(provider) ? provider : available[0]}
          onChange={event => onProviderChange(event.target.value as Provider)}>
          {available.map(item => <option key={item} value={item}>{providerNames[item]}</option>)}
        </select>
      </label>
      {provider === "chatgpt" && <label>Modelo autorizado
        <select value={model} onChange={event => onModelChange(event.target.value)}>
          <option value="">Selecione o modelo</option>
          {models.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>}
      <span className="connected-picker-ok"><CheckCircle2 size={15}/> {ready ? "Conexão pronta" : "Aguardando seleção do modelo"}</span>
    </> : <p>Nenhum provedor conectado ainda. Escolha um em Conexões de IA.</p>}
    {error && <p role="alert">{error}</p>}
    <Link href="/conexoes">Gerenciar conexões <ArrowRight size={15}/></Link>
  </div>;
}
