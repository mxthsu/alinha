# Alinha — benchmark de arquitetura (isolado)

Esta POC não escolhe arquitetura por linguagem ou preferência. Compara três caminhos para executar formulários sintéticos num Chromium **idêntico**, sem tocar em vagas reais ou dados de candidatos:

- Go/chromedp — pacote Go e automação CDP no mesmo processo.
- Rust/agent-browser — CLI/daemon nativo de Rust com controle CDP.
- TypeScript/Playwright — biblioteca no processo Node.js.

O workflow [Architecture Benchmark](../../.github/workflows/architecture-benchmark.yml) executa a matriz no mesmo runner Ubuntu e publica tempos individuais e mediana em GitHub Actions. Para repetir, abra um PR modificando este diretório ou dispare o workflow manualmente.

## Cenário controlado

O fixture local tem nome, e-mail e telefone; seleção que revela uma pergunta condicional; segunda etapa; upload de um CV inteiramente fictício; consentimento explícito; confirmação DOM. Os executores preenchem **somente esse formulário sintético**. Cinco repetições com navegador reaproveitado para reduzir variação de inicialização. Zero chamadas de IA.

## Critérios de interpretação

1. A execução deve terminar em confirmação verificável. Falhas são falhas, nunca resultados de 0ms.
2. Comparar medianas **somente** entre runs concluídos; analisar também variabilidade e logs.
3. Agent-browser envolve uma CLI por ação enquanto as outras versões chamam bibliotecas in-process: os tempos refletem arquiteturas de integração **diferentes**, não uma comparação pura de linguagens.
4. Este fixture favorece seletores estáveis. Ainda não mede detecção semântica, navegação em sites reais, autenticação, CAPTCHA, recuperação de erros, UX em uma tela, portabilidade, RAM do Chromium, custo cloud ou qualidade de modelos.
5. Não converter diferença pequena de milissegundos em motivo de reescrita do Alinha. Uma arquitetura só vence se os testes de compatibilidade, custos e empacotamento também favorecerem-na.

## Próximos testes obrigatórios

- Formulários React/Angular, iframes, componentes com validação assíncrona e navegação de 3+ etapas.
- Windows/macOS/Linux: distribuição do Community/instalador Desktop, assinatura, atualização e login.
- Recuperação após fechamento do browser, timeout, MFA e idempotência de envio.
- Contrato universal de IA com fake/local e BYOK, cobrindo respostas estruturadas, fallback, quota, custo máximo e injeção de prompt.
- Testes em plataformas reais **somente quando autorizados**, evitando qualquer submissão involuntária.

Se a CI não rodar por limitações de conta ou dependências, o resultado é **não validado**. Não inventar tempos.
