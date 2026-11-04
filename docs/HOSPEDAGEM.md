# Hospedagem da V3

**Recomendação: Netlify Free (site) + Supabase Free (banco e login) + um provedor de e-mail com
plano gratuito + domínio próprio.** É gratuito para começar, mas **não é ilimitado nem garantido**:
os limites abaixo precisam ser acompanhados. Valores conferidos em novembro de 2026 nas páginas dos
provedores. Confira de novo antes de contratar, porque eles mudam.

## Comparação

| Opção | Uso comercial | Encaixe com este projeto | Riscos | Decisão |
| --- | --- | --- | --- | --- |
| **Netlify Free + Supabase Free** | Permitido | Next 16 suportado oficialmente, sem configuração. O site é quase todo estático | Limite de créditos com pausa de **todos** os sites da conta. Pausa do Supabase por inatividade | **Recomendada** |
| Cloudflare Workers Free + Supabase | Permitido | Exige adaptador OpenNext e ajustes | Limite de 10 ms de CPU por requisição no Free (arriscado para páginas renderizadas) | Alternativa futura |
| Vercel Pro + Supabase | Permitido | Melhor compatibilidade com Next | Pago (por membro/mês) | Upgrade, se o cliente pagar |
| Vercel Hobby | **Proibido** (só uso pessoal, não comercial) | Total | Viola os termos | **Descartada** para clientes. Usada só na demonstração do template |

## Netlify Free

- 300 créditos por mês, com **limite rígido**: sem cobrança extra, mas, ao acabar, **todos os sites da
  conta saem do ar** até o próximo ciclo (ou até um upgrade).
- Cada **deploy de produção custa 15 créditos**. Banda: cerca de 20 créditos por GB. Deploy previews
  não consomem créditos.
- Na prática: cerca de 20 deploys de produção por mês **ou** cerca de 15 GB de tráfego, ou uma
  combinação. Um site de barbearia costuma ficar bem abaixo disso. O risco é fazer muitos deploys.
- Boas práticas: **um cliente por conta (time) da Netlify**, para que um site não derrube os outros.
  Agrupe mudanças antes de publicar e acompanhe **Team → Usage**.
- Há relatos no fórum da Netlify de times gratuitos pausados por engano com créditos sobrando.
  Tenha o contato de suporte e um plano B.

### Publicar

1. Netlify → **Add new project → Import from Git** → repositório do cliente.
2. O `netlify.toml` já define build e Node 22. O runtime de Next.js é instalado automaticamente.
3. **Site configuration → Environment variables** (escopo Builds e Functions):

| Variável | Valor |
| --- | --- |
| `SITE_PLAN` | `profissional` (ou omita para usar o plano do `site.config.ts`) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<projeto>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | chave **publishable** (ou a anon) do projeto |
| `NEXT_PUBLIC_SITE_URL` | `https://dominio-do-cliente` |

4. **Domain management** → adicione o domínio. O HTTPS é automático.
5. Deploy previews e branch deploys ficam com `noindex` automaticamente (`CONTEXT` diferente de
   `production`).

> **Validação pendente:** o template ainda não foi publicado na Netlify. A Netlify anuncia suporte ao
> Next 16 sem configuração, mas não detalha Cache Components e `proxy.ts`. Antes do primeiro cliente
> real, faça um deploy de teste (gratuito) e confira: home, página de serviço inexistente com 404,
> `/agendar` e login.

## Supabase Free

- **2 projetos ativos** por organização. Banco de 500 MB, 50 mil usuários ativos por mês (sobra para
  uma barbearia).
- **Pausa por inatividade**: projetos com pouca atividade por 7 dias podem ser pausados. Com o site
  pausado, o agendamento para de funcionar até alguém **restaurar no painel do Supabase**.
  Uma barbearia com clientes agendando toda semana tende a não pausar, mas monitore. Em período sem
  uso (férias coletivas), entre no painel e confira.
- **Sem backup no Free**: faça você mesmo (ver Backup).
- Para um cliente que dependa do sistema, o **Supabase Pro** remove a pausa e inclui backups diários.
  É uma decisão comercial com custo.
