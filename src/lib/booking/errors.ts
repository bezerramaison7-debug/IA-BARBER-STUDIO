/**
 * Traduz erros do Supabase em mensagens claras, sem detalhes técnicos.
 * Erros de negócio do banco já vêm em português (message) com um código estável (hint).
 */
interface MaybeError {
  message?: string;
  hint?: string | null;
  code?: string;
  status?: number;
  name?: string;
}

const AUTH_MESSAGES: [RegExp, string][] = [
  [/invalid login credentials/i, "E-mail ou senha incorretos."],
  [/email not confirmed/i, "Confirme seu e-mail pelo link que enviamos antes de entrar."],
  [/user already registered|already been registered/i, "Já existe uma conta com este e-mail. Entre ou recupere a senha."],
  [/password should be at least|password.*(short|weak)/i, "A senha precisa ter pelo menos 8 caracteres, com letras e números."],
  [/same.*password|different from the old/i, "A nova senha precisa ser diferente da atual."],
  [/rate limit|too many requests|over_email_send_rate_limit|for security purposes/i, "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente."],
  [/token has expired|otp.*expired|invalid.*(otp|token)|link is invalid/i, "Este link expirou ou já foi usado. Peça um novo."],
  [/unable to validate email|invalid.*email/i, "Informe um e-mail válido."],
  [/reauthentication|reauthenticate/i, "Por segurança, saia e entre de novo antes de trocar a senha."],
  [/failed to fetch|network/i, "Sem conexão com o servidor. Verifique sua internet e tente novamente."],
];

export function friendlyError(error: unknown): string {
  const e = (error ?? {}) as MaybeError;
  // Erro de negócio lançado pelas funções do banco (public._fail): a mensagem já é amigável.
  if (e.hint && e.code === "P0001" && e.message) return e.message;
  // Cadastro recusado pelo trigger do banco (nome/telefone inválidos).
  if (/database error saving new user/i.test(e.message ?? "")) {
    return "Confira o nome completo e o telefone com DDD e tente novamente.";
  }
  if (e.code === "42501") return "Você não tem permissão para fazer isso.";
  for (const [re, msg] of AUTH_MESSAGES) if (re.test(e.message ?? "")) return msg;
  if (e.status === 429) return AUTH_MESSAGES[5]![1];
  return "Não foi possível concluir agora. Tente novamente em instantes.";
}

/** Código estável do erro de negócio (ex.: "ocupado"), para decidir a próxima ação na tela. */
export function errorCode(error: unknown): string | undefined {
  return ((error ?? {}) as MaybeError).hint ?? undefined;
}
