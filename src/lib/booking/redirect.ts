const BASE = "https://destino.invalid";

/**
 * Destino seguro depois do login/link de e-mail: só caminhos do próprio site.
 * Usa o parser de URL do navegador, que ignora tabulações e quebras de linha; assim
 * "/\t/outro-site.com" (que vira "//outro-site.com") também é recusado.
 */
export function safeNext(next: string | null | undefined, fallback = "/minha-conta"): string {
  if (!next || !next.startsWith("/")) return fallback;
  try {
    const url = new URL(next, BASE);
    if (url.origin !== BASE) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
