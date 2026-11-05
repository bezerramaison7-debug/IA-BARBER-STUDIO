!IA

Autoria: eu defini a ideia, os requisitos e as regras de negócio. A arquitetura e o código foram feitos por IA, sob minha orientação.

# Barber Studio: template de site para barbearias

Modelo de site profissional para barbearias de Araraquara/SP e região, personalizado e vendido para
estabelecimentos reais em dois planos, **Essencial** e **Premium**, a partir do mesmo código. A
demonstração usa a marca fictícia **Barber Studio**.

> **Todo o conteúdo da demonstração é fictício**: nomes, preços, endereço e perfis da equipe. Não há
> avaliações nem profissionais reais, e nenhum telefone real. As fotos são ilustrativas (Unsplash).

## O que o site tem

| | Essencial | Premium |
| --- | :---: | :---: |
| Página inicial, sobre, serviços, tabela de preços, galeria | ✓ | ✓ |
| Localização (mapa sob demanda, horários, "aberto agora") e WhatsApp | ✓ | ✓ |
| SEO básico e política de privacidade | ✓ | ✓ |
| Equipe, dúvidas frequentes, formulário de solicitação de horário | | ✓ |
| Página própria por serviço e cores ajustáveis uma a uma | | ✓ |

Detalhes em [`docs/PLANOS.md`](docs/PLANOS.md).

Qualidade:

- **SEO local**: metadados, Open Graph com imagem gerada, `sitemap.xml`, `robots.txt`, dados
  estruturados `BarberShop`, `FAQPage`, `Service` e `BreadcrumbList`
- **Acessibilidade**: HTML semântico, foco visível, alvos de toque de 44 px, rótulos e erros ligados aos
  campos, movimento reduzido respeitado (Lighthouse: 100)
- **Performance**: páginas estáticas, imagens AVIF/WebP, fontes auto-hospedadas, mapa sob demanda
- **Privacidade**: sem cadastro, cookies, analytics ou backend; nada sai do navegador até a pessoa
  enviar a mensagem no WhatsApp
- **Segurança comercial**: o build valida o config. Em modo demo, nenhum link leva a um número de
  WhatsApp; um site real só é publicado com número válido e confirmado, dados da LGPD e direitos das
  imagens registrados

## Tecnologias

Next.js 16 (App Router, Turbopack, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 ·
Vitest + Testing Library · ESLint

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
| `npm test` | testes (config, lógica, formulário) |
| `SITE_PLAN=essencial npm run build` | build no plano essencial, sem mexer no config |

## Personalizar para um cliente

Quase tudo está em [`src/config/site.config.ts`](src/config/site.config.ts); os textos de interface
padrão ficam em [`src/config/texts.ts`](src/config/texts.ts) e podem ser trocados pelo config.

- [Guia de personalização](docs/PERSONALIZACAO.md)
- [Checklist de publicação e LGPD](docs/CHECKLIST-PUBLICACAO-LGPD.md)
- [Planos Essencial e Premium](docs/PLANOS.md)
- [Relatório da auditoria V2](docs/AUDITORIA-V2.md)

## Indexação no Google

| Situação | Indexado? |
| --- | --- |
| `demo: true` (esta demonstração) | não |
| Site real, deploy de produção na Vercel | sim |
| Site real, preview de pull request (`VERCEL_ENV=preview`) | não |
| Qualquer deploy com `SITE_NOINDEX=1` | não |

O bloqueio é feito por meta `noindex` e cabeçalho `X-Robots-Tag`; o `robots.txt` permite o rastreamento
para que o Google consiga ler o `noindex`.

## Publicar na Vercel

1. Em [vercel.com/new](https://vercel.com/new), importe o repositório.
2. **Environment Variables** (opcionais):
   - `NEXT_PUBLIC_SITE_URL`: domínio final, ex.: `https://www.barbeariadocliente.com.br`. Sem ela, o
     site usa o domínio de produção que a Vercel informa.
   - `SITE_PLAN`: `essencial` ou `premium`, se quiser sobrescrever o config.
   - `SITE_NOINDEX=1`: mantém um site real fora do Google enquanto aguarda aprovação.
3. **Deploy.** Cada push na branch principal atualiza a produção; cada pull request ganha uma URL de
   pré-visualização.
4. Domínio próprio: **Settings → Domains**.

O `.npmrc` contém `legacy-peer-deps=true` para contornar um bug do npm 10 ao instalar o Vitest; não
remova sem testar `npm install` do zero.

## Estrutura

```
src/
  app/                 rotas, layout, SEO (sitemap, robots, manifest, imagem OG), /servicos/[slug]
  components/
    layout/            cabeçalho, rodapé, botão de WhatsApp, redes sociais
    sections/          seções da página inicial
    seo/               JSON-LD
    ui/                botões, seções, ícones
  config/
    site.config.ts     ← dados do cliente
    texts.ts           textos de interface padrão
    types.ts           formato do config, documentado campo a campo
  lib/                 lógica pura e testada: planos, validação, WhatsApp, horários, tema, SEO
  proxy.ts             404 real para páginas de serviço inexistentes
public/images/         fotos
docs/                  guias, checklist, planos, auditoria e créditos
```

## Licença

Código sob licença MIT (ver `LICENSE`). As fotos seguem a [Licença Unsplash](https://unsplash.com/license);
veja [`docs/CREDITOS.md`](docs/CREDITOS.md).
