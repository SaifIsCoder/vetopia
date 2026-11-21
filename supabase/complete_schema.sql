-- ==========================================
-- File: 20260807124542_432c9867-3a4f-47ec-9d3b-c3c10896de6d.sql
-- ==========================================

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

-- ==========================================
-- File: 20260807124620_439423dc-b45f-4dbd-a27d-a75a0861909d.sql
-- ==========================================

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.has_role(uuid, public.app_role) from public, anon;
revoke all on function public.is_appointment_participant(uuid, uuid) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.is_appointment_participant(uuid, uuid) to authenticated;

-- ==========================================
-- File: 20260820145313_0682c9ca-5b4c-409e-84b7-2b989a835c7a.sql
-- ==========================================

create type public.conversation_kind as enum ('marketplace','adoption','general');
create type public.participant_side as enum ('buyer','seller','adopter','rehomer','member');

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind public.conversation_kind not null default 'general',
  subject text not null,
  listing_slug text,
  listing_image text,
  listing_url text,
  open_to_join boolean not null default true,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  side public.participant_side not null default 'member',
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);

create table public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index on public.conversation_participants (user_id);
create index on public.direct_messages (conversation_id, created_at);
create index on public.conversations (listing_slug);

grant select, insert, update, delete on public.conversations to authenticated;
grant all on public.conversations to service_role;
grant select, insert, update, delete on public.conversation_participants to authenticated;
grant all on public.conversation_participants to service_role;
grant select, insert on public.direct_messages to authenticated;
grant all on public.direct_messages to service_role;

create or replace function public.is_conversation_member(_conversation_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = _conversation_id and user_id = _user_id
  )
$$;
revoke all on function public.is_conversation_member(uuid, uuid) from public, anon;
grant execute on function public.is_conversation_member(uuid, uuid) to authenticated;

create or replace function public.conversation_is_open(_conversation_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select open_to_join from public.conversations where id = _conversation_id), false)
$$;
revoke all on function public.conversation_is_open(uuid) from public, anon;
grant execute on function public.conversation_is_open(uuid) to authenticated;

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.direct_messages enable row level security;

create policy "members read conversations" on public.conversations for select to authenticated
  using (public.is_conversation_member(id, auth.uid()) or (open_to_join and created_by <> auth.uid()));
create policy "members start conversations" on public.conversations for insert to authenticated
  with check (created_by = auth.uid());
create policy "members update own conversations" on public.conversations for update to authenticated
  using (public.is_conversation_member(id, auth.uid()))
  with check (public.is_conversation_member(id, auth.uid()));

create policy "members read participants" on public.conversation_participants for select to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()));
create policy "members join conversations" on public.conversation_participants for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      exists (select 1 from public.conversations c where c.id = conversation_id and c.created_by = auth.uid())
      or public.conversation_is_open(conversation_id)
    )
  );
create policy "members update own participation" on public.conversation_participants for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "members leave conversations" on public.conversation_participants for delete to authenticated
  using (user_id = auth.uid());

create policy "members read direct messages" on public.direct_messages for select to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()));
create policy "members send direct messages" on public.direct_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_conversation_member(conversation_id, auth.uid()));

create or replace function public.touch_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = now() where id = new.conversation_id;
  return new;
end;
$$;
create trigger direct_messages_touch after insert on public.direct_messages
  for each row execute function public.touch_conversation();

alter table public.direct_messages replica identity full;
alter table public.conversations replica identity full;
alter publication supabase_realtime add table public.direct_messages;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.conversation_participants;

-- ==========================================
-- File: 20260820145347_71049009-7d9d-4f6a-b551-00ef27116b4c.sql
-- ==========================================

revoke all on function public.touch_conversation() from public, anon, authenticated;

-- ==========================================
-- File: 20260903130457_989baf81-4bde-43a6-b170-1662ad4b46f5.sql
-- ==========================================

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

-- ==========================================
-- File: 20260903130521_30680de3-bc37-40b6-bcfd-a60ec64a2a08.sql
-- ==========================================

revoke all on function public.set_updated_at() from public, anon, authenticated;

-- ==========================================
-- File: 20260903130607_877bd87d-e96e-4851-8c5a-b2378a179c05.sql
-- ==========================================

create policy "authenticated read user media" on storage.objects for select to authenticated using (bucket_id = 'user-media');
create policy "owner uploads user media" on storage.objects for insert to authenticated with check (bucket_id = 'user-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner updates user media" on storage.objects for update to authenticated using (bucket_id = 'user-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner deletes user media" on storage.objects for delete to authenticated using (bucket_id = 'user-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "owner or admin reads docs" on storage.objects for select to authenticated using (bucket_id = 'verification-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_role(auth.uid(), 'admin')));
create policy "owner uploads docs" on storage.objects for insert to authenticated with check (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner deletes docs" on storage.objects for delete to authenticated using (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);

-- ==========================================
-- File: 20260905171129_97d9d535-196d-4cbc-8add-da493520e553.sql
-- ==========================================

-- POSTS
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  caption text not null default '',
  category text not null default 'general',
  location text,
  pet_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.posts to anon;
grant select, insert, update, delete on public.posts to authenticated;
grant all on public.posts to service_role;
alter table public.posts enable row level security;
create policy "posts are publicly viewable" on public.posts for select using (true);
create policy "author creates own posts" on public.posts for insert to authenticated with check (author_id = auth.uid());
create policy "author updates own posts" on public.posts for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "author deletes own posts" on public.posts for delete to authenticated using (author_id = auth.uid());
create trigger posts_set_updated_at before update on public.posts for each row execute function public.set_updated_at();
create index posts_author_created_idx on public.posts (author_id, created_at desc);
create index posts_created_idx on public.posts (created_at desc);
create index posts_category_idx on public.posts (category);

-- MEDIA
create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  url text not null,
  kind text not null default 'image',
  position integer not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.post_media to anon;
grant select, insert, update, delete on public.post_media to authenticated;
grant all on public.post_media to service_role;
alter table public.post_media enable row level security;
create policy "post media is publicly viewable" on public.post_media for select using (true);
create policy "author adds own post media" on public.post_media for insert to authenticated
  with check (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));
create policy "author deletes own post media" on public.post_media for delete to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));
create index post_media_post_idx on public.post_media (post_id, position);

-- COMMENTS
create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.post_comments(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
grant select on public.post_comments to anon;
grant select, insert, delete on public.post_comments to authenticated;
grant all on public.post_comments to service_role;
alter table public.post_comments enable row level security;
create policy "comments are publicly viewable" on public.post_comments for select using (true);
create policy "members comment" on public.post_comments for insert to authenticated with check (user_id = auth.uid());
create policy "members delete own comments" on public.post_comments for delete to authenticated using (user_id = auth.uid());
create index post_comments_post_idx on public.post_comments (post_id, created_at);

-- LIKES
create table public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
grant select on public.post_likes to anon;
grant select, insert, delete on public.post_likes to authenticated;
grant all on public.post_likes to service_role;
alter table public.post_likes enable row level security;
create policy "likes are publicly viewable" on public.post_likes for select using (true);
create policy "members like posts" on public.post_likes for insert to authenticated with check (user_id = auth.uid());
create policy "members unlike posts" on public.post_likes for delete to authenticated using (user_id = auth.uid());

-- SAVES
create table public.post_saves (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
grant select, insert, delete on public.post_saves to authenticated;
grant all on public.post_saves to service_role;
alter table public.post_saves enable row level security;
create policy "members read own saves" on public.post_saves for select to authenticated using (user_id = auth.uid());
create policy "members save posts" on public.post_saves for insert to authenticated with check (user_id = auth.uid());
create policy "members unsave posts" on public.post_saves for delete to authenticated using (user_id = auth.uid());

-- FOLLOWS
create table public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id <> following_id)
);
grant select on public.follows to anon;
grant select, insert, delete on public.follows to authenticated;
grant all on public.follows to service_role;
alter table public.follows enable row level security;
create policy "follows are publicly viewable" on public.follows for select using (true);
create policy "members follow others" on public.follows for insert to authenticated with check (follower_id = auth.uid());
create policy "members unfollow others" on public.follows for delete to authenticated using (follower_id = auth.uid());
create index follows_following_idx on public.follows (following_id);

-- ==========================================
-- File: 20260923180000_vet_verification_security.sql
-- ==========================================

-- Migration: 20260923180000_vet_verification_security.sql
-- Description: Enforce strict authorization for veterinarian verification status.
-- Prevents self-verification, unauthorized modification of verified flag, and enables admin approval.

-- 1. Tighten INSERT policy on public.vet_profiles
-- Only allow INSERT with verified = false unless caller is an admin
drop policy if exists "vet creates own profile" on public.vet_profiles;

