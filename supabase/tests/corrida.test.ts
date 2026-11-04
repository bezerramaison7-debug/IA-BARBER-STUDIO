import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  as,
  at,
  backendPid,
  blockedOrSettled,
  createTestDb,
  createUser,
  errorOf,
  localDay,
  makeAdmin,
  openTx,
  seedCatalog,
  uuid,
  type TestDb,
} from "./support/db";

// Corridas entre a administração da agenda e as solicitações. Cada cenário controla a ordem com
// transações abertas em conexões independentes e espera a trava de verdade (pg_stat_activity).

let db: TestDb;
let cat: Awaited<ReturnType<typeof seedCatalog>>;
let admin: string;

beforeAll(async () => {
  db = await createTestDb();
  cat = await seedCatalog(db.su);
  admin = await createUser(db.su, { name: "Admin Teste" });
  await makeAdmin(db.su, admin);
});
afterAll(async () => db?.drop());

const ADMIN = () => ({ role: "authenticated" as const, userId: admin });
const week = (start: string, end: string, extra: Record<string, string> = {}) =>
  JSON.stringify(Array.from({ length: 7 }, (_, w) => ({ weekday: w, start, end, ...extra })));
const FULL = week("09:00", "18:00", { break_start: "12:00", break_end: "13:00" });

const request = (client = db.su, userId: string, service: string, start: string, barber: string | null, key = uuid()) =>
  as<{ r: { id: string; repetida: boolean } }>(
    client,
    { role: "authenticated", userId },
    "select public.request_appointment($1, $2, $3, $4) as r",
    [service, start, key, barber],
  ).then((rows) => rows[0]!.r);

const adminCall = <T = unknown>(client: TestDb["su"], sql: string, params: unknown[] = []) =>
  as<{ r: T }>(client, ADMIN(), `select ${sql} as r`, params).then((rows) => rows[0]!.r);

async function restoreSchedules() {
  await adminCall(db.su, "public.admin_save_schedule(null, $1, 'manter')", [FULL]);
}

