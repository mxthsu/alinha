# Alinha — visão do agente de carreira brasileiro

> Planejamento aprovado. O produto atual oferece Studio, importação de currículos, legibilidade ATS e comparação com uma vaga. Busca contínua, candidaturas automáticas, agentes em nuvem e assinaturas ainda não foram lançados.

## Objetivo

Transformar o Alinha num assistente de carreira que ajude a **encontrar vagas, comparar requisitos, preparar currículos específicos, candidatar-se dentro de autorizações e acompanhar resultados**. O LoopCV é referência de categoria e funcionalidade, não fonte para copiar código, textos, marca ou identidade.

**Brasil primeiro**: pt-BR, BRL, contratação CLT/PJ/estágio/trainee, opções remoto/híbrido/presencial, cidades e regiões brasileiras. Idiomas adicionais depois, com contratos preparados para internacionalização.

## Experiência planejada

1. **Perfil profissional verificável** — currículo importado/editado, competências, histórico e documentos aprovados.
2. **Preferências e filtros** — cargos, localidade, modalidade, vínculo, salário e plataformas permitidas.
3. **Descoberta de vagas** — fontes legais e rastreáveis, normalização, deduplicação e relevância explicada.
4. **Comparação e personalização** — evidências literais de requisitos e versões de currículo para cada vaga, sem inventar fatos.
5. **Execução autorizada** — candidatura assistida ou automática com autorização prévia delimitada; nunca contornar verificações ou restrições de sites.
6. **Acompanhamento** — somente fatos confirmados: proposta, envio confirmado, resposta, entrevista, rejeição ou resultado desconhecido.

## Autonomia confirmada

Modelo preferencial: **automático com autorização prévia e limites configuráveis**. A pessoa define fontes, critérios, versão do currículo, respostas, volume diário e prazo da autorização; pode pausar ou revogar. Candidaturas fora do escopo, integração indisponível, CAPTCHA/MFA, dados incompletos, mudança de currículo ou perguntas desconhecidas exigem revisão ou bloqueio. Nunca registrar envio como concluído sem confirmação externa.

O usuário pode optar por modo assistido, com aprovação individual. A IA sugere e prepara; apenas uma política determinística permite avançar. O mecanismo de execução futuro será idempotente e auditável.

## Community e Pro

- **Community**: código aberto, Studio, ATS, comparação com evidências, provedores próprios, critérios, descoberta/controle assistidos quando implementados e dados portáveis.
- **Pro**: hospedagem, histórico e sincronização, conectores comerciais, execução contínua, notificações, limites maiores e suporte. Cobrança por infraestrutura e conveniência, não por bloquear artificialmente todo o produto.
- O repositório permanece sob MIT; não há mudança retroativa de licença. Serviços futuros proprietários serão separados sem tornar o Community dependente de um SaaS pago.

## Métricas a validar, não a prometer

Relevância real das vagas para o candidato; precisão das evidências; duplicidades evitadas; erros factuais em currículo/respostas; candidaturas enviadas **com confirmação**; ações sem consentimento (meta zero); tempo economizado e satisfação. Custos, taxa de resposta e conversão só depois de dados reais e consentidos.

## Dependências e riscos

Verificar termos e APIs de cada fonte, proibir bypass de CAPTCHA/MFA, respeitar a LGPD (finalidade, minimização, consentimento quando aplicável, direitos de titulares, privacidade e segurança), limitar volume para não gerar spam e não armazenar credenciais indevidamente. Vagas e currículos são dados não confiáveis, nunca instruções ao agente.

## Entregas propostas

| Etapa | Escopo | Situação |
| --- | --- | --- |
| 0 | Studio, ATS e análise por vaga | Implementados |
| 1 | Contratos de vaga, preferências, consentimento e autorização determinística | Em implementação |
| 2 | Preferências na interface e busca de vagas por fonte permitida | Pendente |
| 3 | Lista de oportunidades, deduplicação, explicações e Kanban | Pendente |
| 4 | Preparação de candidaturas assistidas, testes com conectores e confirmação real | Pendente |
| 5 | Agendamento Pro, contas, filas, auditoria, billing e notificações | Pendente |

Ver também: open-core-boundaries.md, agent-application-contract.md e product-model.md.
