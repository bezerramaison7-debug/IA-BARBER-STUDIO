import type { NextConfig } from "next";
import { siteConfig } from "./src/config/site.config";
import { getSupabaseEnv, looksLikeSecretKey } from "./src/lib/booking/env";
import { isIndexable } from "./src/lib/indexing";
import { buildContentSecurityPolicy } from "./src/lib/security-headers";

// Para o build se alguém colocar a chave secreta (service_role) numa variável pública.
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (publicKey && looksLikeSecretKey(publicKey)) {
  throw new Error(
    "A chave em NEXT_PUBLIC_SUPABASE_* é a chave SECRETA do Supabase. Use a chave publishable/anon e troque a secreta no painel do Supabase.",
  );
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Só no build de produção: o `next dev` usa eval e WebSocket de recarga, que a CSP bloquearia.
const productionHeaders =
  process.env.NODE_ENV === "production"
    ? [
        { key: "Content-Security-Policy", value: buildContentSecurityPolicy(getSupabaseEnv()?.url) },
        { key: "Strict-Transport-Security", value: "max-age=63072000" },
      ]
    : [];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // Obrigatório desde o Next 16: lista de qualidades permitidas.
    qualities: [75],
    // Para imagens hospedadas fora do /public, libere o domínio aqui, ex.:
    // remotePatterns: [new URL("https://res.cloudinary.com/minha-conta/**")],
  },
  async headers() {
    // Fora da produção de um site real (demo, preview), nenhuma resposta entra no Google,
    // inclusive imagens e arquivos que não têm meta tag.
    const noindex = isIndexable(siteConfig.demo) ? [] : [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [{ source: "/:path*", headers: [...securityHeaders, ...productionHeaders, ...noindex] }];
  },
};

export default nextConfig;
