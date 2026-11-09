"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { appTexts } from "@/config/texts-app";
import { WhatsAppIcon } from "@/components/ui/icons";
import { catalog, type Barber, type BusinessSettings, type Service, type Slot } from "@/lib/booking/api";
import { formatDayKey, formatLongDate, formatTime } from "@/lib/booking/datetime";
import { validateContact, type ContactInput } from "@/lib/booking/domain";
import { friendlyError } from "@/lib/booking/errors";
import { buildRequestUrl } from "@/lib/booking/whatsapp-confirmation";
import { formatDuration, formatPrice } from "@/lib/format";
import { useAsync } from "./use-async";
import { ActionButton, Field, Notice, PageTitle, TextArea, TextInput } from "./ui";

const t = appTexts.booking;
const ANY = "qualquer";

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

/**
 * Solicitação pública de horário: Serviço → Profissional → Data → Horário → Nome e telefone → WhatsApp.
 * - Só LÊ do banco (catálogo e horários livres). Não grava nada e não reserva horário.
 * - Nome, telefone e observação ficam só na memória desta página (nunca na URL nem no navegador)
 *   e seguem apenas na mensagem que a pessoa decide enviar pelo WhatsApp.
 */
export function BookingFlow() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Só escolhas sem dado pessoal vão para a URL (permite voltar e compartilhar o horário).
  const serviceId = params.get("servico");
  const barberParam = params.get("profissional");
  const day = params.get("data");
  const time = params.get("hora"); // ISO do início

  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contact, setContact] = useState<ContactInput & { notes: string }>({ fullName: "", phone: "", notes: "" });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ContactInput, string>>>({});
  const [ready, setReady] = useState<{ url: string; hasRecipient: boolean } | null>(null);

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      setReady(null);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  useEffect(() => {
    Promise.all([catalog.services(), catalog.barbers(), catalog.settings()])
      .then(([s, b, st]) => {
        setServices(s);
        setBarbers(b);
        setSettings(st);
      })
      .catch((err) => setError(friendlyError(err)));
  }, []);

  const service = services.find((s) => s.id === serviceId) ?? null;
  const barberId = barberParam && barberParam !== ANY ? barberParam : null;
  const barber = barbers.find((b) => b.id === barberId) ?? null;
  const barberOptions = useMemo(() => barbers.filter((b) => service && b.service_ids.includes(service.id)), [barbers, service]);

  const daysQuery = useAsync(service && barberParam ? `${service.id}|${barberParam}` : null, () => catalog.availableDays(service!.id, barberId));
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

  const step = !service ? 0 : !barberParam ? 1 : !day ? 2 : !time ? 3 : 4;

  function prepare(e: FormEvent) {
    e.preventDefault();
    if (!service || !time || !settings) return;
    const errors = validateContact(contact);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    setReady(
      buildRequestUrl(settings.whatsapp, {
        businessName: settings.business_name,
        customerName: contact.fullName,
        customerPhone: contact.phone,
        serviceName: service.name,
        barberName: barber?.name ?? null,
        startsAt: time,
        notes: contact.notes,
      }),
    );
  }

  return (
    <div>
      <PageTitle intro={t.intro}>{t.title}</PageTitle>

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
          {service && <ActionButton variant="ghost" onClick={() => setParams({ servico: null, profissional: null, data: null, hora: null })}>{t.change}</ActionButton>}
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

      {/* 4. Horário (só os livres) */}
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

      {/* 5. Nome e telefone → WhatsApp */}
      {service && barberParam && day && time && (
        <section aria-labelledby="passo-dados" className="rounded-sm border border-accent/50 bg-surface p-5 sm:p-6">
          <h2 id="passo-dados" className="text-xl font-semibold">{ready ? t.readyTitle : t.contactTitle}</h2>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
            <dt className="text-muted">{t.service}</dt><dd>{service.name}</dd>
            <dt className="text-muted">{t.barber}</dt><dd>{barber?.name ?? appTexts.common.noPreference}</dd>
            <dt className="text-muted">{t.date}</dt><dd>{formatLongDate(time)}</dd>
            <dt className="text-muted">{t.time}</dt><dd>{formatTime(time)}</dd>
            <dt className="text-muted">{t.duration}</dt><dd>{formatDuration(service.duration_minutes)}</dd>
            {service.price_cents !== null && (
              <>
                <dt className="text-muted">{t.price}</dt>
                <dd>{`${service.price_from ? `${appTexts.common.priceFrom} ` : ""}${formatPrice(service.price_cents / 100)}`}</dd>
              </>
            )}
          </dl>
          <p className="mt-3 text-sm text-muted">{t.priceNote}</p>

          {ready ? (
            <div className="mt-6 grid gap-5">
              <Notice tone="warning">
                <p className="text-base font-semibold">{t.notReserved}</p>
                <p className="mt-1">{t.notReservedText}</p>
              </Notice>
              <a
                href={ready.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-14 items-center justify-center gap-3 rounded-sm bg-[#25d366] px-6 text-lg font-semibold text-black"
              >
                <WhatsAppIcon className="text-2xl" /> {t.whatsappButton}
                <span className="sr-only"> ({appTexts.common.newTab})</span>
              </a>
              <p className="text-sm text-muted">{t.whatsappAfter}</p>
              {!ready.hasRecipient && <p className="text-sm text-muted">{appTexts.common.demoWhatsapp}</p>}
              <ActionButton variant="ghost" onClick={() => setReady(null)}>{t.editData}</ActionButton>
            </div>
          ) : (
            <form onSubmit={prepare} noValidate className="mt-6 grid gap-5">
              <Field label={t.fullName} error={fieldErrors.fullName}>
                {(p) => <TextInput {...p} autoComplete="name" maxLength={120} value={contact.fullName} onChange={(e) => setContact({ ...contact, fullName: e.target.value })} />}
              </Field>
              <Field label={t.phone} hint={t.phoneHint} error={fieldErrors.phone}>
                {(p) => <TextInput {...p} type="tel" inputMode="tel" autoComplete="tel" maxLength={20} value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />}
              </Field>
              <Field label={t.notes}>
                {(p) => <TextArea {...p} rows={2} maxLength={300} value={contact.notes} onChange={(e) => setContact({ ...contact, notes: e.target.value })} />}
              </Field>
              <p className="text-sm text-muted">
                {t.privacyNotice}{" "}
                <Link href="/privacidade" className="underline underline-offset-4 hover:text-accent">{t.privacyLink}</Link>.
              </p>
              <ActionButton type="submit" disabled={!settings} className="min-h-14 w-full text-lg sm:w-auto">
                <WhatsAppIcon className="text-xl" /> {t.prepare}
              </ActionButton>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
