import type { Plan, SiteConfig } from "@/config/types";
import { getSupabaseEnv } from "./booking/env";

export interface Features {
  team: boolean;
  faq: boolean;
  /** Formulário de solicitação de horário. No essencial, um bloco com botão de WhatsApp. */
  bookingForm: boolean;
  servicePages: boolean;
  /** Ajuste de cores além do preset. */
  customColors: boolean;
  /** V3: agendamento com conta, agenda gerenciada no painel (/admin) e área do cliente. */
  onlineBooking: boolean;
  /** V3: programa de fidelidade (cartões e cortesias). */
  loyalty: boolean;
}

const FEATURES: Record<Plan, Features> = {
  essencial: { team: false, faq: false, bookingForm: false, servicePages: false, customColors: false, onlineBooking: false, loyalty: false },
  premium: { team: true, faq: true, bookingForm: true, servicePages: true, customColors: true, onlineBooking: false, loyalty: false },
  // Proposta comercial da V3: Premium + agenda e fidelidade. Exige um projeto Supabase (ver docs/HOSPEDAGEM.md).
  profissional: { team: true, faq: true, bookingForm: true, servicePages: true, customColors: true, onlineBooking: true, loyalty: true },
};

const PLANS = Object.keys(FEATURES) as Plan[];

/**
 * Plano efetivo. A variável SITE_PLAN (lida no build) permite publicar a mesma demonstração
 * nas duas versões, por exemplo em dois projetos da Vercel.
 */
export function getPlan(config: Pick<SiteConfig, "plan">): Plan {
  const fromEnv = process.env.SITE_PLAN?.trim();
  return PLANS.includes(fromEnv as Plan) ? (fromEnv as Plan) : config.plan;
}

export function getFeatures(config: Pick<SiteConfig, "plan">): Features {
  return FEATURES[getPlan(config)];
}

/** Serviços que ganham página própria: só no premium e só se houver conteúdo. */
export function getServicesWithPage(config: Pick<SiteConfig, "plan" | "services">) {
  if (!getFeatures(config).servicePages) return [];
  return config.services.filter((s) => s.page && s.page.body.length > 0);
}

/**
 * Módulo de agendamento/fidelidade (V3) ativo: plano com o recurso E projeto Supabase
 * configurado. Sem isso as rotas /agendar, /entrar, /minha-conta e /admin respondem 404
 * e o site continua idêntico à V2 (é o caso da demonstração pública).
 */
export function isBookingSystemEnabled(config: Pick<SiteConfig, "plan">): boolean {
  return getFeatures(config).onlineBooking && getSupabaseEnv() !== null;
}
