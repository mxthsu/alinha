# Descoberta de vagas no Alinha Community

> Recurso experimental. A fonte inicial é a API pública do Himalayas, restrita a vagas remotas elegíveis a candidaturas a partir do Brasil. O Alinha não faz envios automáticos nesta etapa.

## Como usar

1. Abra **Encontrar vagas** (/vagas), informe o cargo e pesquise.
2. Ajuste as preferências: modalidade, contrato, cidade e salário mínimo.
3. Veja oportunidades reais com empresa, resumo e link de origem.
4. Revise cada informação desconhecida na plataforma da vaga. Um vínculo Full Time estrangeiro **não** é equivalente a CLT, e um salário anual em USD não é salário mensal em BRL.
5. Abra o link original do Himalayas ou use **Preparar candidatura** para comparar a vaga com o currículo.

As preferências permanecem apenas na memória da página, sem autenticação ou armazenamento persistente. A fonte atual não cobre vagas híbridas ou presenciais. Preferências de cidade, contrato CLT/PJ e salário não são filtros confiáveis nesta fonte, portanto aparecem como **a confirmar**, sem afirmar correspondência. Novos conectores só devem ser adicionados após revisão dos termos e permissões.

## Fonte, atribuição e segurança

Documentação da API: https://himalayas.app/docs/remote-jobs-api

Himalayas exige crédito visível ao site e que os links de candidatura utilizem o campo applicationLink fornecido. Não redistribuir essas vagas para outros agregadores. O feed possui atualização aproximadamente diária, e a disponibilidade pode variar.

- Somente o backend consulta um endpoint fixo HTTPS em himalayas.app; **não existe proxy de URLs arbitrárias**.
- Redirecionamentos não são seguidos. Há limite de tamanho de resposta, tempo de espera e orçamento de consultas por minuto.
- Links recebidos só são expostos se forem HTTPS do domínio oficial e tiverem caminho esperado de vaga.
- A API local exige origem confiável e acesso via loopback. A versão Cloud pública permanece bloqueada.
- Não há acesso a credenciais de candidatura, armazenamento de currículos nem submissões automáticas.

## Evoluções

Construir filtros e preferências persistentes somente com consentimento, deduplicação, ranking explicável, novos conectores permitidos, Kanban, respostas confirmadas e candidaturas assistidas. Não automatizar CAPTCHA, MFA ou ações contra termos de plataformas.

Testes sintéticos: apps/api/tests/test_jobs_discovery.py.
Regras do agente: docs/agent-application-contract.md.
Segurança: docs/security-review.md.
