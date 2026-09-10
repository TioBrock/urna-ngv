import { Router, Response } from 'express';
import { z } from 'zod';
import { ElectionStatus } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { auditService } from '../services/auditService';
import { AppError } from '../middleware/errorHandler';

export const electionsRouter = Router();

// GET /api/elections — lista todas (admin)
electionsRouter.get('/', requireAuth, async (_req, res: Response): Promise<void> => {
  const elections = await prisma.election.findMany({
    orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
    include: {
      _count: { select: { voterSessions: true, candidates: true, electionPositions: true, electionStates: true } },
    },
  });
  res.json(elections);
});

// GET /api/elections/active — eleição aberta (público)
electionsRouter.get('/active', async (_req, res: Response): Promise<void> => {
  const election = await prisma.election.findFirst({
    where: { status: ElectionStatus.OPEN },
    include: {
      electionPositions: {
        where: { isActive: true },
        orderBy: { order: 'asc' },
        include: { position: true },
      },
      electionStates: {
        include: { state: { select: { id: true, name: true, abbreviation: true } } },
      },
    },
  });

  if (!election) {
    res.status(404).json({ error: 'Nenhuma eleição aberta no momento' });
    return;
  }

  res.json(election);
});

// GET /api/elections/:id — detalhe (admin)
electionsRouter.get('/:id', requireAuth, async (req, res: Response): Promise<void> => {
  const election = await prisma.election.findUnique({
    where: { id: req.params.id },
    include: {
      electionPositions: {
        orderBy: { order: 'asc' },
        include: { position: true },
      },
      electionStates: {
        include: { state: true },
      },
      _count: { select: { voterSessions: true, candidates: true } },
    },
  });

  if (!election) {
    res.status(404).json({ error: 'Eleição não encontrada' });
    return;
  }

  res.json(election);
});

const createElectionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  year: z.number().int().min(1900).max(2100),
  startDate: z.string().optional().nullable().or(z.literal('')),
  endDate: z.string().optional().nullable().or(z.literal('')),
  showResultsDuringVoting: z.boolean().default(false),
  sessionTimeoutHours: z.number().int().min(1).max(72).default(2),
  validateIp: z.boolean().default(true).optional(),
  stateIds: z.array(z.string()).optional(),
});

// POST /api/elections
electionsRouter.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const result = createElectionSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.errors[0].message });
    return;
  }

  const { stateIds, ...data } = result.data;

  const election = await prisma.election.create({
    data: {
      ...data,
      startDate: data.startDate && data.startDate.trim() !== '' ? new Date(data.startDate) : undefined,
      endDate: data.endDate && data.endDate.trim() !== '' ? new Date(data.endDate) : undefined,
      electionStates: stateIds?.length
        ? { create: stateIds.map((stateId) => ({ stateId })) }
        : undefined,
    },
    include: { electionStates: { include: { state: true } } },
  });

  await auditService.log({
    eventType: 'ELECTION_CREATED',
    description: `Eleição "${election.name}" criada`,
    electionId: election.id,
    adminUserId: req.adminUser!.id,
  });

  res.status(201).json(election);
});

// PUT /api/elections/:id
electionsRouter.put('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const result = createElectionSchema.partial().safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.errors[0].message });
    return;
  }

  const existing = await prisma.election.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: 'Eleição não encontrada' });
    return;
  }

  const { stateIds, ...data } = result.data;

  const updated = await prisma.$transaction(async (tx) => {
    if (stateIds !== undefined) {
      await tx.electionState.deleteMany({ where: { electionId: req.params.id } });
      if (stateIds.length > 0) {
        await tx.electionState.createMany({
          data: stateIds.map((stateId) => ({ electionId: req.params.id, stateId })),
        });
      }
    }

    return tx.election.update({
      where: { id: req.params.id },
      data: {
        ...data,
        startDate: data.startDate && data.startDate.trim() !== '' ? new Date(data.startDate) : (data.startDate === '' ? null : undefined),
        endDate: data.endDate && data.endDate.trim() !== '' ? new Date(data.endDate) : (data.endDate === '' ? null : undefined),
      },
      include: { electionStates: { include: { state: true } } },
    });
  });

  await auditService.log({
    eventType: 'ELECTION_UPDATED',
    description: `Eleição "${updated.name}" atualizada`,
    electionId: updated.id,
    adminUserId: req.adminUser!.id,
  });

  res.json(updated);
});

