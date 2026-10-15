# Guia para agentes de desenvolvimento

- Este repositório é o **Alinha**: análise responsável de currículos em relação a vagas, com evidências verificáveis.
- Interfaces, mensagens destinadas ao usuário e documentação pública: **português brasileiro (pt-BR)**.
- Identificadores de código, contratos técnicos, diretórios, arquivos de código e mensagens de commit: **inglês**, seguindo convenções usuais.
- Não inventar habilidades, experiências, números, compatibilidade ATS ou garantias de contratação.
- Nunca usar currículos ou dados reais em testes, exemplos, logs, screenshots ou commits.
- Chamadas de IA devem ser substituíveis por fakes em testes; toda evidência literal deve ser verificada independentemente do modelo.
- Não adicionar RAG, agentes adicionais, armazenamento persistente, filas ou bancos vetoriais sem um caso de uso definido e testes.
- Alterações relevantes devem incluir testes e documentação atualizada; preferir PRs pequenos e commits Conventional Commits.
- CI executa testes em pull requests; não habilitar builds redundantes a cada push sem necessidade.
- Projeto original em português, com estrutura preparada para uma futura versão en-US; não criar um segundo repositório para tradução.
