import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, createTestDb, localDay, type TestDb } from "./support/db";

let db: TestDb;
beforeAll(async () => {
  db = await createTestDb();
  await db.su.query(readFileSync(join(__dirname, "..", "seed.sql"), "utf8"));
});
afterAll(async () => db?.drop());

describe("seed de demonstração", () => {
  it("aplica sem erro, sem WhatsApp e com horários disponíveis numa terça", async () => {
    const { rows } = await db.su.query("select whatsapp from public.business_settings");
    expect(rows[0].whatsapp).toBe("");
    // próxima terça-feira dentro do limite de 30 dias
    let tuesday = "";
    for (let i = 2; i < 10 && !tuesday; i++) {
      const d = await localDay(db.su, i);
      const { rows: w } = await db.su.query("select extract(dow from $1::date)::int as w", [d]);
      if (w[0].w === 2) tuesday = d;
    }
    const slots = await as(db.su, { role: "anon" }, "select * from public.available_slots('corte-classico', $1)", [tuesday]);
    expect(slots.length).toBeGreaterThan(0);
  });

  it("segunda-feira fechada", async () => {
    for (let i = 2; i < 10; i++) {
      const d = await localDay(db.su, i);
      const { rows: w } = await db.su.query("select extract(dow from $1::date)::int as w", [d]);
      if (w[0].w === 1) {
        expect(await as(db.su, { role: "anon" }, "select * from public.available_slots('corte-classico', $1)", [d])).toEqual([]);
        return;
      }
    }
  });
});
