import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------- simulações
let search = new URLSearchParams();
const replace = vi.fn((url: string) => {
  search = new URLSearchParams(url.split("?")[1] ?? "");
});
vi.mock("next/navigation", () => ({
  useSearchParams: () => search,
  useRouter: () => ({ replace, push: replace }),
  usePathname: () => "/agendar",
}));

const authState = { ready: true, session: null as unknown, profile: null as unknown, isAdmin: false, refresh: vi.fn() };
vi.mock("./auth-context", () => ({
  useAuth: () => authState,
  safeNext: (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/minha-conta"),
  RequireAuth: ({ children }: { children: React.ReactNode }) => children,
}));

const api = vi.hoisted(() => ({
  catalog: {
    services: vi.fn(),
    barbers: vi.fn(),
    settings: vi.fn(),
    rules: vi.fn(),
    availableDays: vi.fn(),
    availableSlots: vi.fn(),
  },
  me: { rewards: vi.fn(), appointments: vi.fn(), requestAppointment: vi.fn(), reschedule: vi.fn() },
  auth: { signUp: vi.fn(), signIn: vi.fn(), requestPasswordReset: vi.fn(), updatePassword: vi.fn(), verifyEmailLink: vi.fn() },
  admin: { updateStatus: vi.fn(), reschedule: vi.fn() },
}));
vi.mock("@/lib/booking/api", () => api);

import { AppointmentItem } from "./admin-shared";
import { EmailLinkHandler, ForgotPasswordForm, LoginForm, NewPasswordForm, SignupForm } from "./auth-forms";
import { BookingFlow } from "./booking-flow";

const START = "2026-11-10T17:30:00.000Z"; // 14:30 em São Paulo
const SERVICE = { id: "degrade", name: "Degradê", duration_minutes: 45, price_cents: 5000, price_from: false, active: true, sort: 1 };
const BARBER = { id: "b1", name: "Profissional A", active: true, sort: 1, service_ids: ["degrade"] };

beforeEach(() => {
  api.catalog.services.mockResolvedValue([SERVICE]);
  api.catalog.barbers.mockResolvedValue([BARBER]);
  api.catalog.settings.mockResolvedValue({ business_name: "Barbearia Exemplo", whatsapp: "5516991234567" });
  api.catalog.rules.mockResolvedValue([]);
  api.catalog.availableDays.mockResolvedValue([{ day: "2026-11-10", slots: 3 }]);
  api.catalog.availableSlots.mockResolvedValue([{ slot_start: START, slot_end: START, barber_id: "b1", barber_name: "Profissional A" }]);
  api.me.rewards.mockResolvedValue([]);
  api.me.appointments.mockResolvedValue([]);
  search = new URLSearchParams({ servico: "degrade", profissional: "b1", data: "2026-11-10", hora: START });
  authState.session = { user: { id: "u1" } };
  authState.profile = { id: "u1", full_name: "Ana Souza", phone: "16991234567", email: "ana@example.com", role: "cliente" };
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("agendamento", () => {
  it("solicita, mostra PENDENTE aguardando confirmação e o link oficial do WhatsApp", async () => {
    api.me.requestAppointment.mockResolvedValue({ id: "a1", protocol: "K7Q2MX", status: "pendente", repetida: false });
    render(<BookingFlow />);
    const submit = await screen.findByRole("button", { name: /solicitar agendamento/i });
    await userEvent.click(submit);

    expect(api.me.requestAppointment).toHaveBeenCalledTimes(1);
    const args = api.me.requestAppointment.mock.calls[0]![0];
    expect(args).toMatchObject({ serviceId: "degrade", start: START, barberId: "b1", rewardId: null });
    expect(args.requestKey).toMatch(/^[0-9a-f-]{36}$/);

    expect(await screen.findByText("Solicitação registrada")).toBeTruthy();
    expect(screen.getByText("Seu horário aguarda confirmação da barbearia.")).toBeTruthy();
    expect(screen.getByText("K7Q2MX")).toBeTruthy();
    const link = screen.getByRole("link", { name: /enviar confirmação pelo whatsapp/i });
    const url = new URL(link.getAttribute("href")!);
    expect(url.origin + url.pathname).toBe("https://wa.me/5516991234567");
    expect(url.searchParams.get("text")).toContain("Protocolo: K7Q2MX");
    expect(url.searchParams.get("text")).toContain("Horário: 14:30");
    // abrir o WhatsApp não confirma: o painel não foi acionado
    expect(api.admin.updateStatus).not.toHaveBeenCalled();
    expect(screen.getByText(/não confirma o horário/i)).toBeTruthy();
  });

  it("sem login, a revisão pede para entrar ou criar conta sem perder as escolhas", async () => {
    authState.session = null;
    authState.profile = null;
    render(<BookingFlow />);
    const enter = await screen.findByRole("link", { name: "Entrar" });
    const next = new URL(enter.getAttribute("href")!, "https://x").searchParams.get("next")!;
    expect(next).toContain("servico=degrade");
    expect(next).toContain("hora=");
    expect(screen.queryByRole("button", { name: /solicitar agendamento/i })).toBeNull();
  });

  it("horário tomado por outra pessoa: mensagem clara e volta para escolher o horário", async () => {
    api.me.requestAppointment.mockRejectedValue({ code: "P0001", hint: "ocupado", message: "Este horário acabou de ser reservado. Escolha outro." });
    render(<BookingFlow />);
    await userEvent.click(await screen.findByRole("button", { name: /solicitar agendamento/i }));
    expect(await screen.findByText("Este horário acabou de ser reservado. Escolha outro.")).toBeTruthy();
    expect(replace).toHaveBeenCalled();
    expect(search.get("hora")).toBeNull();
  });

  it("sem número oficial (demonstração), o WhatsApp abre sem destinatário e avisa", async () => {
    api.catalog.settings.mockResolvedValue({ business_name: "Demo", whatsapp: "" });
    api.me.requestAppointment.mockResolvedValue({ id: "a1", protocol: "ABCDEF", status: "pendente", repetida: false });
    render(<BookingFlow />);
    await userEvent.click(await screen.findByRole("button", { name: /solicitar agendamento/i }));
    const link = await screen.findByRole("link", { name: /enviar confirmação pelo whatsapp/i });
    expect(link.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(screen.getByText(/não há número cadastrado/i)).toBeTruthy();
  });
});

describe("cadastro e login", () => {
  it("cadastro valida os 4 campos e não chama o servidor com dados inválidos", async () => {
    search = new URLSearchParams();
    render(<SignupForm />);
    await userEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(api.auth.signUp).not.toHaveBeenCalled();
    expect(screen.getByText("Informe nome e sobrenome.")).toBeTruthy();
    expect(screen.getByText(/telefone com DDD/i)).toBeTruthy();
  });

  it("cadastro válido envia só nome, telefone, e-mail, senha e o marketing opcional desmarcado", async () => {
    search = new URLSearchParams();
    api.auth.signUp.mockResolvedValue({ needsConfirmation: true });
    render(<SignupForm />);
    await userEvent.type(screen.getByLabelText("Nome completo"), "Ana Souza");
    await userEvent.type(screen.getByLabelText(/Telefone/), "(16) 99123-4567");
    await userEvent.type(screen.getByLabelText("E-mail"), "ana@example.com");
    await userEvent.type(screen.getByLabelText("Senha"), "senha123");
    await userEvent.type(screen.getByLabelText("Repita a senha"), "senha123");
    await userEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(api.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: "Ana Souza", phone: "(16) 99123-4567", email: "ana@example.com", password: "senha123", marketing: false }),
    );
    expect(await screen.findByText("Confirme seu e-mail")).toBeTruthy();
  });

  it("login com senha errada mostra mensagem compreensível", async () => {
    search = new URLSearchParams();
    authState.session = null;
    api.auth.signIn.mockRejectedValue({ message: "Invalid login credentials", status: 400 });
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText("E-mail"), "ana@example.com");
    await userEvent.type(screen.getByLabelText("Senha"), "errada123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("E-mail ou senha incorretos.")).toBeTruthy();
  });
});

describe("recuperação de senha", () => {
  it("pede o link para /redefinir-senha e responde de forma neutra (não revela se o e-mail existe)", async () => {
    api.auth.requestPasswordReset.mockResolvedValue(undefined);
    render(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText("E-mail"), "ana@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Enviar link" }));
    expect(api.auth.requestPasswordReset).toHaveBeenCalledWith("ana@example.com", expect.stringMatching(/\/redefinir-senha$/));
    expect(await screen.findByText(/Se houver uma conta com este e-mail/)).toBeTruthy();
  });

  it("o link do e-mail valida o token e leva para criar a nova senha", async () => {
    search = new URLSearchParams({ token_hash: "hash-de-teste", type: "recovery" });
    api.auth.verifyEmailLink.mockResolvedValue(undefined);
    render(<EmailLinkHandler />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/redefinir-senha"));
    expect(api.auth.verifyEmailLink).toHaveBeenCalledWith("hash-de-teste", "recovery");
  });

  it("nova senha fraca é recusada sem chamar o servidor; senha válida é salva", async () => {
    api.auth.updatePassword.mockResolvedValue(undefined);
    render(<NewPasswordForm />);
    await userEvent.type(screen.getByLabelText(/Nova senha/), "curta");
    await userEvent.type(screen.getByLabelText("Repita a senha"), "curta");
    await userEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));
    expect(api.auth.updatePassword).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText(/Nova senha/));
    await userEvent.clear(screen.getByLabelText("Repita a senha"));
    await userEvent.type(screen.getByLabelText(/Nova senha/), "novasenha42");
    await userEvent.type(screen.getByLabelText("Repita a senha"), "novasenha42");
    await userEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));
    expect(api.auth.updatePassword).toHaveBeenCalledWith("novasenha42");
    expect(await screen.findByText(/Senha alterada/)).toBeTruthy();
  });
});

describe("painel", () => {
  const appt = {
    id: "a1", protocol: "K7Q2MX", customer_id: "u1", guest_name: null, guest_phone: null, barber_id: "b1",
    service_id: "degrade", service_name: "Degradê", duration_minutes: 45, starts_at: START, ends_at: START,
    status: "pendente" as const, is_reward: false, notes: null, created_at: START,
    barber: { name: "Profissional A" }, customer: { full_name: "Ana Souza", phone: "16991234567" },
  };

  it("pendente oferece confirmar e cancelar; confirmar chama o banco", async () => {
    api.admin.updateStatus.mockResolvedValue(undefined);
    const onChanged = vi.fn();
    render(<AppointmentItem a={appt} onChanged={onChanged} />);
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /concluir/i })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(api.admin.updateStatus).toHaveBeenCalledWith("a1", "confirmado", undefined);
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it("desfazer uma conclusão exige motivo", async () => {
    const prompt = vi.fn(() => null);
    window.prompt = prompt;
    render(<AppointmentItem a={{ ...appt, status: "concluido" }} onChanged={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /desfazer/i }));
    expect(prompt).toHaveBeenCalled();
    expect(api.admin.updateStatus).not.toHaveBeenCalled();
  });
});
