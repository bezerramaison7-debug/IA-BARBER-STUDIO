import { describe, expect, it } from "vitest";
import { addDays, dayKey, formatDate, formatLongDate, formatTime, localToIso } from "./datetime";
import { ADMIN_TRANSITIONS, isUpcoming, loyaltyCardText, needsReason, validateSignup } from "./domain";
import { getSupabaseEnv, looksLikeSecretKey } from "./env";
import { errorCode, friendlyError } from "./errors";
import { buildConfirmationMessage, buildConfirmationUrl } from "./whatsapp-confirmation";

const data = {
  businessName: "Barbearia Exemplo",
  protocol: "K7Q2MX",
  customerName: "Ana Souza",
  serviceName: "Degradê",
  barberName: "Profissional A",
  startsAt: "2026-11-10T17:30:00.000Z", // 14:30 em São Paulo
};

describe("mensagem de confirmação no WhatsApp", () => {
  it("segue o modelo com protocolo, dados e horário local", () => {
    expect(buildConfirmationMessage(data)).toBe(
      [
        "Olá, Barbearia Exemplo! Gostaria de confirmar meu agendamento.",
        "Protocolo: K7Q2MX",
        "Nome: Ana Souza",
        "Serviço: Degradê",
        "Profissional: Profissional A",
        "Data: 10/11/2026",
        "Horário: 14:30",
        "Aguardo a confirmação. Obrigado!",
      ].join("\n"),
    );
  });

  it("usa o número oficial válido, com a mensagem codificada", () => {
    const { url, hasRecipient } = buildConfirmationUrl("5516991234567", data);
    expect(hasRecipient).toBe(true);
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://wa.me/5516991234567");
    expect(parsed.searchParams.get("text")).toBe(buildConfirmationMessage(data));
  });

  it("sem número válido (demonstração ou número de exemplo), abre sem destinatário", () => {
    expect(buildConfirmationUrl("", data)).toMatchObject({ hasRecipient: false });
    expect(buildConfirmationUrl("5516999999999", data).url).toMatch(/^https:\/\/wa\.me\/\?text=/);
  });

  it("identifica cortesia", () => {
    expect(buildConfirmationMessage({ ...data, isReward: true })).toContain("Degradê (cortesia do programa de fidelidade)");
  });
});

describe("datas no fuso da barbearia", () => {
  it("formata e converte em America/Sao_Paulo", () => {
    expect(formatTime(data.startsAt)).toBe("14:30");
    expect(formatDate(data.startsAt)).toBe("10/11/2026");
    expect(dayKey("2026-11-11T02:30:00Z")).toBe("2026-11-10"); // 23:30 do dia 10 em SP
    expect(localToIso("2026-11-10", "14:30")).toBe(data.startsAt);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("data por extenso com só a primeira letra maiúscula", () => {
    expect(formatLongDate("2026-11-06T15:00:00Z")).toBe("Sexta-feira, 6 de novembro");
  });
});

describe("regras de apresentação", () => {
  it("texto do cartão de fidelidade", () => {
    expect(loyaltyCardText({ threshold: 10, points: 7, reward_service_name: "Corte clássico" })).toBe(
      "Faltam 3 atendimentos para o seu próximo Corte clássico gratuito.",
    );
    expect(loyaltyCardText({ threshold: 10, points: 9, reward_service_name: "Corte + barba" })).toBe(
      "Falta 1 atendimento para o seu próximo Corte + barba gratuito.",
    );
  });

  it("transições e correções", () => {
    expect(ADMIN_TRANSITIONS.pendente).toEqual(["confirmado", "cancelado"]);
    expect(ADMIN_TRANSITIONS.cancelado).toEqual([]);
    expect(needsReason("concluido", "confirmado")).toBe(true);
    expect(needsReason("pendente", "confirmado")).toBe(false);
    expect(isUpcoming("pendente", "2999-01-01T00:00:00Z")).toBe(true);
    expect(isUpcoming("cancelado", "2999-01-01T00:00:00Z")).toBe(false);
  });

  it("cadastro exige só nome, telefone, e-mail e senha válidos", () => {
    expect(validateSignup({ fullName: "Ana Souza", phone: "(16) 99123-4567", email: "ana@example.com", password: "senha123" })).toEqual({});
    expect(Object.keys(validateSignup({ fullName: "Ana", phone: "123", email: "x", password: "curta" })).sort()).toEqual([
      "email",
      "fullName",
      "password",
      "phone",
    ]);
  });
});

describe("erros", () => {
  it("mensagens claras e código de negócio", () => {
    expect(friendlyError({ message: "Invalid login credentials" })).toBe("E-mail ou senha incorretos.");
    expect(friendlyError({ status: 429, message: "x" })).toMatch(/Muitas tentativas/);
    const business = { code: "P0001", hint: "ocupado", message: "Este horário acabou de ser reservado. Escolha outro." };
    expect(friendlyError(business)).toBe(business.message);
    expect(errorCode(business)).toBe("ocupado");
    expect(friendlyError(new Error("boom"))).toMatch(/Não foi possível/);
  });
});

describe("ambiente", () => {
  it("só ativa com URL https e chave pública", () => {
    expect(getSupabaseEnv({})).toBeNull();
    expect(getSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" })).toEqual({
      url: "https://abc.supabase.co",
      anonKey: "k",
    });
    expect(getSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "http://evil.com", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" })).toBeNull();
  });

  it("reconhece chave secreta colocada por engano", () => {
    const payload = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
    expect(looksLikeSecretKey(`x.${payload}.y`)).toBe(true);
    expect(looksLikeSecretKey("sb_secret_abc")).toBe(true);
    expect(looksLikeSecretKey("sb_publishable_abc")).toBe(false);
  });
});
