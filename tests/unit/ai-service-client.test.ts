/**
 * Client AIService & URL Normalization Unit Tests
 * Vetopia Mobile
 */

import { AIService, FALLBACK_ERROR_MESSAGE } from '../../src/lib/ai/aiService';

describe('AIService URL Normalization & Client Invariants', () => {
  test('1. Does not duplicate /api/v1 when env.apiUrl already includes /api/v1', () => {
    const service = new AIService('http://10.0.2.2:3000/api/v1');
    expect(service.getEndpointUrl()).toBe('http://10.0.2.2:3000/api/v1/ai/triage-chat');
  });

  test('2. Appends /api/v1 when env.apiUrl does not include /api/v1', () => {
    const service = new AIService('http://10.0.2.2:3000');
    expect(service.getEndpointUrl()).toBe('http://10.0.2.2:3000/api/v1/ai/triage-chat');
  });

  test('3. Handles trailing slashes gracefully without double slashes', () => {
    const service1 = new AIService('http://10.0.2.2:3000/api/v1/');
    expect(service1.getEndpointUrl()).toBe('http://10.0.2.2:3000/api/v1/ai/triage-chat');

    const service2 = new AIService('http://10.0.2.2:3000/');
    expect(service2.getEndpointUrl()).toBe('http://10.0.2.2:3000/api/v1/ai/triage-chat');
  });

  test('4. Supports custom subpaths', () => {
    const service = new AIService('http://localhost:3000/api/v1');
    expect(service.getEndpointUrl('health')).toBe('http://localhost:3000/api/v1/health');
    expect(service.getEndpointUrl('/custom/route')).toBe(
      'http://localhost:3000/api/v1/custom/route',
    );
  });

  test('5. Times out when server does not respond within timeout window', async () => {
    // Mock global fetch to simulate hung connection
    const originalFetch = global.fetch;
    global.fetch = jest.fn((_url, options: any) => {
      return new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => {
          const err = new Error('The user aborted a request.');
          err.name = 'AbortError';
          reject(err);
        });
      });
    }) as any;

    try {
      const service = new AIService('http://localhost:3000/api/v1');
      let fallbackEvent: any = null;

      await service.streamTriageChat(
        { messages: [{ role: 'user', content: 'Hello' }] },
        (event) => {
          fallbackEvent = event;
        },
        { timeoutMs: 50 }, // Short 50ms timeout for test
      );

      expect(fallbackEvent).toBeDefined();
      expect(fallbackEvent.error).toBe(FALLBACK_ERROR_MESSAGE);
      expect(fallbackEvent.isEmergency).toBe(true);
      expect(fallbackEvent.done).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('6. External abort signal cancels request cleanly without reporting unexpected error', async () => {
    const originalFetch = global.fetch;
    const abortController = new AbortController();

    global.fetch = jest.fn((_url, options: any) => {
      if (options?.signal?.aborted) {
        const err = new Error('The user aborted a request.');
        err.name = 'AbortError';
        return Promise.reject(err);
      }
      return new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => {
          const err = new Error('The user aborted a request.');
          err.name = 'AbortError';
          reject(err);
        });
      });
    }) as any;

    try {
      const service = new AIService('http://localhost:3000/api/v1');
      let emittedEvent: any = null;

      const promise = service.streamTriageChat(
        { messages: [{ role: 'user', content: 'Hello' }] },
        (event) => {
          emittedEvent = event;
        },
        { signal: abortController.signal, timeoutMs: 5000 },
      );

      // Trigger user cancellation
      abortController.abort();
      await promise;

      // When aborted by user, clean exit with no spurious emergency fallback
      expect(emittedEvent).toBeNull();
    } finally {
      global.fetch = originalFetch;
    }
  });
});