describe("administração × solicitação", () => {
  it("expediente reduzido pelo admin: a solicitação concorrente espera e é recusada com a regra nova", async () => {
    const [ca, cb] = [await db.connect(), await db.connect()];
    const pidB = await backendPid(cb);
    const user = await createUser(db.su);
    const d = await localDay(db.su, 3);
    const tx = await openTx(ca, ADMIN());
    await tx.query("select public.admin_save_schedule($1, $2, 'manter')", [cat.barberA, week("09:00", "16:00")]);

    const op = request(cb, user, "barba", await at(db.su, d, "17:00"), cat.barberA);
    expect(await blockedOrSettled(db.su, pidB, op)).toBe("bloqueada");
    await tx.commit();

    expect((await errorOf(op)).hint).toBe("fora_expediente");
    const { rows } = await db.su.query("select count(*)::int as n from public.appointments where customer_id = $1", [user]);
    expect(rows[0].n).toBe(0);
    await restoreSchedules();
  });

  it("solicitação em andamento: o admin espera e vê o novo agendamento como conflito", async () => {
    const [ca, cb] = [await db.connect(), await db.connect()];
    const pidA = await backendPid(ca);
    const user = await createUser(db.su);
    const d = await localDay(db.su, 4);
    const tx = await openTx(cb, { role: "authenticated", userId: user });
    const [{ r }] = await tx.query<{ r: { id: string } }>("select public.request_appointment('barba', $1, $2, $3) as r", [
      await at(db.su, d, "17:00"),
      uuid(),
      cat.barberA,
    ]);

    const op = adminCall<{ saved: boolean; conflicts: { id: string }[] }>(ca, "public.admin_save_schedule($1, $2, 'verificar')", [
      cat.barberA,
      week("09:00", "16:00"),
    ]);
    expect(await blockedOrSettled(db.su, pidA, op)).toBe("bloqueada");
    await tx.commit();

    const res = await op;
    expect(res.saved).toBe(false);
    expect(res.conflicts.map((c) => c.id)).toContain(r.id);
  });

  it("feriado para todos: trava todos os profissionais, inclusive na escolha 'sem preferência'", async () => {
    const [ca, cb, cc] = [await db.connect(), await db.connect(), await db.connect()];
    const pidB = await backendPid(cb);
    const [u1, u2] = [await createUser(db.su), await createUser(db.su)];
    const d = await localDay(db.su, 5);
    const tx = await openTx(ca, ADMIN());
    await tx.query("select public.admin_add_exception(null, $1, $2, 'feriado', 'Feriado', 'manter')", [
      await at(db.su, d, "00:00"),
      await at(db.su, await localDay(db.su, 6), "00:00"),
    ]);

    const onB = request(cb, u1, "barba", await at(db.su, d, "10:00"), cat.barberB);
    const anyone = errorOf(request(cc, u2, "barba", await at(db.su, d, "11:00"), null));
    expect(await blockedOrSettled(db.su, pidB, onB)).toBe("bloqueada");
    await tx.commit();

    expect((await errorOf(onB)).hint).toBe("bloqueado");
    // "sem preferência" escolhe antes da trava e confere de novo depois dela: recusado de qualquer forma
    expect(["bloqueado", "ocupado"]).toContain((await anyone).hint);
    const { rows } = await db.su.query("select count(*)::int as n from public.appointments where customer_id = any ($1)", [[u1, u2]]);
    expect(rows[0].n).toBe(0);
  });

  it("várias travas ao mesmo tempo (expediente global, reagendamento e cancelamento): sem deadlock", async () => {
    for (let round = 0; round < 3; round++) {
      const [c0, c1, c2, c3] = await Promise.all([db.connect(), db.connect(), db.connect(), db.connect()]);
      const pid1 = await backendPid(c1);
      const user = await createUser(db.su);
      const d = await localDay(db.su, 8 + round);
      const appt = await request(db.su, user, "barba", await at(db.su, d, "10:00"), cat.barberA);

      // segura todas as travas de profissional enquanto as outras operações se enfileiram
      const hold = await openTx(c0, ADMIN());
      await hold.query("select public.admin_add_exception(null, $1, $2, 'bloqueio', 'Reunião', 'manter')", [
        await at(db.su, await localDay(db.su, 20 + round), "09:00"),
        await at(db.su, await localDay(db.su, 20 + round), "10:00"),
      ]);
      const ops = [
        as(c1, { role: "authenticated", userId: user }, "select public.reschedule_my_appointment($1, $2, $3, $4)", [
          appt.id,
          await at(db.su, d, "15:00"),
          uuid(),
          cat.barberB,
        ]),
        adminCall(c2, "public.admin_save_schedule(null, $1, 'cancelar')", [week("13:00", "18:00")]),
        adminCall(c3, "public.admin_add_exception($1, $2, $3, 'bloqueio', 'Curso', 'cancelar')", [
          cat.barberB,
          await at(db.su, d, "09:00"),
          await at(db.su, d, "12:00"),
        ]),
      ];
      expect(await blockedOrSettled(db.su, pid1, ops[0]!)).toBe("bloqueada");
      await hold.commit();

      const results = await Promise.allSettled(ops);
      for (const r of results) {
        if (r.status === "rejected") expect((r.reason as { code?: string }).code).toBe("P0001"); // regra de negócio, nunca 40P01
      }
      await restoreSchedules();
    }
  });
});

describe("idempotência", () => {
  it.each([
    ["profissional escolhido", "barberA"],
    ["sem preferência", null],
  ] as const)("duas requisições simultâneas com a mesma chave (%s): um só agendamento e a mesma resposta", async (_, which) => {
    const [ca, cb] = [await db.connect(), await db.connect()];
    const pidB = await backendPid(cb);
    const user = await createUser(db.su);
    const key = uuid();
    const start = await at(db.su, await localDay(db.su, 12), which ? "09:00" : "14:00");
    const barber = which ? cat[which] : null;
    const tx = await openTx(ca, { role: "authenticated", userId: user });
    const [{ r: first }] = await tx.query<{ r: { id: string } }>("select public.request_appointment('barba', $1, $2, $3) as r", [
      start,
      key,
      barber,
    ]);

    const second = request(cb, user, "barba", start, barber, key);
    expect(await blockedOrSettled(db.su, pidB, second)).toBe("bloqueada");
    await tx.commit();

    expect(await second).toMatchObject({ id: first.id, repetida: true });
    const { rows } = await db.su.query("select count(*)::int as n from public.appointments where request_key = $1", [key]);
    expect(rows[0].n).toBe(1);
  });
});
