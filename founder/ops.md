# Operações — o que será necessário no Cloud

## Community agora

- Garantir instalação e atualização reproduzíveis, backup/recuperação, importação sem dados fictícios confundidos com reais.
- Manter segurança das chaves no cofre do sistema, compatibilidade e testes de regressão.
- Publicar limitações reais das APIs de vagas e mecanismos de IA.

## Cloud futuro: rotina mínima e responsabilidades

1. Monitorar saúde da API, filas e operações de IA; limites por usuário e limite global de gasto.
2. Rastrear reservas/consumo com idempotência; reconciliar custos e pagamentos.
3. Gerenciar acesso, exclusão/portabilidade de dados e incidentes com registros sem conteúdo de currículos.
4. Revisar fontes de vagas, termos de uso, rate limits e conectores; não burlar CAPTCHA/MFA.
5. Responder suporte e disputas financeiras com SLA mensurado quando existir.

## Registro inicial de riscos

| Risco | Impacto | Mitigação necessária |
| --- | --- | --- |
| Custos imprevisíveis de inferência | Margem negativa | Medição por operação, créditos, teto de orçamento |
| Falha de conector de vagas | Produto incompleto | Fonte e data visíveis, tratamento de erro, várias fontes autorizadas |
| Vazamento de currículo/chave | Privacidade e confiança | Isolamento, criptografia, mínima retenção, revisão de segurança |
| Candidatura sem consentimento | Dano ao usuário | Política determinística, revogação, auditoria, confirmação |
| Dificuldade de instalar Community | Adoção baixa | Instalação limpa em diferentes sistemas e testes observados |
| Dependência de um provedor | Preço e indisponibilidade | Adaptadores e fallback apenas com autorização |
| Pagamento duplicado | Perda financeira e suporte | Ledger transacional, webhooks assinados e idempotentes |

**Licenças/tributos/termos:** validar formalização de empresa, emissão de documentos fiscais, LGPD, contrato de processamento e termos de plataformas com profissionais competentes antes do lançamento. Sem fornecedores/cotações verificadas nesta etapa.
