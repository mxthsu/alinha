# Modelo de produto: Alinha Community + Alinha Cloud

> **Decisão de produto, não anúncio de serviço disponível.** O Alinha Cloud, planos pagos e login ChatGPT num site centralizado ainda não foram lançados. Não publicar preços, cotas ou promessas comerciais sem validação de custos, privacidade e viabilidade.

## Visão

O Alinha é um produto brasileiro para analisar currículos em relação a oportunidades, com requisitos identificados, evidências do currículo e recomendações fundamentadas. A distribuição combina uma edição **Community**, livre e independente, com uma oferta de infraestrutura hospedada **inteiramente opcional**. O produto mantém sua identidade, objetivos e arquitetura próprios.

### Princípios inegociáveis

1. **Core aberto e funcional**: o usuário pode executar o Alinha por conta própria, sem licença paga do Alinha, cadastro obrigatório na nuvem ou bloqueios artificiais. A licença do repositório permanece MIT.
2. **Portabilidade**: dados e versões de currículo devem ter exportação em formato aberto; um usuário pode migrar do Cloud para uma instalação própria.
3. **Provedores à escolha do usuário**: Gemini, OpenAI via API convencional, Ollama e outras integrações legítimas podem compartilhar a mesma interface `AnalysisProvider`; jamais depender de um fornecedor único.
4. **Separação entre pagar pela infraestrutura e pagar pela IA**: a assinatura ChatGPT, o consumo de API e a assinatura do Alinha Cloud são produtos distintos, com custos e limites próprios.
5. **Nenhuma alegação artificial sobre ATS**: correspondência é explicada por requisitos, evidências e limitações, não por porcentagens apresentadas como notas oficiais.
6. **Privacidade de currículos**: consentimento claro, minimização de dados, controle de retenção e exclusão, registro de eventos sem conteúdo sensível e atendimento à LGPD antes da disponibilização pública.
7. **Lançamento em pt-BR**: interface, README e documentação pública em português brasileiro; código-fonte e identificadores técnicos em inglês. Preparado para tradução futura.

## As duas formas de usar

### Alinha Community — open source (gratuito como software)

- Instalável no computador do usuário ou em um servidor controlado por ele; usar navegador **não** exige que seja um site público centralizado.
- Site e API com extração, análise e relatórios de evidências; avaliações automatizadas e exportação avançada estão previstas para futuras versões.
- Motor local via Ollama, se houver recursos computacionais; opções BYOK com chaves próprias de provedores, quando disponíveis.
- **Sign in with ChatGPT para uso de plano** exclusivamente no modo oficialmente autorizado a aplicativos OSS locais ou auto-hospedados, conforme escopo, política e limites da OpenAI.
- Dados armazenados somente quando o usuário habilitar funcionalidades de histórico; opção sem persistência por padrão.
- Instalação pelo código-fonte com um comando de desenvolvimento, documentação e CI em PRs. Docker, empacotamento e distribuição simplificada continuam previstos, mas ainda não estão prontos.

Não chamar de “IA ilimitada grátis”: custos de hardware, eletricidade, provedores BYOK e cotas de assinaturas externas continuam existindo.

### Alinha Cloud — hospedado e gerenciado (produto opcional futuro)

- Site público acessível sem instalação, com contas e sessões próprias do Alinha.
- Serviço de análise hospedado com modelos escolhidos e avaliados; créditos/cotas, proteção contra abuso e política transparente de custos.
- Histórico criptografado, sincronização entre dispositivos, backup e disponibilidade operacional gerenciados **como serviços**, não como bloqueio do software Community.
- Opções possíveis: **Cloud Free** (demonstração ou pequena franquia quando houver viabilidade) e **Cloud Plus** (uso mensal/franquia ampliada). Valores e limites só após medir custos reais.
- O usuário poderá optar por API externa própria conforme arquitetura de segurança, mas **BYOK no navegador não deve armazenar segredos em localStorage**; desenhar armazenamento seguro ou modo de conexão adequado por provedor.
- Futuramente, equipes/organizações podem contratar gestão e suporte — fora do escopo do primeiro MVP.

