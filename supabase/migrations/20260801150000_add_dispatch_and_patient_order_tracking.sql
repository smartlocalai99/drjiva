alter table public.orders
  add column rider_name text,
  add column rider_phone text,
  add column assigned_at timestamptz;

alter table public.orders drop constraint if exists orders_status_check;

update public.orders
set status = case status
  when 'confirmed' then 'shared'
  when 'preparing' then 'collected'
  else status
end;

alter table public.orders
  add constraint orders_status_check check (
    status in (
      'placed',
      'shared',
      'assigned',
      'collected',
      'out_for_delivery',
      'delivered',
      'cancelled'
    )
  );

create index orders_owner_patient_created_idx
  on public.orders (owner_user_id, patient_id, created_at desc);

create or replace function public.format_order_row(
  p_order public.orders
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_order.id,
    'orderNumber', p_order.order_number,
    'status', p_order.status,
    'paymentMethod', p_order.payment_method,
    'paymentStatus', p_order.payment_status,
    'currency', p_order.currency,
    'subtotal', p_order.subtotal,
    'deliveryFee', p_order.delivery_fee,
    'total', p_order.total,
    'customerName', p_order.customer_name,
    'customerPhone', p_order.customer_phone,
    'riderName', p_order.rider_name,
    'riderPhone', p_order.rider_phone,
    'assignedAt', p_order.assigned_at,
    'address', jsonb_build_object(
      'label', p_order.address_label,
      'building', p_order.address_building,
      'area', p_order.address_area,
      'landmark', p_order.address_landmark,
      'city', p_order.address_city,
      'state', p_order.address_state,
      'pinCode', p_order.address_pin_code,
      'formatted', p_order.delivery_address
    ),
    'hospital', jsonb_build_object(
      'id', p_order.hospital_id,
      'name', p_order.hospital_name,
      'address', p_order.hospital_address,
      'phone', p_order.hospital_phone
    ),
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', item.id,
            'medicineId', item.medicine_id,
            'name', item.medicine_name,
            'imageUrl', item.image_url,
            'packDisplay', item.pack_display,
            'unitPrice', item.unit_price,
            'quantity', item.quantity,
            'lineTotal', item.line_total
          )
          order by item.created_at, item.id
        )
        from public.order_items as item
        where item.order_id = p_order.id
      ),
      '[]'::jsonb
    ),
    'createdAt', p_order.created_at,
    'updatedAt', p_order.updated_at
  );
$$;

create or replace function public.list_hospital_orders(
  p_access_code text,
  p_filter text default 'active'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.order_dashboard_access_is_valid(p_access_code) then
    raise exception using errcode = '42501', message = 'Invalid dispatcher access code.';
  end if;

  if coalesce(p_filter, 'active') not in ('active', 'delivered', 'cancelled', 'all') then
    raise exception using errcode = '22023', message = 'Invalid order filter.';
  end if;

  select coalesce(
    jsonb_agg(public.format_order_row(filtered) order by filtered.created_at desc),
    '[]'::jsonb
  )
  into v_result
  from (
    select order_row.*
    from public.orders as order_row
    join public.hospitals as hospital on hospital.id = order_row.hospital_id
    where upper(btrim(hospital.name)) = 'ASIAN MULTI SPECIALITY HOSPITALS'
      and (
        p_filter = 'all'
        or (coalesce(p_filter, 'active') = 'active'
          and order_row.status in (
            'placed', 'shared', 'assigned', 'collected', 'out_for_delivery'
          ))
        or order_row.status = p_filter
      )
    order by order_row.created_at desc
    limit 250
  ) as filtered;

  return v_result;
end;
$$;

create or replace function public.update_hospital_order_status(
  p_access_code text,
  p_order_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.order_dashboard_access_is_valid(p_access_code) then
    raise exception using errcode = '42501', message = 'Invalid dispatcher access code.';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Order not found.';
  end if;

  if not (
    (v_order.status = 'placed' and p_status in ('shared', 'cancelled'))
    or (v_order.status = 'shared' and p_status = 'cancelled')
    or (v_order.status = 'assigned' and p_status in ('collected', 'cancelled'))
    or (v_order.status = 'collected' and p_status in ('out_for_delivery', 'cancelled'))
    or (v_order.status = 'out_for_delivery' and p_status in ('delivered', 'cancelled'))
    or v_order.status = p_status
  ) then
    raise exception using
      errcode = '22023',
      message = format('Cannot move an order from %s to %s.', v_order.status, p_status);
  end if;

  update public.orders
  set status = p_status,
      payment_status = case
        when p_status = 'delivered' then 'collected'
        else payment_status
      end,
      updated_at = now()
  where id = p_order_id
  returning *
  into v_order;

  return public.format_order_row(v_order);
end;
$$;

create or replace function public.assign_order_rider(
  p_access_code text,
  p_order_id uuid,
  p_rider_name text,
  p_rider_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_rider_name text := nullif(btrim(coalesce(p_rider_name, '')), '');
  v_rider_phone text := right(regexp_replace(coalesce(p_rider_phone, ''), '[^0-9]', '', 'g'), 10);
begin
  if not public.order_dashboard_access_is_valid(p_access_code) then
    raise exception using errcode = '42501', message = 'Invalid dispatcher access code.';
  end if;

  if v_rider_name is null then
    raise exception using errcode = '22023', message = 'Enter the rider name.';
  end if;

  if length(v_rider_phone) <> 10 then
    raise exception using errcode = '22023', message = 'Enter a valid 10-digit rider phone.';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Order not found.';
  end if;

  if v_order.status not in ('shared', 'assigned') then
    raise exception using
      errcode = '22023',
      message = format('Cannot assign a rider while an order is %s.', v_order.status);
  end if;

  update public.orders
  set rider_name = v_rider_name,
      rider_phone = v_rider_phone,
      assigned_at = coalesce(assigned_at, now()),
      status = 'assigned',
      updated_at = now()
  where id = p_order_id
  returning *
  into v_order;

  return public.format_order_row(v_order);
end;
$$;

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

  if not exists (
    select 1
    from public.patients as patient
    where patient.id = p_patient_id
      and patient.owner_user_id = v_owner_user_id
  ) then
    raise exception using errcode = '42501', message = 'Patient order access denied.';
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

create or replace function public.get_patient_order(
  p_patient_id uuid,
  p_order_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner_user_id uuid := auth.uid();
  v_order public.orders%rowtype;
begin
  if v_owner_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
    and patient_id = p_patient_id
    and owner_user_id = v_owner_user_id;

  if not found then
    raise exception using errcode = '42501', message = 'Patient order access denied.';
  end if;

  return public.format_order_row(v_order);
end;
$$;

revoke all on function public.assign_order_rider(text, uuid, text, text) from public;
revoke all on function public.list_patient_orders(uuid) from public;
revoke all on function public.get_patient_order(uuid, uuid) from public;

grant execute on function public.assign_order_rider(text, uuid, text, text)
  to anon, authenticated;
grant execute on function public.list_patient_orders(uuid) to authenticated;
grant execute on function public.get_patient_order(uuid, uuid) to authenticated;
