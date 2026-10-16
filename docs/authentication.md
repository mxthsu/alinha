# Identidade Google e conexões de IA

O Alinha tem **duas autorizações diferentes**, com propósitos independentes.

- **Conta Google:** identifica a pessoa na interface, usando OAuth/OIDC oficial via [Auth.js](https://authjs.dev/getting-started/providers/google). Ela não dá ao Alinha autorização para usar Gemini ou Google Drive.
- **Provedor de IA:** conecta Gemini API, Claude API, OpenAI API, Ollama local ou ChatGPT local autorizado. A conexão ocorre em **Conexões de IA**, depois da entrada no aplicativo.

## Jornada no site

1. Abra `http://localhost:3000` (entrada do Alinha).
2. Entre com sua conta Google, **se a instalação possuir OAuth configurado**, ou escolha **Continuar no Community local**. O software Community nunca exige conta.
3. No espaço inicial `/inicio`, escolha criar currículo (`/studio`), verificar legibilidade ATS (`/ats`), analisar uma vaga (`/analisar`) ou gerenciar conexões (`/conexoes`).
4. Na página `/conexoes`, selecione um provedor de IA e conecte a chave ou conta elegível. Essa credencial é independente do login Google.
5. Quando precisar de IA, selecione entre os provedores conectados na ferramenta. Recursos sem IA continuam funcionando mesmo sem conexão.

## Habilitar login Google na instalação

A instalação Community pode funcionar offline e **não inclui credenciais do Google**. Para ativar um login real:

1. No [Google Cloud Console](https://console.cloud.google.com/apis/credentials), configure a tela de consentimento OAuth e crie um cliente OAuth 2.0 do tipo **Aplicativo da Web**.
2. Adicione `http://localhost:3000` como origem JavaScript autorizada.
3. Adicione **exatamente** `http://localhost:3000/api/auth/callback/google` como URI de redirecionamento autorizado. Caso o console esteja em modo de teste, adicione os usuários de teste necessários.
4. Em `apps/web/.env.local` (não versionado), configure:

```env
AUTH_GOOGLE_ID=<CLIENT_ID_DO_GOOGLE>
AUTH_GOOGLE_SECRET=<CLIENT_SECRET_DO_GOOGLE>
AUTH_SECRET=<SEGREDO_ALEATORIO_COM_32_CARACTERES_OU_MAIS>
NEXT_PUBLIC_API_URL=http://localhost:8000
```

5. Gere `AUTH_SECRET` com uma fonte criptograficamente segura (por exemplo `npx auth secret`) e **reinicie/recompile** o Next.js.
6. Abra `/`, clique em **Continuar com Google** e autorize o login pelo Google. O Alinha solicitará somente identidade básica; não peça acesso a Gmail/Drive.

Não inclua os segredos em código, commits, `.env.example`, logs, prints ou scripts de CI. A versão atual não mantém banco de contas, não armazena currículo por usuário e não oferece sincronização entre dispositivos: login Google **não representa** Cloud pronto.

### Sem configuração Google

A interface informa que a entrada Google está indisponível e mantém o botão para **continuar localmente**. Não há login simulado. Sem as variáveis de configuração, as rotas da Auth.js não geram uma sessão Google.

## Segurança

- Sessões de identidade são geridas pela Auth.js no servidor Next.js; o Google Client Secret nunca deve ser enviado ao navegador.
- A integração utiliza OAuth/OIDC oficial com verificações próprias do Auth.js (incluindo sessão e proteções de fluxo OAuth). Apenas emails verificados são aceitos.
- O OAuth ChatGPT local, quando permitido, é exclusivamente **autorização de uso do provedor de IA**, não o login Google nem uma credencial para SaaS.
- No Community, o backend FastAPI continua local e os documentos não são vinculados a uma sessão Google. Não exponha essa API na Internet.
- No futuro Cloud, cada endpoint de dados e inferência precisará verificar a sessão e a autorização do usuário no servidor, com armazenamento isolado. **Ainda não existe** autenticação e autorização multitenant adequadas para publicação do Cloud.
- Os dados enviados a APIs de terceiros estão sujeitos à política do provedor selecionado. Não compartilhe tokens ou contas para contornar limites de assinatura.

O login Google exige um cliente OAuth e consentimento configurados pelo proprietário; **não é possível validar a autorização externa real apenas com testes sintéticos**.

## Referências

- [Auth.js Google Provider](https://authjs.dev/getting-started/providers/google)
- [Auth.js Next.js](https://authjs.dev/reference/nextjs)
- [Next.js — boas práticas de autenticação](https://nextjs.org/docs/app/guides/authentication)
