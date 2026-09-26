import { AccessToken } from 'livekit-server-sdk';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const getEnv = (key: string, fallback: string): string => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key]!;
  }
  return fallback;
};

const serverSupabaseUrl = getEnv(
  'EXPO_PUBLIC_SUPABASE_URL',
  'https://fkhsqstkkksaerpjoczi.supabase.co',
);
const serverSupabaseAnonKey = getEnv(
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'sb_publishable_82bHaIpBP9cTL2efnWLldA_ilGDcx83',
);

export const defaultSupabase: SupabaseClient = createClient(
  serverSupabaseUrl,
  serverSupabaseAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

export interface LivekitServerConfig {
  apiKey?: string;
  apiSecret?: string;
  serverUrl?: string;
}

export interface TelemedicineTokenResponseData {
  server_url: string;
  token: string;
  room_name: string;
  participant_identity: string;
  participant_name: string;
  role: 'pet_parent' | 'vet';
  mode: 'video' | 'audio' | 'chat';
}

export interface TokenHandlerResult {
  statusCode: number;
  body: {
    success: boolean;
    data?: TelemedicineTokenResponseData;
    error?: {
      message: string;
      code: string;
      details?: unknown;
    };
  };
}

/**
 * Validates consultation timing according to the project's T-15m rule (FR-TELE-001).
 * Window is valid from 15 minutes before starts_at until 30 minutes after ends_at.
 */
export function isConsultationWindowActive(
  startsAtIso: string,
  endsAtIso: string,
  currentTimestamp: number = Date.now(),
): { active: boolean; reason?: 'too_early' | 'expired' } {
  const startsAt = new Date(startsAtIso).getTime();
  const endsAt = new Date(endsAtIso).getTime();

  if (isNaN(startsAt) || isNaN(endsAt)) {
    return { active: false, reason: 'expired' };
  }

  const fifteenMinutesMs = 15 * 60 * 1000;
  const thirtyMinutesMs = 30 * 60 * 1000;

  if (currentTimestamp < startsAt - fifteenMinutesMs) {
    return { active: false, reason: 'too_early' };
  }

  if (currentTimestamp > endsAt + thirtyMinutesMs) {
    return { active: false, reason: 'expired' };
  }

  return { active: true };
}

/**
 * Server-side Telemedicine Token Generation Handler (POST /api/v1/telemedicine/token).
 *
 * Strict Security Invariants:
 * 1. Derives authenticated caller strictly from Authorization Bearer JWT (never trusts body).
 * 2. Verifies appointment exists and is in 'scheduled' status (rejects completed/cancelled).
 * 3. Enforces participant authorization (caller must be pet_parent or consulting vet).
 * 4. Enforces T-15m consultation timing window.
 * 5. Deterministically formats room name ('vetopia-consult-{id}') without clinical data leaks.
 * 6. Generates short-lived, least-privilege LiveKit token (API secrets never exposed).
 */
export async function handleTelemedicineTokenRequest(params: {
  authorizationHeader?: string;
  body: any;
  supabaseClient?: SupabaseClient;
  livekitConfig?: LivekitServerConfig;
  currentTimestamp?: number;
}): Promise<TokenHandlerResult> {
  const {
    authorizationHeader,
    body,
    supabaseClient = defaultSupabase,
    livekitConfig,
    currentTimestamp = Date.now(),
  } = params;

  // 1. Verify Authorization Header (Bearer JWT)
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      body: {
        success: false,
        error: {
          message: 'Authentication required. Authorization header with Bearer token is missing.',
          code: 'UNAUTHENTICATED',
        },
      },
    };
  }

  const jwt = authorizationHeader.replace('Bearer ', '').trim();
  if (!jwt) {
    return {
      statusCode: 401,
      body: {
        success: false,
        error: {
          message: 'Invalid authorization token format.',
          code: 'UNAUTHENTICATED',
        },
      },
    };
  }

  // 2. Resolve caller identity from Supabase Auth
  const { data: userData, error: userError } = await supabaseClient.auth.getUser(jwt);
  if (userError || !userData?.user) {
    return {
      statusCode: 401,
      body: {
        success: false,
        error: {
          message: userError?.message || 'Invalid or expired session token.',
          code: 'UNAUTHENTICATED',
        },
      },
    };
  }

  const authUserId = userData.user.id;

  // 3. Validate request payload: must only contain appointment_id
  const appointmentId = body?.appointment_id;
  if (!appointmentId || typeof appointmentId !== 'string') {
    return {
      statusCode: 400,
      body: {
        success: false,
        error: {
          message: 'Valid appointment_id is required.',
          code: 'VALIDATION_ERROR',
        },
      },
    };
  }

  // 4. Load appointment from database
  const { data: appt, error: apptError } = await supabaseClient
    .from('appointments')
    .select('*')
    .eq('id', appointmentId)
    .maybeSingle();

  if (apptError) {
    return {
      statusCode: 500,
      body: {
        success: false,
        error: {
          message: 'Database query error while loading appointment.',
          code: 'DATABASE_ERROR',
          details: apptError.message,
        },
      },
    };
  }

  if (!appt) {
    return {
      statusCode: 404,
      body: {
        success: false,
        error: {
          message: 'Appointment not found.',
          code: 'NOT_FOUND',
        },
      },
    };
  }

  // 5. Verify appointment status
  if (appt.status === 'cancelled') {
    return {
      statusCode: 409,
      body: {
        success: false,
        error: {
          message: 'This appointment has been cancelled and cannot generate a consultation token.',
          code: 'APPOINTMENT_CANCELLED',
        },
      },
    };
  }

  if (appt.status === 'completed') {
    return {
      statusCode: 409,
      body: {
        success: false,
        error: {
          message: 'This consultation is already completed and cannot be re-entered.',
          code: 'APPOINTMENT_COMPLETED',
        },
      },
    };
  }

  if (appt.status !== 'scheduled') {
    return {
      statusCode: 409,
      body: {
        success: false,
        error: {
          message: `Appointment is not currently scheduled (status: ${appt.status}).`,
          code: 'APPOINTMENT_NOT_SCHEDULED',
        },
      },
    };
  }

  // 6. Look up consulting veterinarian to check vet ownership
  const { data: vetProfile } = await supabaseClient
    .from('vet_profiles')
    .select('id, name, user_id')
    .eq('id', appt.vet_id)
    .maybeSingle();

  const isPetParent = authUserId === appt.pet_parent_id;
  const isVet = !!vetProfile?.user_id && authUserId === vetProfile.user_id;

  // 7. Enforce participant authorization
  if (!isPetParent && !isVet) {
    return {
      statusCode: 403,
      body: {
        success: false,
        error: {
          message: 'Forbidden: You are not an authorized participant in this consultation.',
          code: 'UNAUTHORIZED_PARTICIPANT',
        },
      },
    };
  }

  const role: 'pet_parent' | 'vet' = isVet ? 'vet' : 'pet_parent';

  // 8. Verify consultation timing window (T-15m rule)
  const windowCheck = isConsultationWindowActive(appt.starts_at, appt.ends_at, currentTimestamp);
  if (!windowCheck.active) {
    const errorMsg =
      windowCheck.reason === 'too_early'
        ? 'Consultation room is not yet active. You may enter starting 15 minutes before the scheduled time.'
        : 'Consultation time window has elapsed.';

    return {
      statusCode: 409,
      body: {
        success: false,
        error: {
          message: errorMsg,
          code: windowCheck.reason === 'too_early' ? 'ROOM_NOT_YET_ACTIVE' : 'ROOM_EXPIRED',
        },
      },
    };
  }

  // 9. Resolve display name
  let participantName = role === 'vet' ? vetProfile?.name || 'Dr. Veterinarian' : 'Pet Parent';
  if (role === 'pet_parent') {
    const { data: parentProf } = await supabaseClient
      .from('profiles')
      .select('full_name')
      .eq('id', authUserId)
      .maybeSingle();

    if (parentProf?.full_name) {
      participantName = parentProf.full_name;
    }
  }

  // 10. Generate deterministic room name & identity
  const roomName = `vetopia-consult-${appt.id}`;
  const participantIdentity = `user_${authUserId}`;

  // 11. LiveKit Token Generation with least privilege
  const apiKey = process.env.LIVEKIT_API_KEY || livekitConfig?.apiKey || 'dev-api-key';
  const apiSecret =
    process.env.LIVEKIT_API_SECRET ||
    livekitConfig?.apiSecret ||
    'dev-api-secret-min-32-chars-long!';
  const serverUrl =
    process.env.LIVEKIT_URL ||
    process.env.EXPO_PUBLIC_LIVEKIT_URL ||
    livekitConfig?.serverUrl ||
    'wss://vetopia-rtc.livekit.cloud';

  try {
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: participantName,
      ttl: '2h',
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    return {
      statusCode: 200,
      body: {
        success: true,
        data: {
          server_url: serverUrl,
          token,
          room_name: roomName,
          participant_identity: participantIdentity,
          participant_name: participantName,
          role,
          mode: appt.mode,
        },
      },
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: {
        success: false,
        error: {
          message: 'Failed to generate LiveKit room token.',
          code: 'TOKEN_GENERATION_FAILED',
          details: err?.message,
        },
      },
    };
  }
}
