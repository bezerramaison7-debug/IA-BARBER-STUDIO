-- V3 · Autorização: grants mínimos + RLS em todas as tabelas (15).
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
alter table public.customers enable row level security;
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
-- Usada no gatilho e no CHECK de customers (gravado pelo administrador autenticado).
grant execute on function public.normalize_br_phone(text) to authenticated;

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
-- 4. Dados pessoais: só o administrador. Clientes não têm login; o público não lê nada pessoal.
-- ---------------------------------------------------------------------------
grant select on public.profiles to authenticated;
-- Sem UPDATE direto: o papel muda só por admin_set_role / bootstrap_first_admin.
create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());

-- Cadastro de clientes: o admin lê, cria e corrige direto na tabela (normalizado e auditado por
-- gatilho). Excluir só por admin_delete_customer, que cancela horários e registra o motivo.
grant select, insert, update on public.customers to authenticated;
create policy customers_admin_read on public.customers for select to authenticated using (public.is_admin());
create policy customers_admin_insert on public.customers for insert to authenticated with check (public.is_admin());
create policy customers_admin_update on public.customers for update to authenticated using (public.is_admin()) with check (public.is_admin());

grant select on public.appointments, public.appointment_status_history, public.loyalty_entries, public.loyalty_rewards,
  public.privacy_requests, public.schedule_exceptions, public.audit_logs to authenticated;
create policy appointments_admin_read on public.appointments for select to authenticated using (public.is_admin());
create policy status_history_admin_read on public.appointment_status_history for select to authenticated using (public.is_admin());
create policy loyalty_entries_admin_read on public.loyalty_entries for select to authenticated using (public.is_admin());
create policy loyalty_rewards_admin_read on public.loyalty_rewards for select to authenticated using (public.is_admin());
create policy privacy_requests_admin_read on public.privacy_requests for select to authenticated using (public.is_admin());
create policy exceptions_admin_read on public.schedule_exceptions for select to authenticated using (public.is_admin());
create policy audit_admin_read on public.audit_logs for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. Funções chamáveis pelo app
-- ---------------------------------------------------------------------------
-- Público: só consulta de horários livres (nenhuma função pública grava ou reserva).
grant execute on function public.available_slots(text, date, uuid) to anon, authenticated;
grant execute on function public.available_days(text, uuid, date, integer) to anon, authenticated;

-- Funções administrativas: liberadas para autenticados, mas cada uma recusa quem não é admin.
grant execute on function public.admin_set_role(uuid, public.app_role) to authenticated;
grant execute on function public.admin_create_appointment(text, uuid, timestamptz, uuid, text, text, public.appointment_status, text, boolean, uuid, uuid) to authenticated;
grant execute on function public.admin_update_status(uuid, public.appointment_status, text) to authenticated;
grant execute on function public.admin_reschedule(uuid, timestamptz, uuid, boolean) to authenticated;
grant execute on function public.admin_save_schedule(uuid, jsonb, text) to authenticated;
grant execute on function public.admin_add_exception(uuid, timestamptz, timestamptz, text, text, text) to authenticated;
grant execute on function public.admin_delete_exception(uuid) to authenticated;
grant execute on function public.admin_adjust_loyalty(uuid, uuid, integer, text) to authenticated;
grant execute on function public.admin_cancel_reward(uuid, text) to authenticated;
grant execute on function public.admin_dashboard(date) to authenticated;
grant execute on function public.admin_get_customer(uuid) to authenticated;
grant execute on function public.admin_export_customer(uuid) to authenticated;
grant execute on function public.admin_delete_customer(uuid, text) to authenticated;
grant execute on function public.admin_create_privacy_request(text, text, text, text, text, uuid) to authenticated;
grant execute on function public.admin_resolve_privacy_request(uuid, text, text) to authenticated;

-- bootstrap_first_admin, expire_stale_appointments e as funções iniciadas por "_" não têm
-- EXECUTE para o app: rodam só pelo SQL Editor (papel postgres) ou dentro de outras funções.
