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