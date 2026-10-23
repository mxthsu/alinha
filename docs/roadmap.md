# Roadmap vigente — experiência conversacional

> **Direção de 23/10/2026.** Prioridades aprovadas, não declaração de recursos entregues. A implementação atual está no [ponto de retomada](CONTINUAR-ALINHA.md); a [visão](career-product-vision.md) e a [experiência conversacional](agent-experience.md) regem as decisões de produto. O [backlog anterior](history/roadmap-before-conversational-direction.md) é histórico, sem precedência sobre esta sequência.

## Marco 1 — primeira jornada no chat

Objetivo: aproveitar o núcleo já implementado em uma experiência simples, com perfil existente ou importado, sem criar outro runtime.

- [ ] Corrigir sobrescrita de currículo entre abas, preservando a revisão carregada; testar conflitos e continuidade após resolução.
- [ ] Definir e implementar estado mínimo de conversa e componentes vinculado à jornada, com migração, retenção, exclusão e retomada; aproveitar a persistência existente sem duplicar currículos em mensagens.
- [ ] Criar entrada em `/agente` com texto livre e sugestões iniciais; organizar o código atual em componentes conforme a necessidade do fluxo.
- [ ] Reutilizar/importar currículo uma única vez e apresentar correção contextual; não exigir configuração de IA antecipada.
- [ ] Solicitar somente preferências necessárias e confirmar escopo/autorização em linguagem simples.
- [ ] Conectar busca, avaliação e prévias ao executor persistente existente, retirando gradualmente a coordenação paralela do frontend.
- [ ] Mostrar cards, revisão e acesso aos resultados na mesma experiência, com progresso, cancelamento, erro e retomada.
- [ ] Mostrar claramente “rascunho / não enviado”; manter acesso à fonte para candidatura manual.
- [ ] Entregar smoke de navegador isolado na CI: importar → autorizar → buscar → revisar prévia → reiniciar → retomar. Nenhuma fonte externa ou IA paga é necessária para o teste.

**Aceite do marco:** uma pessoa conclui esse fluxo por conversa e componentes contextuais, sem navegar obrigatoriamente entre ferramentas; o estado vem do núcleo, sem ações duplicadas ou decisões obsoletas. Verificar teclado, foco, leitor de tela e celular. A entrada “Montar meu currículo” identifica sua capacidade real enquanto o marco 2 estiver pendente.

## Marco 2 — currículo construído pela conversa

- [ ] Conduzir quem começa do zero com perguntas curtas sobre trajetória, estudos, trabalhos formais/informais, projetos e atividades reais.
- [ ] Oferecer respostas contextuais e edição livre; converter somente fatos confirmados em redação revisável.
- [ ] Abrir prévia/editor contextual, permitir corrigir e exportar, preservando o original e detectando conflitos de revisão.
- [ ] Incorporar diagnóstico de leitura do documento quando pertinente; não obrigar a passar por uma área ATS independente.
- [ ] Reutilizar o perfil na busca/preparação sem novo upload ou repetição de perguntas.

**Aceite do marco:** pessoa sem currículo obtém um documento exportável pela jornada, sem invenção de fatos e sem formulário longo obrigatório. Testar primeiro emprego, experiência informal, retorno ao mercado e transição profissional com dados sintéticos.

## Marco 3 — qualidade e cobertura para públicos variados

- [ ] Substituir lista técnica fixa do frontend por tratamento das competências declaradas em diferentes áreas; consolidar regras no núcleo.
- [ ] Avaliar fontes, atualidade, duplicação e relevância com perfis sintéticos diversos; expor cobertura limitada e exclusões por informação ausente.
- [ ] Criar avaliação anotada de interpretação/evidências: negação, curso versus experiência, requisitos obrigatórios/desejáveis e fatos ausentes.
- [ ] Homologar ao menos um provedor real em teste autorizado e limitado, medir custo/latência e preservar modo determinístico quando aplicável.
- [ ] Observar usabilidade com participantes de diferentes profissões e familiaridade digital, sem incorporar dados reais a testes/logs/commits.
- [ ] Medir conclusão, tempo até resultado útil, correções, relevância, abandono e compreensão das autorizações.
- [ ] Unificar explicações de persistência, privacidade, backup e exclusão nas telas e nos guias.

Avaliações iniciais podem focar casos representativos para aprender; isso não restringe o público do produto nem comprova cobertura universal.

## Evolução após a jornada validada

- **Distribuição:** provar instalação reproduzível Community e empacotamento Desktop com o mesmo agente. Comparar stack somente diante de necessidade concreta.
- **Candidatura externa:** integrar um conector permitido por vez, com consentimento delimitado, respostas revisadas, idempotência, confirmação externa e intervenção em autenticação/MFA/CAPTCHA. Manter opção manual onde não houver integração.
- **Acompanhamento:** ligar versões e materiais às oportunidades e registrar fatos confirmados, sem interpretar rascunho como envio.
- **Cloud:** identidade, isolamento, controle financeiro, operação e cobrança somente após validar demanda e custos. Não há lançamento ou modelo definitivo aprovado.

Cada evolução exige seus próprios critérios, testes e autorização aplicável. Não expandir automaticamente o escopo de um marco.

## Simplificação e transição

- Tornar ferramentas manuais acessos auxiliares, mantendo links existentes enquanto houver uso; não apagar dados nem funcionalidades úteis para simplificar navegação.
- Centralizar conexão de IA e esconder detalhes técnicos por padrão; explicar dados enviados e custos no momento relevante.
- Reduzir dashboards, wizards duplicados, popups em sequência e necessidade de buscar resultados no histórico.
- Preservar editor manual, exportação, revisão factual, privacidade, limites e autorização no núcleo.
- Não priorizar novos frameworks, múltiplos agentes, RAG, filas, bancos vetoriais ou infraestrutura comercial sem caso de uso demonstrado.

## Regra de entrega

Cada PR deve resolver um incremento verificável, citar os critérios pertinentes e distinguir teste executado, simulação e homologação real. Não marcar um marco como concluído apenas porque a API correspondente existe. Mudanças documentais não implementam o chat.
