# Interpretação opcional do objetivo com IA — primeiro incremento da issue #48

> **Status: piloto da Community, isolado em PR; não é runtime agentic completo.** Rust/Go/TypeScript/Python continuam em avaliação por requisito concreto. Não há envio automático de candidatura.

## O que muda em `/agente`

- A jornada original continua íntegra, inclusive sem nenhuma IA conectada.
- O usuário pode expandir **“Interpretar objetivo com sua IA”**, escolher um provedor disponível no cofre local e clicar explicitamente para sugerir o cargo. Uma chamada recebe **somente o objetivo digitado (máximo 400 caracteres)**, sem currículo, vaga, contatos ou dados do perfil.
- A API `POST /api/v1/agent/interpret` aceita `objective` e `provider` (Gemini, OpenAI API, Anthropic/Claude API ou Ollama local). Não há `ChatGPT` por OAuth nesse contrato inicial, para evitar misturar credenciais de conta e chaves de API.
- O retorno aceito contém **somente proposta de ferramenta `job.search` e cargo**, razão curta, `needs_confirmation=true`, `executed=false`, `external_submission=false`, `model_calls=1`. É validado por Pydantic no backend e novamente pela UI. A IA não tem acesso a executores.
- A sugestão **nunca dispara busca sozinha**. Só após clicar **“Usar cargo sugerido”** a UI substitui o cargo da pesquisa atual. Os filtros determinísticos de modalidade, cidade, contrato, Brasil e salário são preservados. Ainda existe autorização de busca separada.
- O mesmo endpoint é limitado à Community em loopback, origem permitida; rejeita payloads com campos extras. `Cache-Control: no-store`. O frontend não recebe chaves de IA.
- O botão é desabilitado enquanto aguarda; a pessoa pode continuar com busca determinística em caso de erro.

## Limites e riscos explícitos

- Máximo de **uma chamada de modelo por clique** e **260 tokens de saída por requisição**; timeout de 25s, sem retries de SDK no Gemini; a proteção de RPM/RPD do Gemini já existente é reutilizada. Isso **não** é teto monetário total por sessão: usuários podem solicitar novamente e modelos/fornecedores podem cobrar pelo uso. Criar contabilidade global e orçamento absoluto numa etapa posterior.
- Outputs não suportados, inválidos ou que tentem introduzir URLs, ferramentas extras, flags de envio ou requisitos de execução são rejeitados. Ainda cabe ao usuário julgar se o cargo sugerido é correto.
- O modelo não interpreta nem executa toda a jornada: consulta de fontes, matching de evidências, rascunhos e políticas de consentimento continuam implementações determinísticas. Essa é uma **integração real de um passo do agente**, não autonomia total.
- **Não houve teste pago com credenciais de IA reais.** Os testes de adaptadores usam respostas e chaves inteiramente fictícias; o Chrome intercepta `/agent/interpret` e `/jobs/search`. Não interpretar esse smoke como validação de disponibilidade dos modelos em provedores reais.
- Modelos locais podem não suportar JSON estrito e resultar em fallback; qualquer compatibilidade é dependente da versão instalada e do modelo da pessoa.

## Validação reproduzível

```powershell
cd apps/api
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\ruff.exe check .

cd ../web
npm run test:local
npm run lint
npm run build
# Com API e Next iniciados localmente e Chrome instalado:
npm run test:browser
```

Os testes verificam origem local, ausência de currículo no payload, proposta pendente de confirmação, rejeição de `application.submit`, proibição de uso na Cloud, limite de respostas e filtro remoto preservado, além de ausência de envio externo de candidaturas.

## Próxima fatia da issue #48

Depois de revisar esse piloto: medir falhas com provedor real autorizado, registrar consumo/limites por jornada, interpretar condições ambíguas em esquema estruturado sem enfraquecer critérios, planejar uma sequência tipada de ferramentas controladas e persistir eventos/cancelamento. Não implementar tudo isso alterando o parser atual às cegas.
