import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { siteConfig } from "@/config/site.config";
import { isBookingSystemEnabled } from "@/lib/plan";

// Telas de solicitação, login da equipe e painel nunca entram no Google.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function SistemaLayout({ children }: { children: ReactNode }) {
  if (!isBookingSystemEnabled(siteConfig)) notFound();
  // Sem AuthProvider aqui: a solicitação pública não usa login. Só o painel e /entrar usam.
  return <>{children}</>;
}
