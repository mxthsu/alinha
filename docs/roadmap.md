# Roteiro do projeto

## v0.1 — Fundação reproduzível

- [x] Definir produto e posicionamento em português brasileiro.
- [x] Criar site responsivo, formulário e demonstração fictícia.
- [x] Criar API FastAPI com contratos estruturados.
- [x] Integrar provedor Gemini isolado e fluxo LangGraph.
- [x] Validar citações e incluir testes locais.
- [x] Configurar verificações de API e site em pull requests.
- [x] Documentar instalação em um comando, primeiros passos, segurança e contribuição.
- [x] Criar exemplos totalmente sintéticos e prévia da interface para o repositório.
- [ ] Validar o instalador simplificado em um segundo computador limpo.
- [ ] Validar ponta a ponta com uma chave própria em ambiente de desenvolvimento.
- [ ] Realizar testes de usabilidade com usuários e capturar feedback.

## v0.2 — Qualidade e responsabilidade

- [ ] Dataset sintético **anotado** e suíte de avaliações reprodutíveis (os exemplos atuais são somente demonstrações, não um benchmark).
- [ ] Observabilidade de latência/custo sem guardar dados pessoais.
- [ ] Limitação de taxa, proteção de custos e prevenção de abuso.
- [ ] Política de privacidade e consentimento para processamento externo.
- [ ] Acessibilidade e testes de interface.

## v0.3 — Recursos para candidatos

- [x] Diagnóstico inicial determinístico de legibilidade ATS para PDF, DOCX e TXT; sem nota universal ou alegação de aprovação.
- [ ] Validar diagnóstico ATS com diferentes documentos sintéticos e parsers (incluindo PDFs com layouts complexos).
- [x] Editor manual de currículo com comparação do original, revalidação ATS e exportação DOCX textual.
- [x] Studio inicial com perfil estruturado (JSON v1), prévia ao vivo, dois modelos e revisão orientativa via LangGraph com citações verificadas.
- [ ] Importação assistida de CV em seções com confirmação humana.
- [ ] Sugestões de reescrita por IA com aprovação individual e evidências verdadeiras.
- [ ] Versões persistentes opt-in do currículo.
- [x] Exportação DOCX de coluna única, testada por leitura de texto.
- [ ] Exportação PDF com texto selecionável e validação visual.
- [ ] Plano de preparação de entrevistas.
- [ ] Histórico opcional e controles de exclusão.

## Jornada unificada de candidatura

- [x] Unificar leitura ATS e comparação com vaga na rota `/preparar`, preservando redirects das URLs anteriores.
- [x] Reutilizar o arquivo escolhido na mesma página entre ATS e análise com IA, sem novo upload manual.
- [x] Importar PDF/DOCX/TXT no Studio para rascunho estruturado com confirmação humana.
- [ ] Transferir dados entre Studio e preparação de candidatura em memória sem novo upload ou persistência indevida.
- [ ] Melhorar reconhecimento de CVs com seções pouco padronizadas e avaliar extração assistida por IA com citações.

## Navegação e identidade

- [x] Home Community recuperada sem login, com hero, prévia de análise e seção de código aberto.
- [x] Navegação por áreas: Início, Meus currículos, Verificar ATS, Analisar vaga e Conexões de IA.
- [x] Conexões de IA destacadas como configuração inicial e independentes das ferramentas.
- [x] Retorno da autorização ChatGPT para a central `/conexoes`.
- [ ] Planejar identidade e eventual OAuth Google exclusivamente no Cloud, quando autenticação multitenant estiver pronta.
- [ ] Criar identidade, autorização e isolamento de dados no backend para futuro Cloud.
- [ ] Testes de autenticação multitenant exclusivos da futura plataforma Cloud.

## Alinha Community e Cloud

- [x] Conexão BYOK/conta autorizada ou Ollama no Community e seleção no Studio.
- [x] Contrato de implantação Community/Cloud com inferência Cloud bloqueada até o lançamento seguro.
- [x] Estratégia de monetização proposta: assinatura Cloud com créditos de IA incluídos, sem excedentes automáticos.
- [ ] Medir custos reais por operação/modelo com telemetria sem conteúdo sensível.
- [ ] Autenticação multitenant, isolamento de dados, consentimento LGPD e política de retenção.
- [ ] Ledger de créditos atômico e idempotente, reservas, ajustes, limites por usuário e operador.
- [ ] Avaliar Stripe Billing e Mercado Pago em sandbox, inclusive webhooks assinados e estornos.
- [ ] Validar preços, taxas, câmbio, tributos e economia unitária antes de publicar valores ou habilitar checkout.

## Futuro

Adicionar `en-US` com mensagens traduzíveis mantendo `pt-BR` como idioma padrão. Considerar banco vetorial, RAG e persistência **somente** se justificarem uma funcionalidade real.
