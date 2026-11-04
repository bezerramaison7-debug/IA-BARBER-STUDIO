"use client";

import type { Session } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { appTexts } from "@/config/texts-app";
import { auth, me, type Profile } from "@/lib/booking/api";
import { getSupabase } from "@/lib/supabase/client";
import { Notice } from "./ui";

interface AuthState {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fora do AuthProvider");
  return ctx;
}

/** Sessão do Supabase + perfil. O papel de admin é sempre conferido no banco (is_admin). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<AuthState, "refresh">>({ ready: false, session: null, profile: null, isAdmin: false });
  const configured = getSupabase() !== null;

  const load = useCallback(async (session: Session | null) => {
    if (!session) {
      setState({ ready: true, session: null, profile: null, isAdmin: false });
      return;
    }
    try {
      const [profile, isAdmin] = await Promise.all([me.profile(), me.isAdmin()]);
      setState({ ready: true, session, profile, isAdmin });
    } catch {
      setState({ ready: true, session, profile: null, isAdmin: false });
    }
  }, []);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    auth.session().then((s) => {
      if (active) void load(s);
    });
    const off = auth.onChange((s) => {
      if (active) void load(s);
    });
    return () => {
      active = false;
      off();
    };
  }, [configured, load]);

  const refresh = useCallback(async () => load(await auth.session()), [load]);

  if (!configured) {
    return (
      <div className="mx-auto max-w-xl px-5 pt-40 pb-24">
        <Notice>{appTexts.common.notConfigured}</Notice>
      </div>
    );
  }
  return <AuthContext.Provider value={{ ...state, refresh }}>{children}</AuthContext.Provider>;
}

/** Páginas que exigem login: manda para /entrar e volta para cá depois. */
export function RequireAuth({ children, admin = false, denied }: { children: ReactNode; admin?: boolean; denied?: ReactNode }) {
  const { ready, session, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !session) {
      const next = `${window.location.pathname}${window.location.search}`;
      router.replace(`/entrar?next=${encodeURIComponent(next)}`);
    }
  }, [ready, session, router]);

  if (!ready || !session) return <p className="text-muted">{appTexts.common.loading}</p>;
  if (admin && !isAdmin) return <>{denied ?? <Notice tone="error">{appTexts.admin.denied}</Notice>}</>;
  return <>{children}</>;
}

/** Só aceita destinos internos (evita redirecionamento aberto para outro site). */
export { safeNext } from "@/lib/booking/redirect";
