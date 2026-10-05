/**
 * AI Triage Endpoint Handler (POST /api/v1/ai/triage-chat) (MVP-09)
 * Vetopia Mobile
 */

import { Request, Response } from 'express';
import { defaultSupabase } from '../telemedicineTokenHandler';
import { triageService } from './triageService';
import { sanitizePetContext } from './safety';
import { PetClinicalContext } from '../../types/ai';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// In-memory sliding rate limiter maps
const userRateLimits = new Map<string, RateLimitRecord>();
const ipRateLimits = new Map<string, RateLimitRecord>();

/**
 * Prunes expired records to prevent unbounded memory growth.
 */
function pruneExpiredRateLimits(): void {
  const now = Date.now();
  for (const [key, record] of userRateLimits.entries()) {
    if (now > record.resetAt) {
      userRateLimits.delete(key);
    }
  }
  for (const [key, record] of ipRateLimits.entries()) {
    if (now > record.resetAt) {
      ipRateLimits.delete(key);
    }
  }
}

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const map = key.startsWith('user:') ? userRateLimits : ipRateLimits;

  // Prune periodically if map size grows large
  if (map.size > 200) {
    pruneExpiredRateLimits();
  }

  const record = map.get(key);

  if (!record || now > record.resetAt) {
    map.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count++;
  return true;
}

export function resetRateLimits(): void {
  userRateLimits.clear();
  ipRateLimits.clear();
}

/**
 * Derives client IP safely.
 * Only trusts forwarding headers if Express app has 'trust proxy' explicitly configured.
 */
export function resolveClientIp(req: Request): string {
  const isProxyTrusted = req.app?.get?.('trust proxy');
  if (isProxyTrusted && req.ip) {
    return req.ip;
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

export async function handleTriageChatRequest(req: Request, res: Response): Promise<void> {
  const abortController = new AbortController();

  // Listen for premature client disconnect on response socket to cancel upstream LLM generation.
  // Avoid req.on('close') which triggers as soon as the POST request body is consumed.
  const onResponseClose = () => {
    if (!res.writableEnded && !res.writableFinished) {
      abortController.abort();
    }
  };
  if (typeof res.on === 'function') {
    res.on('close', onResponseClose);
  }

  try {
    // 1. Resolve Authentication & Guest Mode
    const authHeader = req.headers.authorization;
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const jwt = authHeader.split(' ')[1];
      const { data: userData } = await defaultSupabase.auth.getUser(jwt);
      if (userData?.user?.id) {
        userId = userData.user.id;
      }
    }

    const clientIp = resolveClientIp(req);

    // 2. Enforce Rate Limits (15/hr for auth users, 3/24h for guests)
    if (userId) {
      const allowed = checkRateLimit(`user:${userId}`, 15, 60 * 60 * 1000);
      if (!allowed) {
        res.status(429).json({
          success: false,
          error: {
            message:
              'Rate limit exceeded: You have reached the maximum of 15 triage sessions per hour.',
            code: 'RATE_LIMIT_EXCEEDED',
          },
        });
        return;
      }
    } else {
      const allowed = checkRateLimit(`ip:${clientIp}`, 3, 24 * 60 * 60 * 1000);
      if (!allowed) {
        res.status(429).json({
          success: false,
          error: {
            message:
              'Guest limit exceeded: Guest triage is limited to 3 sessions per 24 hours. Please log in to continue.',
            code: 'RATE_LIMIT_EXCEEDED',
          },
        });
        return;
      }
    }

    // 3. Validate Request Body
    const { messages, petId } = req.body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Validation error: "messages" array is required and must not be empty.',
          code: 'VALIDATION_ERROR',
        },
      });
      return;
    }

    if (messages.length > 10) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Validation error: Maximum conversation history limit is 10 messages.',
          code: 'VALIDATION_ERROR',
        },
      });
      return;
    }

    for (const msg of messages) {
      if (!msg.role || (msg.role !== 'user' && msg.role !== 'assistant')) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Validation error: Message role must be "user" or "assistant".',
            code: 'VALIDATION_ERROR',
          },
        });
        return;
      }

      if (!msg.content || typeof msg.content !== 'string' || msg.content.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Validation error: Message content cannot be empty.',
            code: 'VALIDATION_ERROR',
          },
        });
        return;
      }

      if (msg.content.length > 2000) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Validation error: Individual message exceeds 2000 characters limit.',
            code: 'VALIDATION_ERROR',
          },
        });
        return;
      }
    }

    // 4. Verify Pet Ownership if petId provided
    let petContext: PetClinicalContext | undefined;
    if (petId) {
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            message: 'Authentication required: Guest users cannot query registered pet profiles.',
            code: 'UNAUTHENTICATED',
          },
        });
        return;
      }

      const { data: pet, error: petErr } = await defaultSupabase
        .from('pets')
        .select('id, name, species, breed, age, weight_kg, allergies, conditions, owner_id')
        .eq('id', petId)
        .maybeSingle();

      if (petErr || !pet) {
        res.status(404).json({
          success: false,
          error: {
            message: 'Pet profile not found.',
            code: 'PET_NOT_FOUND',
          },
        });
        return;
      }

      if (pet.owner_id !== userId) {
        res.status(403).json({
          success: false,
          error: {
            message: 'Forbidden: You do not own this pet profile.',
            code: 'FORBIDDEN_PET_ACCESS',
          },
        });
        return;
      }

      petContext = sanitizePetContext(pet);
    }

    if (abortController.signal.aborted) {
      return;
    }

    // 5. Initialize Server-Sent Events (SSE) Response Stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    await triageService.streamTriage(
      messages,
      petContext,
      {
        onChunk: (text: string, isEmergency: boolean) => {
          if (!res.writableEnded && !abortController.signal.aborted) {
            res.write(`data: ${JSON.stringify({ text, isEmergency })}\n\n`);
          }
        },
        onDone: () => {
          if (!res.writableEnded && !abortController.signal.aborted) {
            res.write('data: [DONE]\n\n');
            res.end();
          }
        },
        onError: (err: Error) => {
          if (!res.writableEnded && !abortController.signal.aborted) {
            console.warn('[AITriageHandler] Stream error:', err.message);
            res.write(
              `data: ${JSON.stringify({
                error:
                  'AI assistant unavailable. If this is an emergency, please contact an in-person clinic immediately.',
                isEmergency: true,
              })}\n\n`,
            );
            res.write('data: [DONE]\n\n');
            res.end();
          }
        },
      },
      { signal: abortController.signal },
    );
  } catch (err: any) {
    if (abortController.signal.aborted) {
      return;
    }
    console.error('[AITriageHandler] Unhandled exception:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: {
          message: 'Internal server error in AI triage handler.',
          code: 'INTERNAL_SERVER_ERROR',
        },
      });
    } else if (!res.writableEnded) {
      res.write(
        `data: ${JSON.stringify({
          error:
            'AI assistant unavailable. If this is an emergency, please contact an in-person clinic immediately.',
          isEmergency: true,
        })}\n\n`,
      );
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } finally {
    if (typeof res.removeListener === 'function') {
      res.removeListener('close', onResponseClose);
    }
  }
}
