import { buildWhatsAppUrl, isValidBrazilianWhatsApp, normalizePhone } from "@/lib/whatsapp";
import { formatDate, formatTime } from "./datetime";

export interface RequestData {
  businessName: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  /** Nome do profissional ou null para "sem preferência". */
  barberName: string | null;
  startsAt: string;
  notes?: string;
}

/** Telefone para exibir na mensagem: "(16) 99123-4567". */
export function formatBrPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw.trim();
}

/**
 * Mensagem que o visitante envia à barbearia. É um PEDIDO: nada foi gravado nem reservado no site,
 * e o texto diz isso. O envio é manual (o visitante decide no WhatsApp).
 */
export function buildRequestMessage(d: RequestData): string {
  return [
    `Olá, ${d.businessName}! Gostaria de solicitar um horário.`,
    `Serviço: ${d.serviceName}`,
    `Profissional: ${d.barberName ?? "sem preferência"}`,
    `Data: ${formatDate(d.startsAt)}`,
    `Horário: ${formatTime(d.startsAt)}`,
    `Nome: ${d.customerName.trim()}`,
    `Telefone: ${formatBrPhone(d.customerPhone)}`,
    ...(d.notes?.trim() ? [`Observação: ${d.notes.trim()}`] : []),
    "Sei que o horário só fica reservado depois da confirmação de vocês.",
  ].join("\n");
}

/**
 * Link wa.me com a mensagem. O número vem do painel (business_settings.whatsapp); se estiver
 * vazio ou inválido (demonstração), o link abre sem destinatário. Abrir o link NÃO reserva nada.
 */
export function buildRequestUrl(whatsapp: string, data: RequestData): { url: string; hasRecipient: boolean } {
  const digits = normalizePhone(whatsapp);
  const valid = isValidBrazilianWhatsApp(digits);
  return { url: buildWhatsAppUrl(valid ? digits : "", buildRequestMessage(data)), hasRecipient: valid };
}
