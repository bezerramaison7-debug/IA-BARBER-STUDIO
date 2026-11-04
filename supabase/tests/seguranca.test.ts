import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, at, createTestDb, createUser, errorOf, localDay, makeAdmin, seedCatalog, uuid, type TestDb } from "./support/db";

let db: TestDb;
let cat: Awaited<ReturnType<typeof seedCatalog>>;
let admin: string;
let alice: string;
let bob: string;
let aliceAppt: string;

const anon = { role: "anon" } as const;
const user = (id: string) => ({ role: "authenticated", userId: id }) as const;

beforeAll(async () => {
  db = await createTestDb();
  cat = await seedCatalog(db.su);
  admin = await createUser(db.su, { name: "Admin Teste" });
  await makeAdmin(db.su, admin);
  alice = await createUser(db.su, { name: "Alice Teste", phone: "16991110001" });
  bob = await createUser(db.su, { name: "Bob Teste", phone: "16991110002" });
  const start = await at(db.su, await localDay(db.su, 2), "10:00");
  const rows = await as<{ r: { id: string } }>(db.su, user(alice), "select public.request_appointment('barba', $1, $2, $3) as r", [
    start,
    uuid(),
    cat.barberA,
  ]);
  aliceAppt = rows[0]!.r.id;
});
afterAll(async () => db?.drop());

describe("visitante (anon)", () => {
  it("vê catálogo e horários, mas nenhum dado pessoal", async () => {
    expect((await as(db.su, anon, "select id from public.services")).length).toBeGreaterThan(0);
    for (const table of ["profiles", "appointments", "loyalty_entries", "loyalty_rewards", "audit_logs", "privacy_requests", "schedule_exceptions"]) {
      const err = await errorOf(as(db.su, anon, `select * from public.${table}`));
      expect(err.code, table).toBe("42501"); // permission denied
    }
  });

  it("não solicita agendamento", async () => {
    const err = await errorOf(as(db.su, anon, "select public.request_appointment('barba', now() + interval '3 days', gen_random_uuid())"));
    expect(err.code).toBe("42501");
  });
});

