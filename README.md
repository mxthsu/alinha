<div align="center">

# alinha.

**Sua experiência, novas oportunidades.**

A direção do Alinha é um **chat simples para pessoas de qualquer profissão**, que ajuda a montar currículo, encontrar vagas e candidatar-se em um só lugar. O agente sugere próximos passos e respostas editáveis e apresenta cards, formulários e prévias conforme a necessidade. **Essa experiência conversacional completa ainda será implementada**; consulte a [visão](docs/career-product-vision.md), os [critérios de experiência](docs/agent-experience.md) e o [roteiro vigente](docs/roadmap.md).

O Alinha está evoluindo para um **agente de carreira**: da criação do currículo à descoberta de vagas, preparação de candidaturas e acompanhamento. A versão atual já oferece Studio, legibilidade ATS e comparação de evidências com vagas; **envio automático de candidaturas ainda não está disponível**.

[![CI](https://github.com/mxthsu/alinha/actions/workflows/ci.yml/badge.svg)](https://github.com/mxthsu/alinha/actions/workflows/ci.yml)
[![Licença MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-286443)](LICENSE)
[![Contribuições](https://img.shields.io/badge/contribui%C3%A7%C3%B5es-bem--vindas-619a59)](CONTRIBUTING.md)

[**Começar**](docs/getting-started.md) · [**Retomar desenvolvimento**](docs/CONTINUAR-ALINHA.md) · [**Documentação**](docs/architecture.md) · [**Contribuir**](CONTRIBUTING.md) · [**Roteiro**](docs/roadmap.md)

</div>

![Prévia da interface do Alinha, com comparação de requisitos e evidências](docs/assets/site-preview.png)

## Próxima fase: agente de carreira

**Direção atual:** três distribuições do mesmo núcleo: **Alinha Community — Open Source** (desenvolvedores/self-hosted), **Alinha Desktop** (aplicativo instalável) e **Alinha Cloud** (serviço gerenciado futuro). O Desktop pode ser open source; distribuição não determina licença. Rust, Go, Python e TypeScript seguem em avaliação, sem reescrita aprovada. Consulte o [guia de retomada](docs/CONTINUAR-ALINHA.md), o [contrato do agente](docs/agent-runtime-contract.md) e a [avaliação sem viés](docs/architecture-evaluation.md).
O modelo de autonomia previsto é **assistido por padrão, podendo evoluir para execução automática com autorização prévia delimitada**:
fontes permitidas, critérios, versões de currículo aprovadas, prazo, limites por dia,
pausa e revisão humana quando necessário. **Nenhuma candidatura é enviada nesta fase.**

- [Visão de produto e etapas](docs/career-product-vision.md)
- [Fronteira de arquitetura open-core](docs/open-core-boundaries.md)
- [Contratos técnicos e segurança de candidaturas](docs/agent-application-contract.md)

## Configurações locais do Community

A nova área **Meu Alinha** (/meu-alinha) reúne a configuração local do agente,
as fontes de vagas e as conexões de IA. As chaves continuam no cofre do sistema
operacional, não nos arquivos de configuração.

O backend agora oferece uma primeira camada de SQLite local e preferências
versionadas em JSONC, fora da pasta do repositório. **Os currículos e as vagas
existentes ainda permanecem no navegador:** agora é possível copiar os registros
com prévia e confirmação em Meu Alinha, com backup SQLite e sem apagar os
originais. O Studio, o agente e o Kanban passam a utilizar o SQLite após essa migração; versões por vaga ainda dependem de uma etapa posterior. Veja [plano de conclusão do Community](docs/community-release-plan.md).

## Meu agente: do currículo à oportunidade

A rota `/agente` oferece a jornada atual de importação/reutilização de currículo, objetivo, busca autorizada e prévias revisáveis. A interpretação de objetivo por IA é opcional; busca e sinais literais também funcionam sem inferência. Nenhuma candidatura é enviada.

O backend já possui executor persistente, filtros verificados e recuperação supervisionada. A interface ainda usa parte do fluxo anterior e **não é o chat completo planejado**. A próxima entrega conecta essa execução à experiência conversacional, com sugestões contextuais, cards e retomada. Quem começa sem currículo terá condução por conversa em um incremento próprio; o Studio manual continua disponível hoje.

Leia a [experiência desejada](docs/agent-experience.md) e o [estado verificável](docs/CONTINUAR-ALINHA.md).

## Por que o Alinha?

Descrições de vagas costumam reunir várias competências, experiências e expectativas em um único texto. O Alinha organiza esse conteúdo e compara cada requisito com trechos do currículo, ajudando a pessoa a identificar evidências e melhorar sua apresentação profissional com **informações verdadeiras**.

- **Evidências antes de pontuações:** citações literais da vaga e, quando existirem, do currículo.
- **Requisitos por situação:** com evidência, evidência parcial ou não identificado.
- **Recomendações responsáveis:** sugestões de como explicar melhor o que foi realmente feito.
- **Arquivos e texto:** cole o currículo ou utilize PDF, DOCX ou TXT.
- **Código aberto:** interface, API e verificações podem ser auditadas e executadas localmente.
- **Demonstração sem conta:** explore um resultado explicitamente fictício, sem chamar a IA.

Também incluímos um [currículo e uma vaga inteiramente fictícios](examples/README.md) para testar o formulário sem expor dados pessoais.

O Alinha não simula notas de sistemas ATS, não prevê contratações e não deve ser usado como decisão automática sobre candidatos.

## Community Open Source, Desktop e Cloud opcional

No Alinha Community você escolhe o provedor de IA, incluindo Gemini, Claude API, OpenAI API e Ollama local, além de ChatGPT quando elegível em uso local autorizado. A conexão é configurada uma vez na central **Conexões de IA** (`/conexoes`); as ferramentas passam a listar os provedores disponíveis sem exibir novamente formulários de chave. A licença do Alinha não exige pagamento; cobranças de APIs externas e uso do hardware são de responsabilidade do usuário.

O **Alinha Desktop ainda não tem instalador público** e o **Alinha Cloud ainda não existe como serviço público**. A proposta futura é infraestrutura gerenciada com controle de consumo, sem assumir modelo definitivo de cobrança. Leia [modelo das três distribuições](docs/product-model.md) e [estratégia comercial](docs/cloud-business-model.md). Não há preços nem checkout disponíveis nesta versão.

## Acompanhe as oportunidades no Community

O quadro **Acompanhar candidaturas** (/candidaturas) permite salvar vagas da pesquisa
ou adicionar manualmente links de plataformas de emprego. Cada etapa é declarada
pelo usuário: o Alinha **não confirma candidaturas, entrevistas ou propostas** e
**não acessa automaticamente as páginas adicionadas**. As informações ficam localmente, no navegador legado ou no SQLite conforme a migração, sem conta e com exportação/importação JSON validada. O armazenamento do quadro não inclui currículos.

Veja [como o acompanhamento funciona](docs/opportunity-tracking.md). As vagas salvas também podem abrir diretamente a preparação da candidatura, mantendo título, empresa e link da oportunidade.

## Encontre vagas remotas disponíveis para o Brasil

A área **Encontrar vagas** (/vagas) consulta fontes públicas selecionáveis (comunidades brasileiras GitHub, Himalayas, Lever e Gupy experimental), mantém atribuição visível e abre o link da vaga na fonte original. É possível informar cargo, preferência de modalidade, vínculo CLT/PJ, cidade e salário pretendido. Como cada fonte possui cobertura e campos diferentes, informações contratuais ou salariais não publicadas permanecem **a confirmar**, nunca são inventadas. A busca não envia candidaturas nem envia currículos às fontes de vagas. Veja [como funciona a descoberta](docs/job-discovery.md) e [revisão de segurança](docs/security-review.md).

## Crie seu currículo no Studio

O [Currículo Studio](apps/web/src/app/studio) (rota `/studio`) permite preencher seções estruturadas, escolher dois modelos, acompanhar uma prévia em tempo real e exportar DOCX. As sugestões de melhoria são oferecidas em Preparar candidatura, após a comparação com os requisitos de uma vaga informada. O perfil do currículo é salvo automaticamente neste dispositivo, no SQLite em instalações novas ou migradas, ou no navegador legado antes da migração. Ele é reutilizado em Preparar candidatura, sem conta ou persistência remota. JSON é apenas um backup opcional; você pode apagar o rascunho local. Consulte a [documentação do Studio](docs/studio.md).

## Prepare sua candidatura

Acesse **Preparar candidatura** (`/preparar`) para verificar a leitura ATS do currículo e, opcionalmente, comparar o mesmo arquivo com os requisitos de uma vaga usando sua IA conectada. Você não precisa selecionar o documento duas vezes dentro dessa jornada. As antigas rotas `/ats` e `/analisar` redirecionam para ela.

No **Currículo Studio**, use **Importar currículo** para preencher diretamente os campos do editor com PDF/DOCX/TXT e corrigir qualquer informação, se necessário. A extração estruturada não usa IA e mantém trechos não reconhecidos para revisão. Consulte [fluxo de candidatura](docs/application-workflow.md).

### Verifique a legibilidade ATS

Acesse **Verificar ATS** no menu (rota `/ats`) para identificar obstáculos comuns de leitura em PDF, DOCX ou TXT. A checagem não depende de uma conta de IA nem faz uma cobrança de inferência: o Alinha examina texto extraível e características da estrutura do documento, apresentando recomendações verificáveis. **Não há pontuação ATS universal ou garantia de aprovação.** Entenda os critérios e limites no [guia de compatibilidade ATS](docs/ats.md). Após o diagnóstico, você pode abrir o editor, ajustar manualmente e exportar um DOCX simples com texto selecionável.

## Experimente no seu computador

**Pré-requisitos:** Python 3.11+, [uv](https://docs.astral.sh/uv/), Node.js 24 e npm.

```bash
git clone https://github.com/mxthsu/alinha.git
cd alinha
python scripts/dev.py
```

O primeiro início instala as dependências necessárias. Abra **http://localhost:3000**: a home mantém o hero com a prévia e mostra o estado real **Conectar IA / IA conectada** na navegação e no botão principal, sem seções de onboarding repetidas. Escolha seu provedor em **Conexões de IA** (`/conexoes`) ou comece diretamente pelo Studio (`/studio`) e pelo diagnóstico ATS (`/ats`) sem precisar de IA. **Community não exige conta Google nem cadastro.** Leia [identidade Community e Cloud](docs/authentication.md) e [como a conexão funciona](docs/provider-experience.md). Pressione **Ctrl+C** para parar os serviços.

No Windows, você também pode iniciar com `py -3 scripts/dev.py`. Para instruções manuais, configuração do provedor e solução de problemas, consulte o [guia de instalação](docs/getting-started.md).

**Análises reais:** conecte Gemini, Claude (Anthropic API) ou OpenAI API pela central de conexões do site local. Também há Ollama e o login ChatGPT OAuth no Alinha Community, quando elegíveis. As chaves são verificadas e armazenadas no cofre do sistema operacional, sem persistência no navegador. A demonstração não exige configuração. Consulte [provedores e segurança](docs/providers.md).

## O que acontece durante a análise?

```text
Currículo + descrição da vaga
            |
            v
   Extração e validação
            |
            v
     Provedor de IA
            |
            v
  Requisitos e evidências
            |
            v
Verificação literal de citações
            |
            v
  Relatório com limitações
```

O pipeline utiliza **FastAPI, Pydantic e LangGraph**. A geração por IA e a verificação determinística são etapas separadas: se o modelo citar algo que não aparece no material enviado, a verificação rejeita ou reclassifica a alegação. Isso reduz erros de citação, mas não garante que a interpretação semântica da IA esteja sempre correta.

### Componentes do projeto

| Caminho | Responsabilidade |
| --- | --- |
| [`apps/web`](apps/web) | Site responsivo em Next.js, React e TypeScript |
| [`apps/api`](apps/api) | API Python, extração de documentos e análise |
| [`docs`](docs) | Guias, arquitetura, decisões e roteiro |
| [`scripts`](scripts) | Inicialização simplificada para desenvolvimento |
| [`.github`](.github) | Verificações de qualidade em pull requests |

## Edições e evolução

O **Alinha Community** é software de código aberto sob a licença MIT, projetado para instalação própria. Uma oferta **Alinha Cloud**, com execução hospedada e serviços opcionais, está no planejamento e **não está disponível para contratação**.

Queremos manter o núcleo útil sem assinatura obrigatória. A modalidade hospedada deverá oferecer conveniência operacional, com custos e limites transparentes, sem restringir artificialmente a edição Community. Veja [visão de produto](docs/product-model.md).

| Capacidade | Situação |
| --- | --- |
| Interface pt-BR, arquivos, demonstração fictícia | Disponível no código |
| Gemini, Claude e OpenAI API via chaves pessoais | Implementados; requerem validação real com chave do usuário |
| Login ChatGPT local por OAuth e Ollama | Implementados; aguardam homologação real com conta/modelo |
| Testes automatizados de API e CI | Disponíveis |
| Avaliações sistemáticas e métricas de qualidade | Planejado |
| Alinha Cloud, histórico sincronizado e pagamentos | Planejado; não disponível |

## Privacidade e limites

Os arquivos originais enviados para extração são processados em memória. **O perfil estruturado, as versões aprovadas e as oportunidades podem ser salvos localmente**, no SQLite ou no armazenamento legado do navegador, conforme o fluxo e a migração. As jornadas persistentes também guardam resultados, termos comparados e rascunhos locais; não duplicam o currículo inteiro nem guardam chaves de IA. Consulte [migração e recuperação](docs/community-data-migration.md) e [dados das jornadas](docs/agent-durable-runtime.md) antes de exportar, restaurar ou excluir dados.

Se você habilitar uma análise com provedor externo, o conteúdo necessário à operação será enviado para processamento por esse serviço conforme suas condições. **Não utilize currículos de terceiros sem autorização**. A direção conversacional não altera automaticamente esses fluxos nem cria retenção de conversas.

A extração ainda não suporta OCR de PDFs digitalizados. O resultado não substitui julgamento humano. Confira [segurança](SECURITY.md), [arquitetura](docs/architecture.md) e [roteiro técnico](docs/roadmap.md).

## Comunidade

Relatos de erros, melhorias e contribuições são bem-vindos. Veja [como contribuir](CONTRIBUTING.md) e as [issues](https://github.com/mxthsu/alinha/issues). Utilize somente dados fictícios em testes, exemplos e pull requests.

**Licença:** [MIT](LICENSE).
