import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, at, createCustomer, createTestDb, createUser, errorOf, localDay, makeAdmin, seedCatalog, type TestDb } from "./support/db";

let db: TestDb;
let cat: Awaited<ReturnType<typeof seedCatalog>>;
let admin: string;
let staff: string; // conta criada no Auth, ainda sem acesso ao painel
let alice: string; // cliente (sem login)
let aliceAppt: string;

const anon = { role: "anon" } as const;
const user = (id: string) => ({ role: "authenticated", userId: id }) as const;
const PERSONAL = ["customers", "appointments", "appointment_status_history", "loyalty_entries", "loyalty_rewards", "audit_logs", "privacy_requests", "schedule_exceptions"];

beforeAll(async () => {
  db = await createTestDb();
  cat = await seedCatalog(db.su);
  admin = await createUser(db.su, { name: "Admin Teste" });
  await makeAdmin(db.su, admin);
  staff = await createUser(db.su, { name: "Conta Nova" });
  alice = await createCustomer(db.su, { name: "Alice Teste", phone: "16958342716" });
  const rows = await as<{ r: { id: string } }>(db.su, user(admin), "select public.admin_create_appointment('barba', $1, $2, $3) as r", [
    cat.barberA,
    await at(db.su, await localDay(db.su, 2), "10:00"),
    alice,
  ]);
  aliceAppt = rows[0]!.r.id;
});
afterAll(async () => db?.drop());

describe("visitante (anon)", () => {
  it("vê catálogo e horários livres, mas nenhum dado pessoal", async () => {
    expect((await as(db.su, anon, "select id from public.services")).length).toBeGreaterThan(0);
    expect((await as(db.su, anon, "select * from public.available_slots('barba', $1)", [await localDay(db.su, 3)])).length).toBeGreaterThan(0);
    for (const table of [...PERSONAL, "profiles"]) {
      expect((await errorOf(as(db.su, anon, `select * from public.${table}`))).code, table).toBe("42501");
    }
  });

  it("não grava nada: nenhuma função pública reserva horário ou cria cliente", async () => {
    const attempts = [
      "select public.admin_create_appointment('barba', gen_random_uuid(), now() + interval '3 days', null, 'Robô')",
      "insert into public.customers (full_name, phone) values ('Robô', '16958342716')",
      "insert into public.appointments (barber_id, service_id, service_name, duration_minutes, starts_at, ends_at) values (gen_random_uuid(), 'barba', 'x', 30, now(), now() + interval '30 minutes')",
      "select public.admin_create_privacy_request('acesso', 'Robô')",
    ];
    for (const sql of attempts) expect((await errorOf(as(db.su, anon, sql))).code, sql).toBe("42501");
  });

  it("as funções do antigo login de cliente não existem mais", async () => {
    const { rows } = await db.su.query(
      "select proname from pg_proc where pronamespace = 'public'::regnamespace and proname = any($1)",
      [["request_appointment", "cancel_my_appointment", "reschedule_my_appointment", "my_loyalty", "my_data_export", "create_privacy_request"]],
    );
    expect(rows).toEqual([]);
  });
});

