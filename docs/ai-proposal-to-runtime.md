# Ponte entre interpretação por IA e jornada durável

A interpretação opt-in do objetivo continua limitada a duas tentativas de modelo por UUID da jornada. A restrição não é um teto de gastos ou tokens. A contagem de tokens que cada provedor efetivamente reportar é persistida separadamente em SQLite e consultável em `GET /api/v1/agent/intent/usage/{run_id}`; ausência de contagem ou custo permanece `null`. Consulte [auditoria de consumo](agent-token-accounting.md).

O endpoint POST /api/v1/agent/interpret agora salva a sugestão validada de cargo por uma hora, sem armazenar o objetivo completo ou o currículo. A IA não executa nenhuma ferramenta.

GET /api/v1/agent/intent/proposals/{run_id} recupera o cargo sugerido, sem chamar o modelo novamente. Depois de revisar a proposta, o usuário envia POST /api/v1/agent/runs/confirm-intent com run_id, um novo request_id, confirmed_role, search_authorized=true, profile_revision e max_jobs. O cargo deve corresponder à última proposta persistida. A opção de preparar prévias é a da própria proposta, não a da confirmação.

Confirmar cria a jornada em uma transação SQLite, mas não aciona pesquisa. Somente POST /api/v1/agent/runs/{run_id}/execute executa as três ferramentas autorizadas. Replicar a confirmação com os mesmos parâmetros é idempotente; alterar role, IDs ou dados retorna conflito. Uma proposta expira após uma hora.

A criação manual de jornadas continua disponível, sem IA. Não há aplicação automática a vagas. Ainda faltam medição de tokens e custos reais, testes autorizados com provedores, filtros completos e recuperação revisável de etapas interrompidas.

Testes: cd apps/api && uv run pytest -q tests/test_agent_intent_bridge.py tests/test_agent_intent_model.py tests/test_agent_runner.py
