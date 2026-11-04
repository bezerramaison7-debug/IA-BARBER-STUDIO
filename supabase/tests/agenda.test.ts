import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, at, createCustomer, createTestDb, createUser, errorOf, localDay, makeAdmin, seedCatalog, uuid, type TestDb } from "./support/db";

let db: TestDb;
let cat: Awaited<ReturnType<typeof seedCatalog>>;
let admin: string;
let day: string; // depois de amanhã: livre das regras de antecedência

beforeAll(async () => {
  db = await createTestDb();
  cat = await seedCatalog(db.su);
  admin = await createUser(db.su, { name: "Admin Teste" });
  await makeAdmin(db.su, admin);
  day = await localDay(db.su, 2);
});
afterAll(async () => db?.drop());

const slots = async (service: string, d: string, barber: string | null = null) =>
  (
    await as<{ slot_start: Date; barber_id: string }>(db.su, { role: "anon" }, "select * from public.available_slots($1, $2, $3)", [
      service,
      d,
      barber,
    ])
  ).map((r) => ({ start: r.slot_start.toISOString(), barber: r.barber_id }));

const adminCall = <T = unknown>(sql: string, params: unknown[] = [], client = db.su) =>
  as<{ r: T }>(client, { role: "authenticated", userId: admin }, `select ${sql} as r`, params).then((rows) => rows[0]!.r);

/** Registro de agendamento pelo painel (pedido recebido pelo WhatsApp). */
const book = (service: string, start: string, barber: string, opts: { customer?: string | null; key?: string; status?: string; client?: TestDb["su"] } = {}) =>
  adminCall<{ id: string; protocol: string; repetida: boolean }>(
    "public.admin_create_appointment($1, $2, $3, $4, $7, null, $5, null, false, null, $6)",
    [service, barber, start, opts.customer ?? null, opts.status ?? "confirmado", opts.key ?? null, opts.customer ? null : "Cliente Avulso"],
    opts.client,
  );

describe("disponibilidade pública", () => {
  it("respeita expediente, intervalo e duração do serviço", async () => {
    const list = await slots("corte-classico", day, cat.barberA);
    const times = list.map((s) => s.start);
    expect(times[0]).toBe(await at(db.su, day, "09:00"));
    // 40 min: 11:15 termina 11:55 (ok); 11:30 terminaria 12:10, dentro do intervalo
    expect(times).toContain(await at(db.su, day, "11:15"));
    expect(times).not.toContain(await at(db.su, day, "11:30"));
    expect(times).not.toContain(await at(db.su, day, "12:00"));
    expect(times).toContain(await at(db.su, day, "13:00"));
    expect(times.at(-1)).toBe(await at(db.su, day, "17:15"));
  });

  it("não oferece dias passados nem além do limite futuro", async () => {
    expect(await slots("corte-classico", await localDay(db.su, -1))).toEqual([]);
    expect(await slots("corte-classico", await localDay(db.su, 31))).toEqual([]);
  });

  it("dia sem expediente do profissional não tem horários", async () => {
    const { rows } = await db.su.query<{ dow: number }>("select extract(dow from $1::date)::int as dow", [day]);
    await db.su.query("delete from public.barber_schedules where barber_id = $1 and weekday = $2", [cat.barberB, rows[0]!.dow]);
    expect(await slots("barba", day, cat.barberB)).toEqual([]);
    expect((await slots("barba", day)).every((s) => s.barber === cat.barberA)).toBe(true);
    await db.su.query(
      "insert into public.barber_schedules (barber_id, weekday, start_time, end_time, break_start, break_end) values ($1, $2, '09:00', '18:00', '12:00', '13:00')",
      [cat.barberB, rows[0]!.dow],
    );
  });

  it("a consulta pública não revela quem agendou", async () => {
    const customer = await createCustomer(db.su, { name: "Cliente Sigiloso" });
    await book("barba", await at(db.su, await localDay(db.su, 16), "09:00"), cat.barberA, { customer });
    const rows = await as<Record<string, unknown>>(db.su, { role: "anon" }, "select * from public.available_slots('barba', $1, $2)", [
      await localDay(db.su, 16),
      cat.barberA,
    ]);
    expect(Object.keys(rows[0]!).sort()).toEqual(["barber_id", "barber_name", "slot_end", "slot_start"]);
  });
});

