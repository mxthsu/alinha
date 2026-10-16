import type { Metadata } from "next";
import "./globals.css";
import "./platform.css";
import "./community.css";

export const metadata: Metadata = {
  title: "Alinha — Sua experiência, novas oportunidades",
  description: "Compare seu currículo com uma vaga usando IA e descubra evidências, lacunas e recomendações sem inventar experiências.",
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
