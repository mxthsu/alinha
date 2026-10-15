# Como contribuir com o Alinha

O Alinha é um projeto aberto, mantido com foco em transparência, privacidade e análises fundamentadas em evidências. Contribuições de código, testes, documentação e experiências de uso são bem-vindas.

## Antes de começar

Leia o [README](README.md), o [guia de instalação](docs/getting-started.md), as [decisões de arquitetura](docs/architecture.md) e o [roteiro](docs/roadmap.md). Confira se já existe uma [issue](https://github.com/mxthsu/alinha/issues) sobre a alteração desejada.

Para reportar um problema, abra uma issue com etapas reprodutíveis **usando somente currículos e vagas fictícios**. Para problemas de segurança, siga [SECURITY.md](SECURITY.md), sem publicar detalhes de exploração.

## Configure seu ambiente

```sh
git clone https://github.com/mxthsu/alinha.git
cd alinha
python scripts/dev.py
```

No Windows, você pode usar `py -3 scripts/dev.py`. Mais informações estão no [guia de instalação](docs/getting-started.md).

## Convenções

- **Código e identificadores técnicos em inglês.** Interface, README e documentação pública em português brasileiro.
- Use branches com nomes objetivos: `feat/resume-parser`, `fix/evidence-check`, `docs/setup-guide`.
- Prefira alterações pequenas e verificáveis; utilize Conventional Commits como `feat(api): improve evidence validation`.
- Não introduza dependências, agentes, bancos ou serviços apenas para aumentar a complexidade.
- Toda mudança em provedores ou IA precisa de testes independentes de uma chamada real, análise de custos e documentação de limitações.
- **Não envie currículos reais, senhas, tokens, cookies, chaves ou dados de terceiros para o repositório ou CI.**
- Nunca apresente dados simulados como se fossem resultados reais; identifique demonstrações fictícias.

## Testes

API:

```sh
cd apps/api
uv run pytest -q
uv run ruff check .
```

Interface:

```sh
cd apps/web
npm run lint
npm run build
```

Para o build do Next.js, pare primeiro a instância `npm run dev` que utiliza a mesma pasta `.next`.

## Fluxo de pull request

1. Abra ou escolha uma issue e defina o comportamento esperado.
2. Implemente a menor mudança que resolva o problema.
3. Adicione testes e atualize a documentação, quando necessário.
4. Execute as verificações relacionadas à mudança.
5. Abra um PR explicando o que foi alterado, como validar e os limites conhecidos.
6. Aguarde o CI e a revisão antes do merge.

O CI é executado em pull requests e também pode ser iniciado manualmente. Não há necessidade de executar builds a cada commit na branch.

## Acessibilidade e privacidade

Ao alterar o frontend, valide navegação por teclado, contraste, feedback de erro e preferência por movimento reduzido. Ao alterar a análise, preserve as citações literais e nunca inclua alegações sem evidência. Mudanças que envolvam dados pessoais ou autenticação devem ser revisadas antes de disponibilizar publicamente.
