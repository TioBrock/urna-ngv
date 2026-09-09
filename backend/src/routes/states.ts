import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { auditService } from '../services/auditService';

export const statesRouter = Router();

// GET /api/states — lista todos (público — usado no select de identificação)
statesRouter.get('/', async (_req, res: Response): Promise<void> => {
  const states = await prisma.state.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, abbreviation: true },
  });
  res.json(states);
});

// GET /api/states/all — lista todos incluindo inativos (admin)
statesRouter.get('/all', requireAuth, async (_req, res: Response): Promise<void> => {
  const states = await prisma.state.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { voterSessions: true } },
    },
  });
  res.json(states);
});

// GET /api/states/election/:electionId — estados de uma eleição (público, apenas ativos)
statesRouter.get('/election/:electionId', async (req, res: Response): Promise<void> => {
  const states = await prisma.electionState.findMany({
    where: {
      electionId: req.params.electionId,
      state: { isActive: true },
    },
    include: {
      state: { select: { id: true, name: true, abbreviation: true, isActive: true } },
    },
    orderBy: { state: { name: 'asc' } },
  });
  res.json(states.map((es) => es.state));
});

const stateSchema = z.object({
  name: z.string().min(1),
  abbreviation: z.string().length(2).toUpperCase(),
  isActive: z.boolean().default(true),
});

// POST /api/states
statesRouter.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const result = stateSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.errors[0].message });
    return;
  }

  const state = await prisma.state.create({ data: result.data });

  await auditService.log({
    eventType: 'STATE_CREATED',
    description: `Estado "${state.name} (${state.abbreviation})" criado`,
    adminUserId: req.adminUser!.id,
  });

  res.status(201).json(state);
});

// PUT /api/states/:id
statesRouter.put('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const result = stateSchema.partial().safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.errors[0].message });
    return;
  }

  const existing = await prisma.state.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: 'Estado não encontrado' });
    return;
  }

  const updated = await prisma.state.update({ where: { id: req.params.id }, data: result.data });

  await auditService.log({
    eventType: 'STATE_UPDATED',
    description: `Estado "${updated.name}" atualizado`,
    adminUserId: req.adminUser!.id,
  });

  res.json(updated);
});
