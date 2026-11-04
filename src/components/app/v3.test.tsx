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
  safeNext: (n: string | null, fallback = "/admin") => (n && n.startsWith("/") && !n.startsWith("//") ? n : fallback),
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
  me: { profile: vi.fn(), isAdmin: vi.fn() },
  auth: { signIn: vi.fn(), signOut: vi.fn(), updatePassword: vi.fn() },
  admin: { updateStatus: vi.fn(), reschedule: vi.fn(), createAppointment: vi.fn(), customersByPhone: vi.fn(), saveCustomer: vi.fn(), searchCustomers: vi.fn() },
}));
vi.mock("@/lib/booking/api", () => api);

import { AppointmentItem } from "./admin-shared";
import { LoginForm, NewPasswordForm } from "./auth-forms";
import { BookingFlow } from "./booking-flow";
import { CustomerPicker } from "./customer-picker";

const START = "2026-11-10T17:30:00.000Z"; // 14:30 em São Paulo
const SERVICE = { id: "degrade", name: "Degradê", duration_minutes: 45, price_cents: 5000, price_from: false, active: true, sort: 1 };
const BARBER = { id: "b1", name: "Profissional A", active: true, sort: 1, service_ids: ["degrade"] };

beforeEach(() => {
  api.catalog.services.mockResolvedValue([SERVICE]);
  api.catalog.barbers.mockResolvedValue([BARBER]);
  api.catalog.settings.mockResolvedValue({ business_name: "Barbearia Exemplo", whatsapp: "5516991234567" });
  api.catalog.availableDays.mockResolvedValue([{ day: "2026-11-10", slots: 3 }]);
  api.catalog.availableSlots.mockResolvedValue([{ slot_start: START, slot_end: START, barber_id: "b1", barber_name: "Profissional A" }]);
  search = new URLSearchParams({ servico: "degrade", profissional: "b1", data: "2026-11-10", hora: START });
  authState.session = null;
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("solicitação pública (sem conta)", () => {
  it("nome e telefone geram a mensagem do WhatsApp sem gravar nada e sem dizer que reservou", async () => {
    render(<BookingFlow />);
    await userEvent.type(await screen.findByLabelText("Seu nome"), "Ana Souza");
    await userEvent.type(screen.getByLabelText(/Seu telefone/), "(16) 99123-4567");
    await userEvent.click(screen.getByRole("button", { name: /Preparar mensagem/ }));

    expect(await screen.findByText("Seu horário ainda não está reservado.")).toBeTruthy();
    const link = screen.getByRole("link", { name: /Abrir o WhatsApp/ });
    const url = new URL(link.getAttribute("href")!);
    expect(url.origin + url.pathname).toBe("https://wa.me/5516991234567");
    const text = url.searchParams.get("text")!;
    expect(text).toContain("Gostaria de solicitar um horário");
    expect(text).toContain("Nome: Ana Souza");
    expect(text).toContain("Telefone: (16) 99123-4567");
    expect(text).toContain("Horário: 14:30");
    expect(text).toContain("só fica reservado depois da confirmação");

    // nada é gravado e a interface nunca diz que reservou
    expect(api.admin.createAppointment).not.toHaveBeenCalled();
    expect(api.admin.saveCustomer).not.toHaveBeenCalled();
    expect(screen.queryByText(/Solicitação registrada|agendamento confirmado|reserva concluída/i)).toBeNull();
    // dado pessoal nunca vai para a URL do próprio site
    for (const call of replace.mock.calls) expect(String(call[0])).not.toMatch(/Ana|99123|4567/);
  });

  it("valida nome e telefone antes de preparar a mensagem", async () => {
    render(<BookingFlow />);
    await userEvent.click(await screen.findByRole("button", { name: /Preparar mensagem/ }));
    expect(screen.getByText("Informe seu nome.")).toBeTruthy();
    expect(screen.getByText(/telefone com DDD/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Abrir o WhatsApp/ })).toBeNull();
  });

  it("mostra só os horários livres que o banco devolve", async () => {
    search = new URLSearchParams({ servico: "degrade", profissional: "b1", data: "2026-11-10" });
    api.catalog.availableSlots.mockResolvedValue([
      { slot_start: START, slot_end: START, barber_id: "b1", barber_name: "Profissional A" },
      { slot_start: "2026-11-10T18:30:00.000Z", slot_end: START, barber_id: "b1", barber_name: "Profissional A" },
    ]);
    render(<BookingFlow />);
    expect(await screen.findByRole("button", { name: "14:30" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "15:30" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "16:30" })).toBeNull();
  });

  it("sem número oficial (demonstração), o WhatsApp abre sem destinatário e avisa", async () => {
    api.catalog.settings.mockResolvedValue({ business_name: "Demo", whatsapp: "" });
    render(<BookingFlow />);
    await userEvent.type(await screen.findByLabelText("Seu nome"), "Ana");
    await userEvent.type(screen.getByLabelText(/Seu telefone/), "16991234567");
    await userEvent.click(screen.getByRole("button", { name: /Preparar mensagem/ }));
    const link = await screen.findByRole("link", { name: /Abrir o WhatsApp/ });
    expect(link.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(screen.getByText(/não há número cadastrado/i)).toBeTruthy();
  });
});

describe("acesso da equipe", () => {
  it("login com senha errada mostra mensagem compreensível e não oferece cadastro", async () => {
    search = new URLSearchParams();
    api.auth.signIn.mockRejectedValue({ message: "Invalid login credentials", status: 400 });
    render(<LoginForm />);
    expect(screen.queryByRole("link", { name: /criar conta|esqueci/i })).toBeNull();
    await userEvent.type(screen.getByLabelText("E-mail"), "equipe@example.com");
    await userEvent.type(screen.getByLabelText("Senha"), "errada123");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("E-mail ou senha incorretos.")).toBeTruthy();
  });

  it("login certo vai para o painel", async () => {
    search = new URLSearchParams();
    api.auth.signIn.mockResolvedValue(undefined);
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText("E-mail"), "equipe@example.com");
    await userEvent.type(screen.getByLabelText("Senha"), "certa1234");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin"));
  });

  it("troca de senha logado: fraca é recusada sem chamar o servidor; válida é salva", async () => {
    authState.session = { user: { id: "u1" } };
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
    id: "a1", protocol: "K7Q2MX", customer_id: "c1", guest_name: null, guest_phone: null, barber_id: "b1",
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

  it("telefone já cadastrado: mostra quem usa o número e só cadastra outra pessoa se o admin decidir", async () => {
    const existing = { id: "c9", full_name: "João Souza", phone: "16991234567", notes: null, created_at: START };
    api.admin.customersByPhone.mockResolvedValue([existing]);
    api.admin.saveCustomer.mockResolvedValue({ ...existing, id: "c10", full_name: "Pedro Souza" });
    const onChange = vi.fn();
    render(<CustomerPicker value={null} onChange={onChange} startNew />);
    await userEvent.type(screen.getByLabelText("Nome do cliente"), "Pedro Souza");
    await userEvent.type(screen.getByLabelText(/Telefone/), "(16) 99123-4567");
    await userEvent.click(screen.getByRole("button", { name: "Salvar cliente" }));

    expect(await screen.findByText(/Já existe cliente com este telefone/)).toBeTruthy();
    expect(api.admin.customersByPhone).toHaveBeenCalledWith("16991234567");
    expect(api.admin.saveCustomer).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /outra pessoa/ }));
    await waitFor(() => expect(api.admin.saveCustomer).toHaveBeenCalledWith({ full_name: "Pedro Souza", phone: "16991234567", notes: null }));
    expect(onChange).toHaveBeenCalledWith({ kind: "customer", customer: expect.objectContaining({ id: "c10" }) });
  });
});
