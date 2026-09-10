import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

export class AppError extends Error {
  constructor(public message: string, public statusCode: number = 400) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    return next(err);
  }

  // Erros operacionais conhecidos da aplicação
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Erros do multer (upload de imagens)
  if (err.name === 'MulterError') {
    const multerErr = err as any;
    if (multerErr.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'Arquivo excede o limite máximo permitido (5MB)' });
      return;
    }
    res.status(400).json({ error: `Erro no upload de arquivo: ${err.message}` });
    return;
  }

  // Erros conhecidos do Prisma (banco de dados)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[])?.join(', ') || '';
      if (target.includes('order')) {
        res.status(409).json({ error: 'Já existe um cargo com esta ordem nesta eleição.' });
        return;
      }
      if (target.includes('number')) {
        res.status(409).json({ error: 'Já existe um candidato com este número neste cargo.' });
        return;
      }
      if (target.includes('abbreviation')) {
        res.status(409).json({ error: 'Já existe um estado cadastrado com esta sigla.' });
        return;
      }
      if (target.includes('name')) {
        res.status(409).json({ error: 'Já existe um registro cadastrado com este nome.' });
        return;
      }
      res.status(409).json({ error: 'Registro duplicado: já existe um registro com estes dados.' });
      return;
    }

    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Registro não encontrado no banco de dados.' });
      return;
    }

    if (err.code === 'P2003') {
      res.status(409).json({ error: 'Operação não permitida pois o registro possui dados vinculados.' });
      return;
    }

    if (err.code === 'P2023') {
      res.status(400).json({ error: 'Identificador (ID) inválido.' });
      return;
    }
  }

  console.error('❌ Erro interno do servidor:', err);
  const status = (err as NodeJS.ErrnoException & { statusCode?: number }).statusCode ?? 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' ? 'Erro interno do servidor' : err.message,
  });
}

