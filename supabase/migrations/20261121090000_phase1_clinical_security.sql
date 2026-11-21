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
