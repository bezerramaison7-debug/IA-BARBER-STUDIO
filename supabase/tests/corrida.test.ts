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

// Corridas entre mudanças de agenda e registros de agendamento (dois aparelhos no painel ao mesmo
// tempo). Cada cenário controla a ordem com transações abertas em conexões independentes e espera
// a trava de verdade (pg_stat_activity).

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
const CREATE = "select public.admin_create_appointment($1, $2, $3, null, 'Cliente Avulso', null, 'confirmado', null, false, null, $4) as r";

const book = (client: TestDb["su"], service: string, start: string, barber: string, key: string | null = null) =>
  as<{ r: { id: string; repetida: boolean } }>(client, ADMIN(), CREATE, [service, barber, start, key]).then((rows) => rows[0]!.r);

const adminCall = <T = unknown>(client: TestDb["su"], sql: string, params: unknown[] = []) =>
  as<{ r: T }>(client, ADMIN(), `select ${sql} as r`, params).then((rows) => rows[0]!.r);

async function restoreSchedules() {
  await adminCall(db.su, "public.admin_save_schedule(null, $1, 'manter')", [FULL]);
}

describe("mudança de agenda × registro de agendamento", () => {
  it("expediente reduzido num aparelho: o registro concorrente espera e é recusado com a regra nova", async () => {
    const [ca, cb] = [await db.connect(), await db.connect()];
    const pidB = await backendPid(cb);
    const d = await localDay(db.su, 3);
    const tx = await openTx(ca, ADMIN());
    await tx.query("select public.admin_save_schedule($1, $2, 'manter')", [cat.barberA, week("09:00", "16:00")]);

    const op = book(cb, "barba", await at(db.su, d, "17:00"), cat.barberA);
    expect(await blockedOrSettled(db.su, pidB, op)).toBe("bloqueada");
    await tx.commit();

    expect((await errorOf(op)).hint).toBe("fora_expediente");
    await restoreSchedules();
  });

  it("registro em andamento: a mudança de expediente espera e mostra o novo agendamento como conflito", async () => {
    const [ca, cb] = [await db.connect(), await db.connect()];
    const pidA = await backendPid(ca);
    const d = await localDay(db.su, 4);
    const tx = await openTx(cb, ADMIN());
    const [{ r }] = await tx.query<{ r: { id: string } }>(CREATE, ["barba", cat.barberA, await at(db.su, d, "17:00"), null]);

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

  it("feriado para todos: trava todos os profissionais", async () => {
    const [ca, cb] = [await db.connect(), await db.connect()];
    const pidB = await backendPid(cb);
    const d = await localDay(db.su, 5);
    const tx = await openTx(ca, ADMIN());
    await tx.query("select public.admin_add_exception(null, $1, $2, 'feriado', 'Feriado', 'manter')", [
      await at(db.su, d, "00:00"),
      await at(db.su, await localDay(db.su, 6), "00:00"),
    ]);
    const onB = book(cb, "barba", await at(db.su, d, "10:00"), cat.barberB);
    expect(await blockedOrSettled(db.su, pidB, onB)).toBe("bloqueada");
    await tx.commit();
    expect((await errorOf(onB)).hint).toBe("bloqueado");
  });

  it("várias travas ao mesmo tempo (expediente global, reagendamento e bloqueio com cancelamento): sem deadlock", async () => {
    for (let round = 0; round < 3; round++) {
      const [c0, c1, c2, c3] = await Promise.all([db.connect(), db.connect(), db.connect(), db.connect()]);
      const pid1 = await backendPid(c1);
      const d = await localDay(db.su, 8 + round);
      const appt = await book(db.su, "barba", await at(db.su, d, "10:00"), cat.barberA);

      // segura todas as travas de profissional enquanto as outras operações se enfileiram
      const hold = await openTx(c0, ADMIN());
      await hold.query("select public.admin_add_exception(null, $1, $2, 'bloqueio', 'Reunião', 'manter')", [
        await at(db.su, await localDay(db.su, 20 + round), "09:00"),
        await at(db.su, await localDay(db.su, 20 + round), "10:00"),
      ]);
      const ops = [
        adminCall(c1, "public.admin_reschedule($1, $2, $3)", [appt.id, await at(db.su, d, "15:00"), cat.barberB]),
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
  it("dois registros simultâneos com a mesma chave (toque duplo em dois aparelhos): um só agendamento", async () => {
    const [ca, cb] = [await db.connect(), await db.connect()];
    const pidB = await backendPid(cb);
    const key = uuid();
    const start = await at(db.su, await localDay(db.su, 12), "09:00");
    const tx = await openTx(ca, ADMIN());
    const [{ r: first }] = await tx.query<{ r: { id: string } }>(CREATE, ["barba", cat.barberA, start, key]);

    const second = book(cb, "barba", start, cat.barberA, key);
    expect(await blockedOrSettled(db.su, pidB, second)).toBe("bloqueada");
    await tx.commit();

    expect(await second).toMatchObject({ id: first.id, repetida: true });
    const { rows } = await db.su.query("select count(*)::int as n from public.appointments where request_key = $1", [key]);
    expect(rows[0].n).toBe(1);
  });
});
