create or replace function public.list_patient_orders(
  p_patient_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_owner_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select coalesce(
    jsonb_agg(public.format_order_row(order_row) order by order_row.created_at desc),
    '[]'::jsonb
  )
  into v_result
  from public.orders as order_row
  where order_row.owner_user_id = v_owner_user_id
    and order_row.patient_id = p_patient_id;

  return v_result;
end;
$$;

revoke all on function public.list_patient_orders(uuid) from public;
grant execute on function public.list_patient_orders(uuid) to authenticated;
