"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { appTexts } from "@/config/texts-app";
import { auth } from "@/lib/booking/api";
import { validatePassword, validateSignup, type SignupInput } from "@/lib/booking/domain";
import { friendlyError } from "@/lib/booking/errors";
import { safeNext, useAuth } from "./auth-context";
import { ActionButton, Field, Notice, PageTitle, TextInput } from "./ui";

const t = appTexts.auth;

function origin() {
  return typeof window === "undefined" ? "" : window.location.origin;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
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
      <div className="mt-8 flex flex-col gap-3 text-sm">
        <Link href="/recuperar-senha" className="inline-flex min-h-11 items-center hover:text-accent">
          {t.forgot}
        </Link>
        <p>
          {t.noAccount}{" "}
          <Link href={`/cadastro?next=${encodeURIComponent(next)}`} className="inline-flex min-h-11 items-center font-semibold text-accent underline underline-offset-4">
            {t.createAccount}
          </Link>
        </p>
      </div>
    </>
  );
}

export function SignupForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [errors, setErrors] = useState<Partial<Record<keyof SignupInput | "confirm", string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const input: SignupInput = {
      fullName: String(data.get("fullName") ?? ""),
      phone: String(data.get("phone") ?? ""),
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? ""),
    };
    const found: typeof errors = validateSignup(input);
    if (input.password !== String(data.get("confirm") ?? "")) found.confirm = t.passwordsDiffer;
    setErrors(found);
    if (Object.keys(found).length) {
      e.currentTarget.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { needsConfirmation } = await auth.signUp({
        ...input,
        marketing: data.get("marketing") === "on",
        redirectTo: `${origin()}/auth/confirmar?next=${encodeURIComponent(next)}`,
      });
      if (needsConfirmation) setDone(true);
      else router.replace(next);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <>
        <PageTitle>{t.checkEmailTitle}</PageTitle>
        <Notice tone="success">{t.checkEmail}</Notice>
      </>
    );
  }

  return (
    <>
      <PageTitle intro={t.signUpIntro}>{t.signUpTitle}</PageTitle>
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        <Field label={t.fullName} error={errors.fullName}>
          {(p) => <TextInput {...p} name="fullName" autoComplete="name" required />}
        </Field>
        <Field label={t.phone} hint={t.phoneHint} error={errors.phone}>
          {(p) => <TextInput {...p} name="phone" type="tel" inputMode="tel" autoComplete="tel" required />}
        </Field>
        <Field label={t.email} error={errors.email}>
          {(p) => <TextInput {...p} name="email" type="email" autoComplete="email" required />}
        </Field>
        <Field label={t.password} hint={t.passwordHint} error={errors.password}>
          {(p) => <TextInput {...p} name="password" type="password" autoComplete="new-password" required />}
        </Field>
        <Field label={t.confirmPassword} error={errors.confirm}>
          {(p) => <TextInput {...p} name="confirm" type="password" autoComplete="new-password" required />}
        </Field>
        {/* Consentimento separado, opcional e desmarcado: não é condição para criar a conta. */}
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" name="marketing" className="mt-1 size-5 accent-[var(--brand-accent)]" />
          <span>{t.marketing}</span>
        </label>
        <p className="text-sm text-muted">
          {t.privacyNotice}{" "}
          <Link href="/privacidade" className="underline underline-offset-4 hover:text-accent">
            {t.privacyLink}
          </Link>{" "}
          e os{" "}
          <Link href="/termos" className="underline underline-offset-4 hover:text-accent">
            {t.termsLink}
          </Link>
          .
        </p>
        {error && <Notice tone="error">{error}</Notice>}
        <ActionButton type="submit" disabled={busy} className="w-full sm:w-auto">
          {busy ? appTexts.common.loading : t.signUpButton}
        </ActionButton>
      </form>
      <p className="mt-8 text-sm">
        {t.haveAccount}{" "}
        <Link href={`/entrar?next=${encodeURIComponent(next)}`} className="inline-flex min-h-11 items-center font-semibold text-accent underline underline-offset-4">
          {t.signInButton}
        </Link>
      </p>
    </>
  );
}

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "");
    setBusy(true);
    setError(null);
    try {
      await auth.requestPasswordReset(email, `${origin()}/redefinir-senha`);
      setSent(true);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle intro={t.forgotIntro}>{t.forgotTitle}</PageTitle>
      {sent ? (
        <Notice tone="success">{t.forgotSent}</Notice>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-5" noValidate>
          <Field label={t.email}>{(p) => <TextInput {...p} name="email" type="email" autoComplete="email" required />}</Field>
          {error && <Notice tone="error">{error}</Notice>}
          <ActionButton type="submit" disabled={busy} className="w-full sm:w-auto">
            {busy ? appTexts.common.loading : t.forgotButton}
          </ActionButton>
        </form>
      )}
    </>
  );
}

/** Nova senha (pelo link de recuperação) ou troca de senha com a sessão ativa. */
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

/** Destino dos links de e-mail no formato com token_hash (modelos em docs/HOSPEDAGEM.md). */
export function EmailLinkHandler() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tokenHash = params.get("token_hash");
    const type = params.get("type") as "signup" | "recovery" | "email" | "email_change" | "invite" | null;
    const next = safeNext(params.get("next"));
    if (!tokenHash || !type) {
      // Formato padrão do Supabase (sessão no fragmento da URL): o cliente já tratou.
      const timer = setTimeout(() => router.replace(next), 800);
      return () => clearTimeout(timer);
    }
    auth
      .verifyEmailLink(tokenHash, type)
      .then(() => router.replace(type === "recovery" ? "/redefinir-senha" : next))
      .catch((err) => setError(friendlyError(err)));
  }, [params, router]);

  return error ? <Notice tone="error">{error}</Notice> : <p className="text-muted">{t.confirming}</p>;
}
