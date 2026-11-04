# Fluxo do pedido pelo WhatsApp

O WhatsApp é o canal do pedido. Não há API paga, robô ou envio automático. **Enviar a mensagem não
reserva o horário**: quem confirma é a barbearia, e só então ela registra no painel.

## Visitante (sem conta)

1. Em **/agendar**: serviço → profissional (ou "sem preferência") → data → horário. Só aparecem
   horários livres no momento da consulta.
2. **Seus dados**: nome, telefone e observação opcional. Esses dados ficam só na memória da página:
   não vão para o banco, não aparecem na URL e não ficam no navegador.
3. **Preparar mensagem no WhatsApp**: a tela mostra "**Seu horário ainda não está reservado.**" e o
   botão verde **Abrir o WhatsApp com a mensagem** (`https://wa.me/<número>?text=<mensagem>`).
4. O visitante revisa e envia no WhatsApp.

Nenhuma tela diz "agendado", "reservado" ou "confirmado" nesse fluxo.

## Mensagem

Montada em `src/lib/booking/whatsapp-confirmation.ts` (com teste):

```
Olá, {nome da barbearia}! Gostaria de solicitar um horário.
Serviço: Degradê
Profissional: Lucas            (ou "sem preferência")
Data: 10/11/2026
Horário: 14:30
Nome: {nome}
Telefone: (16) 99123-4567
Observação: {se houver}
Sei que o horário só fica reservado depois da confirmação de vocês.
```

O horário é sempre o de Brasília (America/Sao_Paulo).

## Barbearia

1. Recebe a mensagem no WhatsApp e responde.
2. Combinado o horário, abre **Painel → Agenda → Registrar agendamento**:
   - busca o cliente pelo telefone ou cadastra (nome e telefone);
   - escolhe serviço, profissional, data e horário;
   - escolhe a situação: **Confirmado com o cliente** ou **Aguardando resposta do cliente**.
3. Se o horário já tiver sido ocupado, o painel recusa (a restrição de sobreposição vale sempre), e a
   barbearia combina outro.

## Número da barbearia

- Em **Painel → Configurações → WhatsApp oficial** (`55 + DDD + número`). Muda na hora, sem deploy.
- O banco recusa números inválidos ou de exemplo.
- **Vazio** (demonstração): o link abre sem destinatário, e a tela avisa.

## Do painel para o cliente

Cada agendamento tem o botão **WhatsApp do cliente**, que abre conversa com o telefone cadastrado
(sem texto automático).

## Privacidade

O visitante decide o que envia. O conteúdo da mensagem passa pelo WhatsApp (Meta), que é um
controlador independente. A política em `/privacidade` explica isso.
