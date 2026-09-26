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
