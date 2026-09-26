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
