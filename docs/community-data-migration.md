# Migração e recuperação de dados no Community

O Community implementa migração **opt-in** do navegador para o SQLite local. Após
a migração, o Studio, o Meu agente e o quadro de candidaturas passam a ler e salvar
nessa base. Instalações novas começam no SQLite. Os dados anteriores continuam
preservados no IndexedDB/localStorage como recuperação. Versões aprovadas por vaga
ainda exigem consolidação específica.

## Como utilizar

Abra **Meu Alinha > Currículo e dados > Ver dados antigos**. O Alinha inspeciona
o currículo estruturado no IndexedDB e a lista de oportunidades no localStorage,
valida os dados e consulta as revisões já presentes no SQLite. A tela apresenta
uma prévia da quantidade de registros para revisão.

Ao clicar em **Confirmar migração segura**, o backend:
1. Valida todos os registros antes de escrever qualquer um.
2. Cria um backup SQLite em diretório privado do usuário (subpasta `backups`).
3. Abre uma transação única para currículo e oportunidades.
4. Bloqueia conflitos de revisão ou dados já existentes que sejam diferentes.
5. Grava os itens, confirma a transação e lê novamente os valores e revisões.
6. Retorna o resultado. O navegador mantém a cópia anterior sem apagá-la.

O processo não altera o currículo original nem realiza candidaturas externas.

**Importante:** sem migração, um perfil já salvo no navegador permanece no
armazenamento antigo para não ser transferido sem consentimento. Após copiar,
o SQLite passa a ser a fonte principal do perfil e do Kanban. Excluir um currículo
gera um registro de exclusão no banco, evitando que o original antigo reapareça.

## Backup e restauração

- **Exportar backup SQLite:** baixa JSON com registros e revisões, sem chaves da IA.
- **Restaurar backup:** lê arquivo local, valida o formato, pede confirmação
  expressa e grava no SQLite com controle de revisão. Antes de sobrescrever,
  o backend gera um snapshot recuperável do banco anterior.
- Os backups automáticos SQLite ficam na pasta de dados do Alinha do usuário
  e não são enviados para nuvem.
- A restauração não apaga itens ausentes no arquivo; somente valores presentes
  são restaurados. Em conflitos de revisão o banco permanece inalterado.
- Arquivos de backup podem conter dados pessoais de currículo. Guarde-os com cuidado.

A migração ainda precisa de homologação com casos de corrupção, fechamento
inesperado, atualização e restauração em uma instalação limpa Windows/macOS/Linux.

## Versões de currículo aprovadas

As versões aprovadas para vagas passam a ser gravadas no SQLite do dispositivo,
sem alterar o currículo principal. Versões já existentes no IndexedDB continuam
consultáveis, sem exclusão automática. A prévia de migração em **Meu Alinha** inclui
a contagem de versões antigas válidas e permite copiá-las de forma transacional.
O backup JSON do SQLite inclui o campo `resume_versions`; versões mais antigas
do arquivo de backup (sem esse campo) permanecem restauráveis.

As gravações têm revisão otimista para evitar sobrescritas por outra aba. O
limite inicial é de 16 versões na lista local; o limite de bytes do registro
pode ser atingido antes para currículos extensos, sem descartar itens existentes.
