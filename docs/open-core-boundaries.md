# Fronteira open-core: Community e Pro

> Decisão arquitetural. O código Community publicado hoje está sob MIT. Licenças anteriores não são revogadas; versões futuras e contribuições precisam de análise jurídica antes de qualquer alteração. Não existe checkout, assinatura Pro ou serviço de candidatura automática lançado.

## Regra principal

**Domínio e contratos ficam abertos; operações gerenciadas e integrações comerciais poderão ficar privadas.** O Community deve ser útil sem conexão com serviços proprietários: currículos, ATS, comparação com vaga, provedores próprios, critérios e fluxos assistidos. Não criar um projeto público que seja apenas frontend de uma API paga.

| Área | Community público | Pro futuro |
| --- | --- | --- |
| Perfil e currículos | Studio, importação, exportação, dados portáveis | Sincronização segura, versões e backup |
| IA | Adaptação/avaliação com provedor próprio e evidências | Inferência gerenciada com limites e créditos |
| Vagas | Esquema normalizado, filtros e fontes permitidas | Busca recorrente, integrações comerciais |
| Políticas | Contratos de preferências, autorização e testes | Identidade autenticada e enforcement transacional |
| Candidaturas | Planejamento e fluxos assistidos autorizados | Execução recorrente, filas, auditoria e alertas |
| Pagamento | Nunca obrigatório para Community | Billing, recibos, controles de custo e suporte |

## Arquitetura alvo

    Next.js (mesma identidade Alinha, pt-BR)
        |
    FastAPI (contratos versionados)
        +-- agent/models.py  : oportunidade, critérios, consentimento
        +-- agent/policy.py  : avaliação determinística sem efeitos colaterais
        +-- workflows/*     : extração, IA e evidências existentes
        +-- adapters/*      : fontes de vagas permitidas (futuro)
        +-- community       : planejamento e candidatura assistida (futuro)
        |
        +-- Pro privado futuro: auth multiusuário, scheduler, filas,
            conectores comerciais, ledger e billing, notificações

O Pro deve reutilizar os contratos e regras abertas. Isso não significa que o Community envia automaticamente para sites. A disponibilidade do envio depende de um conector legítimo, credenciais autorizadas e verificações em tempo real.

## Limites de segurança

- A decisão "authorized_for_dispatch" é **apenas planejamento**, não envio. A política atual é em memória e não contabiliza limites concorrentes.
- Para operações reais, exigir autenticação, logs de consentimento, revogação, fonte permitida, limites transacionais, idempotência conta+fonte+vaga, confirmação externa e histórico de falhas.
- O motor de IA e dados extraídos não decidem quais plataformas têm permissão de execução; só um registro confiável de conectores.
- Não enviar currículos para logs, não salvar segredos no navegador, não reutilizar credenciais pessoais entre contas.
- Nunca criar cobrança ou fingir que um serviço já foi disponibilizado. Não usar o plano ChatGPT de um operador para atender clientes Pro.

## Antes de criar serviços privados

Primeiro provar um fluxo real de descoberta e candidatura assistida, medir custos, validar políticas das fontes, detalhar privacidade/LGPD e validar o modelo comercial com usuários. O repositório privado de serviços Pro será criado em etapa própria; não precisamos dele para desenvolver o núcleo.

Referências internas: career-product-vision.md, agent-application-contract.md e cloud-business-model.md.
