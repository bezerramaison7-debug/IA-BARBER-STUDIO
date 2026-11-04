# Hospedagem da V3

**Recomendação: Netlify Free (site) + Supabase Free (banco e login da equipe) + domínio próprio.**
Não há e-mail transacional (SMTP) nem SMS: clientes não têm conta, e as contas da equipe são criadas já
confirmadas no painel do Supabase. É gratuito para começar, mas **não é ilimitado nem garantido**:
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

- **2 projetos ativos** por organização. Banco de 500 MB (sobra para uma barbearia). O limite de
  usuários do Auth é irrelevante: só a equipe tem login.
- **Pausa por inatividade**: projetos com pouca atividade por 7 dias podem ser pausados. Com o banco
  pausado, a consulta de horários e o painel param até alguém **restaurar no painel do Supabase**.
  Uma barbearia que usa o painel e recebe consultas toda semana tende a não pausar, mas monitore. Em período sem
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
4. Configure o Auth conforme [SEGURANCA-LGPD.md](SEGURANCA-LGPD.md#configuração-obrigatória-no-supabase-cada-cliente):
   **desligue "Allow new users to sign up"**.
5. Crie a conta do dono em Authentication → Users → Add user (Auto Confirm) e rode
   `bootstrap_first_admin`. Crie também a conta de quem mantém o site, liberada pelo painel.
6. **Advisors → Security**: confira que não há alertas.

> Migrações em produção só com aprovação. Teste antes num projeto de desenvolvimento.

## E-mail

**Não é necessário.** O sistema não envia e-mails: não há confirmação de conta nem recuperação de senha
por e-mail (ver [SEGURANCA-LGPD.md](SEGURANCA-LGPD.md#recuperação-de-acesso-sem-smtp)). O pedido do
cliente vai pelo WhatsApp dele.

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
| E-mail (SMTP) | Não usado | — |
| Domínio `.com.br` | Anuidade no Registro.br (pago pelo cliente) | — |
| WhatsApp | R$ 0 (link `wa.me`, sem API) | — |

Nenhum serviço pago é contratado pelo template. Upgrades são decisão comercial com o cliente.

## Uma instância por cliente

Cada barbearia tem repositório, projeto Supabase e site próprios. Não reutilize um
projeto Supabase entre clientes.
