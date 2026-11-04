/**
 * Utilitários dos testes de banco. Cada arquivo de teste cria um banco novo, aplica o shim
 * do Supabase e as migrations na ordem, e cria dados SINTÉTICOS (nunca dados reais).
 *
 * Requer um Postgres acessível em TEST_DATABASE_URL (superusuário), por exemplo
 * postgres://postgres@127.0.0.1:54329/postgres. No CI, um serviço postgres do GitHub Actions.
 */
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const ROOT = join(__dirname, "..", "..", "..");
const ADMIN_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:54329/postgres";

function urlFor(db: string) {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${db}`;
  return u.toString();
}

export interface TestDb {
  name: string;
  url: string;
  /** Conexão de superusuário (equivalente ao "postgres"/service role): ignora RLS. */
  su: Client;
  /** Nova conexão independente (para simular duas pessoas ao mesmo tempo). */
  connect(): Promise<Client>;
  drop(): Promise<void>;
}

export async function createTestDb(): Promise<TestDb> {
  const name = `v3test_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();

  const url = urlFor(name);
  const su = new Client({ connectionString: url });
  await su.connect();
  await su.query(readFileSync(join(ROOT, "supabase/tests/support/supabase-shim.sql"), "utf8"));
  const migrations = readdirSync(join(ROOT, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const file of migrations) {
    await su.query(readFileSync(join(ROOT, "supabase/migrations", file), "utf8"));
  }

  const clients: Client[] = [];
  return {
    name,
    url,
    su,
    async connect() {
      const c = new Client({ connectionString: url });
      await c.connect();
      clients.push(c);
      return c;
    },
    async drop() {
      await Promise.all(clients.map((c) => c.end().catch(() => {})));
      await su.end();
      const a = new Client({ connectionString: ADMIN_URL });
      await a.connect();
      await a.query(`drop database if exists ${name} with (force)`);
      await a.end();
    },
  };
}

/** Executa SQL como o papel do PostgREST: 'anon' ou 'authenticated' com o usuário dado. */
export async function as<T = Record<string, unknown>>(
  client: Client,
  who: { role: "anon" } | { role: "authenticated"; userId: string },
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  await client.query("begin");
  try {
    await client.query(`set local role ${who.role}`);
    const claims = who.role === "authenticated" ? { sub: who.userId, role: "authenticated" } : { role: "anon" };
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    const res = await client.query(sql, params);
    await client.query("commit");
    return res.rows as T[];
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

/** Cria uma conta de teste como o Supabase Auth faria (o trigger cria o perfil). */
export async function createUser(
  su: Client,
  opts: { name?: string; phone?: string; confirmed?: boolean; email?: string } = {},
): Promise<string> {
  const id = randomUUID();
  const email = opts.email ?? `teste-${id.slice(0, 8)}@example.com`;
  await su.query(
    `insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values ($1, $2, $3, $4)`,
    [
      id,
      email,
      JSON.stringify({ full_name: opts.name ?? "Cliente Teste", phone: opts.phone ?? "16991234567" }),
      opts.confirmed === false ? null : new Date(),
    ],
  );
  return id;
}

export async function makeAdmin(su: Client, userId: string) {
  await su.query("select set_config('app.role_change', 'on', false)");
  await su.query("update public.profiles set role = 'admin' where id = $1", [userId]);
  await su.query("select set_config('app.role_change', '', false)");
}

/** Catálogo mínimo: 2 profissionais que atendem todos os dias das 09h às 18h, intervalo 12h–13h. */
export async function seedCatalog(su: Client) {
  await su.query(`
    insert into public.services (id, name, duration_minutes, price_cents) values
      ('corte-classico', 'Corte clássico', 40, 4500),
      ('degrade', 'Degradê', 45, 5000),
      ('barba', 'Barba', 30, 3500),
      ('corte-barba', 'Corte + barba', 70, 7500);
  `);
  const { rows } = await su.query<{ id: string; name: string }>(`
    insert into public.barbers (name, sort) values ('Profissional A', 1), ('Profissional B', 2) returning id, name
  `);
  for (const b of rows) {
    await su.query(`insert into public.barber_services (barber_id, service_id) select $1, id from public.services`, [b.id]);
    for (let d = 0; d < 7; d++) {
      await su.query(
        `insert into public.barber_schedules (barber_id, weekday, start_time, end_time, break_start, break_end)
         values ($1, $2, '09:00', '18:00', '12:00', '13:00')`,
        [b.id, d],
      );
    }
  }
  const rules = await su.query<{ id: string; name: string }>(`
    insert into public.loyalty_rules (name, threshold, eligible_service_ids, reward_service_id, sort) values
      ('Cartão Corte', 10, array['corte-classico', 'degrade'], 'corte-classico', 1),
      ('Cartão Cabelo + Barba', 10, array['corte-barba'], 'corte-barba', 2)
    returning id, name
  `);
  return {
    barberA: rows[0]!.id,
    barberB: rows[1]!.id,
    ruleCorte: rules.rows.find((r) => r.name === "Cartão Corte")!.id,
    ruleCombo: rules.rows.find((r) => r.name === "Cartão Cabelo + Barba")!.id,
  };
}

/** Data local (America/Sao_Paulo) daqui a N dias, "AAAA-MM-DD". */
export async function localDay(su: Client, daysAhead: number): Promise<string> {
  const { rows } = await su.query<{ d: string }>(
    `select to_char((now() at time zone 'America/Sao_Paulo')::date + $1::int, 'YYYY-MM-DD') as d`,
    [daysAhead],
  );
  return rows[0]!.d;
}

/** Instante ISO para "dia + hora" no fuso da barbearia. */
export async function at(su: Client, day: string, time: string): Promise<string> {
  const { rows } = await su.query<{ t: Date }>(`select ($1::date + $2::time) at time zone 'America/Sao_Paulo' as t`, [day, time]);
  return rows[0]!.t.toISOString();
}

/** Captura o erro de negócio (hint = código estável). */
export async function errorOf(p: Promise<unknown>): Promise<{ code?: string; hint?: string; message: string }> {
  try {
    await p;
  } catch (e) {
    const err = e as { code?: string; hint?: string; message: string };
    return { code: err.code, hint: err.hint, message: err.message };
  }
  throw new Error("Era esperado um erro, mas a operação foi aceita.");
}

export const uuid = randomUUID;

/**
 * Transação aberta com o papel dado, para testes de corrida: cada etapa roda quando o teste manda,
 * e o `commit` também. Use um cliente próprio (db.connect()) por transação.
 */
export async function openTx(client: Client, who: { role: "anon" } | { role: "authenticated"; userId: string }) {
  await client.query("begin");
  await client.query(`set local role ${who.role}`);
  const claims = who.role === "authenticated" ? { sub: who.userId, role: "authenticated" } : { role: "anon" };
  await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
  return {
    query: <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => client.query(sql, params).then((r) => r.rows as T[]),
    commit: () => client.query("commit"),
    rollback: () => client.query("rollback"),
  };
}

/** PID da conexão (para saber se ela está esperando uma trava). */
export async function backendPid(client: Client): Promise<number> {
  const { rows } = await client.query("select pg_backend_pid() as pid");
  return rows[0].pid as number;
}

/**
 * Espera até a operação terminar ou até a conexão `pid` ficar parada numa trava.
 * Devolve "bloqueada" ou "terminou". Sem `sleep` fixo: o teste é determinístico.
 */
export async function blockedOrSettled(su: Client, pid: number, op: Promise<unknown>, timeoutMs = 5000): Promise<"bloqueada" | "terminou"> {
  let settled = false;
  void op.then(() => (settled = true), () => (settled = true));
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (settled) return "terminou";
    const { rows } = await su.query("select wait_event_type from pg_stat_activity where pid = $1", [pid]);
    if (rows[0]?.wait_event_type === "Lock") return "bloqueada";
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("Tempo esgotado esperando a operação ou a trava.");
}
