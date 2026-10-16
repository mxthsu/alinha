"use client";

import { useSyncExternalStore } from "react";

/**
 * Single browser-side source of truth for provider availability.
 * Navbar, hero, and Studio share a status request.
 */
export type ConnectionSnapshot = {
  phase: "checking" | "available" | "missing" | "offline";
  providers: string[];
};

type BackendStatus = {
  gemini?: { available?: boolean };
  anthropic?: { available?: boolean };
  openai_api?: { available?: boolean };
  chatgpt?: { connected?: boolean };
  ollama?: { available?: boolean };
};

const empty: ConnectionSnapshot = { phase: "checking", providers: [] };
let snapshot = empty;
const listeners = new Set<() => void>();
let lastFetch = 0;
let inFlight = false;
let interval: number | null = null;
const CACHE_MS = 15_000;

const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function publish(next: ConnectionSnapshot) {
  snapshot = next;
  listeners.forEach(listener => listener());
}

export function refreshProviderStatus(force = false) {
  if (typeof window === "undefined" || inFlight || (!force && Date.now() - lastFetch < CACHE_MS)) return;
  inFlight = true;
  lastFetch = Date.now();

  fetch(api + "/api/v1/providers/status", { cache: "no-store" })
    .then(async response => {
      if (!response.ok) throw new Error("Provider status unavailable");
      return await response.json() as BackendStatus;
    })
    .then(data => {
      const providers = [
        data.gemini?.available && "Gemini",
        data.anthropic?.available && "Claude",
        data.openai_api?.available && "OpenAI API",
        data.chatgpt?.connected && "ChatGPT",
        data.ollama?.available && "Ollama",
      ].filter((name): name is string => typeof name === "string");
      publish({ phase: providers.length ? "available" : "missing", providers });
    })
    .catch(() => publish({ phase: "offline", providers: [] }))
    .finally(() => { inFlight = false; });
}

function onFocus() { refreshProviderStatus(true); }

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener("focus", onFocus);
    window.addEventListener("provider-connection-changed", onFocus);
    interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshProviderStatus();
    }, 30_000);
    // A connection may have changed while no component was mounted.
    refreshProviderStatus(true);
  } else {
    refreshProviderStatus();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("provider-connection-changed", onFocus);
      if (interval !== null) clearInterval(interval);
      interval = null;
    }
  };
}

function getSnapshot() { return snapshot; }
function getServerSnapshot() { return empty; }

export function useProviderStatus() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
