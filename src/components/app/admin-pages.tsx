"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { appTexts } from "@/config/texts-app";
import {
  admin,
  catalog,
  type Appointment,
  type Barber,
  type BusinessSettings,
  type Conflict,
  type CustomerSheet,
  type LoyaltyRule,
  type PrivacyRequest,
  type Profile,
  type ScheduleException,
  type ScheduleRow,
  type Service,
} from "@/lib/booking/api";
import { addDays, dayKey, formatDate, formatDayKey, formatLongDate, formatTime, localToIso } from "@/lib/booking/datetime";
import { loyaltyCardText } from "@/lib/booking/domain";
import { friendlyError } from "@/lib/booking/errors";
import { isValidBrazilianWhatsApp } from "@/lib/whatsapp";
import { WEEKDAY_NAMES } from "@/lib/format";
import { useAuth } from "./auth-context";
import { useAsync } from "./use-async";
import { AppointmentItem, ConflictDecision } from "./admin-shared";
import { ActionButton, Card, Field, Notice, PageTitle, SectionTitle, SelectInput, StatusBadge, TextArea, TextInput } from "./ui";

const t = appTexts.admin;
type Msg = { tone: "success" | "error"; text: string } | null;

function useLoader<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    fn().then(setData).catch((e) => setError(friendlyError(e)));
  }, [fn]);
  useEffect(reload, [reload]);
  return { data, error, reload };
}

const today = () => dayKey(new Date());

// ------------------------------------------------------------------ Hoje
export function AdminToday() {
  const day = today();
  const stats = useLoader(useCallback(() => admin.dashboard(day), [day]));
  const list = useLoader(useCallback(() => admin.appointments(localToIso(day, "00:00"), localToIso(addDays(day, 1), "00:00")), [day]));
  const pending = useLoader(useCallback(() => admin.pending(), []));
  const reload = () => {
    stats.reload();
    list.reload();
    pending.reload();
  };

  return (
    <div className="grid gap-10">
      <PageTitle intro={<span>{formatLongDate(localToIso(day, "12:00"))}</span>}>{t.title}</PageTitle>
      {stats.error && <Notice tone="error">{stats.error}</Notice>}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.entries(t.stats).map(([key, label]) => (
          <div key={key} className="rounded-sm border border-line bg-surface p-4">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="font-display text-4xl font-extrabold">{stats.data ? String(stats.data[key] ?? 0) : "–"}</dd>
          </div>
        ))}
      </dl>
      <section aria-labelledby="pendentes" className="grid gap-3">
        <h2 id="pendentes" className="font-display text-3xl font-bold uppercase">{t.pendingTitle}</h2>
        {pending.data?.length === 0 && <p className="text-muted">{t.empty}</p>}
        {pending.data?.map((a) => <AppointmentItem key={a.id} a={a} onChanged={reload} showDate />)}
      </section>
      <section aria-labelledby="hoje" className="grid gap-3">
        <h2 id="hoje" className="font-display text-3xl font-bold uppercase">{t.todayTitle}</h2>
        {list.data?.length === 0 && <p className="text-muted">{t.empty}</p>}
        {list.data?.map((a) => <AppointmentItem key={a.id} a={a} onChanged={reload} />)}
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ Agenda
export function AdminAgenda() {
  const [mode, setMode] = useState<"dia" | "semana">("dia");
  const [start, setStart] = useState(today());
  const span = mode === "dia" ? 1 : 7;
  const list = useLoader(useCallback(() => admin.appointments(localToIso(start, "00:00"), localToIso(addDays(start, span), "00:00")), [start, span]));
  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (let i = 0; i < span; i++) map.set(addDays(start, i), []);
    for (const a of list.data ?? []) map.get(dayKey(a.starts_at))?.push(a);
    return [...map.entries()];
  }, [list.data, start, span]);

  return (
    <div className="grid gap-8">
      <PageTitle>{t.nav.agenda}</PageTitle>
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton variant={mode === "dia" ? "primary" : "outline"} onClick={() => setMode("dia")} aria-pressed={mode === "dia"}>{t.day}</ActionButton>
        <ActionButton variant={mode === "semana" ? "primary" : "outline"} onClick={() => setMode("semana")} aria-pressed={mode === "semana"}>{t.week}</ActionButton>
        <span className="mx-2 h-6 w-px bg-line" aria-hidden="true" />
        <ActionButton variant="outline" onClick={() => setStart(addDays(start, -span))}>{t.prev}</ActionButton>
        <ActionButton variant="outline" onClick={() => setStart(today())}>{t.today}</ActionButton>
        <ActionButton variant="outline" onClick={() => setStart(addDays(start, span))}>{t.next}</ActionButton>
        <label className="ml-auto">
          <span className="sr-only">{t.day}</span>
          <TextInput type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} className="mt-0" />
        </label>
      </div>
      {list.error && <Notice tone="error">{list.error}</Notice>}
      {byDay.map(([d, items]) => (
        <section key={d} aria-label={formatDayKey(d)} className="grid gap-3">
          <h2 className="text-xl font-semibold">{formatLongDate(localToIso(d, "12:00"))}</h2>
          {items.length === 0 ? <p className="text-muted">{t.empty}</p> : items.map((a) => <AppointmentItem key={a.id} a={a} onChanged={list.reload} />)}
        </section>
      ))}
      <ManualAppointment onCreated={list.reload} />
    </div>
  );
}

