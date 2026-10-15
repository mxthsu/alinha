# Como contribuir com o Alinha

Obrigado por considerar contribuir. O Alinha é construído inicialmente para o público brasileiro.

## Convenções

- Código, identificadores, nomes de arquivos e commits em inglês.
- Interface, mensagens de usuário, README e documentação voltada ao público em português brasileiro.
- Commits com Conventional Commits, por exemplo: `feat(api): add evidence validation`.
- Alterações em IA devem trazer testes sem dados reais, explicação das limitações e revisão de exposição de informações pessoais.

## Fluxo

1. Abra uma issue descrevendo o problema ou a proposta, de preferência em português.
2. Crie uma branch curta, como `feat/resume-parser` ou `fix/evidence-check`.
3. Desenvolva com dados sintéticos e execute os testes locais.
4. Abra um pull request em português, com resumo, impacto e instruções de validação.
5. O CI roda em pull requests, evitando execuções desnecessárias a cada push em branches comuns.

Evite enviar chaves, tokens, currículos reais ou dados de candidatos para o GitHub.

## Testes

API: `cd apps/api && uv run pytest -q && uv run ruff check .`

Site: `cd apps/web && npm run lint && npm run build`

As funcionalidades de IA devem ser testáveis com fornecedores fictícios (fakes), sem exigir chamadas pagas.
