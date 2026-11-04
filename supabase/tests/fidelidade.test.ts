import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, at, createCustomer, createTestDb, createUser, errorOf, localDay, makeAdmin, seedCatalog, uuid, type TestDb } from "./support/db";

let db: TestDb;
let cat: Awaited<ReturnType<typeof seedCatalog>>;
let admin: string;
let pastSlot = 0;

beforeAll(async () => {
  db = await createTestDb();
  cat = await seedCatalog(db.su);
  admin = await createUser(db.su, { name: "Admin Teste" });
  await makeAdmin(db.su, admin);
});
afterAll(async () => db?.drop());

const asAdmin = <T = unknown>(sql: string, params: unknown[] = [], client = db.su) =>
  as<{ r: T }>(client, { role: "authenticated", userId: admin }, `select ${sql} as r`, params).then((rows) => rows[0]!.r);

/** Horário passado único (registro de atendimento no balcão). */
async function nextPastStart() {
  const i = pastSlot++;
  return at(db.su, await localDay(db.su, -1 - Math.floor(i / 8)), `${String(6 + (i % 8) * 2).padStart(2, "0")}:00`);
}

/** Registra um atendimento já realizado (como o botão "Registrar atendimento") e devolve o id. */
async function visit(customer: string, service: string, status: "concluido" | "confirmado" = "concluido", reward: string | null = null) {
  const r = await asAdmin<{ id: string }>("public.admin_create_appointment($1, $2, $3, $4, null, null, $5, null, true, $6)", [
    service,
    cat.barberA,
    await nextPastStart(),
    customer,
    status,
    reward,
  ]);
  return r.id;
}

/** Agendamento futuro registrado pelo painel, opcionalmente usando uma cortesia. */
const book = async (customer: string, service: string, dayOffset: number, time: string, reward: string | null = null, barber = cat.barberA, client = db.su) =>
  asAdmin<{ id: string }>("public.admin_create_appointment($1, $2, $3, $4, null, null, 'confirmado', null, false, $5)", [
    service,
    barber,
    await at(db.su, await localDay(db.su, dayOffset), time),
    customer,
    reward,
  ], client);

const loyalty = async (customer: string) => {
  const r = await asAdmin<{ fidelidade: { name: string; points: number; available_rewards: number }[] }>("public.admin_get_customer($1)", [customer]);
  return Object.fromEntries(r.fidelidade.map((c) => [c.name, { points: c.points, rewards: c.available_rewards }]));
};

async function customerWithReward() {
  const c = await createCustomer(db.su);
  await asAdmin("public.admin_adjust_loyalty($1, $2, 10, 'Migração de cartão de papel')", [c, cat.ruleCorte]);
  const { rows } = await db.su.query("select id from public.loyalty_rewards where customer_id = $1 and status = 'disponivel'", [c]);
  return { c, reward: rows[0].id as string };
}

