# Validação no Windows — 22/10/2026

## Ambiente e isolamento

Os testes foram executados num desktop Windows com Chrome instalado, numa **cópia temporária** da branch `chore/architecture-benchmark-2026`. As cópias locais do Alinha com alterações de trabalho não foram editadas. Apenas documentos e currículos **fictícios** foram usados. Nenhuma plataforma de recrutamento externa foi acessada e nenhuma candidatura real foi enviada.

Go 1.27.3 foi obtido do site oficial e conferido por SHA-256. Rust 1.99.1 e rustup foram instalados em diretório temporário sem atualizar o PATH global. O Rust GNU conseguiu compilar no Windows usando `-C linker=rust-lld`, dispensando a instalação do Visual Studio Build Tools. O executável nativo Rust do `agent-browser` foi obtido por pacote npm no workspace de teste.

## Teste de automação no Chrome do Windows

Fixture comum: formulário sintético de duas etapas, dependência assíncrona, campo condicional, upload e confirmação de sucesso. Zero chamadas de IA.

| Motor | Êxitos | Tempos individuais (ms) | Mediana (ms) |
|---|---:|---|---:|
| TypeScript + Playwright | 10/10 | 611.3, 372.8, 374.6, 374.9, 367.7, 360.8, 361.0, 375.1, 375.6, 399.8 | 374.75 |
| Go + chromedp | 10/10 | 418, 347, 354, 340, 337, 333, 370, 331, 341, 338 | 340.5 |
| Rust + agent-browser | 10/10 | 1118, 416, 409, 400, 410, 413, 414, 422, 428, 402 | 413.5 |

**Atenção à comparabilidade:** o runner Rust do Windows reutilizou a aba, enquanto os runners TypeScript e Go recriaram abas; por isso a mediana Rust **não deve ser comparada diretamente** às outras duas. Também foi detectada uma diferença entre as semânticas de `tab close` no Windows e no Linux, que precisa de tratamento próprio. Tempos são de uma única máquina, um único formulário, não representam ATS reais.

**Alerta de compatibilidade:** Go/chromedp registrou avisos de decodificação de `IPAddressSpace: Loopback` nas mensagens recentes do Chrome, mas concluiu 10/10 tarefas. Isso exige atualização/validação de compatibilidade CDP antes de produção.

## Teste de coordenação nativa Rust

Código: [orchestrator.rs](coordination/orchestrator.rs). Compilado e executado no Windows com:

```powershell
rustc +stable-x86_64-pc-windows-gnu --edition 2021 --test .\coordination\orchestrator.rs -C linker=rust-lld -o .\coordination\orchestrator-tests.exe
.\coordination\orchestrator-tests.exe --nocapture
```

**Resultado: 6 testes aprovados**, envolvendo:
- paralelismo de ações independentes e dependências respeitadas;
- reserva do orçamento de chamadas de IA antes da concorrência;
- submissão bloqueada sem aprovação explícita;
- pausa que bloqueia tarefas;
- idempotência em execuções repetidas na memória;
- falha de ferramenta bloqueando tarefas dependentes.

São testes unitários de um protótipo **in-memory com fakes**. Não testam persistência transacional, recuperação após reinicialização, integração real com modelos ou envio a ATS.

## Ponte Go → executor Rust

A prova Windows usando `go run ./bridge` e `agent-browser.exe` não concluiu. Foi interrompida depois de ficar bloqueada, enquanto no runner Ubuntu havia concluído corretamente. Há suspeita de interação entre subprocessos/stdio no Windows; **a causa ainda não está confirmada**. Não classificar essa integração como aprovada no Windows.

## Decisão sugerida antes de reescrever

- **Rust é tecnicamente viável como coordenador**, sujeito a comparação de manutenção e integração real de provedores.
- **Go e TypeScript são alternativas sérias para automação**, com êxito nos testes Windows.
- A combinação Go+Rust **não está validada no Windows** e não deve ser obrigatória.
- Próximo gate: execução real do fluxo do agente com fake provider e modelo BYOK, estado durável, tratamento de reinicialização, Chrome dinâmico, autenticação supervisionada, isolamento e instalação Desktop.
- Nenhuma evidência desta rodada justifica ainda migrar a `main` ou declarar uma stack vencedora.
