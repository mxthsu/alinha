# CFO — modelo de economia unitária (pendente de dados)

**Resultado atual: INCOMPLETO.** Não foi executado cálculo de lucro ou break-even, pois não existe preço Cloud nem custo operacional medido. Qualquer ROI nesta fase seria inventado.

## Unidade econômica

Uma unidade candidata é **uma conta Cloud pagante por mês**; créditos consumidos e tarefas gerenciadas precisam de rastreabilidade por conta e operação. Nunca misturar a edição Community (custo de licença zero) com despesas Cloud.

Variáveis a coletar em BRL (com fonte, data e metodologia):

- Receita líquida por assinante-mês, após tributos, estornos e taxas proporcionais.
- Custo variável: tokens por modelo, retries, processamento de documentos, execução de tarefas, armazenamento, transferência e atendimento proporcional.
- Custos fixos mensais: hospedagem-base, observabilidade, monitoramento, serviços, contabilidade, suporte mínimo e manutenção.
- Gastos de implantação: produção, segurança, proteção de dados, identidade, billing, comunicação e aquisição inicial.
- Coortes de usuários ativos/pagantes e consumo por percentil (p50/p90/p99), não somente média.
- Taxas de aquisição e cancelamento, obtidas em testes reais.

```text
contribuição_mensal = receita_líquida_por_conta - custo_variável_por_conta
margem_contribuição = contribuição_mensal / receita_líquida_por_conta
contas_break_even = teto(custos_fixos / contribuição_mensal)  # se > 0
```

## Guardrails para o estudo

- Se contribuição <= 0, **não** escalar: cada nova conta aumenta a perda.
- Custo de IA incerto exige limites de consumo antes de qualquer assinatura.
- Modelar p90/p99, falhas, abuso e alta utilização; não vender “ilimitado”.
- Não prometer lucro no primeiro ano por uma conta simulada.

## Quando os insumos estiverem prontos

Criar `founder/numbers.json` a partir do esquema em `.claude/skills/founder-cfo/example.json`, ajustando claramente a unidade de venda e o período. Executar `unit_economics.py` e revisar seus pressupostos: o modelo original de vendas diárias foi criado para negócios físicos e **não traduz automaticamente churn, pagamentos e créditos** de SaaS. Acrescentar modelo financeiro SaaS adequado antes de decisão real.

Contabilidade, impostos e tratamento de contratos requerem verificação profissional. Ver [estratégia comercial atual](../docs/cloud-business-model.md).
