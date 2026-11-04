# Homologação da V3

Roteiro e resultado da homologação em ambiente isolado. Nada aqui é produção: o projeto Supabase é de
desenvolvimento, os dados são fictícios (contas `@homologacao.test`) e a V2 publicada não foi alterada.

## Situação (4/11/2026)

| Etapa | Estado |
| --- | --- |
| Supabase de desenvolvimento | **Feito.** Projeto `barber-studio-v3-homologacao` (plano Free, região São Paulo), migrações e seed fictício aplicados a partir do commit do PR, com checagem de MD5 |
| Testes pela API real (Auth + banco) | **Feito.** 26 verificações; 1 defeito encontrado e corrigido (ver abaixo); a recuperação de senha depende de SMTP |
| Testes pela interface (celular 375 px) | **Feito.** Build do plano profissional apontando para o Supabase de dev |
| SMTP de desenvolvimento | **Bloqueado:** precisa de uma conta num provedor de e-mail (passo 2) |
| Deploy preview na Netlify | **Bloqueado:** precisa ligar a conta da Netlify ao repositório (passo 3) |

### Defeito encontrado na homologação

Lançar atendimentos pelo painel em nome de um cliente contava no limite de **pedidos por hora** do
próprio cliente: depois de 10 lançamentos, ele não conseguia agendar a cortesia gerada
(`limite_hora`). Corrigido no banco (só contam os pedidos feitos pelo cliente) com teste.

## Evidências

### API real (Supabase de dev)

| Verificação | Resultado |
| --- | --- |
| Login com senha errada recusado (`invalid_credentials`) | passou |
| Login com e-mail e senha (cliente, cliente, admin) | passou |
| Conta sem e-mail confirmado não entra (`email_not_confirmed`) | passou |
| Visitante vê o catálogo e não lê perfis nem agendamentos (`42501`) | passou |
| Dias e horários disponíveis | passou |
| Solicitação fica PENDENTE com protocolo | passou |
| Mesma `request_key` repetida e simultânea: mesmo pedido, sem erro | passou |
| Dois clientes no mesmo horário ao mesmo tempo: exatamente um consegue | passou |
| Cliente só vê os próprios dados, não altera os de outra pessoa, não vira admin | passou |
| Cliente não chama funções do painel nem grava agendamento ou pontos direto | passou |
| Admin confirma; o horário sai da agenda pública | passou |
| Expediente com agendamento no caminho: mostra conflito e não salva | passou |
| Bloqueio tira os horários; remover devolve | passou |
| 10 atendimentos concluídos geram 1 corte grátis | passou |
| Cortesia usada uma única vez | passou (depois da correção acima) |
| Cliente não fabrica pontos pela API | passou |
| Desfazer o 10º atendimento: saldo −1, cortesia mantida (política atual) | passou |
| Exportação dos próprios dados e pedido de exclusão | passou |
| Anonimização remove a identificação e bloqueia a conta | passou |
| Login continua no Auth até a exclusão manual (como documentado) | confirmado |
| Exclusão no Auth: perfil e fidelidade apagados em cascata, agenda sem identificação | passou |
| Recuperação de senha | **pendente de SMTP**: o Auth recusa enviar e-mail para domínio de teste |

Security Advisor do Supabase: nenhuma tabela sem RLS e nenhuma função interna exposta. Os avisos
"SECURITY DEFINER executável" são as funções públicas da API, que validam tudo internamente. É
intencional (ver [SEGURANCA-LGPD.md](SEGURANCA-LGPD.md)).

### Interface (Chromium, 375 × 812, contra o Supabase de dev)

| Verificação | Resultado |
| --- | --- |
| Login errado mostra "E-mail ou senha incorretos." | passou |
| Login leva a Minha conta, com cartões ("Faltam 11" depois do estorno) | passou |
| Agendamento completo: serviço → profissional → data → horário → revisão → solicitar | passou |
| Tela "Solicitação registrada… aguarda confirmação", protocolo e WhatsApp sem número (demo) | passou |
| Painel lista o pendente; **Confirmar** registra no histórico quem confirmou | passou |
| Tela de horários carrega o expediente do banco | passou |
| Sem rolagem horizontal e sem erros no console | passou |
| CSP de produção libera só o Supabase do projeto (`connect-src`) | conferido |

