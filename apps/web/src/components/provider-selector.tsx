"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2, Cloud, Cpu, ExternalLink, Eye, EyeOff, KeyRound,
  LoaderCircle, LogOut, ShieldCheck, Sparkles,
} from "lucide-react";

export type Provider = "chatgpt" | "gemini" | "anthropic" | "openai_api" | "ollama";
type KeyProvider = "gemini" | "anthropic" | "openai_api";
type KeyStatus = { available: boolean; source: "vault" | "environment" | "none" };
type ProviderStatus = {
  deployment_mode: "community" | "cloud";
  chatgpt: { enabled: boolean; connected: boolean; email: string | null };
  gemini: KeyStatus;
  anthropic: KeyStatus;
  openai_api: KeyStatus;
  ollama: { available: boolean };
};
type Model = { id: string; name: string };
type Props = {
  apiUrl: string;
  provider: Provider;
  onProviderChange: (provider: Provider) => void;
  model: string;
  onModelChange: (model: string) => void;
  onReadyChange: (ready: boolean) => void;
  disabled: boolean;
};

const options: { id: Provider; name: string; details: string; icon: typeof Cpu }[] = [
  { id: "chatgpt", name: "ChatGPT", details: "Autorização OAuth", icon: ShieldCheck },
  { id: "anthropic", name: "Claude", details: "Anthropic API", icon: Sparkles },
  { id: "gemini", name: "Gemini", details: "Google AI Studio", icon: Cloud },
  { id: "openai_api", name: "OpenAI API", details: "Chave da API", icon: KeyRound },
  { id: "ollama", name: "Ollama", details: "Modelo local", icon: Cpu },
];

const docs: Record<KeyProvider, string> = {
  gemini: "https://aistudio.google.com/apikey",
  anthropic: "https://console.anthropic.com/settings/keys",
  openai_api: "https://platform.openai.com/api-keys",
};

const keyNames: Record<KeyProvider, string> = {
  gemini: "Gemini",
  anthropic: "Anthropic",
  openai_api: "OpenAI",
};

function isKeyProvider(value: Provider): value is KeyProvider {
  return value === "gemini" || value === "anthropic" || value === "openai_api";
}

async function readResponse(response: Response) {
  const data: unknown = await response.json();
  if (!response.ok) {
    const detail = typeof data === "object" && data !== null && "detail" in data
      ? (data as { detail?: unknown }).detail : null;
    throw new Error(typeof detail === "string" ? detail : "Não foi possível completar a operação.");
  }
  return data;
}

