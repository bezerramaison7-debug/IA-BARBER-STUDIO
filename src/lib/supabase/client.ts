"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/booking/env";

let client: SupabaseClient | null = null;

/**
 * Cliente do Supabase no navegador (uma instância por aba).
 * - Só usa a chave pública (anon/publishable); a segurança está no RLS e nas funções do banco.
 * - Sessão: token de acesso de curta duração com renovação automática; "Sair" encerra a sessão.
 * - detectSessionInUrl desligado: não há links de e-mail (sem SMTP); a sessão só nasce do login.
 */
export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const env = getSupabaseEnv();
  if (!env) return null;
  client = createClient(env.url, env.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}

/** Para testes: injeta um cliente simulado. */
export function setSupabaseForTests(fake: SupabaseClient | null) {
  client = fake;
}
