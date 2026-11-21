-- ==============================================================================
-- Migration: 20261024120000_auth_lockout_and_audit.sql
-- Module: Phase C — Authentication & Security (SRS NFR-SEC-001, NFR-SEC-002)
-- Description: Server-side failed login attempt tracker, 5-attempt 15-min lockout,
--              and audit logging
-- ==============================================================================

-- 1. Create public.auth_login_attempts table
CREATE TABLE IF NOT EXISTS public.auth_login_attempts (
  identifier TEXT PRIMARY KEY, -- Lowercased email address
  failed_count INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance index for lockout evaluation
CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_locked_until
  ON public.auth_login_attempts(locked_until);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.auth_login_attempts ENABLE ROW LEVEL SECURITY;

-- Deny direct client table queries; table is managed strictly via trusted RPCs
DROP POLICY IF EXISTS "auth_login_attempts_service_only" ON public.auth_login_attempts;
CREATE POLICY "auth_login_attempts_service_only"
  ON public.auth_login_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. RPC: check_login_lockout (Pre-flight lockout status verification)
CREATE OR REPLACE FUNCTION public.check_login_lockout(p_email TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_identifier TEXT := lower(trim(p_email));
  v_record public.auth_login_attempts%ROWTYPE;
  v_remaining_sec INT;
BEGIN
  IF v_identifier IS NULL OR v_identifier = '' THEN
    RETURN jsonb_build_object('locked', false);
  END IF;

  SELECT * INTO v_record
  FROM public.auth_login_attempts
  WHERE identifier = v_identifier;

  IF FOUND AND v_record.locked_until IS NOT NULL AND v_record.locked_until > now() THEN
    v_remaining_sec := ceil(extract(epoch FROM (v_record.locked_until - now())))::INT;
    RETURN jsonb_build_object(
      'locked', true,
      'locked_until', v_record.locked_until,
      'remaining_seconds', v_remaining_sec,
      'failed_count', v_record.failed_count,
      'message', format('Account is temporarily locked for %s more seconds due to 5 consecutive failed login attempts.', v_remaining_sec)
    );
  END IF;

  RETURN jsonb_build_object('locked', false);
END;
$$;

-- 4. RPC: record_login_attempt (Server-side counter & lockout trigger)
CREATE OR REPLACE FUNCTION public.record_login_attempt(
  p_email TEXT,
  p_success BOOLEAN
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_identifier TEXT := lower(trim(p_email));
  v_record public.auth_login_attempts%ROWTYPE;
  v_new_failed INT;
  v_new_locked TIMESTAMPTZ;
  v_remaining_sec INT;
BEGIN
  IF v_identifier IS NULL OR v_identifier = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid email');
  END IF;

  -- (A) Successful login -> Reset lockout and failure counter
  IF p_success THEN
    INSERT INTO public.auth_login_attempts (identifier, failed_count, locked_until, last_attempt_at)
    VALUES (v_identifier, 0, NULL, now())
    ON CONFLICT (identifier) DO UPDATE
    SET failed_count = 0,
        locked_until = NULL,
        last_attempt_at = now();

    RETURN jsonb_build_object('allowed', true, 'locked', false, 'failed_count', 0);
  END IF;

  -- (B) Failed login -> Evaluate lockout
  SELECT * INTO v_record
  FROM public.auth_login_attempts
  WHERE identifier = v_identifier;

  IF FOUND THEN
    -- If previous lockout has expired, start fresh count at 1
    IF v_record.locked_until IS NOT NULL AND v_record.locked_until <= now() THEN
      v_new_failed := 1;
      v_new_locked := NULL;
    ELSE
      v_new_failed := v_record.failed_count + 1;
      -- Trigger 15-minute lockout at 5 failed attempts
      IF v_new_failed >= 5 THEN
        v_new_locked := now() + interval '15 minutes';
      ELSE
        v_new_locked := NULL;
      END IF;
    END IF;

    UPDATE public.auth_login_attempts
    SET failed_count = v_new_failed,
        locked_until = v_new_locked,
        last_attempt_at = now()
    WHERE identifier = v_identifier;
  ELSE
    v_new_failed := 1;
    v_new_locked := NULL;

    INSERT INTO public.auth_login_attempts (identifier, failed_count, locked_until, last_attempt_at)
    VALUES (v_identifier, v_new_failed, v_new_locked, now());
  END IF;

  IF v_new_locked IS NOT NULL THEN
    v_remaining_sec := ceil(extract(epoch FROM (v_new_locked - now())))::INT;
    RETURN jsonb_build_object(
      'allowed', false,
      'locked', true,
      'locked_until', v_new_locked,
      'remaining_seconds', v_remaining_sec,
      'failed_count', v_new_failed,
      'message', 'Account locked for 15 minutes due to 5 consecutive failed login attempts.'
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'locked', false,
    'failed_count', v_new_failed,
    'remaining_attempts', greatest(0, 5 - v_new_failed)
  );
END;
$$;

-- Grant execution to anon and authenticated callers
GRANT EXECUTE ON FUNCTION public.check_login_lockout(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_login_attempt(TEXT, BOOLEAN) TO anon, authenticated;
