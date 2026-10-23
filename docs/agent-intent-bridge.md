# Interpretação opcional do objetivo com IA — primeiro incremento da issue #48

> **Status: incrementos #50 e #51 integrados à main; não é runtime agentic completo.** Rust/Go/TypeScript/Python continuam em avaliação por requisito concreto. Não há envio automático de candidatura.

## O que muda em `/agente`

- A jornada original continua íntegra, inclusive sem nenhuma IA conectada.
- O usuário pode expandir **“Interpretar objetivo com sua IA”**, escolher um provedor disponível no cofre local e clicar explicitamente para sugerir o cargo. Uma chamada recebe **somente o objetivo digitado (máximo 400 caracteres)**, sem currículo, vaga, contatos ou dados do perfil.
- A API `POST /api/v1/agent/interpret` exige `run_id`, `request_id`, `objective` e `provider` (Gemini, OpenAI API, Anthropic/Claude API ou Ollama local). Não há `ChatGPT` por OAuth nesse contrato inicial, para evitar misturar credenciais de conta e chaves de API.
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

Após os dois incrementos integrados: medir falhas com provedor real autorizado, registrar consumo/limites por jornada, interpretar condições ambíguas em esquema estruturado sem enfraquecer critérios, planejar uma sequência tipada de ferramentas controladas e persistir eventos/cancelamento. Não implementar tudo isso alterando o parser atual às cegas.


## Segundo incremento (integrado à main via PR #51): plano tipado e limite por jornada

A PR #51 foi rebased sobre a main após o squash da #50 e incorporada com CI aprovada.

### Plano revisável, sem poderes concedidos à IA

A API agora retorna uma sequência **fixada pelo código**, derivada do cargo sugerido pela IA:
1. `job.search` — requer autorização separada do usuário antes da consulta;
2. `job.assess` — comparação local e determinística com o currículo;
3. `application.preview` — somente se o objetivo digitado pedir preparação; revisão humana é necessária.

Todas as etapas são marcadas `state=proposed`, `external_submission=false`. O modelo não escolhe ferramentas, ordem ou permissões; ele **continua sugerindo somente o cargo**. O frontend valida a mesma ordem, checa o UUID da jornada e não executa ações automaticamente por receber uma proposta. A busca e a prévia continuam sendo realizadas pelas rotinas existentes da jornada `/agente`, sujeitas aos consentimentos existentes. **Não é ainda um orquestrador com eventos duráveis de execução.**

### Reserva de chamadas de IA

- Cada solicitação de interpretação exige `run_id` e `request_id` UUIDv4. O backend reserva atomicamente **até 2 chamadas por `run_id`** em SQLite local antes de contactar o fornecedor.
- A reserva é transacional e resistente a solicitações concorrentes, repetição de `request_id` ou reinício da API. O banco armazena só UUIDs e horário, sem prompts, currículos, tokens ou chaves; elimina registros após 14 dias.
- Falha técnica do banco **impede** a chamada (fail-closed); falha ou timeout do provedor **consome** a reserva para não duplicar uma chamada potencialmente faturada.
- O frontend exibe o saldo por jornada e permite consultar vagas sem IA ao esgotá-lo.
- **Limitação deliberada:** é um limite *por UUID de jornada*, não um limite financeiro global ou mensal. Alterar o objetivo/reabrir a página pode criar novo UUID, e não existe autenticação/identidade global. O valor da chamada, tokens reais, cota total do provedor e custos comerciais **não são medidos** neste incremento. Chamar isso de "limite financeiro total" seria incorreto.
- Controles do provedor sobre output/timeout permanecem; não há reutilização de segredos entre modelos nem login obrigatório para a Community.

### Verificações e limitações

Os testes incluem concorrência de 8 threads reservando no mesmo SQLite (só 2 conseguem), repetição de solicitação (409), terceira chamada (429), persistência do orçamento após reabrir conexões, rejeição de payload adicional e plano malicioso. O Chrome com IA e vagas fictícias verifica que o plano é visível, a busca não acontece antes da confirmação e nenhuma candidatura é enviada.

Ainda faltam integração real de provedores com uma chave de teste autorizada, contador de tokens/custos, eventos duráveis de execução e um coordenador que despache ferramentas por políticas sem depender do estado do React. Não expor isso como produto pronto. Continuar com PRs pequenas.
