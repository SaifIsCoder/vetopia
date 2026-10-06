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
