# Escolha de arquitetura sem viés — registro de decisão aberta (22/10/2026)

**Status: em avaliação, nenhuma migração aprovada.** O Alinha ainda não foi lançado; podemos reescrever componentes quando fizer sentido, mas adotar novidade ou preservar código existente por hábito são ambos vieses. A decisão não é uma competição de linguagens.

## Alternativas viáveis
| Papel | Base atual | Alternativas | Evidência necessária |
|---|---|---|---|
| UI única do agente | React/Next.js | React/Vite, Svelte ou outro | usabilidade real, integração Desktop, custo de migração |
| Coordenador/serviços | Python/FastAPI + fluxos LangGraph existentes | Go, Rust, TS, Python com estado explícito | ferramentas, persistência/retomada, testes, manutenção, empacotamento |
| Automação de formulários | **não disponível no produto** | Playwright/TS, chromedp/Rod/Go, agent-browser/Rust, alternativas compatíveis | formulários variados, erros, login autorizado, consistência, RAM, distribuição |
| IA | adaptadores Python em análises específicas | contrato `AIProvider` neutro | BYOK/local, JSON/tool calling, budget, qualidade e falhas |
| Persistência | navegador + SQLite em migração | reaproveitar o que está validado, trocar apenas quando necessário | versões, recuperação, segurança e dados portáveis |

## O que foi medido
- [PR #42](https://github.com/mxthsu/alinha/pull/42) contém provas **isoladas** e permanece **não incorporada** à `main`.
- GitHub Actions Ubuntu: 10/10 para Playwright/TS, chromedp/Go, agent-browser/Rust e ponte Go→Rust no mesmo fixture; as medianas ficaram próximas após corrigir uma comparação anterior metodologicamente injusta. **Não é benchmark científico de linguagens.**
- Em Windows, os três motores individuais concluíram 10/10 formulários sintéticos. Coordenador Rust nativo com threads e regras básicas passou 6/6 testes in-memory. O comando Go→Rust travou nessa plataforma; **não foi validado**.
- Cobertura: formulário sintético simples com campo condicional, duas etapas, anexo e confirmação fictícia; não prova compatibilidade com Gupy, Workday, LinkedIn ou ATS reais nem execução de IA ponta a ponta.
- Não foram validados instalador Desktop, memory profile completo, política multitenant Cloud ou saldo real de IA.

## Regra de decisão

1. **Primeiro implementar um fluxo vertical e demonstrar UX**, a partir dos componentes mais próximos de funcionar, sem migrar tudo.
2. Se o núcleo atual ficar complicado de distribuir, monitorar ou manter, comparar pontualmente Go/Rust/TS/Python no **mesmo caso de uso**, incluindo custo humano e erros.
3. Rust é um candidato legítimo a coordenação e Desktop, não uma escolha obrigatória. Go também é candidato; uma dupla Go+Rust **precisa justificar dois runtimes**. Python é legítimo para IA/documentos; TypeScript é legítimo para automação.
4. Não misturar efeitos de subprocessos, sessões aquecidas e novas abas com comparações de linguagens. Nem sempre menor mediana significa mais confiabilidade.
5. Não adicionar LangGraph, MCP, filas, RAG, banco vetorial ou múltiplos agentes *por moda*. Só quando exigidos pelo fluxo e com teste.
6. Alterações de arquitetura devem vir como PR e migração reversível; testes com dados sintéticos; documentação/instalação coerentes.

**Ponto de parada da discussão:** não reabrir esta escolha abstratamente em todo chat. Retomar pela entrega concreta definida em [CONTINUAR-ALINHA.md](CONTINUAR-ALINHA.md). Se um gargalo real surgir, executar um experimento limitado e registrar o resultado aqui.
