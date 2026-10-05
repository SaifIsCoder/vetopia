/**
 * AI Clinical Safety, Red-Flag Detection & Gateway Security Tests (MVP-09)
 * Vetopia Mobile
 */

import {
  detectRedFlags,
  sanitizePetContext,
  CLINICAL_SYSTEM_PROMPT,
} from '../../src/server/ai/safety';
import { GeminiTriageService } from '../../src/server/ai/triageService';
import {
  handleTriageChatRequest,
  resetRateLimits,
  checkRateLimit,
} from '../../src/server/ai/triageHandler';
import { defaultSupabase } from '../../src/server/telemedicineTokenHandler';

// Mock Supabase
jest.mock('../../src/server/telemedicineTokenHandler', () => ({
  defaultSupabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

describe('AI Safety & Red-Flag Detection Tests (FR-AI-001)', () => {
  // 1. Red-Flag Emergency Detection Taxonomy
  describe('1. Red-Flag Emergency Symptom Detection', () => {
    test('1.1 Detects toxic ingestion: dark chocolate', () => {
      const result = detectRedFlags('My dog ate 100g of dark chocolate and is breathing fast');
      expect(result.isEmergency).toBe(true);
      expect(result.redFlags.some((rf) => rf.includes('toxic_ingestion'))).toBe(true);
    });

    test('1.2 Detects toxic ingestion: rodenticide / rat poison', () => {
      const result = detectRedFlags('Found my cat near rat poison pellets in the garage');
      expect(result.isEmergency).toBe(true);
      expect(result.redFlags.some((rf) => rf.includes('toxic_ingestion'))).toBe(true);
    });

    test('1.3 Detects respiratory distress / dyspnea', () => {
      const result = detectRedFlags('My French bulldog is gasping for air and has blue gums');
      expect(result.isEmergency).toBe(true);
      expect(result.redFlags.some((rf) => rf.includes('respiratory_distress'))).toBe(true);
    });

    test('1.4 Detects acute seizures / convulsions', () => {
      const result = detectRedFlags('My golden retriever is having a violent seizure on the floor');
      expect(result.isEmergency).toBe(true);
      expect(result.redFlags.some((rf) => rf.includes('neurological_crisis'))).toBe(true);
    });

    test('1.5 Detects Gastric Dilatation-Volvulus (GDV / Bloat)', () => {
      const result = detectRedFlags('My Great Dane has a bloated hard stomach and is dry heaving');
      expect(result.isEmergency).toBe(true);
      expect(result.redFlags.some((rf) => rf.includes('gastric_torsion_gdv'))).toBe(true);
    });

    test('1.6 Detects severe trauma / arterial hemorrhage', () => {
      const result = detectRedFlags('My dog was hit by a car and is bleeding heavily from leg');
      expect(result.isEmergency).toBe(true);
      expect(result.redFlags.some((rf) => rf.includes('severe_trauma_hemorrhage'))).toBe(true);
    });

    test('1.7 Detects urinary blockage in male cat', () => {
      const result = detectRedFlags(
        'Cat cannot pee and has been straining in the litterbox for hours',
      );
      expect(result.isEmergency).toBe(true);
      expect(result.redFlags.some((rf) => rf.includes('urinary_obstruction'))).toBe(true);
    });

    test('1.8 Detects severe heatstroke', () => {
      const result = detectRedFlags('Dog has severe heatstroke after being locked in a hot car');
      expect(result.isEmergency).toBe(true);
      expect(result.redFlags.some((rf) => rf.includes('heatstroke'))).toBe(true);
    });

    test('1.9 Recognizes explicit [EMERGENCY_DETECTED] model token', () => {
      const result = detectRedFlags('[EMERGENCY_DETECTED] Immediate clinical intervention needed');
      expect(result.isEmergency).toBe(true);
    });

    test('1.10 Non-emergency routine questions do not trigger red flag', () => {
      const result = detectRedFlags(
        'What is the recommended core vaccination schedule for a 12-week puppy?',
      );
      expect(result.isEmergency).toBe(false);
      expect(result.redFlags).toHaveLength(0);
    });

    test('1.11 Routine feeding & grooming questions do not trigger red flag', () => {
      const result = detectRedFlags(
        'How often should I brush my Persian cat coat to prevent matting?',
      );
      expect(result.isEmergency).toBe(false);
      expect(result.redFlags).toHaveLength(0);
    });
  });

  // 2. Clinical System Prompt Invariants
  describe('2. Clinical Safety System Prompt Guardrails', () => {
    test('2.1 Explicitly prohibits prescription of drugs or dosages', () => {
      expect(CLINICAL_SYSTEM_PROMPT).toContain('NEVER prescribe prescription-only medications');
      expect(CLINICAL_SYSTEM_PROMPT).toContain('exact pharmaceutical dosages');
    });

    test('2.2 Mandates emergency token generation on red flags', () => {
      expect(CLINICAL_SYSTEM_PROMPT).toContain('[EMERGENCY_DETECTED]');
    });

    test('2.3 Establishes role as triage assistant and disclaims physical examination', () => {
      expect(CLINICAL_SYSTEM_PROMPT).toContain(
        'NOT a substitute for an in-person physical examination',
      );
    });
  });

  // 3. Pet Context Sanitization & PII Stripping
  describe('3. Pet Context PII Protection', () => {
    test('3.1 Preserves only clinical fields and strips private account data', () => {
      const rawPetData = {
        id: 'pet-123',
        name: 'Max',
        species: 'Dog',
        breed: 'Labrador Retriever',
        age: '3 years',
        weight_kg: 28.5,
        allergies: ['Chicken protein'],
        conditions: ['Mild atopic dermatitis'],
        owner_id: 'user-secret-999',
        password_hash: 'secret_hash',
        home_address: '123 Private St',
      };

      const sanitized = sanitizePetContext(rawPetData);
      expect(sanitized).toBeDefined();
      expect(sanitized?.name).toBe('Max');
      expect(sanitized?.species).toBe('Dog');
      expect(sanitized?.allergies).toContain('Chicken protein');
      expect((sanitized as any).owner_id).toBeUndefined();
      expect((sanitized as any).password_hash).toBeUndefined();
      expect((sanitized as any).home_address).toBeUndefined();
    });

    test('3.2 Gracefully handles null or invalid pet data', () => {
      expect(sanitizePetContext(null)).toBeUndefined();
      expect(sanitizePetContext(undefined)).toBeUndefined();
    });
  });

  // 4. Rate Limiting Invariants
  describe('4. Rate Limiting Enforcements', () => {
    beforeEach(() => {
      resetRateLimits();
    });

    test('4.1 Enforces authenticated user limit of 15 requests per hour', () => {
      const userKey = 'user:test-user-1';
      for (let i = 0; i < 15; i++) {
        expect(checkRateLimit(userKey, 15, 3600000)).toBe(true);
      }
      expect(checkRateLimit(userKey, 15, 3600000)).toBe(false);
    });

    test('4.2 Enforces guest rate limit of 3 requests per 24 hours', () => {
      const ipKey = 'ip:192.168.1.50';
      for (let i = 0; i < 3; i++) {
        expect(checkRateLimit(ipKey, 3, 86400000)).toBe(true);
      }
      expect(checkRateLimit(ipKey, 3, 86400000)).toBe(false);
    });
  });

  // 5. AI Gateway Handler Security & Validation
  describe('5. AI Gateway Request Handling & Security (POST /api/v1/ai/triage-chat)', () => {
    const validUserId = '11111111-1111-1111-1111-111111111111';
    const otherUserId = '22222222-2222-2222-2222-222222222222';
    const petId = 'pet-uuid-456';

    beforeEach(() => {
      jest.clearAllMocks();
      resetRateLimits();
    });

    test('5.1 Rejects empty or missing messages array with 400', async () => {
      const req: any = {
        headers: {},
        body: { messages: [] },
        socket: {},
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await handleTriageChatRequest(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
        }),
      );
    });

    test('5.2 Rejects conversation exceeding 10 messages with 400', async () => {
      const messages = Array.from({ length: 11 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
      }));

      const req: any = {
        headers: {},
        body: { messages },
        socket: {},
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await handleTriageChatRequest(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ message: expect.stringContaining('10 messages') }),
        }),
      );
    });

    test('5.3 Rejects message exceeding 2000 characters limit with 400', async () => {
      const req: any = {
        headers: {},
        body: {
          messages: [{ role: 'user', content: 'A'.repeat(2001) }],
        },
        socket: {},
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await handleTriageChatRequest(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('5.4 Rejects unauthenticated guest attempting to supply petId with 401', async () => {
      const req: any = {
        headers: {},
        body: {
          petId,
          messages: [{ role: 'user', content: 'My dog is coughing' }],
        },
        socket: {},
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await handleTriageChatRequest(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('5.5 Rejects user requesting pet owned by another user with 403', async () => {
      (defaultSupabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: validUserId } },
        error: null,
      });

      (defaultSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: petId, name: 'Victim Dog', owner_id: otherUserId },
              error: null,
            }),
          }),
        }),
      });

      const req: any = {
        headers: { authorization: 'Bearer valid-jwt' },
        body: {
          petId,
          messages: [{ role: 'user', content: 'My dog is coughing' }],
        },
        socket: {},
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await handleTriageChatRequest(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'FORBIDDEN_PET_ACCESS' }),
        }),
      );
    });

    test('5.6 Successfully streams SSE events and completes with [DONE]', async () => {
      const chunks: string[] = [];
      const req: any = {
        headers: {},
        body: {
          messages: [{ role: 'user', content: 'Dog ate dark chocolate' }],
        },
        socket: {},
      };
      const res: any = {
        setHeader: jest.fn(),
        write: jest.fn((chunk: string) => chunks.push(chunk)),
        end: jest.fn(),
      };

      await handleTriageChatRequest(req, res);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(res.write).toHaveBeenCalled();
      expect(res.end).toHaveBeenCalled();

      const lastChunk = chunks[chunks.length - 1];
      expect(lastChunk).toContain('[DONE]');
      expect(chunks.some((c) => c.includes('isEmergency'))).toBe(true);
    });
  });

  // 6. Gemini Service Streaming Engine
  describe('6. Gemini Service Streaming Execution', () => {
    test('6.1 Emits streamed chunks and detects emergency payload', async () => {
      const service = new GeminiTriageService();
      const chunks: string[] = [];
      let emergencyTriggered = false;
      let completed = false;

      await service.streamTriage(
        [{ role: 'user', content: 'My cat collapsed and is not responding' }],
        undefined,
        {
          onChunk: (text, isEmergency) => {
            chunks.push(text);
            if (isEmergency) emergencyTriggered = true;
          },
          onDone: () => {
            completed = true;
          },
          onError: (err) => {
            throw err;
          },
        },
      );

      expect(completed).toBe(true);
      expect(emergencyTriggered).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toContain('[EMERGENCY_DETECTED]');
    });
  });
});
