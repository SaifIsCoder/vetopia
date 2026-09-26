-- 1. extend roles
alter type public.app_role add value if not exists 'shelter';
alter type public.app_role add value if not exists 'seller';

-- 2. extend existing profiles
alter table public.profiles
  add column if not exists username text unique,
  add column if not exists bio text,
  add column if not exists location text,
  add column if not exists cover_url text,
  add column if not exists website text,
  add column if not exists onboarded boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

-- 3. pets
create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  species text not null default 'Dog',
  breed text,
  age text,
  sex text,
  color text,
  weight_kg numeric,
  bio text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pets_owner_idx on public.pets(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pets TO authenticated;
GRANT SELECT ON public.pets TO anon;
GRANT ALL ON public.pets TO service_role;
alter table public.pets enable row level security;

create policy "pets are publicly viewable" on public.pets for select using (true);
create policy "owner inserts own pets" on public.pets for insert to authenticated with check (owner_id = auth.uid());
create policy "owner updates own pets" on public.pets for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner deletes own pets" on public.pets for delete to authenticated using (owner_id = auth.uid());

create trigger pets_set_updated_at before update on public.pets
for each row execute function public.set_updated_at();

-- 4. business profiles (clinics / hospitals / shelters)
create table if not exists public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'clinic',
  name text not null,
  tagline text,
  about text,
  address text,
  city text,
  country text,
  phone text,
  website text,
  hours text,
  services text[] not null default '{}',
  license_number text,
  license_doc_url text,
  logo_url text,
  verification_status text not null default 'pending',
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind)
);
create index if not exists business_profiles_user_idx on public.business_profiles(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_profiles TO authenticated;
GRANT SELECT ON public.business_profiles TO anon;
GRANT ALL ON public.business_profiles TO service_role;
alter table public.business_profiles enable row level security;

create policy "approved businesses are public" on public.business_profiles for select using (verified = true and verification_status = 'approved');
create policy "owner reads own business" on public.business_profiles for select to authenticated using (user_id = auth.uid());
create policy "admins read all businesses" on public.business_profiles for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "owner creates own business" on public.business_profiles for insert to authenticated with check (user_id = auth.uid() and verified = false and verification_status = 'pending');
create policy "owner updates own business" on public.business_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admins update businesses" on public.business_profiles for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create trigger business_profiles_set_updated_at before update on public.business_profiles
for each row execute function public.set_updated_at();

-- 5. seller profiles
create table if not exists public.seller_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  store_name text not null,
  description text,
  payout_email text,
  rating numeric not null default 0,
  reviews_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_profiles TO authenticated;
GRANT SELECT ON public.seller_profiles TO anon;
GRANT ALL ON public.seller_profiles TO service_role;
alter table public.seller_profiles enable row level security;

create policy "sellers are public" on public.seller_profiles for select using (true);
create policy "owner creates own store" on public.seller_profiles for insert to authenticated with check (user_id = auth.uid());
create policy "owner updates own store" on public.seller_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger seller_profiles_set_updated_at before update on public.seller_profiles
for each row execute function public.set_updated_at();

-- 6. public profile read for social features
drop policy if exists "own profile read" on public.profiles;
create policy "profiles are publicly viewable" on public.profiles for select using (true);
GRANT SELECT ON public.profiles TO anon;