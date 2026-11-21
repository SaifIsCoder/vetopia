-- Repair notification trigger queries and restrict worker-only operations.
-- Clinical conversations assign the veterinarian a distinct participant side.
alter type public.participant_side add value if not exists 'vet';

CREATE OR REPLACE FUNCTION public.notify_doctor_entered_consultation(
  p_appointment_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
  SELECT a.pet_parent_id, v.name, a.status
  INTO v_parent_id, v_vet_name, v_status
  FROM public.appointments a
  JOIN public.vet_profiles v ON v.id = a.vet_id
  WHERE a.id = p_appointment_id AND v.user_id = v_user_id AND v.verified
  FOR UPDATE OF a;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FORBIDDEN: Only the assigned veterinarian can dispatch doctor-entered event' USING ERRCODE = '42501';
  END IF;

  IF v_status != 'scheduled' THEN
    RETURN FALSE;
  END IF;

  if exists (
    select 1 from public.notifications n
    where n.user_id = v_parent_id and n.type = 'doctor_entered_consultation'
      and n.data->>'appointmentId' = p_appointment_id::text
  ) then
    return false;
  end if;

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
drop function public.process_appointment_reminders();

create function public.process_appointment_reminders()
returns integer language sql security definer set search_path = ''
as $$
  with claimed as (
    insert into public.appointment_reminders (appointment_id, reminder_type)
    select a.id, '15m'
    from public.appointments a
    where a.status = 'scheduled'
      and a.starts_at >= now() and a.starts_at <= now() + interval '16 minutes'
      and not exists (
        select 1 from public.appointment_reminders r
        where r.appointment_id = a.id and r.reminder_type = '15m'
      )
    order by a.id
    on conflict (appointment_id, reminder_type) do nothing
    returning appointment_id
  ), queued as (
    insert into public.notifications (user_id, type, title, body, data)
    select recipient.user_id, 'appointment_reminder', recipient.title, recipient.body,
      jsonb_build_object('kind', 'appointment_reminder', 'appointmentId', a.id,
                         'deepLink', 'vetopia://consult/' || a.id::text)
    from claimed c
    join public.appointments a on a.id = c.appointment_id
    join public.vet_profiles v on v.id = a.vet_id
    left join public.pets p on p.id = a.pet_id
    cross join lateral (values
      (a.pet_parent_id, 'Consultation Starting Soon',
        'Your consultation for ' || coalesce(p.name, 'your pet') || ' starts in 15 minutes.'),
      (v.user_id, 'Upcoming Consultation in 15 Minutes',
        'Consultation with ' || coalesce(p.name, 'your patient') || ' starts in 15 minutes.')
    ) recipient(user_id, title, body)
    where recipient.user_id is not null
    returning id
  )
  select count(*)::integer from queued;
$$;

CREATE OR REPLACE FUNCTION public.handle_appointment_scheduled_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_vet_user_id UUID;
  v_vet_name TEXT;
  v_pet_name TEXT;
BEGIN
  -- Only trigger for newly scheduled appointments
  IF NEW.status = 'scheduled' THEN
    SELECT user_id, name INTO v_vet_user_id, v_vet_name
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


revoke all on function public.notify_doctor_entered_consultation(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.notify_doctor_entered_consultation(uuid) to authenticated;

revoke all on function public.process_appointment_reminders()
  from public, anon, authenticated, service_role;
grant execute on function public.process_appointment_reminders() to service_role;

alter table public.notifications
  add column push_claim_id uuid,
  add column push_claim_until timestamptz;
revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read, read_at) on public.notifications to authenticated;
grant select, update on public.notifications, public.device_tokens to service_role;

create function public.claim_pending_push_notifications(p_limit integer default 50)
returns table (id uuid, user_id uuid, type text, title text, body text, data jsonb, push_claim_id uuid)
language sql security definer set search_path = ''
as $$
  with pending as (
    select n.id
    from public.notifications n
    where n.pushed_at is null and coalesce(n.push_claim_until, '-infinity') <= statement_timestamp()
    order by n.created_at, n.id
    limit least(100, greatest(1, coalesce(p_limit, 50)))
    for update skip locked
  )
  update public.notifications n set push_claim_id = gen_random_uuid(),
    push_claim_until = statement_timestamp() + interval '5 minutes'
  from pending
  where n.id = pending.id
  returning n.id, n.user_id, n.type, n.title, n.body, n.data, n.push_claim_id;
$$;
revoke all on function public.claim_pending_push_notifications(integer)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_pending_push_notifications(integer) to service_role;

-- Repair the notification-enabled message RPC and restore explicit grants.
CREATE OR REPLACE FUNCTION public.send_direct_message(
  p_conversation_id UUID,
  p_body TEXT
)
RETURNS public.direct_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
    created_at
  )
  VALUES (
    p_conversation_id,
    v_user_id,
    v_trimmed_body,
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
-- The historical notification migration recreates this RPC with default grants.
revoke all on function public.send_direct_message(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.send_direct_message(uuid, text) to authenticated;

-- Preserve the authenticated prescriber ID across the appointment lookup.
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
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_vet_id UUID;
  v_appointment_vet_id UUID;
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
  WHERE user_id = v_user_id AND verified;

  IF v_vet_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN: Caller is not a registered veterinarian' USING ERRCODE = '42501';
  END IF;

  -- 2. Verify appointment exists and caller is assigned doctor
  SELECT vet_id, pet_id, status, pet_parent_id
  INTO v_appointment_vet_id, v_pet_id, v_appt_status, v_owner_id
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_appt_status != 'completed' THEN
    RAISE EXCEPTION 'Precondition Failed: Prescriptions can only be created for completed consultations' USING ERRCODE = '22023';
  END IF;

  IF v_appointment_vet_id IS DISTINCT FROM v_vet_id THEN
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
