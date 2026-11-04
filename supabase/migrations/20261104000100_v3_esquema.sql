-- V3 · Esquema: agenda, agendamentos, fidelidade, auditoria e privacidade.
-- Uma instância (projeto Supabase) por barbearia: não há coluna de "empresa".
-- Horários são instantes timestamptz; o fuso da barbearia (America/Sao_Paulo) é aplicado
-- nas funções que transformam "dia + hora local" em instante.

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('cliente', 'admin', 'barbeiro');

create type public.appointment_status as enum (
  'pendente',        -- solicitado pelo cliente, aguarda confirmação da barbearia
  'confirmado',      -- confirmado pelo administrador
  'concluido',       -- atendimento realizado (validado pelo administrador)
  'cancelado',
  'nao_compareceu',
  'expirado'         -- pendente que não foi confirmado no prazo
);

-- ---------------------------------------------------------------------------
-- Pessoas
-- ---------------------------------------------------------------------------
-- Dados mínimos do cadastro: nome, telefone e e-mail (a senha fica no Supabase Auth).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 3 and 120),
  phone text not null check (phone ~ '^[0-9]{10,13}$'),
  email text,
  role public.app_role not null default 'cliente',
  marketing_opt_in boolean not null default false,
  marketing_opt_in_at timestamptz,
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'Cadastro mínimo de clientes e administradores. Senha: Supabase Auth.';
comment on column public.profiles.marketing_opt_in is 'Consentimento OPCIONAL e separado para comunicações promocionais.';

-- Profissionais. profile_id prepara um futuro perfil "barbeiro" com login próprio.
create table public.barbers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  active boolean not null default true,
  sort smallint not null default 0,
  profile_id uuid unique references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Serviços (id = mesmo id do site.config.ts, para casar com as páginas da V2)
-- ---------------------------------------------------------------------------
create table public.services (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  price_cents integer check (price_cents is null or price_cents >= 0), -- apenas exibição
  price_from boolean not null default false,
  active boolean not null default true,
  sort smallint not null default 0
);

create table public.barber_services (
  barber_id uuid not null references public.barbers (id) on delete cascade,
  service_id text not null references public.services (id) on delete cascade,
  primary key (barber_id, service_id)
);

