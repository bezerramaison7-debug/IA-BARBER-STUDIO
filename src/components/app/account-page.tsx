"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { appTexts } from "@/config/texts-app";
import { WhatsAppIcon } from "@/components/ui/icons";
import { auth, catalog, me, type Appointment, type BusinessSettings, type PrivacyRequest, type Reward } from "@/lib/booking/api";
import { formatDate, formatLongDate, formatTime } from "@/lib/booking/datetime";
import { isUpcoming, loyaltyCardText, type LoyaltyCard } from "@/lib/booking/domain";
import { friendlyError } from "@/lib/booking/errors";
import { buildConfirmationUrl } from "@/lib/booking/whatsapp-confirmation";
import { NewPasswordForm } from "./auth-forms";
import { useAuth } from "./auth-context";
import { useAsync } from "./use-async";
import { ActionButton, Card, Field, Notice, PageTitle, SectionTitle, SelectInput, StatusBadge, TextArea, TextInput } from "./ui";

const t = appTexts.account;

export function AccountPage() {
  const { profile, refresh } = useAuth();
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const query = useAsync("conta", () =>
    Promise.all([me.appointments(), me.loyalty(), me.rewards(), catalog.settings(), me.privacyRequests()]),
  );
  const [appointments, cards, rewards, settings, requests] = (query.data ?? [null, [], [], null, []]) as [
    Appointment[] | null,
    LoyaltyCard[],
    Reward[],
    BusinessSettings | null,
    PrivacyRequest[],
  ];
  const load = async () => query.reload();

  if (!profile) return <p className="text-muted">{appTexts.common.loading}</p>;

  const upcoming = (appointments ?? []).filter((a) => isUpcoming(a.status, a.starts_at)).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const history = (appointments ?? []).filter((a) => !isUpcoming(a.status, a.starts_at));
  const available = rewards.filter((r) => r.status === "disponivel");

  async function cancel(a: Appointment) {
    if (!window.confirm(t.cancelConfirm)) return;
    try {
      await me.cancel(a.id);
      await load();
    } catch (err) {
      setMessage({ tone: "error", text: friendlyError(err) });
    }
  }

  function whatsappFor(a: Appointment) {
    if (!settings || !profile) return null;
    return buildConfirmationUrl(settings.whatsapp, {
      businessName: settings.business_name,
      protocol: a.protocol,
      customerName: profile.full_name,
      serviceName: a.service_name,
      barberName: a.barber?.name ?? "",
      startsAt: a.starts_at,
      isReward: a.is_reward,
    }).url;
  }

  return (
    <div className="grid gap-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle intro={`${profile.full_name} · ${profile.email ?? ""}`}>{t.title}</PageTitle>
        <ActionButton
          variant="outline"
          onClick={async () => {
            await auth.signOut();
            router.replace("/entrar");
          }}
        >
          {appTexts.nav.signOut}
        </ActionButton>
      </div>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {query.error ? <Notice tone="error">{friendlyError(query.error)}</Notice> : null}

      <section aria-labelledby="proximos" className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="proximos" className="font-display text-3xl font-bold uppercase">{t.upcoming}</h2>
          <Link href="/agendar" className="inline-flex min-h-11 items-center rounded-sm bg-accent px-5 font-semibold text-accent-foreground">
            {appTexts.nav.book}
          </Link>
        </div>
        {appointments === null ? (
          <p className="text-muted">{appTexts.common.loading}</p>
        ) : upcoming.length === 0 ? (
          <p className="text-muted">{t.noUpcoming}</p>
        ) : (
          <ul className="grid gap-3">
            {upcoming.map((a) => (
              <li key={a.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">{a.service_name}{a.is_reward && ` · ${appTexts.booking.rewardFree}`}</p>
                      <p>{formatLongDate(a.starts_at)} · {formatTime(a.starts_at)}</p>
                      <p className="text-sm text-muted">{a.barber?.name} · {appTexts.booking.protocol} {a.protocol}</p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {a.status === "pendente" && whatsappFor(a) && (
                      <a href={whatsappFor(a)!} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-[#25d366] px-4 font-semibold text-black">
                        <WhatsAppIcon /> {t.sendWhatsapp}
                        <span className="sr-only"> ({appTexts.common.newTab})</span>
                      </a>
                    )}
                    <Link href={`/agendar?reagendar=${a.id}`} className="inline-flex min-h-11 items-center rounded-sm border border-foreground/40 px-4 font-semibold hover:border-accent">
                      {t.reschedule}
                    </Link>
                    <ActionButton variant="danger" onClick={() => cancel(a)}>{t.cancel}</ActionButton>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {cards.length > 0 && (
        <section aria-labelledby="fidelidade" className="grid gap-4">
          <h2 id="fidelidade" className="font-display text-3xl font-bold uppercase">{settings?.loyalty_program_name ?? t.loyaltyTitle}</h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {cards.map((c) => {
              const points = Math.max(0, Math.min(c.points, c.threshold));
              return (
                <li key={c.rule_id}>
                  <Card className="h-full">
                    <p className="font-semibold">{c.name}</p>
                    <p className="mt-1 font-display text-4xl font-extrabold">
                      {points}/{c.threshold}
                    </p>
                    {/* Carimbos do cartão: visual; o texto ao lado é a informação acessível. */}
                    <div aria-hidden="true" className="mt-3 grid grid-cols-10 gap-1">
                      {Array.from({ length: c.threshold }, (_, i) => (
                        <span key={i} className={`h-3 rounded-full ${i < points ? "bg-accent" : "bg-surface-raised"}`} />
                      ))}
                    </div>
                    <p className="mt-3 text-sm text-muted">{loyaltyCardText(c)}</p>
                    {c.available_rewards > 0 && (
                      <div className="mt-4">
                        <p className="font-semibold text-accent">{t.rewardsAvailable}: {c.available_rewards}</p>
                        <Link
                          href={`/agendar?servico=${c.reward_service_id}&cortesia=${available.find((r) => r.rule_id === c.rule_id)?.id ?? ""}`}
                          className="mt-2 inline-flex min-h-11 items-center rounded-sm bg-accent px-4 font-semibold text-accent-foreground"
                        >
                          {t.useReward}: {c.reward_service_name}
                        </Link>
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="historico" className="grid gap-4">
        <h2 id="historico" className="font-display text-3xl font-bold uppercase">{t.history}</h2>
        {history.length === 0 ? (
          <p className="text-muted">{t.noHistory}</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {history.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span>
                  {formatDate(a.starts_at)} · {a.service_name}
                  {a.is_reward && ` · ${appTexts.booking.rewardFree}`}
                </span>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <ProfileForm onSaved={refresh} />

      <section aria-labelledby="senha" className="grid gap-4">
        <h2 id="senha" className="font-display text-3xl font-bold uppercase">{t.passwordTitle}</h2>
        <NewPasswordForm title={t.passwordTitle} />
      </section>

      <PrivacySection requests={requests} onSent={load} />
    </div>
  );
}

function ProfileForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const { profile } = useAuth();
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  if (!profile) return null;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    try {
      await me.updateProfile(profile!.id, {
        full_name: String(data.get("full_name") ?? "").trim(),
        phone: String(data.get("phone") ?? "").replace(/\D/g, ""),
        marketing_opt_in: data.get("marketing") === "on",
      });
      await onSaved();
      setNotice({ tone: "success", text: t.profileSaved });
    } catch (err) {
      setNotice({ tone: "error", text: friendlyError(err) });
    }
  }

  return (
    <section aria-labelledby="dados" className="grid gap-4">
      <SectionTitle>
        <span id="dados">{t.profileTitle}</span>
      </SectionTitle>
      <form onSubmit={onSubmit} className="grid max-w-xl gap-5">
        <Field label={appTexts.auth.fullName}>{(p) => <TextInput {...p} name="full_name" defaultValue={profile.full_name} autoComplete="name" />}</Field>
        <Field label={appTexts.auth.phone}>{(p) => <TextInput {...p} name="phone" type="tel" defaultValue={profile.phone} autoComplete="tel" />}</Field>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" name="marketing" defaultChecked={profile.marketing_opt_in} className="mt-1 size-5 accent-[var(--brand-accent)]" />
          <span>{appTexts.auth.marketing}</span>
        </label>
        {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
        <ActionButton type="submit" className="w-full sm:w-auto">{appTexts.common.save}</ActionButton>
      </form>
    </section>
  );
}

function PrivacySection({ requests, onSent }: { requests: PrivacyRequest[]; onSent: () => Promise<void> }) {
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function download() {
    try {
      const data = await me.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "meus-dados.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setNotice({ tone: "error", text: friendlyError(err) });
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    try {
      await me.createPrivacyRequest(String(data.get("kind")), String(data.get("details") ?? ""));
      form.reset();
      setNotice({ tone: "success", text: t.requestSent });
      await onSent();
    } catch (err) {
      setNotice({ tone: "error", text: friendlyError(err) });
    }
  }

  return (
    <section aria-labelledby="privacidade" className="grid gap-4">
      <h2 id="privacidade" className="font-display text-3xl font-bold uppercase">{t.privacyTitle}</h2>
      <p className="max-w-xl text-muted">{t.privacyIntro}</p>
      <div>
        <ActionButton variant="outline" onClick={download}>{t.export}</ActionButton>
      </div>
      <form onSubmit={onSubmit} className="grid max-w-xl gap-5">
        <Field label={t.requestKind}>
          {(p) => (
            <SelectInput {...p} name="kind" defaultValue="correcao">
              {Object.entries(t.requestKinds).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </SelectInput>
          )}
        </Field>
        <Field label={t.requestDetails}>{(p) => <TextArea {...p} name="details" rows={3} maxLength={1000} />}</Field>
        {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
        <ActionButton type="submit" className="w-full sm:w-auto">{t.requestSend}</ActionButton>
      </form>
      {requests.length > 0 && (
        <div>
          <h3 className="font-semibold">{t.requestsMine}</h3>
          <ul className="mt-2 divide-y divide-line border-y border-line text-sm">
            {requests.map((r) => (
              <li key={r.id} className="py-2">
                {formatDate(r.created_at)} · {t.requestKinds[r.kind] ?? r.kind} · {appTexts.admin.statuses[r.status] ?? r.status}
                {r.resolution && <span className="block text-muted">{r.resolution}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
