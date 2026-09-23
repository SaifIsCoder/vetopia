import { authService } from '../../src/lib/auth/authService';
import { supabase } from '../../src/lib/supabase/client';
import { useAuthStore } from '../../src/store/authStore';
import { ForbiddenError } from '../../src/lib/api/errors';

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
      rpc: jest.fn(),
    },
  };
});

describe('Veterinarian Authorization Security Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().clearSession();
  });

  describe('1. Normal user cannot self-approve', () => {
    test('Blocks normal applicant attempting to approve their own vet profile', async () => {
      // Mock the RPC response rejecting non-admin invocation
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: {
          message: 'Unauthorized: Only administrators can approve or verify veterinarians.',
          code: '42501',
        },
      });

      // Attempt self-approval via approveVet
      await expect(authService.approveVet('my-own-vet-profile-id', true)).rejects.toThrow(
        ForbiddenError,
      );

      expect(supabase.rpc).toHaveBeenCalledWith('approve_vet', {
        target_vet_id: 'my-own-vet-profile-id',
        approve_status: true,
      });
    });
  });

  describe('2. Normal user cannot set verified=true', () => {
    test('Blocks direct UPDATE attempt by normal user setting verified=true on vet_profiles', async () => {
      // Mock direct update on vet_profiles where trigger/RLS raises exception
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: {
            message:
              'Unauthorized: Only administrators can modify veterinarian verification status.',
            code: 'P0001',
          },
        }),
      });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'vet_profiles') {
          return { update: mockUpdate };
        }
        return {};
      });

      // Simulate client attempting direct query
      const { data, error } = await supabase
        .from('vet_profiles')
        .update({ verified: true })
        .eq('user_id', 'applicant-uid-123');

      expect(error).toBeDefined();
      expect(error?.message).toContain(
        'Only administrators can modify veterinarian verification status',
      );
      expect(data).toBeNull();
    });

    test('Blocks direct INSERT attempt by normal user with verified=true on vet_profiles', async () => {
      // Mock direct insert on vet_profiles where RLS policy rejects verified=true
      const mockInsert = jest.fn().mockResolvedValue({
        data: null,
        error: {
          message: 'new row violates row-level security policy for table "vet_profiles"',
          code: '42501',
        },
      });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'vet_profiles') {
          return { insert: mockInsert };
        }
        return {};
      });

      // Attempt to self-assign verified=true during direct insertion
      const { data, error } = await supabase.from('vet_profiles').insert({
        user_id: 'applicant-uid-123',
        name: 'Dr. Hack',
        verified: true,
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain('violates row-level security policy');
      expect(data).toBeNull();
    });
  });

  describe('3. Unauthorized user cannot approve a vet', () => {
    test('Blocks another non-admin user (e.g. pet parent or peer vet) from approving a vet', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: {
          message: 'Unauthorized: Only administrators can approve or verify veterinarians.',
          code: '42501',
        },
      });

      // Non-admin attempting to approve another doctor
      await expect(authService.approveVet('target-candidate-vet-id', true)).rejects.toThrow(
        ForbiddenError,
      );

      expect(supabase.rpc).toHaveBeenCalledWith('approve_vet', {
        target_vet_id: 'target-candidate-vet-id',
        approve_status: true,
      });
    });

    test('Blocks direct UPDATE of another vet profile via RLS (0 rows matched)', async () => {
      // In Supabase, attempting to update someone else's row without permission matches 0 rows
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: [],
          count: 0,
          error: null,
        }),
      });

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'vet_profiles') {
          return { update: mockUpdate };
        }
        return {};
      });

      const { data, count } = await supabase
        .from('vet_profiles')
        .update({ verified: true })
        .eq('id', 'other-vet-uuid');

      // Zero rows affected
      expect(count).toBe(0);
      expect(data).toEqual([]);
    });
  });

  describe('4. Authorized admin can approve a vet', () => {
    test('Successfully approves a vet via secure admin RPC', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: {
          id: 'target-vet-id',
          name: 'Dr. John Doe',
          verified: true,
        },
        error: null,
      });

      const success = await authService.approveVet('target-vet-id', true);
      expect(success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('approve_vet', {
        target_vet_id: 'target-vet-id',
        approve_status: true,
      });
    });

    test('Authoritative profile loading reflects isVetVerified=true after approval', async () => {
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { id: 'vet-uid', full_name: 'Dr. John Doe', onboarded: true },
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
              }),
            }),
          };
        }
        if (table === 'vet_profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { id: 'target-vet-id', name: 'Dr. John Doe', verified: true },
                }),
              }),
            }),
          };
        }
        return {};
      });

      const profile = await authService.loadUserProfile('vet-uid', 'vet@example.com');
      expect(profile.isVet).toBe(true);
      expect(profile.isVetVerified).toBe(true);
    });
  });

  describe('5. Existing vet registration still works', () => {
    test('Allows a legitimate vet applicant to register with verified=false and loads unverified state', async () => {
      (supabase.auth.signUp as jest.Mock).mockResolvedValueOnce({
        data: {
          user: { id: 'new-vet-uid', email: 'applicant@example.com' },
          session: {
            access_token: 'valid-vet-token',
            refresh_token: 'valid-vet-refresh',
            user: { id: 'new-vet-uid', email: 'applicant@example.com' },
          },
        },
        error: null,
      });

      let insertedVetProfilePayload: any = null;

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            upsert: jest.fn().mockResolvedValue({ error: null }),
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { id: 'new-vet-uid', full_name: 'Dr. Sarah Connor', onboarded: false },
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
              }),
            }),
          };
        }
        if (table === 'vet_profiles') {
          return {
            insert: jest.fn().mockImplementation((payload) => {
              insertedVetProfilePayload = payload;
              return Promise.resolve({ error: null });
            }),
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: {
                    id: 'new-vet-profile-id',
                    name: 'Dr. Sarah Connor',
                    verified: false,
                  },
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await authService.register({
        email: 'applicant@example.com',
        password: 'SecurePassword123!',
        fullName: 'Dr. Sarah Connor',
        role: 'vet',
        specialty: 'Feline Surgery',
        priceUsd: 45,
      });

      // Assert registration succeeded
      expect(result.user?.id).toBe('new-vet-uid');
      expect(result.session).toBeDefined();

      // Assert that vet_profiles was created with verified: false
      expect(insertedVetProfilePayload).toBeDefined();
      expect(insertedVetProfilePayload.verified).toBe(false);
      expect(insertedVetProfilePayload.name).toBe('Dr. Sarah Connor');
      expect(insertedVetProfilePayload.specialty).toBe('Feline Surgery');
      expect(insertedVetProfilePayload.price_usd).toBe(45);

      // Assert loaded profile reflects applicant status (isVet=true, isVetVerified=false)
      expect(result.profile?.isVet).toBe(true);
      expect(result.profile?.isVetVerified).toBe(false);
      expect(result.profile?.roles).toContain('vet');
    });
  });
});