describe("registro de agendamento pelo painel", () => {
  it("cria CONFIRMADO com protocolo e o horário deixa de aparecer", async () => {
    const customer = await createCustomer(db.su);
    const start = await at(db.su, day, "09:00");
    const r = await book("corte-classico", start, cat.barberA, { customer });
    expect(r.protocol).toMatch(/^[2-9A-Z]{6}$/);
    const { rows } = await db.su.query("select status, customer_id from public.appointments where id = $1", [r.id]);
    expect(rows[0]).toEqual({ status: "confirmado", customer_id: customer });
    expect((await slots("corte-classico", day, cat.barberA)).map((s) => s.start)).not.toContain(start);
  });

  it("clique repetido (mesma chave) não duplica", async () => {
    const key = uuid();
    const start = await at(db.su, day, "14:00");
    const first = await book("barba", start, cat.barberA, { key });
    const second = await book("barba", start, cat.barberA, { key });
    expect(second).toMatchObject({ id: first.id, repetida: true });
    const { rows } = await db.su.query("select count(*)::int as n from public.appointments where request_key = $1", [key]);
    expect(rows[0].n).toBe(1);
  });

  it("recusa sobreposição com durações diferentes", async () => {
    await book("corte-barba", await at(db.su, day, "15:00"), cat.barberB); // 15:00–16:10
    expect((await errorOf(book("barba", await at(db.su, day, "15:45"), cat.barberB))).hint).toBe("ocupado");
  });

  it("recusa horário passado, fora do expediente e no intervalo (sem forçar)", async () => {
    expect((await errorOf(book("barba", await at(db.su, await localDay(db.su, -1), "10:00"), cat.barberA))).hint).toBe("passado");
    expect((await errorOf(book("barba", await at(db.su, day, "20:00"), cat.barberA))).hint).toBe("fora_expediente");
    expect((await errorOf(book("barba", await at(db.su, day, "12:15"), cat.barberA))).hint).toBe("intervalo");
  });

  it("exige cliente cadastrado ou nome avulso, e recusa cliente inexistente", async () => {
    expect((await errorOf(adminCall("public.admin_create_appointment('barba', $1, $2)", [cat.barberA, await at(db.su, day, "16:30")]))).hint).toBe(
      "cliente_obrigatorio",
    );
    expect((await errorOf(book("barba", await at(db.su, day, "16:30"), cat.barberA, { customer: uuid() }))).hint).toBe("nao_encontrado");
    const guest = await adminCall<{ id: string }>("public.admin_create_appointment('barba', $1, $2, null, 'Visitante Avulso', '(16) 99583-0000')", [
      cat.barberA,
      await at(db.su, day, "16:30"),
    ]);
    const { rows } = await db.su.query("select guest_name, guest_phone from public.appointments where id = $1", [guest.id]);
    expect(rows[0]).toEqual({ guest_name: "Visitante Avulso", guest_phone: "16995830000" });
  });
});

