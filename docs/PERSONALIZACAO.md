# Guia de personalização para um novo cliente

Como transformar o template no site de uma barbearia real. Tempo estimado: 1 a 3 horas, com os dados
e as fotos do cliente em mãos. Antes de publicar, siga o
[checklist de publicação e LGPD](CHECKLIST-PUBLICACAO-LGPD.md).

## 1. O que pedir ao cliente

- [ ] Plano contratado: Essencial ou Premium ([diferenças](PLANOS.md))
- [ ] Nome do estabelecimento e uma frase curta de apresentação
- [ ] **Número do WhatsApp** que vai receber os agendamentos
- [ ] Razão social (ou nome do responsável), CNPJ se quiser exibir e um e-mail para pedidos de dados (LGPD)
- [ ] Endereço completo, CEP e link do Google Maps (o da ficha do Google Meu Negócio, se houver)
- [ ] Horários de cada dia da semana e cidades atendidas
- [ ] Tabela de serviços: nome, descrição curta, duração e preço
- [ ] **Fotos próprias** do espaço e de trabalhos, com autorização de uso de imagem de quem aparece
- [ ] Links de Instagram, Facebook e TikTok
- [ ] Premium: profissionais (nome, especialidades, uma frase, foto autorizada), perguntas frequentes e,
      se fizer sentido, um texto mais longo para os serviços principais
- [ ] Cores da marca, se existirem
- [ ] Domínio desejado (ex.: `barbeariadocliente.com.br`)

## 2. Crie o repositório do cliente

Um repositório por cliente, criado a partir deste template (no GitHub: **Use this template**). Assim as
correções do template podem ser trazidas depois sem misturar dados de clientes.

## 3. Edite `src/config/site.config.ts`

Cada campo está documentado em `src/config/types.ts`. Comece com `demo: true` enquanto preenche e só
mude para `false` no fim (seção 8).

| Campo | O que preencher |
| --- | --- |
| `plan` | `"essencial"` ou `"premium"` |
| `business` | nome, frase do topo (`tagline`), descrição e faixa de preço (`$`, `$$`, `$$$`) |
| `about` | título, texto e três destaques da seção "Sobre" |
| `url` | domínio final, com `https://` e sem barra no fim |
| `theme.preset` | `"classico"`, `"grafite"` ou `"carvalho"`; no premium, `theme.colors` ajusta cores |
| `contact.whatsapp` | só dígitos: `55` + DDD + número, ex.: `5516991234567` |
| `contact.whatsappConfirmedAt` | data (AAAA-MM-DD) do teste do número (seção 4) |
| `contact.phoneDisplay` | como o telefone aparece na tela, ex.: `(16) 99123-4567` |
| `contact.email` | e-mail de contato |
| `legal` | responsável (razão social), CNPJ opcional, e-mail para pedidos de dados, data da política |
| `imageRights` | `status: "confirmados"`, como as fotos foram obtidas e a data (seção 5) |
| `address` | endereço, coordenadas, link "Como chegar" e link do mapa incorporado |
| `serviceArea` | cidades atendidas (rodapé e SEO local) |
| `hours` | um item por dia (`0` = domingo … `6` = sábado). Sem `open`/`close` = fechado |
| `social` | URLs completas; rede sem URL não aparece |
| `serviceCategories` / `services` | grupos e serviços. `featured: true` destaca; `priceFrom: true` mostra "a partir de"; `page` cria página própria (premium) |
| `team` / `faq` | premium: equipe e perguntas frequentes |
| `gallery` / `images` | fotos (seção 5) |
| `booking` | primeira linha da mensagem do WhatsApp e períodos do formulário |
| `seo` | título, descrição e palavras-chave com "barbearia em <cidade>" e o bairro |
| `texts` | opcional: muda títulos, botões e rótulos (seção 6) |

### Endereço e mapa

1. No Google Maps, procure o estabelecimento.
2. **Compartilhar → Enviar um link**: cole em `address.mapsUrl`.
3. **Compartilhar → Incorporar um mapa**: copie só o valor de `src="…"` para `address.mapsEmbedUrl`.
4. Clique com o botão direito no ponto do mapa para copiar latitude e longitude para `address.geo`.

## 4. WhatsApp: número válido e confirmado

O build de um site real recusa número inválido ou sem confirmação. Para confirmar:

1. Preencha `contact.whatsapp` com o número do cliente (só dígitos, com 55 e DDD).
2. Rode o site (`npm run dev`), clique em "Chamar no WhatsApp" e envie uma mensagem de teste.
3. Peça ao cliente para confirmar que recebeu no aparelho certo.
4. Registre a data: `whatsappConfirmedAt: "2026-11-05"`.

