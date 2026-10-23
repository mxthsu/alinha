# Recuperação supervisionada das jornadas interrompidas

O backend **nunca repete automaticamente** um passo possivelmente iniciado antes da interrupção do processo. Resultados desconhecidos exigem revisão humana, mesmo quando a operação era somente uma consulta pública.

Ao ler `GET /api/v1/agent/runs/{run_id}`, o Core identifica leases em estado `running` há mais de 180 segundos e marca `needs_review`, preservando `next_step`, a sequência de eventos e um evento `interrupted`. Essa verificação não dispara conectores nem candidaturas. Uma chamada ainda ativa e recente não é marcada como interrompida.

Para **autorizar novamente** somente o passo interrompido, o usuário revisa o status e chama `POST /api/v1/agent/runs/{run_id}/retry` com um corpo como:

```json
{
  "request_id": "4084532c-4f29-40dc-bf9b-340e322a0e72",
  "expected_step": 0,
  "observed_sequence": 3,
  "retry_authorized": true
}
```

O Core compara etapa e sequência ao último evento persistido, exige que a interrupção seja o motivo real do `needs_review`, verifica o plano fixo, grava a aprovação em transação SQLite e retorna a jornada como `ready`. A operação **não executa ferramentas**: ainda é necessário acionar `POST /api/v1/agent/runs/{run_id}/execute`, que verificará também a versão do currículo.

A confirmação é idempotente por UUID da autorização. Outros IDs concorrentes não autorizam o mesmo evento; aprovação obsoleta, cancelamento, conclusão normal e reautorização sem revisão são recusados. Limite: duas aprovações de nova tentativa por jornada. Essas tentativas podem consumir uma nova consulta às fontes externas, então não são automáticas.

Os endpoints são restritos à Community local/loopback e origem permitida. Nenhuma candidatura externa é enviada. Após um crash recente pode haver até três minutos de espera antes de uma execução ser classificada como interrompida, evitando invalidar uma chamada legítima.

Teste: `cd apps/api && uv run pytest -q tests/test_agent_supervised_retry.py`.
