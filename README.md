# Barber Studio: template de site para barbearias

Modelo de site profissional para barbearias de Araraquara/SP e região, personalizado e vendido para
estabelecimentos reais em dois planos, **Essencial** e **Premium**, a partir do mesmo código. A
**V3** acrescenta um terceiro plano proposto, **Profissional**: o cliente consulta horários livres e
pede pelo WhatsApp, sem criar conta, e a barbearia opera agenda, clientes e fidelidade por um painel
(Supabase). A demonstração usa a marca fictícia
**Barber Studio**.

> **Todo o conteúdo da demonstração é fictício**: nomes, preços, endereço e perfis da equipe. Não há
> avaliações nem profissionais reais, e nenhum telefone real. As fotos são ilustrativas (Unsplash).

## O que o site tem

| | Essencial | Premium | Profissional (V3) |
| --- | :---: | :---: | :---: |
| Página inicial, sobre, serviços, tabela de preços, galeria | ✓ | ✓ | ✓ |
| Localização (mapa sob demanda, horários, "aberto agora") e WhatsApp | ✓ | ✓ | ✓ |
| SEO básico e políticas de privacidade, cookies e termos | ✓ | ✓ | ✓ |
| Equipe, dúvidas frequentes, formulário de solicitação de horário | | ✓ | ✓ |
| Página própria por serviço e cores ajustáveis uma a uma | | ✓ | ✓ |
| Pedido de horário sem conta (horários livres em tempo real → WhatsApp) | | | ✓ |
| Painel: confirmações, agenda, horários, folgas e feriados sem código | | | ✓ |
| Programa de fidelidade (cartões separados, cortesias, auditoria) | | | ✓ |

Detalhes em [`docs/PLANOS.md`](docs/PLANOS.md).

Qualidade:

- **SEO local**: metadados, Open Graph com imagem gerada, `sitemap.xml`, `robots.txt`, dados
  estruturados `BarberShop`, `FAQPage`, `Service` e `BreadcrumbList`
- **Acessibilidade**: HTML semântico, foco visível, alvos de toque de 44 px, rótulos e erros ligados aos
  campos, movimento reduzido respeitado (Lighthouse: 100)
- **Performance**: páginas estáticas, imagens AVIF/WebP, fontes auto-hospedadas, mapa sob demanda
- **Privacidade**: nos planos Essencial e Premium, sem cadastro, cookies, analytics ou backend (nada sai
  do navegador até a pessoa enviar a mensagem no WhatsApp). No Profissional, o pedido de horário
  também não grava nada (nome e telefone vão só na mensagem do WhatsApp); a barbearia cadastra no painel
  quem atende, com exportação e exclusão a pedido do titular
- **Segurança da V3**: regras e permissões no banco (RLS em todas as tabelas, funções que validam tudo),
  conflito de horário impossível por restrição do Postgres, CSP em produção
- **Segurança comercial**: o build valida o config. Em modo demo, nenhum link leva a um número de
  WhatsApp; um site real só é publicado com número válido e confirmado, dados da LGPD e direitos das
  imagens registrados

## Tecnologias

