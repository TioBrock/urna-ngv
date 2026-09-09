import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('❌ Erro não tratado:', err);
  const status = (err as NodeJS.ErrnoException & { statusCode?: number }).statusCode ?? 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' ? 'Erro interno do servidor' : err.message,
  });
}

export class AppError extends Error {
  constructor(public message: string, public statusCode: number = 400) {
    super(message);
    this.name = 'AppError';
  }
}
