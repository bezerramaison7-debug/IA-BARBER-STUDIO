# Arquitetura da V3: contas, agenda, WhatsApp e fidelidade

A V3 adiciona, ao site da V2, um sistema de agendamento com contas de cliente, painel da barbearia e
programa de fidelidade. A V2 continua igual: o sistema só liga quando **duas condições** são verdadeiras.

| Condição | Onde |
| --- | --- |
| Plano com `onlineBooking` (hoje: `profissional`) | `plan` no `site.config.ts` ou `SITE_PLAN` no build |
| Supabase configurado | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ou `..._ANON_KEY`) |

Sem as duas, as rotas da V3 respondem 404 e a home é a mesma da V2 (`isBookingSystemEnabled` em
`src/lib/plan.ts`). A demonstração pública segue no plano premium, sem Supabase.

## Visão geral

```
Navegador (Next.js, páginas pré-renderizadas)
  │  chave pública (anon/publishable) + sessão do usuário
  ▼
Supabase
  ├─ Auth: cadastro, login, confirmação de e-mail, recuperação de senha
  └─ Postgres: tabelas com RLS + funções SECURITY DEFINER com todas as regras
```

- **Não há servidor próprio nem API intermediária.** O navegador chama o Supabase diretamente com a
  chave pública. Toda regra de negócio está no banco, então uma chamada "por fora" do site encontra as
  mesmas barreiras.
- As páginas da V3 (`src/app/(sistema)/`) são estáticas e buscam os dados no cliente. Isso respeita o
  `cacheComponents` (nada de `Date.now()` no servidor) e funciona em hospedagem gratuita sem funções.
- `noindex` em todas as páginas do sistema (conta, painel, agendamento).

## Banco de dados (`supabase/migrations/`)

| Arquivo | Conteúdo |
| --- | --- |
| `20261104000100_v3_esquema.sql` | Tipos, 14 tabelas, restrições (inclusive a que impede sobreposição) |
| `20261104000200_v3_funcoes.sql` | Regras: disponibilidade, solicitação, status, fidelidade, painel, LGPD |
| `20261104000300_v3_permissoes.sql` | Revoga tudo, liga RLS em todas as tabelas e concede o mínimo |
| `seed.sql` | Dados fictícios da demonstração (nunca dados reais) |

Tabelas principais: `profiles`, `barbers`, `services`, `barber_services`, `barber_schedules`,
`schedule_exceptions`, `business_settings` (linha única), `appointments`, `appointment_status_history`,
`loyalty_rules`, `loyalty_entries`, `loyalty_rewards`, `audit_logs`, `privacy_requests`.

Decisões:

- **Conflito de horário impossível por construção**: restrição de exclusão `appointments_no_overlap`
  (`btree_gist`, intervalo `[início, fim)` por profissional, status pendente/confirmado/concluído), mais
  trava por profissional (`pg_advisory_xact_lock`) durante a solicitação. Duas pessoas no mesmo segundo:
  uma consegue, a outra recebe "horário acabou de ser reservado".
- **Idempotência**: cada solicitação leva uma `request_key` (UUID gerado na tela). Clique duplo ou
  reenvio devolve o mesmo agendamento.
- **Fuso**: tudo é gravado em UTC e calculado em `America/Sao_Paulo`.
- **Erros legíveis**: as funções falham com `public._fail(código, mensagem)`. A mensagem já vem em
  português e o código (`hint`) permite à tela reagir (ex.: `ocupado` volta para a escolha de horário).
- **Expiração preguiçosa**: pendentes vencidos são expirados no início das funções de agenda
  (`expire_stale_appointments`), sem depender de tarefa agendada (que o plano gratuito não garante).
- **Fidelidade por livro-razão**: `loyalty_entries` só aceita inserção (gatilho de imutabilidade).
  Pontos são lançados por gatilho quando o status muda para concluído e estornados se a conclusão for
  desfeita. Detalhes em [PROGRAMA-FIDELIDADE.md](PROGRAMA-FIDELIDADE.md).
- **Auditoria**: alterações de configuração, status, ajustes de pontos e acessos à ficha do cliente vão
  para `audit_logs`, também imutável.

## Aplicação (`src/`)

| Caminho | Papel |
| --- | --- |
| `src/lib/booking/` | Lógica pura com testes: datas, mensagem do WhatsApp, erros, regras de tela, `api.ts` (chamadas ao Supabase) |
| `src/lib/supabase/client.ts` | Cliente único do Supabase no navegador |
| `src/config/texts-app.ts` | Todos os textos de interface da V3 |
| `src/components/app/` | Formulários de conta, fluxo de agendamento, Minha conta, painel |
| `src/app/(sistema)/` | Rotas: `/entrar`, `/cadastro`, `/recuperar-senha`, `/redefinir-senha`, `/auth/confirmar`, `/agendar`, `/minha-conta`, `/admin/*` |
| `src/app/privacidade`, `cookies`, `termos` | Políticas, que mudam de texto quando o sistema está ligado |

Fluxo de agendamento (`/agendar`): serviço → profissional (ou "sem preferência") → data → horário →
revisão → solicitar. As escolhas ficam na URL, então entrar ou criar conta no meio do caminho não perde
nada. Ver [AGENDA-REGRAS.md](AGENDA-REGRAS.md) e [FLUXO-WHATSAPP.md](FLUXO-WHATSAPP.md).

## Papéis

| Papel | Pode |
| --- | --- |
| Visitante (`anon`) | Ver serviços, profissionais, expediente e horários livres. Nenhum dado pessoal. |
| Cliente (`cliente`) | Os próprios dados, agendamentos, cartões e pedidos de privacidade |
| Administrador (`admin`) | Painel completo. O papel é conferido no banco (`is_admin()`), não na tela |
| `barbeiro` | Reservado para uma fase futura (agenda do próprio profissional); hoje sem permissões extras |

O primeiro administrador é criado uma única vez pelo SQL Editor do Supabase
(`select public.bootstrap_first_admin('email@da-barbearia')`). Depois disso, novos administradores são
promovidos pelo painel. Ver [SEGURANCA-LGPD.md](SEGURANCA-LGPD.md).

## Uma instância por cliente

Cada barbearia tem o próprio repositório (cópia do template), o próprio projeto Supabase e a própria
hospedagem. Não há banco compartilhado entre clientes: isso simplifica a LGPD (um controlador por base)
e evita que um erro de permissão exponha dados de outra barbearia.

## Fora do escopo (decisão do pedido da V3)

Pagamentos de qualquer tipo (checkout, Pix, cartão, carteira), gestão de caixa, comissões, estoque,
mensageria automática paga, aplicativo nativo e IA. O WhatsApp é só um link `wa.me` com texto pronto.
