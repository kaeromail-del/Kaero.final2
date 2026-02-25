import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AppError } from '../../application/auth.service';

export interface AuthRequest extends Request {
  userId?: string;
  userPhone?: string;
  /** Convenience alias — same data as userId/userPhone but as an object */
  user?: { id: string; phone: string };
}

export function requireAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('Missing authorization header.', 401));
  }

  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    req.userPhone = payload.phone;
    req.user = { id: payload.sub, phone: payload.phone };
    next();
  } catch (err) {
    next(err);
  }
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next();
  }

  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    req.userPhone = payload.phone;
    req.user = { id: payload.sub, phone: payload.phone };
  } catch {
    // Silently ignore invalid tokens for optional auth
  }
  next();
}
