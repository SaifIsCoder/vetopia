import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabaseAdmin, createUserSupabase } from '../supabase';

const JWT_SECRET = process.env.JWT_SECRET || 'vetopia_pets_club_jwt_secret_dev_2026';

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
  role?: string;
  isVerified?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { message: 'Authentication required. Missing Bearer token.', code: 'UNAUTHENTICATED' },
    });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      error: { message: 'Empty authentication token.', code: 'UNAUTHENTICATED' },
    });
  }

  try {
    // 1. Try Supabase Auth token verification first
    const client = createUserSupabase(token);
    const { data: userData, error: userError } = await client.auth.getUser(token);

    if (!userError && userData?.user) {
      const user = userData.user;
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role, is_verified')
        .eq('id', user.id)
        .maybeSingle();

      const userRole = profile?.role || 'owner';
      req.user = {
        id: user.id,
        email: user.email || '',
        roles: [userRole],
        role: userRole,
        isVerified: profile?.is_verified ?? false,
      };
      return next();
    }

    // 2. Fallback to local JWT verification (for tests or dev tokens)
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded && decoded.id) {
        req.user = {
          id: decoded.id,
          email: decoded.email || '',
          roles: decoded.roles || [decoded.role || 'owner'],
          role: decoded.role || (decoded.roles && decoded.roles[0]) || 'owner',
          isVerified: decoded.isVerified ?? false,
        };
        return next();
      }
    } catch {
      // Ignored fallback
    }

    return res.status(401).json({
      success: false,
      error: { message: userError?.message || 'Invalid or expired session token.', code: 'INVALID_TOKEN' },
    });
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      error: { message: err?.message || 'Invalid authentication token.', code: 'INVALID_TOKEN' },
    });
  }
}

export async function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      try {
        const client = createUserSupabase(token);
        const { data: userData } = await client.auth.getUser(token);
        if (userData?.user) {
          const user = userData.user;
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role, is_verified')
            .eq('id', user.id)
            .maybeSingle();

          const userRole = profile?.role || 'owner';
          req.user = {
            id: user.id,
            email: user.email || '',
            roles: [userRole],
            role: userRole,
            isVerified: profile?.is_verified ?? false,
          };
          return next();
        }
      } catch {
        // Ignored
      }

      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (decoded && decoded.id) {
          req.user = {
            id: decoded.id,
            email: decoded.email || '',
            roles: decoded.roles || [decoded.role || 'owner'],
            role: decoded.role || (decoded.roles && decoded.roles[0]) || 'owner',
            isVerified: decoded.isVerified ?? false,
          };
        }
      } catch {
        // Ignored
      }
    }
  }
  return next();
}
