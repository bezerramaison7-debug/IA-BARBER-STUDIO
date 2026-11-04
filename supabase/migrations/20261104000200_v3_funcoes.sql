-- V3 · Regras de negócio no banco: perfis, auditoria, disponibilidade, agendamento,
-- transições de status, fidelidade e privacidade.
--
-- Convenções:
-- - Funções chamadas pelo navegador são SECURITY DEFINER com search_path vazio e nomes
--   totalmente qualificados. Cada uma verifica quem chama (auth.uid() / is_admin()).
-- - Erros de negócio: message = texto para a pessoa (pt-BR); hint = código estável para o app.
-- - Fuso da barbearia: America/Sao_Paulo.

-- ---------------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------------
create or replace function public._fail(p_code text, p_message text) returns void
language plpgsql set search_path = ''
as $$ begin raise exception using message = p_message, hint = p_code, errcode = 'P0001'; end $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.anonymized_at is null
  )
$$;

create or replace function public._require_admin() returns void
language plpgsql stable set search_path = ''
as $$
begin
  if not public.is_admin() then
    perform public._fail('sem_permissao', 'Acesso restrito à administração da barbearia.');
  end if;
end $$;

create or replace function public._require_customer() returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare v_id uuid := auth.uid();
begin
  if v_id is null then
    perform public._fail('nao_autenticado', 'Entre na sua conta para continuar.');
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_id and p.anonymized_at is null) then
    perform public._fail('conta_indisponivel', 'Esta conta não está disponível.');
  end if;
  return v_id;
end $$;

create or replace function public._log(p_action text, p_entity text, p_entity_id text, p_details jsonb default '{}'::jsonb)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb))
$$;

create or replace function public._touch_updated_at() returns trigger
language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public._touch_updated_at();
create trigger appointments_touch before update on public.appointments for each row execute function public._touch_updated_at();
create trigger settings_touch before update on public.business_settings for each row execute function public._touch_updated_at();

-- Registros que não podem ser alterados nem apagados (nem pelo administrador).
create or replace function public._immutable() returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception using message = 'Registro imutável: crie um lançamento de correção.', hint = 'imutavel', errcode = 'P0001';
end $$;

create trigger loyalty_entries_immutable before update or delete on public.loyalty_entries
  for each row execute function public._immutable();
create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function public._immutable();
create trigger status_history_immutable before update or delete on public.appointment_status_history
  for each row execute function public._immutable();

-- Auditoria genérica das tabelas de configuração alteradas pelo painel.
create or replace function public._audit_config_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_id text;
begin
  v_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id', to_jsonb(new) ->> 'barber_id', to_jsonb(old) ->> 'barber_id');
  perform public._log(lower(tg_op), tg_table_name, v_id,
    jsonb_build_object('antes', case when tg_op <> 'INSERT' then to_jsonb(old) end,
                       'depois', case when tg_op <> 'DELETE' then to_jsonb(new) end));
  return coalesce(new, old);
end $$;

create trigger audit_barbers after insert or update or delete on public.barbers for each row execute function public._audit_config_change();
create trigger audit_services after insert or update or delete on public.services for each row execute function public._audit_config_change();
create trigger audit_barber_services after insert or delete on public.barber_services for each row execute function public._audit_config_change();
create trigger audit_settings after update on public.business_settings for each row execute function public._audit_config_change();
create trigger audit_loyalty_rules after insert or update or delete on public.loyalty_rules for each row execute function public._audit_config_change();
create trigger audit_schedules after insert or update or delete on public.barber_schedules for each row execute function public._audit_config_change();
create trigger audit_exceptions after insert or update or delete on public.schedule_exceptions for each row execute function public._audit_config_change();

-- ---------------------------------------------------------------------------
-- Perfis
-- ---------------------------------------------------------------------------
-- Cria o perfil no cadastro (Supabase Auth). Valida no servidor os dados do formulário:
-- se nome ou telefone forem inválidos, o cadastro inteiro é recusado.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  v_phone text := regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', ''), '[^0-9]', '', 'g');
begin
  if char_length(v_name) < 3 or char_length(v_name) > 120 then
    raise exception using message = 'Informe o nome completo.', hint = 'cadastro_nome', errcode = 'P0001';
  end if;
  if v_phone !~ '^[0-9]{10,13}$' then
    raise exception using message = 'Informe um telefone com DDD.', hint = 'cadastro_telefone', errcode = 'P0001';
  end if;
  insert into public.profiles (id, full_name, phone, email)
  values (new.id, v_name, v_phone, new.email);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- Defesa extra: o papel só muda pelas funções administrativas.
create or replace function public._guard_profile_update() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.role is distinct from old.role and coalesce(current_setting('app.role_change', true), '') <> 'on' then
    raise exception using message = 'O perfil de acesso não pode ser alterado por aqui.', hint = 'sem_permissao', errcode = 'P0001';
  end if;
  if new.marketing_opt_in is distinct from old.marketing_opt_in then
    new.marketing_opt_in_at := case when new.marketing_opt_in then now() end;
  end if;
  new.phone := regexp_replace(new.phone, '[^0-9]', '', 'g');
  return new;
end $$;

create trigger profiles_guard before update on public.profiles for each row execute function public._guard_profile_update();

-- Primeiro administrador: só pelo SQL Editor do Supabase (papel postgres). Sem EXECUTE para o app.
create or replace function public.bootstrap_first_admin(p_email text) returns text
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if exists (select 1 from public.profiles where role = 'admin') then
    raise exception 'Já existe um administrador. Use o painel para conceder acesso a outras pessoas.';
  end if;
  select id into v_id from public.profiles where lower(email) = lower(btrim(p_email));
  if v_id is null then
    raise exception 'Nenhuma conta com este e-mail. Crie a conta pelo site primeiro.';
  end if;
  perform set_config('app.role_change', 'on', true);
  update public.profiles set role = 'admin' where id = v_id;
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (null, 'bootstrap_admin', 'profiles', v_id::text, '{}'::jsonb);
  return 'Administrador definido.';
end $$;

