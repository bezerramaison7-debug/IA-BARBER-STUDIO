# Segurança e LGPD da V3

Complementa o [checklist de publicação](CHECKLIST-PUBLICACAO-LGPD.md). Vale para sites com o
sistema de agendamento ligado (plano profissional + Supabase).

## Modelo de segurança

O navegador fala direto com o Supabase usando a **chave pública** (anon/publishable). Ela é feita para
ser pública. A proteção está no banco:

- **RLS em todas as 14 tabelas** e revogação dos privilégios amplos que o Supabase concede por padrão
  (`20261104000300_v3_permissoes.sql`). Cada permissão foi concedida explicitamente.
- Visitante lê só o catálogo (serviços, profissionais, expediente, regras de fidelidade e configurações
  públicas). Nenhuma tabela com dado pessoal é legível sem login.
- Cliente lê só as próprias linhas e edita só **nome, telefone e opção de marketing** (permissão por
  coluna). O papel (`role`) não pode ser alterado pelo próprio usuário (gatilho `_guard_profile_update`).
- Agendamentos, pontos e recompensas **não têm permissão de escrita direta**: só por funções
  `SECURITY DEFINER` (com `search_path` vazio), que validam tudo. Não dá para fabricar pontos, horários
  ou cortesias pela API.
- Administração conferida **no banco** (`is_admin()`), não pela tela.
- Imutáveis até para o superusuário: `audit_logs`, `loyalty_entries`, `appointment_status_history`. A
  única exceção é a exclusão em cascata quando o titular é apagado no Auth.
- Testes automáticos de permissão em `supabase/tests/seguranca.test.ts` (rodam no CI).

### Chaves e segredos

| Chave | Onde pode ficar |
| --- | --- |
| URL do projeto e chave publishable/anon | Variáveis `NEXT_PUBLIC_*` da hospedagem |
| `service_role` / chave secreta (`sb_secret_...`) | **Nunca** no site, no repositório ou em `NEXT_PUBLIC_*`. O site não precisa dela |
| Senha do banco, token do Supabase | Só no gerenciador de senhas de quem mantém o site |

O site recusa URL que não seja `https://` (exceto localhost), e `looksLikeSecretKey` detecta uma chave
secreta colocada por engano.

### Cabeçalhos HTTP

Em produção: `Content-Security-Policy` (o navegador só conversa com o próprio site e com o Supabase
do cliente, e só embute o mapa do Google), `Strict-Transport-Security`, `X-Content-Type-Options`,
`Referrer-Policy`, `X-Frame-Options` e `Permissions-Policy`. Ver `src/lib/security-headers.ts`.

### Proteção contra abuso

- Limites no banco: horários em aberto por conta (padrão 3) e pedidos por hora (padrão 6).
- E-mail confirmado é obrigatório para pedir horário.
- Tentativas de login: limitadas pelo Supabase Auth por IP (**Authentication → Rate Limits**). Mantenha
  os padrões ou reduza.
- Recomendado para a próxima fase: CAPTCHA gratuito (Cloudflare Turnstile ou hCaptcha) no cadastro e no
  login, suportado pelo Supabase Auth. Exige uma chave do provedor e uma pequena mudança nos formulários.

## Configuração obrigatória no Supabase (cada cliente)

**Authentication → Sign In / Providers → Email**

- Confirm email: **ligado**.
- Secure email change: ligado.
- Minimum password length: **8**. Password requirements: letras e dígitos (o site já exige).
- Leaked password protection: só em plano pago. Deixe desligado no Free.

**Authentication → URL Configuration**

- Site URL: `https://dominio-do-cliente`.
- Redirect URLs: `https://dominio-do-cliente/auth/confirmar` e `https://dominio-do-cliente/redefinir-senha`
  (inclua o endereço de testes, se houver).

