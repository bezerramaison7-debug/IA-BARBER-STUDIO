import { afterEach, describe, expect, it, vi } from "vitest";
import { siteConfig } from "@/config/site.config";
import { makeRealConfig } from "@/test/fixtures";
import { buildLocalBusinessJsonLd, getSiteUrl, getWhatsAppNumber, getWhatsAppUrl } from "./site";

afterEach(() => vi.unstubAllEnvs());

describe("getSiteUrl", () => {
  it("prefere NEXT_PUBLIC_SITE_URL e remove a barra final", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://cliente.com.br/");
    expect(getSiteUrl(siteConfig)).toBe("https://cliente.com.br");
  });

  it("na Vercel, sem a variável, usa o domínio de produção do projeto", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "barber-studio-template.vercel.app");
    expect(getSiteUrl(siteConfig)).toBe("https://barber-studio-template.vercel.app");
  });

  it("na Netlify, sem a variável, usa o endereço principal do site", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("NETLIFY", "true");
    vi.stubEnv("URL", "https://barbearia-exemplo.netlify.app");
    expect(getSiteUrl(siteConfig)).toBe("https://barbearia-exemplo.netlify.app");
  });

  it("fora da Vercel e da Netlify e sem a variável, usa a URL do config", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("NETLIFY", "");
    expect(getSiteUrl(siteConfig)).toBe(siteConfig.url);
  });
});

describe("getWhatsAppNumber / getWhatsAppUrl", () => {
  it("em modo demo nunca usa número, mesmo que haja um no config", () => {
    const config = { ...siteConfig, contact: { ...siteConfig.contact, whatsapp: "5516991234567" } };
    expect(getWhatsAppNumber(config)).toBe("");
    expect(getWhatsAppUrl(config)).toMatch(/^https:\/\/wa\.me\/\?text=/);
  });

  it("em site real usa o número válido", () => {
    expect(getWhatsAppUrl(makeRealConfig())).toMatch(/^https:\/\/wa\.me\/5516991234567\?text=/);
  });

  it("em site real descarta número fictício ou inválido", () => {
    const real = makeRealConfig();
    expect(getWhatsAppNumber({ ...real, contact: { ...real.contact, whatsapp: "5516999999999" } })).toBe("");
    expect(getWhatsAppNumber({ ...real, contact: { ...real.contact, whatsapp: "123" } })).toBe("");
  });
});

describe("buildLocalBusinessJsonLd", () => {
  const jsonLd = buildLocalBusinessJsonLd(siteConfig);

  it("descreve uma BarberShop com endereço e horários", () => {
    expect(jsonLd["@type"]).toBe("BarberShop");
    expect(jsonLd.address.addressLocality).toBe(siteConfig.address.city);
    expect(jsonLd.openingHoursSpecification.length).toBe(
      siteConfig.hours.filter((h) => h.open && h.close).length,
    );
  });

  it("nunca inclui avaliações inventadas", () => {
    expect(jsonLd).not.toHaveProperty("aggregateRating");
    expect(jsonLd).not.toHaveProperty("review");
  });

  it("só publica telefone em site real com número válido", () => {
    expect(jsonLd).not.toHaveProperty("telephone");
    expect(buildLocalBusinessJsonLd(makeRealConfig())).toHaveProperty("telephone", "+5516991234567");
  });
});
