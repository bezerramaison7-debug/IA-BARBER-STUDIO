# Regras da agenda

Todas as regras abaixo são aplicadas **no banco** (funções em
`supabase/migrations/20261104000200_v3_funcoes.sql`). A tela só mostra o resultado: não dá para
contorná-las chamando a API diretamente.

## Configurações (Painel → Configurações)

| Configuração | Padrão | Efeito |
| --- | --- | --- |
| Antecedência mínima | 120 min | Horários mais próximos que isso não aparecem nem podem ser pedidos |
| Dias à frente | 30 | Até quando a agenda fica aberta |
| Intervalo entre horários | 15 min | Grade de inícios possíveis (09:00, 09:15...) |
| Pendentes expiram em | 24 h | Pedido não confirmado nesse prazo vira **expirado** e libera o horário |
| Horários em aberto por cliente | 3 | Máximo de pendentes + confirmados futuros por conta |
| Pedidos por hora | 6 | Limite anti-abuso por conta |
| Cliente cancela até | 60 min antes | Depois disso, só a barbearia cancela |
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
pendente ───┼──────────── cancelado (cliente ou barbearia; horário liberado)
            └─ confirmado ─┬─ concluído (só depois do horário; gera ponto)
                           ├─ não compareceu (só depois do horário)
                           └─ cancelado
concluído / não compareceu ── "Desfazer (corrigir)" ──▶ confirmado (exige motivo; estorna pontos)
```

- Só o **administrador** muda status, exceto o cancelamento pelo próprio cliente dentro do prazo.
- Não é possível concluir um horário que ainda não aconteceu.
- Toda mudança vai para `appointment_status_history` (quem, quando, de → para, motivo).

## Solicitação pelo cliente (`request_appointment`)

Recusada, com mensagem clara, quando:

- a conta não confirmou o e-mail;
- o horário não está mais livre (`ocupado`). A tela volta para a escolha de horário;
- passou o limite de horários em aberto ou de pedidos por hora;
- o horário está no passado, sem antecedência, fora do expediente, no intervalo ou numa exceção;
- a cortesia escolhida não é do cliente, já foi usada ou não vale para esse serviço.

Clique repetido ou reenvio com a mesma chave devolve o mesmo pedido (não duplica), inclusive quando as
duas requisições chegam ao mesmo tempo: a segunda espera a primeira e recebe o mesmo protocolo.

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
profissional** antes de ler a agenda: solicitação, reagendamento (cliente ou painel), agendamento
manual, expediente e exceções. Expediente ou feriado para todos travam **todos** os profissionais,
sempre na mesma ordem (por id), o que evita deadlock. Na prática:

- se a barbearia está salvando um novo expediente ou bloqueio, a solicitação que chega no mesmo
  instante espera e é validada já com a regra nova;
- se uma solicitação acabou de ser gravada, a mudança da barbearia espera e mostra esse agendamento
  na lista de conflitos.

A decisão sobre manter ou cancelar continua sendo do administrador.

O agendamento manual pelo painel e o reagendamento seguem as mesmas regras. Lançar um atendimento
passado (registro retroativo) é permitido apenas ao administrador.
