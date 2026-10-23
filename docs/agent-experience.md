# Experiência conversacional do Alinha

> **Requisitos de produto aprovados em 23/10/2026; implementação pendente.** A interface atual de `/agente` ainda não entrega este chat completo. A API já possui execução persistente de busca, avaliação literal e prévias; o estado verificável está no [ponto de retomada](CONTINUAR-ALINHA.md). Esta página rege a experiência, junto à [visão](career-product-vision.md); os contratos técnicos vigentes continuam regendo execução e autorização.

## Tela principal

Uma conversa em pt-BR é o ponto de entrada. A pessoa escreve livremente, escolhe uma sugestão ou interage com um componente. O agente apresenta a próxima ação útil, aproveita o contexto confirmado e não exige percorrer abas, menus técnicos ou um wizard fixo.

Acesso discreto a currículo, vagas salvas, candidaturas e configurações permite recuperar resultados sem procurar mensagens antigas. Os editores e rotas atuais podem continuar como acessos auxiliares durante a transição, sem bloquear a jornada principal.

A experiência inicial sugere, por exemplo: **Montar meu currículo**, **Encontrar vagas**, **Mudar de área**, **Ainda não sei**. São entradas opcionais; a pessoa pode pedir outra coisa. Não exigir conexão de IA ou upload quando a tarefa não precisar disso.

## Sugestões que ajudam a pessoa

Mostrar poucas opções relevantes ao contexto, normalmente duas a quatro, em linguagem simples e com área de toque adequada. Elas podem ser produzidas por regras ou IA; cliques e renderização não exigem inferência. Não presumir que todo modelo conectado suporta geração estruturada confiável.

| Situação | Intervenção do Alinha | Resposta ou componente possível |
|---|---|---|
| Não sabe como começar | Pergunta o que deseja resolver agora | Montar currículo / procurar vagas / explorar possibilidades |
| Não tem currículo | Pergunta sobre atividades, estudos, projetos e experiências reais | Texto livre, escolhas rápidas e prévia editável |
| Relata atendimento ao público | Pergunta quais atividades realizou | Atendimento presencial / telefone / resolver reclamações / outra atividade |
| Faltam preferências para a busca | Esclarece o critério que muda a consulta | Cidade, modalidade ou vínculo, sem pedir tudo de uma vez |
| Encontra oportunidades | Explica motivos, impedimentos e informações ausentes | Cards de vagas e seleção de interesse |
| Prepara currículo ou resposta | Mostra sugestão baseada em informações confirmadas | Comparação antes/depois ou texto editável |
| Falta disponibilidade ou habilitação | Faz a pergunta à pessoa | Responder / informar depois / não se aplica, quando pertinente |
| Uma ferramenta falha | Explica o efeito e oferece caminhos válidos | Revisar / tentar novamente quando permitido / continuar outra tarefa |

Uma sugestão de resposta deve ser reconhecível como proposta. Escolher uma atividade confirma somente o que o texto da opção expressa; não comprova senioridade, duração, resultados numéricos ou habilidades relacionadas. Respostas pessoais desconhecidas nunca são preenchidas silenciosamente. Ao transformar as respostas em currículo, mostrar a redação para revisão.

Texto livre pode corrigir escolhas e mudar o objetivo. Uma preferência não reconhecida é esclarecida, não descartada ou convertida silenciosamente para um padrão. Evitar perguntas repetidas sobre informações já confirmadas; permitir revisá-las.

## Componentes no momento necessário

- **Dentro da conversa:** upload, respostas rápidas, cards, resumo de progresso, seleção de vagas, formulário curto e prévia simples.
- **Painel ou modal:** edição extensa do currículo, comparação de versões, revisão de materiais ou conexão de provedor. Voltar à conversa preserva contexto e trabalho.
- **Pedido de intervenção:** pergunta indispensável, autenticação ou decisão de autorização; apresentar o que falta e seu efeito.

Evitar modais em sequência e sobreposição de componentes. Uma tarefa previsível deve ser concluída pelo agente dentro da autorização, sem pedir que a pessoa aprove cada passo interno. Ações que exigem nova autorização mantêm a confirmação específica. Escolha de modelo, nomes de ferramentas, UUIDs e logs ficam nos detalhes/configurações quando úteis, não na conversa por padrão.

## Jornada ilustrativa