describe("cliente", () => {
  it("só enxerga os próprios dados", async () => {
    const profiles = await as<{ id: string }>(db.su, user(bob), "select id from public.profiles");
    expect(profiles.map((p) => p.id)).toEqual([bob]);
    expect(await as(db.su, user(bob), "select id from public.appointments")).toEqual([]);
    expect(await as(db.su, user(bob), "select id from public.appointments where id = $1", [aliceAppt])).toEqual([]);
    expect((await as(db.su, user(alice), "select id from public.appointments")).length).toBe(1);
    expect(await as(db.su, user(bob), "select * from public.appointment_status_history where appointment_id = $1", [aliceAppt])).toEqual([]);
    expect(await as(db.su, user(bob), "select * from public.audit_logs")).toEqual([]);
  });

  it("não altera dados de outra pessoa", async () => {
    await as(db.su, user(bob), "update public.profiles set full_name = 'Invasor' where id = $1", [alice]);
    const { rows } = await db.su.query("select full_name from public.profiles where id = $1", [alice]);
    expect(rows[0].full_name).toBe("Alice Teste");
  });

  it("edita o próprio nome e telefone, mas não o próprio papel", async () => {
    await as(db.su, user(bob), "update public.profiles set full_name = 'Bob Atualizado', phone = '(16) 99111-0003' where id = $1", [bob]);
    const { rows } = await db.su.query("select full_name, phone from public.profiles where id = $1", [bob]);
    expect(rows[0]).toEqual({ full_name: "Bob Atualizado", phone: "16991110003" });
    const err = await errorOf(as(db.su, user(bob), "update public.profiles set role = 'admin' where id = $1", [bob]));
    expect(err.code).toBe("42501");
    expect((await errorOf(as(db.su, user(bob), "select public.admin_set_role($1, 'admin')", [bob]))).hint).toBe("sem_permissao");
    expect((await errorOf(as(db.su, user(bob), "select public.bootstrap_first_admin('x@example.com')"))).code).toBe("42501");
  });

  it("não acessa nenhuma função administrativa", async () => {
    const calls = [
      "select public.admin_dashboard()",
      `select public.admin_get_customer('${alice}')`,
      `select public.admin_update_status('${aliceAppt}', 'confirmado')`,
      `select public.admin_save_schedule(null, '[]'::jsonb, 'manter')`,
      `select public.admin_add_exception(null, now(), now() + interval '1 hour', 'bloqueio')`,
      `select public.admin_adjust_loyalty('${bob}', '${cat.ruleCorte}', 5, 'tentativa de fraude')`,
      `select public.admin_anonymize_customer('${alice}', 'tentativa indevida')`,
    ];
    for (const sql of calls) expect((await errorOf(as(db.su, user(bob), sql))).hint, sql).toBe("sem_permissao");
  });

  it("não fabrica pontos, recompensas nem agendamentos diretos", async () => {
    const attempts = [
      `insert into public.loyalty_entries (customer_id, rule_id, delta, kind) values ('${bob}', '${cat.ruleCorte}', 10, 'ajuste')`,
      `insert into public.loyalty_rewards (customer_id, rule_id) values ('${bob}', '${cat.ruleCorte}')`,
      `update public.loyalty_rewards set status = 'disponivel'`,
      `update public.appointments set status = 'concluido' where id = '${aliceAppt}'`,
      `insert into public.appointments (customer_id, barber_id, service_id, service_name, duration_minutes, starts_at, ends_at, status)
        values ('${bob}', '${cat.barberA}', 'barba', 'Barba', 30, now() - interval '1 day', now() - interval '23 hours', 'concluido')`,
      `select public._grant_rewards('${bob}', '${cat.ruleCorte}')`,
      `select public._insert_appointment('${bob}', 'barba', '${cat.barberA}', now() + interval '3 days', null, null, null, 'confirmado', false)`,
      `update public.business_settings set whatsapp = '5516991234567'`,
      `insert into public.schedule_exceptions (starts_at, ends_at, kind) values (now(), now() + interval '1 day', 'bloqueio')`,
    ];
    for (const sql of attempts) {
      const res = await as(db.su, user(bob), sql).then(
        () => "aceito",
        (e: { code?: string }) => e.code,
      );
      // 42501 = sem permissão. UPDATE sem linhas visíveis (RLS) também conta como bloqueio.
      if (res === "aceito") {
        expect(sql.trim().startsWith("update"), sql).toBe(true);
      } else {
        expect(res, sql).toBe("42501");
      }
    }
    const { rows } = await db.su.query("select status from public.appointments where id = $1", [aliceAppt]);
    expect(rows[0].status).toBe("pendente");
    const { rows: s } = await db.su.query("select whatsapp from public.business_settings");
    expect(s[0].whatsapp).toBe("");
  });

  it("não cancela agendamento de outra pessoa", async () => {
    expect((await errorOf(as(db.su, user(bob), "select public.cancel_my_appointment($1)", [aliceAppt]))).hint).toBe("nao_encontrado");
  });

  it("idempotência não vaza agendamento alheio pela chave", async () => {
    const { rows } = await db.su.query("select request_key from public.appointments where id = $1", [aliceAppt]);
    const err = await errorOf(
      as(db.su, user(bob), "select public.request_appointment('barba', now() + interval '3 days', $1)", [rows[0].request_key]),
    );
    expect(err.hint).toBe("requisicao_invalida");
  });
});

describe("cadastro", () => {
  it("recusa cadastro sem nome ou com telefone inválido", async () => {
    expect((await errorOf(createUser(db.su, { name: "A" }))).hint).toBe("cadastro_nome");
    expect((await errorOf(createUser(db.su, { phone: "123" }))).hint).toBe("cadastro_telefone");
  });
});

