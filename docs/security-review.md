# Revisão de segurança do Alinha Community — outubro de 2026

> Uma auditoria automatizada e revisão manual de escopo limitado **não certificam ausência de vulnerabilidades**. A instalação Community é local; ainda não está pronta para hospedagem pública como serviço SaaS.

## Evidências desta revisão

- Inspeção de arquivos atualmente versionados em Git quanto a formatos conhecidos de segredos: **nenhuma chave real foi confirmada**. O arquivo .env.example inclui somente nomes e configurações de exemplo. Uma varredura adicional de padrões comuns em patches do histórico Git não encontrou correspondências, mas não substitui uma auditoria completa de histórico e credenciais locais.
- npm audit --omit=dev no lockfile web: **nenhuma vulnerabilidade conhecida reportada** em dependências de produção no momento da execução.
- pip-audit sobre dependências Python de produção exportadas de uv.lock: **nenhuma vulnerabilidade conhecida reportada** no momento da execução.
- Testes da API verificaram falhas fechadas em links externos falsos, URLs sem HTTPS, cabeçalhos Origin externos, respostas malformadas, redirecionamentos, limites de tamanho, orçamento de chamadas e permissões do agente.
- Revisão de deploy: ALINHA_DEPLOYMENT_MODE=cloud mantém inferência hospedada desabilitada até existirem autenticação, isolamento, quotas, medição e proteção a dados.

## Medidas para o novo conector de vagas

1. Sem SSRF por input de usuário: chamadas remotas apenas a uma URL de provedor pré-configurada; sem redirecionamentos.
2. Consulta limitada por tamanho, tempo, frequência e cache por processo.
3. Links de candidatura exibidos somente quando HTTPS e pertencentes ao domínio permitido.
4. Dados externos não definem permissões, segredos, consentimento nem ações do agente.
5. Endpoint disponível somente em instalação Community local, com validação de origem.
6. Nenhum envio automático, requisição a sites de candidatura ou compartilhamento de dados pessoais.

## Riscos que continuam pendentes

- Uma varredura de padrões e scanners de dependências não substitui pentest, análise de lógica, auditoria de todo o histórico Git, revisão independente nem validação de infraestrutura.
- O cache e o limite de solicitações são **em memória**, não funcionam como proteção distribuída para serviços publicados.
- Os endpoints atuais são desenhados para localhost e não devem ser publicados em túneis ou proxies abertos.
- Antes de lançar Pro/Cloud: autenticação forte, consentimento auditável e revogável, LGPD, isolamento por conta, proteção de segredos, idempotência e limites atômicos, pagamentos seguros, auditoria de conectores e revisão de segurança de infraestrutura.
- A segurança dos mecanismos de IA e das candidaturas não pode depender de segredo do código, e sim de validação de permissões no servidor.

**Orientação:** manter o Community público e independente e desenvolver serviços comerciais privados de maneira separada, sem versionar credenciais ou usar currículo pessoal em exemplos e testes. A licença MIT publicada não retira a necessidade de proteger infraestruturas e dados.

## Acompanhamento local de oportunidades

O quadro Kanban do Community só persiste cargo, empresa, link, status e datas
no localStorage quando o usuário salva uma vaga. URLs não HTTPS, internas,
contendo credenciais ou parâmetros de autenticação conhecidos são rejeitadas.
O aplicativo **não consulta URLs fornecidas manualmente**: apenas oferece um
link clicável e normalizado. Importações JSON são limitadas em tamanho e
verificadas contra o esquema do quadro; informações arbitrárias não alteram
a política do agente nem ativam a execução de candidaturas.

O armazenamento local não é criptografado e pode ser acessado por outras pessoas
com acesso ao perfil do navegador ou por scripts maliciosos da mesma origem.
Não salvar currículos, CPF, e-mails de candidatos ou segredos no quadro; recomendar
exportar backup e apagar os dados em computadores compartilhados. Para a versão
Pro, usar autenticação, controle de acesso, criptografia apropriada e isolamento
por usuário, com persistência consentida.

## Rascunho integrado do Community

O Studio salva automaticamente o perfil estruturado e o modelo em IndexedDB neste navegador, sem guardar o PDF/DOCX original ou enviá-lo à nuvem. Preparar candidatura lê esse perfil e utiliza a API local somente para gerar o texto usado no ATS; o envio a um provedor de IA continua sujeito a ação explícita.

IndexedDB não é criptografado pelo Alinha nem isola pessoas que compartilham o mesmo perfil do navegador. O usuário pode apagar o rascunho; backups JSON também não são criptografados. O contexto da vaga é transferido na mesma aba via sessionStorage sem credenciais. Para o futuro Cloud, são necessários autenticação, consentimento, isolamento por conta, retenção e auditoria.