describe("contagem", () => {
  it("10 cortes concluídos geram 1 corte grátis; os cartões são separados", async () => {
    const c = await createCustomer(db.su);
    for (let i = 0; i < 9; i++) await visit(c, i % 2 ? "degrade" : "corte-classico");
    await visit(c, "corte-barba");
    expect(await loyalty(c)).toEqual({
      "Cartão Corte": { points: 9, rewards: 0 },
      "Cartão Cabelo + Barba": { points: 1, rewards: 0 },
    });
    await visit(c, "corte-classico"); // 10º corte
    expect((await loyalty(c))["Cartão Corte"]).toEqual({ points: 0, rewards: 1 });
  });

  it("10 combos concluídos geram 1 combo grátis", async () => {
    const c = await createCustomer(db.su);
    for (let i = 0; i < 10; i++) await visit(c, "corte-barba");
    expect((await loyalty(c))["Cartão Cabelo + Barba"]).toEqual({ points: 0, rewards: 1 });
    expect((await loyalty(c))["Cartão Corte"].points).toBe(0);
  });

  it("serviço fora do programa e atendimento avulso (sem cadastro) não pontuam", async () => {
    const c = await createCustomer(db.su);
    await visit(c, "barba");
    expect((await loyalty(c))["Cartão Corte"].points).toBe(0);
    await asAdmin("public.admin_create_appointment('corte-classico', $1, $2, null, 'Avulso', null, 'concluido', null, true)", [cat.barberA, await nextPastStart()]);
    const { rows } = await db.su.query("select count(*)::int as n from public.loyalty_entries where customer_id is null");
    expect(rows[0].n).toBe(0);
  });

  it("falta e cancelamento não pontuam", async () => {
    const c = await createCustomer(db.su);
    const a = await visit(c, "corte-classico", "confirmado");
    await asAdmin("public.admin_update_status($1, 'nao_compareceu')", [a]);
    const b = await visit(c, "corte-classico", "confirmado");
    await asAdmin("public.admin_update_status($1, 'cancelado')", [b]);
    expect((await loyalty(c))["Cartão Corte"].points).toBe(0);
  });

  it("concluir duas vezes não conta em dobro; desfazer estorna (com motivo); refazer conta de novo uma vez", async () => {
    const c = await createCustomer(db.su);
    const a = await visit(c, "corte-classico", "confirmado");
    await asAdmin("public.admin_update_status($1, 'concluido')", [a]);
    await asAdmin("public.admin_update_status($1, 'concluido')", [a]); // clique repetido
    expect((await loyalty(c))["Cartão Corte"].points).toBe(1);

    expect((await errorOf(asAdmin("public.admin_update_status($1, 'confirmado')", [a]))).hint).toBe("motivo_obrigatorio");
    await asAdmin("public.admin_update_status($1, 'confirmado', 'Concluído por engano')", [a]);
    expect((await loyalty(c))["Cartão Corte"].points).toBe(0);
    await asAdmin("public.admin_update_status($1, 'concluido')", [a]);
    expect((await loyalty(c))["Cartão Corte"].points).toBe(1);

    const { rows } = await db.su.query("select kind, delta from public.loyalty_entries where appointment_id = $1 order by id", [a]);
    expect(rows).toEqual([
      { kind: "atendimento", delta: 1 },
      { kind: "estorno", delta: -1 },
      { kind: "atendimento", delta: 1 },
    ]);
  });

  it("registro repetido do mesmo atendimento (mesma chave) não pontua duas vezes", async () => {
    const c = await createCustomer(db.su);
    const key = uuid();
    const start = await nextPastStart();
    const call = () => asAdmin("public.admin_create_appointment('corte-classico', $1, $2, $3, null, null, 'concluido', null, true, null, $4)", [cat.barberA, start, c, key]);
    await call();
    await call();
    expect((await loyalty(c))["Cartão Corte"].points).toBe(1);
  });

  it("não é possível concluir um horário futuro (evita pontos antecipados)", async () => {
    const c = await createCustomer(db.su);
    const r = await book(c, "corte-classico", 3, "09:00");
    expect((await errorOf(asAdmin("public.admin_update_status($1, 'concluido')", [r.id]))).hint).toBe("conclusao_futura");
  });

  it("conclusões simultâneas no 10º ponto geram uma única recompensa", async () => {
    const c = await createCustomer(db.su);
    for (let i = 0; i < 8; i++) await visit(c, "corte-classico");
    const a = await visit(c, "corte-classico", "confirmado");
    const b = await visit(c, "corte-classico", "confirmado");
    const [c1, c2] = [await db.connect(), await db.connect()];
    await Promise.all([
      asAdmin("public.admin_update_status($1, 'concluido')", [a], c1),
      asAdmin("public.admin_update_status($1, 'concluido')", [b], c2),
    ]);
    expect((await loyalty(c))["Cartão Corte"]).toEqual({ points: 0, rewards: 1 });
  });
});

