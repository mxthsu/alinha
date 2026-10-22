# Modelo de produto — Alinha Community, Desktop e Cloud

> **Direção de produto em 22/10/2026, não anúncio de versões lançadas.** Para retomar o desenvolvimento em outro chat, começar em [CONTINUAR-ALINHA.md](CONTINUAR-ALINHA.md). A forma de monetização Cloud, a stack final e o instalador Desktop **não estão decididos nem prontos**.

## Um produto, três distribuições

| Distribuição | Usuário principal | Como utilizará | Custos e conexão com IA |
|---|---|---|---|
| **Alinha Community — Open Source** | Desenvolvedor, contribuidor e pessoa com autonomia para auto-hospedar | Código-fonte, scripts de desenvolvimento; Docker/CLI se forem úteis e testados | Software MIT; BYOK, modelos locais ou integrações elegíveis; custos de terceiros por conta do usuário |
| **Alinha Desktop** | Pessoa que deseja usar sem saber programar | Baixar instalador, abrir janela própria; dados e execução locais quando possível | Conexão simples à IA escolhida e armazenamento de credenciais no cofre do SO |
| **Alinha Cloud** | Pessoa que prefere não instalar | Navegador com execução remota, conta, isolamento e sincronização | Infraestrutura e IA gerenciadas; franquias, créditos ou consumo a definir por medição |

**Importante:** o código do Desktop poderá ser open source; “Community” é o nome da edição voltada a desenvolvedores, **não uma categoria exclusiva de licença**. Community e Desktop não dependem do Cloud para tarefas essenciais. Não criar três agentes independentes: compartilhar regras e contratos.

## Experiência central

O Alinha é um **agente de carreira**. A pessoa informa um objetivo em linguagem natural e vê numa única interface o plano, a busca de vagas, as evidências de adequação, a preparação de candidatura e os itens pendentes de revisão. Ações previsíveis usam código; IA é usada seletivamente para intenção, linguagem e ambiguidades. Navegador automatizado pode executar oculto, mas autenticação/MFA/CAPTCHA e requisitos de autorização podem exigir intervenção, sem prometer operação universal.

A importação de currículo preenche um perfil editável (sem inventar fatos), a busca prioriza vagas no Brasil e a verificação ATS é integrada à preparação. Não mostrar processos de browser ou múltiplas telas apenas para justificar arquitetura interna.

## Inteligência conectável, não “IA própria”

O Alinha possui o agente (regras, ferramentas, estado, memória e permissões); o modelo conectado fornece interpretação onde necessário. Adaptadores para Gemini, OpenAI API, Claude API, Ollama e alternativas devem obedecer a um contrato comum. Compatibilidade de modelos, disponibilidade, política de API, limites e preço precisam ser confirmados para cada modalidade. Login com uma conta de provedor **não é** login de usuário no Alinha. Não reutilizar credenciais de um operador para atender clientes Cloud.

- **Community/Desktop:** escolha explícita de IA; BYOK/local e possibilidades autorizadas por provedor; sem obrigatoriedade de conta Google/Alinha.
- **Cloud:** a infraestrutura cuida do uso gerenciado com isolamento por conta, limites, consentimento e transparência de custo. BYOK remoto seria opcional e exigiria proteção de segredos no backend.
- Se um modelo não oferecer saída estruturada confiável ou falhar por quota/custo, o agente deve degradar com segurança para ações determinísticas ou revisão, sem forjar respostas.

## Limites de segurança e de produto

- Nunca inventar experiência, habilidade, salário, elegibilidade, autorização de trabalho ou consentimento; campos desconhecidos exigem confirmação.
- Nunca enviar candidatura real apenas porque o modelo solicitou. Para envio externo futuro, exigir autorização delimitada, conectores permitidos, idempotência e confirmação da plataforma.
- Tratar vagas, currículos e HTML como fontes não confiáveis, inclusive possíveis injeções de prompt.
- Logs sem currículos/segredos; minimização, retenção, exclusão e obrigações de privacidade antes da Cloud pública.
- O software Community sob MIT permanece funcional, não uma demonstração dependente de API proprietária do Cloud.

## Arquitetura: código atual vs. decisão futura

A implementação existente usa Next.js/React no web e FastAPI/Python, modelos Pydantic, LangGraph específico de análises, adaptadores de IA, persistência local em evolução e fontes de vagas. Isso **não torna essa stack definitiva**. Rust/Go/TS/Python são candidatos para coordenador, browser, serviços e empacotamento Desktop; a decisão deve ser pragmática e incremental. Ver [registro de arquitetura](architecture-evaluation.md) e [contrato de runtime](agent-runtime-contract.md).

## Negócio Cloud: aberto à validação

A Cloud deverá cobrar pelo valor de operação, conveniência e infraestrutura, não esconder artificialmente o núcleo open source. **Não foi definida cobrança mensal como única opção**: créditos, pagamento por uso ou combinações serão avaliadas por custo real por jornada, suporte, impostos, taxas, abuso e aceitação do público. **Não existem valores, assinaturas ou checkout públicos.**

A página [cloud-business-model.md](cloud-business-model.md) contém um **estudo histórico de opções**, e não uma aprovação de preços, regras de cobrança ou assinatura.

## Ordem de execução atual

1. Fazer a jornada principal `/agente` funcionar com dados fictícios e ferramentas controladas — ver [roadmap](roadmap.md).
2. Validar um provedor BYOK real em teste voluntário, desempenho e limites sem custos inesperados.
3. Provar distribuição Community Open Source reproduzível e Desktop instalável com suporte real em plataformas-alvo.
4. Projetar Cloud e modelo financeiro somente com medidas e garantias de isolamento.

Não tratar planos ou promessas comerciais como funcionalidades implementadas.