describe("conta sem acesso ao painel", () => {
  it("não lê dados pessoais (RLS) e só vê o próprio perfil", async () => {
    for (const table of PERSONAL) expect(await as(db.su, user(staff), `select * from public.${table}`), table).toEqual([]);
    const profiles = await as<{ id: string }>(db.su, user(staff), "select id from public.profiles");
    expect(profiles.map((p) => p.id)).toEqual([staff]);
  });

  it("não acessa nenhuma função administrativa", async () => {
    const calls = [
      "select public.admin_dashboard()",
      `select public.admin_get_customer('${alice}')`,
      `select public.admin_export_customer('${alice}')`,
      `select public.admin_delete_customer('${alice}', 'tentativa indevida')`,
      `select public.admin_update_status('${aliceAppt}', 'cancelado')`,
      `select public.admin_create_appointment('barba', '${cat.barberA}', now() + interval '3 days', '${alice}')`,
      `select public.admin_save_schedule(null, '[]'::jsonb, 'manter')`,
      `select public.admin_add_exception(null, now(), now() + interval '1 hour', 'bloqueio')`,
      `select public.admin_adjust_loyalty('${alice}', '${cat.ruleCorte}', 5, 'tentativa de fraude')`,
      `select public.admin_create_privacy_request('acesso', 'Tentativa')`,
      `select public.admin_set_role('${staff}', 'admin')`,
    ];
    for (const sql of calls) expect((await errorOf(as(db.su, user(staff), sql))).hint, sql).toBe("sem_permissao");
  });

  it("não se promove, não grava clientes nem fabrica pontos", async () => {
    expect((await errorOf(as(db.su, user(staff), "update public.profiles set role = 'admin' where id = $1", [staff]))).code).toBe("42501");
    expect((await errorOf(as(db.su, user(staff), "select public.bootstrap_first_admin('x@example.com')"))).code).toBe("42501");
    expect((await errorOf(as(db.su, user(staff), "insert into public.customers (full_name, phone) values ('Fraude', '16958342727')"))).code).toBe("42501");
    await as(db.su, user(staff), "update public.customers set full_name = 'Invasor' where id = $1", [alice]); // RLS: 0 linhas
    const attempts = [
      `insert into public.loyalty_entries (customer_id, rule_id, delta, kind) values ('${alice}', '${cat.ruleCorte}', 10, 'ajuste')`,
      `insert into public.loyalty_rewards (customer_id, rule_id) values ('${alice}', '${cat.ruleCorte}')`,
      `select public._grant_rewards('${alice}', '${cat.ruleCorte}')`,
      `select public._insert_appointment('${alice}', 'barba', '${cat.barberA}', now() + interval '3 days', null, null, null, 'confirmado', false)`,
      `update public.business_settings set whatsapp = '5516991234567'`,
      `delete from public.customers where id = '${alice}'`,
    ];
    for (const sql of attempts) {
      const res = await as(db.su, user(staff), sql).then(() => "aceito", (e: { code?: string }) => e.code);
      if (res === "aceito") expect(sql.trim().startsWith("update"), sql).toBe(true);
      else expect(res, sql).toBe("42501");
    }
    const { rows } = await db.su.query("select full_name from public.customers where id = $1", [alice]);
    expect(rows[0].full_name).toBe("Alice Teste");
  });
});

describe("cadastro de clientes", () => {
  it("normaliza o telefone e recusa número inválido ou de exemplo", async () => {
    const [{ id }] = await as<{ id: string }>(db.su, user(admin), "insert into public.customers (full_name, phone) values ('  Bruno   Teste ', '+55 (16) 95834-2738') returning id");
    const { rows } = await db.su.query("select full_name, phone, created_by from public.customers where id = $1", [id]);
    expect(rows[0]).toEqual({ full_name: "Bruno Teste", phone: "16958342738", created_by: admin });
    for (const phone of ["123", "16999999999", "20958342716"]) {
      expect((await errorOf(as(db.su, user(admin), "insert into public.customers (full_name, phone) values ('Teste', $1)", [phone]))).code, phone).toBe("23514");
    }
  });

  it("telefone repetido é permitido (família, número reatribuído) e aparece na ficha, sem juntar históricos", async () => {
    const pai = await createCustomer(db.su, { name: "Pai Teste", phone: "16958342749" });
    const filho = await createCustomer(db.su, { name: "Filho Teste", phone: "16958342749" });
    const [{ r }] = await as<{ r: { mesmo_telefone: { id: string }[]; agendamentos: unknown[] } }>(db.su, user(admin), "select public.admin_get_customer($1) as r", [pai]);
    expect(r.mesmo_telefone.map((x) => x.id)).toEqual([filho]);
    expect(r.agendamentos).toEqual([]);
  });

  it("auditoria do cadastro não copia nome nem telefone para o log imutável", async () => {
    const c = await createCustomer(db.su, { name: "Pessoa Privada", phone: "16958342750" });
    const { rows } = await db.su.query("select details::text as d from public.audit_logs where entity = 'customers' and entity_id = $1", [c]);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.d).not.toMatch(/Pessoa Privada|16958342750/);
  });
});

