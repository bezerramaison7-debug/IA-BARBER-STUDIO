<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Barber Studio Template

Documentation and operational guidelines for AI coding agents and human developers maintaining or extending this repository.

---

## 1. Important Language Requirement (pt-BR)

> **CRITICAL REQUIREMENT:**
> The website is exclusively intended for Brazilian users. **All user-facing content must remain in Brazilian Portuguese (`pt-BR`).**
>
> If you create or modify any:
> - page, section, component, form, modal, or layout
> - button label, placeholder, helper text, or input validation message
> - notification, alert, confirmation message, or modal text
> - navigation label, header, footer text, or copyright notice
> - SEO metadata (page title, meta description, Open Graph tags, JSON-LD descriptions)
> - accessibility text (`aria-label`, image `alt` texts, screen reader hints)
> - error page or fallback content (such as 404 pages)
>
> **Write it strictly in natural Brazilian Portuguese (`pt-BR`). Do NOT translate the user interface into English.**
>
> **English is allowed only for:**
> - Source code identifiers (variable, function, file, and component names)
> - Technical documentation and architectural guides
> - Internal developer comments
> - Git commit messages and pull request descriptions

---

## 2. Technology Stack

- **Framework:** Next.js 16.4.2 (App Router, Turbopack, Cache Components, Partial Prerendering)
- **UI Library:** React 19.3.0 & React DOM 19.3.0
- **Language:** TypeScript 5 (Strict Mode)
- **Styling:** Tailwind CSS 4 (`@tailwindcss/turbopack`, `@theme inline` design tokens)
- **Fonts:** Big Shoulders Display (`font-display`, self-hosted via `next/font/local`) and Instrument Sans (`font-sans`, self-hosted)
- **Testing:** Vitest 4.1.12 with Happy-DOM 21.0.4, React Testing Library 16.3.3, `@testing-library/user-event`
- **Linting:** ESLint 9 with `eslint-config-next` 16.4.2
- **Node.js Environment:** Node.js `>=20.9.0` (Recommended: Node 20 or Node 22 LTS)
- **Package Manager:** npm (with `.npmrc` configured with `legacy-peer-deps=true` due to an npm 10 peer dependency resolution issue with Vitest optional peers)

---

## 3. Current Architecture

The project is an SSG-oriented, privacy-respecting commercial website template designed for barbershops and hair salons (specifically focused on Brazilian businesses, such as in Araraquara/SP and surrounding areas).

### Key Architectural Tenets:

1. **Single Source of Truth (`src/config/site.config.ts`):**
   - All tenant/client data lives in `src/config/site.config.ts`.
   - Components receive `config: SiteConfig` (and `texts: SiteTexts`) via props or context. Never hardcode client data inside UI components.
   - Any new configuration field must be typed in `src/config/types.ts`, configured in `src/config/site.config.ts`, and validated in `src/lib/validate-config.ts`.

2. **Centralized UI Copy (`src/config/texts.ts`):**
   - Standard interface copy (button labels, section headings, form instructions, 404 strings) is centralized in `src/config/texts.ts` and accessed through `getTexts(config)`.
   - Clients can override UI texts via `texts` in `site.config.ts`.

3. **Multi-tier Plan System (`src/lib/plan.ts`):**
   - Two plans are supported out of the same codebase: **Essencial** and **Premium**.
   - `getFeatures(config)` determines which modules are rendered (e.g. Essencial shows a direct WhatsApp CTA block, whereas Premium displays an interactive appointment request form, team profiles, FAQ accordion, individual service pages, and custom color overrides).
   - Never create a separate fork or duplicate component hierarchy for different tiers; gate behavior using feature flags from `getFeatures(config)`.

4. **Zero Backend / Strict Client Privacy (LGPD Compliant):**
   - No server actions handling user records, no databases, no tracking cookies, no local storage persistence, and no third-party analytics pixels.
   - Appointment requests are assembled entirely client-side and directed to the official WhatsApp API link (`wa.me`) upon user submission.
   - External embeds (e.g., Google Maps) are on-demand only (loaded only after explicit user interaction).

5. **Edge/Proxy for Dynamic Routing & Static Rendering:**
   - Static pages are prerendered at build time (`cacheComponents: true`).
   - Service subpages (`/servicos/[slug]`) are dynamically generated based on service entries containing a `page` field.
   - Real HTTP 404 status codes for invalid routes are handled via `src/proxy.ts` (Next.js proxy / middleware) to avoid soft 404s.

---

## 4. Directory Structure

