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

## Os 22 testes obrigatórios (adaptados à V3 simplificada)

Com a simplificação, o cliente **não tem conta**. Os itens 1–3 e 12–13, escritos para o login de
cliente, passaram a valer para o modelo atual: login só da equipe, e o visitante não acessa dados.

| # | Requisito | Evidência |
| --- | --- | --- |
| 1 | Cadastro | Sem conta de cliente. A barbearia cadastra no painel: `seguranca.test.ts` "normaliza o telefone e recusa número inválido…", "telefone repetido é permitido… sem juntar históricos"; `v3.test.tsx` "telefone já cadastrado…" |
| 2 | Login | Só equipe: `v3.test.tsx` "login com senha errada…", "login certo vai para o painel"; `seguranca.test.ts` "conta criada no Auth nasce sem acesso" |
| 3 | Recuperação de acesso | Sem e-mail: `seguranca.test.ts` "recuperação quando ninguém consegue entrar: apagar a conta perdida no Auth libera o bootstrap"; `v3.test.tsx` "troca de senha logado…" |
| 4 | Consulta de horários disponíveis | `agenda.test.ts` "respeita expediente, intervalo e duração", "não oferece dias passados…", "a consulta pública não revela quem agendou"; `v3.test.tsx` "mostra só os horários livres…" |
| 5 | Solicitação | `v3.test.tsx` "nome e telefone geram a mensagem do WhatsApp sem gravar nada e sem dizer que reservou", "valida nome e telefone…" |
| 6 | Registro da solicitação | Pela barbearia: `agenda.test.ts` "cria CONFIRMADO com protocolo…", "clique repetido (mesma chave) não duplica", "histórico de status é registrado"; `seguranca.test.ts` "não grava nada: nenhuma função pública reserva horário…" |
| 7 | Mensagem pré-preenchida no WhatsApp | `booking.test.ts` "é um pedido, sem protocolo…", "usa o número oficial…", "sem número válido… abre sem destinatário" |
| 8 | Admin confirma | `agenda.test.ts` "pendente → confirmado; conta sem acesso não confirma"; `v3.test.tsx` "pendente oferece confirmar e cancelar…" |
| 9 | Horário confirmado deixa de estar disponível | `agenda.test.ts` "cria CONFIRMADO… e o horário deixa de aparecer", "pendente → confirmado…" |
| 10 | Admin altera expediente | `agenda.test.ts` "mudar expediente com agendamento existente…", "recusa expediente inválido" |
| 11 | Agenda pública reflete a alteração | `agenda.test.ts` "mudar expediente…" (consulta como visitante logo após salvar) |
| 12 | Ninguém acessa dados de clientes sem ser admin | `seguranca.test.ts` "vê catálogo e horários livres, mas nenhum dado pessoal", "conta sem acesso… não lê dados pessoais" |
| 13 | Ninguém acessa o painel sem ser admin | `seguranca.test.ts` "não acessa nenhuma função administrativa", "não se promove, não grava clientes nem fabrica pontos" |
| 14 | Admin bloqueia horário | `agenda.test.ts` "bloqueio remove horários…", "feriado para todos…" |
| 15 | Sem reserva dupla em operações simultâneas | `agenda.test.ts` "dois registros ao mesmo tempo… exatamente um passa", "10 tentativas simultâneas…"; `corrida.test.ts` (mudança de agenda × registro, feriado global, sem deadlock, mesma chave) |
| 16 | Atendimento concluído incrementa fidelidade | `fidelidade.test.ts` "10 cortes concluídos…", "10 combos concluídos…", "serviço fora do programa e atendimento avulso não pontuam" |
| 17 | Décimo atendimento gera recompensa | `fidelidade.test.ts` idem; "conclusões simultâneas no 10º ponto geram uma única recompensa" |
| 18 | Recompensa usada só uma vez | `fidelidade.test.ts` "cortesia agendada… consumida uma vez", "cortesia no balcão…", "dois registros simultâneos com a mesma cortesia: só um passa", "não vale para combo nem para outro cliente" |
| 19 | Cancelamento ou reversão não gera pontos indevidos | `fidelidade.test.ts` "falta e cancelamento não pontuam", "concluir duas vezes…; desfazer estorna…", "registro repetido do mesmo atendimento… não pontua duas vezes", "não é possível concluir um horário futuro", "cancelar devolve a cortesia; falta faz perder" |
| 20 | Fluxos no celular | Chromium 375×812: pedido público e painel sem rolagem horizontal, alvos ≥ 44 px, sem erros; nenhum cookie ou armazenamento no navegador do visitante. Capturas em `docs/auditoria/v3/` |
| 21 | Demonstração mantém avisos fictícios | `plan.test.ts`, `validate-config.test.ts`; regressão V2 no navegador; `seed.test.ts` |
| 22 | Publicação real sujeita ao checklist | `validate-config.test.ts`; [CHECKLIST-PUBLICACAO-LGPD.md](CHECKLIST-PUBLICACAO-LGPD.md), seção 7 |

## Outros testes

- `seguranca.test.ts`:
  - funções do antigo login de cliente não existem mais;
  - auditoria do cadastro sem nome nem telefone;
  - acesso à ficha e exportação auditados;
  - WhatsApp inválido recusado no banco;
  - último administrador protegido;
  - imutabilidade dos registros;
  - pedido do titular registrado e respondido.
- `fidelidade.test.ts`:
  - exclusão do cliente: cadastro, pontos e cortesias apagados, horários futuros cancelados, agenda e
    auditoria sem identificação;
  - desfazer o 10º atendimento (política atual).
- `agenda.test.ts`: pendente sem resposta expira e libera o horário; reagendar e cancelar pelo painel.
- `security-headers.test.ts`, `redirect.test.ts`, `booking.test.ts` (fuso, telefone, chave secreta recusada).

## O que depende de ambiente externo

- **Supabase real**: o projeto de homologação foi criado com a versão anterior (com login de cliente) e
  precisa ser recriado com as migrations atuais. Isso exige autorização, porque apaga os dados
  sintéticos que estão lá. Ver [HOMOLOGACAO-V3.md](HOMOLOGACAO-V3.md).
- **Netlify**: o deploy de branch existe, mas faltam as variáveis do Supabase.
- Celulares físicos (iOS Safari, Android Chrome).
