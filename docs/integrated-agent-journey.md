# Jornada integrada em /agente — revisão para a entrega

## O que funciona agora

A rota /agente é a experiência principal. A pessoa pode importar PDF/DOCX/TXT ou usar o currículo já salvo pelo Studio, definir um objetivo livre em português, autorizar a consulta de vagas, comparar oportunidades e criar uma prévia editável **sem envio externo** na mesma tela.

A interpretação determinística em apps/web/src/lib/agent-journey.ts extrai cargo, modalidade, cidade, elegibilidade Brasil e preferência salarial; requisitos não compreendidos ou indisponíveis são sinalizados. A comparação reutiliza os sinais literais de apps/web/src/lib/career-agent.ts. Não gera percentual ATS nem declara experiência não comprovada. O campo de salário só considera o valor mensal em BRL confirmado pelo conector. Salários ausentes e pisos abaixo da preferência exigem verificação: não são exclusões automáticas.

A busca chama a API local existente /api/v1/jobs/search com source=all e remote_only conforme a intenção. Os conectores realmente habilitados e permitidos definem a cobertura; links e descrições completos seguem no handoff. Consulta externa de vagas depende de checkbox específico. Currículo, nome e contatos **não são enviados para fontes de vagas**.

A vaga selecionada e sua descrição revisada são salvas pelo contrato já existente da PR #41 em career-handoff.ts. Após reiniciar a página, o usuário pode escolher **Retomar**. O resultado da busca, estado de tarefas não confirmadas e relatórios IA anteriores **não** são reexecutados/restaurados automaticamente. Uma prévia local é criada novamente com a evidência disponível; o progresso não afirma buscas feitas na sessão atual que não foram registradas.

A preparação avançada é a PreparationJourney da PR #41, expandível na mesma rota. Ela reutiliza o Studio, checagem ATS, ConnectedProviderPicker, adaptadores já disponíveis (Gemini, OpenAI API, Claude/Anthropic, Ollama e ChatGPT conforme configuração), proposta de currículo baseada em evidências e aprovação explícita de versão. A chamada ao provedor de IA é opcional e realizada apenas por uma ação específica da pessoa. Não há modelo conectado obrigatório para busca e rascunho. A solução usa as interfaces Python/Next existentes, sem escolher stack futura.

Os contratos e o executor fictício da PR #45 continuam na API para testes de política determinística, mas o componente separado de demonstração foi excluído da rota. O trabalho de integração acontece na única tela /agente.

## Como testar

### Testes locais
- API: entrar em apps/api e executar uv run pytest -q; uv run ruff check .
- Web: entrar em apps/web e executar npm ci, npm run test:local, npm run lint, npm run build.
- Teste de navegador: iniciar API na porta 8000 e Web na 3000 em 127.0.0.1, com APPDATA e LOCALAPPDATA apontando para diretórios descartáveis **se estiver no Windows**. No apps/web executar npm run test:browser. Requer Chrome instalado; a dependência de automação de navegador está apenas em devDependencies.

### Smoke real no Chrome com dados fictícios

O script tests/browser-career-smoke.mjs abre Chrome headless real, importa um currículo sintético via a API real, usa a persistência SQLite isolada, autoriza uma busca, intercepta **somente a resposta da consulta a vagas** com duas vagas artificiais, compara evidências, cria prévia, confirma que não apresenta Kubernetes como competência, pausa, recarrega, retoma a seleção da PR #41, abre a preparação avançada e seu seletor de provedores, mede overflow mobile em 390 px, verifica ausência de exceções JavaScript e ausência de POST de candidatura. Exercita também respostas simuladas de erro e cancelamento.

Capturas locais sintéticas: apps/web/.browser-smoke/desktop.png e mobile.png. Não versionar essas imagens no repositório por padrão. Capturas locais e testes de navegador **não** comprovam busca real, integração funcional com uma conta real de IA ou funcionamento de candidatura externa.

### Controle e segurança

- Importações antigas continuam com o formato do Studio; nenhum armazenamento redundante de currículo foi adicionado.
- Autorizar busca de vagas é diferente de autorizar chamada ao modelo; candidaturas reais não têm ferramenta de envio.
- Não seguir instruções recebidas do texto de anúncios. Propostas ATS dependem de evidência literal, revisão e aprovação.
- O navegador pode abortar uma busca pendente. Resultado desconhecido/erro de fonte não é apresentado como sucesso nem repetido automaticamente.
- Quando falha a persistência de uma seleção, um alerta é mostrado; não se afirma retomada concluída.
- Somente dados de testes e imagens sintéticas devem ir para CI, screenshots, logs e commits.

## Limites conhecidos

- A compreensão da intenção é determinística e conservadora: não interpreta todas as preferências livres nem controla independentemente cada critério no backend. Cidade, residência brasileira, benefício e salário incompleto podem exigir checagem manual.
- A busca depende dos conectores selecionados; algumas fontes não fornecem descrições completas, localização ou remuneração. Não inferir o que elas omitem.
- A persistência da PR #41 guarda somente seleção e descrição, não um histórico durável de todas as etapas/consultas; não há fila nem retomada automática de operações interrompidas.
- Integração de provedor real não foi exercitada com credenciais no smoke; somente o seletor e a integração existente são verificados. Não afirmar homologação de IA real.
- Desempenho e experiência Desktop/Cloud ainda precisam de validação própria.

## Destino das PRs

A PR de integração se baseia no código da #45, importa seletivamente os recursos de preparação/retomada da #41 e substitui o fluxo visual paralelo da #45. Após aprovação e merge **somente da PR integrada**, encerrar #41 e #45 como substituídas, sem merges independentes. #42 segue isolada como material experimental. Não fundir mudanças locais não commitadas sem revisão.
