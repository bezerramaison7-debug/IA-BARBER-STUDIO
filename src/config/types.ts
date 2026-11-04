/**
 * Tipos do arquivo central de configuração.
 * Cada cliente (barbearia) é descrito por um objeto `SiteConfig`.
 */
import type { SiteTexts } from "./texts";

/** 0 = domingo … 6 = sábado (mesma convenção de `Date.getDay()`). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Plano contratado. Os dois compartilham o mesmo código; o plano só liga/desliga recursos.
 * - essencial: landing, serviços e preços, galeria, localização, WhatsApp e SEO básico.
 * - premium: tudo do essencial + equipe, dúvidas frequentes, formulário de solicitação de
 *   horário, páginas individuais por serviço e personalização ampliada de cores.
 * - profissional (V3): tudo do premium + agendamento com conta, painel de agenda e fidelidade.
 *   Só funciona com um projeto Supabase configurado (variáveis NEXT_PUBLIC_SUPABASE_*).
 * Detalhes em docs/PLANOS.md.
 */
export type Plan = "essencial" | "premium" | "profissional";

/** Paletas prontas (ver src/lib/theme.ts). */
export type ThemePreset = "classico" | "grafite" | "carvalho";

export interface ImageAsset {
  /** Caminho a partir de /public (ex.: "/images/hero.jpg") ou URL liberada em next.config.ts. */
  src: string;
  /** Texto alternativo descritivo — obrigatório para acessibilidade e SEO. */
  alt: string;
  width: number;
  height: number;
}

export interface ThemeColors {
  /** Fundo principal (preto). */
  background: string;
  /** Superfícies: faixas e painéis (grafite). */
  surface: string;
  /** Superfícies elevadas: campos e cartões sobre o grafite. */
  surfaceRaised: string;
  /** Linhas e bordas. */
  border: string;
  /** Texto principal. */
  foreground: string;
  /** Texto secundário. */
  muted: string;
  /** Cor de destaque (dourado discreto). Use com moderação. */
  accent: string;
  /** Texto sobre a cor de destaque. */
  accentForeground: string;
  /** Fundo das seções claras (contraste com o preto). */
  paper: string;
  /** Texto sobre as seções claras. */
  ink: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
}

/** Conteúdo da página individual do serviço (somente plano premium). */
export interface ServicePageContent {
  /** Uma frase de resumo, usada também como descrição para o Google. */
  summary: string;
  /** Parágrafos do texto principal. Descreva o procedimento, sem promessas de resultado. */
  body: string[];
  /** Etapas ou itens incluídos no atendimento (opcional). */
  includes?: string[];
}

export interface Service {
  /** Também é o endereço da página do serviço: /servicos/<id>. Use letras minúsculas e hífens. */
  id: string;
  categoryId: string;
  name: string;
  description: string;
  /** Duração estimada, em minutos. */
  durationMinutes: number;
  /** Preço em reais (ex.: 45 ou 47.5). */
  price: number;
  /** Mostra "a partir de" antes do preço. */
  priceFrom?: boolean;
  /** Aparece na seção "Serviços" da página inicial. */
  featured?: boolean;
  /** Com conteúdo aqui (e plano premium), o serviço ganha uma página própria. */
  page?: ServicePageContent;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  specialties: string[];
  bio: string;
  /** Opcional: sem foto, o cartão mostra as iniciais. */
  photo?: ImageAsset;
  instagram?: string;
}

export interface OpeningHours {
  day: Weekday;
  /** "HH:MM" no fuso do estabelecimento. Omitir `open`/`close` = fechado. */
  open?: string;
  close?: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

/** Textos de interface: cada campo é opcional e substitui o padrão de src/config/texts.ts. */
export type SiteTextsOverride = { [K in keyof SiteTexts]?: Partial<SiteTexts[K]> };

export interface SiteConfig {
  /**
   * Modo demonstrativo: mostra avisos de conteúdo fictício, impede a indexação e nunca
   * coloca um número de destino nos links de WhatsApp.
   * Mude para `false` somente com dados reais e aprovados pelo cliente: a partir daí o build
   * exige telefone válido e confirmado, dados legais e direitos de imagem (ver validate-config.ts).
   */
  demo: boolean;