```
├── .github/
│   └── workflows/
│       └── ci.yml               # GitHub Actions CI workflow (Node 22: npm ci, lint, typecheck, test, build)
├── docs/                        # Project documentation, checklists, audit reports, license attribution
│   ├── AUDITORIA-V2.md          # Comprehensive performance, privacy, and UX audit report
│   ├── CHECKLIST-PUBLICACAO-LGPD.md # Client publishing and Brazilian LGPD compliance checklist
│   ├── CREDITOS.md              # Image licensing and author attribution
│   ├── PERSONALIZACAO.md        # Step-by-step tenant customization manual
│   └── PLANOS.md                # Feature breakdown: Essencial vs Premium
├── public/
│   ├── fonts/                   # Self-hosted WOFF2 fonts
│   ├── images/                  # Barber shop imagery (optimized AVIF/WebP targets)
│   └── favicon.ico              # Fallback favicon
├── src/
│   ├── app/                     # Next.js App Router root
│   │   ├── layout.tsx           # Root HTML layout with fonts, theme CSS variables, and build-time config validation
│   │   ├── page.tsx             # Home page assembling all section components
│   │   ├── icon.svg             # Dynamic SVG favicon
│   │   ├── manifest.webmanifest # PWA Web App Manifest
│   │   ├── opengraph-image.tsx  # Dynamic OG image generator via @vercel/og
│   │   ├── privacidade/         # Privacy policy (/privacidade) tailored to LGPD and zero-storage
│   │   ├── robots.txt           # Robots configuration driven by isIndexable
│   │   ├── sitemap.xml          # Sitemap including home, privacy, and active service pages
│   │   └── servicos/[slug]/     # Service landing pages (Premium tier)
│   ├── components/
│   │   ├── layout/              # Header, footer, floating WhatsApp button (FAB), social bar
│   │   ├── sections/            # Home sections: hero, about, services, pricing, gallery, booking, FAQ, team, location
│   │   ├── seo/                 # Structured data (JSON-LD: BarberShop, FAQPage, Service, BreadcrumbList)
│   │   └── ui/                  # Reusable UI primitives (buttons, modals, badges, icons)
│   ├── config/
│   │   ├── site.config.ts       # Tenant configuration (primary data file)
│   │   ├── site.config.test.ts  # Tests ensuring site.config.ts adheres to validation rules
│   │   ├── texts.ts             # Centralized Portuguese interface copy
│   │   └── types.ts             # TypeScript definitions for configuration schema
│   ├── lib/                     # Pure business logic and utilities (with corresponding *.test.ts files)
│   │   ├── format.ts            # Currency (BRL) and phone formatters
│   │   ├── hours.ts             # Business hours computation and live "open now" status
│   │   ├── indexing.ts          # Search engine indexing rules (noindex logic)
│   │   ├── navigation.ts        # Navigation links filtered by active plan
│   │   ├── plan.ts              # Plan feature flags & theme preset resolution
│   │   ├── site.ts              # URL resolution, meta tag generator, JSON-LD schema builder
│   │   ├── theme.ts             # Dynamic CSS color variable generator
│   │   ├── validate-config.ts   # Client config validator (enforces LGPD, valid WhatsApp, demo checks)
│   │   └── whatsapp.ts          # WhatsApp link generator and phone number sanitation
│   └── proxy.ts                 # Next.js middleware / proxy handler for strict 404 responses
├── .env.example                 # Example environment variables
├── .gitignore                   # Standard Next.js/Node gitignore
├── .npmrc                       # legacy-peer-deps=true configuration
├── eslint.config.mjs            # Flat ESLint configuration with Next.js rules
├── next.config.ts               # Next.js settings: Turbopack, images, cacheComponents, security headers
├── package.json                 # Project dependencies and script definitions
├── tsconfig.json                # TypeScript compiler configuration
└── vitest.config.mts            # Vitest configuration (happy-dom environment)
```

---

## 5. Development, Build, and Test Commands

All commands are executed from the repository root:

- **Install dependencies:**
  ```bash
  npm install
  # or for clean CI installations:
  npm ci
  ```
  *(Note: `.npmrc` must keep `legacy-peer-deps=true` due to npm 10 Vitest optional peers).*

- **Start local development server:**
  ```bash
  npm run dev
  ```
  Access at: `http://localhost:3000`

- **Type checking:**
  ```bash
  npm run typecheck
  ```
  Runs `tsc --noEmit` using project strict mode.

- **Linting:**
  ```bash
  npm run lint
  ```
  Runs ESLint across all source files.

- **Run test suite:**
  ```bash
  npm test
  # or to run in watch mode:
  npm run test:watch
  ```
  Executes Vitest in `happy-dom` environment.

- **Production build:**
  ```bash
  npm run build
  ```
  Validates `site.config.ts`, executes Turbopack compilation, runs TypeScript checks, and prerenders all pages.

- **Build with plan override:**
  ```bash
  SITE_PLAN=essencial npm run build
  # or
  SITE_PLAN=premium npm run build
  ```

