# Segurança e LGPD da V3

Complementa o [checklist de publicação](CHECKLIST-PUBLICACAO-LGPD.md). Vale quando o sistema de
agendamento está ligado (plano profissional + Supabase).

## Modelo de segurança

- **Visitante sem conta, sem gravação.** O público só lê o catálogo e os horários livres
  (`available_slots`/`available_days`, que devolvem horário e nome do profissional, nada pessoal).
  Nenhuma função pública reserva horário ou cria cliente, então não há o que um robô ocupe ou preencha.
- **Login só da equipe.** Cadastro público desligado no Supabase Auth. Uma conta criada no painel do
  Supabase nasce **sem acesso** (`sem_acesso`) até um administrador liberar.
- **RLS em todas as 15 tabelas**, com os privilégios amplos padrão do Supabase revogados
  (`20261104000300_v3_permissoes.sql`). `customers`, agendamentos, fidelidade, auditoria e pedidos de
  privacidade: só o administrador lê. Agendamentos e pontos só mudam por funções `SECURITY DEFINER`
  (com `search_path` vazio), que validam tudo.
- **Administração conferida no banco** (`is_admin()`), não pela tela.
- **Imutáveis até para o superusuário**: `audit_logs`, `loyalty_entries` e `appointment_status_history`.
  A única exceção é a exclusão em cascata quando um cliente é excluído.
- **Telefone não é senha.** Ninguém consulta histórico ou fidelidade informando um telefone. O
  cadastro aceita telefone repetido (família, número reatribuído) e mostra isso ao administrador, sem
  juntar históricos.
- Testes de permissão em `supabase/tests/seguranca.test.ts`, rodando no CI.

### Chaves e segredos

| Chave | Onde pode ficar |
| --- | --- |
| URL do projeto e chave publishable/anon | Variáveis `NEXT_PUBLIC_*` da hospedagem |
| `service_role` / chave secreta | **Nunca** no site, no repositório ou em `NEXT_PUBLIC_*` (o build falha se aparecer) |
| Senha do banco, conta do Supabase | Só no gerenciador de senhas do responsável técnico |

### Cabeçalhos HTTP

Em produção, o site envia:
- `Content-Security-Policy`: o navegador só fala com o próprio site e com o Supabase do cliente, e só
  embute o mapa do Google;
- `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` e
  `Permissions-Policy`.

O cliente Supabase não lê sessão da URL (`detectSessionInUrl: false`), porque não há links de e-mail.

## Configuração obrigatória no Supabase (cada cliente)

- **Authentication → Sign In / Providers → Email**:
  - **"Allow new users to sign up" desligado** (sem cadastro público);
  - senha mínima de 8 caracteres.
- **Authentication → URL Configuration**: Site URL igual ao domínio do site.
- **SMTP: não é necessário.** Não há e-mail de confirmação ou recuperação. As contas da equipe são
  criadas já confirmadas.
- **Advisors → Security**: os avisos "SECURITY DEFINER executável" são das funções da API, que validam
  quem chama. Qualquer outro aviso (tabela sem RLS, por exemplo) precisa ser corrigido.

### Contas da equipe (provisionamento)

1. **Authentication → Users → Add user**: e-mail, senha provisória e **Auto Confirm User**.
2. **Primeiro administrador**: no SQL Editor, `select public.bootstrap_first_admin('email');`. Só
   funciona se ainda não houver administrador, e o site não consegue chamar essa função.
3. **Demais pessoas**: um administrador libera em Painel → Configurações → Acesso ao painel. A mudança
   fica auditada.
4. Cada pessoa troca a senha provisória em **Alterar minha senha**.

Não existe conta de manutenção oculta nem acesso administrativo público.

### Recuperação de acesso sem SMTP

| Situação | Procedimento |
| --- | --- |
| Uma pessoa esqueceu a senha, e outro admin entra | Responsável técnico cria conta nova (Add user). O outro admin libera o acesso. A conta antiga é apagada em Authentication → Users |
| **Nenhum administrador consegue entrar** | Responsável técnico apaga, em Authentication → Users, as contas sem acesso possível, cria a nova conta e roda `bootstrap_first_admin` (coberto por teste) |
| Perdeu-se a conta do próprio Supabase | Recuperação pelo suporte do Supabase. Por isso, deixe o projeto numa organização com **dois membros** (dono e responsável técnico), cada um com verificação em duas etapas na conta Supabase |

Apagar uma conta da equipe não apaga dados de clientes: os registros que ela criou ficam com o autor
vazio, e a auditoria guarda o identificador.

### TOTP (verificação em duas etapas) para administradores: avaliação

- **Disponível no Supabase Auth** com aplicativos autenticadores, sem SMS e sem custo (conferir no painel
  do projeto).