describe("recompensas", () => {
  it("ajuste manual exige motivo e fica auditado", async () => {
    const c = await createCustomer(db.su);
    expect((await errorOf(asAdmin("public.admin_adjust_loyalty($1, $2, 3, '')", [c, cat.ruleCorte]))).hint).toBe("motivo_obrigatorio");
    await asAdmin("public.admin_adjust_loyalty($1, $2, 3, 'Atendimentos antes do sistema')", [c, cat.ruleCorte]);
    const { rows } = await db.su.query("select action from public.audit_logs where entity_id = $1", [c]);
    expect(rows.map((r) => r.action)).toContain("ajuste_fidelidade");
  });

  it("cortesia agendada: não gera pontos e é consumida uma vez ao concluir", async () => {
    const { c, reward } = await customerWithReward();
    const appt = await book(c, "corte-classico", 4, "09:00", reward);
    const { rows: a } = await db.su.query("select is_reward from public.appointments where id = $1", [appt.id]);
    expect(a[0].is_reward).toBe(true);
    expect((await db.su.query("select status from public.loyalty_rewards where id = $1", [reward])).rows[0].status).toBe("reservado");

    // o atendimento acontece e o dono conclui
    await db.su.query("update public.appointments set starts_at = now() - interval '2 hours', ends_at = now() - interval '80 minutes' where id = $1", [appt.id]);
    await asAdmin("public.admin_update_status($1, 'concluido')", [appt.id]);
    expect((await db.su.query("select status from public.loyalty_rewards where id = $1", [reward])).rows[0].status).toBe("resgatado");
    expect((await loyalty(c))["Cartão Corte"]).toEqual({ points: 0, rewards: 0 });

    expect((await errorOf(book(c, "corte-classico", 5, "09:00", reward))).hint).toBe("recompensa_indisponivel");
  });

  it("cortesia no balcão (registrar atendimento já com a cortesia) vira resgatada na hora", async () => {
    const { c, reward } = await customerWithReward();
    await visit(c, "corte-classico", "concluido", reward);
    expect((await db.su.query("select status from public.loyalty_rewards where id = $1", [reward])).rows[0].status).toBe("resgatado");
    expect((await loyalty(c))["Cartão Corte"]).toEqual({ points: 0, rewards: 0 });
  });

  it("dois registros simultâneos com a mesma cortesia: só um passa", async () => {
    const { c, reward } = await customerWithReward();
    const [c1, c2] = [await db.connect(), await db.connect()];
    const res = await Promise.allSettled([book(c, "corte-classico", 6, "09:00", reward, cat.barberB, c1), book(c, "corte-classico", 6, "14:00", reward, cat.barberB, c2)]);
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(((res.find((r) => r.status === "rejected") as PromiseRejectedResult).reason as { hint: string }).hint).toBe("recompensa_indisponivel");
  });

  it("cancelar devolve a cortesia; falta faz perder (regra configurável)", async () => {
    const { c, reward } = await customerWithReward();
    const appt = await book(c, "corte-classico", 7, "09:00", reward);
    await asAdmin("public.admin_update_status($1, 'cancelado', 'Cliente desmarcou')", [appt.id]);
    let { rows } = await db.su.query("select status, appointment_id from public.loyalty_rewards where id = $1", [reward]);
    expect(rows[0]).toEqual({ status: "disponivel", appointment_id: null });

    const appt2 = await visit(c, "corte-classico", "confirmado", reward);
    await asAdmin("public.admin_update_status($1, 'nao_compareceu')", [appt2]);
    ({ rows } = await db.su.query("select status from public.loyalty_rewards where id = $1", [reward]));
    expect(rows[0].status).toBe("perdido");
  });

  it("cortesia de corte não vale para combo nem para outro cliente", async () => {
    const { c, reward } = await customerWithReward();
    expect((await errorOf(book(c, "corte-barba", 8, "09:00", reward))).hint).toBe("recompensa_servico");
    const other = await createCustomer(db.su);
    expect((await errorOf(book(other, "corte-classico", 9, "09:00", reward))).hint).toBe("recompensa_invalida");
    expect((await errorOf(asAdmin("public.admin_create_appointment('corte-classico', $1, $2, null, 'Avulso', null, 'confirmado', null, false, $3)", [
      cat.barberA, await at(db.su, await localDay(db.su, 9), "10:00"), reward,
    ]))).hint).toBe("recompensa_invalida");
  });

  it("cancelar cortesia devolve os pontos ao cartão", async () => {
    const { c, reward } = await customerWithReward();
    await asAdmin("public.admin_cancel_reward($1, 'Gerada por engano')", [reward]);
    expect((await loyalty(c))["Cartão Corte"]).toEqual({ points: 10, rewards: 0 });
  });
});

