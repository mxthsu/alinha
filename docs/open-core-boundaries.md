# Limites do código aberto — Community, Desktop e Cloud

> **Situação (22/10/2026):** o repositório público é MIT. Desktop e Cloud ainda não foram lançados. A escolha da arquitetura continua aberta — ver [CONTINUAR-ALINHA.md](CONTINUAR-ALINHA.md) e [architecture-evaluation.md](architecture-evaluation.md).

## Regra principal

**O núcleo do agente e os contratos de ferramentas são compartilhados e devem permanecer úteis sem serviços comerciais.** Não criar uma Community deliberadamente quebrada para vender Cloud. O Desktop pode também distribuir o mesmo núcleo sob licença open source; sua distinção principal é a **instalação/experiência**, e não uma proibição de acesso ao código.

| Área | Community Open Source (dev) | Desktop (usuário final) | Cloud (serviço futuro) |
|---|---|---|---|
| Agente | Código, contratos, permissões e testes | Mesmo agente em janela instalada | Mesmo agente com infraestrutura remota |
| Currículo e ATS | Importação, edição, análise com evidências e exportação | Experiência integrada simplificada | Serviço gerenciado e sincronização opcional |
| Inteligência | Modelos locais/BYOK, integrações elegíveis | Configuração visual de IA própria | IA gerenciada com orçamento e quotas |
| Vagas | Fontes permitidas, revisão e preparação | Mesmo fluxo, sem detalhes técnicos expostos | Execução remota e fontes licenciadas, se disponíveis |
| Candidaturas | Planejamento, prévia e revisão; envio futuro depende de autorização | Mesmo contrato de autorização | Idempotência, autenticação, auditoria, quotas, isolamento |
| Operação | Configuração própria/possível self-hosting | Instalador, atualização e suporte do app | Hospedagem, backups, cobrança e suporte |
| Pagamento | Nenhuma licença para usar o código MIT | Modelo de distribuição ainda a definir | Forma de cobrança ainda a validar |

## Fronteiras e código

Não inventar serviços “Pro” em produção. Recursos gerenciados de Cloud (infra, autenticação de múltiplas contas, faturamento, isolamento de sessões e jobs remotos) podem ter implementação separada, sem exigir que o domínio principal dependa de uma conta Alinha. O modelo de licença de qualquer componente Desktop precisa ser avaliado antes de alterar ou incorporar código de terceiros. Licenças anteriores não são revogadas retroativamente.

## Segurança de candidaturas

- `authorized_for_dispatch` no código atual **é só decisão de política**, nunca confirmação de submissão real.
- Para um conector futuro, validar autorização temporal, escopo por plataforma/vaga/currículo, perguntas confirmadas, idempotência, limite de envios, confirmação de recebimento e recuperação de resultado desconhecido.
- O modelo de IA, conteúdo de vaga ou página externa **não pode** conceder permissão de uso de ferramentas.
- Não contornar autenticação, MFA, CAPTCHA ou restrições contratuais. O programa pode solicitar intervenção humana e interromper.
- Privacidade: cofre do sistema para segredos locais, armazenamento isolado no Cloud, logs mínimos; sem dados reais em testes.

## Contratos e implementação

- [agent-runtime-contract.md](agent-runtime-contract.md): contrato **proposto**, neutro em linguagem, para a primeira jornada.
- [agent-application-contract.md](agent-application-contract.md): políticas de candidatura e regras mais detalhadas do domínio.
- [architecture.md](architecture.md): fotografia da implementação Next.js + FastAPI existente.
- [architecture-evaluation.md](architecture-evaluation.md): evidências e opções Rust/Go/TypeScript/Python abertas.

Não começar por criar um serviço proprietário ou outro repositório. Primeiro demonstrar a experiência de agente com ferramentas e provas de execução, medir custo e validar a compatibilidade com fontes permitidas.