O validador recusa DDD inexistente, número sem o 55, e padrões de exemplo como `99999-9999`,
`90000-0000` e sequências (`91234-5678`). Em modo demo, nenhum número é usado nos links, mesmo que
esteja preenchido.

## 5. Fotos e direitos de imagem

- Use **fotos do próprio estabelecimento**. Pessoas reconhecíveis (barbeiros, clientes) precisam de
  autorização de uso de imagem por escrito.
- Coloque os arquivos em `public/images/` e atualize `src`, `alt`, `width` e `height`.
- Tamanho: 1600–2000 px de largura para o topo; 1200 px para a galeria; JPG qualidade 70–80 (o Next
  converte para AVIF/WebP).
- `alt`: descreva o que aparece ("Barbeiro fazendo degradê na máquina"), não "foto1".
- Largura e altura: `identify public/images/arquivo.jpg` (ImageMagick) ou as propriedades do arquivo.
- Ao final, registre em `imageRights`:

```ts
imageRights: {
  status: "confirmados",
  notes: "Fotos feitas pelo cliente; autorização de imagem dos 3 barbeiros assinada.",
  confirmedAt: "2026-11-05",
},
```

## 6. Textos

- **Conteúdo do cliente** (serviços, sobre, FAQ, SEO): direto no config.
- **Textos de interface** (títulos de seção, botões, rótulos do formulário, rodapé): os padrões estão em
  `src/config/texts.ts`. Para mudar, use `texts` no config informando só o que muda:

```ts
texts: {
  services: { title: "Cortes e barba", intro: "O que fazemos." },
  booking: { steps: ["Escolha o serviço.", "Envie pelo WhatsApp.", "Aguarde a confirmação."] },
},
```

Marcadores disponíveis: `{cidade}`, `{bairro}` e `{nome}`.

**Regra de redação:** descreva o que existe. Não prometa tempo de espera, resultado, exclusividade,
qualidade superior nem cite avaliações que o cliente não possa comprovar (Código de Defesa do
Consumidor, art. 37). O build avisa quando encontra termos como "melhor", "garantia", "sem fila",
"nº 1" ou "avaliações"; confirme cada um com o cliente.

## 7. Ícone e cores

- Ícone da aba: edite `src/app/icon.svg` (ou troque por `icon.png` 512×512).
- Cores: escolha o preset; no premium, ajuste em `theme.colors`. Confira o contraste (mínimo 4.5:1).

## 8. Saia do modo demonstração

1. Mude `demo: false`.
2. Rode `npm test` e `npm run build`. O build lista **tudo** o que ainda falta, por exemplo:

```
site.config.ts tem 3 problema(s) a corrigir antes de publicar:
- contact.whatsappConfirmedAt: informe a data (AAAA-MM-DD) em que uma mensagem de teste foi recebida…
- imageRights: confirme os direitos de uso de todas as fotos…
- config.faq[2].answer: ainda contém texto de demonstração ("Avise pelo WhatsApp… Exemplo de política…")
```

3. Corrija até o build passar. Os avisos (afirmações comerciais) não bloqueiam, mas revise cada um.
4. Siga o [checklist de publicação e LGPD](CHECKLIST-PUBLICACAO-LGPD.md).

## 9. Agendamento online (plano Profissional)

Só se o cliente contratou o sistema da V3. Além dos passos acima:

1. Confirme as informações comerciais com o cliente **antes** de configurar: nome do programa de
   fidelidade, regras dos cartões, prazos de cancelamento e de confirmação. Não preencha nada por
   suposição (nome, razão social, CNPJ ou número).
2. `plan: "profissional"` e `legal.emailProvider` no `site.config.ts`.
3. Crie o projeto Supabase, aplique as migrações e os dados reais, configure Auth e SMTP:
   [HOSPEDAGEM.md](HOSPEDAGEM.md).
4. Variáveis do Supabase na hospedagem (chave publishable, nunca a secreta).
5. Crie o primeiro administrador e configure pelo painel: WhatsApp oficial, profissionais, serviços,
   expediente, feriados e programa de fidelidade ([MANUAL-ADMIN.md](MANUAL-ADMIN.md)).
6. Siga a seção 7 do [checklist](CHECKLIST-PUBLICACAO-LGPD.md).

Os horários e as regras da agenda ficam no banco e são mudados pelo painel. O `hours` do
`site.config.ts` continua sendo o horário **exibido** na página. Mantenha os dois coerentes.

## Comandos úteis

```bash
npm run dev                         # desenvolvimento em http://localhost:3000
npm test                            # valida o config e a lógica
npm run lint && npm run typecheck
npm run build && npm start          # versão de produção local
SITE_PLAN=essencial npm run build   # ver como fica no plano essencial
```
