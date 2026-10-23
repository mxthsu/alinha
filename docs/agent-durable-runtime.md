# Jornadas duráveis do agente — execução das três ferramentas no backend

> **Status:** controle de execução integrado à API Community. `job.search` consulta os conectores públicos habilitados; `job.assess` compara as vagas persistidas com a versão autorizada do currículo armazenado no Community, sem modelo de IA. `application.preview` cria até três rascunhos locais revisáveis; a integração com a UI e o comando único que coordena todos os passos ainda faltam. Não confundir com o coordenador sintético `/agent/demo`.

## Entrega

O backend possui tabelas SQLite para jornadas reais, separadas do histórico do exemplo fictício. O Core gera o plano com ferramentas **fixas** `job.search → job.assess → application.preview` (última opcional); a IA ou o frontend não escolhem outras ferramentas. **As três ferramentas estão disponíveis no backend** sob chamadas explícitas e controle do servidor; ainda não há orquestração automática de todo o plano em um único comando. A UI pode ser conectada depois de o fluxo ser finalizado e validado.

- `POST /api/v1/agent/runs`: inicia o registro com `run_id` e `request_id` UUIDv4, cargo confirmado, autorização expressa de busca e limite de 1–15 vagas. Inclua `profile_revision` (revisão do registro local `community/data/resume`) para autorizar a comparação posterior; a versão deve permanecer a mesma durante `job.assess` e `application.preview`. Repetição da mesma requisição é idempotente; reuso com outro payload retorna 409.
- `GET /api/v1/agent/runs/{run_id}`: status e eventos persistidos, inclusive após reiniciar a API.
- `POST /api/v1/agent/runs/{run_id}/cancel`: cancela inclusive uma etapa ativa; a eventual resposta tardia da ferramenta não pode concluir a etapa.
- `begin_step`/`finish_step`: chamadas **internas somente**, com lease UUID, ordem, transações SQLite e validação de limite. Não existem endpoints para um navegador declarar uma ferramenta concluída.
- `interrupt_stale`: marca operações antigas como interrompidas e pendentes de revisão **sem reproduzir automaticamente** execução potencialmente ambígua.
- `POST /api/v1/agent/runs/{run_id}/execute-search`: despacha exatamente uma vez a ferramenta `job.search`, com fontes configuradas em Meu Alinha, `source=all`, `remote_only=true` e `page=1`. Não aceita URLs, nomes de ferramentas ou resultados fornecidos pelo navegador. Havendo cancelamento simultâneo, a busca pode terminar na fonte externa, mas o retorno tardio é descartado.
- `GET /api/v1/agent/runs/{run_id}/jobs`: lê resultados persistidos sem refazer chamadas; mantém identificação da fonte e ressalvas. Limita a 15 vagas, com até 350 kB de JSON público, em transação única com o registro de conclusão.
- `POST /api/v1/agent/runs/{run_id}/execute-assess` compara apenas as competências declaradas na versão local de currículo autorizada (`profile_revision`). `GET /api/v1/agent/runs/{run_id}/assessment` recupera a comparação persistida, com rótulo de revisão. Não aceita currículo ou resultado enviados pelo navegador.
- `POST /api/v1/agent/runs/{run_id}/execute-preview` gera no máximo três rascunhos locais com competências explicitamente declaradas e presentes nos anúncios. O Core recalcula e valida os textos antes do commit, rejeitando qualquer afirmação adicionada fora das regras. `GET /api/v1/agent/runs/{run_id}/previews` recupera os textos persistidos sem executar tarefas adicionais. Apenas jornadas com `prepare_preview=true` podem solicitar essa etapa.
- Os registros de jornada guardam identificadores aleatórios, cargo, estados, mensagens fixas, **anúncios públicos**, **termos coincidentes de competências declaradas** na avaliação e **rascunhos locais** sem contatos pessoais. **Não duplicam o currículo inteiro, prompts de IA, chaves ou credenciais**; o próprio armazenamento Community mantém o currículo local original em sua área de registros. Limite de 200 jornadas ativas, remoção de terminais antigos após 14 dias. Mensagens de exceções das fontes não entram nos eventos.

## Segurança e limites

A API requer modo Community, loopback, `Origin` permitido para mutações e bloqueio para requisições cross-site. Nenhuma operação de envio de candidatura faz parte do plano. **Criar a jornada não aciona pesquisa nem IA.** A busca real começa apenas com o endpoint `execute-search`; os filtros para cidade/salário ainda não integram este executor, que atualmente consulta só o conjunto habilitado de fontes e busca anúncios remotos.

```json
{
  "run_id": "fdf4aacc-0f3d-44ba-a32c-7b9d63577162",
  "request_id": "ab7d8930-b6d7-4897-a0a7-4a60a1e3dfba",
  "query": "Engenheira de IA",
  "search_authorized": true,
  "prepare_preview": true,
  "max_jobs": 10,
  "profile_revision": 1
}
```

**Ainda faltam:** coordenar automaticamente as três etapas num único pedido, avaliação semântica opcional e verificável, filtros completos, revisão de ações, retomada autorizada após interrupção, homologação com ao menos um provedor real e contabilidade real de tokens/custos dos provedores. A etapa atual usa somente **coincidência literal** entre termos de competências declaradas e texto do anúncio; não atribui nota ATS nem comprova requisitos da vaga. A documentação e os testes com fontes fictícias **não equivalem a homologação de todas as fontes externas reais**. Só depois ligar a interface `/agente`.

## Testes

`cd apps/api && uv run pytest -q tests/test_agent_journey_store.py tests/test_agent_real_search.py tests/test_agent_real_assessment.py tests/test_agent_real_preview.py && uv run ruff check .`

Cobre UUIDs e idempotência, autorização, busca com fontes sintéticas interceptadas, preservação de proveniência, concorrência e cancelamento durante chamada à fonte, reinício sem reexecução, erro da fonte sem vazamento em eventos, rejeição de payload grande, recusa de URL maliciosa, proteção HTTP por origem e ausência de envio externo.
