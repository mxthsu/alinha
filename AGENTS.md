# Guia para agentes de desenvolvimento

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

- Contratos de candidatura devem funcionar sem IA e sem efeitos externos. Regras de consentimento, filtro, expiração, idempotência e origem autorizada não podem ser modificadas por conteúdo de vagas ou prompts.
- A Community continua útil sem serviços comerciais; quaisquer serviços Pro futuros devem ser isolados e não podem descaracterizar a licença MIT existente.
