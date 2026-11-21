-- ==============================================================================
-- Migration: 20261024130000_production_readiness_and_account_deletion.sql
-- Description: MVP Production Readiness, Secure Account Deletion, and pg_cron
-- ==============================================================================

-- 1. Secure Account Deletion RPC (Apple App Store Guideline 5.1.1(v) & GDPR Compliance)
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Must be signed in to delete account' USING ERRCODE = '28000';
  END IF;

  -- 1. Remove push notification device tokens
  DELETE FROM public.device_tokens WHERE user_id = v_user_id;

  -- 2. Remove user notifications
  DELETE FROM public.notifications WHERE user_id = v_user_id;

  -- 3. Remove login attempt tracking
  DELETE FROM public.auth_login_attempts WHERE email = (SELECT email FROM auth.users WHERE id = v_user_id);

  -- 4. If pet parent, delete pet records and pet vaccinations (unless clinical compliance retains consultations)
  -- Note: appointments, consultation notes, and prescriptions remain linked with anonymized owner metadata
  -- for statutory veterinary medical board compliance requirements (min 3-5 years retention).
  DELETE FROM public.pet_vaccinations WHERE pet_id IN (SELECT id FROM public.pets WHERE owner_id = v_user_id);
  DELETE FROM public.pets WHERE owner_id = v_user_id;

  -- 5. Delete doctor availability and blocked dates if user is a veterinarian
  DELETE FROM public.vet_blocked_dates WHERE vet_id IN (SELECT id FROM public.vets WHERE user_id = v_user_id);
  DELETE FROM public.vets WHERE user_id = v_user_id;

  -- 6. Delete user roles and profile
  DELETE FROM public.user_roles WHERE user_id = v_user_id;
  DELETE FROM public.profiles WHERE id = v_user_id;

  -- 7. Remove identity from auth.users
  DELETE FROM auth.users WHERE id = v_user_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account() FROM public;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

-- 2. Durable pg_cron Scheduler for Appointment Reminders (Production Worker)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Clean up any existing job with the same identifier
    PERFORM cron.unschedule('process-appointment-reminders-worker')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-appointment-reminders-worker');

    -- Schedule reminder processing every 1 minute
    PERFORM cron.schedule(
      'process-appointment-reminders-worker',
      '* * * * *',
      'SELECT public.process_appointment_reminders();'
    );
  END IF;
END $$;
