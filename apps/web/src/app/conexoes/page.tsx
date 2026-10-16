import { PlatformNav } from "@/components/platform-nav";
import { ConnectionsPanel } from "@/components/connections-panel";
import { ShieldCheck } from "lucide-react";

export default function ConnectionsPage() {
  return <div className="platform-shell"><PlatformNav/><main className="platform-container">
    <div className="platform-kicker"><ShieldCheck size={16}/> PRIMEIRO PASSO · SUA IA</div>
    <h1>Conexões de IA</h1>
    <p className="platform-lead">Conecte sua IA uma única vez. Escolha uma chave de API, o Ollama local ou uma conta ChatGPT autorizada. O Alinha Community funciona sem conta ou cadastro.</p>
    <ConnectionsPanel/>
  </main></div>;
}
