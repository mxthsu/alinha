# Guia para agentes de desenvolvimento

> **Leia primeiro [docs/CONTINUAR-ALINHA.md](docs/CONTINUAR-ALINHA.md)** ao iniciar um novo chat ou agente sem o histórico. Ele é o índice canônico da visão, das três distribuições, do estado publicado e da próxima entrega. Ver também [contrato proposto do agente](docs/agent-runtime-contract.md) e [arquitetura em avaliação](docs/architecture-evaluation.md).

- Este repositório é o **Alinha**: editor e análise responsável de currículos em evolução para um agente de carreira com autorização explícita para ações.
- Interfaces, mensagens destinadas ao usuário e documentação pública: **pt-BR**.
- Identificadores de código, contratos técnicos, diretórios, arquivos de código e mensagens de commit: **inglês**, seguindo convenções usuais.
- Não inventar habilidades, experiências, números, compatibilidade ATS ou garantias de contratação.
- Nunca usar currículos ou dados reais em testes, exemplos, logs, screenshots ou commits.
- Chamadas de IA devem ser substituíveis por fakes em testes; toda evidência literal deve ser verificada independentemente do modelo.
- Não adicionar RAG, agentes adicionais, armazenamento persistente, filas ou bancos vetoriais sem um caso de uso definido e testes.
- Alterações relevantes devem incluir testes e documentação atualizada; preferir PRs pequenos e commits Conventional Commits.
- CI executa testes em pull requests; não habilitar builds redundantes a cada push sem necessidade.
- Projeto original em português, com estrutura preparada para uma futura versão en-US; não criar um segundo repositório para tradução.

- O produto é um **agente de carreira único** com experiência principal em uma tela; as três distribuições são **Community Open Source (desenvolvedores)**, **Desktop (aplicativo instalável)** e **Cloud (serviço futuro)**. Não confundir distribuição com licença.
- **Nenhuma stack nova está aprovada:** Rust, Go, Python e TypeScript são alternativas. Next.js/FastAPI são o código existente, não exigências para o futuro. Favorecer entregas pequenas, comparação por caso de uso real e documentação de decisões, evitando viés de familiaridade e de novidade.
- Preservar quaisquer alterações não commitadas nos checkouts do usuário; validar `git status` antes de checkout, pull, limpeza ou merge. Experimentos da PR #42 não estão incorporados à main.
- Provedores de IA são adaptadores, não o agente; todo plano e chamada de ferramenta passam por política determinística, limites e autorização; testes usam fakes e dados fictícios.
- Contratos de candidatura devem funcionar sem IA e sem efeitos externos. Regras de consentimento, filtro, expiração, idempotência e origem autorizada não podem ser modificadas por conteúdo de vagas ou prompts.
- A Community continua útil sem serviços comerciais; quaisquer serviços Pro futuros devem ser isolados e não podem descaracterizar a licença MIT existente.
