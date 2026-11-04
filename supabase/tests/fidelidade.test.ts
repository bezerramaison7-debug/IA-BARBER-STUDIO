import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, at, createTestDb, createUser, errorOf, localDay, makeAdmin, seedCatalog, uuid, type TestDb } from "./support/db";

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
const asUser = <T = unknown>(userId: string, sql: string, params: unknown[] = []) =>
  as<{ r: T }>(db.su, { role: "authenticated", userId }, `select ${sql} as r`, params).then((rows) => rows[0]!.r);

/** Horário passado único (registro retroativo pela administração). */
async function nextPastStart() {
  const i = pastSlot++;
  return at(db.su, await localDay(db.su, -1 - Math.floor(i / 8)), `${String(6 + (i % 8) * 2).padStart(2, "0")}:00`);
}

/** Registra um atendimento já realizado e devolve o id. */
async function visit(customer: string, service: string, status: "concluido" | "confirmado" = "concluido") {
  const r = await asAdmin<{ id: string }>("public.admin_create_appointment($1, $2, $3, $4, null, null, $5, null, true)", [
    service,
    cat.barberA,
    await nextPastStart(),
    customer,
    status,
  ]);
  return r.id;
}

const loyalty = async (customer: string) => {
  const rows = await as<{ name: string; points: number; available_rewards: number }>(
    db.su,
    { role: "authenticated", userId: customer },
    "select name, points, available_rewards from public.my_loyalty()",
  );
  return Object.fromEntries(rows.map((r) => [r.name, { points: r.points, rewards: r.available_rewards }]));
};