- **Serve production build locally:**
  ```bash
  npm start
  ```
  Starts production Next.js server on `http://localhost:3000`.

---

## 6. Required Environment Variables

All environment variables are optional for local development and demo mode. For production deployments, they are managed via deployment settings (e.g., Vercel Project Settings):

| Variable | Type | Description | Default / Fallback |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SITE_URL` | String (URL) | Canonical production URL (e.g., `https://www.barbeariaexemplo.com.br`) without trailing slash. | Uses Vercel system production domain or `url` defined in `site.config.ts`. |
| `SITE_PLAN` | `"essencial"` \| `"premium"` | Overrides the `plan` field specified in `site.config.ts` during build time. | Falls back to `site.config.ts` (`plan`). |
| `SITE_NOINDEX` | `"1"` \| `"true"` | When set, forces `<meta name="robots" content="noindex, nofollow">` and `X-Robots-Tag: noindex, nofollow` even on production deployments. Useful while awaiting client sign-off. | Indexable only if `demo: false` and `VERCEL_ENV=production`. |

> **Security Note:** Do not commit `.env` or `.env.local` files containing production secrets. This application does not require database credentials or third-party API private keys.

---

## 7. Deployment Strategy

- **Target Platform:** Vercel (or any Node.js container / static host supporting Next.js App Router with Proxy/Middleware).
- **Branch Strategy:**
  - `main`: Continuous Deployment to production.
  - Pull Requests: Automatically spawn preview environments.
- **Automated CI Workflow (`.github/workflows/ci.yml`):**
  - Runs on every push to `main` and on all pull requests.
  - Executes: `npm ci` → `npm run lint` → `npm run typecheck` → `npm test` → `npm run build`.
- **Pre-publish Validation:**
  - Next.js build invokes `validateSiteConfig(siteConfig)` in `src/app/layout.tsx`. If `siteConfig.demo === false` and required production fields (valid Brazilian WhatsApp, confirmed date, image rights, privacy controller) are invalid, build halts with clear diagnostic errors.

---

## 8. Completed Features

- [x] **Home Page:** Hero banner, business presentation ("Sobre"), service showcase with category filtering, complete pricing list, image gallery with modal view, working hours, and location block.
- [x] **Appointment Booking Flow:**
  - Premium: Interactive booking form (selecting service, barber, date, period) compiling a formatted Brazilian Portuguese WhatsApp message (`booking-form.tsx`).
  - Essencial: Direct WhatsApp booking card.
- [x] **Live Business Hours & Status:** Computes open/closed status respecting local Brazilian timezone without hydration mismatch (`open-status.tsx`, `hours.ts`).
- [x] **Team Section (Premium):** Barber profiles, roles, bios, and Instagram links (`team.tsx`).
- [x] **FAQ Section (Premium):** Accordion interface with `FAQPage` JSON-LD schema integration (`faq.tsx`).
- [x] **Service Detail Pages (Premium):** Dynamic `/servicos/[slug]` pages for services with rich descriptions, breadcrumbs, and structured data.
- [x] **On-Demand Maps:** Google Maps embedded iframe loads only after explicit user interaction, preventing external third-party tracking until consented.
- [x] **Floating WhatsApp CTA (FAB):** Persistent bottom-right WhatsApp button with screen-reader accessible label (`whatsapp-fab.tsx`).
- [x] **Design & Theming:** Three accessible WCAG AA palettes (`classico`, `grafite`, `carvalho`) plus individual color customization support for Premium tier.
- [x] **SEO & Metadata:** Open Graph card generator (`opengraph-image.tsx`), `sitemap.xml`, `robots.txt`, Web App Manifest, dynamic SVG icon, and comprehensive JSON-LD schemas (`BarberShop`, `BreadcrumbList`, `FAQPage`, `Service`).
- [x] **Privacy & LGPD Compliance:** Custom `/privacidade` page explaining zero cookie usage, zero backend storage, and direct WhatsApp messaging terms.
- [x] **Safety Gates:** Built-in safeguards preventing live WhatsApp clicks or search indexing during demo mode or preview stages.

---

## 9. Pending Features & Future Roadmap

- [ ] **Automated End-to-End Visual Regression Suite:** Integration of Playwright E2E tests into CI workflow.
- [ ] **Dynamic Multi-tenant Loader:** Ability to switch `site.config.ts` dynamically via environment variable or tenant ID for multi-tenant SaaS hosting.
- [ ] **Holiday / Special Hours Calendar:** Configurable temporary holiday closures or special operating schedules in `hours.ts`.
- [ ] **Multi-location Support:** Schema and UI extensions for barbershops with multiple branch addresses.

---

## 10. Important Architectural Decisions

