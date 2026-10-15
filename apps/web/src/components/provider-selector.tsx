"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Cloud, Cpu, ExternalLink, KeyRound, LoaderCircle, LogOut, ShieldCheck } from "lucide-react";

export type Provider = "chatgpt" | "gemini" | "ollama";
type ProviderStatus = {
  chatgpt: { enabled: boolean; connected: boolean; email: string | null };
  gemini: { available: boolean };
  ollama: { available: boolean };
};
type Model = { id: string; name: string };
type Props = {
  apiUrl: string;
  provider: Provider;
  onProviderChange: (provider: Provider) => void;
  model: string;
  onModelChange: (model: string) => void;
  disabled: boolean;
};

const options: { id: Provider; name: string; details: string; icon: typeof Cpu }[] = [
  { id: "chatgpt", name: "ChatGPT", details: "Sua assinatura elegível", icon: ShieldCheck },
  { id: "gemini", name: "Gemini", details: "Sua chave de API", icon: Cloud },
  { id: "ollama", name: "Ollama", details: "Modelo local no PC", icon: Cpu },
];

export function ProviderSelector({ apiUrl, provider, onProviderChange, model, onModelChange, disabled }: Props) {
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const callback = params.get("chatgpt");
    if (callback) {
      params.delete("chatgpt");
      const query = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (query ? "?" + query : ""));
    }
    fetch(apiUrl + "/api/v1/providers/status", { cache: "no-store" })
      .then(async res => {
        if (!res.ok) throw new Error("Não foi possível consultar os provedores.");
        return (await res.json()) as ProviderStatus;
      })
      .then(next => {
        if (!active) return;
        setStatus(next);
        if (next.chatgpt.enabled) onProviderChange("chatgpt");
        else if (next.gemini.available) onProviderChange("gemini");
        else if (next.ollama.available) onProviderChange("ollama");
        if (callback === "error") setMessage("A conexão não foi concluída. Tente novamente.");
        if (callback === "connected") setMessage("Conta ChatGPT conectada. Selecione um modelo para continuar.");
      })
      .catch(() => { if (active) setMessage("A API está indisponível. Confira se o servidor foi iniciado."); });
    return () => { active = false; };
  }, [apiUrl, onProviderChange]);

  useEffect(() => {
    if (!status?.chatgpt.connected) return;
    let alive = true;
    fetch(apiUrl + "/api/v1/providers/chatgpt/models", { cache: "no-store" })
      .then(async res => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.detail || "Não foi possível listar os modelos.");
        return body.models as Model[];
      })
      .then(items => {
        if (!alive) return;
        setModels(items);
        if (items.length && !items.some(item => item.id === model)) onModelChange(items[0].id);
      })
      .catch(() => { if (alive) setMessage("Não foi possível carregar os modelos ChatGPT disponíveis."); });
    return () => { alive = false; };
  }, [apiUrl, status?.chatgpt.connected, model, onModelChange]);

  async function connect() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(apiUrl + "/api/v1/providers/chatgpt/login", { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.authorization_url) throw new Error(data.detail || "Não foi possível iniciar o login.");
      const url = new URL(data.authorization_url);
      if (url.origin !== "https://auth.openai.com") throw new Error("Endereço de autenticação inválido.");
      window.location.assign(url.toString());
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Falha ao conectar.");
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(apiUrl + "/api/v1/providers/chatgpt/logout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Não foi possível desconectar.");
      setStatus(previous => previous ? { ...previous, chatgpt: { ...previous.chatgpt, connected: false, email: null } } : previous);
      setModels([]);
      onModelChange("");
      setMessage(data.remote_revocation_confirmed
        ? "Conta desconectada."
        : "Conta desconectada localmente. Não foi possível confirmar a revogação remota; revise as conexões nas configurações do ChatGPT.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Falha ao desconectar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="provider-section">
      <div className="panel-heading"><span className="panel-index">03</span><h3>Como deseja usar a IA?</h3></div>
      <p className="provider-help">Escolha onde a análise será processada. As opções não precisam de uma chave nossa.</p>
      <div className="provider-options" role="radiogroup" aria-label="Provedor de inteligência artificial">
        {options.map(option => {
          const Icon = option.icon;
          const available = option.id === "chatgpt"
            ? Boolean(status?.chatgpt.enabled)
            : option.id === "gemini" ? Boolean(status?.gemini.available) : Boolean(status?.ollama.available);
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={provider === option.id}
              className={"provider-option " + (provider === option.id ? "selected" : "")}
              disabled={disabled || !status || !available}
              onClick={() => { onProviderChange(option.id); setMessage(""); }}
            >
              <Icon size={18} aria-hidden="true" />
              <span><strong>{option.name}</strong><small>{available ? option.details : "Não configurado"}</small></span>
              {provider === option.id && <CheckCircle2 size={15} className="provider-selected" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      {provider === "chatgpt" && status?.chatgpt.enabled && (
        <div className="provider-connection">
          {status.chatgpt.connected ? (
            <>
              <span className="connection-ok"><CheckCircle2 size={16} aria-hidden="true" /> Conectado {status.chatgpt.email ? "· " + status.chatgpt.email : ""}</span>
              <button type="button" className="provider-link" disabled={busy || disabled} onClick={disconnect}><LogOut size={14} aria-hidden="true" /> Desconectar</button>
              <label className="field-label" htmlFor="chatgpt-model">Modelo disponível na sua conta</label>
              <select
                id="chatgpt-model" className="model-select" value={model}
                disabled={disabled || models.length === 0}
                onChange={e => onModelChange(e.target.value)}
              >
                {models.length === 0 && <option value="">Carregando modelos…</option>}
                {models.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
              </select>
            </>
          ) : (
            <>
              <p>Autorize o Alinha a usar os limites disponíveis do seu plano ChatGPT. Sem acesso às suas conversas.</p>
              <button className="provider-connect-button" type="button" disabled={busy || disabled} onClick={connect}>
                {busy ? <LoaderCircle size={16} className="spinner" aria-hidden="true" /> : <KeyRound size={16} aria-hidden="true" />}
                Continuar com ChatGPT <ExternalLink size={14} aria-hidden="true" />
              </button>
              <small>Disponível apenas com Alinha executado localmente. Seu plano e suas cotas determinam o acesso.</small>
            </>
          )}
        </div>
      )}
      {provider === "ollama" && <p className="provider-helper">Ollama deve estar rodando em 127.0.0.1:11434 com o modelo configurado na API.</p>}
      {provider === "gemini" && <p className="provider-helper">A chave de API Gemini deve ser configurada localmente no servidor, nunca no navegador.</p>}
      {message && <p className="provider-message" role="status">{message}</p>}
    </div>
  );
}
