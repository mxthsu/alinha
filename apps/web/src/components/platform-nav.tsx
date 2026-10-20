"use client";
import {useState} from "react";
import Link from "next/link";
import {Menu,X} from "lucide-react";
import { ConnectionStatus } from "@/components/connection-status";

const pages = [
  { href: "/", label: "Início" },
  { href: "/agente", label: "Meu agente" },
  { href: "/studio", label: "Currículos" },
  { href: "/vagas", label: "Encontrar vagas" },
  { href: "/candidaturas", label: "Acompanhar" },
  { href: "/preparar", label: "Preparar candidatura" },
  { href: "/meu-alinha", label: "Meu Alinha" },
];

export function PlatformNav() {
  const [menuOpen,setMenuOpen]=useState(false);
  return <header className="platform-header">
    <nav aria-label="Navegação do Alinha" className="platform-navigation">
      <Link className="platform-brand" href="/">alinha<span>.</span></Link>
      <div className={"platform-links"+(menuOpen?" is-open":"")} id="platform-mobile-links">
        {pages.map(item=><Link key={item.href} href={item.href}
          onClick={()=>setMenuOpen(false)}>{item.label}</Link>)}
        <Link className="platform-mobile-connection" href="/conexoes"
          onClick={()=>setMenuOpen(false)}>Conexões de IA</Link>
      </div>
      <div className="platform-nav-tools">
        <div className="platform-connection"><ConnectionStatus variant="compact"/></div>
        <button className="platform-menu-toggle" type="button"
          aria-expanded={menuOpen} aria-controls="platform-mobile-links"
          aria-label={menuOpen?"Fechar menu de navegação":"Abrir menu de navegação"}
          onClick={()=>setMenuOpen(value=>!value)}>
          {menuOpen?<X size={19} aria-hidden="true"/>:<Menu size={19} aria-hidden="true"/>}
          <span>{menuOpen?"Fechar":"Menu"}</span>
        </button>
      </div>
    </nav>
  </header>;
}
