# Manual do administrador

O painel fica em **/admin** (entre em **/entrar** com seu e-mail e senha). Foi feito para o celular.
Tudo o que se muda aqui vale **na hora** no site, **sem editar código e sem novo deploy**.

Menu: **Hoje · Agenda · Horários · Clientes · Configurações · Privacidade** e, no fim da página, **Sair**.

## Rotina do dia

| Situação | Onde | O que fazer |
| --- | --- | --- |
| Chegou pedido pelo WhatsApp | Agenda → **Registrar agendamento** | Combine com o cliente, busque-o pelo telefone (ou cadastre) e registre como **Confirmado** |
| Cliente atendido agora (com ou sem horário marcado) | Hoje → **Registrar atendimento** | Escolha o cliente, o serviço e o profissional e toque em **Registrar atendimento concluído**. O ponto entra no cartão |
| Cliente com horário marcado foi atendido | Hoje → no agendamento, **Concluir atendimento** | O ponto entra no cartão |
| Cliente faltou | **Não compareceu** | Não conta ponto. Uma cortesia reservada segue a regra de falta |
| Cliente desmarcou | **Cancelar** | O horário volta a ficar livre no site |
| Errou um registro | **Desfazer (corrigir)**, com motivo | O status volta, e o ponto é estornado se for o caso |

**Concluir** só aparece depois do horário.

## Clientes

- **Cadastrar novo cliente**: nome e telefone (observação opcional).
- **Telefone repetido**: o painel avisa e mostra quem já usa o número. Pode ser a mesma pessoa, alguém da
  família ou um número que mudou de dono. Toque em **É este cliente** para usar o cadastro existente, ou em
  **É outra pessoa** para criar outro. Os históricos nunca são juntados sozinhos.
- **Ficha** (toque no nome):
  - os dois cartões de fidelidade, com barra de progresso e quanto falta;
  - as cortesias, os lançamentos e o histórico de atendimentos;
  - outros clientes com o mesmo telefone;
  - **Corrigir dados**.
- **Ajustar pontos** (−20 a +20, motivo obrigatório): por exemplo, para migrar um cartão de papel.
- **Cancelar cortesia** (motivo obrigatório): os pontos voltam ao cartão.
- Cada abertura de ficha fica registrada.

## Cortesias

Quando um cartão completa 10, a cortesia aparece na ficha. Para usá-la, marque **Usar cortesia do
cliente** ao registrar o agendamento ou o atendimento do serviço do cartão (corte ou combo). Uma cortesia
é usada uma única vez. Ver [PROGRAMA-FIDELIDADE.md](PROGRAMA-FIDELIDADE.md).

## Horários: mudar dias e horários sem código

### Expediente da semana

1. Abra **Horários**.
2. Escolha o **profissional** ou marque **Aplicar a todos os profissionais**.
3. Para cada dia, marque **Aberto** ou deixe **Fechado**. Preencha **Abre** e **Fecha** e, se houver
   almoço, o **Intervalo**.
4. Toque em **Salvar horários**.

Exemplos:
- Domingo das 8h às 12h: domingo → Aberto, 08:00–12:00.
- Fechar às segundas para todos: Aplicar a todos → segunda → Fechado.

### Folgas, feriados, férias e bloqueios

Em **Horários → Folgas, feriados e bloqueios**:
1. Escolha o profissional ou **Todos**.
2. Escolha o tipo.
3. Preencha **Início** e **Fim**. Desmarque **Dia inteiro** para bloquear só algumas horas.
4. Escreva o motivo e toque em **Adicionar**.

Para reabrir, toque em **Remover**.

### Quando há agendamentos no caminho

Nada é salvo de imediato. Aparece a lista **"Há agendamentos que deixam de caber"**, e você escolhe:
- **Salvar e manter**;
- **Salvar e cancelar estes** (avise cada cliente pelo botão de WhatsApp);
- **Cancelar**.

Nada é cancelado sem essa escolha.

## Configurações

- **Nome da barbearia** e **WhatsApp oficial** (`55 + DDD + número`; teste com uma mensagem antes).
- Regras da agenda: antecedência mínima, dias à frente, intervalo da grade, prazo de "aguardando
  resposta", regra de falta com cortesia. Ver [AGENDA-REGRAS.md](AGENDA-REGRAS.md).
- **Profissionais**, **Serviços** (duração define o tamanho do horário) e **Cartões de fidelidade**.
- **Acesso ao painel**: libere ou retire o acesso de contas da equipe. A conta é criada antes pelo
  responsável técnico (veja abaixo). O sistema não deixa retirar o último administrador.
- **Alterar minha senha**.

## Privacidade (pedidos dos clientes)

Quando um cliente pedir acesso, correção ou exclusão dos dados (pelo WhatsApp, e-mail ou no balcão):
1. **Privacidade → Registrar pedido**: tipo, nome de quem pediu, contato e cliente relacionado.
2. Confirme que é a própria pessoa antes de entregar dados (por exemplo, responda no mesmo WhatsApp do
   cadastro).
3. Atenda:
   - **Cópia dos dados**: na ficha, toque em **Exportar dados** e envie o arquivo à pessoa.
   - **Correção**: na ficha, toque em **Corrigir dados**.
   - **Exclusão**: na ficha, toque em **Excluir cliente**. Apaga nome, telefone, observações, pontos e
     cortesias e cancela horários futuros. Ficam, sem identificação, os registros de agendamento e de
     atividades.
4. Registre a resposta e marque **Concluída**. A LGPD pede resposta em até 15 dias.

## Contas da equipe e recuperação de acesso (sem e-mail)

Não há cadastro público nem recuperação de senha por e-mail. Quem tem acesso ao projeto no Supabase (o
responsável técnico) cuida das contas:

- **Nova pessoa na equipe**: no Supabase, **Authentication → Users → Add user**, com e-mail, senha
  provisória e **Auto Confirm User**. Depois, um administrador libera em **Configurações → Acesso ao
  painel**, e a pessoa troca a senha em **Alterar minha senha**.
- **Esqueceu a senha (outro administrador consegue entrar)**: o responsável técnico cria uma conta nova
  (Add user). O outro administrador libera o acesso, e a conta antiga é apagada no Supabase.
- **Nenhum administrador consegue entrar**: o responsável técnico apaga, no Supabase, as contas que
  perderam o acesso, cria a nova conta e roda no SQL Editor
  `select public.bootstrap_first_admin('email-da-nova-conta');`.

Mantenha **duas contas de administrador** (por exemplo, o dono e quem mantém o site), cada uma com senha
própria e forte. Não compartilhe a conta.
