-- Migration: 20261024100000_vet_availability_blocked_dates.sql
-- Description: Phase A — Veterinarian availability management and blocked dates.
-- 1. Create public.vet_blocked_dates table for doctor unavailability and holidays.
-- 2. Add Row Level Security (RLS) policies for vet_blocked_dates.
-- 3. Upgrade get_vet_schedule RPC to respect blocked dates and customizable slot_minutes.
-- 4. Upgrade book_appointment RPC to atomically reject booking on blocked dates.

-- 1. Create table public.vet_blocked_dates
create table if not exists public.vet_blocked_dates (
  id uuid primary key default gen_random_uuid(),
  vet_id uuid not null references public.vet_profiles(id) on delete cascade,
  blocked_date date not null,
  reason text default null,
  created_at timestamptz not null default now(),
  constraint vet_blocked_dates_unique unique (vet_id, blocked_date)
);

-- Indexes for performance
create index if not exists vet_blocked_dates_vet_id_idx on public.vet_blocked_dates(vet_id);
create index if not exists vet_blocked_dates_date_idx on public.vet_blocked_dates(blocked_date);

-- Grants
grant select on public.vet_blocked_dates to anon;
grant select, insert, update, delete on public.vet_blocked_dates to authenticated;
grant all on public.vet_blocked_dates to service_role;

-- 2. Row Level Security for public.vet_blocked_dates
alter table public.vet_blocked_dates enable row level security;

drop policy if exists "blocked dates are visible for verified vets or own" on public.vet_blocked_dates;
create policy "blocked dates are visible for verified vets or own"
on public.vet_blocked_dates
for select
using (
  exists (
    select 1 from public.vet_profiles v
    where v.id = public.vet_blocked_dates.vet_id
      and (
        v.verified is true
        or v.user_id = auth.uid()
        or public.has_role(auth.uid(), 'admin'::public.app_role)
      )
  )
);

drop policy if exists "vet manages own blocked dates" on public.vet_blocked_dates;
create policy "vet manages own blocked dates"
on public.vet_blocked_dates
for all
to authenticated
using (
  exists (
    select 1 from public.vet_profiles v
    where v.id = public.vet_blocked_dates.vet_id
      and v.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.vet_profiles v
    where v.id = public.vet_blocked_dates.vet_id
      and v.user_id = auth.uid()
  )
);

-- 3. Upgrade get_vet_schedule RPC
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
  -- Fetch vet profile
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

  -- Loop through next `days_ahead` days in the vet's timezone
  for day_idx in 0..(days_ahead - 1) loop
    cur_day_date := (now_tz at time zone vet_tz)::date + day_idx;
    cur_day_dow := extract(dow from cur_day_date)::int; -- 0=Sun, 6=Sat
    date_str := to_char(cur_day_date, 'YYYY-MM-DD');

    -- Check if this day is a blocked date / time off for the doctor
    if exists (
      select 1 from public.vet_blocked_dates b
      where b.vet_id = target_vet_id
        and b.blocked_date = cur_day_date
    ) then
      continue;
    end if;

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

grant execute on function public.get_vet_schedule(uuid, int) to anon, authenticated, service_role;

-- 4. Upgrade book_appointment RPC to check for blocked dates
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
  v_vet_tz text;
  v_slot_date date;
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

  -- 6. Check if slot falls on a blocked date for this vet
  v_vet_tz := coalesce(nullif(trim(v_vet.timezone), ''), 'UTC');
  begin
    v_slot_date := (p_starts_at at time zone v_vet_tz)::date;
  exception when others then
    v_slot_date := (p_starts_at at time zone 'UTC')::date;
  end;

  if exists (
    select 1 from public.vet_blocked_dates b
    where b.vet_id = p_vet_id
      and b.blocked_date = v_slot_date
  ) then
    raise exception 'Veterinarian is unavailable on requested date.'
      using errcode = '55002';
  end if;

  -- 7. Validate Slot is not in past + 15m buffer
  if p_starts_at < (clock_timestamp() + v_buffer_interval) then
    raise exception 'Requested slot is in the past or within the 15-minute advance booking window.'
      using errcode = '22008';
  end if;

  -- 8. Calculate duration & ends_at
  v_duration := coalesce(v_vet.slot_minutes, 30);
  if v_duration <= 0 then
    v_duration := 30;
  end if;
  v_ends_at := p_starts_at + (v_duration || ' minutes')::interval;
  v_price := coalesce(v_vet.price_usd, 29.00);

  -- 9. Concurrency-Safe Insert
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

  -- 10. Return formatted confirmation receipt
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

grant execute on function public.book_appointment(uuid, uuid, timestamptz, text, text, text, text, text) to authenticated, service_role;
