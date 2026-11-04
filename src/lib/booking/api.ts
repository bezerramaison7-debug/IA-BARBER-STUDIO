"use client";

/**
 * Acesso a dados da V3. As telas usam só estas funções.
 * Toda regra de negócio e autorização está no banco (RLS + funções); aqui não há
 * nenhuma decisão de segurança, apenas chamadas e formatação dos resultados.
 */
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import type { AppointmentStatus, LoyaltyCard } from "./domain";

export interface Service { id: string; name: string; duration_minutes: number; price_cents: number | null; price_from: boolean; active: boolean; sort: number }
export interface Barber { id: string; name: string; active: boolean; sort: number; service_ids: string[] }
export interface Slot { slot_start: string; slot_end: string; barber_id: string; barber_name: string }
export interface BusinessSettings {
  business_name: string; whatsapp: string; min_notice_minutes: number; max_days_ahead: number; slot_step_minutes: number;
  pending_expiry_hours: number; max_active_requests: number; max_requests_per_hour: number;
  customer_cancel_notice_minutes: number; reward_lost_on_no_show: boolean; loyalty_program_name: string;
}
export interface Profile { id: string; full_name: string; phone: string; email: string | null; role: "cliente" | "admin" | "barbeiro"; marketing_opt_in: boolean }
export interface Appointment {
  id: string; protocol: string; customer_id: string | null; guest_name: string | null; guest_phone: string | null;
  barber_id: string; service_id: string; service_name: string; duration_minutes: number;
  starts_at: string; ends_at: string; status: AppointmentStatus; is_reward: boolean; notes: string | null; created_at: string;
  barber?: { name: string } | null;
  customer?: { full_name: string; phone: string } | null;
}
export interface Reward { id: string; rule_id: string; status: string; appointment_id: string | null; created_at: string; used_at: string | null }
export interface ScheduleRow { barber_id: string; weekday: number; start_time: string; end_time: string; break_start: string | null; break_end: string | null }
export interface ScheduleException { id: string; barber_id: string | null; starts_at: string; ends_at: string; kind: string; reason: string | null }
export interface Conflict { id: string; protocol: string; starts_at: string; service_name: string; customer_name: string | null; motivo: string }
export interface LoyaltyRule { id: string; name: string; threshold: number; eligible_service_ids: string[]; reward_service_id: string; active: boolean; sort: number }
export interface PrivacyRequest { id: string; customer_id: string | null; kind: string; details: string | null; status: string; resolution: string | null; created_at: string; customer?: { full_name: string; email: string | null } | null }

export class NotConfiguredError extends Error {
  constructor() {
    super("O sistema de agendamento não está configurado neste site.");
  }
}

function sb(): SupabaseClient {
  const c = getSupabase();
  if (!c) throw new NotConfiguredError();
  return c;
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await sb().rpc(fn, args);
  if (error) throw error;
  return data as T;
}

async function rows<T>(query: PromiseLike<{ data: unknown; error: unknown }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw error;
  return data as T;
}

// ---------------------------------------------------------------- autenticação
export const auth = {
  async session(): Promise<Session | null> {
    const { data } = await sb().auth.getSession();
    return data.session;
  },
  onChange(cb: (session: Session | null) => void) {
    const { data } = sb().auth.onAuthStateChange((_event, session) => cb(session));
    return () => data.subscription.unsubscribe();
  },
  async signUp(input: { fullName: string; phone: string; email: string; password: string; marketing: boolean; redirectTo: string }) {
    const { data, error } = await sb().auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        emailRedirectTo: input.redirectTo,
        data: { full_name: input.fullName.trim(), phone: input.phone.replace(/\D/g, ""), marketing_opt_in: input.marketing },
      },
    });
    if (error) throw error;
    // Sessão nula = é preciso confirmar o e-mail antes de entrar.
    return { needsConfirmation: !data.session };
  },
  async signIn(email: string, password: string) {
    const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
  },
  async signOut() {
    const { error } = await sb().auth.signOut();
    if (error) throw error;
  },
  async requestPasswordReset(email: string, redirectTo: string) {
    // A resposta é a mesma exista ou não a conta (não revela quem é cliente).
    const { error } = await sb().auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error && (error as { status?: number }).status === 429) throw error;
  },
  async updatePassword(password: string) {
    const { error } = await sb().auth.updateUser({ password });
    if (error) throw error;
  },
  async verifyEmailLink(tokenHash: string, type: "signup" | "recovery" | "email" | "email_change" | "invite") {
    const { error } = await sb().auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) throw error;
  },
};