const statusSchema = z.object({
  status: z.enum(['DRAFT', 'SCHEDULED', 'OPEN', 'PAUSED', 'CLOSED']),
});

// PUT /api/elections/:id/status
electionsRouter.put('/:id/status', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const result = statusSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.errors[0].message });
    return;
  }

  const existing = await prisma.election.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: 'Eleição não encontrada' });
    return;
  }

  // Só pode haver uma eleição OPEN por vez, e deve ter cargos e estados configurados
  if (result.data.status === 'OPEN') {
    const electionToCheck = await prisma.election.findUnique({
      where: { id: req.params.id },
      include: {
        electionPositions: { where: { isActive: true } },
        electionStates: true,
      },
    });

    if (!electionToCheck) {
      res.status(404).json({ error: 'Eleição não encontrada' });
      return;
    }

    if (electionToCheck.electionPositions.length === 0) {
      throw new AppError('Não é possível abrir uma eleição sem cargos ativos configurados.', 400);
    }

    if (electionToCheck.electionStates.length === 0) {
      throw new AppError('Não é possível abrir uma eleição sem estados participantes selecionados.', 400);
    }

    const openElection = await prisma.election.findFirst({
      where: { status: 'OPEN', NOT: { id: req.params.id } },
    });
    if (openElection) {
      throw new AppError(`Já existe uma eleição aberta: "${openElection.name}". Encerre-a antes de abrir outra.`, 409);
    }
  }

  const updated = await prisma.election.update({
    where: { id: req.params.id },
    data: {
      status: result.data.status,
      startDate: result.data.status === 'OPEN' && !existing.startDate ? new Date() : undefined,
      endDate: result.data.status === 'CLOSED' ? new Date() : undefined,
    },
  });

  const eventMap: Record<string, 'ELECTION_STATUS_CHANGED' | 'ELECTION_OPENED' | 'ELECTION_PAUSED' | 'ELECTION_CLOSED'> = {
    OPEN: 'ELECTION_OPENED',
    PAUSED: 'ELECTION_PAUSED',
    CLOSED: 'ELECTION_CLOSED',
    DRAFT: 'ELECTION_STATUS_CHANGED',
    SCHEDULED: 'ELECTION_STATUS_CHANGED',
  };

  await auditService.log({
    eventType: eventMap[result.data.status],
    description: `Status da eleição "${updated.name}" alterado para ${result.data.status}`,
    electionId: updated.id,
    adminUserId: req.adminUser!.id,
  });

  res.json(updated);
});

// PATCH /api/elections/:id/validate-ip — ativar/desativar verificação de IP (modo teste)
electionsRouter.patch('/:id/validate-ip', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const schema = z.object({ validateIp: z.boolean() });
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.errors[0].message });
    return;
  }

  const existing = await prisma.election.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: 'Eleição não encontrada' });
    return;
  }

  const updated = await prisma.election.update({
    where: { id: req.params.id },
    data: { validateIp: result.data.validateIp },
  });

  await auditService.log({
    eventType: 'ELECTION_UPDATED',
    description: `Verificação por IP ${result.data.validateIp ? 'ATIVADA' : 'DESATIVADA'} para "${updated.name}"`,
    electionId: updated.id,
    adminUserId: req.adminUser!.id,
    metadata: { validateIp: result.data.validateIp },
  });

  res.json(updated);
});

// DELETE /api/elections/:id (apenas DRAFT)
electionsRouter.delete('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const existing = await prisma.election.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: 'Eleição não encontrada' });
    return;
  }
  if (existing.status !== 'DRAFT') {
    throw new AppError('Apenas eleições em rascunho podem ser excluídas', 409);
  }

  await prisma.$transaction([
    prisma.auditLog.updateMany({ where: { electionId: req.params.id }, data: { electionId: null } }),
    prisma.election.delete({ where: { id: req.params.id } }),
  ]);
  res.json({ message: 'Eleição excluída com sucesso' });
});
