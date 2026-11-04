import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Instrument_Sans } from "next/font/google";
import type { CSSProperties, ReactNode } from "react";
import { siteConfig } from "@/config/site.config";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { WhatsAppFab } from "@/components/layout/whatsapp-fab";
import { isIndexable } from "@/lib/indexing";
import { getBookingHref, getNavLinks } from "@/lib/navigation";
import { isBookingSystemEnabled } from "@/lib/plan";
import { appTexts } from "@/config/texts-app";
import { getSiteUrl, getWhatsAppUrl } from "@/lib/site";
import { getTexts } from "@/lib/texts";
import { resolveThemeColors, themeToCssVars } from "@/lib/theme";
import { assertValidSiteConfig } from "@/lib/validate-config";
import "./globals.css";

// Display condensado, no espírito dos letreiros de barbearia.
const display = Big_Shoulders({
  variable: "--font-display-face",
  subsets: ["latin"],
  weight: ["700", "800"],
  display: "swap",
  // O Next não tem métricas de fallback para esta fonte; usamos uma condensada do sistema.
  adjustFontFallback: false,
  fallback: ["Arial Narrow", "sans-serif"],
});

const body = Instrument_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

// Um config com erro (ex.: WhatsApp inválido em site real) interrompe o build aqui.
assertValidSiteConfig(siteConfig);

const siteUrl = getSiteUrl(siteConfig);
const texts = getTexts(siteConfig);
const colors = resolveThemeColors(siteConfig);
const indexable = isIndexable(siteConfig.demo);
const onlineBooking = isBookingSystemEnabled(siteConfig);

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: siteConfig.seo.title, template: `%s | ${siteConfig.business.name}` },
  description: siteConfig.seo.description,
  keywords: siteConfig.seo.keywords,
  applicationName: siteConfig.business.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: siteConfig.business.name,
    title: siteConfig.seo.title,
    description: siteConfig.seo.description,
  },
  twitter: { card: "summary_large_image" },
  // Demonstração e previews não entram no Google; a produção de um site real entra.
  robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: colors.background,
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${display.variable} ${body.variable} antialiased`}
      style={themeToCssVars(colors) as CSSProperties}
    >
      <body className="flex min-h-dvh flex-col">
        <a
          href="#conteudo"
          className="sr-only z-50 bg-accent px-4 py-3 font-semibold text-accent-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          {texts.nav.skipToContent}
        </a>
        <SiteHeader
          name={siteConfig.business.name}
          demo={siteConfig.demo}
          links={getNavLinks(siteConfig, texts)}
          bookingHref={getBookingHref(onlineBooking)}
          account={onlineBooking ? { href: "/minha-conta", label: appTexts.nav.account } : undefined}
          labels={{ booking: texts.nav.booking, menuOpen: texts.nav.menuOpen, menuClose: texts.nav.menuClose }}
        />
        <main id="conteudo" className="flex-1">
          {children}
        </main>
        <SiteFooter config={siteConfig} texts={texts} links={getNavLinks(siteConfig, texts)} />
        <WhatsAppFab href={getWhatsAppUrl(siteConfig)} label={`${texts.whatsappFab} (${texts.newTab})`} />
      </body>
    </html>
  );
}