// ---------------------------------------------------------------- catálogo e disponibilidade
export const catalog = {
  services: () => rows<Service[]>(sb().from("services").select("*").eq("active", true).order("sort")),
  async barbers(): Promise<Barber[]> {
    const data = await rows<(Omit<Barber, "service_ids"> & { barber_services: { service_id: string }[] })[]>(
      sb().from("barbers").select("id, name, active, sort, barber_services(service_id)").eq("active", true).order("sort"),
    );
    return data.map(({ barber_services, ...b }) => ({ ...b, service_ids: barber_services.map((s) => s.service_id) }));
  },
  settings: () => rows<BusinessSettings>(sb().from("business_settings").select("*").eq("id", 1).single()),
  availableDays: (serviceId: string, barberId: string | null) =>
    rpc<{ day: string; slots: number }[]>("available_days", { p_service_id: serviceId, p_barber_id: barberId }),
  availableSlots: (serviceId: string, day: string, barberId: string | null) =>
    rpc<Slot[]>("available_slots", { p_service_id: serviceId, p_day: day, p_barber_id: barberId }),
  rules: () => rows<LoyaltyRule[]>(sb().from("loyalty_rules").select("*").order("sort")),
};

// ---------------------------------------------------------------- cliente
export const me = {
  profile: async () => {
    const s = await auth.session();
    if (!s) return null;
    return rows<Profile>(sb().from("profiles").select("id, full_name, phone, email, role, marketing_opt_in").eq("id", s.user.id).single());
  },
  updateProfile: async (id: string, patch: Partial<Pick<Profile, "full_name" | "phone" | "marketing_opt_in">>) => {
    await rows(sb().from("profiles").update(patch).eq("id", id));
  },
  isAdmin: () => rpc<boolean>("is_admin"),
  appointments: () =>
    rows<Appointment[]>(sb().from("appointments").select("*, barber:barbers(name)").order("starts_at", { ascending: false }).limit(100)),
  requestAppointment: (args: { serviceId: string; start: string; requestKey: string; barberId: string | null; rewardId: string | null; notes?: string }) =>
    rpc<{ id: string; protocol: string; status: AppointmentStatus; repetida: boolean }>("request_appointment", {
      p_service_id: args.serviceId,
      p_start: args.start,
      p_request_key: args.requestKey,
      p_barber_id: args.barberId,
      p_reward_id: args.rewardId,
      p_notes: args.notes ?? null,
    }),
  cancel: (id: string, reason?: string) => rpc<void>("cancel_my_appointment", { p_appointment_id: id, p_reason: reason ?? null }),
  reschedule: (id: string, start: string, requestKey: string, barberId: string | null) =>
    rpc<{ id: string; protocol: string }>("reschedule_my_appointment", {
      p_appointment_id: id,
      p_new_start: start,
      p_request_key: requestKey,
      p_barber_id: barberId,
    }),
  loyalty: () => rpc<LoyaltyCard[]>("my_loyalty"),
  rewards: () => rows<Reward[]>(sb().from("loyalty_rewards").select("*").order("created_at", { ascending: false })),
  exportData: () => rpc<unknown>("my_data_export"),
  privacyRequests: () => rows<PrivacyRequest[]>(sb().from("privacy_requests").select("*").order("created_at", { ascending: false })),
  createPrivacyRequest: (kind: string, details: string) => rpc<string>("create_privacy_request", { p_kind: kind, p_details: details }),
};

