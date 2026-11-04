---
name: revisar-pr
description: Revisa um PR do Barber Studio contra a main, prioriza regressões e segurança, verifica CI e entrega parecer sem fazer merge.
argument-hint: "<numero-ou-url-do-PR> [foco opcional]"
disable-model-invocation: true
---

# Revisão técnica de Pull Request — Barber Studio / D' Mellos

**Modelo sugerido:** Claude Opus, esforço High para V3; Sonnet/Medium se for documentação ou alteração trivial.
**PR / foco recebido:** $ARGUMENTS

## Limites e ponto de partida

Não modificar código, não aprovar formalmente, não fazer merge, não publicar e não reexecutar auditoria geral sem necessidade. Confirme dono/repositório, número do PR, base/head, SHAs, descrição, diff e arquivos modificados; se não for informado PR, solicite número ou use branch atual somente se o alvo for inequívoco.

Revise primeiro **somente o diff**, depois leia contexto mínimo dos trechos tocados, `CLAUDE.md` e testes relevantes. Verifique o CI do SHA correto; não herde sucesso de commit anterior. Classifique observações como fato ou hipótese e nunca invente resultado de execução.

## Checklist de qualidade

### Preservação de V2 e arquitetura
- `main` e demo continuam preservadas; avisos de dados fictícios, `noindex`, inexistência de WhatsApp válido na demo.
- Planos Essencial/Premium continuam usando configuração e feature flags; sem forks de componentes e sem dados comerciais hardcoded.
- Respeito às regras específicas do Next.js 16 e React Compiler descritas no repositório.
- Acessibilidade, textos via `getTexts(config)`, tokens visuais e tratamento de estados vazios/erro/loading.

### V3, se tocada pelo PR
- Cadastro mínimo (nome, telefone, e-mail e senha); login e-mail/senha; administrador provisionado sem inscrição pública.
- Agenda editável pelo admin, autorização de todas as ações, intervalos, folgas, conflitos e concorrência protegidos no backend.
- Agendamento PENDENTE persistido antes do link WhatsApp; nenhuma confirmação automática pelo clique.
- Fidelidade: 10 cortes -> corte, 10 combos -> combo; conclusão elegível, imutabilidade/auditoria, resgate único; cliente sem permissão de alterar pontos.
- Nenhuma integração de pagamentos ou dados financeiros.
- Isolamento de dados entre instâncias/usuários e vazamento por IDs previsíveis.

### Segurança e operação
- RLS/grants e validação server-side; secrets não expostos; sem permissões de admin client-side.
- Migrations com rollback/migração segura, constraints, índices, backup e ambientes separados.
- Privacidade, LGPD e política de cookies alinhadas à coleta real; alterações de tratamento documentadas.
- Hospedagem e integrações compatíveis com uso comercial e com custos/limites declarados.

## Evidência e verificações

- Conferir lint, typecheck, Vitest e build no workflow `.github/workflows/ci.yml` para o SHA do PR.
- Verificar testes adicionados para comportamento novo, falhas negativas e casos de corrida.
- Para alterações em agenda/fidelidade/autorização, exigir testes adversariais concretos; não considerar apenas happy path.
- Quando não houver CI ou não for possível executar, declarar **não verificado**.

## Parecer conciso

1. **PR:** link, base/head, SHAs, status CI e escopo.
2. **Achados por gravidade:** `BLOQUEADOR`, `ALTO`, `MÉDIO`, `BAIXO`; caminho:linha, falha concreta, consequência, correção mínima e teste associado.
3. **Testes:** executados/CI/ausentes/não verificáveis.
4. **Regressões potenciais:** no máximo três, somente se fundamentadas.
5. **Decisão:** `APTO PARA REVISÃO HUMANA` ou `NÃO RECOMENDO MERGE` + condições objetivas.

Nunca afirmar que "PR aprovado" automaticamente. Não fazer merge nem deploy. Se nenhum achado, registrar explicitamente limitações da revisão.
