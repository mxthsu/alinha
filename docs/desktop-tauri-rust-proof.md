# Alinha Desktop — prova Tauri/Rust + Python (23/10/2026)

> **Status: protótipo isolado, não instalador publicável; transporte IPC codificado, ainda sem homologação na janela Tauri.** PR experimental empilhada sobre [#47](https://github.com/mxthsu/alinha/pull/47), para reutilizar a mesma exportação Next.js e o entrypoint Python de porta efêmera já usados pela prova Go/Wails.

## Decisão de responsabilidades, sem reescrita

- **React/TypeScript:** interface atual (exportação estática Next 16), progresso, revisão.
- **Python/FastAPI:** interpretação de CV, ATS, conectores de vagas, provedor de IA, checkpoints do agente quando existirem; não foram migrados para Rust.
- **Rust/Tauri v2:** janela Desktop, preferências locais limitadas, seletor nativo de arquivo e ciclo de vida do processo Python, com segredo de sessão conhecido só pelo host.
- **Rust não é o coordenador de negócios neste incremento.** O estado do aplicativo e o do agente têm donos separados.
- **Cloud:** nenhuma alteração.

## Artefatos

- `apps/desktop/tauri-probe/host-core`: crate Rust pequena, compilável/testável independentemente do Tauri, com 3 testes de unidade e 1 de integração real com Python.
- `apps/desktop/tauri-probe/src-tauri`: shell Tauri v2 com `frontendDist` apontando para a mesma exportação Next, comandos de status, preferências e seletor nativo sem caminhos arbitrários fornecidos pelo JS.
- `apps/desktop/tauri-probe/scripts`: exportação Web e teste independente do host.
- Nenhum segredo, CV, cookie ou chave de provedor em artefatos versionados.

## Testado no PC Windows conectado

| Item | Resultado |
| --- | --- |
| Next.js 16 exportação estática | **Aprovada**, 14 rotas/prerender, sem servidor Next |
| Python/FastAPI suite da branch-base | **219/219 testes**, com dados sintéticos |
| React/TypeScript suíte e lint | **64/64 testes** e ESLint aprovado |
| Rust host-core testado com toolchain Windows gnullvm portátil | **3/3 unitários** |
| Rust inicia Python `desktop_entry`, aguarda readiness, autentica `/health`, encerra o processo filho | **1/1 integração real** |
| Binário Windows Tauri compilado / janela aberta | **Binário gerado na CI Windows/MSVC**; janela em execução e smoke integrados ainda não validados |
| Instalador Windows assinado | **Não implementado** |
| UI React conectada à API por IPC autenticado | **Código implementado**, com testes JS/fallback; comportamento na WebView real ainda não homologado |

**Importante:** os testes do Rust rodam via toolchain isolada `stable-x86_64-pc-windows-gnullvm` + `rust-lld`; isto não substitui os pré-requisitos oficiais MSVC/WebView2 para compilar o aplicativo Tauri Windows. Consulte a [documentação oficial de pré-requisitos](https://v2.tauri.app/start/prerequisites/).

A prova Go/Wails da PR #47 chegou a abrir uma janela nativa e medir memória do processo principal; esta POC Rust ainda não alcançou esse mesmo marco. **Não declarar Tauri superior.** Compare em igualdade depois de uma build real com a mesma Web e Python.

## Fronteiras de segurança

- Token de 256 bits gerado pelo Rust, passado **somente ao ambiente do Python filho**. Não é retornado ao JS ou gravado em arquivos de preferências/logs.
- Python só abre loopback e porta efêmera, exige o token em cada request; Rust valida readiness e `/health`. O token no ambiente do processo não protege contra malware já executado com privilégios equivalentes no sistema.
- WebView não tem capacidades de shell nem filesystem irrestrito. O seletor nativo explícito oferece somente **metadados limitados** (extensão/bytes/nome); o upload existente via interface web usa arquivos escolhidos pela pessoa e o transporte IPC. Tipos, tamanho, symlink e permissões continuam validados pelos componentes respectivos.
- Preferências do Desktop ficam em `app_local_data_dir` e aceitam apenas `system/light/dark`. A gravação temporária com sincronização **ainda não garante substituição crash-atomic no Windows**. Não persistir estado crítico de candidatura nesse arquivo.
- CSP restringe rede e scripts externos. Foi codificado um gateway **IPC Rust → Python** com URL exclusivamente loopback, allowlist de método/rota, limite de corpo/resposta, timeout, sem redirects/proxies e com o token somente no host. A UI agora usa `apiFetch` para preservar o modo Web normal. **Ainda não houve smoke na janela Tauri** da jornada completa. O cancelamento da UI não interrompe a requisição Rust já encaminhada; ela permanece limitada a 35 s e sem submissão externa. OAuth ChatGPT por callback externo ainda não está adaptado.
- O aplicativo ainda **não distribui a API Python**. Usar `ALINHA_DESKTOP_PYTHON` apontando para uma venv é **somente desenvolvimento local**, não empacotamento final.

## Próximos gates

1. Compilar/abrir a janela Tauri no Windows com MSVC e WebView2 (ou runner CI Windows), registrar falhas/tempo de abertura.
2. Homologar a ponte `invoke` Rust → Python já codificada: abrir Tauri de fato e testar CV fictício, permissões, busca, exportação, falhas de API, cancelamento e layout. Endurecer concorrência/cancelamento antes da release, **sem token no JavaScript**.
3. Empacotar Python sidecar (por exemplo PyInstaller) com binário por plataforma, atualizar o supervisor para localizar o artefato empacotado, validar fechamento e atualização segura.
4. Validar reinstalação e preservação de SQLite, backups, assinaturas e distribuição Windows/macOS/Linux.
5. Comparar com Wails v2 na mesma fixture, p50/p95, RAM total inclusive WebView/Python, segurança, tamanho e custo de manutenção. Decidir um só shell.

A lógica Python do agente permanece intacta, assim como PRs #50/#51 e a `main`.
