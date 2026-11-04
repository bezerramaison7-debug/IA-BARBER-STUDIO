import { buildWhatsAppUrl, isValidBrazilianWhatsApp, normalizePhone } from "@/lib/whatsapp";
import { formatDate, formatTime } from "./datetime";

export interface ConfirmationData {
  businessName: string;
  protocol: string;
  customerName: string;
  serviceName: string;
  barberName: string;
  startsAt: string;
  isReward?: boolean;
}

/** Mensagem pronta para o cliente enviar à barbearia (o envio é manual). */
export function buildConfirmationMessage(d: ConfirmationData): string {
  return [
    `Olá, ${d.businessName}! Gostaria de confirmar meu agendamento.`,
    `Protocolo: ${d.protocol}`,
    `Nome: ${d.customerName}`,
    `Serviço: ${d.serviceName}${d.isReward ? " (cortesia do programa de fidelidade)" : ""}`,
    `Profissional: ${d.barberName}`,
    `Data: ${formatDate(d.startsAt)}`,
    `Horário: ${formatTime(d.startsAt)}`,
    "Aguardo a confirmação. Obrigado!",
  ].join("\n");
}

/**
 * Link wa.me com a mensagem. O número vem do painel (business_settings.whatsapp); se estiver
 * vazio ou inválido (demonstração), o link abre sem destinatário. Abrir o link NÃO confirma
 * nada: o agendamento continua PENDENTE até a barbearia confirmar no painel.
 */
export function buildConfirmationUrl(whatsapp: string, data: ConfirmationData): { url: string; hasRecipient: boolean } {
  const digits = normalizePhone(whatsapp);
  const valid = isValidBrazilianWhatsApp(digits);
  return { url: buildWhatsAppUrl(valid ? digits : "", buildConfirmationMessage(data)), hasRecipient: valid };
}
