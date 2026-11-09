"use client";

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useId } from "react";
import { STATUS_LABEL, STATUS_TONE, type AppointmentStatus } from "@/lib/booking/domain";

export const inputClass =
  "mt-2 block w-full rounded-sm border border-line bg-surface-raised px-4 py-3 text-base text-foreground placeholder:text-muted/70 focus:border-accent focus:outline-none aria-invalid:border-red-400 disabled:opacity-60";

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
}

/** Rótulo + controle + dica + erro, com ligações de acessibilidade. */
export function Field({ label, error, hint, children }: FieldProps) {
  const id = useId();
  const describedBy = [hint && `${id}-dica`, error && `${id}-erro`].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {hint && (
        <p id={`${id}-dica`} className="mt-1.5 text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-erro`} className="mt-1.5 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

const noticeTone = {
  info: "border-line bg-surface-raised",
  success: "border-emerald-500/50 bg-emerald-950/40",
  error: "border-red-400/60 bg-red-950/40",
  warning: "border-accent/60 bg-surface-raised",
};

/** Mensagem com aria-live: leitores de tela anunciam o resultado de cada ação. */
export function Notice({ tone = "info", children }: { tone?: keyof typeof noticeTone; children: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-sm border p-4 text-sm ${noticeTone[tone]}`}>
      {children}
    </div>
  );
}

const badgeTone = {
  warning: "border-accent/70 text-accent",
  success: "border-emerald-400/70 text-emerald-300",
  neutral: "border-line text-muted",
  danger: "border-red-400/60 text-red-300",
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${badgeTone[STATUS_TONE[status]]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-sm border border-line bg-surface p-5 sm:p-6 ${className}`}>{children}</div>;
}

export function PageTitle({ children, intro }: { children: ReactNode; intro?: ReactNode }) {
  return (
    <header className="mb-8">
      <h1 className="font-display text-5xl leading-[0.95] font-extrabold tracking-tight uppercase sm:text-6xl">{children}</h1>
      {intro && <p className="mt-4 max-w-xl text-lg text-muted">{intro}</p>}
    </header>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="font-display text-3xl font-bold uppercase">{children}</h2>;
}

/** Botão de ação com área de toque ≥ 44 px (uso no celular). */
export function ActionButton({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" | "danger" | "ghost" }) {
  const styles = {
    primary: "bg-accent text-accent-foreground hover:bg-foreground",
    outline: "border border-foreground/40 text-foreground hover:border-accent hover:text-accent",
    danger: "border border-red-400/60 text-red-200 hover:bg-red-950/50",
    ghost: "text-foreground underline decoration-accent underline-offset-4 hover:text-accent",
  };
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-sm px-5 text-[0.95rem] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
