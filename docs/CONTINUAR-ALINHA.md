# Alinha — ponto de retomada para outro chat

> **Fonte principal de contexto do projeto, atualizada em 23/10/2026.** Leia este arquivo, [AGENTS.md](../AGENTS.md), o código real na branch escolhida e os documentos vinculados **antes** de decidir a próxima tarefa. O estado do GitHub pode mudar; confirme branches, CI e PRs ao começar. Este texto não prova que funcionalidades planejadas já funcionem.

## Em revisão — integração de IA (23/10/2026)

**Estas funcionalidades NÃO estão na `main` enquanto as PRs permanecerem abertas:**

- [PR #50](https://github.com/mxthsu/alinha/pull/50), branch `feat/agent-connected-ai-48`: primeiro passo de IA no fluxo real, opt-in; Gemini/OpenAI API/Claude API/Ollama interpretam **somente o objetivo profissional**; a pessoa confirma o cargo sugerido e ainda autoriza a busca separadamente. Nenhuma candidatura externa, sem homologação ao vivo com chaves reais.
- [PR #51](https://github.com/mxthsu/alinha/pull/51), branch `feat/agent-tool-plan-budget-48`: **empilhada sobre a #50**. Até duas reservas de chamadas de IA por UUID de jornada, com SQLite local/concorrência/idempotência; plano tipado `job.search → job.assess → application.preview` (última opcional) é exibido como **proposto**, nunca executado pelo modelo. Esta é uma quota de chamadas por identificador, **não teto financeiro global**.
- Ambas passaram localmente: #51 teve **230 testes Python, 67 testes web, lint/build e smoke Chrome com fakes**, zero envio externo. Verificar os resultados mais recentes do GitHub Actions antes do merge.
- **Ordem de integração:** revisar/mergear #50 primeiro; depois ajustar base da #51 conforme o GitHub exigir, para evitar duplicação de commits. Não fazer merge da PR experimental #47 de Desktop nem mudar de stack por preferência.
- Próximo requisito técnico real da [issue #48](https://github.com/mxthsu/alinha/issues/48): conectar ferramentas a um coordenador com eventos duráveis, cancelamento e recuperação, além de aferição real de tokens/custos e teste autorizado de pelo menos um provedor. Os planos tipados da #51 ainda dependem de execução **determinística da interface existente**. Não anunciar agente autônomo completo.

## Estado atual — agente integrado na `main` (22/10/2026)

**Implementação publicada:** a [PR #46](https://github.com/mxthsu/alinha/pull/46) foi incorporada por squash no commit `f023afc5` após revisão independente no Chrome e CI aprovada. As PRs #41 e #45 foram **encerradas como substituídas, sem merge independente**. A issue #44 continua disponível como histórico dos critérios de primeira jornada; a próxima tarefa ativa é a [issue #48](https://github.com/mxthsu/alinha/issues/48).

- **Rota principal `/agente`:** usa o currículo existente (importação PDF/DOCX/TXT, Studio, SQLite/legado), recebe pedido natural em pt-BR, exige autorização para consulta a vagas, chama os conectores autorizados já existentes (`source=all`) e mostra evidências, ressalvas e oportunidades.
- **Rascunhos:** até **três prévias locais** para vagas compatíveis com link HTTPS seguro, sem invenção de competências, sem IA obrigatória e sem envio externo. O usuário escolhe e revisa individualmente. Informações ausentes e filtros não comprovados são sinalizados.
- **Preparação avançada integrada:** no mesmo `/agente`, uma seção opcional oferece leitura ATS resumida, seleção de provedor de IA e análise da vaga; não repete upload, outro wizard ou conclusão de percurso. A rota independente `/preparar` preserva o fluxo completo.
- **Retomada:** a vaga selecionada e a descrição revisada podem ser recuperadas no mesmo dispositivo, com retomada explícita e rascunho gerado a partir das evidências. **Histórico da busca, fila completa e execução de IA não são recuperados automaticamente** após reinício.
- **IA atual:** a integração existente permite análises opcionais mediante ação específica e conexão do usuário. **O modelo ainda não participa do planejamento e da execução principal com ferramentas tipadas** — isso está na issue #48; não afirmar que o Alinha é um agente plenamente autônomo.
- **Validação:** no PC de desenvolvimento, 216 testes API + Ruff, 64 testes web + ESLint + Next build, Chrome com API local e CV/vagas fictícios, sem overflow mobile, sem envios. [CI do commit anterior ao merge](https://github.com/mxthsu/alinha/actions/runs/39889814580) foi aprovada. Smoke browser com fonte de vagas interceptada; **não** homologou fontes externas reais nem provedor BYOK com credencial real.
- **Arquitetura:** código integrado continua Next.js/TypeScript + FastAPI/Python e SQLite. **Não houve escolha definitiva de stack.** Rust, Go e TypeScript permanecem alternativas fundamentadas por casos reais, não metas de migração. [PR #42](https://github.com/mxthsu/alinha/pull/42) é benchmark isolado.
- **Desktop:** [PR #47](https://github.com/mxthsu/alinha/pull/47) permanece **rascunho experimental** empilhado sobre a branch anterior à PR #46. A prova Wails/Go não inclui aplicativo com API distribuível e comunicação plenamente segura; Tauri/Rust não foi validado sob cenário equivalente. **Não fazer merge nem mudar a prioridade para Desktop enquanto a Community ainda precisa do agente conectado à IA.**
- **Cloud:** futura; nenhum SaaS/comercialização lançada.

### Próximo trabalho prioritário — issue #48

Construir uma ligação controlada entre a IA escolhida e **a jornada real**: `FakeAIProvider` para CI + adaptação real de provedor autorizada quando houver chave de teste; interpretação de intenção e propostas estruturadas, executor de ferramentas por allowlist, orçamento, timeout, cancelamento e eventos exibidos na única tela. O código determinístico continua cuidando de busca, filtros, deduplicação, evidências e execução. Nenhuma submissão de candidatura externa na próxima entrega.

**Evite criar outra demonstração paralela**, inventar dados reais ou reescrever o núcleo por preferência. Trabalhe numa nova PR pequena da `main`, preserve alterações não commitadas no checkout `feat/job-full-descriptions` e teste no navegador com dados fictícios. Leia a [issue #48](https://github.com/mxthsu/alinha/issues/48) como checklist.

### Como continuar em outro chat

> No GitHub `mxthsu/alinha`, leia `AGENTS.md`, `docs/CONTINUAR-ALINHA.md` e `docs/agent-runtime-contract.md`. A **PR #46 já foi mergeada**; #41/#45 foram encerradas. Siga a **issue #48**: conecte a IA selecionada à jornada principal existente em `/agente`, com propostas de ferramentas verificadas, limites, cancelamento e fallback determinístico. Não recomece pesquisa de stack, não abandone os componentes atuais e **não** priorize a PR #47 de Desktop. Preserve checkouts locais modificados. Entregue implementação e testes por PR, sem envio externo de candidaturas.

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
