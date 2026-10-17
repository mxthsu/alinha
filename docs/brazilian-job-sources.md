# Fontes brasileiras para descoberta de vagas

## Primeira entrega: Gupy

A busca do Community agora aceita `source=gupy` em `GET /api/v1/jobs/search?q=python&page=1&remote_only=false&source=gupy`.
A interface Oportunidades oferece Gupy (padrão) e Himalayas. O agente ainda utiliza somente a
busca inicial Himalayas: a orquestração multifuente fica para C4.

O conector utiliza o endpoint JSON do portal público
`https://employability-portal.gupy.io/api/v1/jobs`, com `jobName`, `limit`,
`offset` e, para busca remota, `workplaceType`. A origem foi identificada no código
open source [Candidatador](https://github.com/davidogral/candidatador),
`src/candidatador/sources/gupy.py`; a implementação do Alinha é independente.

Mapeamentos cobertos: tipo de contratação CLT, PJ, estágio e temporário quando informado;
modalidade remota/híbrida/presencial quando explícita; cidade quando presente; descrição
em trecho resumido; URL da oportunidade em subdomínios HTTPS `gupy.io`.
Salários ausentes não são presumidos. Resultados podem sofrer mudanças de esquema
ou disponibilidade. Não há automação de candidatura.

## Fila priorizada para C4 — multifuente

| Fonte / referência | Tipo | Encaminhamento |
| --- | --- | --- |
| [Gupy](https://portal.gupy.io/) | Portal público com endpoint JSON usado por projetos comunitários | Primeira integração; validar dados reais e descrição completa |
| [Vagas Dev](https://github.com/henriquesebastiao/vagas-dev) | Agregador brasileiro open source com REST API, Gupy e coletor LinkedIn | Estudar schema, deduplicação e API; checar atualização e cobertura |
| [Candidatador](https://github.com/davidogral/candidatador) | Projeto open source com conectores Gupy, Remotive, Greenhouse, Lever, Ashby | Referência arquitetural para adaptadores e matching |
| [Greenhouse Job Board API](https://developers.greenhouse.io/job-board.html) | API de ATS por empresa | Conector por boards, preservando URL e descrição original |
| [Lever Postings API](https://github.com/lever/postings-api) | API de ATS por empresa | Conector por empresa, com filtros posteriores por localidade |
| [Ashby Posting API](https://developers.ashbyhq.com/docs/public-job-posting-api) | API de ATS por organização | Consultar vagas publicadas, localidade e descrição |
| [JobSpy](https://github.com/speedyapply/JobSpy) | Biblioteca comunitária de coleta multiprovedor | Referência experimental opt-in, não dependência da busca padrão |

Antes de adicionar qualquer fonte ao fluxo do agente, padronizar `JobOpportunity`,
fazer deduplicação entre provedores, preservar descrição integral, registrar origem e data
de coleta e filtrar elegibilidade no Brasil. As fontes podem falhar isoladamente.
A busca deve seguir funcional com os demais conectores.

## Próximos passos

1. Conectar Gupy ao agente com busca por perfil sem configuração manual de abas.
2. Agrupar e deduplicar resultados de Gupy + Himalayas sem duplicar recomendações.
3. Ampliar com Greenhouse, Lever e Ashby (catálogos de organizações).
4. Validar vagas reais brasileiras (remotas, híbridas, presenciais, CLT/PJ/estágio).
5. Somente depois, avaliar coleta estruturada de páginas com `JobPosting` e feeds.

## Validação de conectores — 17/10/2026

- Gupy: HTTP 404 no endpoint do portal usado por código comunitário; desativada por padrão, aguardando rota estável.
- Lever Flex: HTTP 200, 32 vagas publicadas; consulta por **Software** encontrou duas vagas em Remote / Brazil no ensaio local.
- Himalayas: permanece integrada como fonte remota.
- Próxima ampliação: catálogo de empresas/ATS, descrições completas e armazenamento persistente.
