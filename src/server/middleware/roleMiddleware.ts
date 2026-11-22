import { Request, Response, NextFunction } from 'express';

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Unauthorized. Authentication required.', code: 'UNAUTHENTICATED' },
      });
    }

    const userRoles = req.user.roles || (req.user.role ? [req.user.role] : []);
    const hasRole = allowedRoles.some((role) => userRoles.includes(role));

    if (!hasRole && !userRoles.includes('admin')) {
      return res.status(403).json({
        success: false,
        error: {
          message: `Forbidden. Requires one of: [${allowedRoles.join(', ')}].`,
          code: 'FORBIDDEN',
        },
      });
    }

    return next();
  };
}