create or replace function public.admin_set_role(p_user_id uuid, p_role public.app_role) returns void
language plpgsql security definer set search_path = ''
as $$
declare v_old public.app_role;
begin
  perform public._require_admin();
  select role into v_old from public.profiles where id = p_user_id for update;
  if not found then perform public._fail('nao_encontrado', 'Conta não encontrada.'); end if;
  if v_old = 'admin' and p_role <> 'admin'
     and (select count(*) from public.profiles where role = 'admin' and anonymized_at is null) <= 1 then
    perform public._fail('ultimo_admin', 'É preciso manter ao menos um administrador.');
  end if;
  perform set_config('app.role_change', 'on', true);
  update public.profiles set role = p_role where id = p_user_id;
  perform public._log('alterar_perfil', 'profiles', p_user_id::text, jsonb_build_object('de', v_old, 'para', p_role));
end $$;

-- ---------------------------------------------------------------------------
-- Disponibilidade
-- ---------------------------------------------------------------------------
-- Pendentes deixam de segurar o horário quando passam do prazo ou do próprio horário.
create or replace function public.expire_stale_appointments() returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_hours integer;
  v_count integer;
begin
  select pending_expiry_hours into v_hours from public.business_settings where id = 1;
  perform set_config('app.status_reason', 'Expirado automaticamente (não confirmado a tempo).', true);
  with expired as (
    update public.appointments a
    set status = 'expirado'
    where a.status = 'pendente'
      and (a.created_at < now() - make_interval(hours => v_hours) or a.starts_at <= now())
    returning 1
  )
  select count(*) into v_count from expired;
  perform set_config('app.status_reason', '', true); -- não vaza para mudanças seguintes
  return v_count;
end $$;

-- Motivo pelo qual um intervalo não pode ser usado (null = livre).
-- p_client_rules: antecedência mínima e limite futuro (regras do cliente).
-- p_check_busy: considera outros agendamentos ativos.
create or replace function public._slot_problem(
  p_barber_id uuid, p_start timestamptz, p_end timestamptz,
  p_ignore_appointment uuid default null, p_client_rules boolean default true, p_check_busy boolean default true
) returns text
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  tz constant text := 'America/Sao_Paulo';
  s record;
  sch record;
  v_local_start timestamp := p_start at time zone tz;
  v_local_end timestamp := p_end at time zone tz;
  v_day date := (p_start at time zone tz)::date;
begin
  select * into s from public.business_settings where id = 1;

  if p_start <= now() then return 'passado'; end if;
  if p_client_rules then
    if p_start < now() + make_interval(mins => s.min_notice_minutes) then return 'antecedencia'; end if;
    if v_day > (now() at time zone tz)::date + s.max_days_ahead then return 'limite_futuro'; end if;
  end if;

  if not exists (select 1 from public.barbers b where b.id = p_barber_id and b.active) then
    return 'profissional_inativo';
  end if;

  select * into sch from public.barber_schedules bs
  where bs.barber_id = p_barber_id and bs.weekday = extract(dow from v_local_start)::smallint;
  if not found then return 'fora_expediente'; end if;
  if v_local_end::date <> v_day
     or v_local_start::time < sch.start_time
     or v_local_end::time > sch.end_time then
    return 'fora_expediente';
  end if;
  if sch.break_start is not null
     and v_local_start::time < sch.break_end and v_local_end::time > sch.break_start then
    return 'intervalo';
  end if;

  if exists (
    select 1 from public.schedule_exceptions e
    where (e.barber_id is null or e.barber_id = p_barber_id)
      and tstzrange(e.starts_at, e.ends_at, '[)') && tstzrange(p_start, p_end, '[)')
  ) then
    return 'bloqueado';
  end if;

  if p_check_busy and exists (
    select 1 from public.appointments a
    where a.barber_id = p_barber_id
      and a.status in ('pendente', 'confirmado', 'concluido')
      and (a.status <> 'pendente' or (a.created_at >= now() - make_interval(hours => s.pending_expiry_hours) and a.starts_at > now()))
      and (p_ignore_appointment is null or a.id <> p_ignore_appointment)
      and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_start, p_end, '[)')
  ) then
    return 'ocupado';
  end if;

  return null;
end $$;

-- Horários livres de um serviço num dia. p_barber_id nulo = qualquer profissional.
-- Público (visitante pode consultar): devolve só horários e o nome do profissional.
create or replace function public.available_slots(p_service_id text, p_day date, p_barber_id uuid default null)
returns table (slot_start timestamptz, slot_end timestamptz, barber_id uuid, barber_name text)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  tz constant text := 'America/Sao_Paulo';
  s record;
  v_duration integer;
  b record;
  sch record;
  t timestamptz;
  t_end timestamptz;
  v_close timestamptz;
begin
  select * into s from public.business_settings where id = 1;
  select sv.duration_minutes into v_duration from public.services sv where sv.id = p_service_id and sv.active;
  if v_duration is null then return; end if;
  if p_day < (now() at time zone tz)::date or p_day > (now() at time zone tz)::date + s.max_days_ahead then return; end if;

  for b in
    select br.id, br.name from public.barbers br
    join public.barber_services bsv on bsv.barber_id = br.id and bsv.service_id = p_service_id
    where br.active and (p_barber_id is null or br.id = p_barber_id)
    order by br.sort, br.name
  loop
    select * into sch from public.barber_schedules x where x.barber_id = b.id and x.weekday = extract(dow from p_day)::smallint;
    continue when not found;
    t := (p_day + sch.start_time) at time zone tz;
    v_close := (p_day + sch.end_time) at time zone tz;
    loop
      t_end := t + make_interval(mins => v_duration);
      exit when t_end > v_close;
      if public._slot_problem(b.id, t, t_end, null, true, true) is null then
        slot_start := t; slot_end := t_end; barber_id := b.id; barber_name := b.name;
        return next;
      end if;
      t := t + make_interval(mins => s.slot_step_minutes);
    end loop;
  end loop;
end $$;

-- Dias com ao menos um horário livre (para o calendário do agendamento).
create or replace function public.available_days(p_service_id text, p_barber_id uuid default null, p_from date default null, p_days integer default 31)
returns table (day date, slots integer)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  tz constant text := 'America/Sao_Paulo';
  d date := coalesce(p_from, (now() at time zone tz)::date);
  v_count integer;
