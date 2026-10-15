-- Treat public.medicines.price as MRP and snapshot the advertised 5% discount.
-- Existing orders remain unchanged because their item prices are immutable snapshots.

create or replace function public.place_cod_order(
  p_patient_id uuid,
  p_client_request_id uuid,
  p_address jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_user_id uuid := auth.uid();
  v_patient public.patients%rowtype;
  v_hospital public.hospitals%rowtype;
  v_order public.orders%rowtype;
  v_item_count integer;
  v_distinct_item_count integer;
  v_total_quantity integer;
  v_matched_count integer;
  v_subtotal numeric(12, 2);
  v_customer_name text := btrim(coalesce(p_address ->> 'recipientName', ''));
  v_customer_phone text := right(
    regexp_replace(coalesce(p_address ->> 'phone', ''), '[^0-9]', '', 'g'),
    10
  );
  v_address_label text := btrim(
    case
      when coalesce(p_address ->> 'label', '') = 'Other'
        then coalesce(nullif(p_address ->> 'customLabel', ''), 'Other')
      else coalesce(p_address ->> 'label', '')
    end
  );
  v_building text := btrim(coalesce(p_address ->> 'building', ''));
  v_area text := btrim(coalesce(p_address ->> 'area', ''));
  v_landmark text := nullif(btrim(coalesce(p_address ->> 'landmark', '')), '');
  v_city text := btrim(coalesce(p_address ->> 'city', ''));
  v_state text := btrim(coalesce(p_address ->> 'state', ''));
  v_pin_code text := regexp_replace(
    coalesce(p_address ->> 'pinCode', ''),
    '[^0-9]',
    '',
    'g'
  );
  v_delivery_address text;
begin
  if v_owner_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Sign in before placing an order.';
  end if;

  if p_client_request_id is null then
    raise exception using
      errcode = '22023',
      message = 'Order request id is required.';
  end if;

  select existing.*
  into v_order
  from public.orders as existing
  where existing.owner_user_id = v_owner_user_id
    and existing.client_request_id = p_client_request_id;

  if found then
    return public.format_order_row(v_order);
  end if;

  select patient.*
  into v_patient
  from public.patients as patient
  where patient.id = p_patient_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Patient profile was not found.';
  end if;

  if length(v_customer_name) < 2
    or v_customer_phone !~ '^[0-9]{10}$'
    or v_pin_code !~ '^[0-9]{6}$'
    or v_address_label = ''
    or v_building = ''
    or v_area = ''
    or v_city = ''
    or v_state = ''
  then
    raise exception using
      errcode = '22023',
      message = 'Complete the delivery name, phone, and address.';
  end if;

  if jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0
    or jsonb_array_length(p_items) > 50
  then
    raise exception using
      errcode = '22023',
      message = 'Your cart must contain between 1 and 50 medicines.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as entry
    where jsonb_typeof(entry) <> 'object'
      or coalesce(entry ->> 'medicineId', '') !~
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
      or coalesce(entry ->> 'quantity', '') !~ '^[0-9]+$'
      or (entry ->> 'quantity')::integer not between 1 and 20
  ) then
    raise exception using
      errcode = '22023',
      message = 'One or more cart quantities are invalid.';
  end if;

  select
    count(*),
    count(distinct (entry ->> 'medicineId')),
    coalesce(sum((entry ->> 'quantity')::integer), 0)
  into v_item_count, v_distinct_item_count, v_total_quantity
  from jsonb_array_elements(p_items) as entry;

  if v_item_count <> v_distinct_item_count or v_total_quantity > 50 then
    raise exception using
      errcode = '22023',
      message = 'Your cart contains duplicate medicines or too many items.';
  end if;

  select hospital.*
  into v_hospital
  from public.hospitals as hospital
  where upper(btrim(hospital.name)) = 'ASIAN MULTI SPECIALITY HOSPITALS'
  limit 1;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'The fulfillment hospital is not configured.';
  end if;

  with requested as (
    select
      (entry ->> 'medicineId')::uuid as medicine_id,
      (entry ->> 'quantity')::integer as quantity
    from jsonb_array_elements(p_items) as entry
  ),
  priced as (
    select
      medicine.id,
      requested.quantity,
      round(
        coalesce(
          case when medicine.price > 0 then medicine.price end,
          49::numeric
        ) * 0.95,
        2
      )::numeric(12, 2) as unit_price
    from requested
    join public.medicines as medicine on medicine.id = requested.medicine_id
    where upper(btrim(coalesce(medicine.hospital_name, ''))) =
      'ASIAN MULTI SPECIALITY HOSPITALS'
      and nullif(btrim(coalesce(medicine.image_url, '')), '') is not null
  )
  select count(*), coalesce(sum(unit_price * quantity), 0)
  into v_matched_count, v_subtotal
  from priced;

  if v_matched_count <> v_item_count then
    raise exception using
      errcode = '22023',
      message = 'A medicine in your cart is no longer available.';
  end if;

  v_delivery_address := concat_ws(
    ', ',
    v_building,
    v_area,
    v_landmark,
    v_city,
    v_state,
    v_pin_code
  );

  insert into public.orders (
    owner_user_id,
    patient_id,
    hospital_id,
    client_request_id,
    subtotal,
    total,
    customer_name,
    customer_phone,
    address_label,
    address_building,
    address_area,
    address_landmark,
    address_city,
    address_state,
    address_pin_code,
    delivery_address,
    hospital_name,
    hospital_address,
    hospital_phone
  )
  values (
    v_owner_user_id,
    v_patient.id,
    v_hospital.id,
    p_client_request_id,
    v_subtotal,
    v_subtotal,
    v_customer_name,
    v_customer_phone,
    v_address_label,
    v_building,
    v_area,
    v_landmark,
    v_city,
    v_state,
    v_pin_code,
    v_delivery_address,
    v_hospital.name,
    nullif(btrim(coalesce(v_hospital.address, '')), ''),
    nullif(btrim(coalesce(v_hospital.phone, '')), '')
  )
  on conflict (owner_user_id, client_request_id) do nothing
  returning *
  into v_order;

  if v_order.id is null then
    select existing.*
    into v_order
    from public.orders as existing
    where existing.owner_user_id = v_owner_user_id
      and existing.client_request_id = p_client_request_id;

    return public.format_order_row(v_order);
  end if;

  insert into public.order_items (
    order_id,
    medicine_id,
    medicine_name,
    image_url,
    pack_display,
    unit_price,
    quantity,
    line_total
  )
  select
    v_order.id,
    medicine.id,
    btrim(medicine.name),
    nullif(btrim(coalesce(medicine.image_url, '')), ''),
    coalesce(
      nullif(initcap(replace(btrim(coalesce(medicine.dosage_form, '')), '_', ' ')), ''),
      nullif(btrim(coalesce(medicine.category, '')), ''),
      'Medicine'
    ),
    priced.unit_price,
    requested.quantity,
    priced.unit_price * requested.quantity
  from (
    select
      (entry ->> 'medicineId')::uuid as medicine_id,
      (entry ->> 'quantity')::integer as quantity
    from jsonb_array_elements(p_items) as entry
  ) as requested
  join public.medicines as medicine on medicine.id = requested.medicine_id
  cross join lateral (
    select round(
      coalesce(
        case when medicine.price > 0 then medicine.price end,
        49::numeric
      ) * 0.95,
      2
    )::numeric(12, 2) as unit_price
  ) as priced;

  return public.format_order_row(v_order);
end;
$$;
