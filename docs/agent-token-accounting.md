# Auditoria de consumo de IA por jornada

A chamada explícita de interpretação por IA continua limitada a **duas reservas por UUID de jornada**, antes de qualquer requisição ao provedor. Não é um limite monetário global e, por si só, não impede que o usuário inicie outra jornada.

Em chamadas autorizadas, o Alinha lê **somente contadores efetivamente informados pela resposta do provedor**: Gemini (prompt/candidates/total), OpenAI Responses (input/output/total), Claude Messages (input/output e a soma), Ollama local (prompt_eval/eval). Valores não informados são `null`, nunca zero inventado. O total do Ollama permanece `null` porque aquela resposta contém contadores separados, sem total explícito. Algumas modalidades de token (ex.: cache ou pensamento) dependem do contrato do respectivo provedor.

As tentativas reservadas são auditadas em SQLite por `run_id` e `request_id` com provedor, modelo, status, contagem e data. **Não são gravados** prompts, currículo, resposta do modelo, e-mail ou chaves API. Se o registro de auditoria falhar, a proposta **não fica disponível para confirmação**. Tentativas falhas também são auditadas e podem apresentar consumo desconhecido.

A rota `GET /api/v1/agent/intent/usage/{run_id}` permite consultar o histórico local de tentativas, sem repetir a chamada. Requer acesso Community loopback e nunca expõe tokens de autenticação.

O campo `cost_usd` é sempre `null` nesta fase: não há tabela de preços oficial versionada, conversão cambial nem distinção completa de classes de tokens para calcular custo financeiro confiável. Não interprete `null` como gratuito. Antes de apresentar custos estimados, introduzir tabela de preços versionada ou precificação controlada pelo usuário, com unidade e data explícitas.

**Homologação:** todos os adaptadores foram testados com respostas sintéticas, sem consumo de créditos reais; a aferição com uma chave BYOK real só será feita após autorização específica do usuário.

Teste: `cd apps/api && uv run pytest -q tests/test_agent_token_usage.py`.