1. A pessoa pede: “Quero encontrar trabalho administrativo perto de casa”.
2. O agente oferece usar o currículo salvo, importar um arquivo ou construir o perfil por conversa, conforme o que já existe.
3. Esclarece localização e outros critérios necessários, resume o escopo e solicita autorização para a consulta.
4. Mostra progresso e cards com fonte, motivos e incertezas. A pessoa pode revisar preferências ou escolher oportunidades.
5. Prepara materiais para as vagas escolhidas e abre a revisão necessária na mesma experiência.
6. Na versão atual, identifica o resultado como **rascunho / não enviado** e permite acessar a fonte para candidatura manual. No futuro, um conector de envio só avança com autorização válida e registra a confirmação externa.
7. A pessoa interrompe e depois retoma o trabalho no contexto salvo, com resultados recuperáveis.

Outras jornadas podem começar pela edição de currículo, por um link de vaga ou pelo acompanhamento. O agente não força pesquisa de vagas para quem só deseja montar um currículo.

## Estado e execução

A conversa apresenta a jornada; o núcleo mantém o estado verificável. Mensagens do modelo, rótulos de cards e histórico textual não comprovam consentimento, versão de currículo, conclusão de ferramenta ou envio.

- Vincular decisões e componentes à jornada, etapa e versão vigentes. Cliques em cards antigos não podem executar uma ação obsoleta.
- Uma resposta “sim” só pode confirmar um pedido atual e inequívoco. Em caso de ambiguidade, esclarecer; nunca reinterpretar como autorização mais ampla.
- Distinguir **responder/editar**, **aprovar uma alteração** e **autorizar uma ação**. A UI deve comunicar o efeito antes do clique.
- Manter cancelamento acessível; respostas tardias não reabrem tarefas canceladas nem substituem decisões posteriores.
- Recuperar currículo, resultados e estado após reinício; não inferir retomada pela última mensagem nem repetir chamadas pagas ou operações ambíguas automaticamente.
- Uma alteração do currículo exige validar a revisão antes de continuar ações vinculadas à versão anterior; resolver conflitos sem sobrescrita silenciosa.
- Histórico conversacional durável requer definição mínima de dados, migração, retenção e exclusão antes da implementação; não persistir documentos integrais ou segredos por conveniência.

Reutilizar o [executor persistente](agent-durable-runtime.md), a [ponte de intenção](ai-proposal-to-runtime.md) e a [recuperação supervisionada](agent-supervised-recovery.md). Não criar outro runtime de produção para sustentar o chat. Regras de permissão permanecem determinísticas; sugestões de IA não fornecem URLs, ferramentas ou permissões arbitrárias para execução.

## Critérios de aceite da experiência

Estes critérios são metas; só marcar como entregues com evidência executada.

- Uma pessoa sem currículo consegue iniciar sua construção pela conversa, revisar a redação e obter documento exportável sem inventar fatos nem preencher obrigatoriamente um formulário longo.
- Uma pessoa com currículo importa uma vez e usa o mesmo perfil na busca e na preparação, com correção e confirmação de substituição.
- A pessoa pode iniciar, corrigir e mudar o objetivo por texto livre ou sugestões; nenhuma escolha depende exclusivamente de botões.
- Sugestões acompanham o contexto e podem ser editadas/ignoradas; fatos, preferências e consentimentos não são presumidos.
- Buscar, escolher uma vaga e revisar materiais ocorre na mesma experiência; painel/modal retorna ao ponto correto sem perder trabalho.
- Interações usam o estado do núcleo, rejeitam componentes obsoletos e preservam autorização, idempotência e revisão do currículo.
- Cancelamento, erro de fonte, falha de IA, informação desconhecida, retomada e conflito entre abas têm caminhos compreensíveis, sem repetir ações silenciosamente.
- O usuário recupera currículo, vagas e materiais sem rolar todo o histórico. Rascunhos e envios confirmados são distintos.
- O fluxo funciona em desktop e celular, por teclado e com leitores de tela: foco retorna ao componente de origem, progresso é anunciado e conteúdo não depende só de cor ou hover.
- Testes sintéticos cobrem áreas diferentes (por exemplo, atendimento, administração, trabalho operacional, saúde e tecnologia), primeiro emprego e transição, sem assumir remoto ou formação superior. Isso não comprova cobertura de todas as profissões.

## Validação proporcional

Testar regras e estado com fakes; executar testes de navegador com fontes sintéticas interceptadas, storage temporário e nenhum dado pessoal real. Cobrir criação/importação, respostas sugeridas e livres, edição, sucesso, erro, cancelamento, contexto obsoleto e reinício. Integrar smoke do fluxo à CI com isolamento.

Avaliar qualidade de interpretação e recomendações em conjunto anotado, incluindo negações, experiências informais e cursos que não equivalem a experiência profissional. Homologação com provedor ou fonte real exige condições e limites próprios; testes simulados não a substituem. Usabilidade deve observar conclusão, esforço, erros e compreensão, além de aparência.
