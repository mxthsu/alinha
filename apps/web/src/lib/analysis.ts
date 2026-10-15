export type MatchStatus = "evidenciado" | "parcial" | "nao_identificado";

export type Requirement = {
  requirement: string;
  job_evidence: string;
  status: MatchStatus;
  resume_evidence: string | null;
  recommendation: string;
};

export type AnalysisResult = {
  job_title: string;
  summary: string;
  requirements: Requirement[];
  limitations: string[];
  analysis_mode: "ai" | "demo";
};

export const DEMO_REPORT: AnalysisResult = {
  job_title: "Pessoa Desenvolvedora Backend",
  summary: "Foram analisados 3 requisitos: 1 com evidências no currículo, 1 com evidências parciais e 1 sem evidência identificada.",
  analysis_mode: "demo",
  requirements: [
    {
      requirement: "Python e FastAPI",
      job_evidence: "Experiência com desenvolvimento de APIs em Python e FastAPI",
      status: "evidenciado",
      resume_evidence: "Desenvolvimento de APIs REST com Python e FastAPI",
      recommendation: "Você pode detalhar resultados e impactos reais desses projetos para fortalecer o currículo.",
    },
    {
      requirement: "Testes automatizados",
      job_evidence: "Conhecimento em testes automatizados",
      status: "parcial",
      resume_evidence: "Colaboração com a equipe na validação de funcionalidades",
      recommendation: "Esclareça quais testes você executou e quais ferramentas utilizou, se tiver essa experiência.",
    },
    {
      requirement: "Kubernetes",
      job_evidence: "Vivência com Kubernetes em produção",
      status: "nao_identificado",
      resume_evidence: null,
      recommendation: "Não foi localizada evidência no currículo. Inclua uma experiência verdadeira, caso a possua.",
    },
  ],
  limitations: [
    "Este é um exemplo fictício, não uma análise de um currículo real.",
    "A classificação não equivale à pontuação de sistemas ATS.",
  ],
};

export const statusLabels: Record<MatchStatus, string> = {
  evidenciado: "Com evidência",
  parcial: "Evidência parcial",
  nao_identificado: "Não identificado",
};
