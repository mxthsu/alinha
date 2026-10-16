# Acompanhamento de oportunidades no Alinha Community

Este quadro é uma ferramenta **manual de acompanhamento**, não um robô de candidatura. Para abrir, acesse /candidaturas. O usuário pode salvar uma vaga encontrada no Himalayas ou adicionar o link de uma vaga de qualquer portal de emprego, sem que o Alinha acesse ou extraia dados daquele site.

## Funcionalidades disponíveis

- Adicionar manualmente cargo, empresa e URL pública HTTPS, ou salvar a partir da busca existente.
- Evitar duplicidade por URL normalizada e parâmetros conhecidos de rastreamento.
- Organizar as etapas: Salvas, Em preparação, Candidatura informada, Entrevistas, Propostas e Encerradas.
- Mudar status pela interface; nenhum status representa confirmação técnica da plataforma de emprego.
- Salvamento automático no navegador e, opcionalmente, exportação/restauração de backup JSON pelo menu Backup e dados.
- Limpar registros mediante confirmação.

Os cartões permitem abrir Preparar candidatura mantendo título, empresa e URL da vaga na aba atual, sem inventar requisitos ausentes.

## Dados e privacidade

O quadro guarda **apenas** o título da vaga, empresa, origem, link, datas e estágio declarado em localStorage **neste navegador**. Não há conta, sincronização automática, upload ao servidor, consulta do link manual ou processamento com IA. Nenhuma informação de currículo, salário pretendido, resposta de seleção, e-mail ou CPF é armazenada pelo quadro.

Cuidado: localStorage não é criptografado e pode ser acessado por quem utiliza o mesmo perfil do navegador. Não use computadores compartilhados sem limpar a lista. A exportação JSON também não é criptografada: guarde o backup em local seguro. O usuário pode limpar a lista, mas a exclusão de arquivos exportados precisa ser feita por ele.

## Restrições das fontes

O Alinha não faz scraping de Gupy, LinkedIn, Catho, Vagas.com.br, InfoJobs ou similares. O link introduzido manualmente é um **favorito do próprio usuário**; não atribuímos autorização de integração, extração, redistribuição nem candidatura automatizada à plataforma.

Fontes potenciais estudadas:
- Gupy: termos para candidatos restringem agregação e duplicação de vagas; API empresarial exige integração autorizada.
- Adzuna: tem API documentada com credenciais e limites, mas uso comercial continuado pode depender de licença; não ativada.
- Remotive: oferece API pública, porém requer atribuição, limite baixo de chamadas e tem condições específicas de uso, inclusive comercial; não integrada nesta etapa.

Todas as fontes adicionais dependem de revisão jurídica/técnica e permissão compatível com o futuro Alinha Pro. O conector autorizado inicialmente permanece Himalayas para vagas remotas elegíveis a candidatos no Brasil.

## Segurança e testes

Testes locais no frontend (Node 24) verificam links HTTPS, bloqueio de host local, rejeição de credenciais/tokens em URL, deduplicação, estados, limites e integridade do backup. O CI executa esses testes somente na abertura/atualização de PR, juntamente com lint, build e auditorias de dependências.

Próximas fases: sincronização entre dispositivos **com autenticação**, banco de dados com isolamento por titular, LGPD, histórico de mudanças auditável, deduplicação entre fontes com critérios conservadores, integração de plataformas autorizadas e confirmação efetiva de candidaturas. A arquitetura de agentes não pode tomar os status declarados pelo usuário como evidência de envio externo.
