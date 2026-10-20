# Descoberta multifuente de vagas — Alinha Community

As fontes atuais são **GitHub Vagas** (comunidades brasileiras), **Himalayas** (vagas remotas elegíveis a brasileiros), **Lever**
(catálogo inicial de empresas com vagas brasileiras) e **Gupy** (experimental).
A fonte Gupy foi desativada por padrão porque o endpoint comunitário atualmente
responde HTTP 404, verificado em 17/10/2026. A API oficial Gupy documentada em
https://developers.gupy.io/reference/findjobs é autenticada e diferente.

## Funcionamento

- **Meu agente** consulta as fontes locais habilitadas automaticamente, sem exigir
  que o usuário configure cada busca individualmente.
- **Encontrar vagas** permite pesquisar em Todas, GitHub (comunidades brasileiras), Himalayas, Lever ou Gupy.
- **Meu Alinha** permite desativar qualquer fonte; essa escolha não altera vagas já salvas.
- Cada fonte é consultada isoladamente. Uma indisponibilidade individual não elimina
  os resultados das demais; falhas aparecem explicitamente nas limitações.
- Deduplicação por URL canônica normalizada; vagas com URLs diferentes não são descartadas
  apenas por terem cargo e empresa iguais.
- CLT/PJ, modalidades e salários só são confirmados quando a fonte os informa.
- Em **Encontrar vagas**, filtros permanecem temporários por padrão. Apenas após clicar
  em **Salvar preferências neste computador** modalidade, contrato, fonte, cidade e
  salário pretendido são gravados no arquivo local JSONC. O termo pesquisado não é
  salvo. O botão **Apagar preferências salvas** remove apenas esses filtros,
  preservando provedores de IA, conectores e vagas.
- Não há envio automático de candidaturas.

## Fontes e abrangência

- GitHub Vagas: https://github.com/backend-br/vagas e https://github.com/frontendbr/vagas — issues abertas de comunidades brasileiras de desenvolvimento; a data de encerramento nem sempre reflete o fim real do processo seletivo. A consulta usa a API pública de issues do GitHub com limites e cache, sem login nem scraping.\n- Himalayas: https://himalayas.app/docs/remote-jobs-api — remoto elegível para Brasil,
  crédito visível e links originais.
- Lever: https://github.com/lever/postings-api — API pública por empresa. O primeiro
  board cadastrado é `Flex`, com vagas publicadas para Remote / Brazil; testado
  com resposta HTTP 200 e vagas brasileiras em 17/10/2026. A cobertura ainda é pequena.
- Gupy: endpoint comunitário descoberto via projeto Candidatador; atualmente indisponível.
  Não é a API oficial autenticada.

O Alinha preserva URLs originais para abrir a candidatura no site da fonte,
filtra URLs inseguras e mantém chamadas externas no backend local. Limites de
tamanho, timeout e isolamento entre conectores fazem parte do pipeline.

## Pendências

- Consolidar persistência local de preferências de busca e histórico de pesquisas, mantendo as vagas salvas no SQLite.
- Expandir catálogo de empresas Lever, Greenhouse e Ashby e validar dados brasileiros.
- Expandir descrições completas entre as fontes que ainda fornecem apenas resumos.
- Melhorar cobertura de vagas brasileiras híbridas/presenciais, evitando fontes inexistentes.
- Homologar ponta a ponta no navegador e em instalação limpa.

## Descrição integral na preparação da candidatura

Quando a API de origem fornece descrição integral (por exemplo `descriptionPlain`
na Lever), o backend a conserva em campo separado do resumo. Ao abrir
**Preparar candidatura** a partir de uma vaga, essa descrição é transferida
para o formulário de análise sem ser interpretada como instrução do agente.
O usuário pode conferir e corrigir antes de prosseguir.

Se a fonte fornecer apenas resumo, o Alinha não o apresenta como descrição
integral: solicita a leitura/colagem do anúncio original. Nenhuma análise
conclusiva de aderência deve depender só do resumo.