describe("contagem", () => {
  it("10 cortes concluídos geram 1 corte grátis; os cartões são separados", async () => {
    const c = await createUser(db.su);
    for (let i = 0; i < 9; i++) await visit(c, i % 2 ? "degrade" : "corte-classico");
    await visit(c, "corte-barba");
    expect(await loyalty(c)).toEqual({
      "Cartão Corte": { points: 9, rewards: 0 },
      "Cartão Cabelo + Barba": { points: 1, rewards: 0 },
    });
    await visit(c, "corte-classico"); // 10º corte
    expect((await loyalty(c))["Cartão Corte"]).toEqual({ points: 0, rewards: 1 });
  });

  it("serviço fora do programa não pontua", async () => {
    const c = await createUser(db.su);
    await visit(c, "barba");
    expect((await loyalty(c))["Cartão Corte"].points).toBe(0);
  });

  it("falta e cancelamento não pontuam", async () => {
    const c = await createUser(db.su);
    const a = await visit(c, "corte-classico", "confirmado");
    await asAdmin("public.admin_update_status($1, 'nao_compareceu')", [a]);
    const b = await visit(c, "corte-classico", "confirmado");
    await asAdmin("public.admin_update_status($1, 'cancelado')", [b]);
    expect((await loyalty(c))["Cartão Corte"].points).toBe(0);
  });

  it("concluir duas vezes não conta em dobro; desfazer estorna; refazer conta de novo uma vez", async () => {
    const c = await createUser(db.su);
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

  it("não é possível concluir um horário futuro (evita pontos antecipados)", async () => {
    const c = await createUser(db.su);
    const r = await asUser<{ id: string }>(c, "public.request_appointment('corte-classico', $1, $2, $3)", [
      await at(db.su, await localDay(db.su, 3), "09:00"),
      uuid(),
      cat.barberA,
    ]);
    await asAdmin("public.admin_update_status($1, 'confirmado')", [r.id]);
    expect((await errorOf(asAdmin("public.admin_update_status($1, 'concluido')", [r.id]))).hint).toBe("conclusao_futura");
  });

  it("conclusões simultâneas no 10º ponto geram uma única recompensa", async () => {
    const c = await createUser(db.su);
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
  async function customerWithReward() {
    const c = await createUser(db.su);
    await asAdmin("public.admin_adjust_loyalty($1, $2, 10, 'Migração de cartão de papel')", [c, cat.ruleCorte]);
    const { rows } = await db.su.query("select id from public.loyalty_rewards where customer_id = $1 and status = 'disponivel'", [c]);
    return { c, reward: rows[0].id as string };
  }

  it("ajuste manual exige motivo e fica auditado", async () => {
    const c = await createUser(db.su);
    expect((await errorOf(asAdmin("public.admin_adjust_loyalty($1, $2, 3, '')", [c, cat.ruleCorte]))).hint).toBe("motivo_obrigatorio");
    await asAdmin("public.admin_adjust_loyalty($1, $2, 3, 'Atendimentos antes do sistema')", [c, cat.ruleCorte]);
    const { rows } = await db.su.query("select action from public.audit_logs where entity_id = $1", [c]);
    expect(rows.map((r) => r.action)).toContain("ajuste_fidelidade");
  });

  it("agendamento com recompensa é cortesia: não gera pontos e a recompensa é consumida uma vez", async () => {
    const { c, reward } = await customerWithReward();
    const appt = await asUser<{ id: string }>(c, "public.request_appointment('corte-classico', $1, $2, $3, $4)", [
      await at(db.su, await localDay(db.su, 4), "09:00"),
      uuid(),
      cat.barberA,
      reward,
    ]);
    const { rows: a } = await db.su.query("select is_reward from public.appointments where id = $1", [appt.id]);
    expect(a[0].is_reward).toBe(true);

    // simula o atendimento já ocorrido e conclui
    await db.su.query("update public.appointments set starts_at = now() - interval '2 hours', ends_at = now() - interval '80 minutes' where id = $1", [appt.id]);
    await asAdmin("public.admin_update_status($1, 'confirmado')", [appt.id]).catch(() => {});
    await db.su.query("select set_config('app.status_reason', '', false)");
    await db.su.query("update public.appointments set status = 'confirmado' where id = $1 and status = 'pendente'", [appt.id]);
    await asAdmin("public.admin_update_status($1, 'concluido')", [appt.id]);

    const { rows: w } = await db.su.query("select status from public.loyalty_rewards where id = $1", [reward]);
    expect(w[0].status).toBe("resgatado");
    expect((await loyalty(c))["Cartão Corte"]).toEqual({ points: 0, rewards: 0 });

    const again = await errorOf(
      asUser(c, "public.request_appointment('corte-classico', $1, $2, $3, $4)", [await at(db.su, await localDay(db.su, 5), "09:00"), uuid(), cat.barberA, reward]),
    );
    expect(again.hint).toBe("recompensa_indisponivel");
  });

  it("duas reservas simultâneas com a mesma recompensa: só uma passa", async () => {
    const { c, reward } = await customerWithReward();
    const d = await localDay(db.su, 6);
    const [c1, c2] = [await db.connect(), await db.connect()];
    const call = async (client: typeof c1, time: string) =>
      as(client, { role: "authenticated", userId: c }, "select public.request_appointment('corte-classico', $1, $2, $3, $4)", [
        await at(db.su, d, time),
        uuid(),
        cat.barberB,
        reward,
      ]);
    const res = await Promise.allSettled([call(c1, "09:00"), call(c2, "14:00")]);
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(((res.find((r) => r.status === "rejected") as PromiseRejectedResult).reason as { hint: string }).hint).toBe("recompensa_indisponivel");
  });

  it("cancelar devolve a recompensa; falta faz perder (regra configurável)", async () => {
    const { c, reward } = await customerWithReward();
    const appt = await asUser<{ id: string }>(c, "public.request_appointment('corte-classico', $1, $2, $3, $4)", [
      await at(db.su, await localDay(db.su, 7), "09:00"),
      uuid(),
      cat.barberA,
      reward,
    ]);
    await asUser(c, "public.cancel_my_appointment($1)", [appt.id]);
    let { rows } = await db.su.query("select status, appointment_id from public.loyalty_rewards where id = $1", [reward]);
    expect(rows[0]).toEqual({ status: "disponivel", appointment_id: null });

    const appt2 = await visit(c, "corte-classico", "confirmado");
    await db.su.query("update public.appointments set is_reward = true where id = $1", [appt2]);
    await db.su.query("update public.loyalty_rewards set status = 'reservado', appointment_id = $1 where id = $2", [appt2, reward]);
    await asAdmin("public.admin_update_status($1, 'nao_compareceu')", [appt2]);
    ({ rows } = await db.su.query("select status from public.loyalty_rewards where id = $1", [reward]));
    expect(rows[0].status).toBe("perdido");
  });

  it("recompensa de corte não vale para combo", async () => {
    const { c, reward } = await customerWithReward();
    const err = await errorOf(
      asUser(c, "public.request_appointment('corte-barba', $1, $2, $3, $4)", [await at(db.su, await localDay(db.su, 8), "09:00"), uuid(), cat.barberA, reward]),
    );
    expect(err.hint).toBe("recompensa_servico");
  });

  it("cliente não usa recompensa de outra pessoa", async () => {
    const { reward } = await customerWithReward();
    const other = await createUser(db.su);
    const err = await errorOf(
      asUser(other, "public.request_appointment('corte-classico', $1, $2, $3, $4)", [await at(db.su, await localDay(db.su, 9), "09:00"), uuid(), cat.barberA, reward]),
    );
    expect(err.hint).toBe("recompensa_invalida");
  });

  it("cancelar recompensa devolve os pontos ao cartão", async () => {
    const { c, reward } = await customerWithReward();
    await asAdmin("public.admin_cancel_reward($1, 'Gerada por engano')", [reward]);
    expect((await loyalty(c))["Cartão Corte"]).toEqual({ points: 10, rewards: 0 });
  });
});
