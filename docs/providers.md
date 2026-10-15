# Provedores de IA: ChatGPT, Gemini e Ollama

O Alinha permite selecionar o motor da análise, mantendo o mesmo pipeline de verificação literal de evidências. O motor de IA **não substitui** a validação independente das citações de currículo e vaga.

## 1. ChatGPT — assinatura do usuário (somente uso local)

O código segue o fluxo oficial de **Sign in with ChatGPT para ferramentas open source executadas localmente**:

1. A pessoa inicia a autorização clicando em **Continuar com ChatGPT** no site local.
2. O backend cria um identificador estável de instalação (UUID), `state`, `nonce` e um desafio PKCE S256.
3. O navegador abre `https://auth.openai.com/api/accounts/authorize` com `client_id=dynamic_agent_client` no primeiro acesso.
4. O callback fixo `http://127.0.0.1:8000/auth/callback` recebe o código e o identificador emitido pelo provedor.
5. A API troca o código usando o verificador PKCE, valida a assinatura do ID token, emissor, audiência, expiração, nonce, identidade e o escopo `chatgpt.tokens.use.direct`.
6. Os tokens permanecem **no cofre de credenciais do sistema operacional** por meio de `keyring`. Nenhum token é enviado ao Next.js.
7. A lista de modelos elegíveis é consultada na API pública. As solicitações usam `POST https://api.openai.com/v1/responses` com `store: false` e `stream: true`.
8. O fluxo só é considerado concluído após `response.completed`; falhas e respostas incompletas não geram análise.
9. O backend renova a sessão com a credencial de refresh rotativa, serializando a renovação num lock.
10. Ao desconectar, tenta revogar a sessão na OpenAI e remove os tokens locais; caso a revogação não possa ser confirmada, informa essa limitação.

**Restrições importantes:**

- Esse modo foi criado para uso **no próprio computador**, por uma pessoa. Não é uma solução OAuth para um servidor público com vários usuários.
- Habilite explicitamente `ALINHA_LOCAL_AUTH_ENABLED=1`, mantenha a API vinculada a `127.0.0.1:8000` e **desative logs de acesso do Uvicorn**. O callback OAuth recebe um código de uso único na URL, que não deve aparecer nos logs.
- Jamais use cookies, tokens exportados do Codex CLI ou endpoints privados do ChatGPT.
- Login e uso do plano são permissões diferentes; a conta precisa autorizar o escopo correto. A disponibilidade e os limites dependem da conta e das políticas do provedor.
- Os limites de uso da assinatura são compartilhados; a integração não oferece inferência ilimitada ou gratuita para todos.
- A versão atual tem **uma conta ChatGPT ativa por instalação**. Suporte a múltiplas contas pode ser adicionado posteriormente, sem compartilhar tokens.
- A hospedagem pública permanece **sem esse OAuth habilitado**, salvo autorização e implementação apropriada do fluxo comercial/parceiro.
- A implementação OAuth está coberta por testes sintéticos, mas o login real depende da **autorização voluntária do usuário**; não há autenticação automática.

### Iniciar localmente

Na pasta `apps/api`:

```bash
cp .env.example .env
```

Altere para `ALINHA_LOCAL_AUTH_ENABLED=1`. Em seguida:

```bash
uv sync --dev
uv run uvicorn alinha_api.main:app --app-dir src --host 127.0.0.1 --port 8000 --env-file .env --no-access-log
```

Em outro terminal:

```bash
cd apps/web
npm ci
npm run dev
```

Acesse `http://localhost:3000`, selecione ChatGPT e clique **Continuar com ChatGPT**. Quando o navegador pedir autorização, leia e aprove os escopos. No primeiro teste, utilize **dados fictícios**, não seu currículo pessoal.

Ao desativar o login, use `ALINHA_LOCAL_AUTH_ENABLED=0` ou não configure essa variável.

## 2. Gemini — chave de API

Defina `GEMINI_API_KEY` no arquivo local `apps/api/.env`. A API nunca expõe essa chave ao navegador. A assinatura ChatGPT **não** serve como chave Gemini.

## 3. Ollama — sem cobrança por chamada

Instale o Ollama no computador, faça download do modelo correspondente a `OLLAMA_MODEL` e mantenha o servidor em `http://127.0.0.1:11434`. O adaptador **não permite endpoints remotos arbitrários**. O custo é de recursos computacionais próprios; desempenho e qualidade dependem do modelo.

## Segurança e privacidade

