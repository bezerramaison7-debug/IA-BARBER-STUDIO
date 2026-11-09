-- DADOS DE DEMONSTRAÇÃO — TODOS FICTÍCIOS.
-- Use só em projetos de desenvolvimento/demonstração. Para um cliente real, cadastre os
-- serviços, profissionais e horários pelo painel (/admin) com os dados confirmados.
-- Espelha src/config/site.config.ts (mesmos ids de serviço) e o expediente de exemplo
-- da especificação da V3 (não são horários reais de nenhuma barbearia).

insert into public.business_settings (id, business_name, whatsapp, loyalty_program_name)
values (1, 'Barber Studio (demonstração)', '', 'Barber Studio Club')
on conflict (id) do update set business_name = excluded.business_name, whatsapp = '', loyalty_program_name = excluded.loyalty_program_name;

insert into public.services (id, name, duration_minutes, price_cents, price_from, sort) values
  ('corte-classico', 'Corte clássico', 40, 4500, false, 1),
  ('degrade', 'Degradê', 45, 5000, false, 2),
  ('corte-infantil', 'Corte infantil', 35, 4000, false, 3),
  ('barba-toalha', 'Barba com toalha quente', 30, 3500, false, 4),
  ('barba-desenhada', 'Barba desenhada', 20, 2500, false, 5),
  ('corte-barba', 'Corte + barba', 70, 7500, false, 6),
  ('corte-sobrancelha', 'Corte + sobrancelha', 50, 5500, false, 7),
  ('sobrancelha', 'Sobrancelha', 10, 1500, false, 8),
  ('pigmentacao', 'Pigmentação', 20, 3000, false, 9),
  ('platinado', 'Platinado', 150, 15000, true, 10)
on conflict (id) do nothing;

with b as (
  insert into public.barbers (name, sort) values ('Lucas', 1), ('Henrique', 2), ('Diego', 3)
  returning id
)
insert into public.barber_services (barber_id, service_id)
select b.id, s.id from b cross join public.services s
on conflict do nothing;

-- Segunda e domingo fechados; demais dias com almoço das 12h às 13h.
insert into public.barber_schedules (barber_id, weekday, start_time, end_time, break_start, break_end)
select b.id, d.weekday, d.start_time, d.end_time, '12:00', '13:00'
from public.barbers b
cross join (values
  (2, time '09:00', time '18:00'),
  (3, time '09:00', time '19:00'),
  (4, time '09:00', time '18:00'),
  (5, time '09:00', time '20:00'),
  (6, time '08:00', time '17:00')
) as d(weekday, start_time, end_time)
on conflict do nothing;

-- Programa de fidelidade: contadores separados, 10 atendimentos = 1 cortesia.
insert into public.loyalty_rules (name, threshold, eligible_service_ids, reward_service_id, sort) values
  ('Cartão Corte', 10, array['corte-classico', 'degrade', 'corte-infantil'], 'corte-classico', 1),
  ('Cartão Cabelo + Barba', 10, array['corte-barba'], 'corte-barba', 2);
