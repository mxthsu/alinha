# Autenticação no Alinha Community e planejamento do Cloud

## Community: sem login obrigatório

O Alinha Community é **open source e não possui sistema de contas pessoais**. Você acessa a home em `http://localhost:3000`, usa o editor, verifica a legibilidade ATS e pode exportar currículos sem cadastro, autenticação Google ou conexão com uma IA.

A página **Conexões de IA** (`/conexoes`) é uma configuração do provedor, **não um login no Alinha**. Ela permite:

- conectar sua chave Gemini, Claude API ou OpenAI API, guardada no cofre de credenciais do sistema operacional;
- utilizar Ollama instalado localmente, sem chave para a API externa;
- autorizar ChatGPT por um fluxo OAuth local quando o mecanismo estiver habilitado e autorizado para aquela conta.

Autorizar ChatGPT no Community **não cria conta Alinha**; apenas permite utilizar o provedor de IA localmente, conforme os limites e condições aplicáveis. A configuração e as credenciais dos provedores podem ter custos próprios. Nunca cole cookies, senhas ou tokens de sessão de sites no Alinha.

Você pode usar quantos provedores quiser e escolher entre os que estão disponíveis ao realizar uma análise. A conexão com IA é necessária apenas nas ferramentas que usam inferência: por exemplo, comparação de requisitos com a vaga e revisão com IA no Studio.

Os recursos offline sem IA continuam funcionais mesmo se nenhum provedor estiver conectado. O perfil do currículo não é armazenado automaticamente; exporte JSON ou DOCX para salvar seu trabalho.

## Cloud: identidade será implementada separadamente

O futuro Alinha Cloud poderá exigir autenticação para salvar currículos por conta, sincronizar histórico e permitir planos pagos. Login Google é **uma possibilidade futura exclusiva do Cloud** e **não está implementado no Community**. Não há atualmente cliente Google OAuth ou fluxo Google na aplicação Community, nem conexão da conta Google à autorização Gemini.

Antes da publicação do Cloud, será preciso projetar autorização em backend, sessões, isolamento entre usuários, direitos LGPD e medição/cobrança seguras. Nunca use o OAuth ChatGPT local como sessão ou identidade do serviço Cloud.

Consulte [estratégia comercial Cloud](cloud-business-model.md) e [central de provedores](providers.md).