// ---------------------------------------------------------------- administração
export const admin = {
  dashboard: (day?: string) => rpc<Record<string, number | string>>("admin_dashboard", { p_day: day ?? null }),
  appointments: (fromIso: string, toIso: string) =>
    rows<Appointment[]>(
      sb()
        .from("appointments")
        .select("*, barber:barbers(name), customer:profiles!appointments_customer_id_fkey(full_name, phone)")
        .gte("starts_at", fromIso)
        .lt("starts_at", toIso)
        .order("starts_at"),
    ),
  pending: () =>
    rows<Appointment[]>(
      sb()
        .from("appointments")
        .select("*, barber:barbers(name), customer:profiles!appointments_customer_id_fkey(full_name, phone)")
        .eq("status", "pendente")
        .gt("starts_at", new Date().toISOString())
        .order("starts_at"),
    ),
  updateStatus: (id: string, status: AppointmentStatus, reason?: string) =>
    rpc<void>("admin_update_status", { p_appointment_id: id, p_status: status, p_reason: reason ?? null }),
  reschedule: (id: string, start: string, barberId: string | null) =>
    rpc<void>("admin_reschedule", { p_appointment_id: id, p_new_start: start, p_barber_id: barberId, p_force: false }),
  createAppointment: (a: { serviceId: string; barberId: string; start: string; customerId: string | null; guestName: string | null; guestPhone: string | null; notes: string | null }) =>
    rpc<{ id: string; protocol: string }>("admin_create_appointment", {
      p_service_id: a.serviceId,
      p_barber_id: a.barberId,
      p_start: a.start,
      p_customer_id: a.customerId,
      p_guest_name: a.guestName,
      p_guest_phone: a.guestPhone,
      p_status: "confirmado",
      p_notes: a.notes,
      p_force: false,
    }),
  allBarbers: async (): Promise<Barber[]> => {
    const data = await rows<(Omit<Barber, "service_ids"> & { barber_services: { service_id: string }[] })[]>(
      sb().from("barbers").select("id, name, active, sort, barber_services(service_id)").order("sort"),
    );
    return data.map(({ barber_services, ...b }) => ({ ...b, service_ids: barber_services.map((s) => s.service_id) }));
  },
  allServices: () => rows<Service[]>(sb().from("services").select("*").order("sort")),
  schedules: () => rows<ScheduleRow[]>(sb().from("barber_schedules").select("*")),
  saveSchedule: (barberId: string | null, days: { weekday: number; start: string; end: string; break_start?: string; break_end?: string }[], action: "verificar" | "manter" | "cancelar") =>
    rpc<{ saved: boolean; conflicts: Conflict[] }>("admin_save_schedule", { p_barber_id: barberId, p_days: days, p_conflict_action: action }),
  exceptions: () =>
    rows<ScheduleException[]>(sb().from("schedule_exceptions").select("*").gte("ends_at", new Date().toISOString()).order("starts_at")),
  addException: (e: { barberId: string | null; startsAt: string; endsAt: string; kind: string; reason: string }, action: "verificar" | "manter" | "cancelar") =>
    rpc<{ saved: boolean; conflicts: Conflict[] }>("admin_add_exception", {
      p_barber_id: e.barberId,
      p_starts_at: e.startsAt,
      p_ends_at: e.endsAt,
      p_kind: e.kind,
      p_reason: e.reason,
      p_conflict_action: action,
    }),
  deleteException: (id: string) => rpc<void>("admin_delete_exception", { p_exception_id: id }),
  searchCustomers: (term: string) => {
    let q = sb().from("profiles").select("id, full_name, phone, email, role, marketing_opt_in").is("anonymized_at", null).order("full_name").limit(30);
    const t = term.trim().replace(/[%,()]/g, "");
    if (t) q = q.or(`full_name.ilike.%${t}%,phone.ilike.%${t.replace(/\D/g, "") || t}%,email.ilike.%${t}%`);
    return rows<Profile[]>(q);
  },
  customer: (id: string) => rpc<CustomerSheet>("admin_get_customer", { p_customer_id: id }),
  adjustLoyalty: (customerId: string, ruleId: string, delta: number, reason: string) =>
    rpc<void>("admin_adjust_loyalty", { p_customer_id: customerId, p_rule_id: ruleId, p_delta: delta, p_reason: reason }),
  cancelReward: (rewardId: string, reason: string) => rpc<void>("admin_cancel_reward", { p_reward_id: rewardId, p_reason: reason }),
  anonymize: (customerId: string, reason: string) => rpc<void>("admin_anonymize_customer", { p_customer_id: customerId, p_reason: reason }),
  setRole: (userId: string, role: "cliente" | "admin") => rpc<void>("admin_set_role", { p_user_id: userId, p_role: role }),
  updateSettings: (patch: Partial<BusinessSettings>) => rows(sb().from("business_settings").update(patch).eq("id", 1)),
  saveService: (s: Partial<Service> & { id: string }) => rows(sb().from("services").upsert(s)),
  saveBarber: (b: { id?: string; name: string; active: boolean; sort: number }) =>
    rows<{ id: string }>(sb().from("barbers").upsert(b).select("id").single()),
  setBarberServices: async (barberId: string, serviceIds: string[]) => {
    await rows(sb().from("barber_services").delete().eq("barber_id", barberId));
    if (serviceIds.length) await rows(sb().from("barber_services").insert(serviceIds.map((service_id) => ({ barber_id: barberId, service_id }))));
  },
  saveRule: (r: Partial<LoyaltyRule> & { id?: string }) => rows(sb().from("loyalty_rules").upsert(r)),
  privacyRequests: () =>
    rows<PrivacyRequest[]>(sb().from("privacy_requests").select("*, customer:profiles(full_name, email)").order("created_at", { ascending: false }).limit(100)),
  resolvePrivacy: (id: string, status: string, resolution: string) =>
    rpc<void>("admin_resolve_privacy_request", { p_request_id: id, p_status: status, p_resolution: resolution }),
  auditLog: () => rows<{ id: number; action: string; entity: string; entity_id: string | null; created_at: string }[]>(
    sb().from("audit_logs").select("id, action, entity, entity_id, created_at").order("created_at", { ascending: false }).limit(50),
  ),
};

export interface CustomerSheet {
  perfil: Profile & { created_at: string; marketing_opt_in_at: string | null };
  fidelidade: LoyaltyCard[];
  recompensas: Reward[];
  lancamentos: { id: number; rule_id: string; delta: number; kind: string; reason: string | null; created_at: string }[];
  agendamentos: { id: string; protocol: string; service_name: string; starts_at: string; status: AppointmentStatus; is_reward: boolean; barber_name: string }[];
}
