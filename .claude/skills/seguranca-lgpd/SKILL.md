---
name: seguranca-lgpd
description: Revisa autenticação, permissões, dados pessoais, cookies e conformidade LGPD do Barber Studio; entrega riscos verificáveis e testes de autorização.
argument-hint: "[escopo: PR, rota, tabela, fluxo ou 'completo']"
disable-model-invocation: true
---

# Auditoria de segurança e LGPD — Barber Studio / D' Mellos

**Modelo sugerido:** Claude Opus, esforço Extra High para risco crítico; High para revisão padrão.
**Escopo:** $ARGUMENTS

## Modo de trabalho

Audite o código e a configuração **realmente presentes**, com diffs e referências precisas. Esta skill é **somente leitura**, salvo pedido explícito de implementação em outra tarefa. Não acesse produção com escrita, não crie usuários reais, não imprima secrets, tokens, senhas, telefones ou e-mails reais. Não replique payloads de terceiros.

Use documentação atual oficial da ANPD, Supabase, Next.js e OWASP quando necessário. Evite promessas de "100% conforme": revisão jurídica do controlador continua necessária.

## Análise técnica por superfície

### Identidade e autorização
- Cadastro restrito a nome, telefone, e-mail e senha; login por e-mail e senha; recuperação segura; confirmação de e-mail quando apropriado.
- Proibição de autoatribuição de papel admin. Primeiro admin provisionado em canal fechado e auditado.
- Checar separação autenticação × autorização. Usuário anônimo, cliente A, cliente B e admin devem ter privilégios distintos.
- Supabase, se presente: RLS ativo nas tabelas expostas, políticas de SELECT/INSERT/UPDATE/DELETE com ownership testado, grants mínimos, service role apenas no servidor, funções SECURITY DEFINER limitadas, grants de EXECUTE específicos.
- Não confiar no ID de cliente enviado pelo navegador; derivar identidade do usuário autenticado no servidor.

### Agenda, WhatsApp e fidelidade
- Servidor valida duração, horário, folgas, bloqueios, reservas concorrentes, idempotência, limites e timezone. Verificar índices/constraints e transação.
- Rate limit e proteção contra automação abusiva; evitar enumeração de contas e horários reservados com dados pessoais.
- Status pendente não equivale a confirmado; abrir `wa.me` não comprova envio. Mensagens não devem incluir dados além do necessário.
- Progressão de fidelidade apenas após atendimento elegível concluído pelo administrador; sem escrita direta pelo cliente. Histórico auditável, resgate atômico e único, rollback/reversões controladas.
- Nenhuma funcionalidade de pagamento online.

### Aplicação, infraestrutura e privacidade
- Sanitização e validação no servidor; XSS, CSRF quando aplicável, redirecionamentos abertos, headers, CORS restritivo, sessões/cookies seguros, logs, erros, variáveis de ambiente e dependências.
- Dados fictícios e `noindex` em demo; links WhatsApp válidos exclusivamente em sites reais autorizados.
- Separação de ambientes; backup e restauração testáveis; acesso mínimo a banco e painel.

## Matriz LGPD

Para cada categoria de dados (conta, telefone, agendamento, fidelidade, logs, cookies):
- finalidade, necessidade, base legal proposta **a validar**, controlador/operadores, acesso, compartilhamento;
- retenção e exclusão, inclusive backups; direitos do titular e canal de atendimento;
- segurança, evidência de incidentes e registro operacional necessário.

Cookies essenciais de sessão não exigem banner puramente ornamental; cookies opcionais de analytics/marketing não devem ser carregados antes da escolha quando dependem de consentimento. Separar aceite de marketing de criação da conta.

Comparar comportamento real com `/privacidade`, `/cookies`, `/termos` e documentação. Não inventar CNPJ, endereço, regras comerciais, consentimentos ou prazos legais.

## Testes/evidências desejados

- `anon`, cliente A, cliente B e admin: negados/permitidos em rotas e RLS, inclusive acesso por ID de outro usuário.
- Tentativa de escalada para admin; mudança fraudulenta de pontos; resgate duplicado; leitura de logs/dados alheios.
- Verificação de cookies antes/depois da preferência, reset e revogação quando aplicável.
- Testes sintéticos em ambiente isolado; sem testes destrutivos em produção.

## Entrega

Tabela curta: **gravidade | componente/linha | cenário de abuso | evidência | remediação | teste de regressão**.

Depois: **lacunas documentais LGPD**, **bloqueadores de produção**, **risco residual** e **itens que exigem validação jurídica**. Priorize achados exploráveis e comprovados, sem reproduzir dados pessoais. Não faça mudanças silenciosas.
