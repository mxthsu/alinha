"use client";
import Link from "next/link";
import { CircleUserRound } from "lucide-react";

const pages = [
  { href: "/inicio", label: "Início" },
  { href: "/studio", label: "Meus currículos" },
  { href: "/ats", label: "Verificar ATS" },
  { href: "/analisar", label: "Analisar vaga" },
  { href: "/conexoes", label: "Conexões de IA" },
];

export function PlatformNav() {
  return <header className="platform-header">
    <nav aria-label="Navegação do Alinha" className="platform-navigation">
      <Link className="platform-brand" href="/inicio">alinha<span>.</span></Link>
      <div className="platform-links">{pages.map(item =>
        <Link key={item.href} href={item.href}>{item.label}</Link>
      )}</div>
      <Link href="/" className="platform-account"><CircleUserRound size={16}/> Conta</Link>
    </nav>
  </header>;
}
