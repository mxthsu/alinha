# Jornadas duráveis do agente — primeira entrega de backend

> **Status:** controle de execução integrado à API Community **na branch da PR**, sem conexão com a UI e sem despachar ferramentas reais ainda. Não confundir com o coordenador sintético `/agent/demo`.

## Entrega

O backend possui uma tabela SQLite para jornadas reais, separada do histórico do exemplo fictício. O Core gera o plano com ferramentas **fixas** `job.search → job.assess → application.preview` (última opcional); a IA ou o frontend não escolhem outras ferramentas. O plano é criado, mas **não executado** até existir o próximo adaptador de ferramentas. A UI pode ser conectada depois de o fluxo ser finalizado e validado.

- `POST /api/v1/agent/runs`: inicia o registro com `run_id` e `request_id` UUIDv4, cargo confirmado, autorização expressa de busca e limite de 1–15 vagas. Repetição da mesma requisição é idempotente; reuso com outro payload retorna 409.
- `GET /api/v1/agent/runs/{run_id}`: status e eventos persistidos, inclusive após reiniciar a API.
- `POST /api/v1/agent/runs/{run_id}/cancel`: cancela inclusive uma etapa ativa; a eventual resposta tardia da ferramenta não pode concluir a etapa.
- `begin_step`/`finish_step`: chamadas **internas somente**, com lease UUID, ordem, transações SQLite e validação de limite. Não existem endpoints para um navegador declarar uma ferramenta concluída.
- `interrupt_stale`: marca operações antigas como interrompidas e pendentes de revisão **sem reproduzir automaticamente** execução potencialmente ambígua.
- As tabelas registram identificadores aleatórios, cargo, estados e mensagens fixas do Core. **Não gravam currículos, descrições de vagas, prompts de modelo ou chaves**. Limite de 200 jornadas ativas, remoção de terminais antigos após 14 dias.

## Segurança e limites

A API requer modo Community, loopback, `Origin` permitido para mutações e bloqueio para requisições cross-site. Nenhuma operação de envio de candidatura faz parte do plano. Os endpoints de registro **não acionam pesquisa de vagas nem IA** — por enquanto são o controle de execução e sua persistência.

```json
{
  "run_id": "fdf4aacc-0f3d-44ba-a32c-7b9d63577162",
  "request_id": "ab7d8930-b6d7-4897-a0a7-4a60a1e3dfba",
  "query": "Engenheira de IA",
  "search_authorized": true,
  "prepare_preview": true,
  "max_jobs": 10
}
```

**Ainda faltam, no backend:** adaptação dos conectores de vagas reais ao executor, avaliação comparando um perfil armazenado à fonte original, prévias com evidências, revisão de ações, armazenamento de resultados selecionados, retomada autorizada após interrupção e contabilidade real de tokens/custos dos provedores. Só depois ligar a interface /agente.

## Testes

`cd apps/api && uv run pytest -q tests/test_agent_journey_store.py && uv run ruff check .`

Cobre UUIDs e idempotência, autorização, ações concorrentes, cancelamento durante uma ação, reinício e não reexecução, recusa de URL maliciosa, proteção HTTP por origem e ausência de envio externo.