describe("administração", () => {
  it("admin enxerga todos os clientes e o acesso à ficha é auditado", async () => {
    const all = await as(db.su, user(admin), "select id from public.profiles");
    expect(all.length).toBeGreaterThanOrEqual(3);
    await as(db.su, user(admin), "select public.admin_get_customer($1)", [alice]);
    const { rows } = await db.su.query("select actor_id, action from public.audit_logs where action = 'consultar_cliente' and entity_id = $1", [alice]);
    expect(rows[0]).toEqual({ actor_id: admin, action: "consultar_cliente" });
  });

  it("número de WhatsApp inválido ou de exemplo é recusado no banco", async () => {
    for (const n of ["5516999999999", "16991234567", "5520991234567"]) {
      expect((await errorOf(as(db.su, user(admin), "update public.business_settings set whatsapp = $1", [n]))).code, n).toBe("23514");
    }
    await as(db.su, user(admin), "update public.business_settings set whatsapp = '5516991234567'");
    await as(db.su, user(admin), "update public.business_settings set whatsapp = ''");
  });

  it("não remove o último administrador", async () => {
    expect((await errorOf(as(db.su, user(admin), "select public.admin_set_role($1, 'cliente')", [admin]))).hint).toBe("ultimo_admin");
  });

  it("primeiro admin: bootstrap só funciona uma vez e só pelo SQL Editor", async () => {
    const fresh = await createTestDb();
    try {
      const u = await createUser(fresh.su, { email: "dono@example.com" });
      expect((await fresh.su.query("select public.bootstrap_first_admin('dono@example.com') as r")).rows[0].r).toBe("Administrador definido.");
      const { rows } = await fresh.su.query("select role from public.profiles where id = $1", [u]);
      expect(rows[0].role).toBe("admin");
      await expect(fresh.su.query("select public.bootstrap_first_admin('dono@example.com')")).rejects.toThrow(/Já existe um administrador/);
    } finally {
      await fresh.drop();
    }
  });

  it("auditoria e lançamentos de fidelidade são imutáveis, até para o superusuário", async () => {
    await expect(db.su.query("delete from public.audit_logs")).rejects.toThrow(/imutável/);
    await expect(db.su.query("update public.appointment_status_history set reason = 'x'")).rejects.toThrow(/imutável/);
  });

  it("anonimização remove a identificação e bloqueia a conta", async () => {
    const victim = await createUser(db.su, { name: "Pessoa Remover", phone: "16991110009" });
    await as(db.su, user(admin), "select public.admin_anonymize_customer($1, 'Pedido do titular')", [victim]);
    const { rows } = await db.su.query("select full_name, phone, email, anonymized_at from public.profiles where id = $1", [victim]);
    expect(rows[0]).toMatchObject({ full_name: "Cliente removido", phone: "0000000000", email: null });
    expect(rows[0].anonymized_at).not.toBeNull();
    expect(
      (await errorOf(as(db.su, user(victim), "select public.request_appointment('barba', now() + interval '3 days', gen_random_uuid())"))).hint,
    ).toBe("conta_indisponivel");
  });
});

describe("direitos do titular", () => {
  it("exporta só os próprios dados e registra solicitações", async () => {
    const [{ r }] = await as<{ r: { perfil: { id: string }; agendamentos: unknown[] } }>(db.su, user(alice), "select public.my_data_export() as r");
    expect(r.perfil.id).toBe(alice);
    expect(r.agendamentos).toHaveLength(1);
    await as(db.su, user(alice), "select public.create_privacy_request('acesso', 'Quero uma cópia')");
    expect(await as(db.su, user(bob), "select * from public.privacy_requests")).toEqual([]);
    expect((await as(db.su, user(admin), "select * from public.privacy_requests")).length).toBe(1);
  });
});
