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
      },
      from: jest.fn(),
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
              }),
            }),
          };
        }
        if (table === 'vet_profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: null }),
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
          },
        },
      });

      expect(result.user?.id).toBe('u1');
      expect(result.session).toBeDefined();
    });

    test('Successfully registers a veterinarian with specialty and fee', async () => {
      const mockInsertVet = jest.fn().mockResolvedValue({ error: null });

      (supabase.auth.signUp as jest.Mock).mockResolvedValueOnce({
        data: {
          user: { id: 'v1', email: 'doctor@example.com' },
          session: null,
        },
        error: null,
      });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'vet_profiles') {
          return { insert: mockInsertVet };
        }
        return {
          upsert: jest.fn().mockResolvedValue({ error: null }),
          insert: jest.fn().mockResolvedValue({ error: null }),
        };
      });

      const result = await authService.register({
        email: 'doctor@example.com',
        password: 'DoctorPassword123!',
        fullName: 'Dr. John Doe',
        role: 'vet',
        specialty: 'Dermatology',
        priceUsd: 35,
      });

      expect(mockInsertVet).toHaveBeenCalledWith({
        user_id: 'v1',
        name: 'Dr. John Doe',
        specialty: 'Dermatology',
        price_usd: 35,
      });

      expect(result.user?.id).toBe('v1');
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
});
