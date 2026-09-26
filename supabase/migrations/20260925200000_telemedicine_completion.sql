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