Capturas: [`auditoria/v3/homologacao/`](auditoria/v3/homologacao/).

## Como concluir a homologação

### 1. Supabase de desenvolvimento (feito)

Projeto criado no plano Free, em São Paulo. Para repetir num projeto novo:

1. **SQL Editor**: rode, em ordem, `supabase/migrations/…_v3_esquema.sql`, `…_v3_funcoes.sql`,
   `…_v3_permissoes.sql` e, só em dev, `supabase/seed.sql`.
2. **Authentication → URL Configuration**: Site URL = endereço do preview, e em Redirect URLs inclua
   `…/auth/confirmar` e `…/redefinir-senha`.
3. Crie a sua conta pelo site e rode `select public.bootstrap_first_admin('seu-email');`.

Para homologar com usuários de teste sem SMTP, as contas fictícias foram criadas direto em
`auth.users` (só no projeto de dev). Com SMTP configurado, use o cadastro do site.

### 2. SMTP de desenvolvimento (precisa de você)

1. Crie uma conta gratuita num provedor (por exemplo Brevo ou Resend) e verifique um domínio ou o
   remetente de teste.
2. No Supabase: **Authentication → Emails → SMTP Settings → Enable custom SMTP**. Preencha host, porta,
   usuário e senha **no painel**, nunca no repositório.
3. **Authentication → Emails → Templates**: troque o link de "Confirm signup" e de "Reset password"
   pelos modelos com `token_hash` de [HOSPEDAGEM.md](HOSPEDAGEM.md#modelos-de-e-mail-authentication--emails--templates).
4. Me avise: eu rodo o cadastro, a confirmação e a recuperação de senha de ponta a ponta com um e-mail de
   teste do provedor.

### 3. Deploy preview na Netlify (precisa de você)

1. Em [app.netlify.com](https://app.netlify.com), **Add new project → Import an existing project →
   GitHub** e escolha `barber-studio-template`. Use um time Netlify só para homologação.
2. **Branch to deploy**: `feature/v3-agendamento-fidelidade`. Não ligue a `main`: ela segue na Vercel com a V2.
3. **Environment variables** (escopo Builds):
   - `SITE_PLAN` = `profissional`
   - `NEXT_PUBLIC_SUPABASE_URL` = a URL do projeto de dev (Supabase → Project Settings → API)
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = a chave **publishable** (nunca a secreta)
4. Deploy. O `netlify.toml` já define o build e o Node 22.
5. Me mande a URL do deploy: eu valido no endereço publicado os recursos do Next 16 que o projeto usa:
   - páginas pré-renderizadas com Cache Components;
   - 404 real pelo `proxy.ts` em `/servicos/inexistente`;
   - cabeçalhos (CSP, HSTS, `X-Robots-Tag: noindex` fora de produção);
   - `noindex` do deploy de branch;
   - imagens otimizadas e o fluxo completo de agendamento.

### 4. Testes finais

Depois dos passos 2 e 3, repito no endereço da Netlify:

- os testes de interface acima;
- cadastro real com confirmação de e-mail;
- recuperação de senha.

Registro o resultado aqui. O PR #4 continua sem merge até a sua aprovação.

## Custos e limites (dev)

- Supabase Free: R$ 0. Pausa depois de 7 dias sem uso (restaure no painel). 2 projetos ativos por
  organização (o outro projeto da conta está pausado).
- Netlify Free: R$ 0. 300 créditos por mês, e um deploy de produção custa 15. Segundo a Netlify,
  deploy previews não consomem créditos; confira em Team → Usage se o deploy da branch consome.
- SMTP: plano gratuito do provedor escolhido.
- Nenhum serviço pago foi criado.

## Decisões pendentes

- **Fidelidade ao desfazer o 10º atendimento**: a arquitetura recomenda a **opção B** de
  [PROGRAMA-FIDELIDADE.md](PROGRAMA-FIDELIDADE.md), mas a escolha é **comercial** e não foi
  implementada. Segue valendo a opção A.
