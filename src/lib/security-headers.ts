/**
 * Content-Security-Policy do site, aplicada só no build de produção (o modo dev do Next precisa de eval/HMR).
 *
 * 'unsafe-inline' em script-src é necessário porque as páginas são pré-renderizadas (cacheComponents):
 * nonce exige renderização por requisição. O ganho real está nas outras diretivas: o navegador só
 * conversa com o próprio site e com o Supabase do cliente, só embute o mapa do Google, não aceita
 * plugins, não troca a <base> e não deixa outro site emoldurar este.
 */
export function buildContentSecurityPolicy(supabaseUrl?: string | null): string {
  const supabase = supabaseUrl ? new URL(supabaseUrl) : null;
  const connect = ["'self'"];
  if (supabase) {
    connect.push(supabase.origin);
    if (supabase.protocol === "https:") connect.push(`wss://${supabase.host}`);
  }
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "connect-src": connect,
    "frame-src": ["https://www.google.com", "https://maps.google.com"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'self'"],
  };
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}
