# Compatibilidade de leitura ATS

O Alinha ajuda pessoas a preparar currículos que possam ser interpretados com menos erros por sistemas de recrutamento (ATS). O objetivo é **legibilidade e fidelidade**, não manipular algoritmos ou prometer aprovação automática.

## O que a primeira versão verifica

Abra **Verificar ATS** na navegação do site, sem precisar conectar Gemini ou outro provedor. Envie um PDF, DOCX ou TXT de até 3 MB, ou cole o texto do currículo. A API realiza verificações determinísticas sem chamadas de IA:

- Se o documento possui texto extraível, incluindo identificação de PDFs que não oferecem texto suficiente (frequentemente digitalizações).
- Presença de tabelas, caixas de texto e colunas em DOCX, que podem alterar a ordem de extração.
- Elementos gráficos em PDF/DOCX, sem afirmar que toda imagem compromete a candidatura.
- Texto de cabeçalho ou rodapé em DOCX, onde dados de contato podem ficar menos acessíveis.
- E-mail, telefone e títulos de seção usuais detectáveis no texto.
- Sequências de letras separadas artificialmente por espaços.

O relatório mostra **problema, explicação e como melhorar**, distinguindo alertas importantes, atenção e sugestões. Nenhum desses sinais é apresentado como algoritmo de triagem de uma plataforma específica.

### O que a checagem não faz

- Não acessa dados internos de Workday, Greenhouse, Lever, Gupy ou de outros ATS.
- Não fornece uma **nota de ATS universal** nem garante classificação, entrevista ou contratação.
- Não reescreve currículos automaticamente, não altera PDFs recebidos e não preenche formulários de candidatura.
- Não adiciona palavras-chave, experiências ou certificações sem comprovação.
- Não é um simulador do ranking configurado por cada empresa.
- A ausência de alertas só significa que **essas verificações básicas** não identificaram problemas; não garante leitura perfeita em outro sistema.
- Não verifica todos os problemas visuais possíveis em um PDF; a análise das estruturas complexas de PDF requer validação específica.

## Editor manual e exportação DOCX

Após executar o diagnóstico, clique em **Abrir editor de currículo** para:

1. Importar o texto extraído do arquivo (ou partir do texto colado), sem salvá-lo no servidor.
2. Comparar o texto original (somente leitura) com uma versão editável.
3. Fazer apenas mudanças que você aprovar, preservando informações verdadeiras.
4. Revalidar a versão editada com as regras ATS locais, sem consumir Gemini.
5. Exportar um **DOCX simples**, com fonte Arial, coluna única, texto selecionável e sem tabelas.

O backend transforma **somente o texto fornecido** em um DOCX. Testes automáticos verificam a leitura e a preservação das linhas após a exportação. O texto é mantido apenas durante a sessão da página no navegador, não em banco de dados nem em `localStorage`.

**Ainda não implementado:** sugestões de reescrita por IA com aprovação individual, versões persistentes, e exportação direta em PDF com texto selecionável. Esses itens ficam para a próxima fase.

## Fundamentação

A documentação oficial explica que leitores de currículos podem falhar em layouts complexos:

- [Greenhouse — causas de falha na extração de currículos](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse): tabelas, imagens, colunas, cabeçalhos e caixas de texto podem prejudicar a interpretação.
- [Workday — Resume Parsing](https://doc.workday.com/admin-guide/en-us/human-capital-management/recruiting/candidates/set-up-prospects-and-candidates/hdc1552497830785.html): resultados dependem do formato e da ordem das palavras; imagens podem dificultar.
- [Workday — Applicant Tracking System](https://www.workday.com/en-us/topics/hr/applicant-tracking-system.html): recomendações de títulos simples de seção, fontes convencionais e uso limitado de gráficos.

Essas fontes fundamentam **recomendações gerais**. Não comprovam compatibilidade perfeita com produtos ou versões específicas, pois clientes podem configurar seus processos.

## Privacidade

O diagnóstico funciona sem Gemini, Claude ou ChatGPT. A edição Community extrai o arquivo em memória para análise e não o salva em disco. O relatório expõe apenas alertas e número de caracteres legíveis, não reproduz o conteúdo enviado. Não envie currículos de terceiros sem autorização.

No modo Cloud futuro, armazenamento, consentimento, autenticação e limites de uso deverão ser projetados antes de disponibilizar essa funcionalidade.
