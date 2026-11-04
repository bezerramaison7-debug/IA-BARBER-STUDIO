"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { appTexts } from "@/config/texts-app";
import { auth } from "@/lib/booking/api";
import { validatePassword } from "@/lib/booking/domain";
import { friendlyError } from "@/lib/booking/errors";
import { safeNext, useAuth } from "./auth-context";
import { ActionButton, Field, Notice, PageTitle, TextInput } from "./ui";

const t = appTexts.auth;

/** Acesso da equipe (não há conta de cliente). Contas são criadas no painel do Supabase. */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"), "/admin");
  const { session, ready } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && session) router.replace(next);
  }, [ready, session, next, router]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await auth.signIn(String(data.get("email")), String(data.get("password")));
      router.replace(next);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle intro={t.signInIntro}>{t.signInTitle}</PageTitle>
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        <Field label={t.email}>{(p) => <TextInput {...p} name="email" type="email" autoComplete="email" required />}</Field>
        <Field label={t.password}>{(p) => <TextInput {...p} name="password" type="password" autoComplete="current-password" required />}</Field>
        {error && <Notice tone="error">{error}</Notice>}
        <ActionButton type="submit" disabled={busy} className="w-full sm:w-auto">
          {busy ? appTexts.common.loading : t.signInButton}
        </ActionButton>
      </form>
      <p className="mt-8 text-sm text-muted">{t.recoveryNote}</p>
    </>
  );
}

/** Troca de senha com a sessão ativa (Painel → Configurações). Sem e-mail de recuperação. */
export function NewPasswordForm({ title = t.resetTitle, onDone }: { title?: string; onDone?: () => void }) {
  const { ready, session } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string>();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const password = String(data.get("password") ?? "");
    const invalid = validatePassword(password) ?? (password !== String(data.get("confirm") ?? "") ? t.passwordsDiffer : undefined);
    setFieldError(invalid);
    if (invalid) return;
    setBusy(true);
    setError(null);
    try {
      await auth.updatePassword(password);
      setDone(true);
      e.currentTarget.reset();
      onDone?.();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  if (ready && !session) return <Notice tone="warning">{t.resetNoSession}</Notice>;

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate aria-label={title}>
      <Field label={t.newPassword} hint={t.passwordHint} error={fieldError}>
        {(p) => <TextInput {...p} name="password" type="password" autoComplete="new-password" required />}
      </Field>
      <Field label={t.confirmPassword}>{(p) => <TextInput {...p} name="confirm" type="password" autoComplete="new-password" required />}</Field>
      {error && <Notice tone="error">{error}</Notice>}
      {done && <Notice tone="success">{t.resetDone}</Notice>}
      <ActionButton type="submit" disabled={busy || !ready} className="w-full sm:w-auto">
        {busy ? appTexts.common.saving : t.resetButton}
      </ActionButton>
    </form>
  );
}