- A origem das requisições de autorização locais é verificada e só são permitidos clientes loopback.
- A autorização expira após 10 minutos e o `state` só pode ser utilizado uma vez.
- O ID token é validado com JWKS oficiais; não se confia em dados decodificados sem verificar a assinatura.
- A aplicação não armazena currículos. Contudo, no modo ChatGPT/Gemini, conteúdo pode ser processado remotamente; consulte as políticas do provedor.
- **Não há suporte autorizado para compartilhar tokens de assinatura entre os visitantes de um site público.**
- Para produção pública, crie um mecanismo de conta/sessão próprio, limites de uso, proteção contra abuso e um método de inferência compatível com as regras dos provedores.

## Documentação oficial

- [Visão geral de uso do plano em apps open source](https://developers.openai.com/siwc/token-sharing-open-source)
- [Registro e login OAuth](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)
- [Modelos e inferência Responses API](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference)
- [Sessões, renovação e revogação](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions)
- [Limitações da prévia](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations)

## Community e Cloud (fronteira de implantação)

O Alinha separa os modos por configuração **do servidor**, nunca por um campo enviado pelo navegador:

- `ALINHA_DEPLOYMENT_MODE=community` (padrão): execução open source do usuário; pode acessar o Ollama local e, quando ativado explicitamente, o OAuth OSS local do ChatGPT.
- `ALINHA_DEPLOYMENT_MODE=cloud`: reservado para o futuro serviço gerenciado. **Neste estágio a inferência Cloud retorna HTTP 503**, mesmo se uma chave de API estiver configurada; não existem ainda conta do Alinha, medição, controle de gastos e defesa contra abuso.

Mesmo no modo Community, o login com ChatGPT só é habilitado com `ALINHA_LOCAL_AUTH_ENABLED=1`, API em loopback e as verificações de origem documentadas. Para o Cloud, **não** aproveitar o OAuth OSS local; exigir a modalidade adequada autorizada para sites hospedados.

A decisão de produto e negócio, com Community gratuito e hospedagem paga opcional, está em [Modelo do produto](product-model.md). Não divulgar como lançados os planos que ainda estão no roteiro.

## Central de Conexões de IA (Community)

A interface do Alinha usa o mesmo padrão de **gerenciamento de conexões** para todos os provedores, mas respeita as formas de autenticação oficiais de cada um. Na seção **Conexões de IA**:

| Opção | Autenticação | Onde a credencial fica |
| --- | --- | --- |
| ChatGPT | OAuth com autorização no navegador | Cofre local; tokens nunca vão para o Next.js |
| Claude | Chave da **Claude API** da Anthropic | Cofre do sistema operacional |
| Gemini | Chave da **Gemini API** | Cofre do sistema operacional |
| OpenAI API | Chave da API da OpenAI, com cobrança separada | Cofre do sistema operacional |
| Ollama | Modelo executado no próprio computador | Não precisa de chave |

Para conectar chaves, abra o aplicativo local, selecione o provedor, obtenha a chave na plataforma oficial e clique em **Verificar e conectar**. O backend consulta a lista de modelos do provedor com a chave fornecida, **sem solicitar geração de texto**. Só após uma resposta autorizada a chave é salva pelo `keyring`. A interface nunca devolve nem exibe a chave depois de conectada. Para remover uma chave armazenada, selecione **Remover conexão**. Chaves configuradas por variáveis de ambiente devem ser removidas no servidor, e não podem ser apagadas pela interface.

- Não existe login direto de **Claude Pro/Max** para uso no Alinha. Uma assinatura de chat e a API Anthropic são produtos diferentes. Consulte [a documentação oficial da API Claude](https://platform.claude.com/docs/en/api/overview).
- A conexão OpenAI API **não** equivale ao login ChatGPT. A primeira utiliza cobrança de API independente; a segunda só é oferecida no fluxo OSS local permitido, conforme elegibilidade, permissões e limites do usuário.
- O modo Cloud não aceita essas conexões pessoais e continua bloqueado até possuir sessões, isolamento entre usuários, medição, limites e armazenamento apropriados.
- Chaves não vão para `localStorage`, cookies, scripts de inicialização ou arquivo `.env` quando fornecidas pela interface.
- Não cole senhas da conta ChatGPT/Claude, cookies, tokens de sessão do navegador ou códigos extraídos de outros aplicativos.
- As conexões e a inferência com credenciais reais devem ser testadas voluntariamente pelo usuário; o CI usa somente credenciais sintéticas.

### Boas práticas

Execute o Alinha local com `python scripts/dev.py`, vinculado a `127.0.0.1`. O script inicia Uvicorn sem log de acessos para evitar URLs do callback OAuth nos logs. Em sistemas com cofre indisponível, a conexão de chaves deve apresentar erro; **nunca salvar chaves em texto simples como fallback**.

Conectar uma chave valida a credencial, mas não garante saldo, permissão para cada modelo ou cotas de inferência. Os modelos padrão são definidos no backend; a disponibilização e preços podem mudar no provedor.
