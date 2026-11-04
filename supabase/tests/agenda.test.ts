import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, at, createTestDb, createUser, errorOf, localDay, makeAdmin, seedCatalog, uuid, type TestDb } from "./support/db";

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

const request = (userId: string, service: string, start: string, opts: { barber?: string | null; key?: string; reward?: string | null } = {}) =>
  as<{ r: { id: string; protocol: string; status: string; repetida: boolean } }>(
    db.su,
    { role: "authenticated", userId },
    "select public.request_appointment($1, $2, $3, $4, $5) as r",
    [service, start, opts.key ?? uuid(), opts.barber ?? null, opts.reward ?? null],
  ).then((rows) => rows[0]!.r);

describe("disponibilidade", () => {
  it("respeita expediente, intervalo e duração do serviço", async () => {
    const list = await slots("corte-classico", day, cat.barberA);
    const times = list.map((s) => s.start);
    expect(times[0]).toBe(await at(db.su, day, "09:00"));
    // 40 min: 11:15 termina 11:55 (ok); 11:30 terminaria 12:10, dentro do intervalo
    expect(times).toContain(await at(db.su, day, "11:15"));
    expect(times).not.toContain(await at(db.su, day, "11:30"));
    expect(times).not.toContain(await at(db.su, day, "12:00"));
    expect(times).toContain(await at(db.su, day, "13:00"));
    // último horário que termina até 18:00
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
});

describe("solicitação de agendamento", () => {
  it("cria PENDENTE com protocolo e o horário deixa de aparecer", async () => {
    const user = await createUser(db.su);
    const start = await at(db.su, day, "09:00");
    const r = await request(user, "corte-classico", start, { barber: cat.barberA });
    expect(r.status).toBe("pendente");
    expect(r.protocol).toMatch(/^[2-9A-Z]{6}$/);
    const after = await slots("corte-classico", day, cat.barberA);
    expect(after.map((s) => s.start)).not.toContain(start);
  });

  it("clique repetido (mesma chave) não duplica", async () => {
    const user = await createUser(db.su);
    const key = uuid();
    const start = await at(db.su, day, "14:00");
    const first = await request(user, "barba", start, { barber: cat.barberA, key });
    const second = await request(user, "barba", start, { barber: cat.barberA, key });
    expect(second.id).toBe(first.id);
    expect(second.repetida).toBe(true);
    const { rows } = await db.su.query("select count(*)::int as n from public.appointments where customer_id = $1", [user]);
    expect(rows[0].n).toBe(1);
  });

  it("recusa sobreposição com durações diferentes", async () => {
    const a = await createUser(db.su);
    const b = await createUser(db.su);
    await request(a, "corte-barba", await at(db.su, day, "15:00"), { barber: cat.barberB }); // 15:00–16:10
    const err = await errorOf(request(b, "barba", await at(db.su, day, "15:45"), { barber: cat.barberB }));
    expect(err.hint).toBe("ocupado");
  });

  it("recusa horário passado, sem antecedência, fora do expediente e no intervalo", async () => {
    const user = await createUser(db.su);
    const today = await localDay(db.su, 0);
    expect((await errorOf(request(user, "barba", await at(db.su, await localDay(db.su, -1), "10:00"), { barber: cat.barberA }))).hint).toBe("passado");
    const soon = new Date(Date.now() + 30 * 60_000).toISOString();
    expect(["antecedencia", "fora_expediente", "intervalo", "passado"]).toContain(
      (await errorOf(request(user, "barba", soon, { barber: cat.barberA }))).hint,
    );
    expect((await errorOf(request(user, "barba", await at(db.su, day, "20:00"), { barber: cat.barberA }))).hint).toBe("fora_expediente");
    expect((await errorOf(request(user, "barba", await at(db.su, day, "12:15"), { barber: cat.barberA }))).hint).toBe("intervalo");
    expect(today).toBeTruthy();
  });

  it("exige e-mail confirmado", async () => {
    const user = await createUser(db.su, { confirmed: false });
    expect((await errorOf(request(user, "barba", await at(db.su, day, "16:30"), { barber: cat.barberA }))).hint).toBe("email_nao_confirmado");
  });

  it("limita solicitações em aberto por conta (anti-spam)", async () => {
    const user = await createUser(db.su);
    const d = await localDay(db.su, 3);
    for (const t of ["09:00", "10:00", "11:00"]) await request(user, "barba", await at(db.su, d, t), { barber: cat.barberA });
    expect((await errorOf(request(user, "barba", await at(db.su, d, "13:00"), { barber: cat.barberA }))).hint).toBe("limite_ativos");
  });

  it("sem preferência de profissional escolhe um livre", async () => {
    const d = await localDay(db.su, 4);
    const start = await at(db.su, d, "10:00");
    const u1 = await createUser(db.su);
    const u2 = await createUser(db.su);
    const r1 = await request(u1, "barba", start);
    const r2 = await request(u2, "barba", start);
    const { rows } = await db.su.query("select barber_id from public.appointments where id = any($1)", [[r1.id, r2.id]]);
    expect(new Set(rows.map((r) => r.barber_id)).size).toBe(2);
    const u3 = await createUser(db.su);
    expect((await errorOf(request(u3, "barba", start))).hint).toBe("ocupado");
  });
});

describe("concorrência", () => {
  it("duas pessoas ao mesmo tempo no mesmo horário: exatamente uma consegue", async () => {
    const d = await localDay(db.su, 5);
    const start = await at(db.su, d, "16:00");
    const [c1, c2] = [await db.connect(), await db.connect()];
    const [u1, u2] = [await createUser(db.su), await createUser(db.su)];
    const call = (c: typeof c1, u: string) =>
      as(c, { role: "authenticated", userId: u }, "select public.request_appointment('corte-classico', $1, $2, $3) as r", [start, uuid(), cat.barberA]);
    const results = await Promise.allSettled([call(c1, u1), call(c2, u2)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect((rejected.reason as { hint?: string }).hint).toBe("ocupado");
  });

  it("10 tentativas simultâneas com durações diferentes: nenhuma sobreposição", async () => {
    const d = await localDay(db.su, 6);
    const clients = await Promise.all(Array.from({ length: 10 }, () => db.connect()));
    const users = await Promise.all(clients.map(() => createUser(db.su)));
    const services = ["corte-classico", "degrade", "barba", "corte-barba"];
    const times = ["09:00", "09:15", "09:30", "09:45", "10:00"];
    await Promise.allSettled(
      clients.map(async (c, i) =>
        as(c, { role: "authenticated", userId: users[i]! }, "select public.request_appointment($1, $2, $3, $4)", [
          services[i % services.length],
          await at(db.su, d, times[i % times.length]!),
          uuid(),
          cat.barberB,
        ]),
      ),
    );
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
  const adminCall = <T = unknown>(sql: string, params: unknown[] = []) =>
    as<{ r: T }>(db.su, { role: "authenticated", userId: admin }, `select ${sql} as r`, params).then((rows) => rows[0]!.r);

  it("confirma, e cliente não pode confirmar", async () => {
    const user = await createUser(db.su);
    const r = await request(user, "barba", await at(db.su, await localDay(db.su, 7), "09:00"), { barber: cat.barberA });
    expect(
      (await errorOf(as(db.su, { role: "authenticated", userId: user }, "select public.admin_update_status($1, 'confirmado')", [r.id]))).hint,
    ).toBe("sem_permissao");
    await adminCall("public.admin_update_status($1, 'confirmado')", [r.id]);
    const { rows } = await db.su.query("select status from public.appointments where id = $1", [r.id]);
    expect(rows[0].status).toBe("confirmado");
  });

  it("mudar expediente com agendamento existente: mostra conflito, só salva com decisão", async () => {
    const d = await localDay(db.su, 8);
    const user = await createUser(db.su);
    const r = await request(user, "barba", await at(db.su, d, "17:00"), { barber: cat.barberA });
    const days = Array.from({ length: 7 }, (_, w) => ({ weekday: w, start: "09:00", end: "16:00" }));

    const check = await adminCall<{ saved: boolean; conflicts: { id: string }[] }>("public.admin_save_schedule($1, $2, 'verificar')", [
      cat.barberA,
      JSON.stringify(days),
    ]);
    expect(check.saved).toBe(false);
    expect(check.conflicts.map((c) => c.id)).toContain(r.id);
    // nada mudou: 17:00 ainda é expediente para outros dias
    const { rows: still } = await db.su.query("select end_time from public.barber_schedules where barber_id = $1 limit 1", [cat.barberA]);
    expect(still[0].end_time).toBe("18:00:00");

    const keep = await adminCall<{ saved: boolean }>("public.admin_save_schedule($1, $2, 'manter')", [cat.barberA, JSON.stringify(days)]);
    expect(keep.saved).toBe(true);
    const { rows } = await db.su.query("select status from public.appointments where id = $1", [r.id]);
    expect(rows[0].status).toBe("pendente"); // mantido, sem cancelamento silencioso
    // a agenda pública reflete na hora: nada depois de 16:00
    const list = await slots("barba", await localDay(db.su, 9), cat.barberA);
    expect(list.at(-1)!.start).toBe(await at(db.su, await localDay(db.su, 9), "15:30"));

    // restaura o expediente padrão para os próximos testes
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
    const user = await createUser(db.su);
    const r = await request(user, "barba", await at(db.su, d, "10:00"), { barber: cat.barberB });
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

  it("pendente expirado libera o horário", async () => {
    const d = await localDay(db.su, 13);
    const start = await at(db.su, d, "09:00");
    const u1 = await createUser(db.su);
    const r = await request(u1, "barba", start, { barber: cat.barberA });
    await db.su.query("update public.appointments set created_at = now() - interval '25 hours' where id = $1", [r.id]);
    expect((await slots("barba", d, cat.barberA)).map((s) => s.start)).toContain(start);
    const u2 = await createUser(db.su);
    await request(u2, "barba", start, { barber: cat.barberA });
    const { rows } = await db.su.query("select status from public.appointments where id = $1", [r.id]);
    expect(rows[0].status).toBe("expirado");
  });

  it("cliente cancela e reagenda o próprio horário", async () => {
    const d = await localDay(db.su, 14);
    const user = await createUser(db.su);
    const r = await request(user, "barba", await at(db.su, d, "09:00"), { barber: cat.barberA });
    const moved = await as<{ r: { id: string } }>(db.su, { role: "authenticated", userId: user },
      "select public.reschedule_my_appointment($1, $2, $3) as r", [r.id, await at(db.su, d, "10:00"), uuid()]);
    const { rows } = await db.su.query("select id, status from public.appointments where customer_id = $1 order by created_at", [user]);
    expect(rows.map((x) => x.status)).toEqual(["cancelado", "pendente"]);
    await as(db.su, { role: "authenticated", userId: user }, "select public.cancel_my_appointment($1)", [moved[0]!.r.id]);
    const other = await createUser(db.su);
    expect(
      (await errorOf(as(db.su, { role: "authenticated", userId: other }, "select public.cancel_my_appointment($1)", [r.id]))).hint,
    ).toBe("nao_encontrado");
  });

  it("histórico de status é registrado", async () => {
    const user = await createUser(db.su);
    const r = await request(user, "barba", await at(db.su, await localDay(db.su, 15), "09:00"), { barber: cat.barberA });
    await adminCall("public.admin_update_status($1, 'cancelado', 'Cliente avisou')", [r.id]);
    const { rows } = await db.su.query("select from_status, to_status, reason from public.appointment_status_history where appointment_id = $1 order by id", [r.id]);
    expect(rows).toEqual([
      { from_status: null, to_status: "pendente", reason: null },
      { from_status: "pendente", to_status: "cancelado", reason: "Cliente avisou" },
    ]);
  });
});