begin
  for i in 0 .. least(greatest(p_days, 1), 62) - 1 loop
    select count(*) into v_count from public.available_slots(p_service_id, d + i, p_barber_id);
    if v_count > 0 then day := d + i; slots := v_count; return next; end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Status: histórico, fidelidade e recompensas (aplicados em qualquer caminho de mudança)
-- ---------------------------------------------------------------------------
create or replace function public._record_status() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.appointment_status_history (appointment_id, from_status, to_status, changed_by, reason)
    values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid(),
            nullif(current_setting('app.status_reason', true), ''));
  end if;
  return new;
end $$;

create trigger appointments_status_history after insert or update of status on public.appointments
  for each row execute function public._record_status();

-- Converte saldo em recompensas (10 pontos = 1 recompensa), com trava por cliente+cartão.
create or replace function public._grant_rewards(p_customer uuid, p_rule uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_threshold integer;
  v_balance integer;
  v_reward uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_customer::text || p_rule::text, 0));
  select threshold into v_threshold from public.loyalty_rules where id = p_rule;
  select coalesce(sum(delta), 0) into v_balance from public.loyalty_entries where customer_id = p_customer and rule_id = p_rule;
  while v_balance >= v_threshold loop
    insert into public.loyalty_rewards (customer_id, rule_id) values (p_customer, p_rule) returning id into v_reward;
    insert into public.loyalty_entries (customer_id, rule_id, reward_id, delta, kind, reason, created_by)
    values (p_customer, p_rule, v_reward, -v_threshold, 'recompensa_gerada', 'Recompensa gerada', auth.uid());
    v_balance := v_balance - v_threshold;
  end loop;
end $$;

create or replace function public._apply_status_effects() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  v_net integer;
  v_lost boolean;
begin
  if new.status is not distinct from old.status then return new; end if;

  -- Fidelidade: crédito ao concluir (uma vez por agendamento e cartão), estorno ao desfazer.
  if new.customer_id is not null and not new.is_reward then
    if new.status = 'concluido' then
      for r in select * from public.loyalty_rules lr where lr.active and new.service_id = any (lr.eligible_service_ids) loop
        perform pg_advisory_xact_lock(hashtextextended(new.customer_id::text || r.id::text, 0));
        select coalesce(sum(delta), 0) into v_net from public.loyalty_entries
        where appointment_id = new.id and rule_id = r.id and kind in ('atendimento', 'estorno');
        if v_net = 0 then
          insert into public.loyalty_entries (customer_id, rule_id, appointment_id, delta, kind, reason, created_by)
          values (new.customer_id, r.id, new.id, 1, 'atendimento', 'Atendimento concluído', auth.uid());
          perform public._grant_rewards(new.customer_id, r.id);
        end if;
      end loop;
    elsif old.status = 'concluido' then
      for r in select distinct e.rule_id from public.loyalty_entries e where e.appointment_id = new.id loop
        perform pg_advisory_xact_lock(hashtextextended(new.customer_id::text || r.rule_id::text, 0));
        select coalesce(sum(delta), 0) into v_net from public.loyalty_entries
        where appointment_id = new.id and rule_id = r.rule_id and kind in ('atendimento', 'estorno');
        if v_net > 0 then
          insert into public.loyalty_entries (customer_id, rule_id, appointment_id, delta, kind, reason, created_by)
          values (new.customer_id, r.rule_id, new.id, -v_net, 'estorno',
                  coalesce(nullif(current_setting('app.status_reason', true), ''), 'Conclusão desfeita'), auth.uid());
        end if;
      end loop;
    end if;
  end if;

  -- Recompensa usada neste agendamento.
  if new.is_reward then
    select reward_lost_on_no_show into v_lost from public.business_settings where id = 1;
    if new.status = 'concluido' then
      update public.loyalty_rewards set status = 'resgatado', used_at = now() where appointment_id = new.id;
    elsif new.status in ('cancelado', 'expirado') or (new.status = 'nao_compareceu' and not v_lost) then
      update public.loyalty_rewards set status = 'disponivel', appointment_id = null, used_at = null where appointment_id = new.id;
    elsif new.status = 'nao_compareceu' then
      update public.loyalty_rewards set status = 'perdido' where appointment_id = new.id;
    elsif new.status in ('confirmado', 'pendente') then
      update public.loyalty_rewards set status = 'reservado', used_at = null where appointment_id = new.id;
    end if;
  end if;

  return new;
end $$;

create trigger appointments_status_effects after update of status on public.appointments
  for each row execute function public._apply_status_effects();

-- ---------------------------------------------------------------------------
-- Agendamento (cliente)
-- ---------------------------------------------------------------------------
create or replace function public._problem_message(p_code text) returns text
language sql immutable set search_path = ''
as $$
  select case p_code
    when 'passado' then 'Este horário já passou. Escolha outro.'
    when 'antecedencia' then 'Este horário está muito próximo. Escolha um horário com mais antecedência.'
    when 'limite_futuro' then 'Ainda não é possível agendar para esta data.'
    when 'profissional_inativo' then 'Este profissional não está atendendo.'
    when 'fora_expediente' then 'Este horário está fora do expediente.'
    when 'intervalo' then 'Este horário coincide com o intervalo do profissional.'
    when 'bloqueado' then 'Este horário está bloqueado pela barbearia.'
    when 'ocupado' then 'Este horário acabou de ser reservado. Escolha outro.'
    else 'Horário indisponível.'
  end
$$;

-- Núcleo compartilhado de criação (cliente e reagendamento). Chamado já com as travas.
create or replace function public._insert_appointment(
  p_customer uuid, p_service_id text, p_barber_id uuid, p_start timestamptz,
  p_request_key uuid, p_reward_id uuid, p_notes text, p_status public.appointment_status,
  p_client_rules boolean, p_guest_name text default null, p_guest_phone text default null
) returns public.appointments
language plpgsql security definer set search_path = ''
as $$
declare
  v_service record;
  v_end timestamptz;
  v_problem text;
  v_reward record;
  v_row public.appointments;
