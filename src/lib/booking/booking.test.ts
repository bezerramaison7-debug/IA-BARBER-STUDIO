import { describe, expect, it } from "vitest";
import { addDays, dayKey, formatDate, formatDayKey, formatLongDate, formatTime, localToIso } from "./datetime";
import { ADMIN_TRANSITIONS, isUpcoming, loyaltyCardText, needsReason, phoneDigits, validateContact } from "./domain";
import { getSupabaseEnv, looksLikeSecretKey } from "./env";
import { errorCode, friendlyError } from "./errors";
import { buildRequestMessage, buildRequestUrl, formatBrPhone } from "./whatsapp-confirmation";

const data = {
  businessName: "Barbearia Exemplo",
  customerName: "Ana Souza",
  customerPhone: "16991234567",
  serviceName: "Degradê",
  barberName: "Profissional A",
  startsAt: "2026-11-10T17:30:00.000Z", // 14:30 em São Paulo
};

describe("mensagem de solicitação no WhatsApp", () => {
  it("é um pedido, sem protocolo, com os dados escolhidos e o aviso de que depende de confirmação", () => {
    expect(buildRequestMessage(data)).toBe(
      [
        "Olá, Barbearia Exemplo! Gostaria de solicitar um horário.",
        "Serviço: Degradê",
        "Profissional: Profissional A",
        "Data: 10/11/2026",
        "Horário: 14:30",
        "Nome: Ana Souza",
        "Telefone: (16) 99123-4567",
        "Sei que o horário só fica reservado depois da confirmação de vocês.",
      ].join("\n"),
    );
    expect(buildRequestMessage(data)).not.toMatch(/protocolo|confirmad[oa]|reservad[oa]\./i);
  });

  it("sem preferência de profissional e com observação", () => {
    const msg = buildRequestMessage({ ...data, barberName: null, notes: "  Prefiro máquina 2  " });
    expect(msg).toContain("Profissional: sem preferência");
    expect(msg).toContain("Observação: Prefiro máquina 2");
  });

  it("usa o número oficial válido, com a mensagem codificada", () => {
    const { url, hasRecipient } = buildRequestUrl("5516991234567", data);
    expect(hasRecipient).toBe(true);
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://wa.me/5516991234567");
    expect(parsed.searchParams.get("text")).toBe(buildRequestMessage(data));
  });

  it("sem número válido (demonstração ou número de exemplo), abre sem destinatário", () => {
    expect(buildRequestUrl("", data)).toMatchObject({ hasRecipient: false });
    expect(buildRequestUrl("5516999999999", data).url).toMatch(/^https:\/\/wa\.me\/\?text=/);
  });

  it("formata telefones brasileiros", () => {
    expect(formatBrPhone("5516991234567")).toBe("(16) 99123-4567");
    expect(formatBrPhone("1633221144")).toBe("(16) 3322-1144");
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
    expect(formatDayKey("2026-10-23")).toBe("sex., 23/10");
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
    // conclusão desfeita depois da recompensa: saldo -1, faltam 11 (não 10)
    expect(loyaltyCardText({ threshold: 10, points: -1, reward_service_name: "Corte clássico" })).toBe(
      "Faltam 11 atendimentos para o seu próximo Corte clássico gratuito.",
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

  it("nome e telefone: valida e normaliza no formato nacional", () => {
    expect(validateContact({ fullName: "Ana", phone: "(16) 99123-4567" })).toEqual({});
    expect(validateContact({ fullName: "Ana", phone: "+55 16 99123-4567" })).toEqual({});
    expect(Object.keys(validateContact({ fullName: " ", phone: "123" })).sort()).toEqual(["fullName", "phone"]);
    expect(validateContact({ fullName: "Ana", phone: "(16) 99999-9999" }).phone).toBeTruthy(); // número de exemplo
    expect(phoneDigits("+55 (16) 99123-4567")).toBe("16991234567");
    expect(phoneDigits("016 99123-4567")).toBe("16991234567");
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

  it("chave secreta como pública: o sistema não liga", () => {
    expect(getSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://abcd.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_abc" })).toBeNull();
  });
});
