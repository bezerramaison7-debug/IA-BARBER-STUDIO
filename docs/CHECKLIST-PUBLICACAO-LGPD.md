# Checklist de publicação e LGPD

Use a cada novo cliente, antes de ligar o domínio. Itens marcados com **(build)** são conferidos
automaticamente: se estiverem errados, `npm run build` falha e diz o que corrigir.

> Este checklist ajuda a organizar a entrega; não substitui orientação jurídica. Em caso de dúvida
> sobre a LGPD, consulte um profissional.

## 1. Dados do cliente

- [ ] `demo: false` no `site.config.ts`
- [ ] Plano correto (`plan`) e o que foi contratado bate com o que aparece no site
- [ ] **(build)** WhatsApp válido (55 + DDD + número) e `whatsappConfirmedAt` preenchido depois do teste de envio
- [ ] Telefone exibido (`phoneDisplay`) igual ao número do WhatsApp ou ao fixo do estabelecimento
- [ ] Endereço, CEP, mapa e "Como chegar" apontam para o lugar certo (abra os dois links)
- [ ] Horários conferidos com o cliente, inclusive sábado e domingo
- [ ] Preços e durações conferidos com o cliente
- [ ] **(build)** Nenhum texto "fictício", "demonstrativo", "Rua Exemplo" ou `example.com` sobrando
- [ ] Redes sociais abrem os perfis certos

## 2. Conteúdo e publicidade

- [ ] Nenhuma avaliação, nota, depoimento, prêmio ou "nº 1" sem comprovação
- [ ] Avisos de "afirmação comercial" do build revisados com o cliente
- [ ] Páginas de serviço (premium) só com texto real, aprovado pelo cliente
- [ ] Nenhuma promessa de resultado ou de tempo de espera que o cliente não cumpra

## 3. Imagens

- [ ] Fotos próprias do estabelecimento (sem fotos de banco de imagens usadas como se fossem do local)
- [ ] Autorização de uso de imagem por escrito de cada pessoa reconhecível (barbeiros e clientes)
- [ ] Nenhuma marca de terceiros em destaque sem permissão
- [ ] **(build)** `imageRights.status: "confirmados"` com data
- [ ] **(build)** Todas as imagens com texto alternativo

## 4. LGPD e privacidade

- [ ] **(build)** Responsável (`legal.controllerName`), e-mail para pedidos de dados (`legal.privacyEmail`) e data da política
- [ ] Política de privacidade (`/privacidade`) lida e aprovada pelo cliente
- [ ] Essencial/Premium: o site continua sem cadastro, cookies, `localStorage`, analytics ou pixels.
      Profissional: só a sessão de login (estritamente necessária), descrita em `/privacidade` e `/cookies`.
      **Se analytics, pixel ou cookie de terceiros for adicionado**, as políticas precisam ser reescritas
      e é necessário um aviso de cookies com consentimento
- [ ] `/cookies` e `/termos` lidos e aprovados pelo cliente
- [ ] O cliente sabe que as mensagens do WhatsApp são dados pessoais: use só para responder e agendar,
      não para envio de propaganda sem consentimento
- [ ] O cliente sabe como atender um pedido de acesso, correção ou exclusão de dados (art. 18) pelo
      e-mail indicado
- [ ] O mapa do Google continua carregando só depois do clique

## 5. SEO e indexação

- [ ] `url` com o domínio final, ou `NEXT_PUBLIC_SITE_URL` definido na Vercel
- [ ] `seo.title` e `seo.description` com "barbearia em <cidade>" e o bairro
- [ ] Depois do deploy de produção: `/robots.txt` tem `Sitemap:`, a página **não** tem
      `<meta name="robots" content="noindex">` e o cabeçalho `X-Robots-Tag` não aparece
- [ ] Previews continuam com `noindex` (automático: `VERCEL_ENV` ou, na Netlify, `CONTEXT` diferente de `production`)
- [ ] Ficha do Google Meu Negócio com o link do site
- [ ] Sitemap enviado no Google Search Console (opcional, recomendado)

## 6. Técnica

- [ ] `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` sem erros (o CI faz isso no PR)
- [ ] Teste no celular de verdade: menu, formulário/WhatsApp, mapa, galeria
- [ ] Mensagem de teste pelo site chegou ao WhatsApp do cliente
- [ ] Domínio configurado na hospedagem com HTTPS (Vercel Hobby não serve para cliente: uso comercial proibido; ver [HOSPEDAGEM.md](HOSPEDAGEM.md))
- [ ] Lighthouse no domínio final: acessibilidade, boas práticas e SEO ≥ 90

## 7. Sistema de agendamento (plano Profissional)

Só se o cliente contratou o agendamento online. Detalhes em [HOSPEDAGEM.md](HOSPEDAGEM.md) e
[SEGURANCA-LGPD.md](SEGURANCA-LGPD.md).

- [ ] Projeto Supabase **próprio do cliente**, região São Paulo, migrações aplicadas na ordem
- [ ] Dados iniciais reais (serviços com os mesmos `id` do config, profissionais, expediente). O `seed.sql`
      fictício **não** foi usado
- [ ] Variáveis na hospedagem: `NEXT_PUBLIC_SUPABASE_URL` e chave **publishable/anon** (**(build)** o build
      falha se for a chave secreta), `SITE_PLAN=profissional` ou `plan: "profissional"`
- [ ] Auth: confirmação de e-mail ligada, senha mínima 8, Site URL e Redirect URLs com o domínio final
- [ ] SMTP próprio configurado, domínio verificado (SPF/DKIM) e modelos de e-mail com `token_hash`
- [ ] E-mails de teste recebidos: confirmação de conta e recuperação de senha
- [ ] Primeiro administrador criado (`bootstrap_first_admin`), e a pessoa da barbearia sabe usar o painel
      ([MANUAL-ADMIN.md](MANUAL-ADMIN.md))
- [ ] WhatsApp oficial salvo em **Painel → Configurações** e testado com uma mensagem
- [ ] Nome do programa de fidelidade e cartões conferidos com o cliente (regras anunciadas)
- [ ] `legal.emailProvider` preenchido. A política cita Supabase, hospedagem e e-mail como operadores
- [ ] **Advisors → Security** do Supabase sem alertas
- [ ] Ensaio completo com uma conta de teste (e-mail de teste, nunca de cliente): cadastro → confirmação →
      agendar → painel confirma → concluir → ponto no cartão → cancelar a conta de teste
- [ ] Rotina de backup combinada (`pg_dump` cifrado, fora do GitHub) e o cliente ciente da pausa do
      Supabase Free por inatividade

## 8. Aprovação

- [ ] Cliente aprovou a versão final (por escrito, e-mail ou WhatsApp)
- [ ] Data de publicação registrada
