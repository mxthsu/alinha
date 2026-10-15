# Alinha

**Sua experiência, novas oportunidades.**

Alinha é uma aplicação de código aberto que ajuda pessoas a comparar seu currículo com os requisitos de uma vaga. O objetivo é tornar a análise **explicável**: cada requisito apresentado deve trazer uma citação real da vaga e, quando houver correspondência, do currículo.

> **Estado atual:** versão inicial para desenvolvimento local. O site ainda não está publicado e a análise com IA exige uma chave própria do Gemini. A demonstração da interface usa dados fictícios e é identificada como tal.

## O que já funciona

- Interface responsiva em português brasileiro (Next.js / TypeScript).
- Envio de currículo em texto, PDF, DOCX ou TXT.
- Análise de requisitos com Google Gemini e saída estruturada via Pydantic.
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

Copie `.env.example` para `.env` e preencha `GEMINI_API_KEY` com sua própria chave. Em seguida:

```bash
uv run uvicorn alinha_api.main:app --app-dir src --reload --port 8000 --env-file .env
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

Sem chave Gemini, use **Ver uma demonstração** na página. Uma tentativa de análise real retorna um erro explícito de configuração (HTTP 503), nunca uma resposta fictícia.

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

Veja [arquitetura](docs/architecture.md), [escopo e roteiro](docs/roadmap.md) e [guia de contribuição](CONTRIBUTING.md).

## Privacidade e limitações

O MVP não tem contas nem banco de dados; não persiste o documento enviado. **Isso não significa processamento exclusivamente local:** a análise real envia textos ao provedor de IA configurado. Consulte seus termos e sua política de dados antes de usar informações pessoais. Não use currículos de terceiros sem autorização.

Documentos digitalizados sem texto selecionável não são suportados. A correspondência textual das citações reduz alucinações sobre evidências, mas não garante que a interpretação semântica do modelo esteja correta; a pessoa deve revisar as recomendações.

## Tecnologias

Next.js, React, TypeScript, FastAPI, Python, Pydantic, LangGraph, Google Gen AI SDK, pytest, Ruff, uv e GitHub Actions. Integrações como armazenamento persistente, avaliações sistemáticas e observabilidade são etapas futuras — não estão apresentadas como prontas.

## Contribuição e licença

Feedbacks, relatos de bugs e contribuições são bem-vindos. Leia [CONTRIBUTING.md](CONTRIBUTING.md). Licença MIT, veja [LICENSE](LICENSE).
