"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { appTexts } from "@/config/texts-app";
import { WhatsAppIcon } from "@/components/ui/icons";
import { catalog, me, type Appointment, type Barber, type BusinessSettings, type LoyaltyRule, type Reward, type Service, type Slot } from "@/lib/booking/api";
import { formatDayKey, formatLongDate, formatTime } from "@/lib/booking/datetime";
import { errorCode, friendlyError } from "@/lib/booking/errors";
import { buildConfirmationUrl } from "@/lib/booking/whatsapp-confirmation";
import { formatDuration, formatPrice } from "@/lib/format";
import { useAuth } from "./auth-context";
import { useAsync } from "./use-async";
import { ActionButton, Field, Notice, PageTitle, TextArea } from "./ui";

const t = appTexts.booking;
const ANY = "qualquer";

interface Done {
  id: string;
  protocol: string;
  whatsappUrl: string;
  hasRecipient: boolean;
}

function newKey() {
  return crypto.randomUUID();
}

/** Botão grande de opção (lista de serviços, profissionais, dias e horários). */
function Choice({ selected, onClick, children, label }: { selected: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      className={`flex min-h-14 w-full flex-col items-start justify-center rounded-sm border px-4 py-3 text-left transition-colors ${
        selected ? "border-accent bg-accent/10" : "border-line bg-surface hover:border-foreground/40"
      }`}
    >
      {children}
    </button>
  );
}

