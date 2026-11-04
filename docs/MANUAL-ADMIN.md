# Manual do administrador

O painel fica em **/admin** (entre com a sua conta). Funciona no celular. Tudo o que se muda aqui vale
**na hora** no agendamento do site, **sem editar código e sem novo deploy**.

Menu do painel: **Hoje · Agenda · Horários · Clientes · Configurações · Privacidade**.

## Primeiro acesso

1. Crie a sua conta normalmente em **/cadastro** e confirme o e-mail.
2. Quem mantém o site roda uma única vez, no SQL Editor do Supabase:
   `select public.bootstrap_first_admin('seu-email@exemplo.com');`
3. Entre de novo: o link **Painel** aparece. Outros administradores são promovidos em
   **Clientes → ficha → Dar acesso ao painel**. O sistema não deixa remover o último administrador.

## Hoje

- Números do dia: agendamentos, pendentes, confirmados, concluídos, cancelados/faltas, clientes e
  cortesias disponíveis.
- **Aguardando confirmação**: pedidos pendentes. Toque em **Confirmar** (ou **Cancelar**, com motivo
  opcional). Confirmar é o que garante o horário ao cliente. Abrir o WhatsApp não confirma nada.
- **Agenda de hoje**, com os botões de cada atendimento:

| Status | Botões |
| --- | --- |
| Pendente | Confirmar · Cancelar · Reagendar |
| Confirmado | Concluir · Não compareceu · Cancelar · Reagendar |
| Concluído / Não compareceu | Desfazer (corrigir), com motivo obrigatório |

Todos têm **WhatsApp do cliente**, para falar com a pessoa.

**Concluir** só aparece depois do horário. É ele que lança o ponto de fidelidade.

## Agenda

Visão por **dia** ou **semana**, com **Anterior / Hoje / Próximo**.

**Novo agendamento manual** (cliente que ligou ou chegou no balcão): escolha serviço, profissional,
data e horário e um **cliente cadastrado** ou apenas o **nome** (e telefone opcional) de quem não tem
conta. O banco aplica as mesmas regras de disponibilidade do site.

**Reagendar**: informe a nova data e hora (`AAAA-MM-DD HH:MM`). Se o novo horário estiver ocupado ou
fora do expediente, o sistema avisa e nada muda.

## Horários: como mudar dias e horários sem código

### Expediente da semana

1. Abra **Horários**.
2. Escolha o **profissional** ou marque **Aplicar a todos os profissionais**.
3. Para cada dia da semana:
   - marque **Aberto** ou deixe **Fechado**;
   - preencha **Abre** e **Fecha** (ex.: 09:00 e 18:00);
   - se houver almoço, preencha **Intervalo → Início** e **Fim** (ex.: 12:00 e 13:00).
4. Toque em **Salvar horários**.

Exemplos:

- *Abrir aos domingos das 8h às 12h*: domingo → Aberto, 08:00–12:00, sem intervalo → Salvar.
- *Sexta até as 20h só para o Lucas*: escolha Lucas → sexta → Fecha 20:00 → Salvar.
- *Fechar às segundas para todos*: marque Aplicar a todos → segunda → Fechado → Salvar.

### Folgas, feriados, férias e bloqueios

Em **Horários → Folgas, feriados e bloqueios**:

1. **Profissional**: um específico ou **Todos os profissionais** (para feriado ou a barbearia fechada).
2. **Tipo**: Folga, Feriado, Férias ou Bloqueio (curso, compromisso, manutenção).
3. **Início** e **Fim** (datas). Desmarque **Dia inteiro** para bloquear só algumas horas.
4. **Motivo** (aparece só no painel) → **Adicionar**.

Para reabrir, toque em **Remover** na exceção da lista.

### Quando há agendamentos no caminho

Se a mudança deixar horários já marcados fora do expediente, **nada é salvo de imediato**. Aparece a
lista **"Há agendamentos que deixam de caber"**, e você escolhe:

- **Salvar e manter os agendamentos**: a mudança vale, e quem já marcou continua marcado;
- **Salvar e cancelar estes agendamentos**: grava e cancela os listados. Avise cada cliente pelo
  WhatsApp;
- **Cancelar**: desiste da mudança.

Nada é cancelado sem essa escolha.

## Clientes

Busque por nome, telefone ou e-mail. A ficha mostra dados de contato, agendamentos, cartões de
fidelidade com lançamentos e cortesias. **Cada abertura de ficha fica registrada** (LGPD).

- **Ajustar pontos** (−20 a +20, motivo obrigatório): por exemplo, para migrar um cartão de papel.
- **Cancelar cortesia** (motivo obrigatório): os pontos voltam ao cartão.
- **Dar/Remover acesso ao painel**.
- **Excluir dados (a pedido do titular)**: ver "Privacidade" abaixo.

Detalhes da fidelidade em [PROGRAMA-FIDELIDADE.md](PROGRAMA-FIDELIDADE.md).

## Configurações

- **Nome da barbearia** (usado na mensagem de WhatsApp) e **WhatsApp oficial** (`55 + DDD + número`;
  envie uma mensagem de teste ao número antes de salvar).
- Regras da agenda: antecedência mínima, dias à frente, intervalo entre horários, prazo para pendentes
  expirarem, horários em aberto por cliente, prazo de cancelamento pelo cliente, se falta faz perder a
  cortesia. O significado de cada uma está em [AGENDA-REGRAS.md](AGENDA-REGRAS.md).
- **Nome do programa de fidelidade** e **Cartões de fidelidade**.
- **Profissionais**: adicionar, renomear, ativar/desativar e escolher os serviços que cada um faz.
- **Serviços**: nome, duração e ativo. A duração define o tamanho do horário reservado.

Toda alteração de configuração fica no registro de atividades.

## Privacidade

- **Pedidos de privacidade** feitos pelos clientes em Minha conta (acesso, correção, exclusão,
  revogação de consentimento). Registre a resposta e o status (Aberta, Em andamento, Concluída,
  Recusada). A LGPD pede resposta em até 15 dias.
- **Registro de atividades**: quem fez o quê e quando (somente leitura).

**Pedido de exclusão**:

1. Abra a ficha do cliente → **Excluir dados (a pedido do titular)** → confirme e informe o motivo
   (sem repetir nome ou telefone no motivo). Nome, telefone e e-mail saem do cadastro da barbearia,
   horários futuros e cortesias são cancelados e a conta não consegue mais agendar.
   **Isto ainda não é a exclusão completa:** o login (e-mail, senha e os dados do cadastro) continua no
   Supabase.
2. Quem mantém o site apaga o login em **Supabase → Authentication → Users → Delete user**. Isso apaga o
   acesso e o histórico de fidelidade, e a agenda fica sem identificação.
3. Só então marque o pedido como **Concluída** e avise o titular. O que continua guardado (registros
   sem identificação e backups até expirarem) está em
   [SEGURANCA-LGPD.md](SEGURANCA-LGPD.md#exclusão-o-que-cada-etapa-faz).

## Boas práticas

- Confirme os pendentes ao longo do dia: o cliente só tem garantia depois disso.
- Marque **Concluir** ou **Não compareceu** logo após o atendimento.
- Não compartilhe a conta de administrador: cada pessoa da equipe com acesso deve ter a sua.
- Saia da conta em computadores compartilhados.
