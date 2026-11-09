# Planos: Essencial, Premium e Profissional (proposta)

Os dois planos são **o mesmo projeto**: o campo `plan` do `site.config.ts` liga e desliga recursos.
Correções e melhorias valem para os dois. A regra está em `src/lib/plan.ts`.

## O que cada plano inclui

| Recurso | Essencial | Premium |
| --- | :---: | :---: |
| Página inicial com foto, nome, endereço e "aberto agora" | ✓ | ✓ |
| Apresentação ("Sobre") com 3 destaques | ✓ | ✓ |
| Serviços em destaque e tabela de preços completa | ✓ | ✓ |
| Galeria com foto ampliada | ✓ | ✓ |
| Localização: mapa sob demanda, "Como chegar", horários | ✓ | ✓ |
| WhatsApp: botão flutuante e bloco "Agende pelo WhatsApp" | ✓ | ✓ |
| SEO básico: título, descrição, Open Graph, sitemap, robots, dados estruturados `BarberShop` | ✓ | ✓ |
| Política de privacidade (LGPD) | ✓ | ✓ |
| Paleta pronta (`classico`, `grafite` ou `carvalho`) | ✓ | ✓ |
| Equipe com fotos, especialidades e Instagram de cada profissional | | ✓ |
| Dúvidas frequentes, com dados estruturados `FAQPage` | | ✓ |
| Formulário de solicitação de horário (serviço, profissional, data, período) | | ✓ |
| Página própria por serviço (`/servicos/<id>`), quando houver conteúdo | | ✓ |
| Cores ajustadas uma a uma sobre a paleta | | ✓ |

No Essencial, a área `#agendar` mostra um bloco com botão de WhatsApp no lugar do formulário. Os dados
de equipe, FAQ e páginas de serviço podem continuar no config; eles só não aparecem.

## Como escolher o plano

```ts
// src/config/site.config.ts
plan: "essencial", // ou "premium"
```

Para demonstrar os dois a partir do mesmo repositório, sem mexer no config, use a variável de build
`SITE_PLAN`:

```bash
SITE_PLAN=essencial npm run build   # força o essencial
```

Na Vercel, dá para ter dois projetos ligados ao mesmo repositório, um deles com `SITE_PLAN=essencial`
em *Environment Variables*.

## Páginas por serviço (Premium)

Um serviço ganha página quando tem o campo `page` preenchido:

```ts
{
  id: "degrade",               // vira /servicos/degrade
  name: "Degradê",
  // ...
  page: {
    summary: "Uma frase que resume o serviço (vira a descrição no Google).",
    body: ["Parágrafo 1.", "Parágrafo 2."],
    includes: ["Item incluído", "Outro item"], // opcional
  },
}
```

Crie páginas **só com conteúdo real**, escrito ou aprovado pelo cliente. Página com texto genérico não
ajuda no Google e pode atrapalhar. Serviços sem `page` continuam na tabela de preços normalmente.

Cada página tem título "<serviço> em <cidade>", trilha de navegação, dados estruturados `Service` e
`BreadcrumbList`, botão de WhatsApp com o serviço já escrito na mensagem e entra no `sitemap.xml`.
Endereços que não correspondem a um serviço com página respondem 404.

## Personalização visual

- **Essencial:** escolha um preset em `theme.preset`. Os três passaram no teste de contraste (WCAG AA)
  em `src/lib/plan.test.ts`.
- **Premium:** além do preset, ajuste qualquer cor em `theme.colors` (ex.: `{ accent: "#c9a46a" }`).
  No Essencial esse campo é ignorado, e o build avisa.

Ao mudar cores, confira o contraste (mínimo 4.5:1) em
<https://webaim.org/resources/contrastchecker/>.

## Upgrade de Essencial para Premium

1. Preencha `team`, `faq` e, se houver conteúdo, `page` nos serviços.
2. Troque `plan: "essencial"` por `plan: "premium"`.
3. Rode `npm test` e `npm run build`, revise e publique.

## Profissional (proposta da V3)

> **Decisão comercial pendente.** O nome, o preço e o que entra neste plano são sugestões. O código
> já trata o plano como `profissional` e pode ser renomeado sem mudar a lógica.

Tudo do Premium, mais o sistema de agendamento:

| Recurso | Profissional |
| --- | :---: |
| Pedido de horário sem conta: serviço → profissional → data → horário livre → nome e telefone → WhatsApp | ✓ |
| Painel no celular: agenda do dia e da semana, registrar agendamento, registrar atendimento no balcão | ✓ |
| Cadastro de clientes (nome e telefone) com aviso de telefone repetido | ✓ |
| Horários pelo painel: expediente, almoço, folgas, feriados, férias e bloqueios por profissional | ✓ |
| Programa de fidelidade com cartões separados, cortesias e livro-razão auditável | ✓ |
| Pedidos de privacidade registrados pelo painel, exportação e exclusão do cliente | ✓ |
| Políticas de privacidade, cookies e termos ajustadas ao modelo sem conta | ✓ |

Liga quando `plan: "profissional"` (ou `SITE_PLAN=profissional`) **e** o Supabase está configurado.
Sem o Supabase, o site se comporta como Premium. Custos recorrentes possíveis (hospedagem, banco,
domínio; não há e-mail nem SMS) estão em [HOSPEDAGEM.md](HOSPEDAGEM.md). Instalação e manual:
[ARQUITETURA-V3.md](ARQUITETURA-V3.md), [MANUAL-ADMIN.md](MANUAL-ADMIN.md).

### Upgrade de Premium para Profissional

1. Crie e configure o projeto Supabase do cliente ([HOSPEDAGEM.md](HOSPEDAGEM.md#supabase-free)).
2. Defina as variáveis na hospedagem e `plan: "profissional"`.
3. Siga a seção 7 do [checklist](CHECKLIST-PUBLICACAO-LGPD.md).
