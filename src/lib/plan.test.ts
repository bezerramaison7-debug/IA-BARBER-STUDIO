import { afterEach, describe, expect, it, vi } from "vitest";
import { siteConfig } from "@/config/site.config";
import { defaultTexts } from "@/config/texts";
import { isIndexable } from "./indexing";
import { getNavLinks } from "./navigation";
import { getFeatures, getPlan, getServicesWithPage } from "./plan";
import { contrastRatio, resolveThemeColors, THEME_PRESETS, themeToCssVars } from "./theme";
import { fillText, getTexts } from "./texts";

afterEach(() => vi.unstubAllEnvs());

const essencial = { ...siteConfig, plan: "essencial" as const };
const premium = { ...siteConfig, plan: "premium" as const };

describe("planos", () => {
  it("essencial desliga equipe, FAQ, formulário, páginas de serviço e cores avançadas", () => {
    expect(getFeatures(essencial)).toEqual({
      team: false,
      faq: false,
      bookingForm: false,
      servicePages: false,
      customColors: false,
      onlineBooking: false,
      loyalty: false,
    });
    // Premium não muda com a V3: agenda e fidelidade ficam no plano profissional.
    expect(getFeatures(premium)).toMatchObject({ team: true, faq: true, bookingForm: true, onlineBooking: false, loyalty: false });
    expect(Object.values(getFeatures({ plan: "profissional" })).every(Boolean)).toBe(true);
  });

  it("SITE_PLAN no build sobrescreve o config", () => {
    vi.stubEnv("SITE_PLAN", "essencial");
    expect(getPlan(premium)).toBe("essencial");
    vi.stubEnv("SITE_PLAN", "qualquer-coisa");
    expect(getPlan(premium)).toBe("premium");
  });

  it("páginas de serviço só no premium e só para serviços com conteúdo", () => {
    expect(getServicesWithPage(essencial)).toEqual([]);
    const ids = getServicesWithPage(premium).map((s) => s.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => premium.services.find((s) => s.id === id)?.page)).toBe(true);
  });

  it("menu do essencial não mostra equipe nem dúvidas", () => {
    const hrefs = getNavLinks(essencial, defaultTexts).map((l) => l.href);
    expect(hrefs).not.toContain("/#equipe");
    expect(hrefs).not.toContain("/#duvidas");
    expect(getNavLinks(premium, defaultTexts).map((l) => l.href)).toContain("/#equipe");
  });
});

describe("tema", () => {
  it("todos os presets têm contraste AA entre texto e fundo", () => {
    for (const [name, c] of Object.entries(THEME_PRESETS)) {
      expect(contrastRatio(c.foreground, c.background), `${name} texto`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c.muted, c.background), `${name} secundário`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c.accentForeground, c.accent), `${name} botão`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c.ink, c.paper), `${name} seção clara`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("ajustes de cor valem no premium e são ignorados no essencial", () => {
    const theme = { preset: "classico" as const, colors: { accent: "#c9a46a" } };
    expect(resolveThemeColors({ ...premium, theme }).accent).toBe("#c9a46a");
    expect(resolveThemeColors({ ...essencial, theme }).accent).toBe(THEME_PRESETS.classico.accent);
  });

  it("gera variáveis --brand-* em kebab-case", () => {
    const vars = themeToCssVars(THEME_PRESETS.classico);
    expect(vars["--brand-accent"]).toBe(THEME_PRESETS.classico.accent);
    expect(vars["--brand-surface-raised"]).toBe(THEME_PRESETS.classico.surfaceRaised);
  });
});

describe("indexação", () => {
  it("demo nunca é indexada", () => {
    expect(isIndexable(true, { VERCEL_ENV: "production" })).toBe(false);
  });

  it("site real: só a produção entra no Google", () => {
    expect(isIndexable(false, { VERCEL_ENV: "production" })).toBe(true);
    expect(isIndexable(false, { VERCEL_ENV: "preview" })).toBe(false);
    expect(isIndexable(false, {})).toBe(true);
    expect(isIndexable(false, { VERCEL_ENV: "production", SITE_NOINDEX: "1" })).toBe(false);
  });

  it("na Netlify, deploy preview e branch deploy ficam fora do Google", () => {
    expect(isIndexable(false, { NETLIFY: "true", CONTEXT: "production" })).toBe(true);
    expect(isIndexable(false, { NETLIFY: "true", CONTEXT: "deploy-preview" })).toBe(false);
    expect(isIndexable(false, { NETLIFY: "true", CONTEXT: "branch-deploy" })).toBe(false);
  });
});

describe("textos", () => {
  it("o cliente substitui só o que informar", () => {
    const texts = getTexts({ texts: { services: { title: "Cortes e barba" } } });
    expect(texts.services.title).toBe("Cortes e barba");
    expect(texts.services.intro).toBe(defaultTexts.services.intro);
    expect(texts.hero).toEqual(defaultTexts.hero);
  });

  it("preenche os marcadores com os dados do config", () => {
    expect(fillText("{bairro}, {cidade} · {nome} · {outro}", siteConfig)).toBe(
      `${siteConfig.address.neighborhood}, ${siteConfig.address.city} · ${siteConfig.business.name} · {outro}`,
    );
  });
});
