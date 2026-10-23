# Contratos sintéticos do agente (PR #45)

> Histórico de testes da PR #45. **Esta não é mais a experiência da rota /agente.** Para o fluxo integrado, consultar [jornada principal](integrated-agent-journey.md) e [ponto de retomada](CONTINUAR-ALINHA.md).

A PR #45 implementou na API os contratos StartRun, ProposedAction, RunEvent, RunSnapshot e as portas AIProvider, JobSource e ToolExecutor. O módulo apps/api/src/alinha_api/agent/runtime.py continua disponível como **fixture offline de segurança**, com FakeAIProvider, FakeJobSource e FakeToolExecutor, testando política de ferramentas, limites, cancelamento, erros, fatos desconhecidos, idempotência durante o processo e ausência de envio real. Os endpoints /api/v1/agent/demo/runs permanecem para testes sintéticos locais e não são chamados pela experiência integrada.

A interface antiga de demonstração, seu transporte e seus testes de UI foram removidos da PR de integração para eliminar uma segunda jornada. /agente lê o perfil salvo, usa a busca autorizada existente, apresenta evidências e uma prévia revisável e abre a PreparationJourney da PR #41 na mesma tela. A API fictícia **não está conectada a vagas reais, não persiste runs após reiniciar e não executa candidaturas**. Nenhum componente de produto depende dela para enviar dados externos.

Não interpretar testes da API sintética como prova de execução de aplicações em portais externos ou de disponibilidade de IA conectada. A implementação de runtime distribuível para Community/Desktop/Cloud continua intercambiável e sujeita a evidência de caso de uso.