export function BookingFlow() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { ready, session, profile } = useAuth();

  const serviceId = params.get("servico");
  const barberParam = params.get("profissional");
  const day = params.get("data");
  const time = params.get("hora"); // ISO do início
  const rescheduleId = params.get("reagendar");
  const rewardParam = params.get("cortesia");

  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [rules, setRules] = useState<LoyaltyRule[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [useReward, setUseReward] = useState(Boolean(rewardParam));
  const [notes, setNotes] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  // Uma chave por tentativa: clique repetido ou nova tentativa após erro de rede não duplica.
  const requestKey = useRef(newKey());

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      requestKey.current = newKey();
    },
    [params, pathname, router],
  );

  useEffect(() => {
    Promise.all([catalog.services(), catalog.barbers(), catalog.settings(), catalog.rules()])
      .then(([s, b, st, r]) => {
        setServices(s);
        setBarbers(b);
        setSettings(st);
        setRules(r);
      })
      .catch((err) => setError(friendlyError(err)));
  }, []);

  useEffect(() => {
    if (!session) return;
    me.rewards().then((r) => setRewards(r.filter((x) => x.status === "disponivel"))).catch(() => {});
    if (rescheduleId) {
      me.appointments()
        .then((list) => {
          const appt = list.find((a) => a.id === rescheduleId) ?? null;
          setRescheduling(appt);
          if (appt && !serviceId) setParams({ servico: appt.service_id, profissional: appt.barber_id });
        })
        .catch(() => {});
    }
  }, [session, rescheduleId, serviceId, setParams]);

  const service = services.find((s) => s.id === serviceId) ?? null;
  const barberId = barberParam && barberParam !== ANY ? barberParam : null;
  const barber = barbers.find((b) => b.id === barberId) ?? null;
  const barberOptions = useMemo(() => barbers.filter((b) => service && b.service_ids.includes(service.id)), [barbers, service]);

  const daysQuery = useAsync(service && barberParam ? `${service.id}|${barberParam}` : null, () =>
    catalog.availableDays(service!.id, barberId),
  );
  const slotsQuery = useAsync(service && barberParam && day ? `${service.id}|${barberParam}|${day}` : null, () =>
    catalog.availableSlots(service!.id, day!, barberId),
  );
  const days = daysQuery.data;
  const slots = slotsQuery.data;
  const loadError = daysQuery.error ?? slotsQuery.error;

  // Com "qualquer profissional", mostra cada horário uma vez.
  const times = useMemo(() => {
    const seen = new Map<string, Slot>();
    for (const s of slots ?? []) if (!seen.has(s.slot_start)) seen.set(s.slot_start, s);
    return [...seen.values()];
  }, [slots]);

  const eligibleReward = useMemo(() => {
    if (!service) return null;
    const ruleIds = new Set(rules.filter((r) => r.reward_service_id === service.id).map((r) => r.id));
    return rewards.find((r) => ruleIds.has(r.rule_id) && (!rewardParam || r.id === rewardParam)) ?? null;
  }, [rewards, rules, service, rewardParam]);

  const step = !service ? 0 : !barberParam ? 1 : !day ? 2 : !time ? 3 : 4;

  async function submit() {
    if (!service || !time || !profile || !settings) return;
    setBusy(true);
    setError(null);
    try {
      const rewardId = useReward && eligibleReward && !rescheduling ? eligibleReward.id : null;
      const result = rescheduling
        ? await me.reschedule(rescheduling.id, time, requestKey.current, barberId)
        : await me.requestAppointment({ serviceId: service.id, start: time, requestKey: requestKey.current, barberId, rewardId, notes });
      const chosenBarber =
        barber?.name ?? (await me.appointments().then((l) => l.find((a) => a.id === result.id)?.barber?.name)) ?? t.barber;
      const { url, hasRecipient } = buildConfirmationUrl(settings.whatsapp, {
        businessName: settings.business_name,
        protocol: result.protocol,
        customerName: profile.full_name,
        serviceName: service.name,
        barberName: chosenBarber,
        startsAt: time,
        isReward: Boolean(rewardId),
      });
      setDone({ id: result.id, protocol: result.protocol, whatsappUrl: url, hasRecipient });
    } catch (err) {
      setError(friendlyError(err));
      if (errorCode(err) === "ocupado" || errorCode(err) === "antecedencia") {
        setParams({ hora: null });
        slotsQuery.reload();
      }
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="grid gap-6">
        <PageTitle>{t.successTitle}</PageTitle>
        <Notice tone="success">
          <p className="text-base font-semibold">{t.successText}</p>
          <p className="mt-2">
            {t.protocol}: <strong className="font-display text-xl tracking-wider">{done.protocol}</strong>
          </p>
        </Notice>
        <p>{t.whatsappStep}</p>
        <a
          href={done.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-14 items-center justify-center gap-3 rounded-sm bg-[#25d366] px-6 text-lg font-semibold text-black"
        >
          <WhatsAppIcon className="text-2xl" /> {t.whatsappButton}
          <span className="sr-only"> ({appTexts.common.newTab})</span>
        </a>
        <p className="text-sm text-muted">{t.whatsappWarning}</p>
        {!done.hasRecipient && <p className="text-sm text-muted">{appTexts.common.demoWhatsapp}</p>}
        <Link href="/minha-conta" className="inline-flex min-h-11 items-center font-semibold underline decoration-accent underline-offset-4">
          {t.seeAppointments}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <PageTitle intro={rescheduling ? `${t.rescheduling}: ${rescheduling.service_name}, ${formatLongDate(rescheduling.starts_at)} ${formatTime(rescheduling.starts_at)}` : undefined}>
        {t.title}
      </PageTitle>

      <ol className="mb-8 flex flex-wrap gap-2 text-sm" aria-label={t.stepsLabel}>
        {t.steps.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? "step" : undefined}
            className={`rounded-full border px-3 py-1 ${i === step ? "border-accent text-accent" : i < step ? "border-line text-foreground" : "border-line text-muted"}`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {(error || loadError) && (
        <div className="mb-6">
          <Notice tone="error">{error ?? friendlyError(loadError)}</Notice>
        </div>
      )}

      {/* 1. Serviço */}
      <section aria-labelledby="passo-servico" className="mb-8">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="passo-servico" className="text-xl font-semibold">{t.chooseService}</h2>
          {service && !rescheduling && (
            <ActionButton variant="ghost" onClick={() => setParams({ servico: null, profissional: null, data: null, hora: null })}>{t.change}</ActionButton>
          )}
        </div>
        {service ? (
          <p className="mt-2 text-lg">{service.name} · {formatDuration(service.duration_minutes)}</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {services.map((s) => (
              <li key={s.id}>
                <Choice selected={false} onClick={() => setParams({ servico: s.id, profissional: null, data: null, hora: null })}>
                  <span className="font-semibold">{s.name}</span>
                  <span className="text-sm text-muted">
                    {formatDuration(s.duration_minutes)}
                    {s.price_cents !== null && ` · ${s.price_from ? `${appTexts.common.priceFrom} ` : ""}${formatPrice(s.price_cents / 100)}`}
                  </span>
                </Choice>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 2. Profissional */}
      {service && (
        <section aria-labelledby="passo-profissional" className="mb-8">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="passo-profissional" className="text-xl font-semibold">{t.chooseBarber}</h2>
            {barberParam && <ActionButton variant="ghost" onClick={() => setParams({ profissional: null, data: null, hora: null })}>{t.change}</ActionButton>}
          </div>
          {barberParam ? (
            <p className="mt-2 text-lg">{barber?.name ?? t.anyBarber}</p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              <li>
                <Choice selected={false} onClick={() => setParams({ profissional: ANY, data: null, hora: null })}>
                  <span className="font-semibold">{appTexts.common.noPreference}</span>
                  <span className="text-sm text-muted">{t.anyBarber}</span>
                </Choice>
              </li>
              {barberOptions.map((b) => (
                <li key={b.id}>
                  <Choice selected={false} onClick={() => setParams({ profissional: b.id, data: null, hora: null })}>
                    <span className="font-semibold">{b.name}</span>
                  </Choice>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* 3. Data */}
      {service && barberParam && (
        <section aria-labelledby="passo-data" className="mb-8">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="passo-data" className="text-xl font-semibold">{t.chooseDay}</h2>
            {day && <ActionButton variant="ghost" onClick={() => setParams({ data: null, hora: null })}>{t.change}</ActionButton>}
          </div>
          {day ? (
            <p className="mt-2 text-lg">{formatLongDate(`${day}T12:00:00-03:00`)}</p>
          ) : days === null ? (
            <p className="mt-4 text-muted">{appTexts.common.loading}</p>
          ) : days.length === 0 ? (
            <div className="mt-4"><Notice>{t.noDays}</Notice></div>
          ) : (
            <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {days.map((d) => (
                <li key={d.day}>
                  <Choice selected={false} onClick={() => setParams({ data: d.day, hora: null })} label={formatLongDate(`${d.day}T12:00:00-03:00`)}>
                    <span className="font-semibold">{formatDayKey(d.day)}</span>
                  </Choice>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* 4. Horário */}
      {service && barberParam && day && (
        <section aria-labelledby="passo-hora" className="mb-8">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="passo-hora" className="text-xl font-semibold">{t.chooseTime}</h2>
            {time && <ActionButton variant="ghost" onClick={() => setParams({ hora: null })}>{t.change}</ActionButton>}
          </div>
          {time ? (
            <p className="mt-2 text-lg">{formatTime(time)}</p>
          ) : slots === null ? (
            <p className="mt-4 text-muted">{appTexts.common.loading}</p>
          ) : times.length === 0 ? (
            <div className="mt-4"><Notice>{t.noTimes}</Notice></div>
          ) : (
            <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {times.map((s) => (
                <li key={s.slot_start}>
                  <Choice selected={false} onClick={() => setParams({ hora: s.slot_start })}>
                    <span className="w-full text-center text-lg font-semibold tabular-nums">{formatTime(s.slot_start)}</span>
                  </Choice>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* 5. Revisão */}
      {service && barberParam && day && time && (
        <section aria-labelledby="passo-revisao" className="rounded-sm border border-accent/50 bg-surface p-5 sm:p-6">
          <h2 id="passo-revisao" className="text-xl font-semibold">{t.review}</h2>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
            <dt className="text-muted">{t.service}</dt><dd>{service.name}</dd>
            <dt className="text-muted">{t.barber}</dt><dd>{barber?.name ?? t.anyBarber}</dd>
            <dt className="text-muted">{t.date}</dt><dd>{formatLongDate(time)}</dd>
            <dt className="text-muted">{t.time}</dt><dd>{formatTime(time)}</dd>
            <dt className="text-muted">{t.duration}</dt><dd>{formatDuration(service.duration_minutes)}</dd>
            {service.price_cents !== null && (
              <>
                <dt className="text-muted">{t.price}</dt>
                <dd>{useReward && eligibleReward ? t.rewardFree : `${service.price_from ? `${appTexts.common.priceFrom} ` : ""}${formatPrice(service.price_cents / 100)}`}</dd>
              </>
            )}
          </dl>
          <p className="mt-3 text-sm text-muted">{t.priceNote}</p>

          {!ready ? (
            <p className="mt-6 text-muted">{appTexts.common.loading}</p>
          ) : !session ? (
            <div className="mt-6 grid gap-3">
              <p className="font-semibold">{t.signInToBook}</p>
              <div className="flex flex-wrap gap-3">
                <Link href={`/entrar?next=${encodeURIComponent(`${pathname}?${params.toString()}`)}`} className="inline-flex min-h-11 items-center rounded-sm bg-accent px-5 font-semibold text-accent-foreground">
                  {appTexts.auth.signInButton}
                </Link>
                <Link href={`/cadastro?next=${encodeURIComponent(`${pathname}?${params.toString()}`)}`} className="inline-flex min-h-11 items-center rounded-sm border border-foreground/40 px-5 font-semibold">
                  {appTexts.auth.createAccount}
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-6 grid gap-5">
              {!rescheduling && eligibleReward && (
                <label className="flex min-h-11 cursor-pointer items-center gap-3">
                  <input type="checkbox" checked={useReward} onChange={(e) => setUseReward(e.target.checked)} className="size-5 accent-[var(--brand-accent)]" />
                  <span>{t.useReward}</span>
                </label>
              )}
              {!rescheduling && (
                <Field label={t.notes}>{(p) => <TextArea {...p} rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
              )}
              <ActionButton onClick={submit} disabled={busy || !profile} className="min-h-14 w-full text-lg sm:w-auto">
                {busy ? t.submitting : rescheduling ? t.rescheduleSubmit : t.submit}
              </ActionButton>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
