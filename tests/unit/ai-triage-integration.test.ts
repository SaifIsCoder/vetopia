/**
 * AI Gateway Backend Endpoint Integration Tests (POST /api/v1/ai/triage-chat)
 * Vetopia Mobile
 */

import http from 'http';
import { createTelemedicineServer } from '../../src/server/server';
import { resetRateLimits, resolveClientIp } from '../../src/server/ai/triageHandler';
import { defaultSupabase } from '../../src/server/telemedicineTokenHandler';
import { triageService } from '../../src/server/ai/triageService';

// Mock Supabase to simulate auth & pet ownership in integration tests
jest.mock('../../src/server/telemedicineTokenHandler', () => ({
  defaultSupabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
  handleTelemedicineTokenRequest: jest.fn(),
}));

function makeRequest(
  port: number,
  path: string,
  method: string,
  headers: Record<string, string> = {},
  body?: any,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const reqHeaders: Record<string, string> = {
      Connection: 'close',
      ...headers,
    };
    if (payload !== undefined) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = String(Buffer.byteLength(payload));
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: reqHeaders,
        agent: false,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: data,
          });
        });
      },
    );

    req.on('error', reject);
    if (payload !== undefined) {
      req.write(payload);
    }
    req.end();
  });
}

describe('AI Gateway Route Integration (POST /api/v1/ai/triage-chat)', () => {
  jest.setTimeout(25000);
  let server: http.Server;
  let port: number;
  let originalApiKey: string | undefined;

  beforeAll((done) => {
    originalApiKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    (triageService as any).apiKey = null;

    const app = createTelemedicineServer();
    server = app.listen(0, '127.0.0.1', () => {
      const address = server.address() as any;
      port = address.port;
      done();
    });
  });

  afterAll((done) => {
    if (originalApiKey !== undefined) {
      process.env.GEMINI_API_KEY = originalApiKey;
      (triageService as any).apiKey = originalApiKey;
    }
    if (typeof (server as any).closeAllConnections === 'function') {
      (server as any).closeAllConnections();
    }
    server.close(done);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimits();
  });

  test('0. Health endpoints respond with 200 on both /health and /api/v1/health', async () => {
    const res1 = await makeRequest(port, '/health', 'GET');
    expect(res1.status).toBe(200);
    const body1 = JSON.parse(res1.body);
    expect(body1.status).toBe('ok');

    const res2 = await makeRequest(port, '/api/v1/health', 'GET');
    expect(res2.status).toBe(200);
    const body2 = JSON.parse(res2.body);
    expect(body2.status).toBe('ok');
  });

  test('1. Endpoint is mounted at /api/v1/ai/triage-chat', async () => {
    const res = await makeRequest(port, '/api/v1/ai/triage-chat', 'POST', {}, {});

    expect(res.status).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('2. Rejects request with empty messages array with 400', async () => {
    const res = await makeRequest(port, '/api/v1/ai/triage-chat', 'POST', {}, { messages: [] });

    expect(res.status).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.message).toContain('"messages" array is required');
  });

  test('3. Rejects conversation history exceeding 10 messages with 400', async () => {
    const messages = Array.from({ length: 11 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}`,
    }));

    const res = await makeRequest(port, '/api/v1/ai/triage-chat', 'POST', {}, { messages });

    expect(res.status).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.message).toContain('10 messages');
  });

  test('4. Rejects message exceeding 2000 characters limit with 400', async () => {
    const res = await makeRequest(
      port,
      '/api/v1/ai/triage-chat',
      'POST',
      {},
      {
        messages: [{ role: 'user', content: 'x'.repeat(2001) }],
      },
    );

    expect(res.status).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.message).toContain('2000 characters');
  });

  test('5. Rejects guest user attempting to access registered pet profile with 401', async () => {
    const res = await makeRequest(
      port,
      '/api/v1/ai/triage-chat',
      'POST',
      {},
      {
        petId: 'pet-uuid-999',
        messages: [{ role: 'user', content: 'Pet has mild cough' }],
      },
    );

    expect(res.status).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('UNAUTHENTICATED');
  });

  test('6. Rejects authenticated user attempting to access foreign pet with 403', async () => {
    (defaultSupabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-alice-111' } },
      error: null,
    });

    (defaultSupabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: 'pet-bob-222', name: 'Max', owner_id: 'user-bob-999' },
            error: null,
          }),
        }),
      }),
    });

    const res = await makeRequest(
      port,
      '/api/v1/ai/triage-chat',
      'POST',
      { Authorization: 'Bearer valid-jwt-token' },
      {
        petId: 'pet-bob-222',
        messages: [{ role: 'user', content: 'Pet has mild cough' }],
      },
    );

    expect(res.status).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe('FORBIDDEN_PET_ACCESS');
  });

  test('7. Enforces guest rate limiting (3 requests / 24 hours)', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await makeRequest(
        port,
        '/api/v1/ai/triage-chat',
        'POST',
        {},
        {
          messages: [{ role: 'user', content: 'Routine puppy checkup question' }],
        },
      );
      expect(res.status).toBe(200);
    }

    // 4th request from same IP must be rejected
    const blockedRes = await makeRequest(
      port,
      '/api/v1/ai/triage-chat',
      'POST',
      {},
      {
        messages: [{ role: 'user', content: 'Another checkup question' }],
      },
    );

    expect(blockedRes.status).toBe(429);
    const body = JSON.parse(blockedRes.body);
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  test('8. Resists IP spoofing: unvalidated X-Forwarded-For headers cannot evade guest rate limits', async () => {
    // Fill up the 3 allowed requests for this connection using different spoofed header values
    for (let i = 0; i < 3; i++) {
      const res = await makeRequest(
        port,
        '/api/v1/ai/triage-chat',
        'POST',
        { 'X-Forwarded-For': `198.51.100.${i + 1}` },
        {
          messages: [{ role: 'user', content: 'Routine check' }],
        },
      );
      expect(res.status).toBe(200);
    }

    // Attacker rotates X-Forwarded-For across multiple diverse spoofed IPs and proxy lists
    const rotatedSpoofHeaders = [
      '203.0.113.199',
      '10.0.0.1, 198.51.100.99',
      '172.16.0.5',
      '8.8.8.8, 127.0.0.1',
    ];

    for (const spoofedIp of rotatedSpoofHeaders) {
      const spoofedRes = await makeRequest(
        port,
        '/api/v1/ai/triage-chat',
        'POST',
        { 'X-Forwarded-For': spoofedIp },
        {
          messages: [{ role: 'user', content: 'Attacker attempting evasion' }],
        },
      );

      // When trust proxy is disabled, raw X-Forwarded-For is ignored and rate limit remains enforced on true socket IP
      expect(spoofedRes.status).toBe(429);
      const body = JSON.parse(spoofedRes.body);
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(body.error.message).toContain('Guest limit exceeded');
    }

    // Explicit unit verification of resolveClientIp helper
    const fakeReqUntrusted = {
      app: { get: () => false },
      headers: { 'x-forwarded-for': '203.0.113.55' },
      ip: '203.0.113.55',
      socket: { remoteAddress: '127.0.0.1' },
    } as any;
    expect(resolveClientIp(fakeReqUntrusted)).toBe('127.0.0.1');

    const fakeReqTrusted = {
      app: { get: () => true },
      headers: { 'x-forwarded-for': '203.0.113.55' },
      ip: '203.0.113.55',
      socket: { remoteAddress: '10.0.0.1' },
    } as any;
    expect(resolveClientIp(fakeReqTrusted)).toBe('203.0.113.55');
  });

  test('9. Streams SSE response chunks and concludes with [DONE]', async () => {
    const res = await makeRequest(
      port,
      '/api/v1/ai/triage-chat',
      'POST',
      {},
      {
        messages: [
          { role: 'user', content: 'What is a normal resting respiratory rate for cats?' },
        ],
      },
    );

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.body).toContain('data: ');
    expect(res.body).toContain('[DONE]');
  });

  test('10. Regression: Normal stream completion does not prematurely abort active stream and completes cleanly', async () => {
    let capturedSignal: AbortSignal | undefined;
    const streamSpy = jest
      .spyOn(triageService, 'streamTriage')
      .mockImplementation(async (_messages, _petContext, handler, options) => {
        capturedSignal = options?.signal;
        // Simulate progressive chunk emissions
        handler.onChunk('Triage analysis in progress.', false);
        await new Promise((r) => setTimeout(r, 20));
        handler.onChunk(' Pet appears stable.', false);
        await new Promise((r) => setTimeout(r, 20));
        handler.onDone();
      });

    const res = await makeRequest(
      port,
      '/api/v1/ai/triage-chat',
      'POST',
      {},
      {
        messages: [{ role: 'user', content: 'Checking normal completion lifecycle' }],
      },
    );

    expect(res.status).toBe(200);
    expect(res.body).toContain('Triage analysis in progress.');
    expect(res.body).toContain('Pet appears stable.');
    expect(res.body).toContain('[DONE]');
    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(false);

    streamSpy.mockRestore();
  });

  test('11. Regression: Client disconnect during active streaming triggers upstream AbortSignal without crashing', async () => {
    let capturedSignal: AbortSignal | undefined;
    let streamExitedDueToAbort = false;

    const streamSpy = jest
      .spyOn(triageService, 'streamTriage')
      .mockImplementation(async (_messages, _petContext, handler, options) => {
        capturedSignal = options?.signal;
        handler.onChunk('Initial chunk sent.', false);

        // Await client disconnect / abort signal
        for (let i = 0; i < 50; i++) {
          if (options?.signal?.aborted) {
            streamExitedDueToAbort = true;
            return;
          }
          await new Promise((r) => setTimeout(r, 10));
        }
        handler.onDone();
      });

    const payload = JSON.stringify({
      messages: [{ role: 'user', content: 'Checking disconnect abort' }],
    });

    await new Promise<void>((resolve) => {
      const clientReq = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: '/api/v1/ai/triage-chat',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': String(Buffer.byteLength(payload)),
            Connection: 'close',
          },
          agent: false,
        },
        (res) => {
          res.on('data', () => {
            // Once first chunk arrives, client abruptly severs socket connection
            clientReq.destroy();
            resolve();
          });
        },
      );

      clientReq.on('error', () => {
        // Expected ECONNRESET or socket destroy
        resolve();
      });

      clientReq.write(payload);
      clientReq.end();
    });

    // Wait 100ms for Express server to handle res socket close event
    await new Promise((r) => setTimeout(r, 100));

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(true);
    expect(streamExitedDueToAbort).toBe(true);

    streamSpy.mockRestore();
  });
});
