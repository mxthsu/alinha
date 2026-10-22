# Estudo de monetização Cloud (hipóteses, não decisão final)

> **Atualização de direção — 22/10/2026:** agora existem três distribuições planejadas: **Community Open Source (dev), Desktop (aplicativo) e Cloud (online)**. Modelos de mensalidade, planos, franquias e créditos abaixo são **alternativas históricas para estudo**, não decisões aprovadas. O usuário não aprovou assinatura mensal como padrão. A decisão comercial depende de custo por jornada e validação. Ver [modelo atual](product-model.md) e [guia para novo chat](CONTINUAR-ALINHA.md).

> Documento de planejamento. Em outubro de 2026 **nenhum plano Cloud, pagamento, crédito ou acesso público gerenciado está disponível**. Não publicar valores definitivos nem simular checkout antes da implantação segura e da medição real de custos.

## Premissas do estudo anterior (não representam preços nem cobrança aprovada)

O Alinha continuará um **produto open source sob licença MIT**, com os principais recursos disponíveis no Community, sem cadastro ou pagamento ao Alinha. A receita futura virá da conveniência da infraestrutura gerenciada, não do bloqueio artificial da análise de currículos.

| Característica | Community (instalação local) | Cloud (serviço futuro) |
| --- | --- | --- |
| Código e editor | Open source, sem licença do Alinha | Base comum |
| Inferência | Gemini, Claude API, OpenAI API, Ollama e ChatGPT local quando autorizado | Provedores contratados pelo próprio Alinha |
| Pagamento da IA | Conta/API/hardware da pessoa; contratos com terceiros | Créditos de inferência incluídos no plano |
| Perfil | Memória do navegador + exportação JSON/DOCX | Contas, sincronização e histórico opcional |
| Privacidade | Credenciais no cofre do sistema operacional; nenhum currículo persistido por padrão | Isolamento por usuário, consentimento, criptografia e exclusão |
| Custos do Alinha | Nenhum | Assinatura mensal ou créditos adicionais |
| Riscos e limites | Conforme provedor e hardware do usuário | Política de uso, saldo e limites exibidos no serviço |

A liberdade de escolher modelos e provedores permanece **integralmente no Community**. O provedor pode mudar entre operações; o sistema não faz fallback silencioso para um modelo pago. Chaves introduzidas pela interface local nunca são transmitidas à hospedagem do Alinha.

## Proposta de monetização Cloud

**Primeiro MVP comercial:** assinatura com **franquia mensal de créditos**, representando o custo variável das operações com IA. Se o limite acabar, a operação é bloqueada até renovação ou compra *expressamente autorizada* de créditos adicionais. Não gerar cobranças por excesso de forma automática.

Oferta inicial para validar com entrevistas e experimentos:

1. **Experimente (sem pagamento):** edição, prévia, templates e demonstrações fictícias. Inferência gratuita real somente se a economia unitária e a proteção contra abuso justificarem.
2. **Cloud Individual:** conta, currículos e versões sincronizados, backup, histórico e créditos de IA mensais.
3. **Créditos adicionais opcionais:** compra antecipada para operações com maior consumo. Um modelo avançado pode consumir mais créditos que um modelo econômico, conforme tabela publicada.
4. **Equipes (depois):** colaboração e gerenciamento organizacional com contrato e requisitos específicos, fora do primeiro lançamento.

**Fora do MVP:** planos ilimitados, cobrança variável pós-paga aberta, compartilhamento de uma assinatura ChatGPT entre usuários, venda de aprovações/"notas oficiais" de ATS, planos escondidos em código de domínio e uso compulsório do Cloud.

### Por que créditos, e não "N análises"?

Analisar 800 palavras com um modelo econômico não custa o mesmo que processar um currículo longo com um modelo premium. O sistema precisa informar a estimativa **antes** do envio e reconciliar o custo real **depois**, dentro do orçamento previamente autorizado. O preço do crédito só será fixado quando houver medição confiável, taxas de pagamento reais e impostos avaliados.

Para cada operação, acompanhar no backend (sem armazenar o currículo nos eventos financeiros):

- identificador de usuário/conta e identificador idempotente da operação;
- tipo de operação e versão do modelo;
- tokens de entrada/saída, custo do fornecedor e custo incremental de infraestrutura;
- créditos reservados e créditos efetivamente consumidos;
- estado: reservado, confirmado, liberado ou estornado;
- timestamp, versão da tabela de preços e status do pagamento.

Modelo de planejamento de economia unitária (sem afirmar valores atuais):

