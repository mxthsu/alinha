# Alinha — ponto de retomada para outro chat

> **Prova Desktop Rust/Tauri (23/10/2026):** a branch experimental `spike/tauri-rust-python-desktop` foi criada sobre `feat/desktop-architecture-poc` (PR #47). Reutiliza Next estático e a API Python atual; o host Rust passou em testes de arquivos, preferências e autenticação real de um processo Python em loopback. **Ainda não há shell Tauri compilado, ponte completa WebView → API nem instalador.** Ver [relatório técnico](desktop-tauri-rust-proof.md). Esta POC não substitui nem conclui as PRs de IA #50/#51, e não implica escolha definitiva de framework.

> **Fonte principal de contexto do projeto, atualizada em 22/10/2026.** Leia este arquivo, [AGENTS.md](../AGENTS.md), o código real na branch escolhida e os documentos vinculados **antes** de decidir a próxima tarefa. O estado do GitHub pode mudar; confirme branches, CI e PRs ao começar. Este texto não prova que funcionalidades planejadas já funcionem.

## Estado mais recente para continuar — integração real em PR (22/10/2026)

**Verifique a PR nova feat/integrated-career-agent antes de retomar.** Esta seção descreve trabalho proposto, **ainda não mergeado à main**. A visão abaixo permanece válida; a seção histórica "Próxima entrega de maior valor" reflete a etapa anterior à integração. Não fazer merge automático.

- **Base:** PR #45 (feat/agent-unified-journey-44) + unidades compatíveis da PR #41 (feat/continuous-career-journey). PR #42 segue experimental, **não utilizada**.
- **Rota principal /agente:** integra perfil da fonte local existente (importação PDF/DOCX/TXT e SQLite/legado), objetivo livre interpretado por regras determinísticas, confirmação para busca, conectores autorizados via API existente (source=all), classificação por evidências e ressalvas verificáveis, prévia editável para uma vaga, sem envio, e preparação avançada integrada na mesma tela. Links de origem e descrições completas são preservados no handoff seguro.
- **Retomada da #41:** career-handoff.ts persiste somente a vaga selecionada e a descrição revisada no localStorage, com leitura de seleção legada no sessionStorage; após reabrir, é necessário escolher explicitamente **Retomar**. Busca e respostas de IA **não são repetidas implicitamente**. Perfil continua em sua persistência original; dados desconhecidos exigem revisão.
- **Provedores de IA:** o componente existente PreparationJourney (preparação avançada expansível) usa ConnectedProviderPicker e adaptadores da API já implementados e dispara análise **somente após clique explícito**. Gemini, OpenAI API, Claude/Anthropic, Ollama e opções ChatGPT existentes dependem das conexões realmente disponíveis. Sem IA, busca, avaliação literal e prévia continuam possíveis.
- **PR #45:** conserva contratos, política e API sintética para testes, mas a interface duplicada de demonstração e seu transporte foram **retirados** da experiência principal. Não adicionar outro fluxo separado. Para execução real há um único ponto de entrada /agente.
- **Limites honestos:** busca tem cobertura parcial e pode falhar; não houve envio de candidatura, automação com credenciais, bypass de CAPTCHA/MFA, e a prévia não garante compatibilidade ATS. O teste visual no Chrome usa fontes interceptadas e dados fictícios, não prova disponibilidade de emprego real. Recuperação de resultados de busca após reinício não é persistida; somente seleção de vaga e descrição são recuperadas.
- **Validação:** executar testes Python da API, testes Node da Web, Ruff, ESLint e build. Smoke Chrome reproduzível: iniciar API e Next localmente com APPDATA/LOCALAPPDATA isolados, depois executar npm run test:browser dentro de apps/web (Chrome instalado; vagas interceptadas sinteticamente). Ver [jornada integrada](integrated-agent-journey.md). Não usar dados pessoais no smoke, screenshot ou commit.
- **Destino após aprovação:** usar **PR integrada como substituta** de #41 e #45; depois que a integração estiver mergeada, fechar as duas PRs como substituídas para evitar merge duplicado. **Não** fazer merge de #41/#45 separadamente antes da integração. #42 pode permanecer como referência experimental.

### Desempenho e arquitetura por especialidade — direção atual

O objetivo é um **agente rápido e responsivo**, não maximizar linguagens.
**Python/FastAPI permanece responsável por IA, currículos, documentos, ATS
e fontes de vagas**, TypeScript/React pela interface, SQLite pelos dados
locais. **Rust é candidato prioritário a um núcleo nativo de execução**
(estado, concorrência, cancelamento, supervisão, limites) se uma medição
de jornada ponta a ponta demonstrar ganho; Rust/Tauri concorre como shell
Desktop com Go/Wails. Go **não substitui Python** por padrão. Escolher shell
e coordenador por critérios separados, sem somar Go+Rust+Python sem necessidade.
Consultar [plano de desempenho e responsabilidades](architecture-performance-plan.md).
Nesta branch existe um primeiro entrypoint Python de API Desktop em porta
efêmera com segredo por sessão; a ponte nativa para WebView e distribuição
de sidecar **ainda não estão prontas**.

### Nova frente isolada: prova de arquitetura Desktop (Go/Wails vs Rust/Tauri)

A branch `feat/desktop-architecture-poc` foi criada **a partir da PR #46**, em worktree separada. Veja `docs/desktop-architecture-proof.md`. Next.js exportou a interface como arquivos estáticos; o teste real Chrome com API Python e vagas fictícias passou sem servidor Next. Go/Wails v2 compilou no Windows com Go portátil isolado, abriu janela nativa e passou em testes de rotas estáticas Go. A **API Python ainda não é sidecar empacotado** e não existe instalador de usuário final; foi criada a autenticação experimental da porta efêmera, mas a ponte segura entre WebView e shell nativo ainda não existe. Rust/Tauri ainda deve receber teste equivalente; **a arquitetura não está decidida**. Não publicar como release nem mergear em `main` até resolver essas questões.

### Incremento seguinte — geração de múltiplas prévias, sem novas permissões externas

Na branch feat/integrated-career-agent, quando o pedido inclui preparar candidaturas, a jornada agora monta **até três rascunhos locais automaticamente** a partir das vagas com URL segura, sem novas chamadas ao modelo. Duplicatas são removidas, resultados explicitamente fora dos filtros são descartados e cada prévia mostra fatos comprovados e pendências para revisão. A pessoa escolhe qual rascunho abrir/editar. Não envia nem tenta enviar candidaturas. O mecanismo não persiste uma fila de execução após reinício: a retomada segura da PR #41 continua guardando somente a vaga escolhida e sua descrição, não afirma execução anterior de fontes remotas.

O parser também aceita expressões como "quero trabalhar como...", reconhece preferência inequívoca por CLT ou PJ, sinaliza combinações ambíguas e não trata salário anual como piso mensal. Uma busca tem limite local de 30 segundos; timeout vira falha explícita, não sucesso. Testes sintéticos em apps/web/tests/agent-queue.test.mjs e smoke real de navegador usam API local isolada e vagas interceptadas. A contagem de testes Web aumentou para 64 no desenvolvimento local; confirme no commit/CI mais recente, pois este documento não substitui evidência do GitHub.

### Próxima evolução após a integração

Melhorar cobertura de fontes autorizadas, interpretação sem heurísticas frágeis e preparação avançada com usuários; validar provedor real apenas com chave de teste expressamente fornecida e limites. Não recomeçar pesquisa de stack. Rust/Go/TS/Python seguem opções, não requisitos. Community primeiro, Desktop e Cloud depois.

## Produto definido

O **Alinha** é um **agente de carreira**, não uma coleção de abas com IA. A pessoa deve conseguir delegar um objetivo em linguagem natural (“Encontre vagas de Python remotas, compare com meu perfil e prepare candidaturas”), acompanhar uma **única jornada visível** e intervir somente quando necessário. Importar currículo deve preencher um perfil editável; a busca prioriza oportunidades no Brasil; preparação de currículo e verificação ATS devem ser integradas; recomendações não podem inventar dados.

**Três formas de uso da mesma plataforma:**

| Nome público | Quem usa | Distribuição desejada | IA |
|---|---|---|---|
| **Alinha Community — Open Source** | Desenvolvedores, contribuidores e pessoas que hospedam por conta própria | Código no GitHub; setup reproduzível e opção self-hosted/CLI, conforme necessidade | BYOK e/ou modelo local; sem conta Alinha obrigatória |
| **Alinha Desktop** | Usuário final | Aplicativo instalável, janela própria, Windows/macOS/Linux quando validado | Conectar IA de modo simplificado, credenciais protegidas localmente |
| **Alinha Cloud** | Usuário que prefere serviço online | Site e processamento remoto, sem instalação | IA/infraestrutura gerenciada com controle de consumo; BYOK opcional a avaliar |

O Desktop **pode ser open source**; “Community” nomeia a distribuição voltada a desenvolvedores, não uma proibição de compartilhar o código Desktop. Cloud é um **produto futuro**, não hospedagem disponível hoje. Monetização (créditos, consumo, planos) **não foi fechada**; não presumir cobrança exclusivamente por mensalidade. Código público atual sob MIT; revisar implicações de licenças de qualquer dependência.

### Princípios estáveis
- **A experiência é agêntica; a execução é principalmente determinística.** IA interpreta intenção, ambiguidade e textos não estruturados; código executa ações previsíveis e controla estado, custos, erros e permissões.
- **IA intercambiável** por contrato único: Gemini/OpenAI/Claude/Ollama e outros compatíveis quando suportados; Community/Desktop com chaves próprias ou modelos locais; Cloud pode oferecer inferência gerenciada. Modelo não escolhe política de segurança.
- **Interface principal em uma tela**, com progresso, cancelamento, tarefas e revisão. Áreas manuais podem continuar, mas secundárias. Não mostrar o navegador headless preenchendo sites.
- **Privacidade e segurança:** dados pessoais mínimos, proveniência e veracidade, sem segredos em commits/logs. Não enviar candidaturas reais sem permissão específica, validação de respostas e confirmação externa. CAPTCHA, MFA, termos de plataformas e limitação de acesso exigem interrupção/handoff, nunca bypass.
- **Brasil primeiro**, texto/documentação em pt-BR e arquitetura preparada para i18n; evitar complexidade, slogans e poluição visual.
- Um **agente de carreira único com ferramentas**, não criar um enxame de agentes genéricos sem necessidade; framework de agentes opcional.

## Estado verificável do repositório `main` nesta data

**Existe código e um fluxo parcial; o produto não está em produção e não foi homologado pelo usuário de ponta a ponta.** Não confundir testes automatizados com lançamento.

| Área | Evidência de implementação | Limite conhecido |
|---|---|---|
| `apps/web` | Next.js/React: `/agente`, `/studio`, `/preparar`, `/vagas`, `/conexoes`, `/candidaturas` | Não há jornada de candidatura inteiramente agêntica/única validada |
| `apps/api` | FastAPI/Pydantic: importação estruturada de CV, análise com evidências, diagnóstico ATS, endpoints de buscas | Não há executor de aplicações externas em produção |
| IA | Adaptadores de provedores em `services/provider.py`, central de conexão, cofre local e workflows existentes | Nem todas as ações do agente usam um contrato universal de ferramentas |
| Dados | Armazenamento no navegador e migração/SQLite local em evolução | Testar efetivamente migração, recuperação e consistência entre telas |
| Vagas | Fontes públicas selecionáveis e integração parcial a ATS/boards | Cobertura, descrições completas, limites e autorização variam por fonte |
| Autorização | Modelos e `agent/policy.py` de planejamento | “Aprovado para despachar” na política **não é envio**; não há envio externo |

Ver [arquitetura implementada](architecture.md), [experiência atual do agente](agent-experience.md) e [plano Community](community-release-plan.md). As descrições detalhadas dessas páginas podem refletir etapas anteriores: este arquivo prevalece para **direção de produto**, não para afirmar comportamento do código.

## Arquitetura: decisão ainda aberta, sem viés por histórico ou novidade

- **Hoje implementado:** Next.js/TypeScript + FastAPI/Python + LangGraph em análises específicas. **Isso é um ponto de partida, não uma escolha irreversível.**
- **Interessam ao projeto:** Rust (coordenação/desktop/execução), Go (core e serviços), TypeScript (interface/automação) e Python (integrações/IA/extração).
- **NÃO foi decidido:** reescrever tudo em Rust, Go + Rust, migrar tudo para Python, substituir Next.js por Vite/Svelte, escolher Wails/Tauri/desktop, manter LangGraph para o agente completo.
- A escolha é por **capacidade, confiabilidade, distribuição, desenvolvimento e custo total**, não por microbenchmark de 100–400 ms nem por familiaridade. O usuário não quer novos ciclos longos de pesquisa abstrata: use experimentos *pontuais* quando houver bloqueio real.
- Referências de padrão: OpenCode, LoopCV, goose, Browser Use, Skyvern, Stagehand, Jan/AnythingLLM; são inspirações, **não bibliotecas já aprovadas para adoção**. Evitar copiar código/UI sem verificar licença.

**Experimentos isolados:** [PR #42 — benchmark de motores de navegador](https://github.com/mxthsu/alinha/pull/42) (**rascunho, não mergeada**), com testes sintéticos Ubuntu e Windows. Quatro motores passaram no Ubuntu; em Windows, Go/chromedp, TypeScript/Playwright e Rust/agent-browser completaram 10/10 formulários sintéticos cada; um coordenador Rust in-memory passou 6/6 testes; Go→Rust travou no Windows e **não foi validado**. As medições não são diretamente comparáveis em todos os cenários e **não elegem stack**. Detalhes e código ficam **na PR, não na main**: [relatório Windows](https://github.com/mxthsu/alinha/blob/chore/architecture-benchmark-2026/benchmarks/architecture/results-windows-2026-10-22.md). Não trazer experimentos para produção automaticamente.

## Situação do computador de desenvolvimento (precisa reconferir)

Em 22/10/2026 foi vista uma cópia local do Alinha na branch `feat/job-full-descriptions` com **muitas alterações não commitadas**, incluindo conectores de vagas e páginas web. Outra cópia `alinha-community-finish` também existe. **Essas alterações NÃO foram publicadas automaticamente no GitHub**. Antes de sincronizar qualquer checkout: `git status`, `git branch -vv`, `git diff --stat`, conferir remotes; nunca `reset --hard`, `clean -fd`, merge ou force-push nessas pastas sem revisar. Para trabalho novo, use branch/worktree/clone separado. O computador pode estar offline em outro chat.

## Próxima entrega de maior valor: um agente demonstrável, não nova reescrita

Fazer uma **fatia vertical integrada** e acessível em `/agente`: perfil de CV **fictício** → objetivo em linguagem natural → plano explicável → busca por fonte de teste ou autorizada → sinais e requisitos comprovados → prévia de candidatura a revisar na mesma tela. Usar fake provider para comportamento reprodutível; testar ao menos um adaptador real **somente** com chave de teste voluntária e limites. Nada de submissão real nesta fatia.

**Critérios de aceite obrigatórios:**
1. Uma solicitação explícita inicia uma jornada clara e permite cancelar; mensagens e estados em pt-BR.
2. A IA pode propor ações por esquema tipado, mas o executor valida ferramentas, argumentos, escopo, orçamento, origem e permissões; não obedece instruções embutidas em anúncios.
3. O currículo não é alterado silenciosamente; dados desconhecidos e perguntas sensíveis vão para revisão; nenhuma experiência é inventada.
4. Uma vaga falsa, perfil fictício e respostas simuladas permitem demonstrar ponta a ponta sem APIs pagas ou plataformas externas.
5. A UI não anuncia “enviado” se só gerou prévia; o estado é explícito (“rascunho”, “revisão necessária”, “não enviado”).
6. Testes de sucesso/falha/cancelamento/consentimento/limites, além de `uv run pytest -q`, `npm run test:local`, lint e build quando disponíveis.
7. Nenhum rework massivo de framework antes de haver gargalo concreto. Ajustes visuais subordinados ao objetivo de facilitar a delegação.

Ver [contrato proposto](agent-runtime-contract.md) e [roadmap](roadmap.md). Implementar por PRs pequenos, com evidência de execução.

## Como começar um novo chat, sem depender deste histórico

Copie e envie o seguinte pedido (e dê acesso ao GitHub/PC, se aplicável):

> Continue o projeto open source **mxthsu/alinha**. Leia primeiro `AGENTS.md`, `docs/CONTINUAR-ALINHA.md` e `docs/agent-runtime-contract.md`, depois inspecione a `main`, as PRs abertas e o código. A visão é um agente de carreira único, com **Community Open Source (dev), Desktop (aplicativo) e Cloud (online)**. IA conectável/BYOK; experiência em uma tela; execução determinística com IA seletiva; segurança e autorização obrigatórias. **Não presuma stack definitiva**: Rust/Go/Python/TypeScript seguem em avaliação, mas não pare para recomeçar pesquisa. Preserve mudanças locais não commitadas. Construa a próxima fatia vertical do `/agente` com fake provider, ferramentas autorizadas e prévia de candidatura **sem envio externo**, rode testes e abra PR. Relate o que foi implementado e o que segue pendente. Não confunda protótipos da PR #42 com código da `main`.

**Lembrete operacional:** GitHub `main` é fonte de código publicado; PRs são hipóteses e trabalho não integrado; documentação contém intenções. Confirme resultados em CI e no produto rodando antes de declarar qualquer recurso pronto.

## Atualização experimental Desktop — 23/10/2026, PR #52 (fora da main)

Na branch `spike/tauri-rust-python-desktop`, a CI Windows/MSVC compilou o executável Tauri e testou o supervisor Rust iniciando/autenticando/encerrando a API Python. O executável de prova também **abriu de verdade** no Windows conectado, com WebView2, em ambiente APPDATA/LOCALAPPDATA temporário. Uma sessão de teste CDP, restrita a loopback, navegou em `/agente`, verificou `desktop_status`, `GET /api/v1/providers/status` via invoke Rust, a recusa de `application.submit` e importou um currículo TXT **totalmente fictício** via upload WebView → bridge IPC → Python. Não foi usada fonte de vagas ou chave de IA real. Script reproduzível: `apps/desktop/tauri-probe/scripts/smoke-window.ps1 -BrowserJourney` mais `apps/web/tests/native-tauri-browser.mjs`.

A bridge Tauri usa allowlist, token desconhecido para JavaScript, limites e timeout. A chamada de API foi movida para `spawn_blocking` para não travar a thread da UI; confirmar na CI do commit mais recente antes de considerar essa alteração compilada. A CI disponibiliza temporariamente o executável **de teste**, não instalador. **Ainda pendente:** teste completo de busca de vagas e IA fictícias, sidecar Python empacotado, instalador assinado, recuperação após crash, métricas de desempenho reais e decisão Tauri/Wails.

**Importante:** a PR #52 permanece experimental e empilhada na #47. As PRs #50/#51 conectam IA à Community e continuam prioridade funcional; nada disso está na `main` até merge explícito e revisão. Preserve o checkout `Desktop\\alinha` com mudanças não commitadas.
