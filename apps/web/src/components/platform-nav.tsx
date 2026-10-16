"use client";
import Link from "next/link";
import { ConnectionStatus } from "@/components/connection-status";

const pages = [
  { href: "/", label: "Início" },
  { href: "/studio", label: "Currículos" },
  { href: "/ats", label: "Verificar ATS" },
  { href: "/analisar", label: "Analisar vaga" },
];

export function PlatformNav() {
  return <header className="platform-header">
    <nav aria-label="Navegação do Alinha" className="platform-navigation">
      <Link className="platform-brand" href="/">alinha<span>.</span></Link>
      <div className="platform-links">{pages.map(item =>
        <Link key={item.href} href={item.href}>{item.label}</Link>
      )}</div>
      <ConnectionStatus variant="compact"/>
    </nav>
  </header>;
}
