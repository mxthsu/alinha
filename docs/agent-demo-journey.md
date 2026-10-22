# Jornada integrada do agente — issue #44

## Implementação (fatia vertical; não é produto lançado)

A página **/agente** apresenta uma demonstração isolada com objetivo em linguagem natural, autorização separada para busca fictícia e criação de prévia, plano auditável, eventos por etapa, cancelamento, comparação de requisitos literais, prévia e confirmação local de revisão. A busca manual existente continua acessível logo abaixo. A demonstração não acessa nem altera o currículo salvo pelo usuário.

Os contratos independentes de provedor estão em apps/api/src/alinha_api/agent/runtime.py: **StartRun**, **ProposedAction**, **RunEvent**, **RunSnapshot**, **AIProvider**, **JobSource** e **ToolExecutor**. O coordenador verifica as ferramentas e os argumentos antes da execução; não existe ação de envio no executor. **FakeAIProvider**, **FakeJobSource** e **FakeToolExecutor** deixam a jornada reproduzível sem conta, chave, scraping ou site externo. Quando o limite de IA é zero, o plano é construído deterministicamente sem chamar o provedor.

### HTTP local Community

Todos os endpoints são restritos ao loopback e à origem autorizada, com cabeçalho Cache-Control: no-store.

| Ação | Endpoint | Efeito |
|---|---|---|
| Iniciar | POST /api/v1/agent/demo/runs | Valida autorização, plano e limites |
| Consultar | GET /api/v1/agent/demo/runs/{run_id} | Consulta plano, eventos e prévia |
| Avançar | POST /api/v1/agent/demo/runs/{run_id}/advance | Executa uma etapa; expected_step controla repetição |
| Cancelar | POST /api/v1/agent/demo/runs/{run_id}/cancel | Bloqueia etapas futuras |
| Revisar | POST /api/v1/agent/demo/runs/{run_id}/review | Confirma apenas revisão local, jamais envio |

Estados: planning → running → needs_review → completed ou failed/cancelled. O campo external_submission permanece **false**. O perfil é inteiramente sintético e fornecido pelo backend. Orçamento de chamadas, vagas e duração é imposto pelo coordenador; IDs de requisição e de etapa evitam duplicidade no mesmo processo. Não se garante retomada ou idempotência após reinício da API.

### Como executar

1. Em apps/api, instale as dependências conforme o README do projeto e inicie a API local (ex.: uv run uvicorn alinha_api.main:app --reload).
2. Em apps/web, instale com npm ci e inicie npm run dev.
3. Abra http://localhost:3000/agente, marque a autorização de busca fictícia e pressione **Iniciar jornada de exemplo**.
4. O exemplo padrão encontra vagas fictícias Python, apresenta correspondências e termina em **Revisão necessária**. Confirme a resposta **A combinar** e o consentimento de revisão para terminar localmente. O resultado permanece **não enviado**.
5. Para testar cancelamento, interrompa durante o progresso exibido.

Sem uv: utilize um ambiente Python isolado com dependências do pyproject, PYTHONPATH=src, python -m pytest -q e python -m uvicorn alinha_api.main:app --reload.

### Evidência e testes

- apps/api/tests/test_agent_runtime.py: sucesso, autorização, cancelamento, idempotência, limites, tentativa de ferramenta de envio, prompt injection na vaga fictícia, ausência de comprovação, falha de fonte, timeout, HTTP e origem.
- apps/web/tests/agent-demo-runtime.test.mjs: contrato HTTP no cliente, ausência de perfil real, revisão/cancelamento separados, resposta insegura e salvaguardas de interface.
- Gates: uv run pytest -q, npm run test:local, npm run lint, npm run build.
- Testes sempre com pessoas, currículos e vagas fictícios.

### Limitações e próximo incremento

É uma jornada executada pelo backend, mas **somente com dados simulados**. Não usa IA externa, não conecta o CV real ao novo runtime, não se candidata a vagas reais e não protocola candidatura. O coordenador in-memory não é uma fila confiável para ações externas. Persistência, recuperação, telemetria real de tempo/tokens, credenciais e integrações autorizadas exigem incrementos próprios.

A arquitetura continua aberta: a entrega usa FastAPI e Next atuais por simplicidade e não define Rust, Go, Python, Desktop ou Cloud como stack final. Não incorpora experimentos da PR #42. Nenhum dado pessoal ou segredo foi usado nos testes.
