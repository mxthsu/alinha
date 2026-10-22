# Alinha — visão do agente de carreira

> **Visão em 22/10/2026.** Consulte [guia para retomar em outro chat](CONTINUAR-ALINHA.md) para detalhes de implementação e [roadmap](roadmap.md) para prioridades. O produto não está em produção, não oferece candidaturas externas automáticas nem dispõe de Cloud/instalador Desktop público.

## O produto

O **Alinha é o agente**, não o modelo conectado e não uma coleção de ferramentas soltas. A pessoa delega uma intenção em linguagem natural: encontrar vagas alinhadas ao seu currículo, preparar documentos e acompanhar oportunidades. O agente planeja, consulta fontes autorizadas, executa etapas determinísticas, interpreta ambiguidades com IA selecionada e pede revisão ou autorização quando necessário.

A interface principal se concentra **em uma única jornada** com status e interrupções claras, sem mostrar a automação de navegador. Ferramentas manuais continuam acessíveis como opções secundárias. A primeira experiência deve funcionar com perfil/currículo fictício e um provedor IA simulado, para tornar os testes independentes de pagamentos e contas.

## Três linhas de distribuição

- **Alinha Community — Open Source:** desenvolvedores, colaboradores e self-hosting, código auditável, configuração avançada, IA própria/local.
- **Alinha Desktop:** aplicativo instalável para usuários comuns, com mesma jornada agêntica e conexão simplificada de IA; ainda não lançado.
- **Alinha Cloud:** versão online gerenciada com execução remota e isolamento; ainda não lançada e com cobrança **a definir**.

São **formas de usar o mesmo agente**, não três produtos desconectados. Desktop poderá ser open source. A licença do repositório atual é MIT. Não atrelar Community à contratação da Cloud.

## Jornada

1. **Conectar IA (quando necessário)** — escolha de provedor/modelo; funcionamento determinístico possível sem IA.
2. **Importar CV → construir perfil** — extração com evidências, preenchimento direto de campos, correção humana, armazenamento local quando apropriado.
3. **Entender objetivo** — cargos, Brasil/remoto/híbrido/presencial, cidade, regime, pretensão e outros critérios explícitos; pedir esclarecimento só quando indispensável.
4. **Buscar e comparar vagas** — várias fontes legítimas; deduplicação e descrição real, sem inventar requisitos ou nota ATS.
5. **Preparar candidatura** — adaptar currículo sem inventar fatos; checagem ATS integrada, respostas e anexos com revisão humana.
6. **Executar apenas o permitido** — futuramente, envio a plataformas autorizadas, com confirmação; questões desconhecidas, MFA/CAPTCHA e outros riscos interrompem execução.
7. **Acompanhar** — mostrar somente fatos realmente confirmados pela pessoa ou plataformas.

A IA não substitui regras de segurança, filtros determinísticos, nem verificação factual. Nem toda ação precisa de uma chamada ao modelo; manter custo e latência sob controle.

## Internacionalização e público

Começar no Brasil, pt-BR para usuário e documentação, nomes de código em inglês, com preparação futura para en-US. Valores em BRL quando aplicável, contratos CLT/PJ/estágio/trainee e opções remoto/híbrido/presencial. Evitar slogan, banner promocional e elementos que poluam a experiência principal.

## Métricas que importam

Sucesso da jornada com dados fictícios; precisão de campos do currículo e respostas; cobertura e fidelidade das vagas; taxa de interrupções/revisões; ausência de envios não autorizados; p50/p95 de latência; chamadas de IA e custo por tarefa; memória e dificuldade de instalação Desktop. Não confundir rapidez de um CLI de navegador em um formulário sintético com qualidade global do Alinha.

## Próximo marco

Entregar uma fatia vertical funcional em `/agente` — perfil fictício, objetivo, plano, busca de teste, avaliação de evidências e prévia de candidatura, sem envio real. Usar [contrato do agente](agent-runtime-contract.md), testes e ferramentas atuais onde adequado; **não escolher stack final por hábito ou por novidade**.

## Segurança

Respeitar regras das plataformas e LGPD; sem CAPTCHA bypass, sem credenciais de terceiros em repositórios, sem currículos reais em CI e sem anunciar candidatura enviada sem confirmação. A pessoa precisa controlar consentimento, pausa e revisão; páginas e vagas são dados não confiáveis.

Arquitetura: [implementation snapshot](architecture.md) · [avaliação neutra](architecture-evaluation.md) · [limites open source](open-core-boundaries.md).
