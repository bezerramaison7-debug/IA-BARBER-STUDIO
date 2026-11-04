"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { appTexts } from "@/config/texts-app";
import { WhatsAppIcon } from "@/components/ui/icons";
import { admin, type Appointment, type Conflict } from "@/lib/booking/api";
import { dayKey, formatDate, formatTime } from "@/lib/booking/datetime";
import { ACTION_LABEL, ADMIN_TRANSITIONS, needsReason, type AppointmentStatus } from "@/lib/booking/domain";
import { friendlyError } from "@/lib/booking/errors";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { RequireAuth } from "./auth-context";
import { ActionButton, Card, Notice, StatusBadge } from "./ui";

const t = appTexts.admin;

const NAV = [
  { href: "/admin", label: t.nav.today },
  { href: "/admin/agenda", label: t.nav.agenda },
  { href: "/admin/horarios", label: t.nav.availability },
  { href: "/admin/clientes", label: t.nav.customers },
  { href: "/admin/configuracoes", label: t.nav.settings },
  { href: "/admin/privacidade", label: t.nav.privacy },
];

/** Casca do painel: exige admin (conferido no banco) e oferece navegação rolável no celular. */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <RequireAuth admin>
      <nav aria-label="Painel" className="-mx-5 mb-8 overflow-x-auto border-b border-line px-5">
        <ul className="flex min-w-max gap-1">
          {NAV.map((item) => {
            const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-12 items-center border-b-2 px-3 font-semibold ${active ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"}`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {children}
    </RequireAuth>
  );
}

/** Link de WhatsApp para falar com o cliente (telefone do cadastro). */
export function customerWhatsApp(phone: string | null | undefined, text?: string) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return buildWhatsAppUrl(digits.startsWith("55") ? digits : `55${digits}`, text);
}

/** Cartão de agendamento com as ações permitidas para o status atual. */
export function AppointmentItem({ a, onChanged, showDate = false }: { a: Appointment; onChanged: () => void; showDate?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const name = a.customer?.full_name ?? a.guest_name ?? "—";
  const phone = a.customer?.phone ?? a.guest_phone;
  const chat = customerWhatsApp(phone);

  async function change(to: AppointmentStatus) {
    let reason: string | undefined;
    if (needsReason(a.status, to)) {
      reason = window.prompt(t.reasonPrompt) ?? undefined;
      if (!reason) return;
    } else if (to === "cancelado") {
      reason = window.prompt(t.reason) ?? undefined;
      if (reason === undefined) return;
    }
    setBusy(true);
    setError(null);
    try {
      await admin.updateStatus(a.id, to, reason);
      onChanged();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function reschedule() {
    const value = window.prompt(`${t.newTime} (AAAA-MM-DD HH:MM)`, `${dayKey(a.starts_at)} ${formatTime(a.starts_at)}`);
    if (!value) return;
    const m = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})$/.exec(value.trim());
    if (!m) {
      setError("Use o formato AAAA-MM-DD HH:MM.");
      return;
    }
    setBusy(true);
    try {
      await admin.reschedule(a.id, new Date(`${m[1]}T${m[2]}:00-03:00`).toISOString(), null);
      onChanged();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  const actions = ADMIN_TRANSITIONS[a.status];
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-3xl font-bold tabular-nums">
            {showDate && <span className="mr-2 text-xl text-muted">{formatDate(a.starts_at)}</span>}
            {formatTime(a.starts_at)}
          </p>
          <p className="text-lg font-semibold">{name}</p>
          <p className="text-sm text-muted">
            {a.service_name}
            {a.is_reward && ` · ${appTexts.booking.rewardFree}`} · {a.barber?.name} · {a.protocol}
          </p>
          {a.notes && <p className="mt-1 text-sm">“{a.notes}”</p>}
        </div>
        <StatusBadge status={a.status} />
      </div>
      {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
      <div className="mt-4 flex flex-wrap gap-2">
        {actions.map((to) => (
          <ActionButton key={to} disabled={busy} variant={to === "cancelado" || to === "nao_compareceu" ? "danger" : to === "confirmado" && a.status !== "pendente" ? "outline" : "primary"} onClick={() => change(to)}>
            {needsReason(a.status, to) ? t.undo : ACTION_LABEL[to]}
          </ActionButton>
        ))}
        {(a.status === "pendente" || a.status === "confirmado") && (
          <ActionButton variant="outline" disabled={busy} onClick={reschedule}>{t.reschedule}</ActionButton>
        )}
        {chat && (
          <a href={chat} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-line px-4 font-semibold hover:border-accent">
            <WhatsAppIcon /> {t.contact}
            <span className="sr-only"> ({appTexts.common.newTab})</span>
          </a>
        )}
      </div>
    </Card>
  );
}

/** Lista de conflitos e a decisão do administrador (nada é cancelado sem escolha explícita). */
export function ConflictDecision({ conflicts, onDecide, onCancel }: { conflicts: Conflict[]; onDecide: (action: "manter" | "cancelar") => void; onCancel: () => void }) {
  return (
    <div role="alertdialog" aria-labelledby="conflitos-titulo" className="rounded-sm border border-accent bg-surface-raised p-5">
      <h3 id="conflitos-titulo" className="text-lg font-semibold">{t.conflictsTitle}</h3>
      <p className="mt-1 text-sm text-muted">{t.conflictsText}</p>
      <ul className="mt-3 divide-y divide-line text-sm">
        {conflicts.map((c) => (
          <li key={c.id} className="py-2">
            {formatDate(c.starts_at)} {formatTime(c.starts_at)} · {c.customer_name ?? "—"} · {c.service_name} ({c.protocol})
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <ActionButton onClick={() => onDecide("manter")}>{t.keep}</ActionButton>
        <ActionButton variant="danger" onClick={() => onDecide("cancelar")}>{t.cancelThem}</ActionButton>
        <ActionButton variant="ghost" onClick={onCancel}>{appTexts.common.cancel}</ActionButton>
      </div>
    </div>
  );
}
