# Founder no Alinha — validação de negócio

> Pesquisa de produto, não funcionalidade do aplicativo. Base de trabalho iniciada em 20/10/2026. **Não é estudo de viabilidade concluído.**

Este diretório aplica as 11 etapas do [Founder Skill](https://github.com/Jakeschincariol/founder-skill) ao Alinha, sem confundir simulações, estimativas e observações reais. O projeto original está disponível também em `.claude/skills/founder-*/` para uso local no Claude Code ou OpenCode. Consulte [o licenciamento de terceiros](../.claude/founder-upstream-LICENSE).

## Situação por etapa

| Etapa | Material inicial | Evidência pendente |
| --- | --- | --- |
| 1. Board | [board.md](board.md): avaliação crítica por três perspectivas | Testes com pessoas reais e distribuição |
| 2. Concorrência | [competitors.md](competitors.md): preços/recursos públicos | Revisão periódica; comparativo brasileiro adicional |
| 3. Consumidor | [consumer.md](consumer.md): segmentos e protocolo de entrevistas | Entrevistas reais; nenhum painel executado |
| 4. Preço | [pricing.md](pricing.md): hipóteses e desenho de teste | Disposição a pagar, custos e taxas |
| 5. Oferta | [offer.md](offer.md): proposta inicial honesta | Teste de compreensão e conversão |
| 6. CFO | [cfo.md](cfo.md): modelo e dados necessários | `numbers.json` com custos medidos; cálculo não executado |
| 7. Marketing | [marketing.md](marketing.md): canais e mensagens | Métricas reais de aquisição |
| 8. Marca | [brand.md](brand.md): identidade atual e verificação | Teste de mensagem; disponibilidade de marca/domínio |
| 9. Operações | [ops.md](ops.md): rotina e riscos | Orçamento operacional e requisitos legais |
| 10. Lançamento | [launch.md](launch.md): experimento em 30 dias | Execução do piloto |
| 11. Plano | [plan-readiness.md](plan-readiness.md): critérios de decisão | Compilação automática depois de custos e pesquisa |

## Como executar as skills

As 11 skills originais e quatro ferramentas Python estão em `.claude/skills/`. O OpenCode também identifica skills colocadas nesse local; na CLI do Claude Code, use os comandos `/founder-board`, `/founder-competitors` etc., conforme o ambiente. **Os comandos executáveis são assistidos pelo agente, não pela aplicação Alinha**.

Ordem sugerida: `board → competitors → consumer → pricing → offer → cfo → marketing → brand → ops → launch → plan`.

Para uso manual de ferramentas, execute a partir da raiz do repositório:

```sh
python .claude/skills/founder-cfo/unit_economics.py founder/numbers.json --out founder/cfo-modelado.md
python .claude/skills/founder-consumer/panel.py init --customer founder/customer.json --pitch founder/pitch.md --n 20
python .claude/skills/founder-pricing/van_westendorp.py founder/panel/answers --out founder/pricing-curve.md
python .claude/skills/founder-plan/compile.py --dir founder --check
```

Os comandos dependem dos arquivos de entrada descritos em cada skill. **Não execute cálculo econômico até preencher dados reais ou hipóteses explicitamente identificadas.** O painel virtual não existe ainda; apenas gerar 100 personas não significa entrevistar 100 compradores. Em OpenCode, caminhos `${CLAUDE_SKILL_DIR}` mencionados nos materiais de origem devem ser substituídos pelo caminho explícito `.claude/skills/<skill>/`, quando não houver essa variável.

## Regras de evidência

- **Verificado**: código do Alinha consultado ou fonte pública com URL/data. Revalidar antes de decisões.
- **Hipótese**: público, oferta, disposição a pagar, canal ou custo ainda não testado.
- **Simulação**: resultado gerado por modelo ou cálculo de cenário, sem valor de pesquisa amostral.
- **Medido**: coleta consentida de eventos operacionais reais, sem currículos ou dados identificáveis no GitHub.

Nunca anunciar ROI, lucro, aprovação em ATS, taxa de contratação, economias de tempo ou compra simulada como resultado comprovado.
