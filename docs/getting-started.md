# Primeiros passos — Community em desenvolvimento

> Esta instalação por código é para **Alinha Community Open Source**, voltado a desenvolvedores. **Alinha Desktop** (instalador para usuários comuns) e **Alinha Cloud** (serviço online) ainda não foram lançados. Consulte [o ponto de retomada](CONTINUAR-ALINHA.md) para o estado real e o próximo desenvolvimento. Next.js/FastAPI são a base atual, não uma decisão final da stack.

Este guia coloca o Alinha Community em execução no seu próprio computador. A interface funciona no navegador e a demonstração não exige conta, cartão ou chave de IA.

> **Estado do projeto:** versão de desenvolvimento. A instalação simplificada inicia o site e a API, mas não é um instalador de desktop nem um serviço público hospedado.

## Requisitos

- [Python 3.11+](https://www.python.org/downloads/)
- [uv](https://docs.astral.sh/uv/getting-started/installation/)
- [Node.js 24 LTS](https://nodejs.org/) e npm
- Git para clonar o repositório
- Windows, macOS ou Linux; execução testada localmente no Windows

## Instalação

Abra um terminal e execute:

```sh
git clone https://github.com/mxthsu/alinha.git
cd alinha
python scripts/dev.py
```

No Windows, se `python` não estiver disponível no PATH, use `py -3 scripts/dev.py`. O iniciador também detecta o executável `uv` instalado com `pip --user` na pasta de scripts do Python, mesmo quando essa pasta ainda não está no PATH.

Na primeira execução, o script instala as dependências da API com **uv** e da interface com **npm ci**. Depois inicia os dois serviços apenas em `127.0.0.1`:

- **Site:** http://localhost:3000 (ou http://127.0.0.1:3000; o site usa o mesmo hostname local para chamar a API)
- **API:** http://127.0.0.1:8000/health
- **Documentação da API:** http://127.0.0.1:8000/docs

Mantenha o terminal aberto. Pressione **Ctrl+C** para encerrar a aplicação.

Para verificar os requisitos sem iniciar os servidores:

```sh
python scripts/dev.py --check
```

Se atualizar o repositório e alterar as dependências JavaScript, execute:

```sh
python scripts/dev.py --reinstall
```

## Experimente uma análise de demonstração

1. Abra http://localhost:3000. O Community não pede login: o hero e o rodapé apresentam o produto. O status da IA aparece na navegação e no botão principal do hero.
2. Clique em **Conectar IA** se não houver um provedor ativo, ou em **IA conectada** para gerenciar a conexão existente. Configure uma chave, ChatGPT autorizado ou Ollama em `/conexoes`.
3. Escolha **Criar currículo** (`/studio`) ou **Preparar candidatura** (`/preparar`), que reúne leitura ATS sem IA e comparação opcional com vaga. O Studio permite importar PDF/DOCX/TXT e preencher diretamente os campos, que podem ser editados no formulário.
4. Informe currículo e descrição da oportunidade e clique em **Analisar correspondência**. É possível visualizar um relatório demonstrativo fictício sem chamar o provedor.
5. Confira as evidências e limitações do relatório. Consulte [Community e Cloud](authentication.md) antes de enviar documentos próprios.

É a forma recomendada de conhecer a interface antes de enviar documentos próprios. Para testar o preenchimento, use os [arquivos fictícios de exemplo](../examples/README.md).

## Ative uma análise real com Gemini

Crie o arquivo local `apps/api/.env` a partir de `apps/api/.env.example` e informe uma chave do provedor:

```dotenv
GEMINI_API_KEY=sua_chave_aqui
GEMINI_MODEL=gemini-3.5-flash-lite
FRONTEND_ORIGIN=http://localhost:3000
```

O arquivo `.env` já está excluído do versionamento. Não o compartilhe em issues, commits ou prints.

Reinicie o script e envie um **currículo fictício** e uma vaga fictícia para seu primeiro teste. O Gemini pode ter custos ou quotas e recebe os textos para processamento conforme suas políticas.

### Outros provedores

A central **Conexões de IA** oferece Gemini, Claude (chave Anthropic), OpenAI API, ChatGPT OAuth local e Ollama. As chaves são verificadas antes de salvar no cofre do sistema. Os testes automáticos usam dados fictícios; **autenticações e inferências reais ainda exigem validação voluntária**. Leia [provedores e segurança](providers.md).

Para login ChatGPT local, se você configurou um arquivo `.env`, utilize `ALINHA_LOCAL_AUTH_ENABLED=1` nele e reinicie os serviços. Sem `.env`, `python scripts/dev.py` habilita essa opção de login **somente na API vinculada a 127.0.0.1**. O uso do plano é solicitado somente após seu consentimento no navegador.

O Alinha Cloud não está disponível.

## Execução manual

Se preferir ter controle dos serviços em terminais separados:

Terminal 1:

```sh
cd apps/api
uv sync --dev --frozen
uv run uvicorn alinha_api.main:app --app-dir src --host 127.0.0.1 --port 8000 --no-access-log
```

Adicione `--env-file .env` quando o arquivo `apps/api/.env` existir.

Terminal 2:

```sh
cd apps/web
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3000
```

## Testes

```sh
cd apps/api
uv run pytest -q
uv run python ../../scripts/smoke_community.py
uv run ruff check .
```

Para verificar a interface, em outro terminal:

```sh
cd apps/web
npm run lint
npm run build
```

**Importante:** não execute `npm run build` enquanto o servidor `npm run dev` estiver em funcionamento na mesma pasta. Pare o servidor antes, pois ambos podem interferir na pasta `.next` de desenvolvimento.

## Solução de problemas

| Sintoma | O que conferir |
| --- | --- |
| Comando `uv` ou `npm` não encontrado | Instale o requisito correspondente e reabra o terminal |
| Porta 3000 ou 8000 ocupada | Encerre a instância anterior antes de iniciar outra |
| Site abre, mas a IA não analisa | Execute a API e configure `GEMINI_API_KEY` para análises reais |
| Alterações visuais não aparecem | Atualize a aba com Ctrl+Shift+R; se necessário, reinicie o servidor de desenvolvimento |
| PDF não é interpretado | PDFs digitalizados sem texto selecionável exigem OCR, ainda não disponível |
| Falha ao instalar bibliotecas | Confira conexão, versão do Python/Node e permissões locais |

Não envie dados pessoais de candidatos de terceiros sem autorização. O projeto não armazena currículos na aplicação inicial, porém provedores de IA externos podem processar os dados conforme suas próprias políticas.

## Próximas leituras

Consulte [arquitetura](architecture.md), [roteiro](roadmap.md), [contribuição](../CONTRIBUTING.md) e [segurança](../SECURITY.md).
