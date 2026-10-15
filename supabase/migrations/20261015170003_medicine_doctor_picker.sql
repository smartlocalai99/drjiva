-- Public-facing doctor names for the selected hospital; no patient or staff data.
create or replace function public.medicine_doctors_for_hospital(p_hospital_id uuid)
returns table (id uuid, display_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return query
    select d.id, d.display_name
    from public.care_doctors d
    where d.hospital_id = p_hospital_id and d.is_active
    order by d.display_name;
end;
$$;
revoke all on function public.medicine_doctors_for_hospital(uuid) from public, anon;
grant execute on function public.medicine_doctors_for_hospital(uuid) to authenticated;
