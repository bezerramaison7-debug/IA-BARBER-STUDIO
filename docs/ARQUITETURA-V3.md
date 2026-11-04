# Arquitetura da V3 (simplificada)

A V3 acrescenta ao site da V2 uma agenda online, um painel da barbearia e o programa de fidelidade.
Ela foi pensada para uma barbearia de bairro: **o cliente não cria conta**. Ele consulta os horários
livres e manda o pedido pelo WhatsApp, e quem registra tudo é a barbearia, pelo painel.

O sistema só liga quando **duas condições** são verdadeiras:

| Condição | Onde |
| --- | --- |
| Plano com `onlineBooking` (hoje: `profissional`) | `plan` no `site.config.ts` ou `SITE_PLAN` no build |
| Supabase configurado | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ou `..._ANON_KEY`) |

Sem as duas, as rotas da V3 respondem 404 e o site é o mesmo da V2 (`isBookingSystemEnabled` em
`src/lib/plan.ts`).

## Visão geral

```
Visitante (sem conta)                         Equipe (login e-mail/senha)
  /agendar: serviço → profissional → data       /admin: hoje, agenda, horários, clientes,
  → horário livre → nome e telefone             configurações, privacidade
  → link wa.me com a mensagem                   │
  │  só LEITURA (catálogo e horários livres)    │  leitura e escrita pelas funções do banco
  ▼                                             ▼
Supabase: Postgres com RLS em todas as tabelas + funções SECURITY DEFINER (todas as regras)
          Auth só para a equipe (cadastro público desligado, sem SMTP)
```

- **Nenhuma gravação pública.** Não existe função que reserve horário ou crie cliente sem login.
  Nome e telefone do visitante não vão para o banco: seguem só na mensagem do WhatsApp.
- **Não há servidor próprio.** O navegador fala direto com o Supabase usando a chave pública. Toda regra
  está no banco, então uma chamada "por fora" do site encontra as mesmas barreiras.
- As páginas da V3 (`src/app/(sistema)/`) são estáticas e buscam os dados no cliente, com `noindex`.

## Banco de dados (`supabase/migrations/`)

| Arquivo | Conteúdo |
| --- | --- |
| `20261104000100_v3_esquema.sql` | Tipos e 15 tabelas, com restrições (inclusive a que impede sobreposição) |
| `20261104000200_v3_funcoes.sql` | Regras: disponibilidade, registro pelo painel, status, fidelidade, clientes, LGPD |
| `20261104000300_v3_permissoes.sql` | Revoga tudo, liga RLS em todas as tabelas e concede o mínimo |
| `seed.sql` | Dados fictícios da demonstração (nunca dados reais) |

> As três migrations da V3 foram **reescritas no lugar** ao simplificar o produto (novembro de 2026).
> Elas nunca rodaram em produção, só num projeto de homologação com dados sintéticos. Depois que
> estiverem num projeto real, qualquer mudança vira uma migration nova.

Tabelas: `profiles` (equipe), `customers` (clientes cadastrados pela barbearia), `barbers`, `services`,
`barber_services`, `barber_schedules`, `schedule_exceptions`, `business_settings` (linha única),
`appointments`, `appointment_status_history`, `loyalty_rules`, `loyalty_entries`, `loyalty_rewards`,
`audit_logs`, `privacy_requests`.

Decisões:

- **Conflito de horário impossível por construção**: restrição de exclusão `appointments_no_overlap`
  (`btree_gist`, intervalo `[início, fim)` por profissional), mais trava por profissional, sempre na
  mesma ordem (`_lock_barbers`), em toda operação que mexe na agenda. Ver [AGENDA-REGRAS.md](AGENDA-REGRAS.md).
- **Idempotência**: o painel manda uma `request_key` por registro, e um toque duplo devolve o mesmo
  agendamento.
- **Clientes sem login**: `customers` guarda nome, telefone normalizado (DDD + número) e observações.
  O telefone **não é único** (família, número que mudou de dono) e **não autentica ninguém**: a ficha
  mostra quem divide o número, e o administrador decide. Nada é juntado sozinho.
- **Fuso**: tudo em UTC, calculado em `America/Sao_Paulo`.
- **Erros legíveis**: `public._fail(código, mensagem em pt-BR)`.
- **Fidelidade por livro-razão imutável** (`loyalty_entries`). Ver [PROGRAMA-FIDELIDADE.md](PROGRAMA-FIDELIDADE.md).
- **Auditoria imutável** (`audit_logs`). O cadastro de clientes é auditado **sem copiar nome ou
  telefone** para o log, que não pode ser apagado depois.

## Aplicação (`src/`)

| Caminho | Papel |
| --- | --- |
| `src/lib/booking/` | Lógica pura com testes: datas, mensagem do WhatsApp, validação de nome e telefone, erros, `api.ts` |
| `src/lib/supabase/client.ts` | Cliente único do Supabase (sessão só da equipe; sem links de e-mail) |
| `src/config/texts-app.ts` | Textos da V3 |
| `src/components/app/booking-flow.tsx` | Pedido público (sem login, sem gravação) |
| `src/components/app/admin-*.tsx`, `customer-picker.tsx` | Painel |
| `src/app/(sistema)/` | `/agendar`, `/entrar` (equipe) e `/admin/*` |
| `src/app/privacidade`, `cookies`, `termos` | Políticas, com o texto do modelo sem conta quando o sistema está ligado |

## Papéis

| Papel | Pode |
| --- | --- |
| Visitante (`anon`) | Ver serviços, profissionais, expediente e horários livres. Nenhum dado pessoal, nenhuma gravação. |
| Conta da equipe sem acesso (`sem_acesso`) | Só o próprio perfil. Nasce assim ao ser criada no Supabase. |
| Administrador (`admin`) | Painel completo. O papel é conferido no banco (`is_admin()`). |

O primeiro administrador é definido pelo SQL Editor (`bootstrap_first_admin`). Os demais são liberados
pelo painel, em Configurações → Acesso ao painel. Ver [SEGURANCA-LGPD.md](SEGURANCA-LGPD.md).

## Uma instância por cliente

Cada barbearia tem o próprio repositório, o próprio projeto Supabase e a própria hospedagem.

## Fora do escopo

- Login de cliente, SMTP ou SMS.
- Pagamentos de qualquer tipo, gestão de caixa, comissões e estoque.
- Mensageria automática paga, app nativo e IA.
