# Homologação da V3

Ambiente isolado: projeto Supabase de **desenvolvimento** com dados fictícios e deploy de branch na
Netlify. A V2 publicada não é alterada, e nada aqui é produção.

## Situação

| Etapa | Estado |
| --- | --- |
| Código da V3 simplificada | Pronto na branch do PR #4 (testes de banco, de tela e build passando) |
| Supabase de desenvolvimento (`barber-studio-v3-homologacao`, Free, São Paulo) | **Com o esquema anterior** (login de cliente). Precisa ser recriado com as migrations atuais: **aguarda autorização** |
| Interface no celular | Validada contra servidor simulado (capturas em [`auditoria/v3/`](auditoria/v3/)). A validação contra o Supabase real fica para depois da recriação |
| Netlify (`oseiasbarber.netlify.app`) | O deploy da branch funciona (404 real do `proxy.ts`, CSP, `noindex`). **Faltam as variáveis do Supabase**, por isso `/agendar` e `/admin` dão 404 |
| SMTP | **Não é mais necessário** (modelo sem conta de cliente) |

## Rodada anterior (modelo com login de cliente, 4/11/2026)

Feita com a versão anterior do PR, que tinha cadastro de cliente. Ela validou na API real:
- RLS e bloqueio de funções;
- concorrência: dois pedidos simultâneos, exatamente um passa;
- idempotência;
- conflitos de expediente;
- fidelidade (10 → 1, cortesia única, estorno);
- exclusão em cascata.

O defeito que ela encontrou (limite de pedidos por hora) pertencia ao pedido do cliente com login, que
não existe mais. As regras de agenda, concorrência e fidelidade continuam as mesmas e cobertas pelos
testes de banco.

## Recriar o projeto de desenvolvimento (precisa de autorização)

**Antes**:
1. Confirmar o projeto: `barber-studio-v3-homologacao` (ref `pmuaxqphujkjrekewraf`), organização de
   desenvolvimento, plano Free. **Não é o `freelance-radar`.**
2. Confirmar que só há dados sintéticos: contas `@homologacao.test` e clientes e agendamentos de teste.
3. Recuperação: o esquema anterior está no histórico do PR, no commit `0ceba97`. Não há dados reais a
   preservar.

**Procedimento** (SQL Editor ou MCP):
1. Remover o esquema da versão anterior: tabelas, funções e tipos da V3 em `public`, os gatilhos
   `on_auth_user_created`/`on_auth_user_email_changed` em `auth.users` e os usuários de teste
   `@homologacao.test`.
2. Aplicar, em ordem, `…_v3_esquema.sql`, `…_v3_funcoes.sql`, `…_v3_permissoes.sql` e `seed.sql`, do
   commit atual do PR (com conferência de MD5).
3. Authentication: **desligar "Allow new users to sign up"**.
4. Criar duas contas de teste da equipe (Add user, Auto Confirm) e rodar `bootstrap_first_admin` na
   primeira.
5. Advisors → Security.

## Netlify

Em **Site configuration → Environment variables** do site `oseiasbarber` (só a branch
`feature/v3-agendamento-fidelidade`):

| Variável | Valor |
| --- | --- |
| `SITE_PLAN` | `profissional` |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto de dev (Supabase → Project Settings → API) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | chave **publishable** (nunca a secreta) |

Depois de salvar, é preciso um **novo deploy**: as variáveis `NEXT_PUBLIC_*` entram no build.

## Testes finais (depois da recriação e das variáveis)

No endereço da Netlify, com dados fictícios:
1. **Visitante (celular)**: serviço → profissional → data → horário livre → nome e telefone → mensagem
   pronta. Confirmar que nada é gravado no banco e que não há cookies nem armazenamento no navegador.
2. **Equipe**:
   - login;
   - cadastrar cliente, inclusive com telefone repetido;
   - registrar agendamento, que some da agenda pública;
   - registrar atendimento no balcão, que conta ponto;
   - completar 10 atendimentos, ver a cortesia gerada e usá-la uma única vez;
   - desfazer com motivo;
   - exportar e excluir o cliente;
   - registrar um pedido de privacidade.
3. **Agenda**: expediente com conflito (manter ou cancelar), feriado global e dois aparelhos registrando o
   mesmo horário.
4. **Next 16 na Netlify**: 404 real em `/servicos/inexistente`, páginas pré-renderizadas, CSP com o
   Supabase do projeto e `noindex` no deploy de branch.
5. Regressão da V2.

## Custos e limites (dev)

- Supabase Free: R$ 0, com pausa após 7 dias sem uso e 2 projetos ativos por organização.
- Netlify Free: R$ 0, com 300 créditos por mês.
- Sem SMTP, sem SMS, sem serviço pago.

## Decisões pendentes

- **Fidelidade ao desfazer o 10º atendimento**: a opção B de [PROGRAMA-FIDELIDADE.md](PROGRAMA-FIDELIDADE.md)
  é a recomendada, mas **aguarda validação comercial**. Segue valendo a opção A.
- **TOTP para administradores**: avaliado em [SEGURANCA-LGPD.md](SEGURANCA-LGPD.md). É a próxima melhoria
  recomendada.
