# Currículo Studio

O **Currículo Studio** (rota `/studio`) é o início do criador de currículos estruturados do Alinha Community. Ele segue a identidade do Alinha, com formulário por seções, visualização contínua em A4 e dois modelos de documento.

![Prévia do Alinha Studio com currículo demonstrativo fictício](assets/studio-preview.png)

## Importação assistida de PDF/DOCX/TXT

Use **Importar currículo**, na barra de ações do Studio. O PDF, DOCX ou TXT é interpretado e os campos são **preenchidos diretamente no editor**. Não há uma tela separada de confirmação, formulário de prévia nem botão de exemplo fictício. O usuário pode editar qualquer informação, navegar pelas seções e usar **Desfazer importação** para recuperar o rascunho anterior antes de começar a alterá-lo.

Se algum trecho não for reconhecido, fica disponível somente na seção expansível **Trechos do arquivo que precisam de revisão** dentro de **Informações**. Não usamos IA nesse processo nem armazenamos o arquivo. Uma nova importação substitui o conteúdo editado, com opção imediata de desfazer. O rascunho é salvo automaticamente neste dispositivo; JSON é apenas um backup opcional.

O importador reconhece cabeçalhos em português e inglês, experiências com datas em linhas separadas, formatos empilhados (empresa antes ou depois do cargo), atividades quebradas por linha, competências agrupadas e projetos com tópicos. DOCX com tabelas mantém a ordem dos blocos e TXT aceita UTF-8 e Windows-1252. PDFs digitalizados sem texto e layouts multicoluna difíceis continuam exigindo intervenção manual. O sistema usa somente informações literais e não deduz qualificações ausentes.

O Studio compartilha o currículo salvo no navegador com [Preparar candidatura](application-workflow.md), que reúne a verificação ATS e a comparação com vagas.

## Funcionalidades desta versão

- Informações pessoais, resumo profissional, experiências, formação, projetos, competências e idiomas.
- Prévia em tempo real no navegador, com modelos **Clássico** e **Compacto**.
- Exportação DOCX com texto selecionável, estrutura de uma coluna e sem tabelas.
- Importação/exportação de perfil em JSON de formato aberto (`schema_version: 1`). Não há conta ou sincronização nesta versão.

**Salvamento automático:** o perfil estruturado e o modelo são armazenados no IndexedDB do navegador após alterações. Ao reabrir o Studio no mesmo dispositivo e perfil de navegador, o currículo é recuperado automaticamente. O botão de backup JSON continua disponível no menu Opções, junto da função de apagar o rascunho.

**Privacidade:** o IndexedDB não é criptografado pelo Alinha. Pessoas que compartilham o mesmo perfil do navegador podem acessar os dados; em computadores compartilhados, apague o rascunho. Arquivos de backup JSON também não são criptografados. O PDF/DOCX original não é armazenado no rascunho.

## Sugestões de melhoria ligadas à vaga

O Studio não possui área de **Melhorias com IA**, seletor de provedor ou descrição de vaga. Ele é um editor de currículo com preenchimento manual, importação de arquivos, prévia e exportação. Para receber orientações, a pessoa deve acessar **Preparar candidatura**, verificar a leitura do currículo e informar a vaga. As recomendações aparecem apenas após uma comparação solicitada pelo usuário e são baseadas nos requisitos daquela vaga e em evidências do currículo. Nenhuma recomendação altera os campos do Studio automaticamente.

## Arquitetura

| Camada | Arquivo | Responsabilidade |
| --- | --- | --- |
| Esquema de domínio | `apps/api/src/alinha_api/resume_schema.py` | `ResumeProfile` e contrato JSON v1 |
| Renderização e DOCX | `apps/api/src/alinha_api/services/structured_resume.py` | Texto determinístico + arquivo DOCX |
| Interface | `apps/web/src/app/studio` | Edição por seções, templates e prévia |
| Avaliações iniciais | `apps/api/tests/test_resume_studio.py` | Preservação de conteúdo e citações |

## Evoluções planejadas

- Reutilização do perfil estruturado do Studio na preparação de candidatura, sem exigir novo upload.
- Exportação em PDF textual, com validação de extração posterior.
- Mais modelos com prévia fiel, acessibilidade e testes visuais em tamanhos de tela distintos.
- Avaliações padronizadas com dataset totalmente sintético para medir erros de interpretação e de reescrita.

## Sobre compatibilidade ATS

Modelos limpos e texto selecionável reduzem riscos comuns de extração, mas nenhum deles garante pontuação, classificação ou aprovação em sistemas ATS. Veja [diagnóstico de legibilidade](ats.md).

## Título profissional identificado no currículo

Quando o documento contém explicitamente um cargo no início do resumo (por exemplo,
"Desenvolvedor(a) de backend com experiência..."), o importador pode preencher
**Título profissional** com o trecho literal do cargo. Isso permite ao agente
sugerir uma busca logo após o upload sem exigir digitação repetitiva.

O Alinha não infere uma profissão apenas por uma habilidade, linguagem ou projeto.
Quando o cargo não está explícito, o usuário o informa ou revisa manualmente.
O resumo completo é preservado para edição no Studio, e nenhuma candidatura é enviada
sem ação do usuário.

## Importação e navegação no celular

Ao importar um documento novo enquanto há um currículo preenchido, o Studio
solicita confirmação antes da substituição. A opção de desfazer a importação
funciona enquanto a mesma tela permanecer aberta; para preservar uma cópia
entre sessões, exporte antes o JSON do perfil.

As seis seções podem ser acessadas pela faixa horizontal no celular ou pelos
botões anterior/próxima. Ao selecionar uma seção, a faixa mantém seu título
visível; a movimentação respeita a preferência de animação reduzida.
A opção de apagar o currículo fica dentro de **Opções** e exige confirmação.
