# Arquitetura por responsabilidade e desempenho — Alinha

**Registro de direção, não decisão de runtime (22/10/2026).**

## O objetivo não é maximizar o número de linguagens

O Alinha deve responder e reagir rapidamente: perceber a intenção, mostrar
progresso, buscar fontes independentes em paralelo com limites, conferir
evidências e entregar rascunhos revisáveis. Precisamos medir tempos percebidos,
confiabilidade, recursos e custo de manutenção, não eleger uma linguagem por
microbenchmark ou expectativa.

### Separação funcional a preservar

| Responsabilidade | Base preferencial | Quando considerar mover |
|---|---|---|
| UI, progresso, revisão e i18n | React / TypeScript | Só por UX ou requisitos concretos |
| IA, extração de PDF/DOCX, regras ATS e integrações de vagas | Python / FastAPI | Permanecem em Python: já existe cobertura e ecossistema |
| Contrato de ferramentas, política, estado e coordenação | Porta independente de linguagem; implementação atual em Python/TS | **Rust candidato** para núcleo nativo de baixa latência, concorrência, cancelamento, limites e supervisão, depois de testar uma jornada inteira |
| Aplicativo Desktop | **Rust/Tauri v2** ou **Go/Wails v2** | Escolher com a mesma UI, mesma API Python e métricas comparáveis; somente **um shell nativo** |
| Persistência local | SQLite; navegação com estado mínimo no browser | Consolidar backups e migração; não introduzir outro banco sem necessidade |
| Cloud futura | API Python com outro adaptador de hospedagem, mesmas interfaces | Somente com auth, quotas, segurança e custo controlados |

Não substituímos Python por Go nem por Rust. Se Rust for o coordenador, será
um **orquestrador de ferramentas com estado** que chama serviços Python
por um contrato estável, não um novo parser de CV ou integração com IA.
Go pode continuar somente como shell Desktop se Wails vencer a comparação.
Evitar Go+Rust+Python numa instalação sem benefício provado.

## O que deve ser medido (p95 e falhas, não apenas média)

1. Do clique até o primeiro progresso visível e até a possibilidade de cancelar.
2. Importar CV: extração/documento versus persistência e apresentação.
3. Busca: latência **por fonte**, concorrência, rate limits, falha parcial e
   tempo para os primeiros resultados úteis. O agregador Python já usa até
   4 threads em `search_multi_source` — **não é serial**.
4. Comparar 10–40 vagas com dados do currículo, deduplicar e gerar até 3 prévias:
   tempo puramente local, CPU e memória.
5. Análise opcional: tempo esperando provedor externo e tokens; comparar
   qualidade de resposta e orçamento, não desempenho do runtime local.
6. Cold start do aplicativo, memória de **todos** os subprocessos, vida útil
   do sidecar, recuperação e portabilidade (Windows/macOS/Linux).
7. Testes de cancelamento, deadline, isolamento de credenciais, atualização,
   queda de fontes, erros de rede e não envio não autorizado.

Para cada caso: **mesma entrada fictícia, mesmos mocks, mesma política e
funcionalidade**. Registrar p50/p95 de várias execuções, desvio,
uso real de CPU/RAM e comportamento sob timeout. Não tomar decisão com o
benchmark sintético de formulário da PR #42, nem com o tamanho do shell
Wails isolado.

## Como decidir por uma implementação em Rust

- Se o coordenador Python acumular custo material de processamento, estado
  ou operações concorrentes, criar **prova Rust pequena** implementando
  `StartRun/RunEvent/ToolResult` e porta para ferramentas Python.
- Medir **end-to-end** com busca e preparo fictícios, 5–25 tarefas, falhas,
  cancelamento, tempo limite e retomada. Verificar que payloads do modelo
  não autorizam ferramentas, não vazam token e não inventam evidências.
- Se Rust demonstrar ganho relevante de latência/recursos/confiabilidade
  **sem complicar instalação e manutenção**, usá-lo como coordenador/
  runtime nativo. Caso contrário, manter o fluxo em Python, medindo novamente
  quando o produto crescer.
- Tauri/Rust no shell não implica migrar toda a lógica do agente para Rust.
  Wails/Go ter janela funcional também não implica migrar o agente para Go.

## Interface entre shell e Python

O entrypoint experimental `alinha_api.desktop_entry` inicia FastAPI em porta
efêmera **somente loopback**, recebendo do shell um token aleatório secreto
por variável de ambiente; o middleware só habilita a checagem se esse modo
estiver configurado, preservando o Community existente. Inicialização real,
401/403, desligamento e falha são verificados em testes com dados fictícios.
O token **não pode** ser incluído em JavaScript, argumentos de linha de
comando, logs, localStorage ou URL.

O shell Desktop deve hospedar os assets e atuar como ponte autenticada,
verificar /health, supervisionar o subprocesso, limpar seus recursos e
não permitir que um site remoto injete comandos. **Isso ainda não foi
conectado a um shell distribuível**; a PoC atual Wails ainda não possui
backend pessoal integrado. Não lançar nem usar currículo real nessa PoC.

## Critério de conclusão

Arquitetura consolidada quando os contratos de execução são testados, um
Desktop com Python empacotado funciona do zero com isolamento, a jornada
real não precisa de Next.js servidor, a comparação Rust/Tauri × Go/Wails
tem dados equivalentes e existe uma ADR explicando o conjunto escolhido.
Até lá: **Python continua núcleo funcional e Rust é candidato à camada
de desempenho, não uma migração aprovada**.
