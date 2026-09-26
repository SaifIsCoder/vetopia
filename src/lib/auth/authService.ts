import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { useAuthStore, UserProfile, UserRole } from '../../store/authStore';
import { queryClient } from '../query/client';
import {
  ApiError,
  AuthError,
  ForbiddenError,
  NetworkError,
  ValidationError,
  normalizeError,
} from '../api/errors';

export interface RegisterParams {
  email: string;
  password: string;
  fullName: string;
  role: 'pet_parent' | 'vet';
  specialty?: string;
  priceUsd?: number;
}

export interface LoginParams {
  email: string;
  password: string;
}

export interface OnboardingParams {
  fullName?: string;
  username?: string;
  location?: string;
  avatarUrl?: string;
  bio?: string;
  firstPet?: {
    name: string;
    species: string;
    breed?: string;
    age?: string;
  };
}

class AuthService {
  /**
   * Register a new user with initial role ('pet_parent' or 'vet').
   * Prevents client-side privilege escalation.
   */
  public async register(params: RegisterParams): Promise<{
    user: User | null;
    session: Session | null;
    profile: UserProfile | null;
  }> {
    const { email, password, fullName, role, specialty, priceUsd } = params;

    // RBAC validation: mobile clients can ONLY register pet_parent or vet
    if (role !== 'pet_parent' && role !== 'vet') {
      throw new ValidationError('Invalid registration role selected.');
    }

    if (!email || !email.includes('@')) {
      throw new ValidationError('Please enter a valid email address.');
    }

    if (!password || password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters long.');
    }

    if (!fullName || fullName.trim().length < 2) {
      throw new ValidationError('Please enter your full name (minimum 2 characters).');
    }

    console.info('🚀 [AuthService.register] Starting account registration:', {
      email: email.trim(),
      fullName: fullName.trim(),
      role,
      specialty: role === 'vet' ? specialty : undefined,
      priceUsd: role === 'vet' ? priceUsd : undefined,
    });

    try {
      console.info('📡 [AuthService.register] Sending supabase.auth.signUp request...');
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      console.info('📥 [AuthService.register] signUp response received:', {
        hasUser: !!data?.user,
        userId: data?.user?.id,
        userEmail: data?.user?.email,
        emailConfirmedAt: data?.user?.email_confirmed_at,
        identitiesCount: data?.user?.identities?.length,
        hasSession: !!data?.session,
        hasError: !!error,
      });

      if (error) {
        console.error('❌ [AuthService.register] signUp returned error:', {
          message: error.message,
          status: error.status,
          name: error.name,
        });
        this.handleAuthError(error);
      }

      const user = data.user;
      const session = data.session;

      if (!user) {
        console.error('❌ [AuthService.register] No user object returned by Supabase');
        throw new ApiError('Failed to create account. Please try again.', 500);
      }

      // Check if user already exists (Supabase returns user with empty identities array when email confirmation is active)
      if (Array.isArray(user.identities) && user.identities.length === 0) {
        console.warn('⚠️ [AuthService.register] User already exists (identities list is empty).');
        throw new ApiError(
          'An account with this email already exists. Please sign in instead.',
          409,
          'DUPLICATE_EMAIL',
        );
      }

      if (!session) {
        console.warn(
          '⚠️ [AuthService.register] User created in auth.users, but NO active session returned.',
          'This means "Confirm email" is ENABLED in your Supabase project settings.',
          'The user must click the confirmation email link before Supabase issues an active session.',
        );
      }

      // Upsert profile record
      try {
        console.info('📝 [AuthService.register] Upserting public.profiles for user:', user.id);
        const { data: pData, error: pError } = await supabase.from('profiles').upsert({
          id: user.id,
          full_name: fullName.trim(),
          onboarded: false,
        });

        if (pError) {
          console.error('❌ [AuthService.register] Profile upsert error:', pError);
        } else {
          console.info('✅ [AuthService.register] Profile upserted successfully:', pData);
        }
      } catch (e) {
        console.error('❌ [AuthService.register] Profile upsert exception:', e);
      }

      // Assign requested role in public.user_roles
      try {
        console.info('🛡️ [AuthService.register] Inserting public.user_roles:', {
          userId: user.id,
          role,
        });
        const { data: rData, error: rError } = await supabase.from('user_roles').insert({
          user_id: user.id,
          role,
        });

        if (rError) {
          console.error('❌ [AuthService.register] User role insert error:', rError);
        } else {
          console.info('✅ [AuthService.register] User role inserted successfully:', rData);
        }
      } catch (e) {
        console.error('❌ [AuthService.register] Role assignment exception:', e);
      }

      // If registered as vet, create vet_profiles record with verified: false
      if (role === 'vet') {
        try {
          console.info(
            '🩺 [AuthService.register] Inserting public.vet_profiles for vet user:',
            user.id,
          );
          const { data: vData, error: vError } = await supabase.from('vet_profiles').insert({
            user_id: user.id,
            name: fullName.trim(),
            specialty: specialty || 'General Veterinary Medicine',
            price_usd: priceUsd || 29,
            verified: false,
          });

          if (vError) {
            console.error('❌ [AuthService.register] Vet profile insert error:', vError);
          } else {
            console.info('✅ [AuthService.register] Vet profile created successfully:', vData);
          }
        } catch (e) {
          console.error('❌ [AuthService.register] Vet profile creation exception:', e);
        }
      }

      let profile: UserProfile | null = null;
      if (session) {
        console.info('🔄 [AuthService.register] Session established. Loading user profile...');
        profile = await this.loadUserProfile(user.id, user.email);
        console.info('✅ [AuthService.register] User profile loaded:', profile);
        useAuthStore.getState().setSession(session, profile);
      } else {
        console.info(
          'ℹ️ [AuthService.register] Session is null (email confirmation required). Skipping auto-login.',
        );
      }

      console.info('🏁 [AuthService.register] Registration completed with return payload:', {
        userId: user.id,
        hasSession: !!session,
        profileFound: !!profile,
      });

      return { user, session, profile };
    } catch (err) {
      console.error('💥 [AuthService.register] Uncaught registration error:', err);
      throw this.sanitizeError(err);
    }
  }