describe("administração", () => {
  it("admin lê clientes e o acesso à ficha e a exportação ficam auditados", async () => {
    expect((await as(db.su, user(admin), "select id from public.customers")).length).toBeGreaterThanOrEqual(1);
    await as(db.su, user(admin), "select public.admin_get_customer($1)", [alice]);
    const [{ r }] = await as<{ r: { cliente: { nome: string } } }>(db.su, user(admin), "select public.admin_export_customer($1) as r", [alice]);
    expect(r.cliente.nome).toBe("Alice Teste");
    const { rows } = await db.su.query("select action from public.audit_logs where entity_id = $1 and actor_id = $2", [alice, admin]);
    expect(rows.map((x) => x.action)).toEqual(expect.arrayContaining(["consultar_cliente", "exportar_cliente"]));
  });

  it("número de WhatsApp inválido ou de exemplo é recusado no banco", async () => {
    for (const n of ["5516999999999", "16991234567", "5520991234567"]) {
      expect((await errorOf(as(db.su, user(admin), "update public.business_settings set whatsapp = $1", [n]))).code, n).toBe("23514");
    }
    await as(db.su, user(admin), "update public.business_settings set whatsapp = '5516991234567'");
    await as(db.su, user(admin), "update public.business_settings set whatsapp = ''");
  });

  it("concede e retira acesso, mas não remove o último administrador", async () => {
    await as(db.su, user(admin), "select public.admin_set_role($1, 'admin')", [staff]);
    expect((await as<{ r: boolean }>(db.su, user(staff), "select public.is_admin() as r"))[0]!.r).toBe(true);
    await as(db.su, user(admin), "select public.admin_set_role($1, 'sem_acesso')", [staff]);
    expect((await errorOf(as(db.su, user(admin), "select public.admin_set_role($1, 'sem_acesso')", [admin]))).hint).toBe("ultimo_admin");
    const { rows } = await db.su.query("select action from public.audit_logs where entity = 'profiles' and entity_id = $1", [staff]);
    expect(rows.map((x) => x.action)).toEqual(["alterar_perfil", "alterar_perfil"]);
  });

  it("primeiro admin: conta criada no Auth nasce sem acesso; bootstrap só pelo SQL Editor e uma vez", async () => {
    const fresh = await createTestDb();
    try {
      const u = await createUser(fresh.su, { email: "dono@example.com" });
      expect((await fresh.su.query("select role from public.profiles where id = $1", [u])).rows[0].role).toBe("sem_acesso");
      expect((await fresh.su.query("select public.bootstrap_first_admin('dono@example.com') as r")).rows[0].r).toBe("Administrador definido.");
      expect((await fresh.su.query("select role from public.profiles where id = $1", [u])).rows[0].role).toBe("admin");
      await expect(fresh.su.query("select public.bootstrap_first_admin('dono@example.com')")).rejects.toThrow(/Já existe um administrador/);
      // recuperação quando ninguém consegue entrar: apagar a conta perdida no Auth libera o bootstrap
      const novo = await createUser(fresh.su, { email: "novo-dono@example.com" });
      await fresh.su.query("delete from auth.users where id = $1", [u]);
      await fresh.su.query("select public.bootstrap_first_admin('novo-dono@example.com')");
      expect((await fresh.su.query("select role from public.profiles where id = $1", [novo])).rows[0].role).toBe("admin");
    } finally {
      await fresh.drop();
    }
  });

  it("auditoria e histórico de status são imutáveis, até para o superusuário", async () => {
    await expect(db.su.query("delete from public.audit_logs")).rejects.toThrow(/imutável/);
    await expect(db.su.query("update public.appointment_status_history set reason = 'x'")).rejects.toThrow(/imutável/);
  });
});

describe("direitos do titular", () => {
  it("pedido registrado pelo admin, atendido e auditado", async () => {
    const [{ r: id }] = await as<{ r: string }>(db.su, user(admin), "select public.admin_create_privacy_request('acesso', 'Alice Teste', '(16) 95834-2716', 'whatsapp', 'Quer uma cópia', $1) as r", [alice]);
    await as(db.su, user(admin), "select public.admin_resolve_privacy_request($1, 'concluida', 'Cópia enviada pelo WhatsApp')", [id]);
    const { rows } = await db.su.query("select status, resolved_by, created_by from public.privacy_requests where id = $1", [id]);
    expect(rows[0]).toEqual({ status: "concluida", resolved_by: admin, created_by: admin });
    expect((await errorOf(as(db.su, user(admin), "select public.admin_create_privacy_request('nada', 'X')"))).hint).toBe("dados_invalidos");
  });
});
