/** Tipos e regras de apresentação da agenda (espelham o esquema do banco). */
export type AppointmentStatus = "pendente" | "confirmado" | "concluido" | "cancelado" | "nao_compareceu" | "expirado";

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pendente: "Aguardando confirmação",
  confirmado: "Confirmado",
  concluido: "Concluído",
  cancelado: "Cancelado",
  nao_compareceu: "Não compareceu",
  expirado: "Expirado",
};

export const STATUS_TONE: Record<AppointmentStatus, "warning" | "success" | "neutral" | "danger"> = {
  pendente: "warning",
  confirmado: "success",
  concluido: "neutral",
  cancelado: "danger",
  nao_compareceu: "danger",
  expirado: "neutral",
};

/** Ações que o painel oferece para cada status (o banco valida de novo). */
export const ADMIN_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  pendente: ["confirmado", "cancelado"],
  confirmado: ["concluido", "nao_compareceu", "cancelado"],
  concluido: ["confirmado"],
  nao_compareceu: ["confirmado"],
  cancelado: [],
  expirado: [],
};

export const ACTION_LABEL: Partial<Record<AppointmentStatus, string>> = {
  confirmado: "Confirmar",
  concluido: "Concluir atendimento",
  nao_compareceu: "Não compareceu",
  cancelado: "Cancelar",
};

/** Correções (desfazer conclusão/falta) exigem motivo no banco. */
export function needsReason(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return (from === "concluido" || from === "nao_compareceu") && to === "confirmado";
}

export function isUpcoming(status: AppointmentStatus, startsAt: string, now = Date.now()): boolean {
  return (status === "pendente" || status === "confirmado") && new Date(startsAt).getTime() > now;
}

export interface LoyaltyCard {
  rule_id: string;
  name: string;
  threshold: number;
  points: number;
  reward_service_id: string;
  reward_service_name: string;
  available_rewards: number;
}

/** "Faltam 3 atendimentos para o seu próximo Corte clássico gratuito." */
export function loyaltyCardText(card: Pick<LoyaltyCard, "threshold" | "points" | "reward_service_name">): string {
  // Saldo negativo (conclusão desfeita depois de gerar a recompensa) aumenta o que falta.
  const missing = card.threshold - Math.min(card.points, card.threshold);
  if (missing <= 0) return `Você completou o cartão: ${card.reward_service_name} gratuito disponível.`;
  return `Falta${missing === 1 ? "" : "m"} ${missing} atendimento${missing === 1 ? "" : "s"} para o seu próximo ${card.reward_service_name} gratuito.`;
}

export interface SignupInput {
  fullName: string;
  phone: string;
  email: string;
  password: string;
}

/** Validação do cadastro (repetida no banco para nome e telefone). Só os 4 campos exigidos. */
export function validateSignup(input: SignupInput): Partial<Record<keyof SignupInput, string>> {
  const errors: Partial<Record<keyof SignupInput, string>> = {};
  const name = input.fullName.trim();
  if (name.length < 3 || !/\s/.test(name)) errors.fullName = "Informe nome e sobrenome.";
  const digits = input.phone.replace(/\D/g, "");
  if (!/^\d{10,11}$/.test(digits)) errors.phone = "Informe o telefone com DDD, só números ou com máscara.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.email.trim())) errors.email = "Informe um e-mail válido.";
  const passwordError = validatePassword(input.password);
  if (passwordError) errors.password = passwordError;
  return errors;
}

export function validatePassword(password: string): string | undefined {
  if (password.length < 8) return "Use pelo menos 8 caracteres.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Use letras e números.";
  return undefined;
}
