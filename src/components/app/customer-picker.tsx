"use client";

import { useEffect, useState, type FormEvent } from "react";
import { appTexts } from "@/config/texts-app";
import { admin, type Customer } from "@/lib/booking/api";
import { phoneDigits, validateContact } from "@/lib/booking/domain";
import { friendlyError } from "@/lib/booking/errors";
import { formatBrPhone } from "@/lib/booking/whatsapp-confirmation";
import { ActionButton, Field, Notice, TextInput } from "./ui";

const t = appTexts.admin;

export type Picked = { kind: "customer"; customer: Customer } | { kind: "guest"; name: string; phone: string };

/**
 * Escolha do cliente no painel: busca por nome ou telefone, ou cadastro rápido (nome + telefone).
 * Telefone repetido não bloqueia (família, número reatribuído): o painel mostra quem já usa o
 * número e o administrador decide. Nada é vinculado automaticamente.
 */
export function CustomerPicker({ value, onChange, allowWalkIn = false, startNew = false }: {
  value: Picked | null;
  onChange: (v: Picked | null) => void;
  allowWalkIn?: boolean;
  startNew?: boolean;
}) {
  const [mode, setMode] = useState<"search" | "new" | "guest">(startNew ? "new" : "search");
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Customer[] | null>(null);
  const [form, setForm] = useState({ fullName: "", phone: "", notes: "" });
  const [errors, setErrors] = useState<Partial<Record<"fullName" | "phone", string>>>({});
  const [samePhone, setSamePhone] = useState<Customer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode !== "search" || value || term.trim().length < 2) return;
    const id = setTimeout(() => {
      admin.searchCustomers(term).then(setResults).catch((e) => setError(friendlyError(e)));
    }, 250);
    return () => clearTimeout(id);
  }, [term, mode, value]);

  if (value) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-accent/50 bg-surface p-4">
        <div>
          <p className="text-lg font-semibold">{value.kind === "customer" ? value.customer.full_name : value.name}</p>
          <p className="text-sm text-muted">
            {value.kind === "customer" ? formatBrPhone(value.customer.phone) : t.walkIn}
          </p>
        </div>
        <ActionButton variant="outline" onClick={() => onChange(null)}>{t.changeCustomer}</ActionButton>
      </div>
    );
  }

  async function save(force: boolean) {
    setError(null);
    const errs = validateContact(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const digits = phoneDigits(form.phone);
      if (!force) {
        const same = await admin.customersByPhone(digits);
        if (same.length) {
          setSamePhone(same);
          return;
        }
      }
      const saved = await admin.saveCustomer({ full_name: form.fullName.trim(), phone: digits, notes: form.notes.trim() || null });
      setSamePhone(null);
      onChange({ kind: "customer", customer: saved });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  function submitNew(e: FormEvent) {
    e.preventDefault();
    void save(false);
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label={t.pickCustomer}>
        <ActionButton variant={mode === "search" ? "primary" : "outline"} onClick={() => setMode("search")} aria-pressed={mode === "search"}>{t.searchCustomer}</ActionButton>
        <ActionButton variant={mode === "new" ? "primary" : "outline"} onClick={() => setMode("new")} aria-pressed={mode === "new"}>{t.newCustomer}</ActionButton>
        {allowWalkIn && (
          <ActionButton variant={mode === "guest" ? "primary" : "outline"} onClick={() => setMode("guest")} aria-pressed={mode === "guest"}>{t.walkIn}</ActionButton>
        )}
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      {mode === "search" && (
        <>
          <Field label={t.searchCustomer}>{(p) => <TextInput {...p} type="search" inputMode="search" value={term} onChange={(e) => setTerm(e.target.value)} />}</Field>
          {results && results.length === 0 && term.trim().length >= 2 && <p className="text-muted">{t.noResults}</p>}
          <ul className="divide-y divide-line border-y border-line">
            {(term.trim().length >= 2 ? results ?? [] : []).map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => onChange({ kind: "customer", customer: c })} className="flex min-h-14 w-full flex-wrap items-center justify-between gap-2 py-3 text-left hover:text-accent">
                  <span className="font-semibold">{c.full_name}</span>
                  <span className="text-sm text-muted">{formatBrPhone(c.phone)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {mode === "new" && (
        <form onSubmit={submitNew} noValidate className="grid gap-3 sm:grid-cols-2">
          <Field label={t.customerName} error={errors.fullName}>
            {(p) => <TextInput {...p} autoComplete="off" maxLength={120} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />}
          </Field>
          <Field label={t.customerPhone} error={errors.phone}>
            {(p) => <TextInput {...p} type="tel" inputMode="tel" maxLength={20} value={form.phone} onChange={(e) => { setSamePhone(null); setForm({ ...form, phone: e.target.value }); }} />}
          </Field>
          <div className="sm:col-span-2">
            <Field label={t.customerNotes}>{(p) => <TextInput {...p} maxLength={300} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />}</Field>
          </div>
          {samePhone ? (
            <div className="grid gap-3 sm:col-span-2">
              <Notice tone="warning">{t.samePhone}</Notice>
              <ul className="grid gap-2">
                {samePhone.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-line p-3">
                    <span><strong>{c.full_name}</strong> · {formatBrPhone(c.phone)}</span>
                    <ActionButton variant="outline" onClick={() => onChange({ kind: "customer", customer: c })}>{t.useThis}</ActionButton>
                  </li>
                ))}
              </ul>
              <ActionButton variant="outline" disabled={busy} onClick={() => void save(true)} className="self-start">{t.otherPerson}</ActionButton>
            </div>
          ) : (
            <div className="sm:col-span-2">
              <ActionButton type="submit" disabled={busy}>{busy ? appTexts.common.saving : t.saveCustomer}</ActionButton>
            </div>
          )}
        </form>
      )}

      {mode === "guest" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.guestName}>{(p) => <TextInput {...p} maxLength={120} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />}</Field>
          <Field label={t.customerPhone}>{(p) => <TextInput {...p} type="tel" inputMode="tel" maxLength={20} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />}</Field>
          <div className="sm:col-span-2">
            <ActionButton
              variant="outline"
              disabled={form.fullName.trim().length < 2}
              onClick={() => onChange({ kind: "guest", name: form.fullName.trim(), phone: phoneDigits(form.phone) })}
            >
              {appTexts.common.continue}
            </ActionButton>
          </div>
        </div>
      )}
    </div>
  );
}