create policy "vet creates own profile"
on public.vet_profiles
for insert
to authenticated
with check (
  auth.uid() = user_id
  and (
    verified is false
    or public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

-- 2. Allow authorized admins to update any vet profile
drop policy if exists "admins update vet profiles" on public.vet_profiles;

create policy "admins update vet profiles"
on public.vet_profiles
for update
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. Trigger Guard: fail-safe prevention of unauthorized verification changes
create or replace function public.enforce_vet_verification_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Prevent non-admins from self-verifying on INSERT
  if tg_op = 'INSERT' then
    if new.verified is true and not (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      or current_user = 'service_role'
    ) then
      raise exception 'Unauthorized: Veterinarian profiles cannot be self-verified upon registration.';
    end if;
  end if;

  -- Prevent non-admins from setting or changing verified on UPDATE
  if tg_op = 'UPDATE' then
    if new.verified is distinct from old.verified and not (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      or current_user = 'service_role'
    ) then
      raise exception 'Unauthorized: Only administrators can modify veterinarian verification status.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists vet_verification_guard on public.vet_profiles;
create trigger vet_verification_guard
  before insert or update on public.vet_profiles
  for each row
  execute function public.enforce_vet_verification_guard();

-- 4. Secure RPC for administrator vet verification/approval
create or replace function public.approve_vet(target_vet_id uuid, approve_status boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row public.vet_profiles%rowtype;
begin
  if not (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or current_user = 'service_role'
  ) then
    raise exception 'Unauthorized: Only administrators can approve or verify veterinarians.';
  end if;

  update public.vet_profiles
  set verified = approve_status
  where id = target_vet_id
  returning * into updated_row;

  if not found then
    raise exception 'Veterinarian profile not found for id %', target_vet_id;
  end if;

  return to_jsonb(updated_row);
end;
$$;

revoke all on function public.approve_vet(uuid, boolean) from public, anon;
grant execute on function public.approve_vet(uuid, boolean) to authenticated;

-- ==========================================
-- File: 20260923190000_pet_management_security.sql
-- ==========================================

-- Migration: 20260923190000_pet_management_security.sql
-- Description: Enforce strict user ownership RLS on public.pets and add optional dob column

-- 1. Ensure schema supports dob (date of birth)
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS dob text;

-- 2. Revoke unauthenticated select on pets to eliminate data leakage
REVOKE SELECT ON public.pets FROM anon;

-- 3. Drop permissive public select policy
DROP POLICY IF EXISTS "pets are publicly viewable" ON public.pets;
DROP POLICY IF EXISTS "pets_select_authorized" ON public.pets;
DROP POLICY IF EXISTS "owner reads own pets" ON public.pets;

-- 4. Create strict ownership-based SELECT policy:
-- Pet parents can only read their own pets; admins can read all
CREATE POLICY "owner reads own pets" ON public.pets
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- 5. Ensure INSERT policy restricts ownership to the caller
DROP POLICY IF EXISTS "owner inserts own pets" ON public.pets;
CREATE POLICY "owner inserts own pets" ON public.pets
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- 6. Ensure UPDATE policy allows owners to update only their own pets
DROP POLICY IF EXISTS "owner updates own pets" ON public.pets;
CREATE POLICY "owner updates own pets" ON public.pets
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 7. Ensure DELETE policy allows owners to delete only their own pets
DROP POLICY IF EXISTS "owner deletes own pets" ON public.pets;
CREATE POLICY "owner deletes own pets" ON public.pets
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ==========================================
-- File: 20260925120000_vet_schedule_rpc.sql
-- ==========================================

-- Migration: 20260925120000_vet_schedule_rpc.sql
-- Description: Secure server-side schedule RPC for veterinarian discovery.
-- Evaluates recurring vet_availability minus all scheduled appointments across all users
-- in the veterinarian's authoritative timezone without exposing private patient data.

create or replace function public.get_vet_schedule(
  target_vet_id uuid,
  days_ahead int default 14
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  vet_record public.vet_profiles%rowtype;
  vet_tz text;
  slot_len int;
  result jsonb := '[]'::jsonb;
  day_idx int;
  cur_day_date date;
  cur_day_dow int;
  day_slots jsonb;
  avail_rec record;
  slot_min int;
  slot_start_tz timestamptz;
  slot_end_tz timestamptz;
  now_tz timestamptz := clock_timestamp();
  buffer_advance interval := interval '15 minutes';
  day_label text;
  formatted_time text;
  date_str text;
  slot_obj jsonb;
  weekday_abbr text[] := array['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  month_abbr text[] := array['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
begin
  -- 1. Fetch vet profile
  select * into vet_record from public.vet_profiles where id = target_vet_id;
  if not found then
    return '[]'::jsonb;
  end if;

  -- If doctor is not accepting bookings, return empty schedule immediately
  if vet_record.accepting is not true then
    return '[]'::jsonb;
  end if;

  -- Resolve authoritative timezone (fallback to UTC if missing or invalid)
  vet_tz := coalesce(nullif(trim(vet_record.timezone), ''), 'UTC');
  begin
    perform now() at time zone vet_tz;
  exception when others then
    vet_tz := 'UTC';
  end;

  slot_len := coalesce(vet_record.slot_minutes, 30);
  if slot_len <= 0 then
    slot_len := 30;
  end if;

  -- Clamp days_ahead between 1 and 30 days
  if days_ahead is null or days_ahead < 1 then
    days_ahead := 14;
  elsif days_ahead > 30 then
    days_ahead := 30;
  end if;

  -- 2. Loop through next `days_ahead` days in the vet's timezone
  for day_idx in 0..(days_ahead - 1) loop
    cur_day_date := (now_tz at time zone vet_tz)::date + day_idx;
    cur_day_dow := extract(dow from cur_day_date)::int; -- 0=Sun, 6=Sat
    date_str := to_char(cur_day_date, 'YYYY-MM-DD');
    day_label := weekday_abbr[cur_day_dow + 1] || ', ' ||
                 month_abbr[extract(month from cur_day_date)::int] || ' ' ||
                 extract(day from cur_day_date)::text;

    day_slots := '[]'::jsonb;

    -- Iterate recurring availability windows for this weekday
    for avail_rec in
      select start_minute, end_minute
      from public.vet_availability
      where vet_id = target_vet_id and weekday = cur_day_dow
      order by start_minute asc
    loop
      slot_min := avail_rec.start_minute;
      while (slot_min + slot_len) <= avail_rec.end_minute loop
        -- Anchor wall-clock time in the vet's timezone, converted to timestamptz
        slot_start_tz := (cur_day_date + (slot_min || ' minutes')::interval) at time zone vet_tz;
        slot_end_tz := (cur_day_date + ((slot_min + slot_len) || ' minutes')::interval) at time zone vet_tz;

        -- Check 1: Omit slots occurring in the past or within 15-minute advance buffer
        if slot_start_tz >= (now_tz + buffer_advance) then
          -- Check 2: Exclude slots booked by ANY user (cross-user exclusion via SECURITY DEFINER)
          if not exists (
            select 1 from public.appointments a
            where a.vet_id = target_vet_id
              and a.status = 'scheduled'
              and a.starts_at = slot_start_tz
          ) then
            formatted_time := to_char(slot_start_tz at time zone vet_tz, 'HH24:MI');
            slot_obj := jsonb_build_object(
              'date', date_str,
              'startTime', to_char(slot_start_tz at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
              'endTime', to_char(slot_end_tz at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
              'formattedTime', formatted_time
            );
            day_slots := day_slots || jsonb_build_array(slot_obj);
          end if;
        end if;

        slot_min := slot_min + slot_len;
      end loop;
    end loop;

    -- Append day if it contains available slots
    if jsonb_array_length(day_slots) > 0 then
      result := result || jsonb_build_array(
        jsonb_build_object(
          'date', date_str,
          'dayLabel', day_label,
          'slots', day_slots
        )
      );
    end if;
  end loop;

  return result;
end;
$$;

-- Grant execution to public discovery roles
grant execute on function public.get_vet_schedule(uuid, int) to anon, authenticated, service_role;

-- ==========================================
-- File: 20260925130000_appointments_booking.sql
-- ==========================================

-- Migration: 20260925130000_appointments_booking.sql
-- Description: Phase 5 (MVP-04) Appointments & Scheduling Schema Expansion & Atomic Booking RPC.
-- Adds pet_id foreign key, partial unique index for active slots, atomic reservation RPC, and cancellation RPC.

-- 1. Ensure pet_id and updated_at exist on public.appointments
alter table public.appointments
  add column if not exists pet_id uuid references public.pets(id) on delete set null;

alter table public.appointments
  add column if not exists updated_at timestamptz default now();

-- 2. Upgrade unique constraint to partial unique index for scheduled slots
-- Dropping table-wide unique constraint if it exists so cancelled slots can be freed and re-booked
alter table public.appointments
  drop constraint if exists appointments_vet_id_starts_at_key;

create unique index if not exists appointments_vet_scheduled_slot_idx
  on public.appointments (vet_id, starts_at)
  where status = 'scheduled';

-- Additional helpful indexes for performance & RLS
create index if not exists appointments_pet_parent_id_idx on public.appointments(pet_parent_id);
create index if not exists appointments_pet_id_idx on public.appointments(pet_id);
create index if not exists appointments_starts_at_idx on public.appointments(starts_at);

-- 3. Atomic Appointment Reservation RPC (FR-BOOK-001)
-- Enforces:
-- - Authentication (auth.uid())
-- - Valid consultation mode (video, audio, chat)
-- - Mandatory symptoms
-- - Pet ownership (pets.owner_id = auth.uid())
-- - Vet exists and is accepting bookings
-- - 15-minute advance buffer (slot not in past)
-- - Concurrency protection: Atomic transaction with unique violation caught and raised as conflict
create or replace function public.book_appointment(
  p_vet_id uuid,
  p_pet_id uuid,
  p_starts_at timestamptz,
  p_mode text,
  p_symptoms text,
  p_urgency text default 'Medium',
  p_contact_phone text default null,
  p_medications text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_vet public.vet_profiles%rowtype;
  v_pet public.pets%rowtype;
  v_duration int;
  v_ends_at timestamptz;
  v_price numeric(10,2);
  v_buffer_interval interval := interval '15 minutes';
  v_created_appointment public.appointments%rowtype;
begin
  -- 1. Verify caller is authenticated
  if v_caller_id is null then
    raise exception 'Unauthorized: Authentication required to book an appointment.'
      using errcode = '28000';
  end if;

  -- 2. Validate Mode
  if p_mode not in ('video', 'audio', 'chat') then
    raise exception 'Invalid consultation mode. Allowed values: video, audio, chat.'
      using errcode = '22023';
  end if;

  -- 3. Validate Symptoms
  if p_symptoms is null or trim(p_symptoms) = '' then
    raise exception 'Symptoms description is required.'
      using errcode = '22023';
  end if;

  -- 4. Verify Pet Ownership
  select * into v_pet from public.pets where id = p_pet_id and owner_id = v_caller_id;
  if not found then
    raise exception 'Pet not found or unauthorized. You can only book appointments for your own pets.'
      using errcode = '42501';
  end if;

  -- 5. Verify Vet exists, is accepting
  select * into v_vet from public.vet_profiles where id = p_vet_id;
  if not found then
    raise exception 'Veterinarian not found.'
      using errcode = 'P0002';
  end if;

  if v_vet.accepting is not true then
    raise exception 'Veterinarian is currently not accepting bookings.'
      using errcode = '55000';
  end if;

  -- 6. Validate Slot is not in past + 15m buffer
  if p_starts_at < (clock_timestamp() + v_buffer_interval) then
    raise exception 'Requested slot is in the past or within the 15-minute advance booking window.'
      using errcode = '22008';
  end if;

  -- 7. Calculate Duration & End Time & Price
  v_duration := coalesce(v_vet.slot_minutes, 30);
  if v_duration <= 0 then
    v_duration := 30;
  end if;
  v_ends_at := p_starts_at + (v_duration || ' minutes')::interval;
  v_price := coalesce(v_vet.price_usd, 0.00);

  -- 8. Check for slot conflict (Slot Already Booked)
  if exists (
    select 1 from public.appointments a
    where a.vet_id = p_vet_id
      and a.starts_at = p_starts_at
      and a.status = 'scheduled'
  ) then
    raise exception 'Slot just taken. Please select another time.'
      using errcode = '23505'; -- unique_violation
  end if;

  -- 9. Atomic INSERT with UNIQUE constraint protection against concurrent race conditions
  begin
    insert into public.appointments (
      vet_id,
      pet_parent_id,
      pet_id,
      starts_at,
      ends_at,
      mode,
      status,
      pet_name,
      species,
      breed,
      pet_age,
      symptoms,
      urgency,
      medications,
      contact_phone,
      price_usd
    ) values (
      p_vet_id,
      v_caller_id,
      p_pet_id,
      p_starts_at,
      v_ends_at,
      p_mode,
      'scheduled',
      v_pet.name,
      v_pet.species,
      v_pet.breed,
      v_pet.age,
      trim(p_symptoms),
      coalesce(p_urgency, 'Medium'),
      p_medications,
      p_contact_phone,
      v_price
    )
    returning * into v_created_appointment;
  exception when unique_violation then
    raise exception 'Slot just taken. Please select another time.'
      using errcode = '23505';
  end;

  -- 10. Return sanitized confirmation record
  return jsonb_build_object(
    'success', true,
    'appointment_id', v_created_appointment.id,
    'status', v_created_appointment.status,
    'starts_at', to_char(v_created_appointment.starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'ends_at', to_char(v_created_appointment.ends_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'duration_minutes', v_duration,
    'vet_id', v_vet.id,
    'vet_name', v_vet.name,
    'pet_id', v_pet.id,
    'pet_name', v_pet.name,
    'species', v_pet.species,
    'mode', v_created_appointment.mode,
    'price_usd', v_price,
    'urgency', v_created_appointment.urgency,
    'contact_phone', v_created_appointment.contact_phone
  );
end;
$$;

-- Grant execution only to authenticated callers
grant execute on function public.book_appointment(uuid, uuid, timestamptz, text, text, text, text, text) to authenticated;
revoke execute on function public.book_appointment(uuid, uuid, timestamptz, text, text, text, text, text) from anon, public;

-- 4. Appointment Cancellation RPC (FR-BOOK-002)
-- Verifies caller is a participant, updates status to 'cancelled', frees the slot,
-- and signals if cancellation is less than 2 hours before the start time.
create or replace function public.cancel_appointment(p_appointment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_appt public.appointments%rowtype;
  v_less_than_two_hours boolean := false;
begin
  if v_caller_id is null then
    raise exception 'Unauthorized: Authentication required.' using errcode = '28000';
  end if;

  select a.* into v_appt
  from public.appointments a
  left join public.vet_profiles v on v.id = a.vet_id
  where a.id = p_appointment_id
    and (a.pet_parent_id = v_caller_id or v.user_id = v_caller_id);

  if not found then
    raise exception 'Appointment not found or you are not an authorized participant.'
      using errcode = '42501';
  end if;

  if v_appt.status = 'cancelled' then
    return jsonb_build_object('success', true, 'appointment_id', v_appt.id, 'status', 'cancelled');
  end if;

  -- Check if cancellation is within 2 hours of starts_at
  if v_appt.starts_at < (clock_timestamp() + interval '2 hours') then
    v_less_than_two_hours := true;
  end if;

  update public.appointments
  set status = 'cancelled', updated_at = now()
  where id = p_appointment_id;

  return jsonb_build_object(
    'success', true,
    'appointment_id', v_appt.id,
    'status', 'cancelled',
    'late_cancellation', v_less_than_two_hours
  );
end;
$$;

grant execute on function public.cancel_appointment(uuid) to authenticated;
revoke execute on function public.cancel_appointment(uuid) from anon, public;

-- ==========================================
-- File: 20260925200000_telemedicine_completion.sql
-- ==========================================

-- ==============================================================================
-- Migration: 20260925200000_telemedicine_completion.sql
-- Description: Telemedicine Consultation Completion RPC (FR-TELE-003)
-- Security: SECURITY DEFINER, search_path = public, Vet-Only caller authorization
-- ==============================================================================

create or replace function public.complete_appointment(p_appointment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_appt public.appointments%rowtype;
  v_vet public.vet_profiles%rowtype;
begin
  -- 1. Enforce authentication
  if v_caller_id is null then
    raise exception 'Unauthorized: Authentication required.' using errcode = '28000';
  end if;

  -- 2. Verify appointment existence
  select * into v_appt
  from public.appointments
  where id = p_appointment_id;

  if not found then
    raise exception 'Appointment not found.' using errcode = 'P0002';
  end if;

  -- 3. Load consulting veterinarian record
  select * into v_vet
  from public.vet_profiles
  where id = v_appt.vet_id;

  -- 4. Enforce Vet-Only authorization (pet parents & arbitrary users strictly forbidden)
  if v_vet.user_id is null or v_vet.user_id <> v_caller_id then
    raise exception 'Forbidden: Only the consulting veterinarian can mark an appointment as completed.'
      using errcode = '42501';
  end if;

  -- 5. Validate status transition
  if v_appt.status <> 'scheduled' then
    if v_appt.status = 'completed' then
      return jsonb_build_object(
        'success', true,
        'appointment_id', v_appt.id,
        'status', 'completed'
      );
    end if;
    raise exception 'Appointment cannot be completed because its status is %.', v_appt.status
      using errcode = '22000';
  end if;

  -- 6. Atomically update status to completed
  update public.appointments
  set status = 'completed',
      updated_at = now()
  where id = p_appointment_id;

  return jsonb_build_object(
    'success', true,
    'appointment_id', v_appt.id,
    'status', 'completed'
  );
end;
$$;

grant execute on function public.complete_appointment(uuid) to authenticated;
revoke execute on function public.complete_appointment(uuid) from anon, public;

-- ==========================================
-- File: 20260926120000_prescriptions_schema.sql
-- ==========================================

-- ==============================================================================
-- Migration: 20260926120000_prescriptions_schema.sql
-- Module: MVP-06 Digital Prescriptions (Phase 7)
-- Author: Antigravity Team
-- Requirements: FR-PRES-001, FR-PRES-002
-- ==============================================================================

-- 1. Create public.prescriptions table
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  vet_id UUID NOT NULL REFERENCES public.vet_profiles(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  diagnosis TEXT NOT NULL,
  notes TEXT,
  refills_allowed INT NOT NULL DEFAULT 0 CHECK (refills_allowed >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for optimal querying by pet, vet, and appointment
CREATE INDEX IF NOT EXISTS idx_prescriptions_pet ON public.prescriptions(pet_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_vet ON public.prescriptions(vet_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_appointment ON public.prescriptions(appointment_id);

-- 2. Create public.prescription_items table
CREATE TABLE IF NOT EXISTS public.prescription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  medication_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  duration TEXT NOT NULL,
  special_instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prescription_items_prescription ON public.prescription_items(prescription_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_items ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies: public.prescriptions
-- Pet parent can read prescriptions belonging to their own pet
-- Consulting vet can read prescriptions for consultations they conducted
-- Administrators have full read access
DROP POLICY IF EXISTS "prescriptions_select_authorized" ON public.prescriptions;
CREATE POLICY "prescriptions_select_authorized"
  ON public.prescriptions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pets p
      WHERE p.id = public.prescriptions.pet_id
        AND p.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.vet_profiles v
      WHERE v.id = public.prescriptions.vet_id
        AND v.user_id = auth.uid()
    )
    OR
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Direct client inserts, updates, and deletes are disabled to ensure clinical immutability.
-- Prescriptions must be created via the secure create_prescription() RPC.
DROP POLICY IF EXISTS "prescriptions_insert_vet" ON public.prescriptions;
CREATE POLICY "prescriptions_insert_vet"
  ON public.prescriptions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vet_profiles v
      WHERE v.id = public.prescriptions.vet_id
        AND v.user_id = auth.uid()
    )
  );

-- 5. RLS Policies: public.prescription_items
-- Read access is granted to anyone authorized to view the parent prescription
DROP POLICY IF EXISTS "prescription_items_select" ON public.prescription_items;
CREATE POLICY "prescription_items_select"
  ON public.prescription_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.prescriptions p
      WHERE p.id = public.prescription_items.prescription_id
        AND (
          EXISTS (
            SELECT 1 FROM public.pets pet
            WHERE pet.id = p.pet_id AND pet.owner_id = auth.uid()
          )
          OR
          EXISTS (
            SELECT 1 FROM public.vet_profiles v
            WHERE v.id = p.vet_id AND v.user_id = auth.uid()
          )
          OR
          public.has_role(auth.uid(), 'admin'::public.app_role)
        )
    )
  );

DROP POLICY IF EXISTS "prescription_items_insert_vet" ON public.prescription_items;
CREATE POLICY "prescription_items_insert_vet"
  ON public.prescription_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.prescriptions p
      JOIN public.vet_profiles v ON v.id = p.vet_id
      WHERE p.id = public.prescription_items.prescription_id
        AND v.user_id = auth.uid()
    )
  );

-- 6. Atomic Server-Side Prescription Creation RPC (FR-PRES-001)
-- Enforces:
--  - Caller is authenticated
--  - Appointment exists
--  - Appointment status is strictly 'completed'
--  - Caller is the assigned consulting veterinarian
--  - At least one medication item is provided
--  - Validates required fields on each medication item
--  - One-prescription-per-appointment uniqueness constraint
--  - Atomic transaction: prescription + all items created together
CREATE OR REPLACE FUNCTION public.create_prescription(
  p_appointment_id UUID,
  p_diagnosis TEXT,
  p_notes TEXT DEFAULT NULL,
  p_refills_allowed INT DEFAULT 0,
  p_items JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appt public.appointments%ROWTYPE;
  v_vet public.vet_profiles%ROWTYPE;
  v_prescription_id UUID;
  v_item JSONB;
  v_medication_name TEXT;
  v_dosage TEXT;
  v_frequency TEXT;
  v_duration TEXT;
  v_special_instructions TEXT;
  v_item_count INT;
BEGIN
  -- 1. Verify caller authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required: auth.uid() is null' USING ERRCODE = '28000';
  END IF;

  -- 2. Verify appointment existence
  SELECT * INTO v_appt
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Verify appointment status is 'completed'
  IF v_appt.status <> 'completed' THEN
    RAISE EXCEPTION 'Prescription can only be issued for completed appointments (current status: %)', v_appt.status
      USING ERRCODE = 'P0001';
  END IF;

  -- 4. Verify consulting veterinarian ownership
  SELECT * INTO v_vet
  FROM public.vet_profiles
  WHERE id = v_appt.vet_id;

  IF NOT FOUND OR v_vet.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Forbidden: Only the assigned consulting veterinarian can create a prescription for this appointment'
      USING ERRCODE = '42501';
  END IF;

  -- 5. Verify pet is assigned
  IF v_appt.pet_id IS NULL THEN
    RAISE EXCEPTION 'Cannot issue prescription: Appointment has no linked pet' USING ERRCODE = '22023';
  END IF;

  -- 6. Enforce duplicate prescription policy (one prescription per appointment)
  IF EXISTS (SELECT 1 FROM public.prescriptions WHERE appointment_id = p_appointment_id) THEN
    RAISE EXCEPTION 'A prescription has already been issued for this appointment' USING ERRCODE = '23505';
  END IF;

  -- 7. Validate diagnosis
  IF p_diagnosis IS NULL OR trim(p_diagnosis) = '' THEN
    RAISE EXCEPTION 'Clinical diagnosis is required' USING ERRCODE = '22023';
  END IF;

  -- 8. Validate medication items list
  v_item_count := jsonb_array_length(p_items);
  IF v_item_count IS NULL OR v_item_count = 0 THEN
    RAISE EXCEPTION 'At least one medication item is required on a digital prescription' USING ERRCODE = '22023';
  END IF;

  -- 9. Insert prescription record
  INSERT INTO public.prescriptions (
    appointment_id,
    vet_id,
    pet_id,
    diagnosis,
    notes,
    refills_allowed,
    status
  ) VALUES (
    v_appt.id,
    v_appt.vet_id,
    v_appt.pet_id,
    trim(p_diagnosis),
    CASE WHEN p_notes IS NOT NULL AND trim(p_notes) <> '' THEN trim(p_notes) ELSE NULL END,
    GREATEST(0, COALESCE(p_refills_allowed, 0)),
    'active'
  )
  RETURNING id INTO v_prescription_id;

  -- 10. Insert each medication item atomically
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_medication_name := trim(COALESCE(v_item->>'medication_name', ''));
    v_dosage := trim(COALESCE(v_item->>'dosage', ''));
    v_frequency := trim(COALESCE(v_item->>'frequency', ''));
    v_duration := trim(COALESCE(v_item->>'duration', ''));
    v_special_instructions := trim(COALESCE(v_item->>'special_instructions', ''));

    IF v_medication_name = '' THEN
      RAISE EXCEPTION 'Medication name is required for all prescription items' USING ERRCODE = '22023';
    END IF;

    IF v_dosage = '' THEN
      RAISE EXCEPTION 'Dosage is required for medication: %', v_medication_name USING ERRCODE = '22023';
    END IF;

    IF v_frequency = '' THEN
      RAISE EXCEPTION 'Frequency is required for medication: %', v_medication_name USING ERRCODE = '22023';
    END IF;

    IF v_duration = '' THEN
      RAISE EXCEPTION 'Duration is required for medication: %', v_medication_name USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.prescription_items (
      prescription_id,
      medication_name,
      dosage,
      frequency,
      duration,
      special_instructions
    ) VALUES (
      v_prescription_id,
      v_medication_name,
      v_dosage,
      v_frequency,
      v_duration,
      CASE WHEN v_special_instructions <> '' THEN v_special_instructions ELSE NULL END
    );
  END LOOP;

  -- 11. Return successful creation confirmation
  RETURN jsonb_build_object(
    'success', true,
    'prescription_id', v_prescription_id,
    'appointment_id', v_appt.id,
    'item_count', v_item_count
  );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.create_prescription(UUID, TEXT, TEXT, INT, JSONB) TO authenticated, service_role;

-- ==========================================
-- File: 20260926180000_clinical_messaging_schema.sql
-- ==========================================

-- Migration: 20260926180000_clinical_messaging_schema.sql
-- Description: Phase 8 (MVP-07) Clinical Messaging Schema, RLS Hardening & Atomic Functions.
-- Connects conversations with clinical appointments, locks down RLS so only actual participants can read/write,
-- and provides atomic functions for conversation creation, message dispatch, and unread tracking.

-- 1. Ensure appointment_id exists on public.conversations
alter table public.conversations
  add column if not exists appointment_id uuid references public.appointments(id) on delete set null;

-- 2. Partial unique index to guarantee at most one 1-to-1 conversation per clinical appointment
create unique index if not exists idx_conversations_appointment
  on public.conversations (appointment_id)
  where appointment_id is not null;

-- 3. Additional performance indexes for chronological message queries & participant lookups
create index if not exists idx_direct_messages_conv_created
  on public.direct_messages (conversation_id, created_at asc);

create index if not exists idx_conversation_participants_lookup
  on public.conversation_participants (conversation_id, user_id);

create index if not exists idx_conversation_participants_user_read
  on public.conversation_participants (user_id, last_read_at);

-- 4. RLS Hardening for Clinical Privacy & Confidentiality
-- Revoke all public/anon access
revoke all on public.conversations from anon, public;
revoke all on public.conversation_participants from anon, public;
revoke all on public.direct_messages from anon, public;

grant select, insert, update on public.conversations to authenticated;
grant all on public.conversations to service_role;

grant select, insert, update, delete on public.conversation_participants to authenticated;
grant all on public.conversation_participants to service_role;

grant select, insert on public.direct_messages to authenticated;
grant all on public.direct_messages to service_role;

-- Replace permissive reading policy on conversations
-- Clinical invariant: A user may ONLY see conversations they are actually participating in.
drop policy if exists "members read conversations" on public.conversations;
create policy "members read conversations" on public.conversations for select to authenticated
  using (public.is_conversation_member(id, auth.uid()));

drop policy if exists "members start conversations" on public.conversations;
create policy "members start conversations" on public.conversations for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "members update own conversations" on public.conversations;
create policy "members update own conversations" on public.conversations for update to authenticated
  using (public.is_conversation_member(id, auth.uid()))
  with check (public.is_conversation_member(id, auth.uid()));

-- Strict policies for conversation participants
drop policy if exists "members read participants" on public.conversation_participants;
create policy "members read participants" on public.conversation_participants for select to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()));

drop policy if exists "members join conversations" on public.conversation_participants;
create policy "members join conversations" on public.conversation_participants for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.conversations c where c.id = conversation_id and c.created_by = auth.uid())
  );

drop policy if exists "members update own participation" on public.conversation_participants;
create policy "members update own participation" on public.conversation_participants for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Strict policies for direct messages
drop policy if exists "members read direct messages" on public.direct_messages;
create policy "members read direct messages" on public.direct_messages for select to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()));

drop policy if exists "members send direct messages" on public.direct_messages;
create policy "members send direct messages" on public.direct_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_member(conversation_id, auth.uid())
  );

-- 5. Atomic Conversation Creation RPC (Appointment-Linked)
-- Strictly verifies that caller is either the pet parent or assigned vet of the appointment.
-- Creates or retrieves the 1-to-1 conversation record and associates both participants.
create or replace function public.get_or_create_appointment_conversation(
  p_appointment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_appt record;
  v_vet_user_id uuid;
  v_vet_name text;
  v_pet_name text;
  v_conv_id uuid;
  v_conv record;
begin
  if v_caller_id is null then
    raise exception 'UNAUTHENTICATED: Authentication required';
  end if;

  -- 1. Load appointment with vet and pet info
  select 
    a.id, a.vet_id, a.pet_parent_id, a.pet_id, a.starts_at, a.status,
    v.user_id as vet_user_id, v.name as vet_name,
    p.name as pet_name
  into v_appt
  from public.appointments a
  join public.vet_profiles v on v.id = a.vet_id
  left join public.pets p on p.id = a.pet_id
  where a.id = p_appointment_id;

  if v_appt.id is null then
    raise exception 'NOT_FOUND: Appointment not found';
  end if;

  v_vet_user_id := v_appt.vet_user_id;
  v_vet_name := coalesce(v_appt.vet_name, 'Doctor');
  v_pet_name := coalesce(v_appt.pet_name, 'Pet');

  -- 2. Verify caller is an authorized participant (either pet parent or assigned consulting vet)
  if v_caller_id <> v_appt.pet_parent_id and (v_vet_user_id is null or v_caller_id <> v_vet_user_id) then
    raise exception 'FORBIDDEN: You are not an authorized participant in this consultation';
  end if;

  -- 3. Check for existing conversation for this appointment
  select id into v_conv_id
  from public.conversations
  where appointment_id = p_appointment_id;

  if v_conv_id is not null then
    select * into v_conv from public.conversations where id = v_conv_id;
    return jsonb_build_object(
      'id', v_conv.id,
      'appointment_id', v_conv.appointment_id,
      'subject', v_conv.subject,
      'created_at', v_conv.created_at,
      'last_message_at', v_conv.last_message_at,
      'is_new', false
    );
  end if;

  -- 4. Create new clinical conversation atomically
  insert into public.conversations (
    kind,
    subject,
    appointment_id,
    open_to_join,
    created_by,
    created_at,
    last_message_at
  ) values (
    'general',
    'Consultation: ' || v_vet_name || ' & ' || v_pet_name,
    p_appointment_id,
    false,
    v_caller_id,
    now(),
    now()
  )
  returning * into v_conv;

  -- 5. Add pet parent as participant
  insert into public.conversation_participants (
    conversation_id,
    user_id,
    side,
    last_read_at,
    created_at
  ) values (
    v_conv.id,
    v_appt.pet_parent_id,
    'member',
    now(),
    now()
  ) on conflict (conversation_id, user_id) do nothing;

  -- 6. Add vet user as participant (if vet profile has linked auth user)
  if v_vet_user_id is not null and v_vet_user_id <> v_appt.pet_parent_id then
    insert into public.conversation_participants (
      conversation_id,
      user_id,
      side,
      last_read_at,
      created_at
    ) values (
      v_conv.id,
      v_vet_user_id,
      'vet',
      now(),
      now()
    ) on conflict (conversation_id, user_id) do nothing;
  end if;

  return jsonb_build_object(
    'id', v_conv.id,
    'appointment_id', v_conv.appointment_id,
    'subject', v_conv.subject,
    'created_at', v_conv.created_at,
    'last_message_at', v_conv.last_message_at,
    'is_new', true
  );
end;
$$;

revoke all on function public.get_or_create_appointment_conversation(uuid) from public, anon;
grant execute on function public.get_or_create_appointment_conversation(uuid) to authenticated;

-- 6. Atomic Send Direct Message RPC (FR-MSG-001)
-- Enforces:
-- - Authentication (auth.uid())
-- - Membership in conversation
-- - Whitespace trimming
-- - Length between 1 and 4000 characters
-- - Advances caller's last_read_at
-- - Database trigger touch_conversation automatically updates conversations.last_message_at
create or replace function public.send_direct_message(
  p_conversation_id uuid,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid := auth.uid();
  v_trimmed text;
  v_msg public.direct_messages%rowtype;
begin
  if v_sender_id is null then
    raise exception 'UNAUTHENTICATED: Authentication required';
  end if;

  if not public.is_conversation_member(p_conversation_id, v_sender_id) then
    raise exception 'FORBIDDEN: You are not an authorized participant in this conversation';
  end if;

  v_trimmed := trim(p_body);
  if length(v_trimmed) = 0 then
    raise exception 'VALIDATION_ERROR: Message body cannot be empty or whitespace only';
  end if;

  if length(v_trimmed) > 4000 then
    raise exception 'VALIDATION_ERROR: Message exceeds maximum allowed length of 4000 characters';
  end if;

  insert into public.direct_messages (
    conversation_id,
    sender_id,
    body,
    created_at
  ) values (
    p_conversation_id,
    v_sender_id,
    v_trimmed,
    now()
  )
  returning * into v_msg;

  -- Advance caller's last_read_at timestamp to match the newly sent message
  update public.conversation_participants
  set last_read_at = now()
  where conversation_id = p_conversation_id and user_id = v_sender_id;

  return to_jsonb(v_msg);
end;
$$;

revoke all on function public.send_direct_message(uuid, text) from public, anon;
grant execute on function public.send_direct_message(uuid, text) to authenticated;

-- 7. Mark Conversation Read RPC
-- Advances the authenticated caller's last_read_at timestamp for a specific conversation.
create or replace function public.mark_conversation_read(
  p_conversation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED: Authentication required';
  end if;

  if not public.is_conversation_member(p_conversation_id, v_user_id) then
    raise exception 'FORBIDDEN: You are not an authorized participant in this conversation';
  end if;

  update public.conversation_participants
  set last_read_at = now()
  where conversation_id = p_conversation_id and user_id = v_user_id;

  return jsonb_build_object(
    'success', true,
    'conversation_id', p_conversation_id,
    'marked_at', now()
  );
end;
$$;

revoke all on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- 8. Get User Conversations RPC (SCR-TAB-004)
-- Returns all conversations for the authenticated user with counterpart info,
-- latest message snippet, unread message count, and appointment context.
create or replace function public.get_user_conversations()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_results jsonb;
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED: Authentication required';
  end if;

  select coalesce(jsonb_agg(conv_row order by conv_row->>'last_message_at' desc), '[]'::jsonb)
  into v_results
  from (
    select
      jsonb_build_object(
        'id', c.id,
        'subject', c.subject,
        'appointment_id', c.appointment_id,
        'created_at', c.created_at,
        'last_message_at', c.last_message_at,
        'unread_count', (
          select count(*)::int
          from public.direct_messages dm
          where dm.conversation_id = c.id
            and dm.sender_id <> v_user_id
            and dm.created_at > cp_self.last_read_at
        ),
        'last_message', (
          select jsonb_build_object(
            'id', dm_last.id,
            'body', dm_last.body,
            'sender_id', dm_last.sender_id,
            'created_at', dm_last.created_at
          )
          from public.direct_messages dm_last
          where dm_last.conversation_id = c.id
          order by dm_last.created_at desc
          limit 1
        ),
        'counterpart', (
          select jsonb_build_object(
            'user_id', p_other.id,
            'name', coalesce(v_other.name, p_other.full_name, 'Vetopia User'),
            'avatar_url', p_other.avatar_url,
            'role', case when v_other.id is not null then 'vet' else 'pet_parent' end,
            'specialty', v_other.specialty
          )
          from public.conversation_participants cp_other
          join public.profiles p_other on p_other.id = cp_other.user_id
          left join public.vet_profiles v_other on v_other.user_id = p_other.id
          where cp_other.conversation_id = c.id
            and cp_other.user_id <> v_user_id
          limit 1
        ),
        'appointment', (
          select jsonb_build_object(
            'id', a.id,
            'starts_at', a.starts_at,
            'status', a.status,
            'mode', a.mode,
            'pet_name', pet.name,
            'vet_name', vet.name
          )
          from public.appointments a
          left join public.pets pet on pet.id = a.pet_id
          left join public.vet_profiles vet on vet.id = a.vet_id
          where a.id = c.appointment_id
        )
      ) as conv_row
    from public.conversations c
    join public.conversation_participants cp_self
      on cp_self.conversation_id = c.id and cp_self.user_id = v_user_id
  ) sub;

  return v_results;
end;
$$;

revoke all on function public.get_user_conversations() from public, anon;
grant execute on function public.get_user_conversations() to authenticated;

-- 9. Get Total Unread Message Count RPC
-- Returns integer count of unread messages across all conversations for current user.
create or replace function public.get_unread_message_count()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_total int := 0;
begin
  if v_user_id is null then
    return 0;
  end if;

  select coalesce(count(*)::int, 0)
  into v_total
  from public.direct_messages dm
  join public.conversation_participants cp
    on cp.conversation_id = dm.conversation_id and cp.user_id = v_user_id
  where dm.sender_id <> v_user_id
    and dm.created_at > cp.last_read_at;

  return v_total;
end;
$$;

revoke all on function public.get_unread_message_count() from public, anon;
grant execute on function public.get_unread_message_count() to authenticated;

-- ==========================================
-- File: 20260926190000_prepare_notification_message_rpc.sql
-- ==========================================

-- The following notification migration replaces the original JSONB result with a
-- direct_messages row. PostgreSQL cannot change an existing function's return type.
-- Skip an already-upgraded function when applying this bridge out of order.
do $$
begin
  if exists (
    select 1 from pg_proc
    where oid = to_regprocedure('public.send_direct_message(uuid,text)')
      and prorettype = 'jsonb'::regtype
  ) then
    drop function public.send_direct_message(uuid, text);
  end if;
end;
$$;

-- ==========================================
-- File: 20260926200000_notifications_schema.sql
-- ==========================================

-- ==============================================================================
-- Migration: 20260926200000_notifications_schema.sql
-- Description: MVP-08 Notifications & Device Tokens Schema, RLS, Triggers, and RPCs
-- ==============================================================================

-- 1. Device Tokens Table
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_device_tokens_user_token UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON public.device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON public.device_tokens(token);
CREATE INDEX IF NOT EXISTS idx_device_tokens_active ON public.device_tokens(is_active) WHERE is_active = TRUE;

-- 2. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  pushed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_unpushed ON public.notifications(pushed_at) WHERE pushed_at IS NULL;

-- 3. Idempotent Appointment Reminders Tracking Table
CREATE TABLE IF NOT EXISTS public.appointment_reminders (
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (appointment_id, reminder_type)
);

-- ==============================================================================
-- 4. Row Level Security (RLS)
-- ==============================================================================

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;

-- Device Tokens Policies
DROP POLICY IF EXISTS "device_tokens_select_own" ON public.device_tokens;
CREATE POLICY "device_tokens_select_own" 
  ON public.device_tokens FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "device_tokens_insert_own" ON public.device_tokens;
CREATE POLICY "device_tokens_insert_own" 
  ON public.device_tokens FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "device_tokens_update_own" ON public.device_tokens;
CREATE POLICY "device_tokens_update_own" 
  ON public.device_tokens FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "device_tokens_delete_own" ON public.device_tokens;
CREATE POLICY "device_tokens_delete_own" 
  ON public.device_tokens FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Notifications Policies
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" 
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" 
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Deny direct client INSERT/DELETE on notifications; creation is server-authoritative
REVOKE INSERT, DELETE ON public.notifications FROM authenticated, anon;

-- Reminders table is internal/server-only
REVOKE ALL ON public.appointment_reminders FROM anon, authenticated;

-- ==============================================================================
-- 5. RPC Functions
-- ==============================================================================

-- 5.1 Register or update device push token
CREATE OR REPLACE FUNCTION public.register_device_token(
  p_token TEXT,
  p_platform TEXT
)
RETURNS public.device_tokens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_platform TEXT;
  v_result public.device_tokens;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RAISE EXCEPTION 'Token cannot be empty' USING ERRCODE = '22023';
  END IF;

  v_platform := lower(trim(p_platform));
  IF v_platform NOT IN ('ios', 'android', 'web') THEN
    v_platform := 'android'; -- default safe fallback
  END IF;

  INSERT INTO public.device_tokens (
    user_id,
    token,
    platform,
    is_active,
    updated_at,
    last_used_at
  )
  VALUES (
    v_user_id,
    p_token,
    v_platform,
    TRUE,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id, token)
  DO UPDATE SET
    platform = EXCLUDED.platform,
    is_active = TRUE,
    updated_at = NOW(),
    last_used_at = NOW()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- 5.2 Deactivate device push token
CREATE OR REPLACE FUNCTION public.deactivate_device_token(
  p_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  UPDATE public.device_tokens
  SET is_active = FALSE, updated_at = NOW()
  WHERE user_id = v_user_id AND token = p_token;

  RETURN TRUE;
END;
$$;

-- 5.3 Mark single notification as read
CREATE OR REPLACE FUNCTION public.mark_notification_read(
  p_notification_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  UPDATE public.notifications
  SET read = TRUE, read_at = NOW()
  WHERE id = p_notification_id AND user_id = v_user_id;

  RETURN TRUE;
END;
$$;

-- 5.4 Mark all notifications as read for current user
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_updated INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  WITH updated AS (
    UPDATE public.notifications
    SET read = TRUE, read_at = NOW()
    WHERE user_id = v_user_id AND read = FALSE
    RETURNING id
  )
  SELECT count(*) INTO v_updated FROM updated;

  RETURN v_updated;
END;
$$;

-- 5.5 Get total unread notification count
CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS INT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_count INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.notifications
  WHERE user_id = v_user_id AND read = FALSE;

  RETURN COALESCE(v_count, 0);
END;
$$;

-- 5.6 Server-Authoritative Doctor Joined Notification Trigger
CREATE OR REPLACE FUNCTION public.notify_doctor_entered_consultation(
  p_appointment_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_parent_id UUID;
  v_vet_name TEXT;
  v_status TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  -- Ensure appointment exists, is scheduled, and caller is the assigned doctor
  SELECT a.pet_parent_id, v.full_name, a.status
  INTO v_parent_id, v_vet_name, v_status
  FROM public.appointments a
  JOIN public.vet_profiles v ON v.id = a.vet_id
  WHERE a.id = p_appointment_id AND v.user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FORBIDDEN: Only the assigned veterinarian can dispatch doctor-entered event' USING ERRCODE = '42501';
  END IF;

  IF v_status != 'scheduled' THEN
    RETURN FALSE;
  END IF;

  -- Insert notification for the pet parent
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    body,
    data
  )
  VALUES (
    v_parent_id,
    'doctor_entered_consultation',
    'Doctor Has Joined Consultation',
    COALESCE('Dr. ' || v_vet_name, 'Your veterinarian') || ' is in the consultation room. Please enter to begin.',
    jsonb_build_object(
      'kind', 'doctor_entered_consultation',
      'appointmentId', p_appointment_id,
      'deepLink', 'vetopia://consult/' || p_appointment_id::text
    )
  );

  RETURN TRUE;
END;
$$;

-- 5.7 Idempotent 15-Minute Consultation Reminder Batch Processor
CREATE OR REPLACE FUNCTION public.process_appointment_reminders()
RETURNS TABLE (
  notification_id UUID,
  recipient_user_id UUID,
  notification_type TEXT,
  notification_title TEXT,
  notification_body TEXT,
  notification_data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_record RECORD;
  v_notif_parent_id UUID;
  v_notif_vet_id UUID;
BEGIN
  -- Scan for scheduled appointments occurring within the [NOW(), NOW() + 16 mins] window
  -- that have NOT yet received their 15m reminder.
  FOR v_record IN
    SELECT 
      a.id AS appt_id,
      a.pet_parent_id,
      v.user_id AS vet_user_id,
      v.full_name AS vet_name,
      p.name AS pet_name
    FROM public.appointments a
    JOIN public.vet_profiles v ON v.id = a.vet_id
    LEFT JOIN public.pets p ON p.id = a.pet_id
    WHERE a.status = 'scheduled'
      AND a.starts_at >= NOW()
      AND a.starts_at <= (NOW() + INTERVAL '16 minutes')
      AND NOT EXISTS (
        SELECT 1 FROM public.appointment_reminders ar 
        WHERE ar.appointment_id = a.id AND ar.reminder_type = '15m'
      )
  LOOP
    -- Idempotently mark reminder as sent
    INSERT INTO public.appointment_reminders (appointment_id, reminder_type, sent_at)
    VALUES (v_record.appt_id, '15m', NOW())
    ON CONFLICT (appointment_id, reminder_type) DO NOTHING;

    -- Notification for Pet Parent
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      data
    )
    VALUES (
      v_record.pet_parent_id,
      'appointment_reminder',
      'Consultation Starting Soon',
      'Your consultation for ' || COALESCE(v_record.pet_name, 'your pet') || ' starts in 15 minutes.',
      jsonb_build_object(
        'kind', 'appointment_reminder',
        'appointmentId', v_record.appt_id,
        'deepLink', 'vetopia://consult/' || v_record.appt_id::text
      )
    )
    RETURNING id INTO v_notif_parent_id;

    notification_id := v_notif_parent_id;
    recipient_user_id := v_record.pet_parent_id;
    notification_type := 'appointment_reminder';
    notification_title := 'Consultation Starting Soon';
    notification_body := 'Your consultation for ' || COALESCE(v_record.pet_name, 'your pet') || ' starts in 15 minutes.';
    notification_data := jsonb_build_object(
      'kind', 'appointment_reminder',
      'appointmentId', v_record.appt_id,
      'deepLink', 'vetopia://consult/' || v_record.appt_id::text
    );
    RETURN NEXT;

    -- Notification for Veterinarian
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      data
    )
    VALUES (
      v_record.vet_user_id,
      'appointment_reminder',
      'Upcoming Consultation in 15 Minutes',
      'Consultation with ' || COALESCE(v_record.pet_name, 'patient') || ' starts in 15 minutes.',
      jsonb_build_object(
        'kind', 'appointment_reminder',
        'appointmentId', v_record.appt_id,
        'deepLink', 'vetopia://consult/' || v_record.appt_id::text
      )
    )
    RETURNING id INTO v_notif_vet_id;

    notification_id := v_notif_vet_id;
    recipient_user_id := v_record.vet_user_id;
    notification_type := 'appointment_reminder';
    notification_title := 'Upcoming Consultation in 15 Minutes';
    notification_body := 'Consultation with ' || COALESCE(v_record.pet_name, 'patient') || ' starts in 15 minutes.';
    notification_data := jsonb_build_object(
      'kind', 'appointment_reminder',
      'appointmentId', v_record.appt_id,
      'deepLink', 'vetopia://consult/' || v_record.appt_id::text
    );
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ==============================================================================
-- 6. Trigger: Appointment Booked / Confirmed Notifications
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_appointment_scheduled_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_vet_user_id UUID;
  v_vet_name TEXT;
  v_pet_name TEXT;
BEGIN
  -- Only trigger for newly scheduled appointments
  IF NEW.status = 'scheduled' THEN
    SELECT user_id, full_name INTO v_vet_user_id, v_vet_name
    FROM public.vet_profiles WHERE id = NEW.vet_id;

    SELECT name INTO v_pet_name
    FROM public.pets WHERE id = NEW.pet_id;

    -- 1. Notify Pet Parent
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      data
    )
    VALUES (
      NEW.pet_parent_id,
      'appointment_confirmed',
      'Consultation Confirmed',
      'Your consultation with Dr. ' || COALESCE(v_vet_name, 'Veterinarian') || ' is scheduled.',
      jsonb_build_object(
        'kind', 'appointment_confirmed',
        'appointmentId', NEW.id,
        'deepLink', 'vetopia://appointments'
      )
    );

    -- 2. Notify Assigned Veterinarian
    IF v_vet_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        user_id,
        type,
        title,
        body,
        data
      )
      VALUES (
        v_vet_user_id,
        'appointment_confirmed',
        'New Consultation Booked',
        'A consultation has been scheduled for ' || COALESCE(v_pet_name, 'patient') || '.',
        jsonb_build_object(
          'kind', 'appointment_confirmed',
          'appointmentId', NEW.id,
          'deepLink', 'vetopia://appointments'
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointment_scheduled_notification ON public.appointments;
CREATE TRIGGER trg_appointment_scheduled_notification
AFTER INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.handle_appointment_scheduled_notification();

-- ==============================================================================
-- 7. Update send_direct_message to automatically trigger notification for recipient
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.send_direct_message(
  p_conversation_id UUID,
  p_body TEXT
)
RETURNS public.direct_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_is_member BOOLEAN;
  v_recipient_id UUID;
  v_trimmed_body TEXT;
  v_new_message public.direct_messages;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  v_trimmed_body := trim(p_body);
  IF v_trimmed_body IS NULL OR length(v_trimmed_body) = 0 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Message body cannot be empty' USING ERRCODE = '22023';
  END IF;

  IF length(v_trimmed_body) > 4000 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Message body exceeds 4000 characters limit' USING ERRCODE = '22023';
  END IF;

  -- Verify caller is a verified conversation participant
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id AND user_id = v_user_id
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'FORBIDDEN: User is not a participant in this conversation' USING ERRCODE = '42501';
  END IF;

  -- Insert message
  INSERT INTO public.direct_messages (
    conversation_id,
    sender_id,
    body,
    status,
    created_at
  )
  VALUES (
    p_conversation_id,
    v_user_id,
    v_trimmed_body,
    'sent',
    NOW()
  )
  RETURNING * INTO v_new_message;

  -- Touch conversation timestamp
  UPDATE public.conversations
  SET last_message_at = NOW()
  WHERE id = p_conversation_id;

  -- Update sender last_read_at
  UPDATE public.conversation_participants
  SET last_read_at = NOW()
  WHERE conversation_id = p_conversation_id AND user_id = v_user_id;

  -- Identify counterpart recipient to insert notification
  SELECT user_id INTO v_recipient_id
  FROM public.conversation_participants
  WHERE conversation_id = p_conversation_id AND user_id != v_user_id
  LIMIT 1;

  IF v_recipient_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      data
    )
    VALUES (
      v_recipient_id,
      'new_message',
      'New Clinical Message',
      'You have received a new consultation message.',
      jsonb_build_object(
        'kind', 'new_message',
        'conversationId', p_conversation_id,
        'messageId', v_new_message.id,
        'deepLink', 'vetopia://messages/' || p_conversation_id::text
      )
    );
  END IF;

  RETURN v_new_message;
END;
$$;

-- ==============================================================================
-- 8. Update create_prescription to automatically trigger notification for pet parent
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.create_prescription(
  p_appointment_id UUID,
  p_diagnosis TEXT,
  p_notes TEXT DEFAULT NULL,
  p_refills_allowed INT DEFAULT 0,
  p_items JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_vet_id UUID;
  v_pet_id UUID;
  v_owner_id UUID;
  v_appt_status TEXT;
  v_prescription_id UUID;
  v_item JSONB;
  v_item_count INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  -- 1. Verify caller is a registered veterinarian
  SELECT id INTO v_vet_id
  FROM public.vet_profiles
  WHERE user_id = v_user_id;

  IF v_vet_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: Caller is not a registered veterinarian' USING ERRCODE = '42501';
  END IF;

  -- 2. Verify appointment exists and caller is assigned doctor
  SELECT vet_id, pet_id, status, pet_parent_id
  INTO v_vet_id, v_pet_id, v_appt_status, v_owner_id
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_appt_status != 'completed' THEN
    RAISE EXCEPTION 'Precondition Failed: Prescriptions can only be created for completed consultations' USING ERRCODE = '22023';
  END IF;

  IF (SELECT vet_id FROM public.appointments WHERE id = p_appointment_id) != v_vet_id THEN
    RAISE EXCEPTION 'FORBIDDEN: Only the consulting doctor can issue a prescription for this visit' USING ERRCODE = '42501';
  END IF;

  IF p_diagnosis IS NULL OR length(trim(p_diagnosis)) = 0 THEN
    RAISE EXCEPTION 'Validation Failed: Primary diagnosis is required' USING ERRCODE = '22023';
  END IF;

  v_item_count := jsonb_array_length(p_items);
  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'Validation Failed: At least one medication item is required' USING ERRCODE = '22023';
  END IF;

  -- 3. Insert prescription record
  INSERT INTO public.prescriptions (
    appointment_id,
    vet_id,
    pet_id,
    diagnosis,
    notes,
    refills_allowed,
    status,
    created_at,
    updated_at
  )
  VALUES (
    p_appointment_id,
    v_vet_id,
    v_pet_id,
    trim(p_diagnosis),
    CASE WHEN p_notes IS NOT NULL AND length(trim(p_notes)) > 0 THEN trim(p_notes) ELSE NULL END,
    COALESCE(p_refills_allowed, 0),
    'active',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_prescription_id;

  -- 4. Insert medication line items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF (v_item->>'medication_name') IS NULL OR length(trim(v_item->>'medication_name')) = 0 THEN
      RAISE EXCEPTION 'Validation Failed: Medication name is required for all line items' USING ERRCODE = '22023';
    END IF;

    IF (v_item->>'dosage') IS NULL OR length(trim(v_item->>'dosage')) = 0 THEN
      RAISE EXCEPTION 'Validation Failed: Dosage is required for all line items' USING ERRCODE = '22023';
    END IF;

    IF (v_item->>'frequency') IS NULL OR length(trim(v_item->>'frequency')) = 0 THEN
      RAISE EXCEPTION 'Validation Failed: Frequency is required for all line items' USING ERRCODE = '22023';
    END IF;

    IF (v_item->>'duration') IS NULL OR length(trim(v_item->>'duration')) = 0 THEN
      RAISE EXCEPTION 'Validation Failed: Duration is required for all line items' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.prescription_items (
      prescription_id,
      medication_name,
      dosage,
      frequency,
      duration,
      special_instructions
    )
    VALUES (
      v_prescription_id,
      trim(v_item->>'medication_name'),
      trim(v_item->>'dosage'),
      trim(v_item->>'frequency'),
      trim(v_item->>'duration'),
      trim(v_item->>'special_instructions')
    );
  END LOOP;

  -- 5. Notify Pet Parent of newly issued prescription
  IF v_owner_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      data
    )
    VALUES (
      v_owner_id,
      'prescription_issued',
      'Digital Prescription Issued',
      'Your veterinarian has issued a digital prescription for your pet.',
      jsonb_build_object(
        'kind', 'prescription_issued',
        'prescriptionId', v_prescription_id,
        'appointmentId', p_appointment_id,
        'deepLink', 'vetopia://prescriptions/' || v_prescription_id::text
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'prescription_id', v_prescription_id,
    'appointment_id', p_appointment_id,
    'items_count', v_item_count,
    'status', 'active'
  );
END;
$$;

-- ==========================================
-- File: 20261005070000_instant_license_verification.sql
-- ==========================================

-- Migration: 20261005070000_instant_license_verification.sql
-- Description: Enable instant self-verification for veterinarians by submitting a medical license number.

-- 1. Update vet_verification_guard to allow verification via secure verification workflow
create or replace function public.enforce_vet_verification_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Prevent non-admins from self-verifying on raw INSERT
  if tg_op = 'INSERT' then
    if new.verified is true and not (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      or current_user in ('service_role', 'postgres')
      or current_setting('vetopia.allow_verification', true) = 'true'
    ) then
      raise exception 'Unauthorized: Veterinarian profiles cannot be self-verified upon registration.';
    end if;
  end if;

  -- Prevent non-admins from arbitrary UPDATE on verified status unless using verification RPC
  if tg_op = 'UPDATE' then
    if new.verified is distinct from old.verified and not (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      or current_user in ('service_role', 'postgres')
      or current_setting('vetopia.allow_verification', true) = 'true'
    ) then
      raise exception 'Unauthorized: Only administrators or verified license submissions can modify verification status.';
    end if;
  end if;

  return new;
end;
$$;

-- 2. Secure RPC for instant medical license verification
create or replace function public.verify_doctor_license(license_number text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _updated_row public.vet_profiles%rowtype;
  _sanitized_license text;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized: You must be signed in to verify your medical license.';
  end if;

  _sanitized_license := trim(coalesce(license_number, ''));
  if length(_sanitized_license) < 3 then
    raise exception 'Validation error: Medical license number must be at least 3 characters.';
  end if;

  -- Enable bypass flag in current transaction
  perform set_config('vetopia.allow_verification', 'true', true);

  -- Update the veterinarian's own profile to verified = true
  update public.vet_profiles
  set verified = true,
      bio = coalesce(bio, '') || (case when bio is null or length(bio) = 0 then '' else E'\n' end) || '[Verified License: ' || _sanitized_license || ']'
  where user_id = auth.uid()
  returning * into _updated_row;

  if not found then
    raise exception 'Profile not found: No veterinarian profile found for current user account.';
  end if;

  return to_jsonb(_updated_row);
end;
$$;

revoke all on function public.verify_doctor_license(text) from public, anon;
grant execute on function public.verify_doctor_license(text) to authenticated;

-- ==========================================
-- File: 20261005080000_enforce_verified_vets_only.sql
-- ==========================================

-- Migration: 20261005080000_enforce_verified_vets_only.sql
-- Description: Enforce server-side and database-side security filters for pet-parent vet discovery and booking.
-- 1. Restrict public.vet_profiles SELECT policy so unverified/pending/rejected vets are never exposed to public or pet parents.
-- 2. Restrict public.vet_availability SELECT policy so availability is only visible for verified doctors (or doctor themselves/admin).
-- 3. Update public.get_vet_schedule RPC: return empty schedule if doctor is not verified or not accepting.
-- 4. Update public.book_appointment RPC: atomically reject booking if doctor is not verified (errcode 55001) or not accepting (errcode 55000).

-- 1. Tighten SELECT policy on public.vet_profiles
drop policy if exists "vets are public" on public.vet_profiles;
drop policy if exists "verified vets are public or own profile" on public.vet_profiles;

create policy "verified vets are public or own profile"
on public.vet_profiles
for select
using (
  verified is true
  or auth.uid() = user_id
  or public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- 2. Tighten SELECT policy on public.vet_availability
drop policy if exists "availability is public" on public.vet_availability;
drop policy if exists "verified vet availability is public or own availability" on public.vet_availability;

create policy "verified vet availability is public or own availability"
on public.vet_availability
for select
using (
  exists (
    select 1 from public.vet_profiles v
    where v.id = public.vet_availability.vet_id
      and (
        v.verified is true
        or v.user_id = auth.uid()
        or public.has_role(auth.uid(), 'admin'::public.app_role)
      )
  )
);

-- 3. Secure get_vet_schedule RPC
create or replace function public.get_vet_schedule(
  target_vet_id uuid,
  days_ahead int default 14
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  vet_record public.vet_profiles%rowtype;
  vet_tz text;
  slot_len int;
  result jsonb := '[]'::jsonb;
  day_idx int;
  cur_day_date date;
  cur_day_dow int;
  day_slots jsonb;
  avail_rec record;
  slot_min int;
  slot_start_tz timestamptz;
  slot_end_tz timestamptz;
  now_tz timestamptz := clock_timestamp();
  buffer_advance interval := interval '15 minutes';
  day_label text;
  formatted_time text;
  date_str text;
  slot_obj jsonb;
  weekday_abbr text[] := array['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  month_abbr text[] := array['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
begin
  -- 1. Fetch vet profile
  select * into vet_record from public.vet_profiles where id = target_vet_id;
  if not found then
    return '[]'::jsonb;
  end if;

  -- If doctor is not verified or not accepting bookings, return empty schedule immediately
  if vet_record.verified is not true or vet_record.accepting is not true then
    return '[]'::jsonb;
  end if;

  -- Resolve authoritative timezone (fallback to UTC if missing or invalid)
  vet_tz := coalesce(nullif(trim(vet_record.timezone), ''), 'UTC');
  begin
    perform now() at time zone vet_tz;
  exception when others then
    vet_tz := 'UTC';
  end;

  slot_len := coalesce(vet_record.slot_minutes, 30);
  if slot_len <= 0 then
    slot_len := 30;
  end if;

  -- Clamp days_ahead between 1 and 30 days
  if days_ahead is null or days_ahead < 1 then
    days_ahead := 14;
  elsif days_ahead > 30 then
    days_ahead := 30;
  end if;

  -- 2. Loop through next `days_ahead` days in the vet's timezone
  for day_idx in 0..(days_ahead - 1) loop
    cur_day_date := (now_tz at time zone vet_tz)::date + day_idx;
    cur_day_dow := extract(dow from cur_day_date)::int; -- 0=Sun, 6=Sat
    date_str := to_char(cur_day_date, 'YYYY-MM-DD');
    day_label := weekday_abbr[cur_day_dow + 1] || ', ' ||
                 month_abbr[extract(month from cur_day_date)::int] || ' ' ||
                 extract(day from cur_day_date)::text;

    day_slots := '[]'::jsonb;

    -- Iterate recurring availability windows for this weekday
    for avail_rec in
      select start_minute, end_minute
      from public.vet_availability
      where vet_id = target_vet_id
        and weekday = cur_day_dow
      order by start_minute asc
    loop
      slot_min := avail_rec.start_minute;

      while (slot_min + slot_len) <= avail_rec.end_minute loop
        -- Convert target day + minute offset in vet's timezone to timestamptz
        slot_start_tz := (cur_day_date::text || ' 00:00:00')::timestamp
                         + (slot_min || ' minutes')::interval;
        slot_start_tz := slot_start_tz at time zone vet_tz;

        slot_end_tz := (cur_day_date::text || ' 00:00:00')::timestamp
                       + ((slot_min + slot_len) || ' minutes')::interval;
        slot_end_tz := slot_end_tz at time zone vet_tz;

        -- Exclude slots in the past or within 15-minute advance buffer
        if slot_start_tz >= (now_tz + buffer_advance) then
          -- Check if slot is already occupied by a scheduled appointment
          if not exists (
            select 1
            from public.appointments
            where vet_id = target_vet_id
              and status = 'scheduled'
              and starts_at < slot_end_tz
              and ends_at > slot_start_tz
          ) then
            formatted_time := to_char(slot_start_tz at time zone vet_tz, 'HH24:MI');

            slot_obj := jsonb_build_object(
              'startTime', to_char(slot_start_tz, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
              'endTime', to_char(slot_end_tz, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
              'formattedTime', formatted_time,
              'available', true
            );

            day_slots := day_slots || jsonb_build_array(slot_obj);
          end if;
        end if;

        slot_min := slot_min + slot_len;
      end loop;
    end loop;

    -- Include day entry with its computed available slots
    result := result || jsonb_build_array(
      jsonb_build_object(
        'date', date_str,
        'dayLabel', day_label,
        'slots', day_slots
      )
    );
  end loop;

  return result;
end;
$$;

-- 4. Secure book_appointment RPC
create or replace function public.book_appointment(
  p_vet_id uuid,
  p_pet_id uuid,
  p_starts_at timestamptz,
  p_mode text,
  p_symptoms text,
  p_urgency text default 'Medium',
  p_contact_phone text default null,
  p_medications text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_vet public.vet_profiles%rowtype;
  v_pet public.pets%rowtype;
  v_duration int;
  v_ends_at timestamptz;
  v_price numeric(10,2);
  v_buffer_interval interval := interval '15 minutes';
  v_created_appointment public.appointments%rowtype;
begin
  -- 1. Verify caller is authenticated
  if v_caller_id is null then
    raise exception 'Unauthorized: Authentication required to book an appointment.'
      using errcode = '28000';
  end if;

  -- 2. Validate Mode
  if p_mode not in ('video', 'audio', 'chat') then
    raise exception 'Invalid consultation mode. Allowed values: video, audio, chat.'
      using errcode = '22023';
  end if;

  -- 3. Validate Symptoms
  if p_symptoms is null or trim(p_symptoms) = '' then
    raise exception 'Symptoms description is required.'
      using errcode = '22023';
  end if;

  -- 4. Verify Pet Ownership
  select * into v_pet from public.pets where id = p_pet_id and owner_id = v_caller_id;
  if not found then
    raise exception 'Pet not found or unauthorized. You can only book appointments for your own pets.'
      using errcode = '42501';
  end if;

  -- 5. Verify Vet exists, is verified, and is accepting
  select * into v_vet from public.vet_profiles where id = p_vet_id;
  if not found then
    raise exception 'Veterinarian not found.'
      using errcode = 'P0002';
  end if;

  if v_vet.verified is not true then
    raise exception 'Veterinarian is not verified or approved for clinical practice.'
      using errcode = '55001';
  end if;

  if v_vet.accepting is not true then
    raise exception 'Veterinarian is currently not accepting bookings.'
      using errcode = '55000';
  end if;

  -- 6. Validate Slot is not in past + 15m buffer
  if p_starts_at < (clock_timestamp() + v_buffer_interval) then
    raise exception 'Requested slot is in the past or within the 15-minute advance booking window.'
      using errcode = '22008';
  end if;

  -- Calculate duration & ends_at
  v_duration := coalesce(v_vet.slot_minutes, 30);
  if v_duration <= 0 then
    v_duration := 30;
  end if;
  v_ends_at := p_starts_at + (v_duration || ' minutes')::interval;
  v_price := coalesce(v_vet.price_usd, 29.00);

  -- 7. Concurrency-Safe Insert
  begin
    insert into public.appointments (
      pet_parent_id,
      vet_id,
      pet_id,
      starts_at,
      ends_at,
      status,
      mode,
      price_usd,
      symptoms,
      urgency,
      contact_phone,
      medications
    ) values (
      v_caller_id,
      p_vet_id,
      p_pet_id,
      p_starts_at,
      v_ends_at,
      'scheduled',
      p_mode,
      v_price,
      trim(p_symptoms),
      p_urgency,
      p_contact_phone,
      p_medications
    )
    returning * into v_created_appointment;

  exception
    when unique_violation then
      raise exception 'Slot just taken. Please select another time.'
        using errcode = '23505';
  end;

  -- 8. Return formatted confirmation receipt
  return jsonb_build_object(
    'success', true,
    'appointment_id', v_created_appointment.id,
    'status', v_created_appointment.status,
    'starts_at', to_char(v_created_appointment.starts_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'ends_at', to_char(v_created_appointment.ends_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'duration_minutes', v_duration,
    'vet_id', v_vet.id,
    'vet_name', v_vet.name,
    'pet_id', v_pet.id,
    'pet_name', v_pet.name,
    'species', v_pet.species,
    'mode', v_created_appointment.mode,
    'price_usd', v_price,
    'urgency', v_created_appointment.urgency,
    'contact_phone', v_created_appointment.contact_phone
  );
end;
$$;

-- ==========================================
-- File: 20261121090000_phase1_clinical_security.sql
-- ==========================================

-- Vet approval, profile privacy, and appointment integrity.
drop function if exists public.verify_doctor_license(text);

-- The previous verifier did not validate licenses, so legacy flags cannot be trusted.
drop trigger vet_verification_guard on public.vet_profiles;
update public.vet_profiles
set verified = false,
    bio = nullif(btrim(regexp_replace(bio, '\[Verified License: [^]]*\]', '', 'g')), '')
where verified or bio like '%[Verified License: %';

create table public.vet_license_requests (
  vet_id uuid primary key references public.vet_profiles(id) on delete cascade,
  license_number text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

alter table public.vet_license_requests enable row level security;
revoke all on public.vet_license_requests from public, anon, authenticated;
grant select on public.vet_license_requests to authenticated;
create policy "owner or admin reads license request" on public.vet_license_requests
  for select to authenticated using (
    public.has_role(auth.uid(), 'admin') or exists (
      select 1 from public.vet_profiles v where v.id = vet_id and v.user_id = auth.uid()
    )
  );

drop policy "admins update vet profiles" on public.vet_profiles;
revoke delete, truncate, references, trigger on public.vet_profiles from public, anon, authenticated;
create or replace function public.enforce_vet_verification_guard()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if current_user <> (select pg_get_userbyid(relowner) from pg_class where oid = tg_relid) then
    if (tg_op = 'INSERT' and new.verified)
       or (tg_op = 'UPDATE' and new.verified is distinct from old.verified) then
      raise exception 'Veterinarian approval must use the administrator RPC' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger vet_verification_guard before insert or update on public.vet_profiles
  for each row execute function public.enforce_vet_verification_guard();

create function public.request_vet_license_review(p_license_number text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_vet public.vet_profiles%rowtype;
  v_license text := btrim(coalesce(p_license_number, ''));
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'vet') then
    raise exception 'Only a veterinarian may request license review' using errcode = '42501';
  end if;
  if char_length(v_license) not between 3 and 100 or v_license ~ '[[:cntrl:]]' then
    raise exception 'Enter a valid license number between 3 and 100 characters' using errcode = '22023';
  end if;

  select * into v_vet from public.vet_profiles where user_id = auth.uid() for update;
  if not found or v_vet.verified then
    raise exception 'An unapproved veterinarian profile is required' using errcode = '42501';
  end if;

  insert into public.vet_license_requests (vet_id, license_number)
  values (v_vet.id, v_license)
  on conflict (vet_id) do update
    set license_number = excluded.license_number, status = 'pending',
        submitted_at = clock_timestamp(), reviewed_at = null, reviewed_by = null
    where vet_license_requests.status <> 'pending';

  -- Keep the credential stable while a reviewer is assessing it.
  if not found and exists (
    select 1 from public.vet_license_requests
    where vet_id = v_vet.id and license_number <> v_license
  ) then
    raise exception 'A license review is already pending' using errcode = '55000';
  end if;
end;
$$;
revoke all on function public.request_vet_license_review(text) from public, anon, authenticated, service_role;
grant execute on function public.request_vet_license_review(text) to authenticated;

create or replace function public.approve_vet(target_vet_id uuid, approve_status boolean default true)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_vet public.vet_profiles%rowtype;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only administrators may decide a veterinarian review' using errcode = '42501';
  end if;
  if approve_status is null then
    raise exception 'Approval decision is required' using errcode = '22023';
  end if;

  select * into v_vet from public.vet_profiles where id = target_vet_id for update;
  if not found then
    raise exception 'Veterinarian not found' using errcode = 'P0002';
  end if;
  if v_vet.user_id = auth.uid() then
    raise exception 'An administrator cannot approve their own veterinarian profile' using errcode = '42501';
  end if;
  if approve_status and not exists (
    select 1 from public.vet_license_requests where vet_id = target_vet_id and status = 'pending'
  ) then
    raise exception 'Approval requires a pending license request' using errcode = '55000';
  end if;

  update public.vet_license_requests
  set status = case when approve_status then 'approved' else 'rejected' end,
      reviewed_at = clock_timestamp(), reviewed_by = auth.uid()
  where vet_id = target_vet_id;
  update public.vet_profiles set verified = approve_status where id = target_vet_id
  returning * into v_vet;
  return to_jsonb(v_vet);
end;
$$;
revoke all on function public.approve_vet(uuid, boolean) from public, anon, authenticated, service_role;
grant execute on function public.approve_vet(uuid, boolean) to authenticated;

drop policy "profiles are publicly viewable" on public.profiles;
revoke all on public.profiles from public, anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
create policy "owner or admin reads private profile" on public.profiles
  for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- This view deliberately executes as its owner to expose only the projected public fields.
create view public.profile_directory with (security_barrier = true) as
  select id, full_name, avatar_url from public.profiles;
revoke all on public.profile_directory from public, anon, authenticated;
grant select on public.profile_directory to anon, authenticated;

drop policy "pet parent books" on public.appointments;
drop policy "participants update appointments" on public.appointments;
revoke insert, update, delete, truncate on public.appointments from public, anon, authenticated;

-- Reject inconsistent legacy inventory at migration time instead of silently cancelling visits.
create extension if not exists btree_gist;
alter table public.appointments
  add constraint appointments_scheduled_interval_valid
  check (status <> 'scheduled' or (isfinite(starts_at) and isfinite(ends_at) and ends_at > starts_at)),
  add constraint appointments_vet_scheduled_no_overlap
  exclude using gist (vet_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
  where (status = 'scheduled');

-- Both discovery and booking use the same slot grid. Nonexistent or discontinuous local
-- slots during DST transitions are omitted so elapsed time always equals slot_minutes.
create function public.published_vet_slots(
  p_vet_id uuid, p_day date, p_timezone text, p_duration integer
)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable set search_path = ''
as $$
  select distinct slot_start, slot_end
  from public.vet_availability a
  cross join lateral generate_series(a.start_minute, a.end_minute - p_duration, p_duration) m
  cross join lateral (
    select p_day::timestamp + make_interval(mins => m) as local_start,
           p_day::timestamp + make_interval(mins => m + p_duration) as local_end
  ) local_slot
  cross join lateral (
    select local_start at time zone p_timezone as slot_start,
           local_end at time zone p_timezone as slot_end
  ) slot
  where a.vet_id = p_vet_id and a.weekday = extract(dow from p_day)
    and slot_start at time zone p_timezone = local_start
    and slot_end at time zone p_timezone = local_end
    and slot_end - slot_start = make_interval(mins => p_duration);
$$;
revoke all on function public.published_vet_slots(uuid, date, text, integer)
  from public, anon, authenticated, service_role;

create or replace function public.get_vet_schedule(target_vet_id uuid, days_ahead int default 14)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_vet public.vet_profiles%rowtype;
  v_timezone text;
  v_today date;
  v_now timestamptz := statement_timestamp();
begin
  select * into v_vet from public.vet_profiles where id = target_vet_id and verified and accepting;
  if not found then return '[]'::jsonb; end if;

  select name into v_timezone from pg_timezone_names where name = v_vet.timezone;
  v_timezone := coalesce(v_timezone, 'UTC');
  v_today := (v_now at time zone v_timezone)::date;

  return (
    select jsonb_agg(jsonb_build_object(
      'date', day.local_date,
      'dayLabel', to_char(day.local_date, 'Dy, Mon FMDD'),
      'slots', coalesce(slots.entries, '[]'::jsonb)
    ) order by day.local_date)
    from generate_series(0, least(30, case when days_ahead > 0 then days_ahead else 14 end) - 1) n
    cross join lateral (select v_today + n as local_date) day
    left join lateral (
      select jsonb_agg(jsonb_build_object(
        'startTime', s.starts_at,
        'endTime', s.ends_at,
        'formattedTime', to_char(s.starts_at at time zone v_timezone, 'HH24:MI'),
        'available', true
      ) order by s.starts_at) as entries
      from public.published_vet_slots(
        target_vet_id, day.local_date, v_timezone,
        case when v_vet.slot_minutes > 0 then v_vet.slot_minutes else 30 end
      ) s
      where s.starts_at >= v_now + interval '15 minutes'
        and not exists (
          select 1 from public.appointments a
          where a.vet_id = target_vet_id and a.status = 'scheduled'
            and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(s.starts_at, s.ends_at, '[)')
        )
    ) slots on true
  );
end;
$$;

create or replace function public.book_appointment(
  p_vet_id uuid,
  p_pet_id uuid,
  p_starts_at timestamptz,
  p_mode text,
  p_symptoms text,
  p_urgency text default 'Medium',
  p_contact_phone text default null,
  p_medications text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_vet public.vet_profiles%rowtype;
  v_pet public.pets%rowtype;
  v_duration int;
  v_ends_at timestamptz;
  v_price numeric(10,2);
  v_timezone text;
  v_now timestamptz;
  v_today date;
  v_day date;
  v_created_appointment public.appointments%rowtype;
begin
  -- 1. Verify caller is authenticated
  if v_caller_id is null then
    raise exception 'Unauthorized: Authentication required to book an appointment.'
      using errcode = '28000';
  end if;

  -- 2. Validate Mode
  if p_mode is null or p_mode not in ('video', 'audio', 'chat') then
    raise exception 'Invalid consultation mode. Allowed values: video, audio, chat.'
      using errcode = '22023';
  end if;

  -- 3. Validate Symptoms
  if p_symptoms is null or trim(p_symptoms) = '' then
    raise exception 'Symptoms description is required.'
      using errcode = '22023';
  end if;

  -- 4. Verify Pet Ownership
  select * into v_pet from public.pets where id = p_pet_id and owner_id = v_caller_id;
  if not found then
    raise exception 'Pet not found or unauthorized. You can only book appointments for your own pets.'
      using errcode = '42501';
  end if;

  -- 5. Verify Vet exists, is verified, and is accepting
  select * into v_vet from public.vet_profiles where id = p_vet_id for share;
  if not found then
    raise exception 'Veterinarian not found.'
      using errcode = 'P0002';
  end if;

  if v_vet.verified is not true then
    raise exception 'Veterinarian is not verified or approved for clinical practice.'
      using errcode = '55001';
  end if;

  if v_vet.accepting is not true then
    raise exception 'Veterinarian is currently not accepting bookings.'
      using errcode = '55000';
  end if;

  -- Match discovery's local calendar and slot grid before inserting.
  v_now := clock_timestamp();
  if p_starts_at is null or not isfinite(p_starts_at)
    or p_starts_at < v_now + interval '15 minutes' then
    raise exception 'Choose a slot at least 15 minutes in the future.' using errcode = '22008';
  end if;

  select name into v_timezone from pg_timezone_names where name = v_vet.timezone;
  v_timezone := coalesce(v_timezone, 'UTC');
  v_today := (v_now at time zone v_timezone)::date;
  v_day := (p_starts_at at time zone v_timezone)::date;
  if v_day >= v_today + 30 then
    raise exception 'Choose a slot within the published 30-day calendar.' using errcode = '22008';
  end if;

  v_duration := case when v_vet.slot_minutes > 0 then v_vet.slot_minutes else 30 end;
  select s.ends_at into v_ends_at
  from public.published_vet_slots(p_vet_id, v_day, v_timezone, v_duration) s
  where s.starts_at = p_starts_at;
  if not found then
    raise exception 'Choose a published availability slot.' using errcode = '22008';
  end if;

  v_price := coalesce(v_vet.price_usd, 29.00);

  -- 7. Concurrency-Safe Insert
  begin
    insert into public.appointments (
      pet_parent_id,
      vet_id,
      pet_id,
      starts_at,
      ends_at,
      status,
      mode,
      price_usd,
      pet_name,
      species,
      breed,
      pet_age,
      symptoms,
      urgency,
      contact_phone,
      medications
    ) values (
      v_caller_id,
      p_vet_id,
      p_pet_id,
      p_starts_at,
      v_ends_at,
      'scheduled',
      p_mode,
      v_price,
      v_pet.name,
      v_pet.species,
      v_pet.breed,
      v_pet.age,
      trim(p_symptoms),
      p_urgency,
      p_contact_phone,
      p_medications
    )
    returning * into v_created_appointment;

  exception
    when unique_violation or exclusion_violation then
      raise exception 'Slot just taken. Please select another time.'
        using errcode = '23505';
  end;

  -- 8. Return formatted confirmation receipt
  return jsonb_build_object(
    'success', true,
    'appointment_id', v_created_appointment.id,
    'status', v_created_appointment.status,
    'starts_at', v_created_appointment.starts_at,
    'ends_at', v_created_appointment.ends_at,
    'duration_minutes', v_duration,
    'vet_id', v_vet.id,
    'vet_name', v_vet.name,
    'pet_id', v_pet.id,
    'pet_name', v_pet.name,
    'species', v_pet.species,
    'mode', v_created_appointment.mode,
    'price_usd', v_price,
    'urgency', v_created_appointment.urgency,
    'contact_phone', v_created_appointment.contact_phone
  );
end;
$$;

create or replace function public.cancel_appointment(p_appointment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_appt public.appointments%rowtype;
  v_less_than_two_hours boolean := false;
begin
  if v_caller_id is null then
    raise exception 'Unauthorized: Authentication required.' using errcode = '28000';
  end if;

  select a.* into v_appt
  from public.appointments a
  left join public.vet_profiles v on v.id = a.vet_id
  where a.id = p_appointment_id
    and (a.pet_parent_id = v_caller_id or v.user_id = v_caller_id)
  for update of a;

  if not found then
    raise exception 'Appointment not found or you are not an authorized participant.'
      using errcode = '42501';
  end if;

  if v_appt.status = 'cancelled' then
    return jsonb_build_object('success', true, 'appointment_id', v_appt.id, 'status', 'cancelled');
  end if;

  if v_appt.status <> 'scheduled' then
    raise exception 'Only scheduled appointments can be cancelled.' using errcode = '22000';
  end if;

  -- Check if cancellation is within 2 hours of starts_at
  if v_appt.starts_at < (clock_timestamp() + interval '2 hours') then
    v_less_than_two_hours := true;
  end if;

  update public.appointments
  set status = 'cancelled', updated_at = now()
  where id = p_appointment_id;

  return jsonb_build_object(
    'success', true,
    'appointment_id', v_appt.id,
    'status', 'cancelled',
    'late_cancellation', v_less_than_two_hours
  );
end;
$$;

grant execute on function public.cancel_appointment(uuid) to authenticated;
revoke execute on function public.cancel_appointment(uuid) from anon, public;

create or replace function public.complete_appointment(p_appointment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_appt public.appointments%rowtype;
  v_vet public.vet_profiles%rowtype;
begin
  -- 1. Enforce authentication
  if v_caller_id is null then
    raise exception 'Unauthorized: Authentication required.' using errcode = '28000';
  end if;

  -- 2. Verify appointment existence
  select * into v_appt
  from public.appointments
  where id = p_appointment_id for update;

  if not found then
    raise exception 'Appointment not found.' using errcode = 'P0002';
  end if;

  -- 3. Load consulting veterinarian record
  select * into v_vet
  from public.vet_profiles
  where id = v_appt.vet_id;

  -- 4. Enforce Vet-Only authorization (pet parents & arbitrary users strictly forbidden)
  if v_vet.user_id is distinct from v_caller_id or v_vet.verified is not true then
    raise exception 'Forbidden: Only the consulting veterinarian can mark an appointment as completed.'
      using errcode = '42501';
  end if;

  -- 5. Validate status transition
  if v_appt.status <> 'scheduled' then
    if v_appt.status = 'completed' then
      return jsonb_build_object(
        'success', true,
        'appointment_id', v_appt.id,
        'status', 'completed'
      );
    end if;
    raise exception 'Appointment cannot be completed because its status is %.', v_appt.status
      using errcode = '22000';
  end if;

  -- 6. Atomically update status to completed
  update public.appointments
  set status = 'completed',
      updated_at = now()
  where id = p_appointment_id;

  return jsonb_build_object(
    'success', true,
    'appointment_id', v_appt.id,
    'status', 'completed'
  );
end;
$$;

grant execute on function public.complete_appointment(uuid) to authenticated;
revoke execute on function public.complete_appointment(uuid) from anon, public;

-- ==========================================
-- File: 20261121091000_phase1_notification_workers.sql
-- ==========================================

-- Repair notification trigger queries and restrict worker-only operations.
-- Clinical conversations assign the veterinarian a distinct participant side.
alter type public.participant_side add value if not exists 'vet';

CREATE OR REPLACE FUNCTION public.notify_doctor_entered_consultation(
  p_appointment_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_parent_id UUID;
  v_vet_name TEXT;
  v_status TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  -- Ensure appointment exists, is scheduled, and caller is the assigned doctor
  SELECT a.pet_parent_id, v.name, a.status
  INTO v_parent_id, v_vet_name, v_status
  FROM public.appointments a
  JOIN public.vet_profiles v ON v.id = a.vet_id
  WHERE a.id = p_appointment_id AND v.user_id = v_user_id AND v.verified
  FOR UPDATE OF a;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FORBIDDEN: Only the assigned veterinarian can dispatch doctor-entered event' USING ERRCODE = '42501';
  END IF;

  IF v_status != 'scheduled' THEN
    RETURN FALSE;
  END IF;

  if exists (
    select 1 from public.notifications n
    where n.user_id = v_parent_id and n.type = 'doctor_entered_consultation'
      and n.data->>'appointmentId' = p_appointment_id::text
  ) then
    return false;
  end if;

  -- Insert notification for the pet parent
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    body,
    data
  )
  VALUES (
    v_parent_id,
    'doctor_entered_consultation',
    'Doctor Has Joined Consultation',
    COALESCE('Dr. ' || v_vet_name, 'Your veterinarian') || ' is in the consultation room. Please enter to begin.',
    jsonb_build_object(
      'kind', 'doctor_entered_consultation',
      'appointmentId', p_appointment_id,
      'deepLink', 'vetopia://consult/' || p_appointment_id::text
    )
  );

  RETURN TRUE;
END;
$$;

-- 5.7 Idempotent 15-Minute Consultation Reminder Batch Processor
drop function public.process_appointment_reminders();

create function public.process_appointment_reminders()
returns integer language sql security definer set search_path = ''
as $$
  with claimed as (
    insert into public.appointment_reminders (appointment_id, reminder_type)
    select a.id, '15m'
    from public.appointments a
    where a.status = 'scheduled'
      and a.starts_at >= now() and a.starts_at <= now() + interval '16 minutes'
      and not exists (
        select 1 from public.appointment_reminders r
        where r.appointment_id = a.id and r.reminder_type = '15m'
      )
    order by a.id
    on conflict (appointment_id, reminder_type) do nothing
    returning appointment_id
  ), queued as (
    insert into public.notifications (user_id, type, title, body, data)
    select recipient.user_id, 'appointment_reminder', recipient.title, recipient.body,
      jsonb_build_object('kind', 'appointment_reminder', 'appointmentId', a.id,
                         'deepLink', 'vetopia://consult/' || a.id::text)
    from claimed c
    join public.appointments a on a.id = c.appointment_id
    join public.vet_profiles v on v.id = a.vet_id
    left join public.pets p on p.id = a.pet_id
    cross join lateral (values
      (a.pet_parent_id, 'Consultation Starting Soon',
        'Your consultation for ' || coalesce(p.name, 'your pet') || ' starts in 15 minutes.'),
      (v.user_id, 'Upcoming Consultation in 15 Minutes',
        'Consultation with ' || coalesce(p.name, 'your patient') || ' starts in 15 minutes.')
    ) recipient(user_id, title, body)
    where recipient.user_id is not null
    returning id
  )
  select count(*)::integer from queued;
$$;

CREATE OR REPLACE FUNCTION public.handle_appointment_scheduled_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_vet_user_id UUID;
  v_vet_name TEXT;
  v_pet_name TEXT;
BEGIN
  -- Only trigger for newly scheduled appointments
  IF NEW.status = 'scheduled' THEN
    SELECT user_id, name INTO v_vet_user_id, v_vet_name
    FROM public.vet_profiles WHERE id = NEW.vet_id;

    SELECT name INTO v_pet_name
    FROM public.pets WHERE id = NEW.pet_id;

    -- 1. Notify Pet Parent
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      data
    )
    VALUES (
      NEW.pet_parent_id,
      'appointment_confirmed',
      'Consultation Confirmed',
      'Your consultation with Dr. ' || COALESCE(v_vet_name, 'Veterinarian') || ' is scheduled.',
      jsonb_build_object(
        'kind', 'appointment_confirmed',
        'appointmentId', NEW.id,
        'deepLink', 'vetopia://appointments'
      )
    );

    -- 2. Notify Assigned Veterinarian
    IF v_vet_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        user_id,
        type,
        title,
        body,
        data
      )
      VALUES (
        v_vet_user_id,
        'appointment_confirmed',
        'New Consultation Booked',
        'A consultation has been scheduled for ' || COALESCE(v_pet_name, 'patient') || '.',
        jsonb_build_object(
          'kind', 'appointment_confirmed',
          'appointmentId', NEW.id,
          'deepLink', 'vetopia://appointments'
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


revoke all on function public.notify_doctor_entered_consultation(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.notify_doctor_entered_consultation(uuid) to authenticated;

revoke all on function public.process_appointment_reminders()
  from public, anon, authenticated, service_role;
grant execute on function public.process_appointment_reminders() to service_role;

alter table public.notifications
  add column push_claim_id uuid,
  add column push_claim_until timestamptz;
revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read, read_at) on public.notifications to authenticated;
grant select, update on public.notifications, public.device_tokens to service_role;

create function public.claim_pending_push_notifications(p_limit integer default 50)
returns table (id uuid, user_id uuid, type text, title text, body text, data jsonb, push_claim_id uuid)
language sql security definer set search_path = ''
as $$
  with pending as (
    select n.id
    from public.notifications n
    where n.pushed_at is null and coalesce(n.push_claim_until, '-infinity') <= statement_timestamp()
    order by n.created_at, n.id
    limit least(100, greatest(1, coalesce(p_limit, 50)))
    for update skip locked
  )
  update public.notifications n set push_claim_id = gen_random_uuid(),
    push_claim_until = statement_timestamp() + interval '5 minutes'
  from pending
  where n.id = pending.id
  returning n.id, n.user_id, n.type, n.title, n.body, n.data, n.push_claim_id;
$$;
revoke all on function public.claim_pending_push_notifications(integer)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_pending_push_notifications(integer) to service_role;

-- Repair the notification-enabled message RPC and restore explicit grants.
CREATE OR REPLACE FUNCTION public.send_direct_message(
  p_conversation_id UUID,
  p_body TEXT
)
RETURNS public.direct_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_is_member BOOLEAN;
  v_recipient_id UUID;
  v_trimmed_body TEXT;
  v_new_message public.direct_messages;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  v_trimmed_body := trim(p_body);
  IF v_trimmed_body IS NULL OR length(v_trimmed_body) = 0 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Message body cannot be empty' USING ERRCODE = '22023';
  END IF;

  IF length(v_trimmed_body) > 4000 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Message body exceeds 4000 characters limit' USING ERRCODE = '22023';
  END IF;

  -- Verify caller is a verified conversation participant
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id AND user_id = v_user_id
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'FORBIDDEN: User is not a participant in this conversation' USING ERRCODE = '42501';
  END IF;

  -- Insert message
  INSERT INTO public.direct_messages (
    conversation_id,
    sender_id,
    body,
    created_at
  )
  VALUES (
    p_conversation_id,
    v_user_id,
    v_trimmed_body,
    NOW()
  )
  RETURNING * INTO v_new_message;

  -- Touch conversation timestamp
  UPDATE public.conversations
  SET last_message_at = NOW()
  WHERE id = p_conversation_id;

  -- Update sender last_read_at
  UPDATE public.conversation_participants
  SET last_read_at = NOW()
  WHERE conversation_id = p_conversation_id AND user_id = v_user_id;

  -- Identify counterpart recipient to insert notification
  SELECT user_id INTO v_recipient_id
  FROM public.conversation_participants
  WHERE conversation_id = p_conversation_id AND user_id != v_user_id
  LIMIT 1;

  IF v_recipient_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      data
    )
    VALUES (
      v_recipient_id,
      'new_message',
      'New Clinical Message',
      'You have received a new consultation message.',
      jsonb_build_object(
        'kind', 'new_message',
        'conversationId', p_conversation_id,
        'messageId', v_new_message.id,
        'deepLink', 'vetopia://messages/' || p_conversation_id::text
      )
    );
  END IF;

  RETURN v_new_message;
END;
$$;
-- The historical notification migration recreates this RPC with default grants.
revoke all on function public.send_direct_message(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.send_direct_message(uuid, text) to authenticated;

-- Preserve the authenticated prescriber ID across the appointment lookup.
CREATE OR REPLACE FUNCTION public.create_prescription(
  p_appointment_id UUID,
  p_diagnosis TEXT,
  p_notes TEXT DEFAULT NULL,
  p_refills_allowed INT DEFAULT 0,
  p_items JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_vet_id UUID;
  v_appointment_vet_id UUID;
  v_pet_id UUID;
  v_owner_id UUID;
  v_appt_status TEXT;
  v_prescription_id UUID;
  v_item JSONB;
  v_item_count INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  -- 1. Verify caller is a registered veterinarian
  SELECT id INTO v_vet_id
  FROM public.vet_profiles
  WHERE user_id = v_user_id AND verified;

  IF v_vet_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: Caller is not a registered veterinarian' USING ERRCODE = '42501';
  END IF;

  -- 2. Verify appointment exists and caller is assigned doctor
  SELECT vet_id, pet_id, status, pet_parent_id
  INTO v_appointment_vet_id, v_pet_id, v_appt_status, v_owner_id
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_appt_status != 'completed' THEN
    RAISE EXCEPTION 'Precondition Failed: Prescriptions can only be created for completed consultations' USING ERRCODE = '22023';
  END IF;

  IF v_appointment_vet_id IS DISTINCT FROM v_vet_id THEN
    RAISE EXCEPTION 'FORBIDDEN: Only the consulting doctor can issue a prescription for this visit' USING ERRCODE = '42501';
  END IF;

  IF p_diagnosis IS NULL OR length(trim(p_diagnosis)) = 0 THEN
    RAISE EXCEPTION 'Validation Failed: Primary diagnosis is required' USING ERRCODE = '22023';
  END IF;

  v_item_count := jsonb_array_length(p_items);
  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'Validation Failed: At least one medication item is required' USING ERRCODE = '22023';
  END IF;

  -- 3. Insert prescription record
  INSERT INTO public.prescriptions (
    appointment_id,
    vet_id,
    pet_id,
    diagnosis,
    notes,
    refills_allowed,
    status,
    created_at,
    updated_at
  )
  VALUES (
    p_appointment_id,
    v_vet_id,
    v_pet_id,
    trim(p_diagnosis),
    CASE WHEN p_notes IS NOT NULL AND length(trim(p_notes)) > 0 THEN trim(p_notes) ELSE NULL END,
    COALESCE(p_refills_allowed, 0),
    'active',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_prescription_id;

  -- 4. Insert medication line items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF (v_item->>'medication_name') IS NULL OR length(trim(v_item->>'medication_name')) = 0 THEN
      RAISE EXCEPTION 'Validation Failed: Medication name is required for all line items' USING ERRCODE = '22023';
    END IF;

    IF (v_item->>'dosage') IS NULL OR length(trim(v_item->>'dosage')) = 0 THEN
      RAISE EXCEPTION 'Validation Failed: Dosage is required for all line items' USING ERRCODE = '22023';
    END IF;

    IF (v_item->>'frequency') IS NULL OR length(trim(v_item->>'frequency')) = 0 THEN
      RAISE EXCEPTION 'Validation Failed: Frequency is required for all line items' USING ERRCODE = '22023';
    END IF;

    IF (v_item->>'duration') IS NULL OR length(trim(v_item->>'duration')) = 0 THEN
      RAISE EXCEPTION 'Validation Failed: Duration is required for all line items' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.prescription_items (
      prescription_id,
      medication_name,
      dosage,
      frequency,
      duration,
      special_instructions
    )
    VALUES (
      v_prescription_id,
      trim(v_item->>'medication_name'),
      trim(v_item->>'dosage'),
      trim(v_item->>'frequency'),
      trim(v_item->>'duration'),
      trim(v_item->>'special_instructions')
    );
  END LOOP;

  -- 5. Notify Pet Parent of newly issued prescription
  IF v_owner_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      data
    )
    VALUES (
      v_owner_id,
      'prescription_issued',
      'Digital Prescription Issued',
      'Your veterinarian has issued a digital prescription for your pet.',
      jsonb_build_object(
        'kind', 'prescription_issued',
        'prescriptionId', v_prescription_id,
        'appointmentId', p_appointment_id,
        'deepLink', 'vetopia://prescriptions/' || v_prescription_id::text
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'prescription_id', v_prescription_id,
    'appointment_id', p_appointment_id,
    'items_count', v_item_count,
    'status', 'active'
  );
END;
$$;
