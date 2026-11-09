---
name: auditoria-arquitetura
description: Audita arquitetura e impactos da V3 no Barber Studio antes de mudanças estruturais; identifica riscos e propõe decisões sem alterar código.
argument-hint: "[escopo opcional: módulo, branch, PR ou requisito]"
disable-model-invocation: true
---

# Auditoria de arquitetura — Barber Studio / D' Mellos

**Modelo sugerido:** Claude Opus, esforço High. Se o escopo for local e simples, Sonnet/Medium.
**Escopo recebido:** $ARGUMENTS

## Contrato

Faça uma auditoria **somente leitura**, baseada no estado real do repositório, sem assumir que a V3 está implementada. Não crie branch, altere arquivos, migre banco, abra PR, faça merge ou deploy. Execute apenas verificações necessárias ao escopo; não releia o repositório inteiro se já houver evidência recente confiável.

## Inspeção mínima direcionada

1. Confirme repositório, branch, SHA, árvore de trabalho, PRs relevantes e diferença em relação à `main`; nunca confunda a branch padrão do GitHub com `main` sem verificar.
2. Leia `CLAUDE.md`, `AGENTS.md` e somente os arquivos envolvidos. Se relevante, consulte `docs/PLANOS.md`, `docs/PERSONALIZACAO.md`, `docs/CHECKLIST-PUBLICACAO-LGPD.md` e `docs/AUDITORIA-V2.md`.
3. Identifique o fluxo real de config: `src/config/site.config.ts`, `types.ts`, `texts.ts`, `src/lib/plan.ts`, `validate-config.ts`; confirme quais caminhos existem antes de citá-los.
4. Verifique restrições da versão instalada do Next.js em `node_modules/next/dist/docs/` quando APIs estiverem envolvidas; não assumir padrões de versões anteriores.
5. Distinga observado / inferido / não verificado, referenciando arquivos, linhas, testes, commits ou evidência de CI.

## Invariantes arquiteturais

- Preservar V2, demo com dados fictícios, avisos e `noindex`; nenhum WhatsApp real em demo.
- Não duplicar o site para os planos Essencial e Premium; funcionalidades condicionadas por `getFeatures(config)`.
- Manter dados estáticos do cliente no config, com regras de texto e validação existentes; dados operacionais mutáveis (agenda, clientes e fidelidade) exigem fonte persistente com autorização no servidor.
- Não expor segredos nem dados pessoais em client bundles, testes, logs, screenshots ou PR.
- Nenhum pagamento online, transação financeira, checkout, Pix integrado ou caixa.
- Fluxo agendamento -> persistência pendente -> WhatsApp preparado -> confirmação administrativa; abrir link não confirma envio ou horário.
- Disponibilidade e bloqueios editáveis pelo administrador, validação atômica contra dupla reserva, timezone `America/Sao_Paulo`.
- Fidelidade com duas categorias iniciais separadas: 10 cortes elegíveis -> 1 corte; 10 combos cabelo+barba -> 1 combo. Conclusão validada, histórico auditável, resgate único.
- Autenticação por e-mail/senha; cadastro limitado a nome, telefone, e-mail e senha; provisionamento de administrador fechado.
- Hospedagem sem custo inicial só se permitida comercialmente e viável dentro dos limites; não presumir Vercel Hobby comercial.

## Decisões a avaliar conforme o escopo

- Fronteiras cliente/servidor; APIs ou server actions; isolamento de dados entre barbearias.
- Persistência, constraints, índices, migrations, reversibilidade e estratégia de backup.
- Auth, RLS/autorização, separação demo/produção, proteção de formulários.
- Custos, pausas do plano gratuito, serviço de e-mails, variáveis de ambiente e CI.
- Regressões visuais, acessibilidade, performance e compatibilidade de planos.

## Saída obrigatória — curta

1. **Estado comprovado:** branch, SHA, módulos/artefatos relevantes.
2. **Achados:** `BLOQUEADOR / ALTO / MÉDIO / BAIXO`, evidência, impacto e correção sugerida. Se não houver, declarar.
3. **Decisões recomendadas:** opção preferida, alternativas e trade-offs.
4. **Plano incremental:** no máximo cinco passos, com testes/critério de aceite por etapa.
5. **Dúvidas bloqueantes:** somente as que realmente exigem proprietário/credenciais.

Não alterar o repositório nesta skill. Não declarar testes executados sem saída verificável.