export function ProviderSelector({
  apiUrl, provider, onProviderChange, model, onModelChange, onReadyChange, disabled,
}: Props) {
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [keyInput, setKeyInput] = useState("");
  const [keyVisible, setKeyVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [connectionError, setConnectionError] = useState(false);

  const refresh = useCallback(async (): Promise<ProviderStatus> => {
    const response = await fetch(apiUrl + "/api/v1/providers/status", { cache: "no-store" });
    const next = await readResponse(response) as ProviderStatus;
    setStatus(next);
    window.dispatchEvent(new Event("provider-connection-changed"));
    return next;
  }, [apiUrl]);

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams(window.location.search);
    const callback = params.get("chatgpt");
    if (callback) {
      params.delete("chatgpt");
      const query = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (query ? "?" + query : ""));
    }
    fetch(apiUrl + "/api/v1/providers/status", { cache: "no-store" })
      .then(readResponse)
      .then(data => {
        if (!alive) return;
        const next = data as ProviderStatus;
        setStatus(next);
        if (next.chatgpt.connected) onProviderChange("chatgpt");
        else if (next.anthropic.available) onProviderChange("anthropic");
        else if (next.gemini.available) onProviderChange("gemini");
        else if (next.openai_api.available) onProviderChange("openai_api");
        else if (next.ollama.available) onProviderChange("ollama");
        if (callback === "connected") setMessage("Conta ChatGPT conectada.");
        if (callback === "error") {
          setConnectionError(true);
          setMessage("Não foi possível concluir a autorização ChatGPT.");
        }
      })
      .catch(() => {
        if (!alive) return;
        setConnectionError(true);
        setMessage("A API local está indisponível. Inicie o servidor e recarregue.");
      });
    return () => { alive = false; };
  }, [apiUrl, onProviderChange]);

  useEffect(() => {
    if (!status?.chatgpt.connected) return;
    let alive = true;
    fetch(apiUrl + "/api/v1/providers/chatgpt/models", { cache: "no-store" })
      .then(readResponse)
      .then(data => {
        if (!alive) return;
        const items = (data as { models: Model[] }).models;
        setModels(items);
        if (items.length && !items.some(item => item.id === model)) onModelChange(items[0].id);
      })
      .catch(() => {
        if (alive) {
          setConnectionError(true);
          setMessage("Não foi possível consultar os modelos autorizados no ChatGPT.");
        }
      });
    return () => { alive = false; };
  }, [apiUrl, status?.chatgpt.connected, model, onModelChange]);

  const ready = Boolean(status && (
    isKeyProvider(provider)
      ? status[provider].available
      : provider === "chatgpt" ? status.chatgpt.connected && models.length > 0
      : status.ollama.available
  ));
  useEffect(() => { onReadyChange(ready); }, [ready, onReadyChange]);

  function choose(next: Provider) {
    onProviderChange(next);
    setKeyInput("");
    setKeyVisible(false);
    setConnectionError(false);
    setMessage("");
  }

  async function connectKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isKeyProvider(provider) || !keyInput.trim() || busy) return;
    setBusy(true);
    setMessage("");
    setConnectionError(false);
    try {
      await readResponse(await fetch(apiUrl + "/api/v1/providers/keys/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, api_key: keyInput }),
      }));
      setKeyInput("");
      setKeyVisible(false);
      await refresh();
      setMessage("Chave verificada e salva no cofre seguro deste computador.");
    } catch (caught) {
      setConnectionError(true);
      setMessage(caught instanceof Error ? caught.message : "Falha ao validar a chave.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnectKey() {
    if (!isKeyProvider(provider) || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await readResponse(await fetch(apiUrl + "/api/v1/providers/keys/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      }));
      await refresh();
      setMessage("Chave removida do cofre local.");
    } catch (caught) {
      setConnectionError(true);
      setMessage(caught instanceof Error ? caught.message : "Falha ao remover a chave.");
    } finally {
      setBusy(false);
    }
  }

  async function connectChatGPT() {
    setBusy(true);
    setConnectionError(false);
    setMessage("");
    try {
      const data = await readResponse(await fetch(apiUrl + "/api/v1/providers/chatgpt/login", {
        method: "POST",
      })) as { authorization_url: string };
      const url = new URL(data.authorization_url);
      if (url.origin !== "https://auth.openai.com") throw new Error("Destino de autorização inesperado.");
      window.location.assign(url.toString());
    } catch (caught) {
      setConnectionError(true);
      setMessage(caught instanceof Error ? caught.message : "Não foi possível iniciar o login.");
      setBusy(false);
    }
  }

  async function disconnectChatGPT() {
    setBusy(true);
    setMessage("");
    try {
      const response = await readResponse(await fetch(apiUrl + "/api/v1/providers/chatgpt/logout", {
        method: "POST",
      })) as { remote_revocation_confirmed: boolean };
      setModels([]);
      onModelChange("");
      await refresh();
      setMessage(response.remote_revocation_confirmed
        ? "Conta desconectada."
        : "Desconectado localmente. A revogação remota não foi confirmada; confira suas conexões no ChatGPT.");
    } catch (caught) {
      setConnectionError(true);
      setMessage(caught instanceof Error ? caught.message : "Não foi possível desconectar.");
    } finally {
      setBusy(false);
    }
  }

  const keyStatus = status && isKeyProvider(provider) ? status[provider] : null;

  return (
    <div className="provider-section">
      <div className="panel-heading">
        <span className="panel-index">01</span>
        <h3>Conexões de IA</h3>
      </div>
      <p className="provider-help">Conecte uma conta autorizada, use sua chave de API ou execute um modelo local. Você escolhe o provedor.</p>
      <div className="provider-options" role="radiogroup" aria-label="Selecionar provedor de IA">
        {options.map(({ id, name, details, icon: Icon }) => {
          const connected = status ? (
            isKeyProvider(id) ? status[id].available
              : id === "chatgpt" ? status.chatgpt.connected
              : status.ollama.available
          ) : false;
          return (
            <button
              key={id} type="button" role="radio" aria-checked={provider === id}
              className={"provider-option " + (provider === id ? "selected" : "")}
              disabled={disabled || !status || (id === "chatgpt" && !status.chatgpt.enabled) || status.deployment_mode !== "community"}
              onClick={() => choose(id)}
            >
              <Icon size={18} aria-hidden="true" />
              <span><strong>{name}</strong><small>{connected ? "Conectado" : details}</small></span>
              {connected && <CheckCircle2 size={15} className="provider-selected" aria-label="Disponível" />}
            </button>
          );
        })}
      </div>
      {status && status.deployment_mode === "cloud" && (
        <p className="provider-helper">O Alinha Cloud ainda não está disponível. Execute o Community localmente.</p>
      )}

      {keyStatus && (
        <div className="provider-connection">
          {keyStatus.available ? (
            <>
              <span className="connection-ok"><CheckCircle2 size={16} aria-hidden="true" />
                {keyStatus.source === "vault" ? "Chave protegida no cofre do sistema" : "Chave configurada no ambiente local"}
              </span>
              {keyStatus.source === "vault" && (
                <button className="provider-link" type="button" disabled={busy || disabled} onClick={disconnectKey}>
                  <LogOut size={14} aria-hidden="true" /> Remover conexão
                </button>
              )}
              {keyStatus.source === "environment" && <p>Para desconectar, remova a variável de ambiente no servidor.</p>}
            </>
          ) : (
            <form onSubmit={connectKey} autoComplete="off">
              <label htmlFor="provider-key" className="field-label">Chave de API {keyNames[provider as KeyProvider]}</label>
              <div className="secret-input-wrap">
                <input
                  id="provider-key" type={keyVisible ? "text" : "password"}
                  value={keyInput} autoComplete="off" spellCheck={false} maxLength={4096}
                  placeholder="Cole sua chave para conectar"
                  onChange={event => setKeyInput(event.target.value)}
                  disabled={busy || disabled} required minLength={12}
                />
                <button type="button" className="secret-toggle" aria-label={keyVisible ? "Ocultar chave" : "Mostrar chave"} onClick={() => setKeyVisible(previous => !previous)}>
                  {keyVisible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                </button>
              </div>
              <button type="submit" className="provider-connect-button" disabled={busy || disabled || keyInput.trim().length < 12}>
                {busy ? <LoaderCircle size={16} className="spinner" aria-hidden="true" /> : <KeyRound size={16} aria-hidden="true" />}
                {busy ? "Verificando conexão…" : "Verificar e conectar"}
              </button>
              <a className="provider-doc-link" href={docs[provider as KeyProvider]} target="_blank" rel="noopener noreferrer">
                Criar chave na plataforma oficial <ExternalLink size={13} aria-hidden="true" />
              </a>
              <small>Verificação sem gerar conteúdo. O Alinha guarda a chave apenas no cofre do sistema, nunca no navegador. O uso da API pode ser cobrado pelo provedor.</small>
            </form>
          )}
        </div>
      )}

      {provider === "chatgpt" && status?.chatgpt.enabled && (
        <div className="provider-connection">
          {status.chatgpt.connected ? (
            <>
              <span className="connection-ok"><CheckCircle2 size={16} aria-hidden="true" />
                Conta conectada{status.chatgpt.email ? " · " + status.chatgpt.email : ""}
              </span>
              <button type="button" className="provider-link" onClick={disconnectChatGPT} disabled={busy || disabled}>
                <LogOut size={14} aria-hidden="true" /> Desconectar conta
              </button>
              <label className="field-label" htmlFor="chatgpt-model">Modelo autorizado</label>
              <select className="model-select" id="chatgpt-model" value={model}
                onChange={event => onModelChange(event.target.value)} disabled={disabled || models.length === 0}>
                {models.length === 0 && <option value="">Carregando modelos…</option>}
                {models.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </>
          ) : (
            <>
              <p>Autorize o Alinha pelo navegador para utilizar os limites elegíveis do seu plano ChatGPT. Nenhuma senha ou conversa é compartilhada.</p>
              <button type="button" className="provider-connect-button" disabled={busy || disabled} onClick={connectChatGPT}>
                {busy ? <LoaderCircle size={16} className="spinner" aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />}
                Continuar com ChatGPT <ExternalLink size={14} aria-hidden="true" />
              </button>
              <small>Disponível somente na instalação local autorizada. O uso pode compartilhar limites com outros aplicativos da conta.</small>
            </>
          )}
        </div>
      )}

      {provider === "ollama" && (
        <p className="provider-helper">
          {status?.ollama.available ? "Servidor Ollama local disponível."
            : "Inicie o Ollama em 127.0.0.1:11434 e instale o modelo configurado na API."}
          {" "}Sem cobrança por chamada, com processamento no seu computador.
        </p>
      )}
      {message && <p className={"provider-message " + (connectionError ? "is-error" : "")} role="status">{message}</p>}
    </div>
  );
}
