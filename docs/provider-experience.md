# Experiência de conexão com IA no Community

## Referências examinadas

A conexão com modelos deve ser uma **configuração reutilizável** (e não um novo login do produto), com estado claro e escolha de provedor antes de cada operação.

| Projeto open source | Padrão documentado | Decisão adotada |
| --- | --- | --- |
| [Jan](https://docs.jan.ai/desktop/quickstart) | Settings → Model Providers; configurar chave uma vez e selecionar modelo ao usar | Central única com escolha do provedor |
| [Open WebUI](https://docs.openwebui.com/getting-started/quick-start/connect-a-provider/) | Conexões com Ollama, OpenAI-compatible e APIs hospedadas, depois escolha de modelo | Exibir provedores prontos e permitir alterar conexão |
| [LibreChat](https://www.librechat.ai/docs/quick_start/first_chat) | Pode aceitar chave individual do usuário para modelos configurados | BYOK sem key compartilhada do operador |
| [AnythingLLM](https://docs.anythingllm.com/setup/llm-configuration/local/built-in) | Escolha do provedor/modelo durante o primeiro uso e alteração posterior nas configurações | Dar destaque à conexão inicial sem exigir conta Alinha |

Estas referências são de padrões de experiência e organização, **não de componentes copiados, telas reproduzidas ou APIs não autorizadas**. Nenhum projeto é parceiro ou endossa o Alinha.

## Jornada proposta e implementada

1. **Home sem login:** recuperar hero original e prévia de relatório, seção de transparência open source e navegação direta para ferramentas.
2. **Conexão destacada sem poluição:** estado real no botão da navegação e no CTA do hero, utilizando uma consulta compartilhada ao backend. A configuração detalhada continua em `/conexoes`, sem cartão de onboarding duplicado na home.
3. **Conectar uma vez:** o usuário escolhe Gemini, Claude API, OpenAI API, ChatGPT local autorizado ou Ollama. As credenciais pessoais de API permanecem no cofre do sistema operacional.
4. **Usar em várias ferramentas:** análise de vagas e revisão com IA no Studio podem usar um dos provedores disponíveis, sem novo formulário de credenciais a cada análise.
5. **Continuar sem IA:** criação/edição de currículo e verificação de legibilidade ATS ficam disponíveis independentemente da conexão.
6. **Alterar ou remover:** `/conexoes` é um centro permanente de gerenciamento, destacado também no menu interno.

A home exibe somente metadados de disponibilidade, nunca o valor de uma chave; o status de conexão não significa que haverá saldo, quota ou disponibilidade de serviço externo garantidos. Operações com IA podem consumir a conta do usuário e estão sujeitas aos limites de cada provedor.

## Limites e segurança

- **Community:** nenhum login Google, conta Alinha ou persistência de conta. A autorização ChatGPT local é restrita ao provedor de IA, e não autentica o usuário no produto.
- **Cloud (futuro):** identidade e autorização serão funcionalidades próprias e separadas do Community.
- Nenhuma chave real, currículo pessoal ou documento sensível é enviado para testes automatizados.
- Ollama depende do servidor local; uma instância disponível não garante que todo modelo desejado esteja instalado.
- O uso de um provedor é sempre iniciado explicitamente pelo usuário; o Alinha não usa API de terceiros em background para completar o onboarding.