- **Uma implementação correta exige três partes**:
  1. tela de cadastro do fator (QR code, `supabase.auth.mfa.enroll`);
  2. desafio no login (`mfa.challenge`/`verify`), que eleva a sessão para `aal2`;
  3. **exigência no banco**: `is_admin()` precisa recusar sessões `aal1` de quem tem fator cadastrado.

  Sem a parte 3, uma senha vazada ainda entra pela API.
- **Fatores de recuperação**: o Supabase não emite códigos de recuperação. Mitigação: cada
  administrador cadastra dois fatores (dois aparelhos), há sempre dois administradores, e o responsável
  técnico pode remover um fator em Authentication → Users. Isso volta à tabela acima.
- **Decisão**: não implementado nesta fase. É a próxima melhoria recomendada para o painel, com testes de
  `aal2` no banco.

## LGPD

### O que é tratado, e onde

| Categoria | O quê | Onde fica | Base legal |
| --- | --- | --- | --- |
| Preenchido no navegador | Nome, telefone e observação do pedido | Só na memória da página. **Não vai ao banco nem à URL**, e nada fica no navegador | Não há tratamento pelo site |
| Transmitido ao WhatsApp | O texto da mensagem | No link `wa.me`, enviado pelo próprio visitante. O WhatsApp (Meta) é controlador independente | Escolha do titular |
| Gravado pela barbearia | Cadastro (nome, telefone, observações), agendamentos, atendimentos, fidelidade | `customers`, `appointments`, `loyalty_*` (só o admin) | Execução do serviço pedido (art. 7º, V) |
| Registros de segurança | Quem fez o quê no painel, acessos e exportações de ficha | `audit_logs` (identificador interno e motivo, **sem nome nem telefone**) | Interesse legítimo (art. 7º, IX) |
| Técnicos dos provedores | IP, navegador, data, consulta | Logs da hospedagem e do Supabase, pelos prazos deles | Interesse legítimo / operador |
| Cópias de segurança | O banco inteiro na data da cópia | Arquivos `pg_dump` do responsável técnico (Supabase Free não faz backup) | Segurança |

### Direitos do titular (sem conta de cliente)

Os pedidos chegam à barbearia pelo WhatsApp, e-mail ou balcão e são **registrados pelo administrador**
em Painel → Privacidade, com tipo, nome e contato de quem pediu, canal e resposta, tudo auditado. Antes
de entregar dados, a barbearia confirma que é a própria pessoa (por exemplo, respondendo no mesmo
WhatsApp do cadastro), porque o telefone pode ter mudado de dono.

| Pedido | Como atender |
| --- | --- |
| Acesso ou cópia | Ficha → **Exportar dados** (JSON, registrado na auditoria) |
| Correção | Ficha → **Corrigir dados** |
| Exclusão | Ficha → **Excluir cliente** (`admin_delete_customer`) |
| Oposição ou outro | Registrar e responder em Privacidade |

Prazo: 15 dias.

### Exclusão: o que é apagado e o que fica

**Apagado** por `admin_delete_customer`:
- o cadastro (nome, telefone, observações);
- os lançamentos de fidelidade e as cortesias;
- as observações dos agendamentos.

Os horários futuros são cancelados. Diferente da versão com login, **não há etapa manual**: não existe
conta de cliente no Auth.

**Fica retido**, sem identificação direta:

| Registro | O que sobra | Atenção |
| --- | --- | --- |
| `appointments` | Serviço, profissional, data, horário e status, sem cliente | Atendimentos avulsos (`guest_name`/`guest_phone`) não têm ficha. Se pedirem, apague pelo SQL Editor |
| `audit_logs` | Ação, data, identificador interno e motivo digitado | Imutável. **Não escreva nomes ou telefones nos motivos** |
| `appointment_status_history` | Mudanças de status e motivo | Imutável. Mesma regra |
| `privacy_requests` | O próprio pedido (nome e contato de quem pediu, resposta) | Prova do atendimento. Guarde só o necessário |
| Mensagens no WhatsApp da barbearia | Conversas | Fora do sistema. A barbearia apaga no próprio WhatsApp |
| Backups | O cadastro da data da cópia | Substitua ou apague as cópias no prazo combinado (recomendado: até 30 dias) |

Não diga ao titular que "tudo foi apagado" sem mencionar essas retenções.

### Navegador e cookies

- **Visitante**: nenhum cookie e nenhum armazenamento local (verificado no navegador).
- **Equipe**: só a sessão de login no armazenamento local (`sb-…`), estritamente necessária, apagada ao
  sair. Sem analytics e sem banner.

### Antes de publicar para um cliente real

- Controlador correto em `site.config.ts → legal`: razão social e documento **informados pelo cliente**,
  nunca inventados. E-mail de privacidade que alguém leia.
- Revisar `/privacidade`, `/cookies` e `/termos` com o cliente.
- Projeto Supabase próprio do cliente, com cadastro público desligado e dois administradores.
- Nenhum dado real em testes, capturas ou commits.
