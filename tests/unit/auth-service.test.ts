import { authService } from '../../src/lib/auth/authService';
import { supabase } from '../../src/lib/supabase/client';
import { useAuthStore } from '../../src/store/authStore';
import { AuthError, ValidationError, ApiError, NetworkError } from '../../src/lib/api/errors';

// Mock Supabase Client
jest.mock('../../src/lib/supabase/client', () => {
  return {
    supabase: {
      auth: {
        signUp: jest.fn(),
        signInWithPassword: jest.fn(),
        signOut: jest.fn(),
        resetPasswordForEmail: jest.fn(),
        refreshSession: jest.fn(),
        getSession: jest.fn(),
        getUser: jest.fn(),
      },
      from: jest.fn(),
      rpc: jest.fn(),
    },
  };
});

describe('AuthService (Supabase Integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().clearSession();
  });

  describe('User Registration (FR-AUTH-001)', () => {
    test('Successfully registers a pet parent', async () => {
      (supabase.auth.signUp as jest.Mock).mockResolvedValueOnce({
        data: {
          user: { id: 'u1', email: 'parent@example.com' },
          session: {
            access_token: 'acc-token',
            refresh_token: 'ref-token',
            user: { id: 'u1', email: 'parent@example.com' },
          },
        },
        error: null,
      });

      // Mock from('profiles').upsert
      // Mock from('user_roles').insert
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            upsert: jest.fn().mockResolvedValue({ error: null }),
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { id: 'u1', full_name: 'Sarah Jenkins', onboarded: false },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'user_roles') {
          return {
            insert: jest.fn().mockResolvedValue({ error: null }),
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [{ role: 'pet_parent' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'vet_profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        return {
          insert: jest.fn().mockResolvedValue({ error: null }),
        };
      });

      const result = await authService.register({
        email: 'parent@example.com',
        password: 'ValidPassword123!',
        fullName: 'Sarah Jenkins',
        role: 'pet_parent',
      });

      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'parent@example.com',
        password: 'ValidPassword123!',
        options: {
          data: {
            full_name: 'Sarah Jenkins',
            role: 'pet_parent',
          },
        },
      });

      expect(result.user?.id).toBe('u1');
      expect(result.session).toBeDefined();
    });

    test('Successfully registers a veterinarian with specialty and fee (metadata persisted when session is null)', async () => {
      (supabase.auth.signUp as jest.Mock).mockResolvedValueOnce({
        data: {
          user: { id: 'v1', email: 'doctor@example.com' },
          session: null,
        },
        error: null,
      });

      const result = await authService.register({
        email: 'doctor@example.com',
        password: 'DoctorPassword123!',
        fullName: 'Dr. John Doe',
        role: 'vet',
        specialty: 'Dermatology',
        priceUsd: 35,
      });

      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'doctor@example.com',
        password: 'DoctorPassword123!',
        options: {
          data: {
            full_name: 'Dr. John Doe',
            role: 'vet',
            specialty: 'Dermatology',
            price_usd: 35,
          },
        },
      });

      expect(result.user?.id).toBe('v1');
      expect(result.session).toBeNull();
    });

    test('Successfully registers a veterinarian with active session and performs progressive client inserts', async () => {
      const mockInsertVet = jest.fn().mockResolvedValue({ error: null });
      const mockInsertRole = jest.fn().mockResolvedValue({ error: null });
      const mockUpsertProfile = jest.fn().mockResolvedValue({ error: null });

      (supabase.auth.signUp as jest.Mock).mockResolvedValueOnce({
        data: {
          user: { id: 'v2', email: 'doctor2@example.com' },
          session: {
            access_token: 'acc-token-2',
            refresh_token: 'ref-token-2',
            user: { id: 'v2', email: 'doctor2@example.com' },
          },
        },
        error: null,
      });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'vet_profiles') {
          return {
            insert: mockInsertVet,
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { id: 'vp-2', name: 'Dr. Jane Smith', verified: false },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'user_roles') {
          return {
            insert: mockInsertRole,
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [{ role: 'vet' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            upsert: mockUpsertProfile,
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { id: 'v2', full_name: 'Dr. Jane Smith', onboarded: false },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          insert: jest.fn().mockResolvedValue({ error: null }),
        };
      });

      const result = await authService.register({
        email: 'doctor2@example.com',
        password: 'DoctorPassword123!',
        fullName: 'Dr. Jane Smith',
        role: 'vet',
        specialty: 'Surgery',
        priceUsd: 45,
      });

      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'doctor2@example.com',
        password: 'DoctorPassword123!',
        options: {
          data: {
            full_name: 'Dr. Jane Smith',
            role: 'vet',
            specialty: 'Surgery',
            price_usd: 45,
          },
        },
      });

      expect(mockInsertVet).toHaveBeenCalledWith({
        user_id: 'v2',
        name: 'Dr. Jane Smith',
        specialty: 'Surgery',
        price_usd: 45,
        verified: false,
      });
      expect(result.user?.id).toBe('v2');
      expect(result.session).toBeDefined();
    });

    test('Rejects client-side privilege escalation attempt to admin', async () => {
      await expect(
        authService.register({
          email: 'hacker@example.com',
          password: 'Password123!',
          fullName: 'Bad Actor',
          role: 'admin' as any,
        }),
      ).rejects.toThrow(ValidationError);
    });

    test('Rejects client-side privilege escalation attempt to super_admin', async () => {
      await expect(
        authService.register({
          email: 'hacker@example.com',
          password: 'Password123!',
          fullName: 'Bad Actor',
          role: 'super_admin' as any,
        }),
      ).rejects.toThrow(ValidationError);
    });

    test('Simulates database RLS check blocking direct admin role insert', async () => {
      // Simulate PostgreSQL RLS "claim own role" check violation (role <> 'admin')
      (supabase.from as jest.Mock).mockImplementationOnce((table: string) => {
        if (table === 'user_roles') {
          return {
            insert: jest.fn().mockResolvedValue({
              data: null,
              error: {
                message: 'new row violates row-level security policy for table "user_roles"',
                code: '42501',
              },
            }),
          };
        }
        return { insert: jest.fn() };
      });

      const { error } = await supabase.from('user_roles').insert({
        user_id: 'u1',
        role: 'admin' as any,
      });

      expect(error).toBeDefined();
      expect(error?.code).toBe('42501');
      expect(error?.message).toContain('violates row-level security policy');
    });

    test('Throws DUPLICATE_EMAIL error (409) when email already registered', async () => {
      (supabase.auth.signUp as jest.Mock).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'User already registered', code: 'user_already_exists' },
      });

      try {
        await authService.register({
          email: 'duplicate@example.com',
          password: 'Password123!',
          fullName: 'Test User',
          role: 'pet_parent',
        });
        fail('Should have thrown ApiError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.code).toBe('DUPLICATE_EMAIL');
        expect(err.status).toBe(409);
      }
    });

    test('Rejects weak password (< 6 chars)', async () => {
      await expect(
        authService.register({
          email: 'user@example.com',
          password: '123',
          fullName: 'Test User',
          role: 'pet_parent',
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('User Login (FR-AUTH-002)', () => {
    test('Authenticates valid credentials and loads profile', async () => {
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
        data: {
          user: { id: 'u1', email: 'parent@example.com' },
          session: {
            access_token: 'login-access-token',
            refresh_token: 'login-refresh-token',
            user: { id: 'u1', email: 'parent@example.com' },
          },
        },
        error: null,
      });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { id: 'u1', full_name: 'Sarah', onboarded: true },
                }),
              }),
            }),
          };
        }
        if (table === 'user_roles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [{ role: 'pet_parent' }],
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: null }),
            }),
          }),
        };
      });

      const result = await authService.login({
        email: 'parent@example.com',
        password: 'CorrectPassword123!',
      });

      expect(result.user.id).toBe('u1');
      expect(result.profile.roles).toContain('pet_parent');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().accessToken).toBe('login-access-token');
    });

    test('Handles invalid credentials with AuthError (401)', async () => {
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials', status: 400 },
      });

      await expect(
        authService.login({
          email: 'wrong@example.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(AuthError);
    });

    test('Handles network failure during login', async () => {
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Failed to fetch', status: 0 },
      });

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(NetworkError);
    });
  });

  describe('Password Reset (Forgot Password)', () => {
    test('Sends reset email for valid address', async () => {
      (supabase.auth.resetPasswordForEmail as jest.Mock).mockResolvedValueOnce({
        data: {},
        error: null,
      });

      await expect(
        authService.requestPasswordReset('registered@example.com'),
      ).resolves.not.toThrow();

      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('registered@example.com');
    });

    test('Rejects invalid email format', async () => {
      await expect(authService.requestPasswordReset('invalid-email')).rejects.toThrow(
        ValidationError,
      );
    });
  });

  describe('Sign Out & Cache Clearing', () => {
    test('Clears auth state and signs out of Supabase', async () => {
      (supabase.auth.signOut as jest.Mock).mockResolvedValueOnce({ error: null });

      useAuthStore.getState().setSession({
        access_token: 'token',
        refresh_token: 'token',
        user: { id: 'u1' },
      } as any);

      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      await authService.signOut();

      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  describe('Authoritative Profile Loading & Role Resilience', () => {
    test('Loads pet_parent profile without converting to veterinarian', async () => {
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { id: 'u-parent', full_name: 'Parent User', onboarded: true },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'user_roles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [{ role: 'pet_parent' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'vet_profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const profile = await authService.loadUserProfile('u-parent', 'parent@example.com');
      expect(profile.isVet).toBe(false);
      expect(profile.roles).toContain('pet_parent');
      expect(profile.roles).not.toContain('vet');
    });

    test('Loads veterinarian profile with verified status', async () => {
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { id: 'u-vet', full_name: 'Dr. Vet', onboarded: true },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'user_roles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [{ role: 'vet' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'vet_profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { id: 'vp-1', name: 'Dr. Vet', verified: true },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const profile = await authService.loadUserProfile('u-vet', 'vet@example.com');
      expect(profile.isVet).toBe(true);
      expect(profile.isVetVerified).toBe(true);
      expect(profile.roles).toContain('vet');
    });

    test('Self-heals missing user_roles row when user has vet_profile or metadata role "vet"', async () => {
      const mockInsertRole = jest.fn().mockResolvedValue({ error: null });

      (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: {
          user: {
            id: 'u-vet-healing',
            user_metadata: { role: 'vet' },
          },
        },
        error: null,
      });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { id: 'u-vet-healing', full_name: 'Dr. Healed', onboarded: false },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'user_roles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [], // empty roles row in DB
                error: null,
              }),
            }),
            insert: mockInsertRole,
          };
        }
        if (table === 'vet_profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { id: 'vp-heal', name: 'Dr. Healed', verified: false },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const profile = await authService.loadUserProfile('u-vet-healing', 'vet-heal@example.com');
      expect(profile.isVet).toBe(true);
      expect(profile.roles).toEqual(['vet']);
      expect(mockInsertRole).toHaveBeenCalledWith({
        user_id: 'u-vet-healing',
        role: 'vet',
      });
    });

    test('Throws error when user_roles query returns database error instead of silently defaulting', async () => {
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { id: 'u-err', full_name: 'Dr. Err', onboarded: true },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'user_roles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'connection timeout to user_roles', code: '57P01' },
              }),
            }),
          };
        }
        if (table === 'vet_profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(authService.loadUserProfile('u-err', 'err@example.com')).rejects.toThrow();
    });
  });
});
