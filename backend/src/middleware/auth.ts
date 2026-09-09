import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';

export interface AuthRequest extends Request {
  adminUser?: { id: string; email: string; name: string };
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token de autenticação não fornecido' });
    return;
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(500).json({ error: 'Configuração de autenticação inválida' });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as { adminId: string };

    const admin = await prisma.adminUser.findUnique({
      where: { id: payload.adminId, isActive: true },
      select: { id: true, email: true, name: true },
    });

    if (!admin) {
      res.status(401).json({ error: 'Usuário não encontrado ou inativo' });
      return;
    }

    req.adminUser = admin;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}
