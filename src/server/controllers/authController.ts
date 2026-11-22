import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../supabase';

const JWT_SECRET = process.env.JWT_SECRET || 'vetopia_pets_club_jwt_secret_dev_2026';

export async function register(req: Request, res: Response) {
  try {
    const { email, password, fullName, role, phone, country } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({
        success: false,
        error: { message: 'Email, password, and full name are required.', code: 'VALIDATION_ERROR' },
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanName = fullName.trim();
    const assignedRole = ['owner', 'vet', 'seller', 'admin'].includes(role) ? role : 'owner';
    const isVerified = assignedRole !== 'vet' && assignedRole !== 'seller';

    // 1. Create Supabase Auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: cleanName, role: assignedRole },
    });

    if (authError || !authData.user) {
      if (authError?.message?.includes('already been registered') || authError?.message?.includes('already exists')) {
        return res.status(409).json({
          success: false,
          error: { message: 'An account with this email already exists.', code: 'USER_EXISTS' },
        });
      }
      return res.status(400).json({
        success: false,
        error: { message: authError?.message || 'Failed to create auth user.', code: 'AUTH_ERROR' },
      });
    }

    const userId = authData.user.id;

    // 2. Create profile entry in public.profiles
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      full_name: cleanName,
      role: assignedRole,
      is_verified: isVerified,
      phone: phone || '',
      country: country || 'US',
      preferred_language: 'English',
    });

    if (profileError) {
      console.warn('[authController] Profile creation notice:', profileError.message);
    }

    // 3. Generate token
    const token = jwt.sign(
      { id: userId, email: cleanEmail, roles: [assignedRole], role: assignedRole },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: userId,
          email: cleanEmail,
          fullName: cleanName,
          roles: [assignedRole],
          isVetVerified: assignedRole === 'vet' ? isVerified : true,
          isSellerVerified: assignedRole === 'seller' ? isVerified : true,
        },
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to register user.', code: 'SERVER_ERROR' },
    });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { message: 'Email and password are required.', code: 'VALIDATION_ERROR' },
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // 1. Authenticate with Supabase Auth
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (signInError || !signInData.user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' },
      });
    }

    const user = signInData.user;

    // 2. Load Profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, is_verified, avatar_url, country')
      .eq('id', user.id)
      .maybeSingle();

    const role = profile?.role || 'owner';
    const isVerified = profile?.is_verified ?? false;
    const token = signInData.session?.access_token || jwt.sign(
      { id: user.id, email: user.email, roles: [role], role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: profile?.full_name || user.user_metadata?.full_name || 'Pet Parent',
          roles: [role],
          isVetVerified: role === 'vet' ? isVerified : true,
          isSellerVerified: role === 'seller' ? isVerified : true,
          avatarUrl: profile?.avatar_url || null,
        },
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Login failed.', code: 'SERVER_ERROR' },
    });
  }
}

export async function getMe(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Not authenticated.', code: 'UNAUTHENTICATED' },
      });
    }

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .maybeSingle();

    if (error || !profile) {
      return res.status(404).json({
        success: false,
        error: { message: 'User profile not found.', code: 'NOT_FOUND' },
      });
    }

    return res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { message: err?.message || 'Failed to fetch user.', code: 'SERVER_ERROR' },
    });
  }
}
