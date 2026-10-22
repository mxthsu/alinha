# Plano de conclusão do Alinha Community

Este documento controla o escopo da edição local e open source. O Community deve ser útil sem assinatura, banco hospedado ou conta Cloud.

## Experiência essencial

- [x] Importar PDF/DOCX/TXT diretamente no agente, sem exigir preenchimento por abas.
- [x] Salvar rascunho do perfil no navegador, reutilizado entre Studio e preparação.
- [x] Sugerir cargos citados no currículo e buscar vagas mediante autorização.
- [x] Mostrar sinais literais da vaga sem inventar classificação ou percentual ATS.
- [x] Salvar e acompanhar oportunidades manualmente no navegador.
- [x] Verificar leitura ATS local e solicitar IA conectada para analisar requisitos.
- [x] Aprovar e baixar versões de currículo por vaga, gravando as novas aprovações no SQLite sem inventar experiências.
- [ ] Homologar em instalação limpa, migração de todas as versões antigas e recuperação de múltiplas versões.
- [x] Transferir descrições completas fornecidas por APIs de origem (Lever e demais quando disponíveis) diretamente para Preparar candidatura.
- [ ] Expandir cobertura de descrições integrais em todas as fontes e tratar páginas sem essa informação.
- [x] Apresentar a jornada principal em uma única tela com interrupção, revisão e retomada.

## Persistência, privacidade e instalação

- [x] Chaves de provedores de IA no cofre de credenciais do sistema operacional.
- [x] Base local em SQLite e configuração tipada JSONC fora do repositório — primeira camada de infraestrutura, ainda sem migração do frontend.
- [x] Primeira interface Meu Alinha para conexões de IA, permissões informativas e fonte Himalayas, sem editar JSONC manualmente.
- [ ] Conectar todas as futuras fontes e preferências reais à mesma configuração.
- [x] Criar interface opt-in para copiar rascunhos IndexedDB e oportunidades localStorage para SQLite, com prévia, validação, proteção a conflitos, snapshot e confirmação pós-gravação.
- [x] Utilizar SQLite como fonte principal do currículo (Studio, agente, preparação) e Kanban após migração, mantendo os dados legados intactos.
- [ ] Migrar versões aprovadas por vaga e demais dados auxiliares para persistência unificada.
- [ ] Aplicar a persistência SQLite em todas as telas, com autosave, versões por vaga e revisões concorrentes.
- [x] Adicionar exportação JSON e restauração revisada do SQLite, com snapshot antes da operação e testes sintéticos.
- [x] Criar verificação de fumaça isolada, repetível no CI e localmente, com importação fictícia, 2 versões por vaga, backup, exclusão e restauração, sem tocar nos dados do usuário.
- [ ] Testar recuperação de falha de disco, processo interrompido e restauração em instalação limpa.
- [ ] Revisar caminhos e permissões em Windows, macOS e Linux; instalador/launcher simplificado.
- [ ] Revisão de segurança de histórico Git, dependências e fluxo de dados; documentação de retenção.
- [ ] Validação ponta a ponta com arquivos sintéticos em desktop e celular; UAT com usuário.

## Fontes de vagas

- [x] Primeira fonte remota autorizada com atribuição e links de origem.
- [x] Integrar issues de comunidades brasileiras de desenvolvimento por API GitHub pública e catálogos fixos, além de APIs públicas de ATS já integradas.\n- [ ] Estudar feeds oficiais de ATS adicionais e dados JobPosting públicos de páginas com crawling permitido, mantendo atribuição, privacidade e deduplicação.
- [ ] Adicionar conectores compatíveis com Community e um eventual produto pago.
- [ ] Conservar URL, fonte, data de coleta e regras de confiança para evitar vagas inventadas.

**Fora do Community atual:** hospedagem Cloud, autenticação multiusuário, sincronização entre dispositivos, pagamentos, execução recorrente em servidor e candidaturas automáticas externas.

## Organização local

- Windows: %APPDATA%/Alinha/config.jsonc e %LOCALAPPDATA%/Alinha/data/community.sqlite3.
- macOS e Linux: diretórios convencionais do usuário via XDG na primeira implementação.
- JSONC: preferências tipadas, conectores e permissões; **sem credenciais ou dados de currículo**.
- SQLite: currículos, vagas, etapas e versões aprovadas, migrados gradualmente.
- Cofre de credenciais: chaves e tokens — **nunca em JSONC, banco ou repositório**.

A existência do schema/endpoint SQLite não significa que o navegador já tenha migrado: até a etapa de migração, os dados atuais permanecem no armazenamento do navegador.