Next.js 16 (App Router, Turbopack, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 ·
Vitest + Testing Library · ESLint · Supabase (Auth + Postgres) na V3

## Como rodar

Requer Node.js 20.9 ou superior.

```bash
npm install
npm run dev        # http://localhost:3000
```

| Comando | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção (valida o config) |
| `npm start` | serve o build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | checagem de tipos |
| `npm test` | testes (config, lógica, formulário, telas da V3) |
| `npm run test:db` | testes do banco da V3 num Postgres (ver [`docs/TESTES-V3.md`](docs/TESTES-V3.md)) |
| `SITE_PLAN=essencial npm run build` | build no plano essencial, sem mexer no config |

## Personalizar para um cliente

Quase tudo está em [`src/config/site.config.ts`](src/config/site.config.ts); os textos de interface
padrão ficam em [`src/config/texts.ts`](src/config/texts.ts) e podem ser trocados pelo config.

- [Guia de personalização](docs/PERSONALIZACAO.md)
- [Checklist de publicação e LGPD](docs/CHECKLIST-PUBLICACAO-LGPD.md)
- [Planos](docs/PLANOS.md)
- [Relatório da auditoria V2](docs/AUDITORIA-V2.md)

### Sistema de agendamento (V3)

Liga só com `plan: "profissional"` (ou `SITE_PLAN=profissional`) **e** as variáveis do Supabase. Sem
elas, as rotas da V3 respondem 404 e o site é o da V2.

- [Arquitetura](docs/ARQUITETURA-V3.md) · [Regras da agenda](docs/AGENDA-REGRAS.md) ·
  [Fluxo do WhatsApp](docs/FLUXO-WHATSAPP.md) · [Fidelidade](docs/PROGRAMA-FIDELIDADE.md)
- [Manual do administrador](docs/MANUAL-ADMIN.md) · [Manual do cliente](docs/MANUAL-CLIENTE.md)
- [Segurança e LGPD](docs/SEGURANCA-LGPD.md) · [Hospedagem e custos](docs/HOSPEDAGEM.md) ·
  [Testes](docs/TESTES-V3.md)

## Indexação no Google

| Situação | Indexado? |
| --- | --- |
| `demo: true` (esta demonstração) | não |
| Site real, deploy de produção na Vercel | sim |
| Site real, preview de pull request (`VERCEL_ENV=preview`) | não |
| Site real na Netlify, deploy preview ou branch deploy (`CONTEXT` ≠ `production`) | não |
| Páginas do sistema (conta, painel, agendamento) | nunca |
| Qualquer deploy com `SITE_NOINDEX=1` | não |

O bloqueio é feito por meta `noindex` e cabeçalho `X-Robots-Tag`; o `robots.txt` permite o rastreamento
para que o Google consiga ler o `noindex`.

## Publicar

> **Vercel Hobby (gratuito) proíbe uso comercial**: serve para esta demonstração, não para clientes.
> Para clientes, a recomendação é **Netlify Free** (`netlify.toml` incluído) ou um plano pago. Ver
> [`docs/HOSPEDAGEM.md`](docs/HOSPEDAGEM.md).

Na Vercel (demonstração):

1. Em [vercel.com/new](https://vercel.com/new), importe o repositório.
2. **Environment Variables** (opcionais):
   - `NEXT_PUBLIC_SITE_URL`: domínio final, ex.: `https://www.barbeariadocliente.com.br`. Sem ela, o
     site usa o domínio de produção que a Vercel informa.
   - `SITE_PLAN`: `essencial`, `premium` ou `profissional`, se quiser sobrescrever o config.
   - `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (só no Profissional; nunca a
     chave secreta, que faz o build falhar).
   - `SITE_NOINDEX=1`: mantém um site real fora do Google enquanto aguarda aprovação.
3. **Deploy.** Cada push na branch principal atualiza a produção; cada pull request ganha uma URL de
   pré-visualização.
4. Domínio próprio: **Settings → Domains**.

O `.npmrc` contém `legacy-peer-deps=true` para contornar um bug do npm 10 ao instalar o Vitest; não
remova sem testar `npm install` do zero.

## Estrutura

```
src/
  app/                 rotas, layout, SEO (sitemap, robots, manifest, imagem OG), /servicos/[slug],
                       políticas; (sistema)/ = conta, agendamento e painel da V3
  components/
    layout/            cabeçalho, rodapé, botão de WhatsApp, redes sociais
    sections/          seções da página inicial
    seo/               JSON-LD
    ui/                botões, seções, ícones, páginas legais
    app/               pedido de horário, login da equipe e painel (V3)
  config/
    site.config.ts     ← dados do cliente
    texts.ts           textos de interface padrão
    texts-app.ts       textos do sistema da V3
    types.ts           formato do config, documentado campo a campo
  lib/                 lógica pura e testada: planos, validação, WhatsApp, horários, tema, SEO, CSP
    booking/           V3: datas, mensagem de confirmação, erros, regras de tela, chamadas ao Supabase
  proxy.ts             404 real para páginas de serviço inexistentes
supabase/
  migrations/          esquema, regras e permissões do banco (V3)
  seed.sql             dados fictícios da demonstração
  tests/               testes do banco (RLS, agenda, concorrência, fidelidade)
public/images/         fotos
docs/                  guias, checklist, planos, auditoria e créditos
```

## Licença

Código sob licença MIT (ver `LICENSE`). As fotos seguem a [Licença Unsplash](https://unsplash.com/license);
veja [`docs/CREDITOS.md`](docs/CREDITOS.md).