describe("desfazer o 10º atendimento depois da recompensa (política atual; decisão comercial pendente)", () => {
  it("a recompensa continua válida e o cartão fica devendo 1 ponto, sem gerar nova recompensa", async () => {
    const c = await createCustomer(db.su);
    for (let i = 0; i < 9; i++) await visit(c, "corte-classico");
    const tenth = await visit(c, "corte-classico");
    expect((await loyalty(c))["Cartão Corte"]).toEqual({ points: 0, rewards: 1 });

    await asAdmin("public.admin_update_status($1, 'confirmado', 'Lançado no cliente errado')", [tenth]);
    expect((await loyalty(c))["Cartão Corte"]).toEqual({ points: -1, rewards: 1 });
    const { rows } = await db.su.query("select status from public.loyalty_rewards where customer_id = $1", [c]);
    expect(rows.map((r) => r.status)).toEqual(["disponivel"]);

    await asAdmin("public.admin_update_status($1, 'concluido')", [tenth]);
    expect((await loyalty(c))["Cartão Corte"]).toEqual({ points: 0, rewards: 1 });
  });
});

describe("exclusão do cliente (LGPD)", () => {
  it("apaga cadastro, pontos e cortesias; cancela horários futuros; agenda e auditoria ficam sem identificação", async () => {
    const c = await createCustomer(db.su, { name: "Pessoa Remover" });
    await asAdmin("public.admin_adjust_loyalty($1, $2, 10, 'Migração de cartão de papel')", [c, cat.ruleCorte]);
    const past = await visit(c, "corte-barba");
    await db.su.query("update public.appointments set notes = 'Prefere máquina 2' where id = $1", [past]);
    const future = await book(c, "barba", 10, "09:00");
    expect((await errorOf(asAdmin("public.admin_delete_customer($1, '')", [c]))).hint).toBe("motivo_obrigatorio");
    await asAdmin("public.admin_delete_customer($1, 'Pedido do titular pelo WhatsApp')", [c]);
    const left = await db.su.query(
      `select (select count(*)::int from public.customers where id = $1) as clientes,
              (select count(*)::int from public.loyalty_entries where customer_id = $1) as lancamentos,
              (select count(*)::int from public.loyalty_rewards where customer_id = $1) as cortesias,
              (select customer_id from public.appointments where id = $2) as cliente_do_horario,
              (select notes from public.appointments where id = $2) as observacoes,
              (select status::text from public.appointments where id = $3) as futuro`,
      [c, past, future.id],
    );
    expect(left.rows[0]).toEqual({ clientes: 0, lancamentos: 0, cortesias: 0, cliente_do_horario: null, observacoes: null, futuro: "cancelado" });
    const { rows } = await db.su.query("select action from public.audit_logs where entity_id = $1::text", [c]);
    expect(rows.map((r) => r.action)).toContain("excluir_cliente");
    // fora da exclusão em cascata, o livro-razão continua imutável
    await expect(db.su.query("delete from public.loyalty_entries")).rejects.toThrow(/imutável/);
  });
});
