import { ApiClient } from '../../src/lib/api/client';
import { supabase } from '../../src/lib/supabase/client';
import { useAuthStore } from '../../src/store/authStore';
import { AuthError } from '../../src/lib/api/errors';

jest.mock('../../src/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      refreshSession: jest.fn(),
    },
  },
}));

describe('ApiClient Token Injection & 401 Refresh Rotation (FR-AUTH-003)', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    jest.clearAllMocks();
    useAuthStore.getState().clearSession();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('Injects Authorization Bearer token when tokenProvider returns access token', async () => {
    const client = new ApiClient('https://api.vetopia.com/api/v1');
    client.setTokenProvider(async () => 'valid-access-token-123');

    globalThis.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true, data: { status: 'healthy' } }),
    } as any);

    await client.get('appointments');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.vetopia.com/api/v1/appointments',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer valid-access-token-123',
        }),
      }),
    );
  });

  test('Refreshes token and retries request on 401 Unauthorized', async () => {
    const client = new ApiClient('https://api.vetopia.com/api/v1');

    let token = 'expired-token';
    client.setTokenProvider(async () => token);

    // Mock first request: 401 Unauthorized
    // Mock second request: 200 OK
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Token expired' }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, data: [{ id: 'appt-1' }] }),
      } as any);

    // Mock Supabase refreshSession returning new token
    (supabase.auth.refreshSession as jest.Mock).mockImplementationOnce(async () => {
      token = 'new-refreshed-token';
      return {
        data: {
          session: {
            access_token: 'new-refreshed-token',
            refresh_token: 'new-refresh-token',
          },
        },
        error: null,
      };
    });

    const response = await client.get('appointments');

    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(response).toEqual({ success: true, data: [{ id: 'appt-1' }] });
  });

  test('Clears session and throws AuthError when 401 refresh fails', async () => {
    const client = new ApiClient('https://api.vetopia.com/api/v1');
    client.setTokenProvider(async () => 'expired-token');

    globalThis.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ message: 'Invalid session' }),
    } as any);

    // Refresh fails
    (supabase.auth.refreshSession as jest.Mock).mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'Refresh token revoked' },
    });

    await expect(client.get('appointments')).rejects.toThrow(AuthError);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
