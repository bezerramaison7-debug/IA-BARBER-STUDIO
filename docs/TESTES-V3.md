# Testes da V3

## Como rodar

| Comando | O que testa | Precisa de |
| --- | --- | --- |
| `npm test` | Lógica pura, componentes, formulários, mensagens (Vitest + happy-dom) | Nada |
| `npm run test:db` | Migrações, RLS, agenda, concorrência, fidelidade, LGPD num Postgres real | Postgres 16+ em `TEST_DATABASE_URL` (padrão `postgres://postgres@127.0.0.1:54329/postgres`) |
| `npm run lint` · `npm run typecheck` · `npm run build` | Qualidade e build | Nada |

O CI (`.github/workflows/ci.yml`) roda os quatro primeiros e o `test:db` num Postgres 17 (mesma versão
dos projetos novos do Supabase). `supabase/tests/support/supabase-shim.sql` recria o mínimo do Supabase
(papéis `anon`/`authenticated`/`service_role`, `auth.users`, `auth.uid()` e as permissões padrão), e cada
arquivo de teste cria um banco novo e aplica as migrações reais. **Nenhum dado real**: nomes, e-mails
(`@example.com`) e telefones são fictícios.

Banco local rápido (sem Docker):

```bash
initdb -D /tmp/pg && pg_ctl -D /tmp/pg -o "-p 54329" start
createuser -p 54329 -s postgres   # se necessário
npm run test:db
```

## Os 22 testes obrigatórios

| # | Requisito | Onde está a evidência |
| --- | --- | --- |
| 1 | Cliente cria conta | `v3.test.tsx`: "cadastro valida os 4 campos…" e "cadastro válido envia só nome, telefone, e-mail, senha…"; `seguranca.test.ts`: "recusa cadastro sem nome ou com telefone inválido" (gatilho `handle_new_user`) |
| 2 | Cliente entra com e-mail e senha | `v3.test.tsx`: "login com senha errada mostra mensagem compreensível"; login válido validado no navegador contra o servidor simulado (capturas em `docs/auditoria/v3/`) |
| 3 | Cliente recupera senha | `v3.test.tsx`: "pede o link para /redefinir-senha…", "o link do e-mail valida o token…", "nova senha fraca é recusada…" |
| 4 | Cliente consulta horários disponíveis | `agenda.test.ts`: "respeita expediente, intervalo e duração", "não oferece dias passados…", "dia sem expediente…" |
| 5 | Cliente solicita agendamento | `agenda.test.ts`: "cria PENDENTE com protocolo…", "exige e-mail confirmado", "recusa horário passado…"; `v3.test.tsx`: "solicita, mostra PENDENTE…" |
| 6 | Sistema salva a solicitação | `agenda.test.ts`: "cria PENDENTE com protocolo…", "clique repetido (mesma chave) não duplica", "histórico de status é registrado" |
| 7 | WhatsApp recebe a mensagem pré-preenchida | `booking.test.ts`: "segue o modelo com protocolo…", "usa o número oficial válido…", "sem número válido… abre sem destinatário"; `v3.test.tsx`: link `wa.me` e "abrir o WhatsApp não confirma" |
| 8 | Admin confirma agendamento | `agenda.test.ts`: "confirma, e cliente não pode confirmar"; `v3.test.tsx`: "pendente oferece confirmar e cancelar…" |
| 9 | Horário confirmado deixa de estar disponível | `agenda.test.ts`: "confirma, e cliente não pode confirmar" (confere a agenda pública depois) |
| 10 | Admin altera expediente | `agenda.test.ts`: "mudar expediente com agendamento existente…", "recusa expediente inválido" |
| 11 | Agenda pública reflete a alteração | `agenda.test.ts`: "mudar expediente…" (consulta `available_slots` como visitante logo após salvar) |
| 12 | Cliente não acessa dados de outro cliente | `seguranca.test.ts`: "só enxerga os próprios dados", "não altera dados de outra pessoa", "não cancela agendamento de outra pessoa", "idempotência não vaza agendamento alheio…" |
| 13 | Cliente não acessa painel admin | `seguranca.test.ts`: "não acessa nenhuma função administrativa", "edita o próprio nome… mas não o próprio papel" |
| 14 | Admin bloqueia horário | `agenda.test.ts`: "bloqueio remove horários e respeita a decisão sobre conflitos", "feriado para todos… fecha o dia inteiro" |
| 15 | Dois clientes não reservam o mesmo horário ao mesmo tempo | `agenda.test.ts`: "duas pessoas ao mesmo tempo…: exatamente uma consegue", "10 tentativas simultâneas com durações diferentes: nenhuma sobreposição" (conexões separadas, concorrência real) |
| 16 | Atendimento concluído incrementa fidelidade | `fidelidade.test.ts`: "10 cortes concluídos geram 1 corte grátis; os cartões são separados", "serviço fora do programa não pontua" |
| 17 | Décimo atendimento gera recompensa | `fidelidade.test.ts`: mesmo teste do item 16; "conclusões simultâneas no 10º ponto geram uma única recompensa" |
| 18 | Recompensa é usada só uma vez | `fidelidade.test.ts`: "agendamento com recompensa é cortesia…: consumida uma vez", "duas reservas simultâneas com a mesma recompensa: só uma passa", "recompensa de corte não vale para combo", "cliente não usa recompensa de outra pessoa" |
| 19 | Cancelamento ou reversão não gera pontos indevidos | `fidelidade.test.ts`: "falta e cancelamento não pontuam", "concluir duas vezes não conta em dobro; desfazer estorna…", "não é possível concluir um horário futuro", "cancelar devolve a recompensa; falta faz perder", "cancelar recompensa devolve os pontos"; `seguranca.test.ts`: "não fabrica pontos, recompensas nem agendamentos diretos" |
| 20 | Fluxos funcionam no celular | Navegador real (Chromium, 375×812 e 1440×900) contra servidor simulado: sem rolagem horizontal, sem erros no console, alvos de toque ≥ 44 px. Capturas em `docs/auditoria/v3/` |
| 21 | Site demonstrativo mantém avisos fictícios | `plan.test.ts` e `validate-config.test.ts` (demo, noindex, WhatsApp vazio); regressão V2 no navegador (26 verificações: noindex, nenhum `wa.me` com número, avisos); `seed.test.ts`: "aplica sem erro, sem WhatsApp…" |
| 22 | Publicação real continua sujeita ao checklist | `validate-config.test.ts` (regras de site real no build); [CHECKLIST-PUBLICACAO-LGPD.md](CHECKLIST-PUBLICACAO-LGPD.md) atualizado com os itens da V3 |

