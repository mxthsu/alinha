# Migração e recuperação de dados no Community

Esta entrega implementa o procedimento **opt-in** de cópia do navegador para o
SQLite local. Os dados originais continuam no IndexedDB/localStorage até que toda
a jornada use o armazenamento unificado.

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

**Importante:** importar para SQLite **não muda ainda a fonte principal das
telas**. A etapa subsequente conectará o Studio, o agente e o Kanban ao banco
como armazenamento primário. Até lá, alterações feitas no navegador após
a cópia não são sincronizadas automaticamente ao SQLite.

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