function ManualAppointment({ onCreated }: { onCreated: () => void }) {
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [msg, setMsg] = useState<Msg>(null);
  useEffect(() => {
    Promise.all([admin.allServices(), admin.allBarbers()]).then(([s, b]) => {
      setServices(s.filter((x) => x.active));
      setBarbers(b.filter((x) => x.active));
    });
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    try {
      const r = await admin.createAppointment({
        serviceId: String(d.get("service")),
        barberId: String(d.get("barber")),
        start: localToIso(String(d.get("day")), String(d.get("time"))),
        customerId: String(d.get("customer") || "") || null,
        guestName: String(d.get("guest") || "") || null,
        guestPhone: String(d.get("guestPhone") || "") || null,
        notes: null,
      });
      setMsg({ tone: "success", text: `${appTexts.booking.protocol} ${r.protocol}` });
      form.reset();
      onCreated();
    } catch (err) {
      setMsg({ tone: "error", text: friendlyError(err) });
    }
  }

  return (
    <Card>
      <SectionTitle>{t.newAppointment}</SectionTitle>
      <form onSubmit={onSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label={appTexts.booking.service}>
          {(p) => (
            <SelectInput {...p} name="service" required>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </SelectInput>
          )}
        </Field>
        <Field label={appTexts.booking.barber}>
          {(p) => (
            <SelectInput {...p} name="barber" required>
              {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </SelectInput>
          )}
        </Field>
        <Field label={appTexts.booking.date}>{(p) => <TextInput {...p} name="day" type="date" required defaultValue={today()} />}</Field>
        <Field label={appTexts.booking.time}>{(p) => <TextInput {...p} name="time" type="time" step={300} required />}</Field>
        <Field label={t.customer}>
          {(p) => (
            <>
              <TextInput placeholder={t.search} onChange={(e) => admin.searchCustomers(e.target.value).then(setCustomers).catch(() => {})} aria-label={t.search} />
              <SelectInput {...p} name="customer" defaultValue="">
                <option value="">—</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.full_name} · {c.phone}</option>)}
              </SelectInput>
            </>
          )}
        </Field>
        <div className="grid gap-4">
          <Field label={t.guest}>{(p) => <TextInput {...p} name="guest" />}</Field>
          <Field label={t.guestPhone}>{(p) => <TextInput {...p} name="guestPhone" type="tel" />}</Field>
        </div>
        {msg && <div className="sm:col-span-2"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
        <div className="sm:col-span-2"><ActionButton type="submit">{t.create}</ActionButton></div>
      </form>
    </Card>
  );
}

// ------------------------------------------------------------------ Horários (prioridade)
interface DayForm {
  open: boolean;
  start: string;
  end: string;
  lunch: boolean;
  breakStart: string;
  breakEnd: string;
}
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const hhmm = (v: string | null | undefined) => (v ? v.slice(0, 5) : "");

function toForm(rows: ScheduleRow[], barberId: string): DayForm[] {
  return Array.from({ length: 7 }, (_, w) => {
    const r = rows.find((x) => x.barber_id === barberId && x.weekday === w);
    return {
      open: Boolean(r),
      start: hhmm(r?.start_time) || "09:00",
      end: hhmm(r?.end_time) || "18:00",
      lunch: Boolean(r?.break_start),
      breakStart: hhmm(r?.break_start) || "12:00",
      breakEnd: hhmm(r?.break_end) || "13:00",
    };
  });
}

export function AdminAvailability() {
  const query = useAsync("horarios", () => Promise.all([admin.allBarbers(), admin.schedules()]));
  const barbers = useMemo(() => (query.data?.[0] ?? []).filter((x) => x.active), [query.data]);
  const rows: ScheduleRow[] = useMemo(() => query.data?.[1] ?? [], [query.data]);
  const [chosen, setChosen] = useState<string>("");
  const barberId = chosen || barbers[0]?.id || "";
  const setBarberId = setChosen;
  const [applyAll, setApplyAll] = useState(false);
  // Edição local do formulário, vinculada ao profissional e à versão carregada.
  const formKey = `${barberId}|${query.data ? "ok" : ""}`;
  const [edit, setEdit] = useState<{ key: string; days: DayForm[] } | null>(null);
  const form = edit && edit.key === formKey ? edit.days : barberId ? toForm(rows, barberId) : [];
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setEdit(null);
    query.reload();
  };

  const update = (w: number, patch: Partial<DayForm>) =>
    setEdit({ key: formKey, days: form.map((d, i) => (i === w ? { ...d, ...patch } : d)) });

  async function save(action: "verificar" | "manter" | "cancelar") {
    setBusy(true);
    setMsg(null);
    try {
      const days = form.flatMap((d, w) =>
        d.open ? [{ weekday: w, start: d.start, end: d.end, ...(d.lunch ? { break_start: d.breakStart, break_end: d.breakEnd } : {}) }] : [],
      );
      const r = await admin.saveSchedule(applyAll ? null : barberId, days, action);
      if (!r.saved) {
        setConflicts(r.conflicts);
        return;
      }
      setConflicts(null);
      setMsg({ tone: "success", text: t.scheduleSaved });
      await load();
    } catch (err) {
      setMsg({ tone: "error", text: friendlyError(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-10">
      <PageTitle intro={t.availabilityIntro}>{t.availabilityTitle}</PageTitle>
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <Field label={appTexts.booking.barber}>
            {(p) => (
              <SelectInput {...p} value={barberId} onChange={(e) => setBarberId(e.target.value)} disabled={applyAll}>
                {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </SelectInput>
            )}
          </Field>
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} className="size-5 accent-[var(--brand-accent)]" />
            {t.applyAll}
          </label>
        </div>

        <ul className="mt-6 divide-y divide-line">
          {ORDER.map((w) => {
            const d = form[w];
            if (!d) return null;
            return (
              <li key={w} className="grid gap-3 py-4 sm:grid-cols-[8rem_1fr] sm:items-center">
                <label className="flex min-h-11 cursor-pointer items-center gap-3 font-semibold">
                  <input type="checkbox" checked={d.open} onChange={(e) => update(w, { open: e.target.checked })} className="size-5 accent-[var(--brand-accent)]" />
                  {WEEKDAY_NAMES[w]}
                </label>
                {d.open ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-sm">{t.from}<TextInput type="time" value={d.start} onChange={(e) => update(w, { start: e.target.value })} className="mt-1 w-32" /></label>
                    <label className="text-sm">{t.to}<TextInput type="time" value={d.end} onChange={(e) => update(w, { end: e.target.value })} className="mt-1 w-32" /></label>
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" checked={d.lunch} onChange={(e) => update(w, { lunch: e.target.checked })} className="size-5 accent-[var(--brand-accent)]" />
                      {t.lunch}
                    </label>
                    {d.lunch && (
                      <>
                        <label className="text-sm">{t.lunchFrom}<TextInput type="time" value={d.breakStart} onChange={(e) => update(w, { breakStart: e.target.value })} className="mt-1 w-32" /></label>
                        <label className="text-sm">{t.lunchTo}<TextInput type="time" value={d.breakEnd} onChange={(e) => update(w, { breakEnd: e.target.value })} className="mt-1 w-32" /></label>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-muted">{t.closed}</p>
                )}
              </li>
            );
          })}
        </ul>
        {msg && <div className="mt-4"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
        {conflicts ? (
          <div className="mt-4">
            <ConflictDecision conflicts={conflicts} onDecide={(a) => save(a)} onCancel={() => setConflicts(null)} />
          </div>
        ) : (
          <ActionButton className="mt-4 w-full sm:w-auto" disabled={busy || !barberId} onClick={() => save("verificar")}>
            {busy ? appTexts.common.saving : t.saveSchedule}
          </ActionButton>
        )}
      </Card>
      <Exceptions barbers={barbers} />
    </div>
  );
}

function Exceptions({ barbers }: { barbers: Barber[] }) {
  const list = useLoader(useCallback(() => admin.exceptions(), []));
  const [pending, setPending] = useState<{ data: Parameters<typeof admin.addException>[0]; conflicts: Conflict[] } | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  async function submit(data: Parameters<typeof admin.addException>[0], action: "verificar" | "manter" | "cancelar") {
    try {
      const r = await admin.addException(data, action);
      if (!r.saved) {
        setPending({ data, conflicts: r.conflicts });
        return;
      }
      setPending(null);
      setMsg({ tone: "success", text: appTexts.admin.scheduleSaved });
      list.reload();
    } catch (err) {
      setMsg({ tone: "error", text: friendlyError(err) });
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const allDay = d.get("allDay") === "on";
    const startDay = String(d.get("startDay"));
    const endDay = String(d.get("endDay") || startDay);
    void submit(
      {
        barberId: String(d.get("barber") || "") || null,
        startsAt: localToIso(startDay, allDay ? "00:00" : String(d.get("startTime"))),
        endsAt: allDay ? localToIso(addDays(endDay, 1), "00:00") : localToIso(endDay, String(d.get("endTime"))),
        kind: String(d.get("kind")),
        reason: String(d.get("reason") ?? ""),
      },
      "verificar",
    );
  }

  return (
    <Card>
      <SectionTitle>{t.exceptionsTitle}</SectionTitle>
      <form onSubmit={onSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label={appTexts.booking.barber}>
          {(p) => (
            <SelectInput {...p} name="barber" defaultValue="">
              <option value="">{t.allBarbers}</option>
              {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </SelectInput>
          )}
        </Field>
        <Field label={t.kind}>
          {(p) => (
            <SelectInput {...p} name="kind" defaultValue="bloqueio">
              {Object.entries(t.exceptionKinds).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </SelectInput>
          )}
        </Field>
        <Field label={`${t.start} (${appTexts.booking.date})`}>{(p) => <TextInput {...p} name="startDay" type="date" required defaultValue={today()} />}</Field>
        <Field label={`${t.end} (${appTexts.booking.date})`}>{(p) => <TextInput {...p} name="endDay" type="date" />}</Field>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 sm:col-span-2">
          <input type="checkbox" name="allDay" defaultChecked className="size-5 accent-[var(--brand-accent)]" />
          {t.allDay}
        </label>
        <Field label={`${t.start} (${appTexts.booking.time})`}>{(p) => <TextInput {...p} name="startTime" type="time" defaultValue="09:00" />}</Field>
        <Field label={`${t.end} (${appTexts.booking.time})`}>{(p) => <TextInput {...p} name="endTime" type="time" defaultValue="18:00" />}</Field>
        <div className="sm:col-span-2"><Field label={t.reason}>{(p) => <TextInput {...p} name="reason" maxLength={200} />}</Field></div>
        <div className="sm:col-span-2"><ActionButton type="submit">{t.addException}</ActionButton></div>
      </form>
      {msg && <div className="mt-4"><Notice tone={msg.tone}>{msg.text}</Notice></div>}
      {pending && (
        <div className="mt-4">
          <ConflictDecision conflicts={pending.conflicts} onDecide={(a) => submit(pending.data, a)} onCancel={() => setPending(null)} />
        </div>
      )}
      <ul className="mt-6 divide-y divide-line">
        {(list.data ?? []).map((ex: ScheduleException) => (
          <li key={ex.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span>
              <strong>{t.exceptionKinds[ex.kind] ?? ex.kind}</strong> · {barbers.find((b) => b.id === ex.barber_id)?.name ?? t.allBarbers} ·{" "}
              {formatDate(ex.starts_at)} {formatTime(ex.starts_at)} → {formatDate(ex.ends_at)} {formatTime(ex.ends_at)}
              {ex.reason && ` · ${ex.reason}`}
            </span>
            <ActionButton variant="danger" onClick={() => admin.deleteException(ex.id).then(list.reload).catch((e) => setMsg({ tone: "error", text: friendlyError(e) }))}>
              {t.removeException}
            </ActionButton>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ------------------------------------------------------------------ Clientes e fidelidade
export function AdminCustomers() {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => admin.searchCustomers(term).then(setResults).catch((e) => setError(friendlyError(e))), 250);
    return () => clearTimeout(id);
  }, [term]);

  return (
    <div className="grid gap-8">
      <PageTitle>{t.customersTitle}</PageTitle>
      <Field label={t.search}>{(p) => <TextInput {...p} type="search" value={term} onChange={(e) => setTerm(e.target.value)} />}</Field>
      {error && <Notice tone="error">{error}</Notice>}
      {selected ? (
        <CustomerSheetView id={selected} onBack={() => setSelected(null)} />
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {results.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => setSelected(c.id)} className="flex min-h-14 w-full flex-wrap items-center justify-between gap-2 py-3 text-left hover:text-accent">
                <span className="font-semibold">{c.full_name}{c.role === "admin" && " · admin"}</span>
                <span className="text-sm text-muted">{c.phone} · {c.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CustomerSheetView({ id, onBack }: { id: string; onBack: () => void }) {
  const { profile: me } = useAuth();
  const sheet = useLoader(useCallback(() => admin.customer(id), [id]));
  const [msg, setMsg] = useState<Msg>(null);
  const s: CustomerSheet | null = sheet.data;
  if (!s) return <p className="text-muted">{sheet.error ?? appTexts.common.loading}</p>;

  async function act(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      setMsg({ tone: "success", text: ok });
      sheet.reload();
    } catch (err) {
      setMsg({ tone: "error", text: friendlyError(err) });
    }
  }

  function adjust(e: FormEvent<HTMLFormElement>, ruleId: string) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    void act(() => admin.adjustLoyalty(id, ruleId, Number(d.get("delta")), String(d.get("reason") ?? "")), appTexts.admin.saved);
  }

  return (
    <div className="grid gap-6">
      <ActionButton variant="ghost" onClick={onBack} className="self-start">{appTexts.common.back}</ActionButton>
      <Card>
        <p className="text-2xl font-semibold">{s.perfil.full_name}</p>
        <p className="text-muted">{s.perfil.phone} · {s.perfil.email}</p>
        <p className="mt-1 text-sm text-muted">Cliente desde {formatDate(s.perfil.created_at)} · Marketing: {s.perfil.marketing_opt_in ? "sim" : "não"}</p>
      </Card>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <section aria-labelledby="ficha-fidelidade" className="grid gap-3">
        <h2 id="ficha-fidelidade" className="font-display text-3xl font-bold uppercase">{t.loyaltyTitle}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {s.fidelidade.map((c) => (
            <Card key={c.rule_id}>
              <p className="font-semibold">{c.name}: {Math.max(0, c.points)}/{c.threshold}</p>
              <p className="text-sm text-muted">{loyaltyCardText(c)}</p>
              <form onSubmit={(e) => adjust(e, c.rule_id)} className="mt-3 grid gap-2">
                <TextInput name="delta" type="number" min={-20} max={20} defaultValue={1} aria-label={t.adjust} />
                <TextInput name="reason" placeholder={t.adjustReason} aria-label={t.adjustReason} required minLength={5} />
                <ActionButton type="submit" variant="outline">{t.adjust}</ActionButton>
              </form>
            </Card>
          ))}
        </div>
        <ul className="divide-y divide-line border-y border-line text-sm">
          {s.recompensas.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>{s.fidelidade.find((c) => c.rule_id === r.rule_id)?.reward_service_name ?? "Cortesia"} · {r.status} · {formatDate(r.created_at)}</span>
              {r.status === "disponivel" && (
                <ActionButton variant="danger" onClick={() => { const why = window.prompt(t.reasonPrompt); if (why) void act(() => admin.cancelReward(r.id, why), t.rewardCancelled); }}>
                  {t.cancelReward}
                </ActionButton>
              )}
            </li>
          ))}
        </ul>
        <details>
          <summary className="min-h-11 cursor-pointer py-2 font-semibold">{t.entries}</summary>
          <ul className="text-sm text-muted">
            {s.lancamentos.map((e) => (
              <li key={e.id}>{formatDate(e.created_at)} · {e.kind} · {e.delta > 0 ? `+${e.delta}` : e.delta}{e.reason && ` · ${e.reason}`}</li>
            ))}
          </ul>
        </details>
      </section>

      <section aria-labelledby="ficha-historico" className="grid gap-3">
        <h2 id="ficha-historico" className="font-display text-3xl font-bold uppercase">{appTexts.account.history}</h2>
        <ul className="divide-y divide-line border-y border-line">
          {s.agendamentos.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>{formatDate(a.starts_at)} {formatTime(a.starts_at)} · {a.service_name} · {a.barber_name}</span>
              <StatusBadge status={a.status} />
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        {s.perfil.id !== me?.id && (
          <ActionButton variant="outline" onClick={() => act(() => admin.setRole(id, s.perfil.role === "admin" ? "cliente" : "admin"), appTexts.admin.scheduleSaved)}>
            {s.perfil.role === "admin" ? t.removeAdmin : t.makeAdmin}
          </ActionButton>
        )}
        {s.perfil.id !== me?.id && (
          <ActionButton variant="danger" onClick={() => { if (window.confirm(t.anonymizeConfirm)) { const why = window.prompt(t.reasonPrompt); if (why) void act(() => admin.anonymize(id, why), t.anonymized); } }}>
            {t.anonymize}
          </ActionButton>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Configurações
export function AdminSettings() {
  const settings = useLoader(useCallback(() => catalog.settings(), []));
  const services = useLoader(useCallback(() => admin.allServices(), []));
  const barbers = useLoader(useCallback(() => admin.allBarbers(), []));
  const rules = useLoader(useCallback(() => catalog.rules(), []));
  const [msg, setMsg] = useState<Msg>(null);

  async function act(fn: () => Promise<unknown>, reload: () => void) {
    try {
      await fn();
      setMsg({ tone: "success", text: appTexts.admin.saved });
      reload();
    } catch (err) {
      setMsg({ tone: "error", text: friendlyError(err) });
    }
  }

  function saveSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const whatsapp = String(d.get("whatsapp") ?? "").replace(/\D/g, "");
    if (whatsapp && !isValidBrazilianWhatsApp(whatsapp)) {
      setMsg({ tone: "error", text: t.whatsappInvalid });
      return;
    }
    const num = (k: string) => Number(d.get(k));
    const patch: Partial<BusinessSettings> = {
      business_name: String(d.get("business_name") ?? "").trim(),
      whatsapp,
      min_notice_minutes: num("min_notice_minutes"),
      max_days_ahead: num("max_days_ahead"),
      slot_step_minutes: num("slot_step_minutes"),
      pending_expiry_hours: num("pending_expiry_hours"),
      max_active_requests: num("max_active_requests"),
      customer_cancel_notice_minutes: num("customer_cancel_notice_minutes"),
      reward_lost_on_no_show: d.get("reward_lost_on_no_show") === "on",
      loyalty_program_name: String(d.get("loyalty_program_name") ?? "").trim(),
    };
    void act(() => admin.updateSettings(patch), settings.reload);
  }

  const st = settings.data;
  return (
    <div className="grid gap-10">
      <PageTitle>{t.settingsTitle}</PageTitle>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {st && (
        <Card>
          <form onSubmit={saveSettings} className="grid gap-4 sm:grid-cols-2">
            <Field label={t.businessName}>{(p) => <TextInput {...p} name="business_name" defaultValue={st.business_name} required />}</Field>
            <Field label={t.whatsapp} hint={t.whatsappHint}>{(p) => <TextInput {...p} name="whatsapp" inputMode="numeric" defaultValue={st.whatsapp} />}</Field>
            <Field label={t.minNotice}>{(p) => <TextInput {...p} name="min_notice_minutes" type="number" min={0} defaultValue={st.min_notice_minutes} />}</Field>
            <Field label={t.maxDays}>{(p) => <TextInput {...p} name="max_days_ahead" type="number" min={1} max={180} defaultValue={st.max_days_ahead} />}</Field>
            <Field label={t.step}>
              {(p) => (
                <SelectInput {...p} name="slot_step_minutes" defaultValue={st.slot_step_minutes}>
                  {[5, 10, 15, 20, 30, 60].map((v) => <option key={v} value={v}>{v}</option>)}
                </SelectInput>
              )}
            </Field>
            <Field label={t.expiry}>{(p) => <TextInput {...p} name="pending_expiry_hours" type="number" min={1} max={168} defaultValue={st.pending_expiry_hours} />}</Field>
            <Field label={t.maxActive}>{(p) => <TextInput {...p} name="max_active_requests" type="number" min={1} max={20} defaultValue={st.max_active_requests} />}</Field>
            <Field label={t.cancelNotice}>{(p) => <TextInput {...p} name="customer_cancel_notice_minutes" type="number" min={0} defaultValue={st.customer_cancel_notice_minutes} />}</Field>
            <Field label={t.programName}>{(p) => <TextInput {...p} name="loyalty_program_name" defaultValue={st.loyalty_program_name} />}</Field>
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input type="checkbox" name="reward_lost_on_no_show" defaultChecked={st.reward_lost_on_no_show} className="size-5 accent-[var(--brand-accent)]" />
              {t.rewardLost}
            </label>
            <div className="sm:col-span-2"><ActionButton type="submit">{appTexts.common.save}</ActionButton></div>
          </form>
        </Card>
      )}

      <Card>
        <SectionTitle>{t.team}</SectionTitle>
        <ul className="mt-4 grid gap-4">
          {(barbers.data ?? []).map((b) => (
            <li key={b.id} className="rounded-sm border border-line p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = new FormData(e.currentTarget);
                  void act(async () => {
                    await admin.saveBarber({ id: b.id, name: String(d.get("name")), active: d.get("active") === "on", sort: b.sort });
                    await admin.setBarberServices(b.id, d.getAll("services").map(String));
                  }, barbers.reload);
                }}
                className="grid gap-3"
              >
                <div className="flex flex-wrap items-end gap-3">
                  <Field label={t.name}>{(p) => <TextInput {...p} name="name" defaultValue={b.name} />}</Field>
                  <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="active" defaultChecked={b.active} className="size-5 accent-[var(--brand-accent)]" />{t.active}</label>
                </div>
                <fieldset>
                  <legend className="text-sm text-muted">{t.services}</legend>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {(services.data ?? []).map((s) => (
                      <label key={s.id} className="flex min-h-11 items-center gap-2 text-sm">
                        <input type="checkbox" name="services" value={s.id} defaultChecked={b.service_ids.includes(s.id)} className="size-5 accent-[var(--brand-accent)]" />
                        {s.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <ActionButton type="submit" variant="outline" className="self-start">{appTexts.common.save}</ActionButton>
              </form>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const name = String(new FormData(form).get("name") ?? "").trim();
            void act(async () => {
              const r = await admin.saveBarber({ name, active: true, sort: (barbers.data?.length ?? 0) + 1 });
              await admin.setBarberServices(r.id, (services.data ?? []).filter((s) => s.active).map((s) => s.id));
              form.reset();
            }, barbers.reload);
          }}
          className="mt-4 flex flex-wrap items-end gap-3"
        >
          <Field label={t.addBarber}>{(p) => <TextInput {...p} name="name" required minLength={2} />}</Field>
          <ActionButton type="submit">{t.addBarber}</ActionButton>
        </form>
      </Card>

      <Card>
        <SectionTitle>{t.services}</SectionTitle>
        <ul className="mt-4 divide-y divide-line">
          {(services.data ?? []).map((s) => (
            <li key={s.id} className="py-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = new FormData(e.currentTarget);
                  void act(() => admin.saveService({ id: s.id, name: String(d.get("name")), duration_minutes: Number(d.get("duration")), active: d.get("active") === "on" }), services.reload);
                }}
                className="flex flex-wrap items-end gap-3"
              >
                <Field label={t.name}>{(p) => <TextInput {...p} name="name" defaultValue={s.name} />}</Field>
                <Field label={t.durationMin}>{(p) => <TextInput {...p} name="duration" type="number" min={5} max={480} defaultValue={s.duration_minutes} className="w-28" />}</Field>
                <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="active" defaultChecked={s.active} className="size-5 accent-[var(--brand-accent)]" />{t.active}</label>
                <ActionButton type="submit" variant="outline">{appTexts.common.save}</ActionButton>
              </form>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <SectionTitle>{t.rules}</SectionTitle>
        <ul className="mt-4 grid gap-4">
          {(rules.data ?? []).map((r: LoyaltyRule) => (
            <li key={r.id} className="rounded-sm border border-line p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = new FormData(e.currentTarget);
                  const eligible = d.getAll("eligible").map(String);
                  if (!eligible.length) {
                    setMsg({ tone: "error", text: t.ruleEligibleRequired });
                    return;
                  }
                  void act(() => admin.saveRule({ id: r.id, name: String(d.get("name")), threshold: Number(d.get("threshold")), active: d.get("active") === "on", eligible_service_ids: eligible, reward_service_id: String(d.get("reward")) }), rules.reload);
                }}
                className="grid gap-3"
              >
                <div className="flex flex-wrap items-end gap-3">
                  <Field label={t.ruleName}>{(p) => <TextInput {...p} name="name" defaultValue={r.name} />}</Field>
                  <Field label={t.threshold}>{(p) => <TextInput {...p} name="threshold" type="number" min={1} max={100} defaultValue={r.threshold} className="w-28" />}</Field>
                  <Field label={t.ruleReward}>
                    {(p) => (
                      <SelectInput {...p} name="reward" defaultValue={r.reward_service_id}>
                        {(services.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </SelectInput>
                    )}
                  </Field>
                  <label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="active" defaultChecked={r.active} className="size-5 accent-[var(--brand-accent)]" />{t.active}</label>
                </div>
                <fieldset>
                  <legend className="text-sm text-muted">{t.ruleEligible}</legend>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {(services.data ?? []).map((s) => (
                      <label key={s.id} className="flex min-h-11 items-center gap-2 text-sm">
                        <input type="checkbox" name="eligible" value={s.id} defaultChecked={r.eligible_service_ids.includes(s.id)} className="size-5 accent-[var(--brand-accent)]" />
                        {s.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <ActionButton type="submit" variant="outline" className="self-start">{appTexts.common.save}</ActionButton>
              </form>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ Privacidade e auditoria
export function AdminPrivacy() {
  const requests = useLoader(useCallback(() => admin.privacyRequests(), []));
  const audit = useLoader(useCallback(() => admin.auditLog(), []));
  const [msg, setMsg] = useState<Msg>(null);

  function resolve(e: FormEvent<HTMLFormElement>, r: PrivacyRequest) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    admin
      .resolvePrivacy(r.id, String(d.get("status")), String(d.get("resolution") ?? ""))
      .then(() => {
        setMsg({ tone: "success", text: appTexts.admin.scheduleSaved });
        requests.reload();
      })
      .catch((err) => setMsg({ tone: "error", text: friendlyError(err) }));
  }

  return (
    <div className="grid gap-10">
      <PageTitle>{t.privacyTitle}</PageTitle>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <ul className="grid gap-4">
        {(requests.data ?? []).length === 0 && <p className="text-muted">{t.empty}</p>}
        {(requests.data ?? []).map((r) => (
          <li key={r.id}>
            <Card>
              <p className="font-semibold">{appTexts.account.requestKinds[r.kind] ?? r.kind} · {t.statuses[r.status] ?? r.status}</p>
              <p className="text-sm text-muted">{r.customer?.full_name} · {r.customer?.email} · {formatDate(r.created_at)}</p>
              {r.details && <p className="mt-2">{r.details}</p>}
              <form onSubmit={(e) => resolve(e, r)} className="mt-3 grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
                <Field label={t.status}>
                  {(p) => (
                    <SelectInput {...p} name="status" defaultValue={r.status === "aberta" ? "em_andamento" : r.status}>
                      {["em_andamento", "concluida", "recusada"].map((s) => <option key={s} value={s}>{t.statuses[s]}</option>)}
                    </SelectInput>
                  )}
                </Field>
                <Field label={t.resolution}>{(p) => <TextArea {...p} name="resolution" rows={1} defaultValue={r.resolution ?? ""} />}</Field>
                <ActionButton type="submit" variant="outline">{t.resolve}</ActionButton>
              </form>
            </Card>
          </li>
        ))}
      </ul>
      <section aria-labelledby="auditoria">
        <h2 id="auditoria" className="font-display text-3xl font-bold uppercase">{t.auditTitle}</h2>
        <ul className="mt-3 divide-y divide-line border-y border-line text-sm">
          {(audit.data ?? []).map((l) => (
            <li key={l.id} className="py-2">{formatDate(l.created_at)} {formatTime(l.created_at)} · {l.action} · {l.entity}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
