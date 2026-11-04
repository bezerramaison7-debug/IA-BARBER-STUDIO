# Fluxo de confirmação pelo WhatsApp

O WhatsApp é **apenas um atalho de conversa**. Não há API paga, robô ou envio automático, e
abrir o WhatsApp **não confirma** nada: quem confirma é a barbearia, no painel.

## Passo a passo

1. O cliente revisa e toca em **Solicitar agendamento**.
2. O banco valida a disponibilidade, grava o agendamento como **pendente** e gera um protocolo de
   6 caracteres (ex.: `K7Q2MX`, sem letras ou números confundíveis).
3. A tela mostra **"Solicitação registrada. Seu horário aguarda confirmação da barbearia."**, com
   protocolo, serviço, profissional, data e horário.
4. O botão verde **Enviar confirmação pelo WhatsApp** abre `https://wa.me/<número>?text=<mensagem>`.
   O cliente vê a mensagem pronta e decide se envia.
5. A barbearia recebe a mensagem, abre **Painel → Hoje** (lista "Aguardando confirmação") e toca em
   **Confirmar**. Só então o status vira **confirmado** e aparece assim em Minha conta.

Se a barbearia não confirmar no prazo configurado (padrão 24 h), o pedido expira e o horário é liberado.

## Mensagem enviada

Montada em `src/lib/booking/whatsapp-confirmation.ts` (com teste):

```
Olá, {nome da barbearia}! Gostaria de confirmar meu agendamento.
Protocolo: K7Q2MX
Nome: {nome do cliente}
Serviço: Degradê
Profissional: {profissional}
Data: 10/11/2026
Horário: 14:30
Aguardo a confirmação. Obrigado!
```

O horário é sempre o de Brasília (America/Sao_Paulo), mesmo que o celular do cliente esteja em outro fuso.

## Número da barbearia

- Cadastrado em **Painel → Configurações → WhatsApp oficial**, no formato `55 + DDD + número`
  (ex.: `5516991234567`). Muda na hora, sem novo deploy.
- O banco recusa números inválidos ou de exemplo (sequências, repetidos), com a mesma regra do site.
- **Vazio** (demonstração ou número ainda não confirmado): o link abre o WhatsApp **sem destinatário**,
  e a tela avisa que não há número cadastrado. Nunca se envia para um número inventado.
- Teste o número enviando uma mensagem a ele antes de salvar.

## Do painel para o cliente

Cada agendamento no painel tem o botão **WhatsApp do cliente**, que abre conversa com o telefone do
cadastro (sem texto automático). Use para avisar remarcações, cancelamentos por conflito ou atrasos.

## O que nunca acontece

- Confirmação automática por ter aberto ou enviado a mensagem.
- Envio de mensagens sem ação de uma pessoa.
- Número do cliente exposto a outros clientes (só o painel vê telefones).
