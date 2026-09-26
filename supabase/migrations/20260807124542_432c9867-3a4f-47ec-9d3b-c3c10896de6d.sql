-- ROLES
create type public.app_role as enum ('pet_parent','vet','admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select, insert on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "read own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);
create policy "claim own role" on public.user_roles for insert to authenticated with check (auth.uid() = user_id and role <> 'admin');

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- VETS
create table public.vet_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  specialty text not null default 'General Veterinary Medicine',
  country text not null default '',
  flag text not null default '',
  languages text[] not null default '{English}',
  price_usd numeric(10,2) not null default 29,
  slot_minutes int not null default 30,
  rating numeric(2,1) not null default 5.0,
  reviews int not null default 0,
  bio text,
  img_key text,
  timezone text not null default 'UTC',
  verified boolean not null default false,
  accepting boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.vet_profiles to anon;
grant select, insert, update on public.vet_profiles to authenticated;
grant all on public.vet_profiles to service_role;
alter table public.vet_profiles enable row level security;
create policy "vets are public" on public.vet_profiles for select using (true);
create policy "vet creates own profile" on public.vet_profiles for insert to authenticated with check (auth.uid() = user_id);
create policy "vet updates own profile" on public.vet_profiles for update to authenticated using (auth.uid() = user_id);

create table public.vet_availability (
  id uuid primary key default gen_random_uuid(),
  vet_id uuid not null references public.vet_profiles(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_minute int not null check (start_minute between 0 and 1440),
  end_minute int not null check (end_minute between 0 and 1440),
  created_at timestamptz not null default now(),
  check (end_minute > start_minute)
);
grant select on public.vet_availability to anon;
grant select, insert, update, delete on public.vet_availability to authenticated;
grant all on public.vet_availability to service_role;
alter table public.vet_availability enable row level security;
create policy "availability is public" on public.vet_availability for select using (true);
create policy "vet manages own availability" on public.vet_availability for all to authenticated
  using (exists (select 1 from public.vet_profiles v where v.id = vet_id and v.user_id = auth.uid()))
  with check (exists (select 1 from public.vet_profiles v where v.id = vet_id and v.user_id = auth.uid()));

-- APPOINTMENTS
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  vet_id uuid not null references public.vet_profiles(id) on delete cascade,
  pet_parent_id uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  mode text not null default 'video' check (mode in ('chat','audio','video')),
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled')),
  pet_name text,
  species text,
  breed text,
  pet_age text,
  symptoms text,
  urgency text,
  medications text,
  contact_phone text,
  price_usd numeric(10,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (vet_id, starts_at)
);
grant select, insert, update on public.appointments to authenticated;
grant all on public.appointments to service_role;
alter table public.appointments enable row level security;

create or replace function public.is_appointment_participant(_appointment_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.appointments a
    left join public.vet_profiles v on v.id = a.vet_id
    where a.id = _appointment_id
      and (a.pet_parent_id = _user_id or v.user_id = _user_id)
  )
$$;

create policy "participants read appointments" on public.appointments for select to authenticated
  using (pet_parent_id = auth.uid() or exists (select 1 from public.vet_profiles v where v.id = vet_id and v.user_id = auth.uid()));
create policy "pet parent books" on public.appointments for insert to authenticated
  with check (pet_parent_id = auth.uid());
create policy "participants update appointments" on public.appointments for update to authenticated
  using (pet_parent_id = auth.uid() or exists (select 1 from public.vet_profiles v where v.id = vet_id and v.user_id = auth.uid()));

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
grant select, insert on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "participants read messages" on public.messages for select to authenticated
  using (public.is_appointment_participant(appointment_id, auth.uid()));
create policy "participants send messages" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_appointment_participant(appointment_id, auth.uid()));
create index messages_appointment_idx on public.messages (appointment_id, created_at);

create table public.call_signals (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('offer','answer','ice','hangup','ring')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.call_signals to authenticated;
grant all on public.call_signals to service_role;
alter table public.call_signals enable row level security;
create policy "participants read signals" on public.call_signals for select to authenticated
  using (public.is_appointment_participant(appointment_id, auth.uid()));
create policy "participants send signals" on public.call_signals for insert to authenticated
  with check (sender_id = auth.uid() and public.is_appointment_participant(appointment_id, auth.uid()));
create policy "participants clear signals" on public.call_signals for delete to authenticated
  using (public.is_appointment_participant(appointment_id, auth.uid()));
create index call_signals_appointment_idx on public.call_signals (appointment_id, created_at);

-- profile auto-create
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- realtime
alter table public.messages replica identity full;
alter table public.call_signals replica identity full;
alter table public.appointments replica identity full;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.call_signals;
alter publication supabase_realtime add table public.appointments;

-- seed the 12 vets already shown on the site, Mon-Fri 09:00-17:00 UTC
insert into public.vet_profiles (name, specialty, country, flag, languages, price_usd, rating, reviews, img_key, verified) values
 ('Dr. Sarah Mitchell','General Veterinary Medicine','United Kingdom','🇬🇧','{English,French}',29,4.9,312,'vet1',true),
 ('Dr. Kenji Tanaka','Internal Medicine','Japan','🇯🇵','{English,Japanese,Mandarin}',35,4.8,248,'vet2',true),
 ('Dr. Amara Okafor','Dermatology','Nigeria','🇳🇬','{English,Yoruba,French}',32,5.0,184,'vet3',true),
 ('Dr. Carlos Mendes','Behavioral Medicine','Brazil','🇧🇷','{Spanish,Portuguese,English}',28,4.9,521,'vet4',true),
 ('Dr. Emma Brooks','Cardiology','United States','🇺🇸','{English}',45,4.7,198,'vet1',true),
 ('Dr. Ravi Patel','Surgery','India','🇮🇳','{English,Hindi,Gujarati}',40,4.9,402,'vet2',true),
 ('Dr. Léa Dubois','Ophthalmology','France','🇫🇷','{French,English}',38,4.8,156,'vet3',true),
 ('Dr. Marco Rossi','Emergency & Critical Care','Italy','🇮🇹','{Italian,English,Spanish}',42,4.9,287,'vet4',true),
 ('Dr. Anika Sharma','Nutrition','India','🇮🇳','{English,Hindi}',26,4.8,173,'vet1',true),
 ('Dr. Tomás García','Sport Medicine & Orthopaedics','Mexico','🇲🇽','{Spanish,English}',36,4.7,134,'vet2',true),
 ('Dr. Linh Nguyen','Dentistry','Vietnam','🇻🇳','{Vietnamese,English}',30,4.9,142,'vet3',true),
 ('Dr. Hassan Al-Farsi','Pathology & Infectious Disease','UAE','🇦🇪','{Arabic,English}',33,4.8,98,'vet4',true);

insert into public.vet_availability (vet_id, weekday, start_minute, end_minute)
select v.id, d.weekday, 540, 1020 from public.vet_profiles v cross join (values (1),(2),(3),(4),(5)) as d(weekday);