begin
  select * into v_service from public.services where id = p_service_id and active;
  if not found then perform public._fail('servico_indisponivel', 'Serviço indisponível.'); end if;
  if not exists (select 1 from public.barber_services where barber_id = p_barber_id and service_id = p_service_id) then
    perform public._fail('servico_indisponivel', 'Este profissional não realiza este serviço.');
  end if;

  v_end := p_start + make_interval(mins => v_service.duration_minutes);
  perform pg_advisory_xact_lock(hashtextextended(p_barber_id::text, 0));
  v_problem := public._slot_problem(p_barber_id, p_start, v_end, null, p_client_rules, true);
  if v_problem is not null then perform public._fail(v_problem, public._problem_message(v_problem)); end if;

  if p_reward_id is not null then
    select * into v_reward from public.loyalty_rewards where id = p_reward_id for update;
    if not found or v_reward.customer_id is distinct from p_customer then
      perform public._fail('recompensa_invalida', 'Recompensa não encontrada.');
    end if;
    if v_reward.status <> 'disponivel' then
      perform public._fail('recompensa_indisponivel', 'Esta recompensa já foi utilizada ou está reservada.');
    end if;
    if not exists (select 1 from public.loyalty_rules where id = v_reward.rule_id and reward_service_id = p_service_id) then
      perform public._fail('recompensa_servico', 'Esta recompensa vale para outro serviço.');
    end if;
  end if;

  begin
    insert into public.appointments (customer_id, guest_name, guest_phone, barber_id, service_id, service_name,
      duration_minutes, starts_at, ends_at, status, is_reward, request_key, notes, created_by)
    values (p_customer, p_guest_name, p_guest_phone, p_barber_id, p_service_id, v_service.name,
      v_service.duration_minutes, p_start, v_end, p_status, p_reward_id is not null, p_request_key,
      nullif(btrim(p_notes), ''), auth.uid())
    returning * into v_row;
  exception when exclusion_violation then
    perform public._fail('ocupado', public._problem_message('ocupado'));
  end;

  if p_reward_id is not null then
    update public.loyalty_rewards set status = 'reservado', appointment_id = v_row.id where id = p_reward_id;
  end if;
  return v_row;
end $$;

-- Solicitação de agendamento pelo cliente: sempre nasce PENDENTE.
-- p_request_key: gerado no navegador por tentativa; repetir a chamada não duplica.
-- p_barber_id nulo = primeiro profissional livre.
create or replace function public.request_appointment(
  p_service_id text, p_start timestamptz, p_request_key uuid,
  p_barber_id uuid default null, p_reward_id uuid default null, p_notes text default null
) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_customer uuid := public._require_customer();
  s record;
  v_existing public.appointments;
  v_row public.appointments;
  v_barber uuid;
  v_duration integer;
begin
  if p_request_key is null then perform public._fail('requisicao_invalida', 'Requisição inválida.'); end if;

  select * into v_existing from public.appointments where request_key = p_request_key;
  if found then
    if v_existing.customer_id is distinct from v_customer then
      perform public._fail('requisicao_invalida', 'Requisição inválida.');
    end if;
    return jsonb_build_object('id', v_existing.id, 'protocol', v_existing.protocol, 'status', v_existing.status, 'repetida', true);
  end if;

  if not exists (select 1 from auth.users u where u.id = v_customer and u.email_confirmed_at is not null) then
    perform public._fail('email_nao_confirmado', 'Confirme seu e-mail antes de agendar. Enviamos um link quando você se cadastrou.');
  end if;

  perform public.expire_stale_appointments();
  select * into s from public.business_settings where id = 1;

  -- Limites contra spam: solicitações ativas e por hora, por conta.
  if (select count(*) from public.appointments a where a.customer_id = v_customer
      and a.status in ('pendente', 'confirmado') and a.starts_at > now()) >= s.max_active_requests then
    perform public._fail('limite_ativos', 'Você já tem o máximo de horários em aberto. Cancele um ou aguarde a confirmação.');
  end if;
  if (select count(*) from public.appointments a where a.customer_id = v_customer
      and a.created_at > now() - interval '1 hour') >= s.max_requests_per_hour then
    perform public._fail('limite_hora', 'Muitas solicitações em pouco tempo. Tente novamente mais tarde.');
  end if;

  if p_barber_id is null then
    select sv.duration_minutes into v_duration from public.services sv where sv.id = p_service_id and sv.active;
    select b.id into v_barber
    from public.barbers b
    join public.barber_services bs on bs.barber_id = b.id and bs.service_id = p_service_id
    where b.active
      and public._slot_problem(b.id, p_start, p_start + make_interval(mins => coalesce(v_duration, 0)), null, true, true) is null
    order by b.sort, b.name
    limit 1;
    if v_barber is null then perform public._fail('ocupado', public._problem_message('ocupado')); end if;
  else
    v_barber := p_barber_id;
  end if;

  v_row := public._insert_appointment(v_customer, p_service_id, v_barber, p_start, p_request_key, p_reward_id, p_notes, 'pendente', true);
  return jsonb_build_object('id', v_row.id, 'protocol', v_row.protocol, 'status', v_row.status, 'repetida', false);
end $$;