```text
custo_variável =
    tokens_entrada * tarifa_entrada_modelo
  + tokens_saida * tarifa_saida_modelo
  + infraestrutura_incremental
  + custo_de_armazenamento
  + taxas_transacionais_e_tributos_alocados

margem_unitária = receita_líquida_da_operação - custo_variável
```

Nunca basear a cobrança em número de chamadas **apenas**: chamadas falhas, retries, streaming e respostas parciais precisam de política transparente. Guardar valores monetários em unidades inteiras (centavos) ou decimais exatos, nunca `float`, e usar livro-razão (ledger) auditável.

## Contratos e fronteiras arquiteturais

```text
Alinha Community (localhost)
   Next.js -> FastAPI -> ProviderRouter -> Gemini | Anthropic | OpenAI API | Ollama | ChatGPT local elegível
                  |             |
                  |             +-> LangGraph -> verificação de evidências
                  +-> Keyring do sistema (segredos pessoais)

Alinha Cloud (futuro)
   Next.js -> Identidade e sessão -> API autenticada
           -> Entitlement & QuotaPolicy
           -> UsageMeter (reserva atômica/idempotente)
           -> ManagedProviderRouter -> LangGraph -> verificação
           -> UsageMeter (confirma/estorna) -> Ledger
           -> BillingAdapter (checkout, webhooks verificados)
           -> Banco com isolamento por tenant + histórico opt-in
```

**Regra de segurança:** o modo de implantação é decidido pelo servidor. Enquanto autenticação de contas, quotas atômicas, medição, pagamentos e controles de privacidade não existirem, `ALINHA_DEPLOYMENT_MODE=cloud` deve continuar falhando fechado (inferência HTTP 503). **Não reutilizar** o OAuth ChatGPT exclusivo do Community em um SaaS público.

### Fluxo de autorização e cobrança planejado

1. Validar identidade, assinatura e franquia **no servidor**.
2. Calcular uma estimativa razoável da operação e reservar créditos atomicamente, sem saldo negativo.
3. Validar cotas concorrentes, tamanho de arquivos, abuso, limite por conta e limite global de custos.
4. Chamar apenas o modelo selecionado e autorizado, com número conhecido de tentativas.
5. Confirmar os créditos consumidos pela telemetria do provedor ou liberar a reserva segundo a política de falhas. Evitar dupla contabilização.
6. Exibir recibo legível de consumo, modelo, data e saldo. Não armazenar texto do currículo no ledger.
7. Tratar renovações e créditos comprados **somente** após webhooks assinados e idempotentes, nunca após um redirect visual de "pagamento concluído".

Idempotência, locks/transações de concorrência, reconciliação, retenção, estornos e políticas contra fraude precisam ser testados antes da primeira cobrança real.

## Processamento de pagamentos: opções viáveis

- **Stripe Billing + pagamentos:** assinaturas e recursos de billing por uso/créditos; analisar disponibilidade de recursos na conta de cobrança, taxas em BRL, tributação e políticas de crédito antes de escolher. Referências: [Stripe Billing Brasil](https://stripe.com/br/billing/pricing) e [cobrança baseada em uso](https://docs.stripe.com/billing/subscriptions/metered-billing/thresholds).
- **Mercado Pago Assinaturas:** API para planos, assinaturas recorrentes e faturas, com pagamentos adaptados ao mercado local. Para créditos por uso, a contabilidade de consumo continua sendo responsabilidade do Alinha. Referência: [API de Assinaturas](https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/overview).

**Escolha provisória:** investigar Stripe Billing primeiro se precisarmos de recursos integrados para medição e assinatura; validar Mercado Pago para pagamentos locais e conversão. A escolha definitiva dependerá de um protótipo sandbox, tributação local e taxas negociadas. Não adicionar dependência de nenhum gateway à API Community agora.

## Critérios objetivos antes de lançar

- Autenticação própria, separação de contas e autorização em todos os endpoints de usuário.
- Proteção de documentos, criptografia, retenção opt-in, exportação/remoção de dados e transparência LGPD.
- Reserva atômica, créditos idempotentes, limites de consumo por conta/modelo e limite de perdas do operador.
- Webhooks assinados, testes de duplicação, disputas, reembolso, timeout, cancelamento e inadimplência.
- Observabilidade de custo/latência e avaliação de qualidade com dataset sintético anotado.
- Política comercial com preço, câmbio, tributos, franquia, validade de créditos e condições de cancelamento aprovadas.
- Processos de atendimento e operação, backups, recuperação, auditoria e contratos de provedores.

Até essa validação, o produto anuncia **somente** a edição Community real; Cloud é um plano de evolução, não uma funcionalidade simulada.
