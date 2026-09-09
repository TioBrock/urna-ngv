import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { requireAuth } from '../middleware/auth';

export const auditRouter = Router();

// GET /api/audit/:electionId — log de auditoria com filtros
auditRouter.get('/:electionId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { eventType, page = '1', limit = '100' } = req.query;
  const pageNum = parseInt(String(page));
  const limitNum = Math.min(parseInt(String(limit)), 500);

  const where = {
    electionId: req.params.electionId,
    ...(eventType ? { eventType: String(eventType) as never } : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        eventType: true,
        description: true,
        ip: true,
        metadata: true,
        createdAt: true,
        adminUser: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ logs, pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) } });
});

// GET /api/audit/global — log global (todos os eventos, admin)
auditRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { page = '1', limit = '100' } = req.query;
  const pageNum = parseInt(String(page));
  const limitNum = Math.min(parseInt(String(limit)), 500);

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      select: {
        id: true,
        eventType: true,
        description: true,
        ip: true,
        metadata: true,
        createdAt: true,
        election: { select: { name: true } },
        adminUser: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.auditLog.count(),
  ]);

  res.json({ logs, pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) } });
});
