-- Kai Phe database
create extension if not exists pgcrypto;

create type public.user_role as enum ('customer', 'admin');
create type public.order_status as enum ('pending', 'confirmed', 'preparing', 'out_for_delivery', 'completed', 'cancelled');
create type public.payment_method as enum ('gcash', 'maya', 'cod');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'cancelled', 'refunded');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  mobile text,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text default 'Home',
  address_line text not null,
  barangay text not null,
  city text not null,
  notes text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text not null default '',
  price numeric(10,2) not null check (price >= 0),
  image_url text,
  is_available boolean not null default true,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity int not null check (quantity > 0),
  unique(cart_id, product_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('KP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  user_id uuid not null references public.profiles(id) on delete restrict,
  customer_name text not null,
  mobile text not null,
  address_line text not null,
  barangay text not null,
  city text not null,
  notes text,
  subtotal numeric(10,2) not null check (subtotal >= 0),
  delivery_fee numeric(10,2) not null default 49 check (delivery_fee >= 0),
  total numeric(10,2) not null check (total >= 0),
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'pending',
  status public.order_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity int not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  line_total numeric(10,2) generated always as (quantity * unit_price) stored
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  provider text not null default 'manual',
  provider_payment_id text,
  provider_checkout_id text,
  method public.payment_method not null,
  status public.payment_status not null default 'pending',
  amount numeric(10,2) not null check (amount >= 0),
  receipt_path text,
  raw_status text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  gross_income numeric(10,2) not null,
  sale_date date not null default current_date,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.sales enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

drop policy if exists addresses_self on public.addresses;
create policy addresses_self on public.addresses for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories for select using (true);
drop policy if exists categories_admin_write on public.categories;
create policy categories_admin_write on public.categories for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select using (is_available = true or public.is_admin());
drop policy if exists products_admin_write on public.products;
create policy products_admin_write on public.products for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists carts_self on public.carts;
create policy carts_self on public.carts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists cart_items_self on public.cart_items;
create policy cart_items_self on public.cart_items for all using (
  exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid())
) with check (
  exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid())
);

drop policy if exists orders_self_read on public.orders;
create policy orders_self_read on public.orders for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists orders_self_insert on public.orders;
create policy orders_self_insert on public.orders for insert with check (user_id = auth.uid());
drop policy if exists orders_admin_update on public.orders;
create policy orders_admin_update on public.orders for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists order_items_self_read on public.order_items;
create policy order_items_self_read on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
);
drop policy if exists order_items_admin_write on public.order_items;
create policy order_items_admin_write on public.order_items for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists payments_self_read on public.payments;
create policy payments_self_read on public.payments for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
);
drop policy if exists payments_self_insert on public.payments;
create policy payments_self_insert on public.payments for insert with check (
  exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
);
drop policy if exists payments_admin_all on public.payments;
create policy payments_admin_all on public.payments for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists sales_admin on public.sales;
create policy sales_admin on public.sales for all using (public.is_admin()) with check (public.is_admin());

insert into public.categories(name, slug, sort_order) values
('Coffee','coffee',1),
('Iced Coffee','iced-coffee',2),
('Non-Coffee','non-coffee',3),
('Pastries','pastries',4)
on conflict (slug) do nothing;

insert into public.products(name, slug, description, price, is_featured, category_id)
select 'Kai Latte','kai-latte','Smooth espresso, steamed milk and a mellow caramel finish.',145,true,id from public.categories where slug='coffee'
on conflict (slug) do nothing;

insert into public.products(name, slug, description, price, is_featured, category_id)
select 'Cold Brew','cold-brew','Slow-steeped coffee with a clean, chocolatey finish.',150,true,id from public.categories where slug='iced-coffee'
on conflict (slug) do nothing;

insert into public.products(name, slug, description, price, is_featured, category_id)
select 'Spanish Latte','spanish-latte','Espresso, fresh milk and sweetened condensed milk.',155,true,id from public.categories where slug='coffee'
on conflict (slug) do nothing;

insert into public.products(name, slug, description, price, is_featured, category_id)
select 'Ube Cream Latte','ube-cream-latte','A Filipino-inspired latte with a soft ube cream finish.',165,true,id from public.categories where slug='non-coffee'
on conflict (slug) do nothing;

insert into public.products(name, slug, description, price, is_featured, category_id)
select 'Butter Croissant','butter-croissant','Flaky, buttery and baked for the morning rush.',110,false,id from public.categories where slug='pastries'
on conflict (slug) do nothing;

-- Storage
insert into storage.buckets(id, name, public)
values ('product-images','product-images',true), ('payment-receipts','payment-receipts',false)
on conflict (id) do nothing;

drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read on storage.objects for select using (bucket_id='product-images');
drop policy if exists product_images_admin_insert on storage.objects;
create policy product_images_admin_insert on storage.objects for insert with check (bucket_id='product-images' and public.is_admin());
drop policy if exists product_images_admin_update on storage.objects;
create policy product_images_admin_update on storage.objects for update using (bucket_id='product-images' and public.is_admin());
drop policy if exists product_images_admin_delete on storage.objects;
create policy product_images_admin_delete on storage.objects for delete using (bucket_id='product-images' and public.is_admin());

-- Helpful indexes
create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_orders_user on public.orders(user_id);
create index if not exists idx_orders_created on public.orders(created_at desc);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_sales_date on public.sales(sale_date);


-- Payment receipt storage: private bucket. Customers can upload/read only their own receipt objects.
drop policy if exists payment_receipts_customer_insert on storage.objects;
create policy payment_receipts_customer_insert on storage.objects for insert to authenticated
with check (bucket_id='payment-receipts' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists payment_receipts_customer_select on storage.objects;
create policy payment_receipts_customer_select on storage.objects for select to authenticated
using (bucket_id='payment-receipts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists payment_receipts_admin_delete on storage.objects;
create policy payment_receipts_admin_delete on storage.objects for delete to authenticated
using (bucket_id='payment-receipts' and public.is_admin());
