-- V3 · Autorização: grants mínimos + RLS em todas as tabelas.
-- O Supabase concede por padrão ALL em public para anon/authenticated. Aqui começamos de
-- "nada permitido" e liberamos só o necessário. Escritas sensíveis (agendamentos,
-- fidelidade, expediente, bloqueios, auditoria) acontecem apenas pelas funções da migration
-- anterior, que validam quem chama.

-- ---------------------------------------------------------------------------
-- 1. Remove permissões padrão
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Objetos futuros também nascem fechados (cada migration nova concede explicitamente).
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. RLS ligado em todas as tabelas
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.barbers enable row level security;
alter table public.services enable row level security;
alter table public.barber_services enable row level security;
alter table public.barber_schedules enable row level security;
alter table public.schedule_exceptions enable row level security;
alter table public.business_settings enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_status_history enable row level security;
alter table public.loyalty_rules enable row level security;
alter table public.loyalty_rewards enable row level security;
alter table public.loyalty_entries enable row level security;
alter table public.audit_logs enable row level security;
alter table public.privacy_requests enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Catálogo público (visitante pode ver serviços, profissionais e expediente)
-- ---------------------------------------------------------------------------
grant execute on function public.is_admin() to anon, authenticated;
-- Usada no CHECK de business_settings.whatsapp: o Postgres exige EXECUTE de quem grava.
grant execute on function public.is_valid_br_whatsapp(text) to anon, authenticated;

grant select on public.services, public.barbers, public.barber_services, public.barber_schedules,
  public.business_settings, public.loyalty_rules to anon, authenticated;

create policy services_read on public.services for select using (active or public.is_admin());
create policy barbers_read on public.barbers for select using (active or public.is_admin());
create policy barber_services_read on public.barber_services for select using (true);
create policy schedules_read on public.barber_schedules for select using (true);
create policy settings_read on public.business_settings for select using (true);
create policy loyalty_rules_read on public.loyalty_rules for select using (active or public.is_admin());

-- Administração do catálogo direto nas tabelas (auditado por trigger).
grant insert, update, delete on public.services, public.barbers, public.barber_services, public.loyalty_rules to authenticated;
grant update on public.business_settings to authenticated;

create policy services_admin_write on public.services for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy barbers_admin_write on public.barbers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy barber_services_admin_write on public.barber_services for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy loyalty_rules_admin_write on public.loyalty_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy settings_admin_update on public.business_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. Dados pessoais: cada cliente só enxerga o que é dele; o admin enxerga tudo
-- ---------------------------------------------------------------------------
grant select on public.profiles to authenticated;
-- Colunas editáveis: o papel (role) NÃO está aqui; muda só por admin_set_role.
grant update (full_name, phone, marketing_opt_in) on public.profiles to authenticated;
create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update to authenticated
  using ((id = auth.uid() and anonymized_at is null) or public.is_admin())
  with check ((id = auth.uid() and anonymized_at is null) or public.is_admin());

grant select on public.appointments to authenticated;
create policy appointments_read on public.appointments for select to authenticated using (customer_id = auth.uid() or public.is_admin());

grant select on public.appointment_status_history to authenticated;
create policy status_history_read on public.appointment_status_history for select to authenticated using (
  public.is_admin() or exists (select 1 from public.appointments a where a.id = appointment_id and a.customer_id = auth.uid())
);

grant select on public.loyalty_entries, public.loyalty_rewards to authenticated;
create policy loyalty_entries_read on public.loyalty_entries for select to authenticated using (customer_id = auth.uid() or public.is_admin());
create policy loyalty_rewards_read on public.loyalty_rewards for select to authenticated using (customer_id = auth.uid() or public.is_admin());

grant select on public.privacy_requests to authenticated;
create policy privacy_requests_read on public.privacy_requests for select to authenticated using (customer_id = auth.uid() or public.is_admin());

-- Só administração
grant select on public.schedule_exceptions, public.audit_logs to authenticated;
create policy exceptions_admin_read on public.schedule_exceptions for select to authenticated using (public.is_admin());
create policy audit_admin_read on public.audit_logs for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. Funções chamáveis pelo app
-- ---------------------------------------------------------------------------
grant execute on function public.available_slots(text, date, uuid) to anon, authenticated;
grant execute on function public.available_days(text, uuid, date, integer) to anon, authenticated;

grant execute on function public.request_appointment(text, timestamptz, uuid, uuid, uuid, text) to authenticated;
grant execute on function public.cancel_my_appointment(uuid, text) to authenticated;
grant execute on function public.reschedule_my_appointment(uuid, timestamptz, uuid, uuid) to authenticated;
grant execute on function public.my_loyalty() to authenticated;
grant execute on function public.create_privacy_request(text, text) to authenticated;
grant execute on function public.my_data_export() to authenticated;

-- Funções administrativas: liberadas para autenticados, mas cada uma recusa quem não é admin.
grant execute on function public.admin_set_role(uuid, public.app_role) to authenticated;
grant execute on function public.admin_create_appointment(text, uuid, timestamptz, uuid, text, text, public.appointment_status, text, boolean) to authenticated;
grant execute on function public.admin_update_status(uuid, public.appointment_status, text) to authenticated;
grant execute on function public.admin_reschedule(uuid, timestamptz, uuid, boolean) to authenticated;
grant execute on function public.admin_save_schedule(uuid, jsonb, text) to authenticated;
grant execute on function public.admin_add_exception(uuid, timestamptz, timestamptz, text, text, text) to authenticated;
grant execute on function public.admin_delete_exception(uuid) to authenticated;
grant execute on function public.admin_adjust_loyalty(uuid, uuid, integer, text) to authenticated;
grant execute on function public.admin_cancel_reward(uuid, text) to authenticated;
grant execute on function public.admin_dashboard(date) to authenticated;
grant execute on function public.admin_get_customer(uuid) to authenticated;
grant execute on function public.admin_resolve_privacy_request(uuid, text, text) to authenticated;
grant execute on function public.admin_anonymize_customer(uuid, text) to authenticated;

-- bootstrap_first_admin, expire_stale_appointments e as funções iniciadas por "_" não têm
-- EXECUTE para o app: rodam só pelo SQL Editor (papel postgres) ou dentro de outras funções.
