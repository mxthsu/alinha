# Filtros verificados de vagas nas jornadas do Alinha

A execução backend passa a armazenar os critérios autorizados por jornada, incluindo o fluxo manual POST /api/v1/agent/runs e o fluxo de confirmação da proposta de IA POST /api/v1/agent/runs/confirm-intent. O campo opcional `criteria` usa o contrato existente `CandidateCriteria`.

Por compatibilidade, a ausência de critérios explícitos significa apenas `allowed_work_modes: [remote]`, como antes. Pode-se escolher `remote`, `hybrid`, `onsite`, cidades exatas, vínculos (clt, pj e outros valores tipados), e salário mínimo BRL mensal anunciado. Um valor desconhecido/ausente **não satisfaz filtro obrigatório**. Não converta valores anunciados de moeda estrangeira/ano para BRL/mês, nem infira vínculo de um rótulo de emprego.

O backend chama apenas as fontes públicas habilitadas pela configuração Community e filtra os anúncios normalizados **antes** de selecionar até 15 resultados. Para buscar somente remotos, envia `remote_only=true`; para outros modos ou combinação, `remote_only=false`, seguido da checagem das propriedades do anúncio. As restrições são persistidas em SQLite, read-only depois da confirmação, e aparecem no status da jornada. Busca, comparação e rascunhos utilizam somente as vagas filtradas. Não existe submissão automática.

Exemplo com critérios conservadores, em `POST /api/v1/agent/runs`:

```json
{
  "run_id": "d2e19b14-72da-4d2e-99ef-3b078655a5be",
  "request_id": "69c6eefc-4a25-42e8-b3c0-c8f9a77b7a20",
  "query": "Engenheiro de IA",
  "search_authorized": true,
  "profile_revision": 1,
  "prepare_preview": true,
  "criteria": {
    "allowed_cities": ["Florianópolis"],
    "allowed_work_modes": ["onsite", "hybrid"],
    "allowed_contract_types": ["clt"],
    "minimum_advertised_salary_brl": 9000
  }
}
```

Avisos: rótulos ou salários ausentes são excluídos quando exigidos; geocodificação e municípios vizinhos **não** são inferidos; algumas fontes não retornam a região/salário/vínculo em formato verificável, o que pode reduzir bastante os resultados. Filtros são rígidos e não fazem análise semântica ou comprovação de requisitos. Nenhum dado de currículo é enviado às fontes de vaga.

Teste: `cd apps/api && uv run pytest -q tests/test_agent_search_filters.py`.