create or replace function public.cancel_my_appointment(p_appointment_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_customer uuid := public._require_customer();
  a record;
  v_notice integer;
begin
  select * into a from public.appointments where id = p_appointment_id for update;
  if not found or a.customer_id is distinct from v_customer then
    perform public._fail('nao_encontrado', 'Agendamento não encontrado.');
  end if;
  if a.status not in ('pendente', 'confirmado') or a.starts_at <= now() then
    perform public._fail('nao_cancelavel', 'Este agendamento não pode mais ser cancelado pelo site.');
  end if;
  select customer_cancel_notice_minutes into v_notice from public.business_settings where id = 1;
  if a.status = 'confirmado' and a.starts_at < now() + make_interval(mins => v_notice) then
    perform public._fail('cancelamento_tardio', 'Faltando pouco tempo, fale com a barbearia pelo WhatsApp para cancelar.');
  end if;
  perform set_config('app.status_reason', coalesce(nullif(btrim(p_reason), ''), 'Cancelado pelo cliente'), true);
  update public.appointments set status = 'cancelado' where id = p_appointment_id;
end $$;

-- Reagendar = novo pedido PENDENTE + cancelamento do anterior, na mesma transação.
create or replace function public.reschedule_my_appointment(
  p_appointment_id uuid, p_new_start timestamptz, p_request_key uuid, p_barber_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_customer uuid := public._require_customer();
  a record;
  v_reward uuid;
  v_row public.appointments;
begin
  select * into a from public.appointments where id = p_appointment_id for update;
  if not found or a.customer_id is distinct from v_customer then
    perform public._fail('nao_encontrado', 'Agendamento não encontrado.');
  end if;
  if a.status not in ('pendente', 'confirmado') or a.starts_at <= now() then
    perform public._fail('nao_reagendavel', 'Este agendamento não pode mais ser reagendado pelo site.');
  end if;
  select id into v_reward from public.loyalty_rewards where appointment_id = a.id and status = 'reservado';

  perform set_config('app.status_reason', 'Reagendado pelo cliente', true);
  update public.appointments set status = 'cancelado' where id = a.id; -- libera a recompensa, se houver
  v_row := public._insert_appointment(v_customer, a.service_id, coalesce(p_barber_id, a.barber_id), p_new_start,
                                      p_request_key, v_reward, a.notes, 'pendente', true);
  return jsonb_build_object('id', v_row.id, 'protocol', v_row.protocol, 'status', v_row.status);
end $$;

-- ---------------------------------------------------------------------------
-- Agendamento (administração)
-- ---------------------------------------------------------------------------
create or replace function public.admin_create_appointment(
  p_service_id text, p_barber_id uuid, p_start timestamptz,
  p_customer_id uuid default null, p_guest_name text default null, p_guest_phone text default null,
  p_status public.appointment_status default 'confirmado', p_notes text default null, p_force boolean default false
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.appointments;
  v_service record;
begin
  perform public._require_admin();
  if p_customer_id is null and nullif(btrim(p_guest_name), '') is null then
    perform public._fail('cliente_obrigatorio', 'Informe o cliente ou o nome de quem será atendido.');
  end if;
  if p_status not in ('pendente', 'confirmado', 'concluido') then
    perform public._fail('status_invalido', 'Status inicial inválido.');
  end if;
  if p_customer_id is not null and not exists (select 1 from public.profiles where id = p_customer_id and anonymized_at is null) then
    perform public._fail('nao_encontrado', 'Cliente não encontrado.');
  end if;

  if p_force then
    -- Registro retroativo ou fora do expediente: só não pode sobrepor outro agendamento.
    select * into v_service from public.services where id = p_service_id;
    if not found then perform public._fail('servico_indisponivel', 'Serviço não encontrado.'); end if;
    perform pg_advisory_xact_lock(hashtextextended(p_barber_id::text, 0));
    begin
      insert into public.appointments (customer_id, guest_name, guest_phone, barber_id, service_id, service_name,
        duration_minutes, starts_at, ends_at, status, notes, created_by)
      values (p_customer_id, nullif(btrim(p_guest_name), ''), nullif(regexp_replace(coalesce(p_guest_phone, ''), '[^0-9]', '', 'g'), ''),
        p_barber_id, p_service_id, v_service.name, v_service.duration_minutes, p_start,
        p_start + make_interval(mins => v_service.duration_minutes), 'confirmado', nullif(btrim(p_notes), ''), auth.uid())
      returning * into v_row;
    exception when exclusion_violation then
      perform public._fail('ocupado', public._problem_message('ocupado'));
    end;
  else
    v_row := public._insert_appointment(p_customer_id, p_service_id, p_barber_id, p_start, null, null, p_notes,
      'confirmado', false, nullif(btrim(p_guest_name), ''),
      nullif(regexp_replace(coalesce(p_guest_phone, ''), '[^0-9]', '', 'g'), ''));
  end if;

  if p_status = 'concluido' then
    if v_row.starts_at > now() then perform public._fail('conclusao_futura', 'Só é possível concluir atendimentos que já começaram.'); end if;
    perform set_config('app.status_reason', 'Registrado como concluído pela administração', true);
    update public.appointments set status = 'concluido' where id = v_row.id;
  elsif p_status = 'pendente' then
    update public.appointments set status = 'pendente' where id = v_row.id;
  end if;
  perform public._log('criar_agendamento', 'appointments', v_row.id::text, jsonb_build_object('forcado', p_force));
  return jsonb_build_object('id', v_row.id, 'protocol', v_row.protocol);
end $$;

-- Transições permitidas (o painel só oferece estas):
--   pendente   -> confirmado | cancelado
--   confirmado -> concluido | nao_compareceu | cancelado
--   concluido  -> confirmado        (correção: estorna a fidelidade; exige motivo)
--   nao_compareceu -> confirmado    (correção; exige motivo)
create or replace function public.admin_update_status(p_appointment_id uuid, p_status public.appointment_status, p_reason text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  a record;
  v_ok boolean;
begin
  perform public._require_admin();
  select * into a from public.appointments where id = p_appointment_id for update;
  if not found then perform public._fail('nao_encontrado', 'Agendamento não encontrado.'); end if;
  if a.status = p_status then return; end if; -- clique repetido: nada a fazer

  v_ok := case a.status
    when 'pendente' then p_status in ('confirmado', 'cancelado')
    when 'confirmado' then p_status in ('concluido', 'nao_compareceu', 'cancelado')
    when 'concluido' then p_status = 'confirmado'
    when 'nao_compareceu' then p_status = 'confirmado'
    else false
  end;
  if not v_ok then
    perform public._fail('transicao_invalida', 'Esta mudança de status não é permitida.');
  end if;
  if p_status in ('concluido', 'nao_compareceu') and a.starts_at > now() then
    perform public._fail('conclusao_futura', 'Só é possível registrar depois do horário marcado.');
  end if;
  if a.status in ('concluido', 'nao_compareceu') and char_length(btrim(coalesce(p_reason, ''))) < 5 then
    perform public._fail('motivo_obrigatorio', 'Informe o motivo da correção (mínimo 5 caracteres).');
  end if;
  if p_status = 'confirmado' and a.status = 'pendente' and a.starts_at <= now() then
    perform public._fail('passado', 'Este horário já passou. Registre como concluído ou cancele.');
  end if;

  perform set_config('app.status_reason', coalesce(nullif(btrim(p_reason), ''), ''), true);
  update public.appointments set status = p_status where id = p_appointment_id;
  perform public._log('status_' || p_status::text, 'appointments', p_appointment_id::text,
    jsonb_build_object('de', a.status, 'para', p_status, 'motivo', nullif(btrim(p_reason), '')));
end $$;

create or replace function public.admin_reschedule(p_appointment_id uuid, p_new_start timestamptz, p_barber_id uuid default null, p_force boolean default false)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  a record;
  v_barber uuid;
  v_end timestamptz;
  v_problem text;
begin
  perform public._require_admin();
  select * into a from public.appointments where id = p_appointment_id for update;
  if not found then perform public._fail('nao_encontrado', 'Agendamento não encontrado.'); end if;
  if a.status not in ('pendente', 'confirmado') then
    perform public._fail('nao_reagendavel', 'Só agendamentos pendentes ou confirmados podem ser reagendados.');
  end if;
  v_barber := coalesce(p_barber_id, a.barber_id);
  v_end := p_new_start + make_interval(mins => a.duration_minutes);
  perform pg_advisory_xact_lock(hashtextextended(v_barber::text, 0));
  if not p_force then
    v_problem := public._slot_problem(v_barber, p_new_start, v_end, a.id, false, true);
    if v_problem is not null then perform public._fail(v_problem, public._problem_message(v_problem)); end if;
  elsif p_new_start <= now() then
    perform public._fail('passado', public._problem_message('passado'));
  end if;
  begin
    update public.appointments set starts_at = p_new_start, ends_at = v_end, barber_id = v_barber where id = a.id;
  exception when exclusion_violation then
    perform public._fail('ocupado', public._problem_message('ocupado'));
  end;
  perform public._log('reagendar', 'appointments', a.id::text,
    jsonb_build_object('de', a.starts_at, 'para', p_new_start, 'profissional', v_barber, 'forcado', p_force));
end $$;

-- Agendamentos futuros ativos que deixariam de caber na agenda atual (após uma mudança).
create or replace function public._schedule_conflicts(p_barber_id uuid default null) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'protocol', a.protocol, 'starts_at', a.starts_at, 'service_name', a.service_name,
      'barber_id', a.barber_id, 'status', a.status,
      'customer_name', coalesce(p.full_name, a.guest_name),
      'motivo', public._slot_problem(a.barber_id, a.starts_at, a.ends_at, a.id, false, false))
    order by a.starts_at), '[]'::jsonb)
  from public.appointments a
  left join public.profiles p on p.id = a.customer_id
  where a.status in ('pendente', 'confirmado') and a.starts_at > now()
    and (p_barber_id is null or a.barber_id = p_barber_id)
    and public._slot_problem(a.barber_id, a.starts_at, a.ends_at, a.id, false, false) is not null
$$;

-- Cancela os agendamentos em conflito (decisão "cancelar" do administrador).
create or replace function public._cancel_conflicts(p_conflicts jsonb, p_reason text) returns void
language plpgsql security definer set search_path = ''
as $$
declare c jsonb;
begin
  perform set_config('app.status_reason', p_reason, true);
  for c in select * from jsonb_array_elements(p_conflicts) loop
    update public.appointments set status = 'cancelado' where id = (c ->> 'id')::uuid;
  end loop;
end $$;

-- Salva o expediente semanal. p_days: [{weekday, start, end, break_start?, break_end?}];
-- dia ausente = fechado. p_barber_id nulo = aplica a todos os profissionais ativos.
-- p_conflict_action: 'verificar' (não salva se houver conflito e devolve a lista),
-- 'manter' (salva e mantém os agendamentos) ou 'cancelar' (salva e cancela os conflitantes).
-- Nada é cancelado sem a decisão explícita do administrador.
create or replace function public.admin_save_schedule(p_barber_id uuid, p_days jsonb, p_conflict_action text default 'verificar')
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  b uuid;
  d jsonb;
  v_conflicts jsonb := '[]'::jsonb;
begin
  perform public._require_admin();
  if p_conflict_action not in ('verificar', 'manter', 'cancelar') then
    perform public._fail('acao_invalida', 'Escolha o que fazer com os agendamentos em conflito.');
  end if;
  if jsonb_typeof(p_days) <> 'array' then perform public._fail('dados_invalidos', 'Expediente inválido.'); end if;
  begin
    for b in select id from public.barbers where (p_barber_id is null and active) or id = p_barber_id loop
      delete from public.barber_schedules where barber_id = b;
      for d in select * from jsonb_array_elements(p_days) loop
        insert into public.barber_schedules (barber_id, weekday, start_time, end_time, break_start, break_end)
        values (b, (d ->> 'weekday')::smallint, (d ->> 'start')::time, (d ->> 'end')::time,
                nullif(d ->> 'break_start', '')::time, nullif(d ->> 'break_end', '')::time);
      end loop;
    end loop;
    v_conflicts := public._schedule_conflicts(p_barber_id);
    if jsonb_array_length(v_conflicts) > 0 and p_conflict_action = 'verificar' then
      raise exception using errcode = 'P0002'; -- desfaz só este bloco; v_conflicts sobrevive
    end if;
  exception
    when sqlstate 'P0002' then
      return jsonb_build_object('saved', false, 'conflicts', v_conflicts);
    when check_violation or invalid_datetime_format or not_null_violation or unique_violation then
      perform public._fail('dados_invalidos', 'Confira os horários: o fechamento deve ser depois da abertura e o intervalo dentro do expediente.');
  end;
  if p_conflict_action = 'cancelar' and jsonb_array_length(v_conflicts) > 0 then
    perform public._cancel_conflicts(v_conflicts, 'Cancelado por mudança no expediente');
  end if;
  perform public._log('salvar_expediente', 'barber_schedules', coalesce(p_barber_id::text, 'todos'),
    jsonb_build_object('conflitos', jsonb_array_length(v_conflicts), 'acao', p_conflict_action));
  return jsonb_build_object('saved', true, 'conflicts', v_conflicts);
end $$;

-- Folga, feriado, férias ou bloqueio. Mesma regra de conflitos do expediente.
create or replace function public.admin_add_exception(
  p_barber_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_kind text,
  p_reason text default null, p_conflict_action text default 'verificar'
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_conflicts jsonb := '[]'::jsonb;
begin
  perform public._require_admin();
  if p_conflict_action not in ('verificar', 'manter', 'cancelar') then
    perform public._fail('acao_invalida', 'Escolha o que fazer com os agendamentos em conflito.');
  end if;
  begin
    insert into public.schedule_exceptions (barber_id, starts_at, ends_at, kind, reason, created_by)
    values (p_barber_id, p_starts_at, p_ends_at, p_kind, nullif(btrim(p_reason), ''), auth.uid())
    returning id into v_id;
    v_conflicts := public._schedule_conflicts(p_barber_id);
    if jsonb_array_length(v_conflicts) > 0 and p_conflict_action = 'verificar' then
      raise exception using errcode = 'P0002';
    end if;
  exception
    when sqlstate 'P0002' then
      return jsonb_build_object('saved', false, 'conflicts', v_conflicts);
    when check_violation or not_null_violation then
      perform public._fail('dados_invalidos', 'Confira o período: o fim deve ser depois do início.');
  end;
  if p_conflict_action = 'cancelar' and jsonb_array_length(v_conflicts) > 0 then
    perform public._cancel_conflicts(v_conflicts, coalesce('Cancelado: ' || nullif(btrim(p_reason), ''), 'Cancelado por bloqueio de agenda'));
  end if;
  return jsonb_build_object('saved', true, 'id', v_id, 'conflicts', v_conflicts);
end $$;

create or replace function public.admin_delete_exception(p_exception_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public._require_admin();
  delete from public.schedule_exceptions where id = p_exception_id;
end $$;

-- ---------------------------------------------------------------------------
-- Fidelidade
-- ---------------------------------------------------------------------------
create or replace function public._loyalty_for(p_customer uuid)
returns table (rule_id uuid, name text, threshold integer, points integer,
               reward_service_id text, reward_service_name text, available_rewards integer)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.name, r.threshold,
         coalesce((select sum(e.delta) from public.loyalty_entries e where e.customer_id = p_customer and e.rule_id = r.id), 0)::integer,
         r.reward_service_id, s.name,
         (select count(*) from public.loyalty_rewards w where w.customer_id = p_customer and w.rule_id = r.id and w.status = 'disponivel')::integer
  from public.loyalty_rules r
  join public.services s on s.id = r.reward_service_id
  where r.active
  order by r.sort, r.name
$$;

create or replace function public.my_loyalty()
returns table (rule_id uuid, name text, threshold integer, points integer,
               reward_service_id text, reward_service_name text, available_rewards integer)
language sql stable security definer set search_path = ''
as $$ select * from public._loyalty_for(auth.uid()) where auth.uid() is not null $$;

-- Ajuste manual: exige motivo e fica no histórico de auditoria.
create or replace function public.admin_adjust_loyalty(p_customer_id uuid, p_rule_id uuid, p_delta integer, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public._require_admin();
  if p_delta = 0 or abs(p_delta) > 20 then perform public._fail('ajuste_invalido', 'O ajuste deve ser de -20 a 20 pontos, diferente de zero.'); end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    perform public._fail('motivo_obrigatorio', 'Informe o motivo do ajuste (mínimo 5 caracteres).');
  end if;
  if not exists (select 1 from public.profiles where id = p_customer_id and anonymized_at is null) then
    perform public._fail('nao_encontrado', 'Cliente não encontrado.');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_customer_id::text || p_rule_id::text, 0));
  insert into public.loyalty_entries (customer_id, rule_id, delta, kind, reason, created_by)
  values (p_customer_id, p_rule_id, p_delta, 'ajuste', btrim(p_reason), auth.uid());
  perform public._grant_rewards(p_customer_id, p_rule_id);
  perform public._log('ajuste_fidelidade', 'loyalty_entries', p_customer_id::text,
    jsonb_build_object('regra', p_rule_id, 'delta', p_delta, 'motivo', btrim(p_reason)));
end $$;

-- Cancela uma recompensa ainda não usada e devolve os pontos ao cartão.
create or replace function public.admin_cancel_reward(p_reward_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = ''
as $$
declare w record;
begin
  perform public._require_admin();
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    perform public._fail('motivo_obrigatorio', 'Informe o motivo (mínimo 5 caracteres).');
  end if;
  select * into w from public.loyalty_rewards where id = p_reward_id for update;
  if not found then perform public._fail('nao_encontrado', 'Recompensa não encontrada.'); end if;
  if w.status <> 'disponivel' then
    perform public._fail('recompensa_indisponivel', 'Só recompensas disponíveis (não reservadas) podem ser canceladas.');
  end if;
  update public.loyalty_rewards set status = 'cancelado' where id = p_reward_id;
  insert into public.loyalty_entries (customer_id, rule_id, reward_id, delta, kind, reason, created_by)
  select w.customer_id, w.rule_id, w.id, r.threshold, 'recompensa_cancelada', btrim(p_reason), auth.uid()
  from public.loyalty_rules r where r.id = w.rule_id;
  perform public._log('cancelar_recompensa', 'loyalty_rewards', p_reward_id::text, jsonb_build_object('motivo', btrim(p_reason)));
end $$;

-- ---------------------------------------------------------------------------
-- Painel
-- ---------------------------------------------------------------------------
create or replace function public.admin_dashboard(p_day date default null) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  tz constant text := 'America/Sao_Paulo';
  d date := coalesce(p_day, (now() at time zone tz)::date);
  v_from timestamptz := d::timestamp at time zone tz;
  v_to timestamptz := (d + 1)::timestamp at time zone tz;
begin
  perform public._require_admin();
  perform public.expire_stale_appointments();
  return jsonb_build_object(
    'dia', d,
    'hoje', (select count(*) from public.appointments where starts_at >= v_from and starts_at < v_to and status in ('pendente', 'confirmado', 'concluido', 'nao_compareceu')),
    'pendentes', (select count(*) from public.appointments where status = 'pendente' and starts_at > now()),
    'confirmados_hoje', (select count(*) from public.appointments where starts_at >= v_from and starts_at < v_to and status = 'confirmado'),
    'concluidos_hoje', (select count(*) from public.appointments where starts_at >= v_from and starts_at < v_to and status = 'concluido'),
    'cancelados_hoje', (select count(*) from public.appointments where starts_at >= v_from and starts_at < v_to and status in ('cancelado', 'nao_compareceu')),
    'clientes', (select count(*) from public.profiles where role = 'cliente' and anonymized_at is null),
    'recompensas_disponiveis', (select count(*) from public.loyalty_rewards where status = 'disponivel')
  );
end $$;

-- Ficha do cliente: o acesso fica registrado (rastreabilidade de acesso a dados pessoais).
create or replace function public.admin_get_customer(p_customer_id uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v jsonb;
begin
  perform public._require_admin();
  select jsonb_build_object(
    'perfil', to_jsonb(p) - 'anonymized_at',
    'fidelidade', coalesce((select jsonb_agg(to_jsonb(l)) from public._loyalty_for(p.id) l), '[]'::jsonb),
    'recompensas', coalesce((select jsonb_agg(to_jsonb(w) order by w.created_at desc) from public.loyalty_rewards w where w.customer_id = p.id), '[]'::jsonb),
    'lancamentos', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (
        select x.* from public.loyalty_entries x where x.customer_id = p.id order by x.created_at desc limit 100) e), '[]'::jsonb),
    'agendamentos', coalesce((select jsonb_agg(to_jsonb(a) order by a.starts_at desc) from (
        select ap.id, ap.protocol, ap.service_name, ap.starts_at, ap.status, ap.is_reward, b.name as barber_name
        from public.appointments ap join public.barbers b on b.id = ap.barber_id
        where ap.customer_id = p.id order by ap.starts_at desc limit 50) a), '[]'::jsonb)
  ) into v
  from public.profiles p where p.id = p_customer_id;
  if v is null then perform public._fail('nao_encontrado', 'Cliente não encontrado.'); end if;
  perform public._log('consultar_cliente', 'profiles', p_customer_id::text);
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- Privacidade (LGPD)
-- ---------------------------------------------------------------------------
create or replace function public.create_privacy_request(p_kind text, p_details text default null) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_customer uuid := public._require_customer();
  v_id uuid;
begin
  if (select count(*) from public.privacy_requests where customer_id = v_customer and created_at > now() - interval '1 day') >= 5 then
    perform public._fail('limite_hora', 'Muitas solicitações hoje. Tente novamente amanhã.');
  end if;
  begin
    insert into public.privacy_requests (customer_id, kind, details)
    values (v_customer, p_kind, nullif(btrim(p_details), ''))
    returning id into v_id;
  exception when check_violation then
    perform public._fail('dados_invalidos', 'Tipo de solicitação inválido ou texto longo demais.');
  end;
  return v_id;
end $$;

create or replace function public.admin_resolve_privacy_request(p_request_id uuid, p_status text, p_resolution text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public._require_admin();
  if p_status not in ('em_andamento', 'concluida', 'recusada') then perform public._fail('status_invalido', 'Status inválido.'); end if;
  update public.privacy_requests
  set status = p_status, resolution = nullif(btrim(p_resolution), ''),
      resolved_at = case when p_status in ('concluida', 'recusada') then now() end,
      resolved_by = case when p_status in ('concluida', 'recusada') then auth.uid() end
  where id = p_request_id;
  if not found then perform public._fail('nao_encontrado', 'Solicitação não encontrada.'); end if;
  perform public._log('privacidade_' || p_status, 'privacy_requests', p_request_id::text);
end $$;

-- Cópia dos próprios dados (direito de acesso, LGPD art. 18, II).
create or replace function public.my_data_export() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_customer uuid := public._require_customer();
begin
  return jsonb_build_object(
    'gerado_em', now(),
    'perfil', (select to_jsonb(p) - 'anonymized_at' from public.profiles p where p.id = v_customer),
    'agendamentos', coalesce((select jsonb_agg(jsonb_build_object(
        'protocolo', a.protocol, 'servico', a.service_name, 'inicio', a.starts_at, 'status', a.status,
        'cortesia', a.is_reward, 'observacoes', a.notes, 'criado_em', a.created_at) order by a.starts_at desc)
      from public.appointments a where a.customer_id = v_customer), '[]'::jsonb),
    'fidelidade', coalesce((select jsonb_agg(jsonb_build_object('tipo', e.kind, 'pontos', e.delta, 'motivo', e.reason, 'em', e.created_at) order by e.created_at)
      from public.loyalty_entries e where e.customer_id = v_customer), '[]'::jsonb),
    'recompensas', coalesce((select jsonb_agg(jsonb_build_object('status', w.status, 'criada_em', w.created_at, 'usada_em', w.used_at))
      from public.loyalty_rewards w where w.customer_id = v_customer), '[]'::jsonb),
    'solicitacoes_privacidade', coalesce((select jsonb_agg(jsonb_build_object('tipo', r.kind, 'status', r.status, 'criada_em', r.created_at))
      from public.privacy_requests r where r.customer_id = v_customer), '[]'::jsonb)
  );
end $$;

-- Exclusão a pedido do titular: remove os dados de identificação e mantém o histórico de
-- atendimentos desvinculado da pessoa. A conta de login é apagada depois, no painel do
-- Supabase (Authentication → Users), como descrito em docs/SEGURANCA-LGPD.md.
create or replace function public.admin_anonymize_customer(p_customer_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public._require_admin();
  if p_customer_id = auth.uid() then perform public._fail('sem_permissao', 'Você não pode anonimizar a própria conta.'); end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    perform public._fail('motivo_obrigatorio', 'Informe o motivo (mínimo 5 caracteres).');
  end if;
  if not exists (select 1 from public.profiles where id = p_customer_id) then
    perform public._fail('nao_encontrado', 'Cliente não encontrado.');
  end if;
  perform set_config('app.status_reason', 'Cancelado: exclusão de dados a pedido do titular', true);
  update public.appointments set status = 'cancelado'
  where customer_id = p_customer_id and status in ('pendente', 'confirmado');
  update public.loyalty_rewards set status = 'cancelado', appointment_id = null
  where customer_id = p_customer_id and status in ('disponivel', 'reservado');
  update public.appointments set notes = null where customer_id = p_customer_id;
  perform set_config('app.role_change', 'on', true);
  update public.profiles
  set full_name = 'Cliente removido', phone = '0000000000', email = null,
      marketing_opt_in = false, role = 'cliente', anonymized_at = now()
  where id = p_customer_id;
  perform public._log('anonimizar_cliente', 'profiles', p_customer_id::text, jsonb_build_object('motivo', btrim(p_reason)));
end $$;
