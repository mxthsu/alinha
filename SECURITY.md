# Segurança

O Alinha está em desenvolvimento ativo. Agradecemos relatos responsáveis de problemas de segurança.

## Versões suportadas

Não existe uma versão estável de produção publicada. O código da branch principal recebe correções durante o desenvolvimento; **não há garantia de segurança para hospedagem pública ou processamento de dados sensíveis**.

## Como reportar uma vulnerabilidade

Não divulgue vulnerabilidades, tokens, currículos reais ou dados pessoais em issues públicas.

Use a área **Security** do [repositório](https://github.com/mxthsu/alinha/security) e, caso esteja habilitada, a opção **Report a vulnerability** para enviar um aviso privado pelo GitHub. Se o envio privado não estiver disponível, não publique detalhes de exploração ou segredos em discussões abertas.

Para bugs sem implicação de segurança, utilize o [formulário de issue](https://github.com/mxthsu/alinha/issues/new/choose).

## Princípios de segurança

- Credenciais nunca devem aparecer em variáveis públicas do Next.js, commits, screenshots ou logs.
- O conteúdo de currículos e vagas deve ser tratado como **entrada não confiável**.
- O backend deve limitar tamanho, tipos de arquivo e utilização de provedores.
- A edição local utiliza serviços vinculados à interface loopback.
- Fluxos de autenticação de provedores devem seguir apenas métodos oficialmente autorizados.
- A edição Cloud não será lançada sem autenticação, proteção contra abuso, medição de consumo, retenção e política de privacidade.
- Testes de segurança e exemplos devem utilizar **dados sintéticos**.

Este documento não constitui certificação, auditoria de segurança ou promessa de tratamento de dados em produção.
