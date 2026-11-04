---
name: testar-agendamento
description: Valida agenda, fluxo WhatsApp e fidelidade V3 com testes unitários, concorrência e E2E, sem usar dados reais ou alterar produção.
argument-hint: "[escopo: agenda, whatsapp, fidelidade, regressao ou PR]"
disable-model-invocation: true
---

# Testar agendamento e fidelidade — Barber Studio / D' Mellos

**Modelo sugerido:** Claude Sonnet, esforço Medium; Opus/High apenas para falhas concorrentes ou regras de negócio ambíguas.
**Escopo:** $ARGUMENTS

## Preparação

1. Confirme branch, SHA, estado do working tree e módulos existentes; não presuma implementação da V3.
2. Leia `CLAUDE.md` e os testes relacionados. O projeto usa `npm test` (Vitest/happy-dom), `npm run lint`, `npm run typecheck` e `npm run build`.
3. Reaproveite utilitários, fixtures e Playwright CLI se estiverem instalados; não instale dependências nem crie infraestrutura sem justificativa.
4. Teste exclusivamente com usuários e telefones fictícios em ambiente isolado. Não acessar produção com escrita; preservar a demo e a `main`.
5. Se falta banco de desenvolvimento ou credencial, execute apenas testes independentes e reporte os bloqueados. Nunca diga "passou" sem executar.

## Matriz essencial

### Disponibilidade
- Sem expediente, intervalo, feriado, férias, bloqueio e horário passado -> não reservar.
- Duração de serviços diferentes e trocas de dia -> sem sobreposição.
- Agenda individual por profissional; horários editados no painel refletem na interface pública.
- Alterar expediente com compromissos existentes -> sinalizar conflitos, sem cancelar automaticamente.
- Cálculo de instantes em `America/Sao_Paulo`, persistência UTC e comportamento na virada de data.
- Duas requisições simultâneas para o mesmo slot -> exatamente uma aceita; outras recebem erro controlado.
- Duplo clique/retry -> não duplicar agendamento (idempotência).

### Reserva e WhatsApp
- Visitante explora serviço antes de autenticar.
- Cliente cadastra/entra com e-mail e senha e só acessa sua reserva.
- Criação retorna protocolo e status PENDENTE; horário reservado não reaparece conforme a política.
- Link `wa.me` apenas com telefone configurado válido e texto URL-encoded.
- Abrir WhatsApp **não** muda status para CONFIRMADO; só admin autoriza.
- Cancelar, remarcar, expirar reserva e registrar alteração sem inconsistência.
- Demo não expõe número verdadeiro nem indexa conteúdo fictício.

### Fidelidade
- Categorias separadas: corte e combo cabelo+barba; 10 conclusões elegíveis geram benefício correspondente.
- Serviço cancelado, falta ou cortesia não pontua.
- Concluir mesmo agendamento duas vezes não concede pontos extras.
- Reversão administrativa auditada; resgate não pode ocorrer duas vezes, inclusive concorrente.
- Cliente pode ler progresso próprio, mas não alterar lançamentos/pontos.
- Recompensa gratuita não abre checkout nem fluxo financeiro.

### Regressão V2
- Planos Essencial e Premium; config, WhatsApp demo, `noindex`, páginas de serviços e mobile.
- Regras visuais, acessibilidade de foco/labels e responsividade em fluxos prioritários.

## Execução incremental

Selecione testes relacionados ao escopo antes da suíte completa. Quando houver mudança de código, rode no final:
`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
Use E2E/Playwright apenas para fluxos que dependam de navegador; não gere screenshots extensos sem motivo.

Se solicitado escrever testes: faça em branch de feature, com alterações mínimas, fixtures sintéticas e commits isolados; nunca no `main` nem com deploy automático.

## Relatório objetivo

| Cenário | Status (passou/falhou/bloqueado/não executado) | Evidência | Próxima ação |
|---|---|---|---|

Inclua comandos executados, totais de testes, SHA e diferenças de ambiente. Falha crítica de duplicidade, autorização ou pontos exige bloqueio de merge. Não confundir verificação estática com teste executado.