-- ---------------------------------------------------------------------------
-- Disponibilidade
-- ---------------------------------------------------------------------------
-- Expediente semanal por profissional. Sem linha para o dia = folga fixa.
create table public.barber_schedules (
  barber_id uuid not null references public.barbers (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = domingo
  start_time time not null,
  end_time time not null,
  break_start time,
  break_end time,
  primary key (barber_id, weekday),
  check (end_time > start_time),
  check ((break_start is null) = (break_end is null)),
  check (break_start is null or (break_start >= start_time and break_end <= end_time and break_end > break_start))
);

-- Folgas, feriados, férias e bloqueios. barber_id nulo = vale para todos.
create table public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid references public.barbers (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  kind text not null check (kind in ('folga', 'feriado', 'ferias', 'bloqueio')),
  reason text check (reason is null or char_length(reason) <= 200),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index schedule_exceptions_range_idx on public.schedule_exceptions using gist (tstzrange(starts_at, ends_at, '[)'));

-- Mesma regra de src/lib/whatsapp.ts (isValidBrazilianWhatsApp): 55 + DDD existente +
-- celular (9 + 8 dígitos) ou fixo (8 dígitos, 2 a 5), recusando padrões de número de exemplo.
create or replace function public.is_valid_br_whatsapp(p text) returns boolean
language plpgsql immutable set search_path = ''
as $$
declare
  m text[];
  rest text;
begin
  m := regexp_match(p, '^55([0-9]{2})(9[0-9]{8}|[2-5][0-9]{7})$');
  if m is null then return false; end if;
  if m[1]::int not in (11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,41,42,43,44,45,46,47,48,49,
                       51,53,54,55,61,62,63,64,65,66,67,68,69,71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,
                       91,92,93,94,95,96,97,98,99) then
    return false;
  end if;
  rest := case when char_length(m[2]) = 9 then substr(m[2], 2) else m[2] end;
  if rest ~ '^(.)\1+$' then return false; end if;                     -- todos os dígitos iguais
  if position(rest in '0123456789012345') > 0 then return false; end if; -- sequência crescente
  if position(rest in '9876543210987654') > 0 then return false; end if; -- sequência decrescente
  return true;
end $$;

-- Configurações operacionais (uma linha). Editáveis no painel, sem deploy.
create table public.business_settings (
  id smallint primary key default 1 check (id = 1),
  business_name text not null default 'Barbearia',
  -- Vazio = links de WhatsApp sem destinatário (demonstração). Formato: 55 + DDD + número.
  whatsapp text not null default '' check (whatsapp = '' or public.is_valid_br_whatsapp(whatsapp)),
  min_notice_minutes integer not null default 120 check (min_notice_minutes between 0 and 10080),
  max_days_ahead integer not null default 30 check (max_days_ahead between 1 and 180),
  slot_step_minutes integer not null default 15 check (slot_step_minutes in (5, 10, 15, 20, 30, 60)),
  pending_expiry_hours integer not null default 24 check (pending_expiry_hours between 1 and 168),
  max_active_requests integer not null default 3 check (max_active_requests between 1 and 20),
  max_requests_per_hour integer not null default 6 check (max_requests_per_hour between 1 and 60),
  customer_cancel_notice_minutes integer not null default 60 check (customer_cancel_notice_minutes between 0 and 10080),
  reward_lost_on_no_show boolean not null default true,
  loyalty_program_name text not null default 'Clube de Fidelidade' check (char_length(loyalty_program_name) <= 60),
  updated_at timestamptz not null default now()
);
insert into public.business_settings (id) values (1);

-- ---------------------------------------------------------------------------
-- Agendamentos
-- ---------------------------------------------------------------------------
create or replace function public.new_protocol() returns text
language sql volatile set search_path = ''
as $$
  -- 6 caracteres sem ambiguidade (sem 0/O, 1/I/L): ~887 milhões de combinações.
  select string_agg(substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', 1 + (get_byte(b, i) % 31), 1), '')
  from (select decode(md5(gen_random_uuid()::text), 'hex') as b) x, generate_series(0, 5) i
$$;

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  protocol text not null unique default public.new_protocol(),
  customer_id uuid references public.profiles (id) on delete set null,
  -- Agendamento manual de quem não tem conta (sem fidelidade).
  guest_name text check (guest_name is null or char_length(btrim(guest_name)) between 2 and 120),
  guest_phone text check (guest_phone is null or guest_phone ~ '^[0-9]{10,13}$'),
  barber_id uuid not null references public.barbers (id),
  service_id text not null references public.services (id),
  -- Cópia do serviço no momento da solicitação (o serviço pode mudar depois).
  service_name text not null,
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'pendente',
  is_reward boolean not null default false,
  request_key uuid unique,
  notes text check (notes is null or char_length(notes) <= 500),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- Trava definitiva contra conflito: o mesmo profissional não pode ter dois
  -- agendamentos ativos que se sobreponham, mesmo com requisições simultâneas.
  constraint appointments_no_overlap exclude using gist (
    barber_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pendente', 'confirmado', 'concluido'))
);
create index appointments_customer_idx on public.appointments (customer_id, starts_at desc);
create index appointments_starts_idx on public.appointments (starts_at);
create index appointments_pending_idx on public.appointments (created_at) where status = 'pendente';

-- Histórico imutável de mudanças de status.
create table public.appointment_status_history (
  id bigint generated always as identity primary key,
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  from_status public.appointment_status,
  to_status public.appointment_status not null,
  changed_by uuid,
  reason text,
  created_at timestamptz not null default now()
);
create index appointment_status_history_appt_idx on public.appointment_status_history (appointment_id, created_at);

-- ---------------------------------------------------------------------------
-- Fidelidade
-- ---------------------------------------------------------------------------
-- Uma regra = um cartão. Serviços elegíveis em lista: permite campanhas que misturem serviços.
create table public.loyalty_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  threshold integer not null default 10 check (threshold between 1 and 100),
  eligible_service_ids text[] not null check (cardinality(eligible_service_ids) > 0),
  reward_service_id text not null references public.services (id),
  active boolean not null default true,
  sort smallint not null default 0,
  created_at timestamptz not null default now()
);

-- Recompensas geradas. Uma recompensa reserva no máximo um agendamento por vez.
create table public.loyalty_rewards (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  rule_id uuid not null references public.loyalty_rules (id),
  status text not null default 'disponivel'
    check (status in ('disponivel', 'reservado', 'resgatado', 'perdido', 'cancelado')),
  appointment_id uuid unique references public.appointments (id) on delete set null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  check (status <> 'reservado' or appointment_id is not null)
);
create index loyalty_rewards_customer_idx on public.loyalty_rewards (customer_id, status);

-- Livro-razão de fidelidade: só inserções. O saldo é a soma de "delta".
create table public.loyalty_entries (
  id bigint generated always as identity primary key,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  rule_id uuid not null references public.loyalty_rules (id),
  appointment_id uuid references public.appointments (id) on delete set null,
  reward_id uuid references public.loyalty_rewards (id) on delete set null,
  delta integer not null check (delta <> 0),
  kind text not null check (kind in ('atendimento', 'estorno', 'recompensa_gerada', 'ajuste', 'recompensa_cancelada')),
  reason text check (reason is null or char_length(reason) <= 300),
  created_by uuid,
  created_at timestamptz not null default now()
);
create index loyalty_entries_customer_rule_idx on public.loyalty_entries (customer_id, rule_id);
create index loyalty_entries_appointment_idx on public.loyalty_entries (appointment_id) where appointment_id is not null;

-- ---------------------------------------------------------------------------
-- Auditoria e privacidade
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('acesso', 'correcao', 'exclusao', 'revogacao_consentimento', 'outro')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'aberta' check (status in ('aberta', 'em_andamento', 'concluida', 'recusada')),
  resolution text check (resolution is null or char_length(resolution) <= 1000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid
);
