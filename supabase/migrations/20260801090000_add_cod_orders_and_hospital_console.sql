create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity (start with 1001),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  patient_id uuid not null references public.patients(id) on delete restrict,
  hospital_id uuid not null references public.hospitals(id) on delete restrict,
  client_request_id uuid not null,
  status text not null default 'placed'
    check (status in (
      'placed',
      'confirmed',
      'preparing',
      'out_for_delivery',
      'delivered',
      'cancelled'
    )),
  payment_method text not null default 'cod'
    check (payment_method = 'cod'),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'collected')),
  currency text not null default 'INR'
    check (currency = 'INR'),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  delivery_fee numeric(12, 2) not null default 0 check (delivery_fee >= 0),
  total numeric(12, 2) not null check (total >= 0),
  customer_name text not null,
  customer_phone text not null,
  address_label text not null,
  address_building text not null,
  address_area text not null,
  address_landmark text,
  address_city text not null,
  address_state text not null,
  address_pin_code text not null,
  delivery_address text not null,
  hospital_name text not null,
  hospital_address text,
  hospital_phone text,
  notification_claimed_at timestamptz,
  notification_sent_at timestamptz,
  notification_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, client_request_id),
  unique (order_number),
  check (total = subtotal + delivery_fee)
);

create index orders_hospital_status_created_idx
  on public.orders (hospital_id, status, created_at desc);
create index orders_patient_created_idx
  on public.orders (patient_id, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  medicine_id uuid not null references public.medicines(id) on delete restrict,
  medicine_name text not null,
  image_url text,
  pack_display text not null,
  unit_price numeric(12, 2) not null check (unit_price > 0),
  quantity integer not null check (quantity between 1 and 20),
  line_total numeric(12, 2) not null check (line_total > 0),
  created_at timestamptz not null default now(),
  unique (order_id, medicine_id),
  check (line_total = unit_price * quantity)
);

create index order_items_order_idx on public.order_items (order_id);

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'status_changed')),
  created_at timestamptz not null default now()
);

create index order_events_created_idx on public.order_events (created_at desc);

create table public.order_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_dashboard_config (
  singleton boolean primary key default true check (singleton),
  access_code_sha256 text not null,
  vapid_public_key text,
  updated_at timestamptz not null default now()
);

insert into public.order_dashboard_config (
  singleton,
  access_code_sha256
)
values (
  true,
  '2a4281c21b53e6b3b7d1baadab47bdaf5486178ce21574029b9068b591dd237c'
)
on conflict (singleton) do update
set access_code_sha256 = excluded.access_code_sha256,
    updated_at = now();

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.order_push_subscriptions enable row level security;
alter table public.order_dashboard_config enable row level security;

revoke all on public.orders from anon, authenticated;
revoke all on public.order_items from anon, authenticated;
revoke all on public.order_push_subscriptions from anon, authenticated;
revoke all on public.order_dashboard_config from anon, authenticated;

grant select on public.order_events to anon, authenticated;

create policy "Order event ids are realtime refresh signals"
on public.order_events
for select
to anon, authenticated
using (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'order_events'
  ) then
    alter publication supabase_realtime add table public.order_events;
  end if;
end;
$$;

create or replace function public.order_dashboard_access_is_valid(
  p_access_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select config.access_code_sha256 =
        encode(extensions.digest(coalesce(p_access_code, ''), 'sha256'), 'hex')
      from public.order_dashboard_config as config
      where config.singleton
    ),
    false
  );
$$;

revoke all on function public.order_dashboard_access_is_valid(text)
  from public;

create or replace function public.verify_order_dashboard_access(
  p_access_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.order_dashboard_access_is_valid(p_access_code);
$$;

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

revoke all on function public.format_order_row(public.orders) from public;

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
      coalesce(
        case when medicine.price > 0 then medicine.price end,
        49::numeric
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
    select coalesce(
      case when medicine.price > 0 then medicine.price end,
      49::numeric
    )::numeric(12, 2) as unit_price
  ) as priced;

  return public.format_order_row(v_order);
end;
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
    raise exception using errcode = '42501', message = 'Invalid hospital access code.';
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
          and order_row.status in ('placed', 'confirmed', 'preparing', 'out_for_delivery'))
        or order_row.status = p_filter
      )
    order by order_row.created_at desc
    limit 250
  ) as filtered;

  return v_result;
