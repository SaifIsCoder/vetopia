import { useAuthStore, UserProfile } from '../../src/store/authStore';

// Mock biometrics module so tests don't depend on native hardware
jest.mock('../../src/lib/auth/biometrics', () => ({
  checkBiometricsAvailability: jest.fn().mockResolvedValue({
    isAvailable: true,
    biometricType: 'Face ID',
    isEnabled: false,
  }),
  setBiometricsPreference: jest.fn().mockResolvedValue(undefined),
  getBiometricsPreference: jest.fn().mockResolvedValue(false),
}));

describe('AuthStore (Zustand)', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
  });

  test('Initializes with null session (unauthenticated state)', async () => {
    await useAuthStore.getState().initialize(null, null);

    const state = useAuthStore.getState();
    expect(state.isInitialized).toBe(true);
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.biometricAvailable).toBe(true);
    expect(state.biometricType).toBe('Face ID');
  });

  test('Initializes with active session and user profile', async () => {
    const mockSession = {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      user: { id: 'u1', email: 'test@vetopia.com' },
    } as any;

    const mockProfile: UserProfile = {
      id: 'u1',
      email: 'test@vetopia.com',
      fullName: 'Sarah Jenkins',
      roles: ['pet_parent'],
      onboarded: true,
      isVet: false,
    };

    await useAuthStore.getState().initialize(mockSession, mockProfile);

    const state = useAuthStore.getState();
    expect(state.isInitialized).toBe(true);
    expect(state.isAuthenticated).toBe(true);
    expect(state.role).toBe('pet_parent');
    expect(state.onboardingCompleted).toBe(true);
    expect(state.accessToken).toBe('mock-access-token');
  });

  test('Correctly identifies veterinarian role as primary role', async () => {
    const mockSession = {
      access_token: 'vet-access-token',
      refresh_token: 'vet-refresh-token',
      user: { id: 'v1', email: 'doctor@vetopia.com' },
    } as any;

    const mockProfile: UserProfile = {
      id: 'v1',
      email: 'doctor@vetopia.com',
      fullName: 'Dr. Sarah Mitchell',
      roles: ['pet_parent', 'vet'],
      onboarded: true,
      isVet: true,
    };

    await useAuthStore.getState().initialize(mockSession, mockProfile);

    const state = useAuthStore.getState();
    expect(state.role).toBe('vet');
    expect(state.roles).toContain('vet');
  });

  test('clearSession resets auth state cleanly', () => {
    const mockProfile: UserProfile = {
      id: 'u1',
      email: 'test@vetopia.com',
      fullName: 'Test User',
      roles: ['pet_parent'],
      onboarded: false,
      isVet: false,
    };

    useAuthStore.getState().setUser(mockProfile);
    expect(useAuthStore.getState().user).not.toBeNull();

    useAuthStore.getState().clearSession();
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  test('setOnboardingCompleted updates profile and onboardingCompleted flag', () => {
    const mockProfile: UserProfile = {
      id: 'u1',
      email: 'test@vetopia.com',
      fullName: 'Test User',
      roles: ['pet_parent'],
      onboarded: false,
      isVet: false,
    };

    useAuthStore.getState().setUser(mockProfile);
    expect(useAuthStore.getState().onboardingCompleted).toBe(false);

    useAuthStore.getState().setOnboardingCompleted(true);
    expect(useAuthStore.getState().onboardingCompleted).toBe(true);
    expect(useAuthStore.getState().user?.onboarded).toBe(true);
  });

  test('setBiometricsEnabled updates biometric state', async () => {
    await useAuthStore.getState().setBiometricsEnabled(true);
    expect(useAuthStore.getState().biometricsEnabled).toBe(true);

    await useAuthStore.getState().setBiometricsEnabled(false);
    expect(useAuthStore.getState().biometricsEnabled).toBe(false);
  });
});
