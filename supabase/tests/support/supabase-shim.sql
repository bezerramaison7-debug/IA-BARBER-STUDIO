-- Reproduz, num Postgres comum, o mínimo do ambiente Supabase usado pelas migrations:
-- papéis anon/authenticated/service_role, schema auth com auth.users e auth.uid(),
-- schema extensions e as permissões AMPLAS que o Supabase concede por padrão em public.
-- Essas permissões amplas são reproduzidas de propósito: as migrations precisam revogá-las,
-- e os testes provam que a revogação e o RLS funcionam.
-- Usado só em testes locais e no CI. Nunca rode isto num projeto Supabase.

-- Papéis são do cluster inteiro e os arquivos de teste rodam em paralelo (um banco cada): dois podem
-- tentar criar o mesmo papel ao mesmo tempo. A exceção cobre esse caso.
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      begin
        execute format('create role %I nologin noinherit%s', r, case when r = 'service_role' then ' bypassrls' else '' end);
      exception when duplicate_object or unique_violation then null;
      end;
    end if;
  end loop;
end $$;

create schema if not exists extensions;
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  email_confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Mesmo contrato do Supabase: o "sub" do JWT da requisição é o usuário autenticado.
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ), ''
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable
as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', 'anon') $$;

grant execute on function auth.uid() to anon, authenticated, service_role;
grant execute on function auth.role() to anon, authenticated, service_role;

-- Permissões padrão do Supabase no schema public (amplas; as migrations restringem).
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
