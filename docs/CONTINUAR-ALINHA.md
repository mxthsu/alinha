# Alinha — ponto de retomada

> **Atualizado em 23/10/2026.** Direção aprovada pelo responsável do projeto nesta data. O estado abaixo foi conferido na `main` em `5d8f7cb` (PR #63); reconferir GitHub, branch e alterações locais antes de continuar. Esta atualização modifica documentação, não entrega a nova interface.

## Leia nesta ordem

1. [AGENTS.md](../AGENTS.md): regras do projeto.
2. [Visão do produto](career-product-vision.md): propósito, público e capacidades.
3. [Experiência conversacional](agent-experience.md): interação e critérios de aceite.
4. [Roadmap vigente](roadmap.md): sequência das entregas.
5. Contratos técnicos do componente que será alterado e código/testes reais.

A visão rege direção de produto; a experiência rege comportamento desejado; o roadmap rege prioridade. Código e testes comprovam implementação. Regras de segurança e contratos vigentes continuam valendo. Notas históricas não substituem esses documentos.

## Direção vigente

O Alinha facilita **montar currículo, encontrar vagas e candidatar-se em um só lugar** para pessoas de qualquer profissão e nível de experiência. O foco é facilidade de uso.

**Uma tela de chat conduz a jornada**, sugere próximos passos e respostas editáveis, aceita texto livre e apresenta cards, escolhas, upload, pequenos formulários, prévias e painéis somente quando necessários. A pessoa pode mudar de direção; o agente reutiliza contexto confirmado. Resultados ficam acessíveis sem exigir leitura de todo o histórico.

Currículo, busca, preparação e acompanhamento são capacidades do mesmo agente. Ferramentas manuais permanecem acessos auxiliares durante a transição. ATS é uma checagem integrada à preparação; IA é conectável e aparece como configuração quando necessária. Não limitar competências ou exemplos a tecnologia.

Community Open Source, Desktop e Cloud são distribuições do mesmo agente, não segmentos profissionais nem três produtos independentes. Não há stack definitiva, reescrita aprovada, instalador ou Cloud público. Não reabrir pesquisa abstrata de linguagens sem bloqueio concreto.

## Estado implementado conferido

| Área | Existe na main de referência | Limite |
|---|---|---|
| Interface | `/agente` integra importação, objetivo, busca, prévias e preparação avançada; rotas manuais permanecem | Ainda não é o chat especificado e usa busca/avaliação anteriores, sem consumir toda a jornada persistente |
| Núcleo | `job.search → job.assess → application.preview`, checkpoints SQLite, execução por comando único e cancelamento | Avaliação por coincidências literais; não comprova adequação semântica |
| Intenção | IA opt-in propõe cargo, confirmação vinculada ao plano e revisão do currículo | Não equivale a interpretação conversacional geral; sugestões não autorizam execução |
| Filtros | Cidade, modalidade, vínculo e salário declarado persistidos no backend | Fontes têm cobertura e campos incompletos; informação ausente não pode ser inventada |
| Recuperação | Interrupção de operação antiga e nova tentativa com autorização vinculada ao evento | Sem repetição automática de operação ambígua |
| Consumo | Reserva de chamadas e tokens reportados pelos provedores | Sem preço financeiro versionado; custo desconhecido não é zero |
| Dados | SQLite Community e compatibilidade com registros legados do navegador | Migração parcial; validar concorrência, recuperação e exclusão em cada fluxo |
| Candidatura | Preparação de rascunhos e acompanhamento manual | Nenhum conector de envio externo disponível |

Referências: [jornadas persistentes](agent-durable-runtime.md), [ponte IA–runtime](ai-proposal-to-runtime.md), [filtros](agent-search-filters.md), [tokens](agent-token-accounting.md), [recuperação](agent-supervised-recovery.md) e [migração](community-data-migration.md).

Na revisão que motivou esta direção, passaram **309 testes API, 67 testes locais web e Ruff**, no snapshot `5d8f7cb`. Não foram executados build, avaliação visual de navegador ou homologação BYOK nessa revisão. Isso não comprova a interface futura nem valida todas as fontes/provedores.

## Próxima entrega

Implementar a primeira fatia de chat em `/agente`, reutilizando componentes e executor existentes: entrada livre ou sugerida → perfil existente/importação → preferências necessárias → autorização → busca persistente → cards → revisão de prévia. Usar fontes sintéticas para o primeiro teste completo. O caminho “Montar meu currículo” deve aceitar quem começa do zero; a condução dessa criação entra na entrega seguinte, explicitamente identificada como pendente até funcionar.

Antes de expandir o fluxo, corrigir a proteção de salvamento: o cliente deve conservar a revisão do currículo que carregou e detectar edição em outra aba. A leitura da revisão mais recente imediatamente antes de escrever não protege um conteúdo antigo de sobrescrever outro mais novo.

O primeiro incremento deve definir o mínimo necessário para representar mensagens, decisões e componentes vinculados à jornada, inclusive persistência, migração e exclusão. Não criar outro executor, copiar o currículo para cada mensagem ou implementar todo o roadmap de uma vez. Ver a sequência e os critérios no [roadmap](roadmap.md).

Provedor real, custos e cobertura devem ser homologados em trabalho delimitado antes de declarar a integração pronta para uso. Essa validação não impede construir e testar a interface com fakes. Envio real continua fora das próximas entregas; permanece uma capacidade futura do produto.

## Ao continuar o desenvolvimento

- Conferir `git status`, branch, remotes, base e contratos; preservar alterações locais. Não fazer merge automático, force-push ou limpeza destrutiva.
- Executar uma entrega pequena, com testes e critérios pertinentes da experiência conversacional. Não tratar checklist/documentação como recurso entregue.
- Usar perfis inteiramente fictícios de áreas variadas; nunca gravar currículos reais em testes, logs, capturas ou commits.
- Plano e sugestões de IA são dados; permissões, limites, conclusão e estado ficam no núcleo. Mudança de UI não afrouxa autorização nem consentimento para processamento externo.
- Verificar docs de privacidade e persistência ao alterar o fluxo de dados. Não introduzir retenção de conversa sem contrato mínimo.

## Pedido para um novo chat

> Continue o Alinha lendo `AGENTS.md`, `docs/CONTINUAR-ALINHA.md`, `docs/career-product-vision.md`, `docs/agent-experience.md` e `docs/roadmap.md`. O produto atende qualquer profissão: chat simples, sugestões contextuais editáveis e componentes no momento necessário para currículo, vagas e candidaturas. Inspecione a main e preserve alterações locais. Implemente somente o próximo incremento do roadmap, reutilizando o executor persistente e as permissões determinísticas; use fakes e dados sintéticos de áreas variadas. Entregue testes e PR sem merge automático. Não recomece pesquisa de stack nem implemente envio externo nesta fase.

## Histórico e arquitetura

As [notas anteriores](history/development-notes-before-conversational-direction.md) foram preservadas integralmente como histórico e podem conter pendências já resolvidas ou prioridades superadas. Protótipos de stack/Desktop são experimentos, não decisões de migração. Consulte [avaliação arquitetural](architecture-evaluation.md) e confira a situação das PRs se for trabalhar nessa área.
