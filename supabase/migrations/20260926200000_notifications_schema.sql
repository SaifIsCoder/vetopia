-- ==============================================================================
-- Migration: 20260926200000_notifications_schema.sql
-- Description: MVP-08 Notifications & Device Tokens Schema, RLS, Triggers, and RPCs
-- ==============================================================================

-- 1. Device Tokens Table
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_device_tokens_user_token UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON public.device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON public.device_tokens(token);
CREATE INDEX IF NOT EXISTS idx_device_tokens_active ON public.device_tokens(is_active) WHERE is_active = TRUE;

-- 2. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  pushed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_unpushed ON public.notifications(pushed_at) WHERE pushed_at IS NULL;

-- 3. Idempotent Appointment Reminders Tracking Table
CREATE TABLE IF NOT EXISTS public.appointment_reminders (
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (appointment_id, reminder_type)
);

-- ==============================================================================
-- 4. Row Level Security (RLS)
-- ==============================================================================

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;

-- Device Tokens Policies
DROP POLICY IF EXISTS "device_tokens_select_own" ON public.device_tokens;
CREATE POLICY "device_tokens_select_own" 
  ON public.device_tokens FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "device_tokens_insert_own" ON public.device_tokens;
CREATE POLICY "device_tokens_insert_own" 
  ON public.device_tokens FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "device_tokens_update_own" ON public.device_tokens;
CREATE POLICY "device_tokens_update_own" 
  ON public.device_tokens FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "device_tokens_delete_own" ON public.device_tokens;
CREATE POLICY "device_tokens_delete_own" 
  ON public.device_tokens FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Notifications Policies
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" 
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" 
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Deny direct client INSERT/DELETE on notifications; creation is server-authoritative
REVOKE INSERT, DELETE ON public.notifications FROM authenticated, anon;

-- Reminders table is internal/server-only
REVOKE ALL ON public.appointment_reminders FROM anon, authenticated;

-- ==============================================================================
-- 5. RPC Functions
-- ==============================================================================

-- 5.1 Register or update device push token
CREATE OR REPLACE FUNCTION public.register_device_token(
  p_token TEXT,
  p_platform TEXT
)
RETURNS public.device_tokens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_platform TEXT;
  v_result public.device_tokens;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RAISE EXCEPTION 'Token cannot be empty' USING ERRCODE = '22023';
  END IF;

  v_platform := lower(trim(p_platform));
  IF v_platform NOT IN ('ios', 'android', 'web') THEN
    v_platform := 'android'; -- default safe fallback
  END IF;

  INSERT INTO public.device_tokens (
    user_id,
    token,
    platform,
    is_active,
    updated_at,
    last_used_at
  )
  VALUES (
    v_user_id,
    p_token,
    v_platform,
    TRUE,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id, token)
  DO UPDATE SET
    platform = EXCLUDED.platform,
    is_active = TRUE,
    updated_at = NOW(),
    last_used_at = NOW()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- 5.2 Deactivate device push token