## Testes adicionais

- `seguranca.test.ts`: visitante não vê dado pessoal; acesso à ficha auditado; WhatsApp inválido recusado
  no banco; último administrador protegido; `bootstrap_first_admin` só uma vez e fora do alcance do site;
  auditoria e livro-razão imutáveis até para o superusuário; anonimização; exportação dos próprios dados.
- `fidelidade.test.ts`: exclusão definitiva do usuário no Auth (LGPD) com histórico removido e agenda
  sem identificação.
- `agenda.test.ts`: pendente expirado libera o horário; cliente cancela e reagenda; "sem preferência"
  escolhe um profissional livre; limite de pedidos em aberto.
- `security-headers.test.ts`: CSP. `booking.test.ts`: fuso de São Paulo, chave secreta recusada.

## O que ainda não foi testado (depende de ambiente externo)

- **Supabase real (Auth + PostgREST)**: os testes de banco usam Postgres com um shim do Auth, e os de
  tela simulam a API. Falta um ensaio ponta a ponta num **projeto Supabase de desenvolvimento**
  (gratuito) com SMTP configurado: cadastro → e-mail → confirmação → agendamento → painel → conclusão.
  Depende de você criar o projeto e fornecer URL e chave pública (nunca a secreta).
- **Hospedagem na Netlify**: deploy de teste pendente (ver [HOSPEDAGEM.md](HOSPEDAGEM.md)).
- Celulares físicos (iOS Safari e Android Chrome): os testes foram em Chromium com emulação.