1. **Next.js 16 Cache Components (`cacheComponents: true`):**
   - Pages are prerendered as static HTML.
   - **Never call `new Date()` or `Date.now()` directly in Server Components**, as this will fail prerender or freeze the build time. Dynamic client-time operations must be executed in Client Components via `useSyncExternalStore` (see `src/components/layout/open-status.tsx` and `src/components/sections/booking-form.tsx`).
2. **React Compiler Lint Compatibility:**
   - Synchronous `setState` inside `useEffect` is prohibited. State transitions must be event-driven or derived.
3. **Image Optimization Rules:**
   - `images.qualities = [75]` is required in `next.config.ts`.
   - All external images require pre-configured `remotePatterns`.
   - Local assets in `/public/images` must include explicit `width`, `height`, and descriptive `alt` in Brazilian Portuguese.
4. **Real 404 Routing (`src/proxy.ts`):**
   - In Next.js 16, `notFound()` called post-streaming may serve HTTP 200 with fallback content. To ensure true 404 HTTP status for non-existent service paths, `src/proxy.ts` validates paths against available service slugs.
5. **WhatsApp Sanitization (`src/lib/whatsapp.ts`):**
   - The raw number from `site.config.ts` must never be directly interpolated into `href`. All WhatsApp and phone links must pass through `getWhatsAppNumber` and `buildWhatsAppLink`, which enforce demo shielding, Brazilian E.164 DDD formatting, and dummy number rejection.

---

## 11. Security Constraints & LGPD Compliance

- **LGPD (Lei Geral de Proteção de Dados - Lei 13.709/2018):**
  - The website intentionally does not store personal data. It does not use session cookies, local storage tracking, tracking pixels (Facebook Pixel, TikTok Pixel), or Google Analytics by default.
  - If analytics or backend forms are added in the future, a cookie banner and consent mechanism must be implemented and `/privacidade` must be updated.
- **Third-party Privacy Isolation:**
  - Google Maps iframe is deferred until the user explicitly clicks "Mostrar mapa" ("Show map").
- **Content Claim Protection (Código de Defesa do Consumidor - CDC Art. 37):**
  - Commercial superlatives and unverified claims (e.g., "o melhor", "sem fila", "garantia", "nº 1") trigger build warnings via `RISKY_CLAIMS` in `validate-config.ts` to protect business owners from misleading advertising liabilities.
- **Image Rights Protection:**
  - Publishing for production (`demo: false`) requires `imageRights.status: "confirmados"` and a confirmation date.

---

## 12. External Integrations

- **WhatsApp API (`https://wa.me/`):** Assembles encoded message links (`wa.me/<number>?text=<encoded_text>`). In demo mode (`demo: true`), links are sanitized or rendered with inert test previews.
- **Google Maps:** On-demand embed (`address.mapsEmbedUrl`) and direct navigation route links (`address.mapsUrl`).
- **Social Media:** Direct outbound links (`rel="noopener noreferrer"`) to Instagram, Facebook, and TikTok.

---

## 13. Known Limitations & Technical Debt

- **Unsplash Demo Photos:** Demo photos are sourced from Unsplash. Real customer sites must replace all demo photos with genuine client photography and documented model releases.
- **npm 10 Peer Dependency Bug:** Requires `legacy-peer-deps=true` in `.npmrc` due to Vitest optional peer dependencies. Do not remove `.npmrc` without testing `npm install` on clean environments.
- **SEO Score on Demo Deployments:** Lighthouse SEO score on demo deployments will report 66–69 due to intentional `noindex` blocking (`is-crawlable` check). In production with `demo: false`, the score reaches 90–100.

---

## 14. Step-by-Step Instructions for Validating Future Changes

When modifying code or updating client content, always execute this verification sequence:

1. **Verify Dependencies and Clean State:**
   ```bash
   npm run typecheck
   ```
   Ensures all TypeScript types match and no broken contracts exist.

2. **Run Linter:**
   ```bash
   npm run lint
   ```
   Ensures ESLint rules and React Compiler conventions pass.

3. **Run Unit and Component Tests:**
   ```bash
   npm test
   ```
   Ensures all 82+ Vitest specs pass (covering validation, business hours, WhatsApp sanitation, plans, formatting, and components).

4. **Verify Production Build (Both Plans):**
   ```bash
   # Test default build (Premium)
   npm run build

   # Test Essencial plan build
   SITE_PLAN=essencial npm run build
   ```
   Ensures static prerendering, configuration validation, and route generation complete successfully.

5. **Verify Local Production Serving:**
   ```bash
   npm start
   ```
   Open `http://localhost:3000` in the browser or via curl:
   ```bash
   curl -I http://localhost:3000
   ```
   Verify HTTP 200 response and presence of security headers.

6. **Verify User-Facing Language:**
   Verify that all UI text is written in natural Brazilian Portuguese (`pt-BR`).
