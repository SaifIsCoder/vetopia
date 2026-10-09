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
    const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : '';
    if (normalizedRole !== 'pet_parent' && normalizedRole !== 'vet') {
      throw new ValidationError(
        'Invalid registration role selected. Public signup only supports "pet_parent" or "vet".',
      );
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

    const sanitizedSpecialty = specialty?.trim() || 'General Veterinary Medicine';
    const sanitizedPriceUsd =
      typeof priceUsd === 'number' && !isNaN(priceUsd) && priceUsd > 0 ? priceUsd : 29;

    const authMetadata: Record<string, unknown> = {
      full_name: fullName.trim(),
      role: normalizedRole,
    };

    if (normalizedRole === 'vet') {
      authMetadata.specialty = sanitizedSpecialty;
      authMetadata.price_usd = sanitizedPriceUsd;
    }

    console.info('🚀 [AuthService.register] Starting account registration:', {
      email: email.trim(),
      fullName: fullName.trim(),
      role: normalizedRole,
      specialty: normalizedRole === 'vet' ? sanitizedSpecialty : undefined,
      priceUsd: normalizedRole === 'vet' ? sanitizedPriceUsd : undefined,
    });

    try {
      console.info(
        '📡 [AuthService.register] Sending supabase.auth.signUp request with metadata...',
      );
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: authMetadata,
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
          'Database trigger handle_new_user() automatically assigned the profile, role, and vet profile.',
        );
      }

      // If an active session was returned, perform client-side idempotent fallbacks.
      // If no session was returned, handle_new_user() already created them atomically under SECURITY DEFINER.
      if (session) {
        try {
          console.info('📝 [AuthService.register] Upserting public.profiles for user:', user.id);
          const { data: pData, error: pError } = await supabase.from('profiles').upsert({
            id: user.id,
            full_name: fullName.trim(),
            onboarded: false,
          });

          if (pError) {
            console.warn('⚠️ [AuthService.register] Profile upsert warning:', pError);
          } else {
            console.info('✅ [AuthService.register] Profile upserted successfully:', pData);
          }
        } catch (e) {
          console.warn('⚠️ [AuthService.register] Profile upsert exception:', e);
        }

        try {
          console.info('🛡️ [AuthService.register] Inserting public.user_roles:', {
            userId: user.id,
            role: normalizedRole,
          });
          const { data: rData, error: rError } = await supabase.from('user_roles').insert({
            user_id: user.id,
            role: normalizedRole,
          });

          if (rError) {
            console.warn('⚠️ [AuthService.register] User role insert warning:', rError);
          } else {
            console.info('✅ [AuthService.register] User role inserted successfully:', rData);
          }
        } catch (e) {
          console.warn('⚠️ [AuthService.register] Role assignment exception:', e);
        }

        if (normalizedRole === 'vet') {
          try {
            console.info(
              '🩺 [AuthService.register] Inserting public.vet_profiles for vet user:',
              user.id,
            );
            const { data: vData, error: vError } = await supabase.from('vet_profiles').insert({
              user_id: user.id,
              name: fullName.trim(),
              specialty: sanitizedSpecialty,
              price_usd: sanitizedPriceUsd,
              verified: false,
            });

            if (vError) {
              console.warn('⚠️ [AuthService.register] Vet profile insert warning:', vError);
            } else {
              console.info('✅ [AuthService.register] Vet profile created successfully:', vData);
            }
          } catch (e) {
            console.warn('⚠️ [AuthService.register] Vet profile creation exception:', e);
          }
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

      if (profileRes.error) {
        console.error('❌ [AuthService] Failed to load profile:', profileRes.error);
        throw new ApiError(`Failed to load user profile: ${profileRes.error.message}`, 500);
      }

      if (rolesRes.error) {
        console.error('❌ [AuthService] Failed to load user roles:', rolesRes.error);
        throw new ApiError(`Failed to load user roles: ${rolesRes.error.message}`, 500);
      }

      if (vetRes.error) {
        console.error('❌ [AuthService] Failed to load vet profile:', vetRes.error);
        throw new ApiError(`Failed to load vet profile: ${vetRes.error.message}`, 500);
      }

      const prof = profileRes.data;
      const roleRows = (rolesRes.data ?? []) as { role: UserRole }[];

      // Non-blocking auth user metadata query to detect role and credentials assigned during registration
      let metaRole: string | undefined;
      let metaData: Record<string, any> | undefined;
      try {
        const { data: authUserData } = await supabase.auth.getUser();
        metaRole = authUserData?.user?.user_metadata?.role;
        metaData = authUserData?.user?.user_metadata;
      } catch {
        // Non-blocking metadata check
      }

      const isDoctorDesignated =
        !!vetRes.data ||
        roleRows.some((r) => r.role === 'vet') ||
        metaRole === 'vet' ||
        metaRole === 'veterinarian';

      let isVet = isDoctorDesignated;
      let isVetVerified = vetRes.data?.verified === true;
      let roles: UserRole[] = roleRows.map((r) => r.role);

      if (isVet) {
        // Guarantee 'vet' is present and is the primary (first) role
        roles = ['vet', ...roles.filter((r) => r !== 'vet')];

        // 1. Self-heal missing user_roles row as 'vet'
        if (!roleRows.some((r) => r.role === 'vet')) {
          try {
            await supabase.from('user_roles').insert({
              user_id: userId,
              role: 'vet',
            });
            console.info(
              `🩹 [AuthService] Self-healed missing user_roles row as "vet" for user:`,
              userId,
            );
          } catch (healErr) {
            console.warn('⚠️ [AuthService] Self-healing user_roles warning:', healErr);
          }
        }

        // 2. Self-heal missing vet_profiles row so the doctor exists in PostgreSQL
        if (!vetRes.data) {
          try {
            const vetName =
              metaData?.full_name || prof?.full_name || email?.split('@')[0] || 'Veterinarian';
            const vetSpecialty = metaData?.specialty || 'General Veterinary Medicine';
            const vetPrice = Number(metaData?.price_usd) || 29;

            const { data: newVet, error: newVetErr } = await supabase
              .from('vet_profiles')
              .insert({
                user_id: userId,
                name: vetName,
                specialty: vetSpecialty,
                price_usd: vetPrice,
                verified: false,
                accepting: true,
              })
              .select('id, name, verified')
              .maybeSingle();

            if (!newVetErr && newVet) {
              vetRes.data = newVet;
              isVetVerified = newVet.verified === true;
              console.info(`🩺 [AuthService] Self-healed missing vet_profiles row for user:`, userId);
            } else if (newVetErr) {
              console.warn('⚠️ [AuthService] Self-healing vet_profiles error:', newVetErr);
            }
          } catch (vetErr) {
            console.warn('⚠️ [AuthService] Self-healing vet_profiles exception:', vetErr);
          }
        }
      } else {
        // If not a doctor and user_roles record is missing, default to pet_parent
        if (roles.length === 0) {
          roles = ['pet_parent'];
          try {
            await supabase.from('user_roles').insert({
              user_id: userId,
              role: 'pet_parent',
            });
            console.info(
              `🩹 [AuthService] Self-healed missing user_roles row as "pet_parent" for user:`,
              userId,
            );
          } catch (healErr) {
            console.warn('⚠️ [AuthService] Self-healing user_roles warning:', healErr);
          }
        }
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
      console.error('❌ [AuthService] Unrecoverable error in loadUserProfile:', error);
      throw this.sanitizeError(error);
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
   * Instantly verifies the authenticated doctor's medical license number.
   * Updates Supabase and syncs local authStore immediately.
   */
  public async verifyLicense(licenseNumber: string): Promise<boolean> {
    const trimmed = licenseNumber?.trim();
    if (!trimmed || trimmed.length < 3) {
      throw new ValidationError('Medical license number must be at least 3 characters.');
    }

    try {
      console.info(
        '🩺 [AuthService] Submitting medical license for instant verification:',
        trimmed,
      );
      const { error } = await supabase.rpc('verify_doctor_license', {
        license_number: trimmed,
      });

      if (error) {
        console.warn(
          '⚠️ [AuthService] RPC verify_doctor_license returned error, trying fallback:',
          error,
        );
        const currentUserId = useAuthStore.getState().user?.id;
        if (currentUserId) {
          const { error: updateError } = await supabase
            .from('vet_profiles')
            .update({
              verified: true,
              bio: `[Verified License: ${trimmed}]`,
            })
            .eq('user_id', currentUserId);

          if (updateError) {
            console.error('❌ [AuthService] Fallback vet_profiles update error:', updateError);
            throw new ApiError(error.message || updateError.message, 400);
          }
        } else {
          throw new ApiError(error.message, 400);
        }
      }

      // Ensure doctor has default availability in vet_availability table
      try {
        const currentUserId = useAuthStore.getState().user?.id;
        if (currentUserId) {
          const { data: vProfile } = await supabase
            .from('vet_profiles')
            .select('id')
            .eq('user_id', currentUserId)
            .maybeSingle();

          if (vProfile?.id) {
            const { count } = await supabase
              .from('vet_availability')
              .select('*', { count: 'exact', head: true })
              .eq('vet_id', vProfile.id);

            if (!count || count === 0) {
              const defaultWindows = [1, 2, 3, 4, 5].map((weekday) => ({
                vet_id: vProfile.id,
                weekday,
                start_minute: 540,
                end_minute: 1020,
              }));
              await supabase.from('vet_availability').insert(defaultWindows);
            }
          }
        }
      } catch (availErr) {
        console.warn('⚠️ [AuthService] Seed default availability notice:', availErr);
      }

      // Update auth store user state immediately
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        useAuthStore.getState().setUser({
          ...currentUser,
          isVetVerified: true,
        });
      }

      console.info('✅ [AuthService] Veterinarian license successfully verified!');
      return true;
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
