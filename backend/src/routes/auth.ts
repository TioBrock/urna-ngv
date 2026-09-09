import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { auditService } from '../services/auditService';
import { extractIp } from '../utils/ipExtractor';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.errors[0].message });
    return;
  }

  const { email, password } = result.data;
  const ip = extractIp(req);

  const admin = await prisma.adminUser.findUnique({ where: { email, isActive: true } });

  if (!admin) {
    res.status(401).json({ error: 'Credenciais inválidas' });
    return;
  }

  const isValid = await bcrypt.compare(password, admin.password);
  if (!isValid) {
    res.status(401).json({ error: 'Credenciais inválidas' });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ error: 'Configuração inválida' });
    return;
  }

  const token = jwt.sign(
    { adminId: admin.id },
    secret,
    { expiresIn: (process.env.JWT_EXPIRES_IN ?? '8h') as any }
  );

  await auditService.log({
    eventType: 'ADMIN_LOGIN',
    description: `Admin ${admin.email} realizou login`,
    adminUserId: admin.id,
    ip,
  });

  res.json({
    token,
    user: { id: admin.id, email: admin.email, name: admin.name },
  });
});

// POST /api/auth/logout
authRouter.post('/logout', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  await auditService.log({
    eventType: 'ADMIN_LOGOUT',
    description: `Admin ${req.adminUser!.email} realizou logout`,
    adminUserId: req.adminUser!.id,
    ip: extractIp(req),
  });
  res.json({ message: 'Logout realizado com sucesso' });
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, (req: AuthRequest, res: Response): void => {
  res.json({ user: req.adminUser });
});
