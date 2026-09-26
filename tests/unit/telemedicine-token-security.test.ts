import { handleTelemedicineTokenRequest } from '../../src/server/telemedicineTokenHandler';

describe('Telemedicine Token Authorization & Security (FR-TELE-001 / API-TELE-001)', () => {
  const baseTimestamp = new Date('2026-10-01T10:00:00Z').getTime();

  // Mock Supabase Client Factory
  const createMockSupabase = (overrides: {
    user?: any;
    userError?: any;
    appointment?: any;
    apptError?: any;
    vetProfile?: any;
    parentProfile?: any;
  }) => {
    return {
      auth: {
        getUser: jest.fn().mockImplementation((jwt: string) => {
          if (overrides.userError) {
            return Promise.resolve({ data: { user: null }, error: overrides.userError });
          }
          if (jwt === 'valid-parent-token') {
            return Promise.resolve({
              data: {
                user: overrides.user || { id: 'user-parent-1', email: 'parent@example.com' },
              },
              error: null,
            });
          }
          if (jwt === 'valid-vet-token') {
            return Promise.resolve({
              data: { user: overrides.user || { id: 'user-vet-1', email: 'vet@example.com' } },
              error: null,
            });
          }
          if (jwt === 'valid-attacker-token') {
            return Promise.resolve({
              data: {
                user: overrides.user || { id: 'user-attacker-999', email: 'attacker@example.com' },
              },
              error: null,
            });
          }
          return Promise.resolve({
            data: { user: null },
            error: { message: 'Invalid JWT token' },
          });
        }),
      },
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'appointments') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data:
                    overrides.appointment !== undefined
                      ? overrides.appointment
                      : {
                          id: 'apt-001',
                          vet_id: 'vet-profile-1',
                          pet_parent_id: 'user-parent-1',
                          pet_id: 'pet-1',
                          starts_at: '2026-10-01T10:00:00Z',
                          ends_at: '2026-10-01T10:30:00Z',
                          mode: 'video',
                          status: 'scheduled',
                        },
                  error: overrides.apptError || null,
                }),
              }),
            }),
          };
        }
        if (table === 'vet_profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data:
                    overrides.vetProfile !== undefined
                      ? overrides.vetProfile
                      : {
                          id: 'vet-profile-1',
                          name: 'Dr. Sarah Mitchell',
                          user_id: 'user-vet-1',
                        },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data:
                    overrides.parentProfile !== undefined
                      ? overrides.parentProfile
                      : { full_name: 'Jane Doe' },
                  error: null,
                }),
              }),
            }),
          };
        }
        return { select: jest.fn() };
      }),
    } as any;
  };

  describe('1. Authentication Gatekeeping', () => {
    test('Rejects request with 401 when Authorization header is completely missing', async () => {
      const mockSupabase = createMockSupabase({});
      const result = await handleTelemedicineTokenRequest({
        authorizationHeader: undefined,
        body: { appointment_id: 'apt-001' },
        supabaseClient: mockSupabase,
      });

      expect(result.statusCode).toBe(401);
      expect(result.body.success).toBe(false);
      expect(result.body.error?.code).toBe('UNAUTHENTICATED');
    });

    test('Rejects request with 401 when Bearer token is malformed or empty', async () => {
      const mockSupabase = createMockSupabase({});
      const result = await handleTelemedicineTokenRequest({
        authorizationHeader: 'Bearer ',
        body: { appointment_id: 'apt-001' },
        supabaseClient: mockSupabase,
      });

      expect(result.statusCode).toBe(401);
      expect(result.body.success).toBe(false);
      expect(result.body.error?.code).toBe('UNAUTHENTICATED');
    });

    test('Rejects request with 401 when JWT token is invalid or expired', async () => {
      const mockSupabase = createMockSupabase({
        userError: { message: 'Token expired' },
      });
      const result = await handleTelemedicineTokenRequest({
        authorizationHeader: 'Bearer expired-or-invalid-token',
        body: { appointment_id: 'apt-001' },
        supabaseClient: mockSupabase,
      });

      expect(result.statusCode).toBe(401);
      expect(result.body.success).toBe(false);
      expect(result.body.error?.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('2. Request Payload Validation', () => {
    test('Rejects request with 400 when appointment_id is missing from body', async () => {
      const mockSupabase = createMockSupabase({});
      const result = await handleTelemedicineTokenRequest({
        authorizationHeader: 'Bearer valid-parent-token',
        body: {},
        supabaseClient: mockSupabase,
      });

      expect(result.statusCode).toBe(400);
      expect(result.body.success).toBe(false);
      expect(result.body.error?.code).toBe('VALIDATION_ERROR');
    });

    test('Rejects request with 404 when appointment does not exist in database', async () => {
      const mockSupabase = createMockSupabase({ appointment: null });
      const result = await handleTelemedicineTokenRequest({
        authorizationHeader: 'Bearer valid-parent-token',
        body: { appointment_id: 'non-existent-apt' },
        supabaseClient: mockSupabase,
      });

      expect(result.statusCode).toBe(404);
      expect(result.body.success).toBe(false);
      expect(result.body.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('3. Status Validation (Cancelled & Completed Rejection)', () => {
    test('Rejects cancelled appointment with 409 APPOINTMENT_CANCELLED', async () => {
      const mockSupabase = createMockSupabase({
        appointment: {
          id: 'apt-001',
          vet_id: 'vet-profile-1',
          pet_parent_id: 'user-parent-1',
          starts_at: '2026-10-01T10:00:00Z',
          ends_at: '2026-10-01T10:30:00Z',
          mode: 'video',
          status: 'cancelled',
        },
      });

      const result = await handleTelemedicineTokenRequest({
        authorizationHeader: 'Bearer valid-parent-token',
        body: { appointment_id: 'apt-001' },
        supabaseClient: mockSupabase,
        currentTimestamp: baseTimestamp,
      });

      expect(result.statusCode).toBe(409);
      expect(result.body.error?.code).toBe('APPOINTMENT_CANCELLED');
    });

    test('Rejects completed appointment with 409 APPOINTMENT_COMPLETED', async () => {
      const mockSupabase = createMockSupabase({
        appointment: {
          id: 'apt-001',
          vet_id: 'vet-profile-1',
          pet_parent_id: 'user-parent-1',
          starts_at: '2026-10-01T10:00:00Z',
          ends_at: '2026-10-01T10:30:00Z',
          mode: 'video',
          status: 'completed',
        },
      });

      const result = await handleTelemedicineTokenRequest({
        authorizationHeader: 'Bearer valid-parent-token',
        body: { appointment_id: 'apt-001' },
        supabaseClient: mockSupabase,
        currentTimestamp: baseTimestamp,
      });

      expect(result.statusCode).toBe(409);
      expect(result.body.error?.code).toBe('APPOINTMENT_COMPLETED');
    });
  });

  describe('4. Cross-User & Participant Authorization', () => {
    test('Strictly forbids User C (attacker) from obtaining a token for User A & B appointment', async () => {
      const mockSupabase = createMockSupabase({});
      const result = await handleTelemedicineTokenRequest({
        authorizationHeader: 'Bearer valid-attacker-token',
        body: { appointment_id: 'apt-001' },
        supabaseClient: mockSupabase,
        currentTimestamp: baseTimestamp,
      });

      expect(result.statusCode).toBe(403);
      expect(result.body.success).toBe(false);
      expect(result.body.error?.code).toBe('UNAUTHORIZED_PARTICIPANT');
    });

    test('Derives participant role as pet_parent when caller is pet_parent_id', async () => {
      const mockSupabase = createMockSupabase({});
      const result = await handleTelemedicineTokenRequest({
        authorizationHeader: 'Bearer valid-parent-token',
        body: { appointment_id: 'apt-001' },
        supabaseClient: mockSupabase,
        currentTimestamp: baseTimestamp,
      });

      expect(result.statusCode).toBe(200);
      expect(result.body.data?.role).toBe('pet_parent');
      expect(result.body.data?.participant_identity).toBe('user_user-parent-1');
      expect(result.body.data?.participant_name).toBe('Jane Doe');
    });

    test('Derives participant role as vet when caller is vet.user_id', async () => {
      const mockSupabase = createMockSupabase({});
      const result = await handleTelemedicineTokenRequest({
        authorizationHeader: 'Bearer valid-vet-token',
        body: { appointment_id: 'apt-001' },
        supabaseClient: mockSupabase,
        currentTimestamp: baseTimestamp,
      });

      expect(result.statusCode).toBe(200);
      expect(result.body.data?.role).toBe('vet');
      expect(result.body.data?.participant_identity).toBe('user_user-vet-1');
      expect(result.body.data?.participant_name).toBe('Dr. Sarah Mitchell');
    });
  });

  describe('5. Consultation Timing Window (T-15m Rule)', () => {
    test('Rejects token generation when called more than 15 minutes before starts_at', async () => {
      const mockSupabase = createMockSupabase({});
      // Current time is 30 minutes before start (09:30:00Z)
      const earlyTimestamp = new Date('2026-10-01T09:30:00Z').getTime();

      const result = await handleTelemedicineTokenRequest({
        authorizationHeader: 'Bearer valid-parent-token',
        body: { appointment_id: 'apt-001' },
        supabaseClient: mockSupabase,
        currentTimestamp: earlyTimestamp,
      });

      expect(result.statusCode).toBe(409);
      expect(result.body.error?.code).toBe('ROOM_NOT_YET_ACTIVE');
    });

    test('Permits token generation exactly 15 minutes before starts_at (09:45:00Z)', async () => {
      const mockSupabase = createMockSupabase({});
      const exactFifteenBefore = new Date('2026-10-01T09:45:00Z').getTime();

      const result = await handleTelemedicineTokenRequest({
        authorizationHeader: 'Bearer valid-parent-token',
        body: { appointment_id: 'apt-001' },
        supabaseClient: mockSupabase,
        currentTimestamp: exactFifteenBefore,
      });

      expect(result.statusCode).toBe(200);
      expect(result.body.success).toBe(true);
    });

    test('Rejects token generation when consultation window has elapsed (> 30m after ends_at)', async () => {
      const mockSupabase = createMockSupabase({});
      // ends_at is 10:30:00Z, so 11:05:00Z is expired
      const expiredTimestamp = new Date('2026-10-01T11:05:00Z').getTime();

      const result = await handleTelemedicineTokenRequest({
        authorizationHeader: 'Bearer valid-parent-token',
        body: { appointment_id: 'apt-001' },
        supabaseClient: mockSupabase,
        currentTimestamp: expiredTimestamp,
      });

      expect(result.statusCode).toBe(409);
      expect(result.body.error?.code).toBe('ROOM_EXPIRED');
    });
  });

  describe('6. Room Naming, Security & Secrets Isolation', () => {
    test('Server deterministically generates room name without clinical leaks', async () => {
      const mockSupabase = createMockSupabase({});
      const result = await handleTelemedicineTokenRequest({
        authorizationHeader: 'Bearer valid-parent-token',
        body: {
          appointment_id: 'apt-001',
          // Malicious injection attempt in body
          room_name: 'arbitrary-injected-room',
          identity: 'arbitrary-identity',
          role: 'admin',
        },
        supabaseClient: mockSupabase,
        currentTimestamp: baseTimestamp,
      });

      expect(result.statusCode).toBe(200);
      // Room name MUST be server-derived: vetopia-consult-apt-001
      expect(result.body.data?.room_name).toBe('vetopia-consult-apt-001');
      // Identity MUST be server-derived: user_user-parent-1
      expect(result.body.data?.participant_identity).toBe('user_user-parent-1');
      // Role MUST be server-derived: pet_parent (not admin)
      expect(result.body.data?.role).toBe('pet_parent');
    });

    test('LiveKit API secret is NEVER exposed in the response payload', async () => {
      const mockSupabase = createMockSupabase({});
      const secret = 'super-secret-api-secret-key-that-must-never-leak';
      const result = await handleTelemedicineTokenRequest({
        authorizationHeader: 'Bearer valid-parent-token',
        body: { appointment_id: 'apt-001' },
        supabaseClient: mockSupabase,
        livekitConfig: {
          apiKey: 'devkey',
          apiSecret: secret,
          serverUrl: 'wss://test-rtc.livekit.cloud',
        },
        currentTimestamp: baseTimestamp,
      });

      expect(result.statusCode).toBe(200);
      const jsonStr = JSON.stringify(result.body);
      expect(jsonStr).not.toContain(secret);
    });
  });
});