end;
$$;

create or replace function public.get_hospital_order(
  p_access_code text,
  p_order_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.order_dashboard_access_is_valid(p_access_code) then
    raise exception using errcode = '42501', message = 'Invalid hospital access code.';
  end if;

  select order_row.*
  into v_order
  from public.orders as order_row
  join public.hospitals as hospital on hospital.id = order_row.hospital_id
  where order_row.id = p_order_id
    and upper(btrim(hospital.name)) = 'ASIAN MULTI SPECIALITY HOSPITALS';

  if not found then
    raise exception using errcode = 'P0002', message = 'Order not found.';
  end if;

  return public.format_order_row(v_order);
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
    raise exception using errcode = '42501', message = 'Invalid hospital access code.';
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
    (v_order.status = 'placed' and p_status in ('confirmed', 'cancelled'))
    or (v_order.status = 'confirmed' and p_status in ('preparing', 'cancelled'))
    or (v_order.status = 'preparing' and p_status in ('out_for_delivery', 'cancelled'))
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

create or replace function public.get_order_console_config(
  p_access_code text
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
    raise exception using errcode = '42501', message = 'Invalid hospital access code.';
  end if;

  select jsonb_build_object(
    'hospital', jsonb_build_object(
      'id', hospital.id,
      'name', hospital.name,
      'address', hospital.address,
      'phone', hospital.phone
    ),
    'vapidPublicKey', config.vapid_public_key
  )
  into v_result
  from public.hospitals as hospital
  cross join public.order_dashboard_config as config
  where upper(btrim(hospital.name)) = 'ASIAN MULTI SPECIALITY HOSPITALS'
    and config.singleton
  limit 1;

  return v_result;
end;
$$;

create or replace function public.update_order_pickup_location(
  p_access_code text,
  p_address text,
  p_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hospital public.hospitals%rowtype;
  v_address text := btrim(coalesce(p_address, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
begin
  if not public.order_dashboard_access_is_valid(p_access_code) then
    raise exception using errcode = '42501', message = 'Invalid hospital access code.';
  end if;

  if length(v_address) < 8 then
    raise exception using errcode = '22023', message = 'Enter the complete hospital pickup address.';
  end if;

  update public.hospitals
  set address = v_address,
      phone = nullif(v_phone, '')
  where upper(btrim(name)) = 'ASIAN MULTI SPECIALITY HOSPITALS'
  returning *
  into v_hospital;

  if not found then
    raise exception using errcode = 'P0002', message = 'Hospital not found.';
  end if;

  return jsonb_build_object(
    'id', v_hospital.id,
    'name', v_hospital.name,
    'address', v_hospital.address,
    'phone', v_hospital.phone
  );
end;
$$;

create or replace function public.register_order_push_subscription(
  p_access_code text,
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.order_dashboard_access_is_valid(p_access_code) then
    raise exception using errcode = '42501', message = 'Invalid hospital access code.';
  end if;

  if p_endpoint !~ '^https://'
    or length(coalesce(p_p256dh, '')) < 16
    or length(coalesce(p_auth, '')) < 8
  then
    raise exception using errcode = '22023', message = 'Invalid push subscription.';
  end if;

  insert into public.order_push_subscriptions (
    endpoint,
    p256dh,
    auth,
    user_agent
  )
  values (
    p_endpoint,
    p_p256dh,
    p_auth,
    nullif(btrim(coalesce(p_user_agent, '')), '')
  )
  on conflict (endpoint) do update
  set p256dh = excluded.p256dh,
      auth = excluded.auth,
      user_agent = excluded.user_agent,
      updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.remove_order_push_subscription(
  p_access_code text,
  p_endpoint text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.order_dashboard_access_is_valid(p_access_code) then
    raise exception using errcode = '42501', message = 'Invalid hospital access code.';
  end if;

  delete from public.order_push_subscriptions where endpoint = p_endpoint;
  return found;
end;
$$;

create or replace function public.emit_order_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_events (order_id, event_type)
    values (new.id, 'created');
  elsif new.status is distinct from old.status then
    insert into public.order_events (order_id, event_type)
    values (new.id, 'status_changed');
  end if;
  return new;
end;
$$;

create trigger orders_emit_event
after insert or update of status on public.orders
for each row execute function public.emit_order_event();

do $$
begin
  if not exists (
    select 1
    from vault.secrets
    where name = 'order_webhook_secret'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'order_webhook_secret',
      'Authenticates new-order database webhooks'
    );
  end if;
end;
$$;

create or replace function public.order_webhook_secret_is_valid(
  p_webhook_secret text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select decrypted.decrypted_secret = coalesce(p_webhook_secret, '')
      from vault.decrypted_secrets as decrypted
      where decrypted.name = 'order_webhook_secret'
      limit 1
    ),
    false
  );
$$;

revoke all on function public.order_webhook_secret_is_valid(text) from public;

create or replace function public.claim_order_notification(
  p_order_id uuid,
  p_webhook_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_subscriptions jsonb;
begin
  if not public.order_webhook_secret_is_valid(p_webhook_secret) then
    raise exception using errcode = '42501', message = 'Invalid order webhook secret.';
  end if;

  update public.orders
  set notification_claimed_at = now(),
      notification_error = null
  where id = p_order_id
    and notification_sent_at is null
    and (
      notification_claimed_at is null
      or notification_claimed_at < now() - interval '5 minutes'
    )
  returning *
  into v_order;

  if not found then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', subscription.id,
        'endpoint', subscription.endpoint,
        'keys', jsonb_build_object(
          'p256dh', subscription.p256dh,
          'auth', subscription.auth
        )
      )
      order by subscription.created_at
    ),
    '[]'::jsonb
  )
  into v_subscriptions
  from public.order_push_subscriptions as subscription;

  return jsonb_build_object(
    'order', public.format_order_row(v_order),
    'subscriptions', v_subscriptions
  );
end;
$$;

create or replace function public.complete_order_notification(
  p_order_id uuid,
  p_webhook_secret text,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.order_webhook_secret_is_valid(p_webhook_secret) then
    raise exception using errcode = '42501', message = 'Invalid order webhook secret.';
  end if;

  update public.orders
  set notification_sent_at = case
        when p_error is null then now()
        else notification_sent_at
      end,
      notification_error = nullif(left(coalesce(p_error, ''), 500), ''),
      notification_claimed_at = null
  where id = p_order_id;

  return found;
end;
$$;

create or replace function public.enqueue_new_order_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_webhook_secret text;
begin
  select decrypted.decrypted_secret
  into v_webhook_secret
  from vault.decrypted_secrets as decrypted
  where decrypted.name = 'order_webhook_secret'
  limit 1;

  perform net.http_post(
    url := 'https://jlvjnnltynebenflkcua.supabase.co/functions/v1/notify-new-order',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-order-webhook-secret', v_webhook_secret
    ),
    body := jsonb_build_object('order_id', new.id),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

create trigger orders_enqueue_notification
after insert on public.orders
for each row execute function public.enqueue_new_order_notification();

grant execute on function public.verify_order_dashboard_access(text)
  to anon, authenticated;
grant execute on function public.place_cod_order(uuid, uuid, jsonb, jsonb)
  to authenticated;
grant execute on function public.list_hospital_orders(text, text)
  to anon, authenticated;
grant execute on function public.get_hospital_order(text, uuid)
  to anon, authenticated;
grant execute on function public.update_hospital_order_status(text, uuid, text)
  to anon, authenticated;
grant execute on function public.get_order_console_config(text)
  to anon, authenticated;
grant execute on function public.update_order_pickup_location(text, text, text)
  to anon, authenticated;
grant execute on function public.register_order_push_subscription(
  text,
  text,
  text,
  text,
  text
) to anon, authenticated;
grant execute on function public.remove_order_push_subscription(text, text)
  to anon, authenticated;

revoke all on function public.claim_order_notification(uuid, text) from public;
revoke all on function public.complete_order_notification(uuid, text, text)
  from public;
grant execute on function public.claim_order_notification(uuid, text)
  to service_role;
grant execute on function public.complete_order_notification(uuid, text, text)
  to service_role;

comment on table public.orders is
  'Durable COD medicine orders placed by the DRJIVA patient app.';
comment on table public.order_events is
  'Non-sensitive Realtime refresh signals; order details stay behind RPC access.';
