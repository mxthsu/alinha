# Tauri/Rust — prova isolada de Desktop para o Alinha

**Status: código experimental, ainda não é um aplicativo instalável.**
Esta branch é **empilhada sobre a PR #47 (Go/Wails)** apenas porque a #47 contém
a exportação estática Next.js e o entrypoint seguro do Python, ainda ausentes na `main`.
Não escolher Tauri ou Wails por gosto; testar ambos com a mesma interface, API e
fluxos fictícios. Não fazer merge independente da base sem rebase/revisão.

## O que foi implementado

- **React/Next.js exportado** da mesma UI do Alinha, sem fork visual; `scripts/prepare-web.ps1`.
- **Tauri v2 / Rust** renderizando essa exportação pela WebView nativa (código do shell
  em `src-tauri/`), com comandos restritos, sem acesso de shell nem acesso irrestrito
  ao filesystem a partir do JavaScript.
- **Preferências do aplicativo (Rust)**: aparência `system/light/dark`, versão de
  esquema e armazenamento em `app_local_data_dir`; nenhuma chave de IA ou currículo
  nos arquivos de preferências. A gravação usa temporário + sincronização, mas
  **a substituição não é crash-atomic no Windows** neste protótipo.
- **Arquivos (Rust)**: caixa de diálogo nativa explícita, extensões
  `PDF/DOCX/TXT`, limites de 1 byte a 8 MiB, rejeita diretórios/symlinks e
  retorna à UI apenas nome, formato e tamanho — **nunca caminho ou conteúdo do CV**.
  Ainda não integra a importação de currículo real por IPC; as checagens de tipo
  MIME/conteúdo continuam responsabilidade do Python.
- **Python supervisionado (Rust)**: em modo de desenvolvimento e **somente**
  quando `ALINHA_DESKTOP_PYTHON` apontar para executável existente, gera token
  aleatório de 256 bits, inicia `alinha_api.desktop_entry` em loopback com porta
  efêmera, aguarda readiness, autentica `/health`, monitora e mata o processo
  filho quando a janela for destruída. O token fica no host Rust, nunca no JS.
  Os dados reais do usuário não fazem parte dos testes.

## O que **não** funciona ainda

- **Não há pacote Python embutido no instalador** (PyInstaller/sidecar e ciclo de
  atualização ainda precisam ser implementados). Instalar Python/venv é requerido
  para a prova de integração no PC de desenvolvimento.
- **A ponte autenticada via IPC foi codificada, mas ainda não homologada numa janela
  Tauri em execução.** A UI compartilha o transporte `apiFetch` (fetch no
  navegador, invoke com allowlist Rust no Tauri); o Rust injeta o token ao
  encaminhar apenas rotas locais previstas, com limite de bytes, timeout,
  redirects e proxies desativados. Não entrega o segredo ao JavaScript.
  A exportação estática e testes de interface passaram, mas **não afirmar a
  jornada Desktop completa** sem smoke real na janela com Python supervisionado.
  OAuth ChatGPT no navegador externo/callback permanece fora desta prova.
- Compilação Tauri no Windows exige Visual Studio C++ Build Tools/MSVC + Windows
  SDK e WebView2. O PC atual tem Rust portátil para testes de núcleo, mas não
  tinha linker/SDK MSVC no momento desta prova. **Não tratar fonte Tauri criada
  como app compilado** sem build real.
- Não foram testados instalador, atualização, macOS/Linux, assinatura, proteção
  transacional do estado completo do agente ou recuperação da API após crash.
  Estado dos checkpoints do agente pertence ao Python; Rust só cuida de ciclo
  de vida e preferências locais do aplicativo.

## Reproduzir

```powershell
# A partir da raiz do repositório:
cd apps/desktop/tauri-probe
.\scripts\prepare-web.ps1
# Testar Rust host-core; precisa de toolchain compilável + cargo.
.\scripts\test-host-core.ps1
# Para tentar compilar o shell, instalar os pré-requisitos Tauri MSVC/WebView2:
cd src-tauri
cargo build
```

Para provar Python em loopback com token, crie a venv em `apps/api`,
instale o pacote (`python -m pip install -e .`) e configure
`ALINHA_TEST_PYTHON` no ambiente de testes Rust. Somente uma chave sintética
é gerada; não usar chaves de IA pessoais em testes.

## Critérios para uma comparação posterior com #47

Mesma UI e backend, mesmas URLs e arquivos fictícios; confirmar inicialização,
respawn depois de crash, assinatura dos requests, ausência do token no JS,
hot/cold start, p50/p95, RSS de **toda a árvore de processos**, abertura de
arquivo, rotas estáticas, instalação limpa e fechamento de subprocessos.

**Não alterar a stack Python/FastAPI do Alinha por esta POC.** Rust para
Desktop não implica usar Rust para prompts/ATS, e Python não deve guardar
segredos do shell fora do seu escopo.