**Proibição de atalho:** não utilizar a assinatura ChatGPT de um operador para atender outros visitantes. A autorização OSS local não dá automaticamente direito de oferecer uso de planos ChatGPT a visitantes de um SaaS remoto. Esse uso comercial/remotamente hospedado depende de aprovação e do fluxo aplicável; consulte [Sign in with ChatGPT](https://developers.openai.com/siwc) e [participação comercial](https://developers.openai.com/siwc/request-client-id).

## Experiência do usuário

**Community (localhost)**: abrir o Alinha → configurar o provedor disponível → enviar documentos → analisar → revisar citações e recomendações. A exportação de relatórios e a seleção de provedores adicionais seguem no roteiro. Nenhum usuário precisa instalar um agente autônomo; a IA é chamada pelo fluxo de análise.

**Cloud (domínio público)**: entrar no Alinha → usar cota gratuita quando disponível ou adquirir créditos/plano → enviar documentos → receber relatório → decidir se deseja salvar ou excluir. O Cloud nunca apresenta o botão de plano ChatGPT local como se fosse um login comercial aprovado.

## Arquitetura alvo

```text
apps/web (Next.js: interface pt-BR)
    |
    v
apps/api (FastAPI: validação, análise, relatórios)
    |
    +--> analysis core: extração -> geração -> checagem literal -> resposta
    |
    +--> provider adapter: Gemini / OpenAI API / Ollama / ChatGPT OSS local*
    |
    +--> deployment policy: community | cloud (separar comportamento)
    |
    +--> cloud services (somente modo cloud, futuros):
         identidade e sessão | créditos e medição | pagamento |
         histórico opcional | limites e auditoria
```

\* ChatGPT OSS exige modalidade de execução elegível, habilitação explícita e armazenamento protegido de credenciais. Não existe roteamento de token ChatGPT para a conta Alinha Cloud.

### Regras técnicas

- O fluxo de verificação de evidências é o **mesmo** para todos os provedores e modalidades de implantação.
- `DeploymentMode` não pode ser inferido a partir de um cabeçalho informado pelo visitante; deve ser configurado e verificado no servidor.
- `ProviderCapabilities` explicita login, autenticação, modelos, custos, retenção e disponibilidade conforme a implantação.
- `UsageMetering` e `Billing` são contratos de serviço isolados; não espalhar verificações de plano pelas regras do domínio.
- O front consome contratos estáveis e não transporta tokens de provedores.
- Sem modelos fictícios como se estivessem conectados, sem troca silenciosa de provedor e sem cobranças inesperadas.
- Testes funcionais e avaliações de qualidade usam currículos e vagas inteiramente sintéticos.
- A publicação deve documentar política de privacidade, segurança, consentimento e termos de uso antes de processar documentos pessoais reais em produção.

## Ordem de execução

| Etapa | Entregável | Critério de conclusão |
| --- | --- | --- |
| 1. Fundação | Decisão Community/Cloud, contratos de provider/deployment, documentação de instalação | Nenhum caminho local confundido com SaaS público |
| 2. Community MVP | Instalação reproduzível; Gemini BYOK + Ollama; ChatGPT OSS local quando elegível; demonstração | Análise ponta a ponta com provedor de teste e evidência verificada |
| 3. Avaliação | Dataset sintético, avaliação de qualidade, custo e latência | Métricas replicáveis, limitações e benchmarks publicados |
| 4. Cloud MVP | Autenticação do Alinha, provisionamento, quotas, políticas de privacidade e implantação | Sistema acessível publicamente sem exposição de chaves |
| 5. Serviço pago | Créditos/assinatura, medição e controles financeiros | Margem/custo e abuso validados; pagamento confiável |
| 6. Expansão | Histórico opcional, exportação, integrações, recursos para equipes | Funcionalidades mantidas portáveis entre Community e Cloud |

## O que **não** faremos agora

- Não cobrar por análises antes de entender custo por análise e proteção contra abuso.
- Não implementar login com ChatGPT para um site remoto por imitação de endpoints privados.
- Não vincular a autenticação dos usuários Alinha exclusivamente a uma assinatura ChatGPT.
- Não criar vários agentes ou adicionar RAG, pgvector e novas filas sem necessidade comprovada.
- Não afirmar que uso do ChatGPT OSS preserva uma franquia separada do Codex; limites podem ser compartilhados por aplicativos.
- Não criar planos/pricing de fachada na interface.

## Próxima decisão técnica

O PR [#3](https://github.com/mxthsu/alinha/pull/3) implementa **integrações locais** e continua separado da versão hospedada. Antes do merge, revisar especialmente:

1. Habilitação segura do modo Community e vínculo a `127.0.0.1`, sem tokens expostos.
2. Proibir OAuth ChatGPT de assinatura OSS quando o modo Cloud estiver configurado.
3. Não oferecer Ollama no Cloud como se o navegador pudesse executar inferência no PC do usuário.
4. Adicionar provedor OpenAI **com API key convencional** separado de ChatGPT OSS, além de Gemini/Ollama.
5. Documentar claramente que OAuth local usa cotas do plano do usuário e depende de sua autorização.

Essa separação permite evoluir o produto sem reconstruir a interface aprovada.