CREATE OR REPLACE FUNCTION public.deactivate_device_token(
  p_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  UPDATE public.device_tokens
  SET is_active = FALSE, updated_at = NOW()
  WHERE user_id = v_user_id AND token = p_token;

  RETURN TRUE;
END;
$$;

-- 5.3 Mark single notification as read
CREATE OR REPLACE FUNCTION public.mark_notification_read(
  p_notification_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  UPDATE public.notifications
  SET read = TRUE, read_at = NOW()
  WHERE id = p_notification_id AND user_id = v_user_id;

  RETURN TRUE;
END;
$$;

-- 5.4 Mark all notifications as read for current user
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_updated INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  WITH updated AS (
    UPDATE public.notifications
    SET read = TRUE, read_at = NOW()
    WHERE user_id = v_user_id AND read = FALSE
    RETURNING id
  )
  SELECT count(*) INTO v_updated FROM updated;

  RETURN v_updated;
END;
$$;

-- 5.5 Get total unread notification count
CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS INT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_count INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.notifications
  WHERE user_id = v_user_id AND read = FALSE;

  RETURN COALESCE(v_count, 0);
END;
$$;

-- 5.6 Server-Authoritative Doctor Joined Notification Trigger
CREATE OR REPLACE FUNCTION public.notify_doctor_entered_consultation(
  p_appointment_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_parent_id UUID;
  v_vet_name TEXT;
  v_status TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  -- Ensure appointment exists, is scheduled, and caller is the assigned doctor
  SELECT a.pet_parent_id, v.full_name, a.status
  INTO v_parent_id, v_vet_name, v_status
  FROM public.appointments a
  JOIN public.vet_profiles v ON v.id = a.vet_id
  WHERE a.id = p_appointment_id AND v.user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FORBIDDEN: Only the assigned veterinarian can dispatch doctor-entered event' USING ERRCODE = '42501';
  END IF;

  IF v_status != 'scheduled' THEN
    RETURN FALSE;
  END IF;

  -- Insert notification for the pet parent
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    body,
    data
  )
  VALUES (
    v_parent_id,
    'doctor_entered_consultation',
    'Doctor Has Joined Consultation',
    COALESCE('Dr. ' || v_vet_name, 'Your veterinarian') || ' is in the consultation room. Please enter to begin.',
    jsonb_build_object(
      'kind', 'doctor_entered_consultation',
      'appointmentId', p_appointment_id,
      'deepLink', 'vetopia://consult/' || p_appointment_id::text
    )
  );

  RETURN TRUE;
END;
$$;

-- 5.7 Idempotent 15-Minute Consultation Reminder Batch Processor
CREATE OR REPLACE FUNCTION public.process_appointment_reminders()
RETURNS TABLE (
  notification_id UUID,
  recipient_user_id UUID,
  notification_type TEXT,
  notification_title TEXT,
  notification_body TEXT,
  notification_data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_record RECORD;
  v_notif_parent_id UUID;
  v_notif_vet_id UUID;
BEGIN
  -- Scan for scheduled appointments occurring within the [NOW(), NOW() + 16 mins] window
  -- that have NOT yet received their 15m reminder.
  FOR v_record IN
    SELECT 
      a.id AS appt_id,
      a.pet_parent_id,
      v.user_id AS vet_user_id,
      v.full_name AS vet_name,
      p.name AS pet_name
    FROM public.appointments a
    JOIN public.vet_profiles v ON v.id = a.vet_id
    LEFT JOIN public.pets p ON p.id = a.pet_id
    WHERE a.status = 'scheduled'
      AND a.starts_at >= NOW()
      AND a.starts_at <= (NOW() + INTERVAL '16 minutes')
      AND NOT EXISTS (
        SELECT 1 FROM public.appointment_reminders ar 
        WHERE ar.appointment_id = a.id AND ar.reminder_type = '15m'
      )
  LOOP
    -- Idempotently mark reminder as sent
    INSERT INTO public.appointment_reminders (appointment_id, reminder_type, sent_at)
    VALUES (v_record.appt_id, '15m', NOW())
    ON CONFLICT (appointment_id, reminder_type) DO NOTHING;

    -- Notification for Pet Parent
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      data
    )
    VALUES (
      v_record.pet_parent_id,
      'appointment_reminder',
      'Consultation Starting Soon',
      'Your consultation for ' || COALESCE(v_record.pet_name, 'your pet') || ' starts in 15 minutes.',
      jsonb_build_object(
        'kind', 'appointment_reminder',
        'appointmentId', v_record.appt_id,
        'deepLink', 'vetopia://consult/' || v_record.appt_id::text
      )
    )
    RETURNING id INTO v_notif_parent_id;

    notification_id := v_notif_parent_id;
    recipient_user_id := v_record.pet_parent_id;
    notification_type := 'appointment_reminder';
    notification_title := 'Consultation Starting Soon';
    notification_body := 'Your consultation for ' || COALESCE(v_record.pet_name, 'your pet') || ' starts in 15 minutes.';
    notification_data := jsonb_build_object(
      'kind', 'appointment_reminder',
      'appointmentId', v_record.appt_id,
      'deepLink', 'vetopia://consult/' || v_record.appt_id::text
    );
    RETURN NEXT;

    -- Notification for Veterinarian
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      data
    )
    VALUES (
      v_record.vet_user_id,
      'appointment_reminder',
      'Upcoming Consultation in 15 Minutes',
      'Consultation with ' || COALESCE(v_record.pet_name, 'patient') || ' starts in 15 minutes.',
      jsonb_build_object(
        'kind', 'appointment_reminder',
        'appointmentId', v_record.appt_id,
        'deepLink', 'vetopia://consult/' || v_record.appt_id::text
      )
    )
    RETURNING id INTO v_notif_vet_id;

    notification_id := v_notif_vet_id;
    recipient_user_id := v_record.vet_user_id;
    notification_type := 'appointment_reminder';
    notification_title := 'Upcoming Consultation in 15 Minutes';
    notification_body := 'Consultation with ' || COALESCE(v_record.pet_name, 'patient') || ' starts in 15 minutes.';
    notification_data := jsonb_build_object(
      'kind', 'appointment_reminder',
      'appointmentId', v_record.appt_id,
      'deepLink', 'vetopia://consult/' || v_record.appt_id::text
    );
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ==============================================================================
-- 6. Trigger: Appointment Booked / Confirmed Notifications
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_appointment_scheduled_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_vet_user_id UUID;
  v_vet_name TEXT;
  v_pet_name TEXT;
BEGIN
  -- Only trigger for newly scheduled appointments
  IF NEW.status = 'scheduled' THEN
    SELECT user_id, full_name INTO v_vet_user_id, v_vet_name
    FROM public.vet_profiles WHERE id = NEW.vet_id;

    SELECT name INTO v_pet_name
    FROM public.pets WHERE id = NEW.pet_id;

    -- 1. Notify Pet Parent
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      data
    )
    VALUES (
      NEW.pet_parent_id,
      'appointment_confirmed',
      'Consultation Confirmed',
      'Your consultation with Dr. ' || COALESCE(v_vet_name, 'Veterinarian') || ' is scheduled.',
      jsonb_build_object(
        'kind', 'appointment_confirmed',
        'appointmentId', NEW.id,
        'deepLink', 'vetopia://appointments'
      )
    );

    -- 2. Notify Assigned Veterinarian
    IF v_vet_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        user_id,
        type,
        title,
        body,
        data
      )
      VALUES (
        v_vet_user_id,
        'appointment_confirmed',
        'New Consultation Booked',
        'A consultation has been scheduled for ' || COALESCE(v_pet_name, 'patient') || '.',
        jsonb_build_object(
          'kind', 'appointment_confirmed',
          'appointmentId', NEW.id,
          'deepLink', 'vetopia://appointments'
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointment_scheduled_notification ON public.appointments;
CREATE TRIGGER trg_appointment_scheduled_notification
AFTER INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.handle_appointment_scheduled_notification();

-- ==============================================================================
-- 7. Update send_direct_message to automatically trigger notification for recipient
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.send_direct_message(
  p_conversation_id UUID,
  p_body TEXT
)
RETURNS public.direct_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_is_member BOOLEAN;
  v_recipient_id UUID;
  v_trimmed_body TEXT;
  v_new_message public.direct_messages;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  v_trimmed_body := trim(p_body);
  IF v_trimmed_body IS NULL OR length(v_trimmed_body) = 0 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Message body cannot be empty' USING ERRCODE = '22023';
  END IF;

  IF length(v_trimmed_body) > 4000 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Message body exceeds 4000 characters limit' USING ERRCODE = '22023';
  END IF;

  -- Verify caller is a verified conversation participant
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id AND user_id = v_user_id
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'FORBIDDEN: User is not a participant in this conversation' USING ERRCODE = '42501';
  END IF;

  -- Insert message
  INSERT INTO public.direct_messages (
    conversation_id,
    sender_id,
    body,
    status,
    created_at
  )
  VALUES (
    p_conversation_id,
    v_user_id,
    v_trimmed_body,
    'sent',
    NOW()
  )
  RETURNING * INTO v_new_message;

  -- Touch conversation timestamp
  UPDATE public.conversations
  SET last_message_at = NOW()
  WHERE id = p_conversation_id;

  -- Update sender last_read_at
  UPDATE public.conversation_participants
  SET last_read_at = NOW()
  WHERE conversation_id = p_conversation_id AND user_id = v_user_id;

  -- Identify counterpart recipient to insert notification
  SELECT user_id INTO v_recipient_id
  FROM public.conversation_participants
  WHERE conversation_id = p_conversation_id AND user_id != v_user_id
  LIMIT 1;

  IF v_recipient_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      data
    )
    VALUES (
      v_recipient_id,
      'new_message',
      'New Clinical Message',
      'You have received a new consultation message.',
      jsonb_build_object(
        'kind', 'new_message',
        'conversationId', p_conversation_id,
        'messageId', v_new_message.id,
        'deepLink', 'vetopia://messages/' || p_conversation_id::text
      )
    );
  END IF;

  RETURN v_new_message;
END;
$$;

-- ==============================================================================
-- 8. Update create_prescription to automatically trigger notification for pet parent
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.create_prescription(
  p_appointment_id UUID,
  p_diagnosis TEXT,
  p_notes TEXT DEFAULT NULL,
  p_refills_allowed INT DEFAULT 0,
  p_items JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_vet_id UUID;
  v_pet_id UUID;
  v_owner_id UUID;
  v_appt_status TEXT;
  v_prescription_id UUID;
  v_item JSONB;
  v_item_count INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  -- 1. Verify caller is a registered veterinarian
  SELECT id INTO v_vet_id
  FROM public.vet_profiles
  WHERE user_id = v_user_id;

  IF v_vet_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: Caller is not a registered veterinarian' USING ERRCODE = '42501';
  END IF;

  -- 2. Verify appointment exists and caller is assigned doctor
  SELECT vet_id, pet_id, status, pet_parent_id
  INTO v_vet_id, v_pet_id, v_appt_status, v_owner_id
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_appt_status != 'completed' THEN
    RAISE EXCEPTION 'Precondition Failed: Prescriptions can only be created for completed consultations' USING ERRCODE = '22023';
  END IF;

  IF (SELECT vet_id FROM public.appointments WHERE id = p_appointment_id) != v_vet_id THEN
    RAISE EXCEPTION 'FORBIDDEN: Only the consulting doctor can issue a prescription for this visit' USING ERRCODE = '42501';
  END IF;

  IF p_diagnosis IS NULL OR length(trim(p_diagnosis)) = 0 THEN
    RAISE EXCEPTION 'Validation Failed: Primary diagnosis is required' USING ERRCODE = '22023';
  END IF;

  v_item_count := jsonb_array_length(p_items);
  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'Validation Failed: At least one medication item is required' USING ERRCODE = '22023';
  END IF;

  -- 3. Insert prescription record
  INSERT INTO public.prescriptions (
    appointment_id,
    vet_id,
    pet_id,
    diagnosis,
    notes,
    refills_allowed,
    status,
    created_at,
    updated_at
  )
  VALUES (
    p_appointment_id,
    v_vet_id,
    v_pet_id,
    trim(p_diagnosis),
    CASE WHEN p_notes IS NOT NULL AND length(trim(p_notes)) > 0 THEN trim(p_notes) ELSE NULL END,
    COALESCE(p_refills_allowed, 0),
    'active',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_prescription_id;

  -- 4. Insert medication line items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF (v_item->>'medication_name') IS NULL OR length(trim(v_item->>'medication_name')) = 0 THEN
      RAISE EXCEPTION 'Validation Failed: Medication name is required for all line items' USING ERRCODE = '22023';
    END IF;

    IF (v_item->>'dosage') IS NULL OR length(trim(v_item->>'dosage')) = 0 THEN
      RAISE EXCEPTION 'Validation Failed: Dosage is required for all line items' USING ERRCODE = '22023';
    END IF;

    IF (v_item->>'frequency') IS NULL OR length(trim(v_item->>'frequency')) = 0 THEN
      RAISE EXCEPTION 'Validation Failed: Frequency is required for all line items' USING ERRCODE = '22023';
    END IF;

    IF (v_item->>'duration') IS NULL OR length(trim(v_item->>'duration')) = 0 THEN
      RAISE EXCEPTION 'Validation Failed: Duration is required for all line items' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.prescription_items (
      prescription_id,
      medication_name,
      dosage,
      frequency,
      duration,
      special_instructions
    )
    VALUES (
      v_prescription_id,
      trim(v_item->>'medication_name'),
      trim(v_item->>'dosage'),
      trim(v_item->>'frequency'),
      trim(v_item->>'duration'),
      trim(v_item->>'special_instructions')
    );
  END LOOP;

  -- 5. Notify Pet Parent of newly issued prescription
  IF v_owner_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      data
    )
    VALUES (
      v_owner_id,
      'prescription_issued',
      'Digital Prescription Issued',
      'Your veterinarian has issued a digital prescription for your pet.',
      jsonb_build_object(
        'kind', 'prescription_issued',
        'prescriptionId', v_prescription_id,
        'appointmentId', p_appointment_id,
        'deepLink', 'vetopia://prescriptions/' || v_prescription_id::text
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'prescription_id', v_prescription_id,
    'appointment_id', p_appointment_id,
    'items_count', v_item_count,
    'status', 'active'
  );
END;
$$;
