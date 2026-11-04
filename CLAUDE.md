@AGENTS.md

# Barber Studio: template de sites para barbearias

Template comercial (Next.js 16 + TypeScript + Tailwind 4) personalizado por cliente.
Conteúdo da demo é fictício. Público: barbearias de Araraquara/SP e região. Idioma do site e dos
textos: português do Brasil.

## Comandos

- `npm run dev` · `npm run build` · `npm start`
- `npm run lint` · `npm run typecheck` · `npm test` (Vitest, ambiente happy-dom)
- `npm run test:db`: banco da V3 num Postgres (`TEST_DATABASE_URL`, ver `docs/TESTES-V3.md`)
- Rode lint, typecheck, test e build (e `test:db` se mexer em `supabase/`) antes de commitar. O CI roda todos.

## Arquitetura

- `src/config/site.config.ts` é a **única fonte de dados do cliente**. Componentes recebem
  `config: SiteConfig` (e `texts: SiteTexts`) por props; não espalhe dados de cliente em componentes.
  Campo novo → `src/config/types.ts` (com comentário), o config e, se tiver regra, `src/lib/validate-config.ts`.
- **Textos de interface** ficam em `src/config/texts.ts` (site, via `getTexts(config)`) e
  `src/config/texts-app.ts` (sistema da V3); nunca escreva título, botão ou rótulo direto no componente.
  Exceção: avisos que só existem com `demo: true`.
- **Planos**: `getFeatures(config)` em `src/lib/plan.ts` decide o que aparece (essencial × premium ×
  profissional). O sistema da V3 só liga com `isBookingSystemEnabled` (plano + variáveis do Supabase).
  Recurso novo de um plano → nova flag em `Features`, nunca um segundo projeto ou cópia de componente.
- **Validação**: `validateSiteConfig` roda no build (`layout.tsx`) e nos testes. Regra de negócio sobre o
  config (o que é obrigatório para site real) vai lá, com teste em `validate-config.test.ts`.
- `src/lib/` contém lógica pura com testes ao lado (`*.test.ts`). Lógica nova vai para `lib/` com teste.
- `src/components/sections/` = uma seção da home por arquivo; `ui/` = primitivas; `layout/` = casca.
- Âncoras da home (`#servicos`, `#precos`, `#equipe`, `#galeria`, `#agendar`, `#duvidas`, `#contato`) e
  o menu por plano: `src/lib/navigation.ts`. Páginas de serviço: `src/app/servicos/[slug]`, com 404
  real via `src/proxy.ts`.

## Sistema da V3 (Supabase)

- **Toda regra de negócio fica no banco** (`supabase/migrations/`): o navegador usa só a chave pública.
  A tela nunca é a única barreira. Leia `docs/ARQUITETURA-V3.md` antes de mudar agenda ou fidelidade.
- **Cliente não tem conta.** O público só LÊ horários livres; nome e telefone do pedido nunca vão ao
  banco nem à URL (só na mensagem do WhatsApp). Nenhuma função pública grava ou reserva. Login é só da
  equipe (cadastro público desligado, sem SMTP). Clientes ficam em `customers`, só para o admin.
- Telefone não autentica nem junta históricos (pode ser compartilhado ou reatribuído).
- Tabela nova: RLS ligado, permissões explícitas em `..._permissoes.sql` e teste em
  `supabase/tests/seguranca.test.ts`. Escrita em agendamentos, pontos e recompensas só por função
  `SECURITY DEFINER` com `set search_path = ''`; erros com `public._fail(código, mensagem em pt-BR)`.
- Migração já aplicada em algum projeto real não se edita: crie outra. Migração em produção só com aprovação.
- Nunca use a chave secreta/`service_role` no site, em `NEXT_PUBLIC_*`, em commits ou logs.
- Mensagem do pedido: `buildRequestUrl` (`src/lib/booking/whatsapp-confirmation.ts`). A interface nunca
  diz que reservou: só o painel registra e confirma.
- Testes de banco e de tela só com dados fictícios (`@example.com`). Fora do escopo: login de cliente,
  SMTP/SMS, pagamentos de qualquer tipo, mensageria paga, app nativo.

## Regras do Next.js desta versão

- `cacheComponents: true`: as páginas são pré-renderizadas. **Não use `new Date()`/`Date.now()`
  em Server Components** (falha no prerender ou congela a hora do build). Hora atual só em Client
  Components, via `useSyncExternalStore` (ver `open-status.tsx` e `booking-form.tsx`).
- Lint do React Compiler proíbe `setState` síncrono dentro de `useEffect`.
- `images.qualities` é obrigatório no `next.config.ts`; imagens remotas precisam de `remotePatterns`.
- Links internos com `next/link`.
- `generateStaticParams` não pode devolver lista vazia; `dynamicParams` não existe com Cache Components.
  `notFound()` depois do streaming responde 200: para 404 real use o `proxy`.
- Tipos globais `PageProps`/`LayoutProps` só existem após o build; o `typecheck` roda antes. Use tipos explícitos.
- Consulte `node_modules/next/dist/docs/` antes de usar APIs que você não conhece desta versão.

## Estilo

- Tokens de cor em `globals.css` (`@theme inline` → `--brand-*`), alimentados pelo config.
  Use `bg-background`, `bg-surface`, `bg-surface-raised`, `border-line`, `text-muted`, `text-accent`,
  `bg-paper`/`text-ink`. Não use cores fixas nos componentes (exceção: verde oficial do WhatsApp).
- Títulos: `font-display` (Big Shoulders) em caixa alta; texto: Instrument Sans.
- Dourado (`accent`) com moderação. Movimento apenas na entrada do hero; respeite `motion-reduce`.
- Acessibilidade obrigatória: `alt` descritivo, rótulos em campos, foco visível, alvos de toque ≥ 44px.

## WhatsApp, indexação e conteúdo

- Todo link de WhatsApp/telefone passa por `getWhatsAppNumber` (vazio em demo e para número inválido).
  Nunca use `config.contact.whatsapp` diretamente num link.
- Indexação só por `isIndexable` (`src/lib/indexing.ts`). Não use `Disallow: /` no robots para esconder
  páginas: o bloqueio é por `noindex` (meta + `X-Robots-Tag`).
- Nunca invente avaliações, depoimentos, notas, prêmios ou dados de pessoas reais. Textos descrevem o que
  existe; sem promessas de resultado, tempo de espera ou superioridade (o build avisa em `RISKY_CLAIMS`).
- Enquanto `demo: true`, mantenha os avisos de conteúdo fictício e o `noindex`.
- Não adicione `aggregateRating`/`review` ao JSON-LD sem avaliações reais verificáveis.
- O formulário da V2 não envia dados a servidor; mantenha assim (LGPD). As políticas
  (`/privacidade`, `/cookies`, `/termos`) descrevem o comportamento real e mudam com
  `isBookingSystemEnabled`: cookie, analytics ou coleta de dados nova exigem reescrevê-las.

## Dependências

- `.npmrc` usa `legacy-peer-deps=true` por um bug do npm 10 com peers opcionais do Vitest.
- Ambiente de teste é `happy-dom` (o `jsdom` dispara o mesmo bug).
