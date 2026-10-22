# Contrato candidato do agente de carreira — v0 (independente de linguagem)

> **Especificação proposta para a próxima implementação.** Não é API disponível, protocolo estabilizado nem compromisso com Rust, Go, Python ou TypeScript. O objetivo é fazer o mesmo agente funcionar no Community, Desktop e Cloud, com adaptadores trocáveis e revisões verificáveis.

## Separar quatro responsabilidades

1. **Interface**: recebe intenção, exibe plano e eventos, solicita dados/consentimento, permite cancelar/revisar. Ela nunca executa ações externas por iniciativa própria.
2. **Coordenador**: mantém `run_id`, passos e estados; resolve dependências, idempotência, timeout, política de orçamento e retomada. Pode ser Rust, Go, Python ou TypeScript, conforme a implementação mais simples que cumprir os contratos.
3. **Inteligência (porta `AIProvider`)**: transforma contexto mínimo em *propostas estruturadas* e responde ambiguidades. Modelos podem falhar, não suportar tool calling ou não estar conectados; há fallback para execução determinística. Não guarda nem autoriza credenciais.
4. **Ferramentas (porta `ToolExecutor`)**: `resume.read`, `job.search`, `job.assess`, `resume.prepare`, `application.preview`. Cada execução recebe parâmetros validados, escopo, deadline e uma política independente do modelo. `application.submit` **não faz parte do MVP**.

## Contratos de mensagens (exemplos fictícios, não endpoints implementados)

**`StartRun`**:
```json
{
  "schema_version": 1,
  "request_id": "demo-request-001",
  "intent": "Encontre vagas de Python remotas e prepare um rascunho",
  "profile_ref": "local:fictional-profile",
  "mode": "assisted",
  "limits": {"max_ai_calls": 3, "max_jobs": 15, "max_elapsed_ms": 60000}
}
```

**`ProposedAction`** — produzida por IA ou planejador determinístico; **não** significa permissão:
```json
{
  "schema_version": 1,
  "action_id": "demo-action-001",
  "tool": "job.search",
  "args": {"query": "Desenvolvedor Python", "remote_only": true, "limit": 10},
  "reason": "Cargo solicitado explicitamente no objetivo"
}
```

**`RunEvent`** — produzida pelo coordenador (não pelo texto do modelo):
```json
{
  "schema_version": 1,
  "run_id": "demo-run-001",
  "sequence": 4,
  "step": "application.preview",
  "status": "needs_review",
  "summary": "Prévia criada; perguntas desconhecidas exigem confirmação",
  "external_submission": false
}
```

## Estados e transições

`created → planning → running → needs_review | completed | failed | cancelled`. `needs_review` pode voltar a `running` com decisão explícita da pessoa. “Concluído” significa **jornada local** concluída, não candidatura enviada. Se uma ação remota der timeout depois de possivelmente enviar dados, registrar `outcome_unknown` e nunca repetir cegamente; execução externa fica fora do MVP.

## Regras não negociáveis

- Perfil/competências/currículo só com evidência e campos editáveis. Valores não comprovados são `unknown` ou `needs_review`.
- Ações com custos ou riscos precisam de permissões por ferramenta. Autorização para buscar vagas ≠ autorização para submeter candidatura.
- Limites de IA e tempo definidos no Core, **antes** da chamada de ferramenta/modelo; modelo nunca pode ampliar limites.
- Texto de vaga, HTML de ATS e conteúdo de currículo são **dados não confiáveis** (possível prompt injection), não instruções.
- Não enviar chaves de API nem cookies ao frontend, a logs ou a outros provedores de IA.
- Idempotência por `request_id`/`action_id` e registro durável **quando necessário para ações reais**. Um teste in-memory não é garantia de recuperação após reinício.
- Sem chamada de LLM por clique; busca, mapeamento estável, filtros, deduplicação e renderização devem operar sem inferência sempre que possível.
- Em todo teste, dados **sintéticos**, sem acessos automatizados a sites reais sem autorização e sem contorno de CAPTCHA/MFA.

## Plano mínimo de implementação

- Criar tipos de `StartRun`, `ProposedAction`, `RunEvent` e `ToolResult` onde o código atual já facilitar. Não forçar pacotes externos novos.
- Criar `FakeAIProvider`, `FakeJobSource`, `FakeResume` e executor de `application.preview` sem efeitos externos.
- Expor a jornada na UI `/agente` com estados, cancelamento, revisão e rastreabilidade de cada passo.
- Somente após a versão fake funcionar, escolher uma conexão real de IA com limite verificável e um conector de vagas autorizado.
- Mensurar erros, tempo de jornada e tokens; redesenhar a arquitetura *apenas* se o custo/complexidade medidos justificarem.

Arquiteturas novas podem implementar exatamente esses contratos sem reescrever a experiência do usuário. Contratos devem evoluir por testes e PRs, não por preferência de linguagem.
