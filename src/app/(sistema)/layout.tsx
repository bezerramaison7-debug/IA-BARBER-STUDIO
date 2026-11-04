import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { siteConfig } from "@/config/site.config";
import { AuthProvider } from "@/components/app/auth-context";
import { isBookingSystemEnabled } from "@/lib/plan";

// Telas de conta, agendamento e painel nunca entram no Google.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function SistemaLayout({ children }: { children: ReactNode }) {
  if (!isBookingSystemEnabled(siteConfig)) notFound();
  return <AuthProvider>{children}</AuthProvider>;
}
