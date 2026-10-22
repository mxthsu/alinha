# Contratos do agente de candidaturas (fundação)

> Este documento descreve a **política de domínio** já modelada, não o coordenador completo do agente. Para a primeira jornada de delegação em uma tela, veja o [contrato proposto independente de linguagem](agent-runtime-contract.md); para retomada, [CONTINUAR-ALINHA.md](CONTINUAR-ALINHA.md).

**Estado atual:** contratos Pydantic e política de decisão sem efeitos externos. Não há busca contínua, endpoint de candidatura, filas nem submissão real.

## Modelos abertos

- **JobOpportunity**: fonte e ID externo, cargo, empresa, cidade, modalidade, tipo de vínculo, remuneração mínima explicitamente anunciada e link de referência. Valores desconhecidos permanecem desconhecidos.
- **CandidateCriteria**: filtros explícitos de cidades, remoto/híbrido/presencial, CLT/PJ/estágio/trainee e salário divulgado.
- **ApplicationConsent**: usuário, versão aprovada do currículo, plataformas autorizadas, expiração com fuso, limite diário, pausa e modo assisted/bounded_auto.
- **DispatchContext**: fatos verificados por sistema confiável, não enviados por um texto de vaga ou por uma LLM. Inclui versão atual, contagem, duplicidade, suporte/autorização do conector, respostas e currículo confirmados, CAPTCHA/MFA.
- **ApplicationDecision**: status filtered, blocked, approval_required ou authorized_for_dispatch, com motivos auditáveis.

## Política inicial

1. Vaga já enviada? **Bloquear**, para evitar duplicidade.
2. Vaga fora dos filtros explícitos? **Filtrar**, sem inventar informação.
3. Consentimento pausado, expirado, sujeito errado, currículo alterado, plataforma não permitida ou limite atingido? **Bloquear**.
4. Salário/local/modalidade/vínculo desconhecidos quando exigidos, conector não autorizado, respostas não confirmadas ou CAPTCHA/MFA? **Solicitar revisão**.
5. Modo assistido exige aprovação individual. Modo automático limitado exige consentimento vigente e todos os controles aprovados.
6. Sem bloqueios e com todos os fatos verificados: **elegível para despacho futuro**, sem realizar envio nesta etapa.

A decisão elegível não garante permissão da plataforma, envio concluído nem vaga disponível. Antes de conectar sites é obrigatório implementar consulta de capacidade a partir de registro auditado de conectores, prevenção de corridas com transações/idempotência e confirmação real de recebimento. Em qualquer erro ou status externo desconhecido, não fazer novas tentativas indiscriminadas e nunca exibir "enviado" sem prova.

## Segurança e privacidade

Nenhum dado de candidato real nos testes. Nenhum currículo, chave, contato pessoal ou histórico é persistido pelos contratos. Alterar limitações e autorizações não pode depender de LLM. Usuário deve conseguir pausar e revogar operações futuras e inspecionar ações. Implementação futura deverá cumprir LGPD e regras específicas de cada plataforma de vagas.

## Etapas técnicas seguintes

1. UI de preferências e autorização explícita com demonstração do que o agente faria (sem disparo).
2. Porta de origem para oportunidades verificáveis com conectores que respeitem termos/autorizações; sem scraping genérico abusivo.
3. Deduplicação e registro de candidaturas em armazenamento opt-in, transições válidas e idempotência transacional.
4. Preparação assistida com respostas confirmadas e modo de revisão humana.
5. Integrações reais autorizadas, métricas e, só então, orquestração recorrente/Pro.

Testes: apps/api/tests/test_application_policy.py.
