/** Datas e horários sempre exibidos no fuso da barbearia, qualquer que seja o do visitante. */
export const BUSINESS_TZ = "America/Sao_Paulo";

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: BUSINESS_TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: BUSINESS_TZ, day: "2-digit", month: "2-digit", year: "numeric" });
const longFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: BUSINESS_TZ, weekday: "long", day: "numeric", month: "long" });
const shortDayFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" });

/** "AAAA-MM-DD" do instante no fuso da barbearia. */
export function dayKey(instant: Date | string): string {
  return dayKeyFmt.format(new Date(instant));
}

/** "14:30" */
export function formatTime(instant: Date | string): string {
  return timeFmt.format(new Date(instant));
}

/** "23/10/2026" */
export function formatDate(instant: Date | string): string {
  return dateFmt.format(new Date(instant));
}

/** "sexta-feira, 23 de outubro" */
export function formatLongDate(instant: Date | string): string {
  const text = longFmt.format(new Date(instant));
  // Em português só a primeira letra vai em maiúscula ("Sexta-feira, 6 de novembro").
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Rótulo curto de um dia "AAAA-MM-DD": "sex., 23/10". */
export function formatDayKey(key: string): string {
  return shortDayFmt.format(new Date(`${key}T12:00:00Z`)).replace(/\.,/, ".,");
}

/** Soma dias a "AAAA-MM-DD" sem passar por fuso. */
export function addDays(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Converte "AAAA-MM-DD" + "HH:MM" (horário local da barbearia) em instante ISO. Brasil sem horário de verão. */
export function localToIso(key: string, time: string): string {
  return new Date(`${key}T${time}:00-03:00`).toISOString();
}
