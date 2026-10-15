# Alinha

**Sua experiência, novas oportunidades.**

Alinha é uma aplicação de código aberto que ajuda pessoas a comparar seu currículo com os requisitos de uma vaga. O objetivo é tornar a análise **explicável**: cada requisito apresentado deve trazer uma citação real da vaga e, quando houver correspondência, do currículo.

> **Estado atual:** versão inicial para desenvolvimento local. O site ainda não está hospedado publicamente. Há três provedores opcionais: Gemini (API), Ollama (modelo local) e ChatGPT (assinatura elegível, via autorização OAuth **somente em instalação local**). A demonstração usa dados fictícios e é identificada como tal.

## Modelo de distribuição

**Alinha Community** é open source, sob licença MIT, para instalação própria e provedores à escolha do usuário. **Alinha Cloud** é um serviço hospedado e opcional em planejamento, com planos pagos apenas quando houver infraestrutura, privacidade e custos de inferência validados. Não há planos pagos ativos nesta versão. Consulte [modelo de produto](docs/product-model.md).

O login de assinatura ChatGPT implementado para Community não autoriza, por si só, compartilhamento de tokens ou uso comercial em um site público. O modo Cloud atualmente bloqueia inferência até que identidade própria, cotas e controles financeiros estejam prontos.

## O que já funciona

- Interface responsiva em português brasileiro (Next.js / TypeScript), com componentes reativos, ícones Lucide e Google Fonts.
- Envio por arrastar e soltar, validação de arquivo no navegador e contadores acessíveis de preenchimento.
- Relatório com requisitos expansíveis, feedback de carregamento e possibilidade de cancelar a solicitação.
- Envio de currículo em texto, PDF, DOCX ou TXT.
- Análise de requisitos com Gemini, Ollama ou ChatGPT (OAuth local), com validação de saída via Pydantic.
- Login ChatGPT com PKCE, validação de ID token e armazenamento de tokens no cofre do sistema operacional, sem expor tokens ao navegador.
- Fluxo explícito com LangGraph: geração da análise → verificação de evidências.
- Verificação programática de que citações retornadas aparecem nos textos fornecidos.
- Relatório com requisitos classificados como **com evidência**, **parcial** ou **não identificado**.
- Demonstração estática com dados fictícios, sem chave e sem simular uma análise real.
- Testes automatizados da API e CI configurado para pull requests.

**Não fazemos:** pontuação supostamente equivalente a ATS, previsão de contratação, invenção de experiências ou armazenamento de currículos.

## Executar localmente

Requisitos: Python 3.11+, [uv](https://docs.astral.sh/uv/), Node.js 20.9+ e npm.

### 1. API

```bash
cd apps/api
uv sync --dev
```

Copie `.env.example` para `.env` e configure o provedor desejado. Para usar o ChatGPT em **instalação local**, altere `ALINHA_LOCAL_AUTH_ENABLED=1` e mantenha a API vinculada ao loopback. Em seguida:

```bash
uv run uvicorn alinha_api.main:app --app-dir src --host 127.0.0.1 --port 8000 --env-file .env --no-access-log
```

API: http://localhost:8000/docs | Verificação: http://localhost:8000/health

### 2. Interface

Em outro terminal:

```bash
cd apps/web
npm ci
npm run dev
```

Abra http://localhost:3000. A URL da API é, por padrão, `http://localhost:8000`; ela pode ser alterada com `NEXT_PUBLIC_API_URL` em `apps/web/.env.local`.

Para usar o plano ChatGPT, clique em **Continuar com ChatGPT** no formulário local e autorize o aplicativo. Ele lista apenas modelos da conta conectada; a disponibilidade e os limites dependem do seu plano. A instalação também pode usar Ollama, sem cobranças por chamadas. Sem nenhum provedor configurado, use **Ver uma demonstração**. Consulte [configuração e segurança dos provedores](docs/providers.md).

## Qualidade

```bash
cd apps/api
uv run pytest -q
uv run ruff check .
```

```bash
cd apps/web
npm run lint
npm run build
```

## Como a análise funciona

1. Extrai texto do currículo em memória e valida os limites de tamanho.
2. Solicita à IA requisitos explícitos da vaga com trechos literais como evidência.
3. Um nó de verificação confere se os trechos realmente constam nos documentos.
4. Evidências de currículo inexistentes são rejeitadas e não viram alegações de competência.
5. Um relatório agrupa requisitos sem fingir compatibilidade com algoritmos ATS.

Veja [arquitetura](docs/architecture.md), [escopo e roteiro](docs/roadmap.md), [provedores e autenticação](docs/providers.md) e [guia de contribuição](CONTRIBUTING.md).

## Privacidade e limitações

O MVP não tem contas próprias do Alinha nem banco de dados; não persiste currículos. O modo OAuth permite **uma conta ChatGPT ativa na instalação local**, mantendo credenciais no cofre do sistema operacional. **Isso não significa processamento exclusivamente local:** no modo ChatGPT/Gemini, textos são enviados ao provedor escolhido. Com Ollama os textos ficam na máquina do usuário. Consulte os termos dos provedores antes de usar informações pessoais e nunca envie currículos de terceiros sem autorização.

Documentos digitalizados sem texto selecionável não são suportados. A correspondência textual das citações reduz alucinações sobre evidências, mas não garante que a interpretação semântica do modelo esteja correta; a pessoa deve revisar as recomendações.

## Tecnologias

Next.js, React, TypeScript, FastAPI, Python, Pydantic, LangGraph, Google Gen AI SDK, HTTPX, PyJWT, keyring, Ollama (opcional), pytest, Ruff, uv e GitHub Actions. Integrações como armazenamento persistente, avaliações sistemáticas e observabilidade são etapas futuras — não estão apresentadas como prontas.

## Contribuição e licença

Feedbacks, relatos de bugs e contribuições são bem-vindos. Leia [CONTRIBUTING.md](CONTRIBUTING.md). Licença MIT, veja [LICENSE](LICENSE).
