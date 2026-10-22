# Meu agente de carreira — primeira jornada conectada

> **Evolução de produto (22/10/2026):** a experiência final é um **único agente de carreira** que recebe objetivos em linguagem natural e mostra andamento/revisões na mesma tela. O fluxo descrito abaixo representa a implementação inicial, não todo o produto pronto. Ver [ponto de retomada](CONTINUAR-ALINHA.md) e [contrato do runtime](agent-runtime-contract.md).

> A implementação atual é um primeiro fluxo de planejamento e descoberta **assistido**, ainda não um agente autônomo de candidaturas. Nenhuma ação externa é executada sem interação da pessoa, e o Alinha não procura vagas continuamente em segundo plano.

## Experiência

A pessoa pode enviar **PDF, DOCX ou TXT de até 3 MB diretamente no agente**,
sem passar por abas do Studio. A ação **Enviar currículo e encontrar vagas**
autoriza organizar o perfil e executar a primeira consulta de cargo: o
arquivo é interpretado pelo backend local; somente o perfil estruturado é salvo
no navegador, nunca o PDF original ou o texto integral de origem. O agente
identifica cargos explícitos, inicia a busca quando possível e avisa caso falte
alguma informação essencial. Revisar os campos detalhadamente é opcional;
substituir um currículo existente requer confirmação.

A rota `/agente` organiza a jornada:

1. Importar currículo diretamente no agente ou recuperar o perfil salvo no Studio (IndexedDB do mesmo navegador).
2. Extrair **somente cargos declarados** no título profissional e nas experiências; exibir sugestões de busca editáveis.
3. Identificar termos técnicos escritos explicitamente no currículo, sem inferir tecnologias ou experiências.
4. Consultar a fonte pública após clicar em **Encontrar vagas** ou **Enviar currículo e encontrar vagas**, enviando somente o cargo, sem currículo completo, nome, contato ou documentos.
5. Apresentar resultados reais do conector já existente, classificados por **indícios literais** no título ou resumo disponível, com avisos sobre dados incompletos. Não há pontuação ATS, garantia de compatibilidade nem aprovação automática.
6. Abrir o anúncio original, salvar a oportunidade no Kanban ou avançar para Preparar candidatura com o contexto da vaga. A descrição completa continua necessária antes de pedir sugestões para o currículo.

Uma pessoa sem currículo pode pesquisar manualmente, mas não recebe sinais personalizados. Ambas as telas reutilizam a mesma API de importação e o mesmo perfil; o Studio fica disponível somente para edições detalhadas quando desejadas.

## Referências de produto e arquitetura

- O LoopCV inspira a **jornada**: perfil → buscas → oportunidades → candidaturas → acompanhamento.
- O OpenCode inspira o **modelo de execução**: ferramentas com permissões, planejamento visível, revisão antes de ações sensíveis e histórico confiável.
- A identidade, telas, código, textos, fluxos, contratos e documentação do Alinha são originais.

O módulo público `apps/web/src/lib/career-agent.ts` implementa a **primeira avaliação determinística**, sem chamadas a modelos de IA. Ele não é uma simulação de agente inteligente: exibe o que realmente analisou e mostra o que não consegue saber a partir de um resumo.

As permissões iniciais da edição Community são:

| Ação | Permissão | Comportamento presente |
| --- | --- | --- |
| Ler currículo local | permitida | Recuperar somente o rascunho salvo no dispositivo |
| Pesquisar vagas | solicitar autorização | Disparada por clique e consulta fixa a uma fonte |
| Identificar sinais literais | permitida | Comparação determinística apenas com texto disponível |
| Preparar rascunho específico | solicitar autorização | Abre fluxo existente de Preparar candidatura |
| Enviar candidatura | negada | Sem conector nem execução |

## Evolução real para um agente de IA

1. Planejador com provedores intercambiáveis e schema de tarefas, mantendo filtros e autorizações no domínio determinístico.
2. Ferramentas versionadas para descoberta de vagas, leitura de descrições com permissão de fonte, comparação com evidências e preparação de versões de currículo.
3. Sessões e histórico de execução transparentes, sem armazenar dados pessoais desnecessários, com possibilidade de parar/revogar.
4. Versões de currículo vinculadas a cada vaga e alterações aprovadas pela pessoa, preservando sempre o original.
5. Fontes adicionais com permissão contratual, quotas e mecanismos de deduplicação.
6. Automações do Pro, após autenticação, auditoria, isolamento por conta, idempotência e conectores autorizados.

**Limites:** a fonte atual é especializada em vagas remotas e frequentemente retorna somente resumos; esses trechos não comprovam aderência a todos os requisitos. As classificações “Sinais relevantes”, “Alguns sinais” e “Precisa de revisão” significam apenas indícios literais, não uma avaliação de contratação. Nenhum currículo é enviado ao provedor de vagas. A comparação com IA em Preparar candidatura continua sujeita à escolha de provedor e solicitação explícita. O código é aberto e não contém credenciais comerciais.