**Authentication → Emails (SMTP)**: SMTP próprio é necessário para clientes reais. Ver
[HOSPEDAGEM.md](HOSPEDAGEM.md#e-mail).

**Authentication → Emails (Templates)**: use os modelos com `token_hash` do HOSPEDAGEM.md, que
funcionam em qualquer navegador.

**Database**: não crie tabelas novas sem RLS. Rode as migrações na ordem e confira em
**Advisors → Security** que não há alertas.

### Primeiro administrador

Depois que a pessoa da barbearia criar a própria conta e confirmar o e-mail, rode **uma vez** no
SQL Editor:

```sql
select public.bootstrap_first_admin('email-da-pessoa@dominio');
```

A função só funciona se ainda não houver administrador, e o site não consegue chamá-la (sem `EXECUTE`
para `anon`/`authenticated`).

## LGPD

| Tema | Como a V3 atende |
| --- | --- |
| Minimização | Cadastro com só 4 dados (nome, telefone, e-mail, senha). Sem CPF, endereço, nascimento ou foto |
| Transparência | `/privacidade`, `/cookies` e `/termos` descrevem o comportamento real e mudam de texto quando o sistema está ligado |
| Bases legais | Execução de contrato (conta, agenda, fidelidade), interesse legítimo (segurança e auditoria), consentimento (marketing, desmarcado por padrão e com data registrada) |
| Cookies | Nenhum cookie de análise ou publicidade. Só a sessão de login no armazenamento local, estritamente necessária. Por isso não há banner |
| Acesso e portabilidade | **Minha conta → Baixar meus dados** (JSON com perfil, agendamentos, fidelidade e pedidos) |
| Correção | Minha conta → Meus dados |
| Eliminação | Em **duas etapas**, a segunda manual: anonimização pelo painel e depois exclusão do login no Supabase Auth. Ver "Exclusão: o que cada etapa faz" |
| Revogação de consentimento | Desmarcar novidades em Minha conta, ou pedido formal |
| Registro de acesso | Toda abertura de ficha de cliente e toda mudança no painel ficam em `audit_logs` |
| Operadores | Supabase (banco e Auth), hospedagem e provedor de e-mail, citados na política |
| Transferência internacional | Citada na política (art. 33). Prefira a região `sa-east-1` (São Paulo) ao criar o projeto |
| Prazo de resposta | 15 dias (painel → Privacidade) |

### Exclusão: o que cada etapa faz

A exclusão **só está completa depois da etapa 2**, que é manual. Até lá, não diga ao titular que os
dados foram eliminados.

**Etapa 1. Anonimização no banco da aplicação** (Painel → Clientes → *Excluir dados*;
`admin_anonymize_customer`)

- Perfil: nome vira "Cliente removido", telefone é zerado, e-mail é apagado, marketing é desligado.
- Horários pendentes ou confirmados são cancelados, cortesias disponíveis ou reservadas são canceladas,
  e as observações dos agendamentos são apagadas.
- A conta não agenda nem edita o perfil.
- **Continua existindo**: o usuário no Supabase Auth, com e-mail, senha cifrada e os dados do cadastro
  (nome e telefone ficam nos metadados do usuário). A pessoa ainda consegue entrar e ver o próprio
  histórico anonimizado. Também continuam o livro-razão de fidelidade e as cortesias canceladas
  ligados ao identificador interno.

**Etapa 2. Exclusão no Supabase Auth** (manual: Supabase → Authentication → Users → *Delete user*)

- Apaga e-mail, senha e metadados do Auth.
- Em cascata: apaga o perfil, os lançamentos de fidelidade e as cortesias.
- Agendamentos ficam sem cliente (`customer_id` nulo).

**Retenção legítima depois das duas etapas** (registros necessários para segurança, prestação de contas
e estatística da agenda, sem identificação direta):

| Registro | O que sobra | Atenção |
| --- | --- | --- |
| `appointments` | Serviço, profissional, data, horário e status, sem cliente | Visitantes sem conta (`guest_name`/`guest_phone`) não são afetados: apague pelo SQL Editor se pedirem |
| `audit_logs` | Ação, data, identificadores internos (UUID) e motivo digitado | Imutável. O UUID não aponta mais para ninguém. **Não escreva nomes ou telefones nos motivos** |
| `appointment_status_history` | Mudanças de status e motivo digitado | Imutável. Mesma regra para os motivos |
| `privacy_requests` | Tipo, texto do pedido e resposta, sem cliente | O texto pode conter dado pessoal escrito pelo titular. Guarde só o necessário para comprovar o atendimento |

**Backups e cópias**

- Supabase Free: não há backup automático. As cópias são as do `pg_dump` que você fizer e contêm os
  dados de antes da exclusão: apague ou substitua as cópias antigas no prazo combinado
  (recomendado: até 30 dias).
- Supabase Pro: os backups diários guardam os dados até expirarem (7 dias no Pro). Se restaurar um
  backup, refaça as exclusões feitas depois da data dele.
- Exportações (Minha conta → Baixar meus dados) ficam com o titular.

### Retenção

- Conta: enquanto existir.
- Pendente não confirmado: expira no prazo configurado.
- Após a exclusão: ver a tabela acima.
- Backups (`pg_dump`) também contêm dados pessoais: guarde cifrados, apague cópias antigas e não
  os coloque no GitHub.

### Antes de publicar para um cliente real

- Controlador correto em `site.config.ts → legal` (razão social e documento **informados pelo
  cliente**, nunca inventados), e-mail de privacidade que alguém lê, `emailProvider` preenchido.
- Revisar os textos de `/privacidade`, `/cookies` e `/termos` com o cliente.
- Projeto Supabase próprio do cliente, de preferência numa conta dele (ou com termo de operador).
- SMTP próprio configurado e e-mails de teste recebidos.
- Nenhum dado real em testes, prints ou commits.
