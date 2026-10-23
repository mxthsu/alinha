# Alinha — visão do agente de carreira

> **Direção aprovada em 23/10/2026.** Este documento define o produto desejado; não comprova que os recursos estejam implementados. Estado do código e próxima entrega: [ponto de retomada](CONTINUAR-ALINHA.md). Comportamento da interface e critérios de aceite: [experiência conversacional](agent-experience.md).

## Propósito e público

Facilitar a criação do currículo, a descoberta de vagas, a preparação, a candidatura e o acompanhamento em um só lugar, com o mínimo de esforço operacional para a pessoa.

O Alinha atende **pessoas de qualquer profissão**, escolaridade ou nível de experiência, inclusive primeiro emprego, retorno ao mercado e transição de carreira. Brasil e pt-BR são o ponto de partida; o projeto mantém preparação para futura localização en-US. Não restringir o produto a tecnologia nem presumir formação superior, competências técnicas, vínculo CLT ou trabalho remoto.

O processo é compartilhado; os critérios variam conforme a pessoa e a oportunidade: cargo, localização, modalidade, vínculo, remuneração, jornada, formação, habilitações e outras exigências. Cobertura de fontes é uma limitação a medir e comunicar, não prova de inexistência de vagas para uma profissão.

## Experiência central

**Uma tela principal de chat conduz a jornada.** A pessoa pode escrever o que deseja ou escolher sugestões de próximos passos e respostas. O Alinha ajuda a formular o objetivo, faz perguntas curtas e aproveita informações já confirmadas.

Cards de vagas, upload, escolhas rápidas, pequenos formulários, prévias e painéis de edição aparecem conforme a necessidade. Revisar um currículo pode abrir um painel ou modal e depois retornar à conversa com o contexto preservado. A pessoa não precisa conhecer comandos, escrever prompts elaborados ou coordenar ferramentas separadas.

O chat deve levar a resultados concretos: currículo revisável, oportunidades explicadas, materiais preparados e situação das candidaturas. Histórico de mensagens, por si só, não substitui acesso fácil a esses resultados.

## Capacidades do mesmo agente

- **Criar ou importar currículo:** conversar sobre a trajetória de quem começa do zero, extrair arquivos existentes, sugerir redação baseada nas respostas e permitir correção antes de incorporar fatos.
- **Entender o objetivo:** descobrir preferências aos poucos, esclarecer ambiguidades relevantes e permitir mudar de direção.
- **Encontrar e avaliar vagas:** consultar fontes permitidas, mostrar proveniência, motivos de relevância, impedimentos e informações desconhecidas, sem inventar nota ATS ou elegibilidade.
- **Preparar materiais:** organizar versões por vaga, respostas e anexos; mostrar alterações para revisão e integrar a verificação de leitura do documento ao momento adequado.
- **Candidatar-se dentro da autorização:** objetivo futuro com conectores permitidos, limites e confirmação externa. Pedir intervenção em perguntas desconhecidas, autenticação, MFA/CAPTCHA ou outros impedimentos. Não prometer operação universal.
- **Acompanhar:** recuperar o trabalho e mostrar fatos confirmados pela pessoa ou pela plataforma, com distinção entre rascunho, pendência e envio confirmado.

A sequência se adapta ao objetivo: importar currículo, conectar IA ou buscar vagas não são etapas obrigatórias de toda conversa. As ações disponíveis dependem da implementação e da autorização vigente.

## Princípios de experiência e confiança

- Uma ação principal por momento; explicação curta, texto livre e opção de corrigir ou voltar.
- Sugestões contextuais, poucas e relevantes; nenhuma informação pessoal é assumida porque uma opção foi exibida.
- Revisão de fatos e mudanças; nunca inventar experiência, competência, salário, habilitação ou disponibilidade.
- Progresso compreensível, cancelamento e retomada; respostas tardias não sobrescrevem decisões mais recentes.
- Conexão com IA nas configurações ou quando necessária; explicar envio de dados e custo no momento pertinente.
- IA interpreta linguagem e ambiguidades; código controla fatos verificáveis, estado, ferramentas, orçamento e permissões.
- Dados de vagas e documentos são conteúdo não confiável. Propostas de IA e respostas sugeridas não autorizam ferramentas.

## Distribuições e decisões abertas

Community Open Source (desenvolvedores e auto-hospedagem), Desktop (aplicativo instalável) e Cloud (serviço futuro) compartilham o mesmo agente. Essa distinção descreve instalação e operação, não a profissão atendida. Desktop pode ser open source; a licença MIT do Community é preservada, sem dependência obrigatória da Cloud.

Nenhuma reescrita geral, nova stack, preço ou modelo definitivo de cobrança está aprovado. Priorizar a experiência compartilhada e validar instalação/distribuição quando necessário. Ver [modelo do produto](product-model.md) e [avaliação arquitetural](architecture-evaluation.md).

## Como avaliar o progresso

Medir conclusão da jornada, tempo até o primeiro resultado útil, esforço de configuração, correções de dados, relevância das vagas, dúvidas/abandonos, recuperação após interrupção e ações sem consentimento. Qualidade semântica deve ter avaliação própria; citações válidas não bastam. Tokens, custo e latência são limites operacionais, sem substituir utilidade.

Usar perfis sintéticos de áreas variadas nos testes. Avaliar usabilidade com pessoas de diferentes profissões e familiaridade digital, mediante participação consentida; não incorporar seus currículos a fixtures, logs ou commits. Não alegar cobertura universal com base em exemplos de uma única área.
