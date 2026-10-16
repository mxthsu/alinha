import { PlatformNav } from "@/components/platform-nav";
import { ConnectionsPanel } from "@/components/connections-panel";
import { ShieldCheck } from "lucide-react";

export default function ConnectionsPage() {
  return <div className="platform-shell"><PlatformNav/><main className="platform-container">
    <div className="platform-kicker"><ShieldCheck size={16}/> CONFIGURAÇÃO DA SUA IA</div>
    <h1>Conexões de IA</h1>
    <p className="platform-lead">Depois de entrar no Alinha, escolha um provedor. A conta Google identifica você; esta conexão autoriza o modelo usado nas análises.</p>
    <ConnectionsPanel/>
  </main></div>;
}