- Crie o projeto na região **South America (São Paulo)**.

### Instalar o banco (cada cliente)

1. Crie o projeto no Supabase (de preferência na conta do cliente).
2. **SQL Editor**: rode, nesta ordem, o conteúdo de:
   1. `supabase/migrations/20261104000100_v3_esquema.sql`
   2. `supabase/migrations/20261104000200_v3_funcoes.sql`
   3. `supabase/migrations/20261104000300_v3_permissoes.sql`

   Alternativa com a CLI: `supabase link --project-ref <ref>` e `supabase db push`.
3. **Dados iniciais**: o `supabase/seed.sql` é **fictício** (demonstração). Para um cliente real, copie-o,
   troque serviços, profissionais e horários pelos reais (com os mesmos `id` de serviço do
   `site.config.ts`) e rode a cópia. Não versione dados pessoais.
4. Configure o Auth conforme [SEGURANCA-LGPD.md](SEGURANCA-LGPD.md#configuração-obrigatória-no-supabase-cada-cliente).
5. Crie o primeiro administrador (`bootstrap_first_admin`).
6. **Advisors → Security**: confira que não há alertas.

> Migrações em produção só com aprovação. Teste antes num projeto de desenvolvimento.

## E-mail

O envio padrão do Supabase **só entrega para membros da equipe do projeto** e tem limite de poucas
mensagens por hora. Ou seja, clientes reais **não recebem** confirmação nem recuperação de senha.
**SMTP próprio é obrigatório** (Authentication → Emails → SMTP Settings).

Opções com plano gratuito (confira os limites atuais antes de escolher):

| Provedor | Plano gratuito (referência) |
| --- | --- |
| Brevo | ~300 e-mails/dia |
| Resend | ~3.000 e-mails/mês, 100/dia |

Para isso, é preciso verificar o domínio do cliente (registros DNS SPF/DKIM) no provedor. Depois,
ajuste **Authentication → Rate Limits → emails per hour**. Preencha `legal.emailProvider` no
`site.config.ts` (aparece na política de privacidade).

### Modelos de e-mail (Authentication → Emails → Templates)

Use links com `token_hash`, que funcionam mesmo se o cliente abrir o e-mail em outro aparelho:

| Modelo | Link |
| --- | --- |
| Confirm signup | `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=email` |
| Reset password | `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery` |
| Change email address | `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=email_change` |

Exemplo de corpo (confirmação):

```html
<h2>Confirme seu e-mail</h2>
<p>Olá! Para usar o agendamento online, confirme seu e-mail:</p>
<p><a href="{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=email">Confirmar e-mail</a></p>
<p>Se você não criou esta conta, ignore esta mensagem.</p>
```

## Backup

- Semanal (ou antes de cada migração): `pg_dump` com a connection string do projeto
  (**Project Settings → Database**), ou `supabase db dump --data-only` mais `supabase db dump` para o
  esquema.
- O arquivo contém **dados pessoais**: guarde cifrado (por exemplo, num cofre de senhas ou disco
  cifrado), mantenha poucas cópias e **nunca** coloque no GitHub ou em artefatos de CI.
- Teste a restauração num projeto de desenvolvimento pelo menos uma vez.

## Custos

| Item | Início | Quando cresce |
| --- | --- | --- |
| Hospedagem (Netlify) | R$ 0 (Free, com limite de créditos) | Plano pago da Netlify, ou Vercel Pro |
| Banco e login (Supabase) | R$ 0 (Free, com pausa por inatividade e sem backup) | Supabase Pro (sem pausa, com backup) |
| E-mail (SMTP) | R$ 0 (plano gratuito do provedor) | Plano pago se passar do limite diário |
| Domínio `.com.br` | Anuidade no Registro.br (pago pelo cliente) | — |
| WhatsApp | R$ 0 (link `wa.me`, sem API) | — |

Nenhum serviço pago é contratado pelo template. Upgrades são decisão comercial com o cliente.

## Uma instância por cliente

Cada barbearia tem repositório, projeto Supabase, conta de e-mail e site próprios. Não reutilize um
projeto Supabase entre clientes.
