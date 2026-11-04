# Programa de fidelidade

Nome configurável em **Painel → Configurações → Nome do programa de fidelidade** (na demonstração:
"Barber Studio Club"; para a D' Mellos, "D' Mellos Club" depois da confirmação comercial).

## Regra inicial

| Cartão | Conta | Recompensa |
| --- | --- | --- |
| Cartão Corte | 10 cortes concluídos | 1 corte grátis |
| Cartão Cabelo + Barba | 10 combos concluídos | 1 combo grátis |

Os cartões são **separados**: um corte não avança o cartão de combo, e vice-versa. Cada cartão é uma
linha de `loyalty_rules` com:

- `eligible_service_ids`: lista de serviços que pontuam. Pode misturar serviços, o que permite campanhas
  futuras como "qualquer corte ou barba conta";
- `threshold`: quantos atendimentos para ganhar (10);
- `reward_service_id`: o serviço dado como cortesia.

Em **Painel → Configurações → Cartões de fidelidade** o administrador muda, sem código, o nome do
cartão, o número de atendimentos, a cortesia, os serviços que contam pontos e se o cartão está ativo.
Criar um cartão novo (campanha) é feito inserindo uma linha em `loyalty_rules` pelo Table Editor do
Supabase. Mudanças de regra devem ser anunciadas aos clientes antes. Pontos já lançados não mudam.

## Regras garantidas pelo banco

- **Só atendimento concluído conta**, e a conclusão é marcada pelo administrador. Não é possível concluir
  um horário futuro.
- Cancelamento, falta e expiração **não contam**.
- **Cortesia não gera ponto** (atendimento com `is_reward`).
- **Um agendamento conta uma única vez**: concluir duas vezes não soma em dobro.
- **Desfazer uma conclusão estorna o ponto** com um lançamento negativo (motivo obrigatório). Refazer
  conta de novo, uma vez.
- O cliente **não pode editar** o progresso: não há permissão de escrita nas tabelas de fidelidade, e as
  funções de ajuste exigem administrador.
- **Livro-razão imutável**: cada ponto é uma linha em `loyalty_entries` (quem, quando, por quê). Nem o
  superusuário altera ou apaga um lançamento: correções são novos lançamentos.
- Conclusões simultâneas no 10º ponto geram **uma única** recompensa (trava por cliente e cartão).

### Desfazer o atendimento que completou o cartão (decisão comercial pendente)

Cenário: o 10º atendimento é concluído, a cortesia é gerada e depois o administrador desfaz essa
conclusão (por exemplo, lançou no cliente errado).

**Comportamento atual** (coberto por teste em `fidelidade.test.ts`):

- o ponto é estornado e o cartão fica com saldo **−1**;
- a cortesia **continua valendo** (disponível, reservada ou já resgatada);
- o próximo atendimento só zera a dívida: a próxima cortesia exige **11** atendimentos, e a tela
  mostra "Faltam 11";
- concluir de novo o mesmo atendimento repõe o ponto, sem gerar uma segunda cortesia.

O saldo nunca fica a favor do cliente, mas a cortesia gerada por engano não é retirada. Alternativas
para a barbearia decidir:

| Opção | Efeito | Observação |
| --- | --- | --- |
| A. Manter (atual) | Cortesia válida e saldo −1 compensado nos próximos atendimentos | Nenhuma mudança. O cliente não perde o benefício que já viu |
| B. Retirar se ainda estiver disponível | Ao desfazer, a cortesia disponível é cancelada e os 10 pontos voltam (saldo 9) | Se já estiver reservada ou resgatada, cai na opção A. Exige mudança no gatilho e teste |
| C. Ajuste manual caso a caso | Mantém A e o administrador usa **Cancelar cortesia** quando achar justo | Já é possível hoje, com motivo registrado |

**Decisão necessária:** qual opção vale para a D' Mellos. Até lá, a opção A segue ativa e a C fica
disponível.

## Recompensas

```
disponível ──(cliente agenda a cortesia)──▶ reservada ──(barbearia conclui)──▶ resgatada
   ▲                                          │
   └──── cancelamento ou expiração ───────────┤
                                              └── falta ──▶ perdida (se "Falta faz perder" estiver ligado;
                                                             desligado, volta a disponível)
disponível ──(administrador cancela, com motivo)──▶ cancelada (os pontos voltam ao cartão)
```

- A recompensa só vale para o serviço do cartão (cortesia de corte não vale para combo).
- Duas reservas simultâneas com a mesma cortesia: só uma passa.
- Uma cortesia nunca é resgatada duas vezes.

## Como o administrador valida atendimentos

1. Depois do atendimento, em **Painel → Hoje** ou **Agenda**, toque em **Concluir** no agendamento
   confirmado. O ponto entra no cartão automaticamente.
2. Se o cliente faltou, toque em **Não compareceu**. Não há ponto, e uma cortesia reservada segue a regra
   de falta.
3. Errou? Toque em **Desfazer (corrigir)** e informe o motivo. O status volta a confirmado e o ponto é
   estornado.

## Como o cliente resgata

1. Em **Minha conta**, o cartão mostra o progresso ("7/10 · Faltam 3 cortes para seu próximo corte
   gratuito") e as cortesias disponíveis.
2. **Agendar cortesia** abre o agendamento com o serviço já escolhido e marcado como cortesia.
3. A revisão e a mensagem de WhatsApp indicam "Cortesia". A barbearia confirma como de costume.
4. Ao concluir o atendimento, a cortesia vira **resgatada**.

## Ajustes manuais

Em **Painel → Clientes → ficha do cliente → Fidelidade**:

- **Ajustar pontos**: de −20 a +20 por vez, com motivo obrigatório (ex.: atendimento antigo lançado no
  caderno). Fica no livro-razão e no registro de atividades.
- **Cancelar cortesia**: só para cortesia disponível, com motivo. Os pontos voltam ao cartão.

Não há registro de pagamento: o critério é o atendimento concluído e validado pela barbearia.
