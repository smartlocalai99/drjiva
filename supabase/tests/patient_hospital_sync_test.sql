begin;

insert into auth.users(id)
values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000003')
on conflict (id) do nothing;

insert into public.patients(id, mobile, name)
values
  ('20000000-0000-0000-0000-000000000001', '+919900000001', 'Sync Test One'),
  ('20000000-0000-0000-0000-000000000002', '+919900000002', 'Sync Test Two'),
  ('20000000-0000-0000-0000-000000000003', '+919900000003', 'Sync Test Three')
on conflict (id) do nothing;

insert into public.patient_custom_hospitals(
  patient_id,
  owner_user_id,
  name,
  normalized_name
)
values
  (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Codex Direct Sync 9f0d Hospital',
    'codex direct sync 9f0d hospital'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    '  CODEX---DIRECT Sync 9f0d Hospital!!!  ',
    'codex direct sync 9f0d hospital'
  );

do $$
begin
  if (
    select count(*)
    from public.hospitals
    where normalized_name = 'codex direct sync 9f0d hospital'
  ) <> 1 then
    raise exception 'patient hospital was not synced exactly once';
  end if;
end;
$$;

insert into public.hospitals(name, code, address, phone)
values (
  'Codex Existing Official 9f0d',
  'KEEP',
  'Official address',
  '+919911111111'
);

insert into public.patient_custom_hospitals(
  patient_id,
  owner_user_id,
  name,
  normalized_name
)
values (
  '20000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000003',
  'codex existing official 9f0d!!!',
  'codex existing official 9f0d'
);

do $$
declare
  official public.hospitals%rowtype;
begin
  select *
  into strict official
  from public.hospitals
  where normalized_name = 'codex existing official 9f0d';

  if official.code <> 'KEEP'
    or official.address <> 'Official address'
    or official.phone <> '+919911111111' then
    raise exception 'patient sync overwrote official hospital details';
  end if;
end;
$$;

rollback;
