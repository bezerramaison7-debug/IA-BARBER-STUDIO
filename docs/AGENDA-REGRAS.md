# Regras da agenda

Todas as regras abaixo são aplicadas **no banco** (funções em
`supabase/migrations/20261104000200_v3_funcoes.sql`). A tela só mostra o resultado: não dá para
contorná-las chamando a API diretamente.

## Configurações (Painel → Configurações)

| Configuração | Padrão | Efeito |
| --- | --- | --- |
| Antecedência mínima | 120 min | Horários mais próximos que isso não aparecem na consulta pública (o painel pode registrar) |
| Dias à frente | 30 | Até quando a agenda fica aberta |
| Intervalo entre horários | 15 min | Grade de inícios possíveis (09:00, 09:15...) |
| "Aguardando resposta" expira em | 24 h | Registro marcado como aguardando o cliente que não for confirmado nesse prazo vira **expirado** e libera o horário |
| Falta faz perder a cortesia | sim | Ver [PROGRAMA-FIDELIDADE.md](PROGRAMA-FIDELIDADE.md) |

## Quando um horário está livre

Um início `H` está disponível para o serviço `S` (duração `D`) com o profissional `P` quando **todas**
as condições valem:

1. `P` está ativo e faz o serviço `S`.
2. O dia da semana tem expediente para `P`, e `[H, H + D)` cabe inteiro dentro dele.
3. `[H, H + D)` não cruza o intervalo (almoço) do dia.
4. Nenhuma exceção cobre o período: folga, feriado, férias ou bloqueio daquele profissional **ou de
   todos** (exceção sem profissional vale para a barbearia inteira).
5. Não há agendamento pendente, confirmado ou concluído de `P` que se sobreponha.
6. `H` respeita a antecedência mínima e o limite de dias à frente.

"Sem preferência de profissional": o banco testa os profissionais aptos e escolhe um livre.

Duração: usa a duração do serviço no momento do pedido (guardada no agendamento). Mudar a duração
depois não altera horários já marcados.

## Ciclo de vida de um agendamento

```
            ┌──────────── expirado (prazo sem confirmação; horário liberado)
pendente ───┼──────────── cancelado (horário liberado)
            └─ confirmado ─┬─ concluído (só depois do horário; gera ponto)
                           ├─ não compareceu (só depois do horário)
                           └─ cancelado
concluído / não compareceu ── "Desfazer (corrigir)" ──▶ confirmado (exige motivo; estorna pontos)
```

- Só o **administrador** registra e muda status. O cliente não tem conta: pede, desmarca e remarca
  pelo WhatsApp.
- "Pendente" significa registrado pela barbearia e **aguardando a resposta do cliente**. O normal é
  registrar já como **confirmado**, depois de combinar.
- Não é possível concluir um horário que ainda não aconteceu.
- Toda mudança vai para `appointment_status_history` (quem, quando, de → para, motivo).

## Consulta pública e registro pelo painel

- **Público**: `available_slots`/`available_days` só **leem**. O visitante escolhe um horário livre e
  manda o pedido pelo WhatsApp. **Nada é gravado nem reservado** (ver [FLUXO-WHATSAPP.md](FLUXO-WHATSAPP.md)).
- **Painel** (`admin_create_appointment`): recusa com mensagem clara quando:
  - o horário já tem outro agendamento do profissional (`ocupado`);
  - o horário está no passado, fora do expediente, no intervalo ou numa exceção;
  - a cortesia não é do cliente, já foi usada ou não vale para o serviço.
- **Atendimento no balcão** ("Registrar atendimento"): registro já concluído, que pode ser fora do
  expediente. Só a sobreposição com outro agendamento continua proibida.
- Toque duplo (mesma chave) devolve o mesmo agendamento, inclusive de dois aparelhos ao mesmo tempo.

## Mudanças da barbearia e conflitos

Alterar expediente ou criar folga, feriado, férias ou bloqueio pode deixar agendamentos fora do novo
horário. O sistema **nunca cancela em silêncio**:

1. Ao salvar, o banco primeiro verifica (`verificar`). Se houver conflitos, **nada é gravado** e a tela
   lista os agendamentos afetados.
2. O administrador escolhe:
   - **Salvar e manter os agendamentos**: a mudança vale para o futuro, e os horários já marcados
     continuam (combine com o cliente);
   - **Salvar e cancelar estes agendamentos**: grava e cancela os listados, com motivo registrado.
     Avise cada cliente pelo botão de WhatsApp;
   - **Cancelar**: desiste da mudança.

### Operações simultâneas

Toda operação que reserva horário ou muda a agenda de um profissional pega a **mesma trava por
profissional** antes de ler a agenda: registro de agendamento ou atendimento, reagendamento,
expediente e exceções. Expediente ou feriado para todos travam **todos** os profissionais,
sempre na mesma ordem (por id), o que evita deadlock. Na prática:

- se um aparelho está salvando um novo expediente ou bloqueio, o registro feito no mesmo instante em
  outro aparelho espera e é validado já com a regra nova;
- se um agendamento acabou de ser gravado, a mudança de expediente espera e mostra esse agendamento
  na lista de conflitos.

A decisão sobre manter ou cancelar continua sendo do administrador.

O agendamento manual pelo painel e o reagendamento seguem as mesmas regras. Lançar um atendimento
passado (registro retroativo) é permitido apenas ao administrador.
