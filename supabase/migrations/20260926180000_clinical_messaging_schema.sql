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
