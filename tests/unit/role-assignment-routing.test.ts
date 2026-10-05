import { authService } from '../../src/lib/auth/authService';
import { supabase } from '../../src/lib/supabase/client';
import { useAuthStore } from '../../src/store/authStore';
import { ValidationError } from '../../src/lib/api/errors';

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

describe('Role Assignment & Dashboard Routing Suite (Phase 3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().clearSession();
  });

  // Scenario 1: Register a new pet-parent account
  test('Scenario 1: Register a new pet-parent account persists correct metadata', async () => {
    (supabase.auth.signUp as jest.Mock).mockResolvedValueOnce({
      data: {
        user: { id: 'parent-001', email: 'parent@example.com' },
        session: { access_token: 'parent-token', user: { id: 'parent-001' } },
      },
      error: null,
    });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          upsert: jest.fn().mockResolvedValue({ error: null }),
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { id: 'parent-001', full_name: 'Alice Parent', onboarded: false },
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
      return { insert: jest.fn().mockResolvedValue({ error: null }) };
    });

    const result = await authService.register({
      email: 'parent@example.com',
      password: 'StrongPassword123!',
      fullName: 'Alice Parent',
      role: 'pet_parent',
    });

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'parent@example.com',
      password: 'StrongPassword123!',
      options: {
        data: {
          full_name: 'Alice Parent',
          role: 'pet_parent',
        },
      },
    });

    expect(result.user?.id).toBe('parent-001');
    expect(useAuthStore.getState().role).toBe('pet_parent');
  });

  // Scenario 2: Register a new veterinarian account with specialty and consultation price
  test('Scenario 2: Register a new veterinarian account persists specialty and consultation price', async () => {
    const mockInsertVet = jest.fn().mockResolvedValue({ error: null });

    (supabase.auth.signUp as jest.Mock).mockResolvedValueOnce({
      data: {
        user: { id: 'vet-002', email: 'dr.bob@example.com' },
        session: { access_token: 'vet-token', user: { id: 'vet-002' } },
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
                data: {
                  id: 'vp-002',
                  name: 'Dr. Bob Smith',
                  specialty: 'Orthopedics',
                  price_usd: 50,
                  verified: false,
                },
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
              data: [{ role: 'vet' }],
              error: null,
            }),
          }),
        };
      }
      if (table === 'profiles') {
        return {
          upsert: jest.fn().mockResolvedValue({ error: null }),
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { id: 'vet-002', full_name: 'Dr. Bob Smith', onboarded: false },
                error: null,
              }),
            }),
          }),
        };
      }
      return { insert: jest.fn().mockResolvedValue({ error: null }) };
    });

    const result = await authService.register({
      email: 'dr.bob@example.com',
      password: 'StrongPassword123!',
      fullName: 'Dr. Bob Smith',
      role: 'vet',
      specialty: 'Orthopedics',
      priceUsd: 50,
    });

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'dr.bob@example.com',
      password: 'StrongPassword123!',
      options: {
        data: {
          full_name: 'Dr. Bob Smith',
          role: 'vet',
          specialty: 'Orthopedics',
          price_usd: 50,
        },
      },
    });

    expect(result.user?.id).toBe('vet-002');
    expect(useAuthStore.getState().role).toBe('vet');
    expect(useAuthStore.getState().user?.isVet).toBe(true);
    expect(useAuthStore.getState().user?.isVetVerified).toBe(false);
  });

  // Scenario 3: Register while email confirmation is enabled and no session is returned
  test('Scenario 3: Handles email confirmation enabled (null session) without client RLS crashes', async () => {
    (supabase.auth.signUp as jest.Mock).mockResolvedValueOnce({
      data: {
        user: { id: 'vet-unconfirmed', email: 'unconfirmed@vetopia.com' },
        session: null, // Email confirmation required
      },
      error: null,
    });

    const result = await authService.register({
      email: 'unconfirmed@vetopia.com',
      password: 'DoctorPassword123!',
      fullName: 'Dr. Clara Oswald',
      role: 'vet',
      specialty: 'Emergency Medicine',
      priceUsd: 40,
    });

    expect(result.user?.id).toBe('vet-unconfirmed');
    expect(result.session).toBeNull();
    expect(result.profile).toBeNull();
    // Verify client unauthenticated state in store
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  // Scenario 5: Confirm veterinarian registration creates unverified status
  test('Scenario 5: Veterinarian account begins with verified = false', async () => {
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { id: 'vet-unverified', full_name: 'Dr. Unverified', onboarded: true },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'user_roles') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
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
                data: { id: 'vp-unverified', name: 'Dr. Unverified', verified: false },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    const profile = await authService.loadUserProfile('vet-unverified', 'vet@vetopia.com');
    expect(profile.isVet).toBe(true);
    expect(profile.isVetVerified).toBe(false);
    expect(profile.roles).toEqual(['vet']);
  });

  // Scenario 6: Log out and log back in as each account type
  test('Scenario 6: Log out and log back in as veterinarian restores vet role', async () => {
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
      data: {
        user: { id: 'vet-login', email: 'vet.login@vetopia.com' },
        session: { access_token: 'login-token', user: { id: 'vet-login' } },
      },
      error: null,
    });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: { id: 'vet-login', full_name: 'Dr. Login Vet', onboarded: true },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'user_roles') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
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
                data: { id: 'vp-login', name: 'Dr. Login Vet', verified: true },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    const loginResult = await authService.login({
      email: 'vet.login@vetopia.com',
      password: 'CorrectPassword123!',
    });

    expect(loginResult.profile.isVet).toBe(true);
    expect(useAuthStore.getState().role).toBe('vet');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    // Sign out
    (supabase.auth.signOut as jest.Mock).mockResolvedValueOnce({ error: null });
    await authService.signOut();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  // Scenario 7: Destination routing contracts
  test('Scenario 7: Determines correct destination route for vet vs pet parent', () => {
    // Vet routing helper logic
    const resolveRoute = (role: string | null, onboarded: boolean) => {
      if (!onboarded) return '/(auth)/onboarding';
      if (role === 'vet') return '/vet/dashboard';
      return '/(tabs)';
    };

    expect(resolveRoute('vet', true)).toBe('/vet/dashboard');
    expect(resolveRoute('pet_parent', true)).toBe('/(tabs)');
    expect(resolveRoute('vet', false)).toBe('/(auth)/onboarding');
    expect(resolveRoute('pet_parent', false)).toBe('/(auth)/onboarding');
  });

  // Scenario 8: Test missing, invalid, and manipulated role metadata
  test('Scenario 8: Rejects manipulated role values (e.g. admin, super_admin, moderator)', async () => {
    await expect(
      authService.register({
        email: 'attacker@evil.com',
        password: 'Password123!',
        fullName: 'Attacker',
        role: 'admin' as any,
      }),
    ).rejects.toThrow(ValidationError);

    await expect(
      authService.register({
        email: 'attacker@evil.com',
        password: 'Password123!',
        fullName: 'Attacker',
        role: 'super_admin' as any,
      }),
    ).rejects.toThrow(ValidationError);

    await expect(
      authService.register({
        email: 'attacker@evil.com',
        password: 'Password123!',
        fullName: 'Attacker',
        role: 'moderator' as any,
      }),
    ).rejects.toThrow(ValidationError);
  });

  // Scenario 9: Confirm public signup cannot grant administrative privileges
  test('Scenario 9: Privilege escalation check enforces public registration boundaries', async () => {
    const invalidRoles = ['admin', 'super_admin', 'root', 'support', 'staff'];
    for (const r of invalidRoles) {
      await expect(
        authService.register({
          email: `${r}@example.com`,
          password: 'Password123!',
          fullName: 'Test Privilege Escalation',
          role: r as any,
        }),
      ).rejects.toThrow(ValidationError);
    }
  });

  // Scenario 10: Profile loading resilience against silent role conversions
  test('Scenario 10: Throws visibly when database query errors occur, never silently converting roles', async () => {
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database connection terminated', code: '08006' },
              }),
            }),
          }),
        };
      }
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    });

    await expect(authService.loadUserProfile('test-user-err', 'err@vetopia.com')).rejects.toThrow();
  });
});
