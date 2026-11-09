/**
 * Decide se o site pode aparecer no Google.
 * - Demonstração: nunca.
 * - Na Vercel, só a produção (`VERCEL_ENV=production`); previews de pull request não.
 * - Na Netlify, só o contexto `production`; deploy previews e branch deploys não.
 * - SITE_NOINDEX=1 força o bloqueio (útil para um site real ainda em aprovação).
 * Mantido sem dependências para poder ser usado também no next.config.ts.
 */
export function isIndexable(demo: boolean, env: Record<string, string | undefined> = process.env): boolean {
  if (demo) return false;
  if (env.SITE_NOINDEX === "1") return false;
  if (env.VERCEL_ENV && env.VERCEL_ENV !== "production") return false;
  if (env.NETLIFY === "true" && env.CONTEXT !== "production") return false;
  return true;
}
