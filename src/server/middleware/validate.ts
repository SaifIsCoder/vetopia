import { Request, Response, NextFunction } from 'express';

export function validateRequiredFields(fields: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const missing = fields.filter((f) => req.body[f] === undefined || req.body[f] === null || req.body[f] === '');
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Missing required field(s): ${missing.join(', ')}`,
          code: 'VALIDATION_ERROR',
        },
      });
    }
    return next();
  };
}