  /** Plano contratado. Pode ser sobrescrito no build pela variável SITE_PLAN. */
  plan: Plan;

  business: {
    name: string;
    /** Usado no ícone/manifest. */
    shortName: string;
    /** Frase curta exibida no topo. */
    tagline: string;
    /** Parágrafo de apresentação. */
    description: string;
    /** Faixa de preço para o Google (ex.: "$$"). */
    priceRange: string;
  };

  /** Seção de apresentação ("Sobre"). */
  about: {
    title: string;
    text: string;
    highlights: { title: string; text: string }[];
  };

  /** URL pública final, sem barra no fim. NEXT_PUBLIC_SITE_URL e, na Vercel, o domínio de produção do projeto têm prioridade. */
  url: string;

  theme: {
    /** Paleta base. Disponível nos dois planos. */
    preset: ThemePreset;
    /** Ajustes cor a cor sobre o preset. Só aplicados no plano premium. */
    colors?: Partial<ThemeColors>;
  };

  contact: {
    /**
     * Número com DDI + DDD, apenas dígitos (ex.: "5516991234567").
     * Em modo demo deve ficar vazio: os links abrem o WhatsApp sem destinatário.
     */
    whatsapp: string;
    /**
     * Data (AAAA-MM-DD) em que o número foi testado com uma mensagem real e o cliente
     * confirmou o recebimento. Obrigatório fora do modo demo.
     */
    whatsappConfirmedAt?: string;
    /** Telefone como deve aparecer na tela. Vazio oculta. */
    phoneDisplay: string;
    email: string;
  };

  /** Quem é o responsável pelo site perante a LGPD (aparece na página de privacidade). */
  legal: {
    /** Razão social ou nome do responsável. */
    controllerName: string;
    /** CNPJ ou CPF, se o cliente quiser exibir. */
    document?: string;
    /** E-mail para pedidos sobre dados pessoais. */
    privacyEmail: string;
    /** Data da última revisão da política (AAAA-MM-DD). */
    privacyUpdatedAt: string;
    /** Empresa de hospedagem citada na política. Padrão: "Vercel". */
    hostingProvider?: string;
    /** Serviço de envio de e-mail (SMTP) do sistema de contas, citado como operador. Ex.: "Brevo". */
    emailProvider?: string;
    /** Parágrafos extras específicos do cliente, revisados por ele. */
    extraPrivacyNotes?: string[];
  };

  /** Situação dos direitos de uso das imagens. Fora do modo demo, precisa estar "confirmados". */
  imageRights: {
    status: "ilustrativas-demo" | "confirmados";
    /** Ex.: "Fotos feitas pelo cliente; autorização de imagem dos barbeiros assinada em 10/11/2026". */
    notes: string;
    /** Data da confirmação (AAAA-MM-DD). */
    confirmedAt?: string;
  };

  address: {
    street: string;
    neighborhood: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    /** Coordenadas para o mapa e o SEO local. */
    geo: { latitude: number; longitude: number };
    /** Link "Como chegar" (Google Maps). */
    mapsUrl: string;
    /** URL do iframe do mapa (Google Maps → Compartilhar → Incorporar). */
    mapsEmbedUrl: string;
  };

  /** Cidades atendidas — reforça o SEO local. */
  serviceArea: string[];

  /** Fuso horário IANA usado para calcular "aberto agora". */
  timeZone: string;
  hours: OpeningHours[];

  social: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
  };

  images: {
    hero: ImageAsset;
    about: ImageAsset;
    booking: ImageAsset;
  };

  serviceCategories: ServiceCategory[];
  services: Service[];
  /** Plano premium. */
  team: TeamMember[];
  gallery: ImageAsset[];
  /** Plano premium. */
  faq: FaqItem[];

  booking: {
    /** Primeira linha da mensagem enviada pelo WhatsApp. */
    greeting: string;
    periods: string[];
  };

  seo: {
    title: string;
    description: string;
    keywords: string[];
  };

  /** Substitui textos de interface (títulos, botões, rótulos). Ver src/config/texts.ts. */
  texts?: SiteTextsOverride;
}