describe("concorrência", () => {
  it("dois registros ao mesmo tempo no mesmo horário: exatamente um passa", async () => {
    const start = await at(db.su, await localDay(db.su, 5), "16:00");
    const [c1, c2] = [await db.connect(), await db.connect()];
    const results = await Promise.allSettled([
      book("corte-classico", start, cat.barberA, { client: c1 }),
      book("corte-classico", start, cat.barberA, { client: c2 }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason as { hint?: string }).hint).toBe("ocupado");
  });

  it("10 tentativas simultâneas com durações diferentes: nenhuma sobreposição", async () => {
    const d = await localDay(db.su, 6);
    const clients = await Promise.all(Array.from({ length: 10 }, () => db.connect()));
    const services = ["corte-classico", "degrade", "barba", "corte-barba"];
    const starts: string[] = [];
    for (const t of ["09:00", "09:15", "09:30", "09:45", "10:00"]) starts.push(await at(db.su, d, t));
    await Promise.allSettled(clients.map((c, i) => book(services[i % services.length]!, starts[i % starts.length]!, cat.barberB, { client: c })));
    const { rows } = await db.su.query(
      `select count(*)::int as n from public.appointments a join public.appointments b
         on a.id < b.id and a.barber_id = b.barber_id
        and tstzrange(a.starts_at, a.ends_at) && tstzrange(b.starts_at, b.ends_at)
        and a.status in ('pendente','confirmado') and b.status in ('pendente','confirmado')`,
    );
    expect(rows[0].n).toBe(0);
  });
});

describe("administração da agenda", () => {
  it("pendente → confirmado; conta sem acesso não confirma", async () => {
    const other = await createUser(db.su);
    const r = await book("barba", await at(db.su, await localDay(db.su, 7), "09:00"), cat.barberA, { status: "pendente" });
    expect(
      (await errorOf(as(db.su, { role: "authenticated", userId: other }, "select public.admin_update_status($1, 'confirmado')", [r.id]))).hint,
    ).toBe("sem_permissao");
    await adminCall("public.admin_update_status($1, 'confirmado')", [r.id]);
    const { rows } = await db.su.query("select status from public.appointments where id = $1", [r.id]);
    expect(rows[0].status).toBe("confirmado");
    expect((await slots("barba", await localDay(db.su, 7), cat.barberA)).map((x) => x.start)).not.toContain(
      await at(db.su, await localDay(db.su, 7), "09:00"),
    );
  });

  it("mudar expediente com agendamento existente: mostra conflito, só salva com decisão", async () => {
    const d = await localDay(db.su, 8);
    const r = await book("barba", await at(db.su, d, "17:00"), cat.barberA);
    const days = Array.from({ length: 7 }, (_, w) => ({ weekday: w, start: "09:00", end: "16:00" }));

    const check = await adminCall<{ saved: boolean; conflicts: { id: string }[] }>("public.admin_save_schedule($1, $2, 'verificar')", [
      cat.barberA,
      JSON.stringify(days),
    ]);
    expect(check.saved).toBe(false);
    expect(check.conflicts.map((c) => c.id)).toContain(r.id);
    const { rows: still } = await db.su.query("select end_time from public.barber_schedules where barber_id = $1 limit 1", [cat.barberA]);
    expect(still[0].end_time).toBe("18:00:00");

    const keep = await adminCall<{ saved: boolean }>("public.admin_save_schedule($1, $2, 'manter')", [cat.barberA, JSON.stringify(days)]);
    expect(keep.saved).toBe(true);
    const { rows } = await db.su.query("select status from public.appointments where id = $1", [r.id]);
    expect(rows[0].status).toBe("confirmado"); // mantido, sem cancelamento silencioso
    const list = await slots("barba", await localDay(db.su, 9), cat.barberA);
    expect(list.at(-1)!.start).toBe(await at(db.su, await localDay(db.su, 9), "15:30"));

    await adminCall("public.admin_save_schedule($1, $2, 'manter')", [
      cat.barberA,
      JSON.stringify(Array.from({ length: 7 }, (_, w) => ({ weekday: w, start: "09:00", end: "18:00", break_start: "12:00", break_end: "13:00" }))),
    ]);
  });

  it("recusa expediente inválido", async () => {
    const err = await errorOf(adminCall("public.admin_save_schedule($1, $2, 'manter')", [cat.barberA, JSON.stringify([{ weekday: 1, start: "18:00", end: "09:00" }])]));
    expect(err.hint).toBe("dados_invalidos");
  });

  it("bloqueio remove horários e respeita a decisão sobre conflitos", async () => {
    const d = await localDay(db.su, 10);
    const r = await book("barba", await at(db.su, d, "10:00"), cat.barberB);
    const from = await at(db.su, d, "09:00");
    const to = await at(db.su, d, "12:00");
    const check = await adminCall<{ saved: boolean }>("public.admin_add_exception($1, $2, $3, 'bloqueio', 'Curso', 'verificar')", [cat.barberB, from, to]);
    expect(check.saved).toBe(false);
    const cancel = await adminCall<{ saved: boolean }>("public.admin_add_exception($1, $2, $3, 'bloqueio', 'Curso', 'cancelar')", [cat.barberB, from, to]);
    expect(cancel.saved).toBe(true);
    const { rows } = await db.su.query("select status from public.appointments where id = $1", [r.id]);
    expect(rows[0].status).toBe("cancelado");
    const list = (await slots("barba", d, cat.barberB)).map((s) => s.start);
    expect(list).not.toContain(await at(db.su, d, "10:00"));
    expect(list[0]).toBe(await at(db.su, d, "13:00"));
  });

  it("feriado para todos (profissional nulo) fecha o dia inteiro", async () => {
    const d = await localDay(db.su, 11);
    await adminCall("public.admin_add_exception(null, $1, $2, 'feriado', 'Feriado municipal', 'verificar')", [
      await at(db.su, d, "00:00"),
      await at(db.su, await localDay(db.su, 12), "00:00"),
    ]);
    expect(await slots("barba", d)).toEqual([]);
  });

  it("pendente sem resposta expira e libera o horário", async () => {
    const d = await localDay(db.su, 13);
    const start = await at(db.su, d, "09:00");
    const r = await book("barba", start, cat.barberA, { status: "pendente" });
    await db.su.query("update public.appointments set created_at = now() - interval '25 hours' where id = $1", [r.id]);
    expect((await slots("barba", d, cat.barberA)).map((s) => s.start)).toContain(start);
    await book("barba", start, cat.barberA);
    const { rows } = await db.su.query("select status from public.appointments where id = $1", [r.id]);
    expect(rows[0].status).toBe("expirado");
  });

  it("reagenda e cancela pelo painel", async () => {
    const d = await localDay(db.su, 14);
    const r = await book("barba", await at(db.su, d, "09:00"), cat.barberA);
    await adminCall("public.admin_reschedule($1, $2)", [r.id, await at(db.su, d, "10:00")]);
    const { rows } = await db.su.query("select starts_at from public.appointments where id = $1", [r.id]);
    expect(rows[0].starts_at.toISOString()).toBe(await at(db.su, d, "10:00"));
    await adminCall("public.admin_update_status($1, 'cancelado', 'Cliente avisou')", [r.id]);
    expect((await slots("barba", d, cat.barberA)).map((s) => s.start)).toContain(await at(db.su, d, "10:00"));
  });

  it("histórico de status é registrado", async () => {
    const r = await book("barba", await at(db.su, await localDay(db.su, 15), "09:00"), cat.barberA, { status: "pendente" });
    await adminCall("public.admin_update_status($1, 'cancelado', 'Cliente avisou')", [r.id]);
    const { rows } = await db.su.query("select from_status, to_status, reason from public.appointment_status_history where appointment_id = $1 order by id", [r.id]);
    expect(rows.map((x) => [x.from_status, x.to_status])).toEqual([
      [null, "confirmado"],
      ["confirmado", "pendente"],
      ["pendente", "cancelado"],
    ]);
    expect(rows.at(-1)!.reason).toBe("Cliente avisou");
  });
});