  /**
   * Authenticate user with email and password.
   */
  public async login(params: LoginParams): Promise<{
    user: User;
    session: Session;
    profile: UserProfile;
  }> {
    const { email, password } = params;

    if (!email || !email.trim()) {
      throw new ValidationError('Email is required.');
    }
    if (!password) {
      throw new ValidationError('Password is required.');
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        this.handleAuthError(error);
      }

      if (!data.user || !data.session) {
        throw new AuthError('Login failed. Please verify your credentials.');
      }

      const profile = await this.loadUserProfile(data.user.id, data.user.email);
      useAuthStore.getState().setSession(data.session, profile);

      return {
        user: data.user,
        session: data.session,
        profile,
      };
    } catch (err) {
      throw this.sanitizeError(err);
    }
  }

  /**
   * Authoritatively loads the user profile, roles, and vet status from PostgreSQL.
   */
  public async loadUserProfile(userId: string, email?: string): Promise<UserProfile> {
    try {
      const [profileRes, rolesRes, vetRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId),
        supabase
          .from('vet_profiles')
          .select('id, name, verified')
          .eq('user_id', userId)
          .maybeSingle(),
      ]);

      const prof = profileRes.data;
      const roleRows = (rolesRes.data ?? []) as { role: UserRole }[];
      const isVet = !!vetRes.data || roleRows.some((r) => r.role === 'vet');
      const isVetVerified = vetRes.data?.verified === true;

      let roles: UserRole[] = roleRows.map((r) => r.role);
      if (roles.length === 0) {
        roles = [isVet ? 'vet' : 'pet_parent'];
      }

      return {
        id: userId,
        email: email || '',
        fullName: prof?.full_name || (isVet ? 'Veterinarian' : 'Pet Parent'),
        avatarUrl: prof?.avatar_url || null,
        phone: prof?.phone || null,
        roles,
        onboarded: prof?.onboarded ?? false,
        isVet,
        isVetVerified,
      };
    } catch (error) {
      console.warn('[AuthService] Error loading user profile:', error);
      return {
        id: userId,
        email: email || '',
        fullName: 'Vetopia User',
        roles: ['pet_parent'],
        onboarded: false,
        isVet: false,
        isVetVerified: false,
      };
    }
  }

  /**
   * Approves or rejects a veterinarian profile.
   * Can only be performed by an authorized administrator (enforced server-side via RPC & RLS).
   */
  public async approveVet(vetProfileId: string, approved: boolean = true): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('approve_vet', {
        target_vet_id: vetProfileId,
        approve_status: approved,
      });

      if (error) {
        throw new ForbiddenError(
          error.message || 'Unauthorized: Only administrators can approve veterinarians.',
        );
      }

      return !!data;
    } catch (err) {
      throw this.sanitizeError(err);
    }
  }

  /**
   * Request password reset link for email.
   */
  public async requestPasswordReset(email: string): Promise<void> {
    if (!email || !email.includes('@')) {
      throw new ValidationError('Please enter a valid email address.');
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) {
        this.handleAuthError(error);
      }
    } catch (err) {
      throw this.sanitizeError(err);
    }
  }

  /**
   * Refreshes the active session.
   */
  public async refreshSession(): Promise<Session | null> {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) {
        useAuthStore.getState().clearSession();
        return null;
      }

      const profile = await this.loadUserProfile(data.session.user.id, data.session.user.email);
      useAuthStore.getState().setSession(data.session, profile);
      return data.session;
    } catch (error) {
      console.warn('[AuthService] Token refresh failed:', error);
      useAuthStore.getState().clearSession();
      return null;
    }
  }

  /**
   * Complete user onboarding process.
   */
  public async completeOnboarding(userId: string, params: OnboardingParams): Promise<void> {
    try {
      const profileUpdates: Record<string, unknown> = {
        onboarded: true,
      };
      if (params.fullName) profileUpdates.full_name = params.fullName;
      if (params.username) profileUpdates.username = params.username;
      if (params.location) profileUpdates.location = params.location;
      if (params.avatarUrl) profileUpdates.avatar_url = params.avatarUrl;
      if (params.bio) profileUpdates.bio = params.bio;

      await supabase.from('profiles').update(profileUpdates).eq('id', userId);

      // If a first pet was submitted during onboarding, save it
      if (params.firstPet && params.firstPet.name) {
        try {
          await supabase.from('pets').insert({
            owner_id: userId,
            name: params.firstPet.name,
            species: params.firstPet.species || 'Dog',
            breed: params.firstPet.breed || null,
            age: params.firstPet.age || null,
          });
        } catch (e) {
          console.warn('[AuthService] First pet creation warning:', e);
        }
      }

      useAuthStore.getState().setOnboardingCompleted(true);
    } catch (err) {
      throw this.sanitizeError(err);
    }
  }

  /**
   * Complete sign out: clears session, local secure storage, auth store, and react-query cache.
   */
  public async signOut(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[AuthService] Supabase sign out warning:', e);
    } finally {
      useAuthStore.getState().clearSession();
      queryClient.clear();
    }
  }

  /**
   * Handle Supabase specific errors and map to domain errors.
   */
  private handleAuthError(error: { message?: string; status?: number; code?: string }): never {
    const msg = error.message || 'Authentication error';
    const lower = msg.toLowerCase();

    if (
      lower.includes('user already registered') ||
      lower.includes('already registered') ||
      error.code === 'user_already_exists'
    ) {
      throw new ApiError('An account with this email already exists.', 409, 'DUPLICATE_EMAIL');
    }

    if (
      lower.includes('invalid login credentials') ||
      lower.includes('invalid credentials') ||
      lower.includes('invalid email or password')
    ) {
      throw new AuthError('Invalid email or password. Please check your credentials.');
    }

    if (lower.includes('password should be at least') || lower.includes('weak password')) {
      throw new ValidationError('Password must be at least 6 characters long.');
    }

    const code = (error.code || '').toLowerCase();
    if (
      lower.includes('rate limit') ||
      lower.includes('rate_limit') ||
      code.includes('rate_limit') ||
      code === 'over_email_send_rate_limit' ||
      code === 'over_request_rate_limit' ||
      error.status === 429
    ) {
      throw new ApiError(
        'Too many attempts. Please try again in a few minutes.',
        429,
        'RATE_LIMITED',
      );
    }

    if (lower.includes('network') || lower.includes('failed to fetch')) {
      throw new NetworkError('Network connection unavailable. Please check your connection.');
    }

    throw new ApiError(msg, error.status || 400, error.code || 'AUTH_ERROR');
  }

  private sanitizeError(err: unknown): ApiError {
    if (
      err instanceof ApiError ||
      err instanceof AuthError ||
      err instanceof ValidationError ||
      err instanceof NetworkError
    ) {
      return err;
    }
    return normalizeError(err);
  }
}

export const authService = new AuthService();
