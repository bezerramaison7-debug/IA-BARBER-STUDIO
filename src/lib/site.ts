import type { Service, SiteConfig } from "@/config/types";
import { toSchemaDay } from "./hours";
import { buildWhatsAppUrl, isValidBrazilianWhatsApp, normalizePhone } from "./whatsapp";

/**
 * URL pública, em ordem de prioridade:
 * 1. NEXT_PUBLIC_SITE_URL (definida por nós na Vercel);
 * 2. VERCEL_PROJECT_PRODUCTION_URL (injetada pela própria Vercel, sem "https://");
 * 3. `url` do config.
 */
export function getSiteUrl(config: SiteConfig): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  // Na Netlify, `URL` é o endereço principal do site (domínio próprio, se houver), também nos previews.
  const netlify = process.env.NETLIFY === "true" ? process.env.URL?.trim() : undefined;
  const url = explicit || (vercel ? `https://${vercel}` : netlify || config.url);
  return url.replace(/\/+$/, "");
}

export function getFullAddress(config: SiteConfig): string {
  const { street, neighborhood, city, state, postalCode } = config.address;
  return `${street}, ${neighborhood}, ${city}/${state}, CEP ${postalCode}`;
}

/**
 * Número de destino usado nos links de WhatsApp. Vazio (sem destinatário) quando:
 * - o site está em modo demonstração, mesmo que haja um número no config;
 * - o número não é um celular/fixo brasileiro válido (ex.: número de exemplo).
 * Assim nenhuma mensagem de teste chega a um número fictício ou de terceiros.
 */
export function getWhatsAppNumber(config: Pick<SiteConfig, "demo" | "contact">): string {
  if (config.demo) return "";
  const digits = normalizePhone(config.contact.whatsapp);
  return isValidBrazilianWhatsApp(digits) ? digits : "";
}

export function getWhatsAppUrl(config: SiteConfig, message?: string): string {
  return buildWhatsAppUrl(getWhatsAppNumber(config), message ?? config.booking.greeting);
}

/**
 * Dados estruturados (schema.org/BarberShop) para SEO local.
 * Propositalmente sem avaliações (`aggregateRating`/`review`): só devem existir
 * quando houver avaliações reais e verificáveis.
 */
export function buildLocalBusinessJsonLd(config: SiteConfig) {
  const url = getSiteUrl(config);
  const { address, contact, business } = config;
  const sameAs = Object.values(config.social).filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@type": "BarberShop",
    "@id": `${url}/#barbearia`,
    name: business.name,
    description: business.description,
    url,
    image: `${url}${config.images.hero.src}`,
    priceRange: business.priceRange,
    ...(getWhatsAppNumber(config) ? { telephone: `+${getWhatsAppNumber(config)}` } : {}),
    ...(contact.email ? { email: contact.email } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: address.street,
      addressLocality: address.city,
      addressRegion: address.state,
      postalCode: address.postalCode,
      addressCountry: address.country,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: address.geo.latitude,
      longitude: address.geo.longitude,
    },
    hasMap: address.mapsUrl,
    areaServed: config.serviceArea.map((name) => ({ "@type": "City", name })),
    openingHoursSpecification: config.hours
      .filter((h) => h.open && h.close)
      .map((h) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: toSchemaDay(h.day),
        opens: h.open,
        closes: h.close,
      })),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Serviços",
      itemListElement: config.services.map((service) => ({
        "@type": "Offer",
        priceCurrency: "BRL",
        price: service.price.toFixed(2),
        itemOffered: { "@type": "Service", name: service.name, description: service.description },
      })),
    },
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function buildFaqJsonLd(config: Pick<SiteConfig, "faq">) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: config.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/** Página individual de serviço: o serviço oferecido pela barbearia + trilha de navegação. */
export function buildServicePageJsonLd(config: SiteConfig, service: Service) {
  const url = getSiteUrl(config);
  const pageUrl = `${url}/servicos/${service.id}`;
  return [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: service.name,
      description: service.page?.summary ?? service.description,
      url: pageUrl,
      provider: { "@id": `${url}/#barbearia` },
      areaServed: config.serviceArea.map((name) => ({ "@type": "City", name })),
      offers: { "@type": "Offer", priceCurrency: "BRL", price: service.price.toFixed(2) },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: config.business.name, item: url },
        { "@type": "ListItem", position: 2, name: service.name, item: pageUrl },
      ],
    },
  ];
}
