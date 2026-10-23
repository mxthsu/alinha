# Alinha Desktop: prova comparativa de arquitetura (22/10/2026)

**Estado: decisão ainda aberta; nenhum instalador pronto.** Esta é uma prova
isolada de distribuição nativa, não uma migração da API nem uma aprovação de
Tauri ou Wails. Base: a jornada da branch `feat/integrated-career-agent`.

## Resultado reproduzível (Windows)

- A Web Next.js 16 exportou todas as rotas usando `ALINHA_DESKTOP_EXPORT=1
  npm run build`. A saída `apps/web/out` somou **1.532.681 bytes** em um build
  de prova; isso **não é** a memória ocupada pelo aplicativo, nem inclui a API.
  O Next.js **não** foi necessário para servir essa saída.
- A jornada integrada passou no Chrome real com a exportação estática, um
  servidor Python **apenas de teste**, API FastAPI local e vagas fictícias
  interceptadas. Testou importar CV, comparar, gerar prévia, retomar após reload,
  simular falha e cancelamento, seletor avançado e layout mobile, sem envio.
  Não valida conectores reais nem a segurança de um app instalável.
- O Wails v2 estável compilou com Go 1.27.3 portátil, em ferramenta isolada
  e sem instalação global, no Windows. O executável de prova com recursos da
  Web incorporados ficou em **13.325.824 bytes**.
- O aplicativo Wails foi iniciado no Windows e exibiu janela nativa com título
  do Alinha, `MainWindowHandle` válido e conteúdo WebView. A memória do
  **processo principal** foi **27,57 MiB** em uma coleta após 5s. Não inclui
  subprocessos do WebView2, API, SQLite ou inicialização/cold start medidos.
  Não é benchmark comparativo de linguagens.

Repetir a prova:

```powershell
cd apps/web
npm ci
$env:ALINHA_DESKTOP_EXPORT = '1'
npm run build
Remove-Item Env:ALINHA_DESKTOP_EXPORT
# para validar a jornada no Chrome, iniciar API 127.0.0.1:8000 e
# servidor de prova com --dist apps/web/out --port 3000.
npm run test:browser
```

Para a janela Wails, instalar Go 1.25+ **no ambiente de desenvolvimento** e
executar `apps/desktop/wails-probe/build.ps1`. O build usa tags oficiais
`desktop,production`, sem distribuir os arquivos gerados no Git. **Não ligar
uma API pessoal real ao app experimental sem completar a segurança abaixo.**

## Opções avaliadas

| Camada | Opção A | Opção B | Evidência desta prova |
|---|---|---|---|
| Interface | React/Next exportado | React/Vite SPA | Next exportado funciona; reescrita para Vite não justificada |
| Shell Desktop | **Wails v2 + Go** (estável) | **Tauri v2 + Rust** | Wails abriu janela nativa; Tauri ainda não foi compilado neste Windows |
| Agente / coordenação | Go (quando houver ganho) | Python com estado explícito (atual) | Nem Go nem Rust foram integrados ao runtime real de agente |
| IA, currículo, vagas | Python/FastAPI | Reescrever serviços | Python já tem fluxos e testes: preservar por ora |
| Persistência | SQLite local | Outros bancos | Preservar; testar caminho e migração num instalador limpo |

**Wails v3 ainda é beta**, portanto não tratá-lo como substituto automático
do Wails v2 estável: https://github.com/wailsapp/wails .
Tauri documenta exportação estática e sidecars Python:
https://v2.tauri.app/start/frontend/nextjs/ e
https://v2.tauri.app/develop/sidecar/ .
Go não é descartado em favor de Rust e **não** precisamos dos dois runtimes
nativos no produto sem evidência.

## Decisão funcional provisória: Rust para execução apenas se melhorar a jornada

A divisão de responsabilidades e critérios de velocidade estão em
[architecture-performance-plan.md](architecture-performance-plan.md). **O
núcleo Python (IA, currículos, documentos e fontes de vagas) não será
reescrito em Go.** Rust/Tokio é candidato para um coordenador que cuide da
concorrência, supervisão, cancelamento, estado e desempenho do agente. Go,
na prova atual, existe somente no shell Wails; isso não o transforma no
backend de IA. A definição de shell e coordenador são decisões **separadas**.

Foi criado o entrypoint Python `alinha_api.desktop_entry`, independente de
Tauri/Wails. Ele exige um segredo aleatório de sessão, abre uma porta efêmera
somente em loopback e anuncia readiness após inicialização. O middleware
FastAPI aplica o segredo quando presente, sem alterar o Community tradicional.
Existem testes com TestClient e subprocesso real de dados fictícios. Esse
ponto é uma infraestrutura de teste, **não** comunicação final com o WebView:
a ponte do shell que guarda o token fora do JS permanece pendente.

## Bloqueadores antes de escolher a arquitetura final

1. **Sidecar/privacidade:** FastAPI/Python ainda não é executável distribuível;
   não há supervisão do processo filho, atualização coordenada, instalação
   limpa ou recuperação após falhas. O shell Go só mostra a interface.
2. **API local segura:** origem `wails://` ou `http://wails.localhost` não é
   automaticamente uma origem permitida pela API; a origem exata deve ser
   verificada no WebView real. A porta efêmera e o token agora existem no
   entrypoint Python experimental; ainda falta criar a ponte autenticada
   entre shell/WebView e API, com origem e host estritos, sem expor segredo
   ao JavaScript ou afrouxar a proteção Community.
3. **Rotas estáticas:** Next export usa `/agente.html` e links `/agente`.
   O handler da prova Wails resolve a rota sem iniciar Next; testar todos
   os deep links, arquivos `.txt` do App Router, refresh e navegação após
   empacotar. Não assumir que janela aberta significa jornada operacional.
4. **Comparação justa:** testar Tauri/Rust com a **mesma** exportação,
   backend e cenário. Medir memória da árvore de processos, cold start,
   arquivos distribuídos, build, atualização, falha do sidecar e custo de
   manutenção, não apenas tamanho do shell Go.
5. **Distribuição:** validar Windows em VM/usuário novo e então macOS/Linux;
   checar WebView2, permissões, antivirus, assinatura, backups SQLite e
   desinstalação sem perda inadvertida de currículo.

**Próxima decisão técnica:** concluir lado Python/IPC e smoke completo de
Wails v2, depois executar prova equivalente em Tauri v2. Escolher **um único
shell nativo** e registrar ADR. Continuar o Community enquanto isso sem
migrar suas rotas ou alterar credenciais reais.
