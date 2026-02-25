import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../application/auth.service';
import { config } from '../../config';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
    });
    return;
  }

  console.error('[ERROR]', err);

  res.status(500).json({
    error: config.isDev ? err.message : 'Internal server error.',
  });
}
