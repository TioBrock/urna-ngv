import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { auditService } from '../services/auditService';
import { AppError } from '../middleware/errorHandler';

export const positionsRouter = Router();

// GET /api/positions — cargos base (para selects no admin)
positionsRouter.get('/', requireAuth, async (_req, res: Response): Promise<void> => {
  const positions = await prisma.position.findMany({ orderBy: { name: 'asc' } });
  res.json(positions);
});

const basePositionSchema = z.object({
  name: z.string().min(1, 'Nome do cargo é obrigatório'),
  description: z.string().optional().nullable(),
  scope: z.enum(['NACIONAL', 'ESTADUAL', 'MUNICIPAL']).default('ESTADUAL'),
  defaultDigitCount: z.number().int().min(1).max(6).default(2),
  defaultSlots: z.number().int().min(1).max(10).default(1),
  isNational: z.boolean().optional(),
});

// POST /api/positions — cadastrar novo cargo base
positionsRouter.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const result = basePositionSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.errors[0].message });
    return;
  }

  const isNational = result.data.scope === 'NACIONAL' || (result.data.isNational ?? false);

  const existing = await prisma.position.findUnique({ where: { name: result.data.name } });
  if (existing) {
    res.status(400).json({ error: 'Já existe um cargo com este nome' });
    return;
  }

  const position = await prisma.position.create({
    data: {
      name: result.data.name,
      description: result.data.description,
      scope: result.data.scope,
      defaultDigitCount: result.data.defaultDigitCount,
      defaultSlots: result.data.defaultSlots,
      isNational,
    },
  });

  await auditService.log({
    eventType: 'POSITION_CREATED',
    description: `Cargo base "${position.name}" criado`,
    adminUserId: req.adminUser!.id,
    metadata: { positionId: position.id, scope: position.scope },
  });

  res.status(201).json(position);
});

// PUT /api/positions/base/:id — atualizar cargo base
positionsRouter.put('/base/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const result = basePositionSchema.partial().safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.errors[0].message });
    return;
  }

  const existing = await prisma.position.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: 'Cargo base não encontrado' });
    return;
  }

  let isNational = result.data.isNational;
  if (result.data.scope) {
    isNational = result.data.scope === 'NACIONAL';
  }

  const updated = await prisma.position.update({
    where: { id: req.params.id },
    data: {
      ...result.data,
      ...(isNational !== undefined ? { isNational } : {}),
    },
  });

  await auditService.log({
    eventType: 'POSITION_UPDATED',
    description: `Cargo base "${updated.name}" atualizado`,
    adminUserId: req.adminUser!.id,
    metadata: { positionId: updated.id },
  });

  res.json(updated);
});

// DELETE /api/positions/base/:id — remover cargo base
positionsRouter.delete('/base/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const existing = await prisma.position.findUnique({
    where: { id: req.params.id },
    include: {
      _count: { select: { electionPositions: true, candidates: true } },
    },
  });

  if (!existing) {
    res.status(404).json({ error: 'Cargo base não encontrado' });
    return;
  }

  if (existing._count.electionPositions > 0 || existing._count.candidates > 0) {
    throw new AppError('Não é possível excluir um cargo base associado a eleições ou candidatos', 409);
  }

  await prisma.position.delete({ where: { id: req.params.id } });

  await auditService.log({
    eventType: 'POSITION_DELETED',
    description: `Cargo base "${existing.name}" removido`,
    adminUserId: req.adminUser!.id,
  });

  res.json({ message: 'Cargo base removido com sucesso' });
});

// GET /api/positions/election/:electionId — cargos de uma eleição
positionsRouter.get('/election/:electionId', requireAuth, async (req, res: Response): Promise<void> => {
  const positions = await prisma.electionPosition.findMany({
    where: { electionId: req.params.electionId },
    orderBy: { order: 'asc' },
    include: {
      position: true,
      _count: { select: { votes: true } },
    },
  });
  res.json(positions);
});

const createPositionSchema = z.object({
  positionId: z.string().uuid(),
  order: z.number().int().min(1),
  slots: z.number().int().min(1).max(10),
  digitCount: z.number().int().min(1).max(6),
  isNational: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

// POST /api/positions/election/:electionId
positionsRouter.post('/election/:electionId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const result = createPositionSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.errors[0].message });
    return;
  }

  const election = await prisma.election.findUnique({ where: { id: req.params.electionId } });
  if (!election) {
    res.status(404).json({ error: 'Eleição não encontrada' });
    return;
  }
  if (election.status === 'OPEN' || election.status === 'CLOSED') {
    throw new AppError('Não é possível alterar cargos de uma eleição aberta ou encerrada', 409);
  }

  const position = await prisma.electionPosition.create({
    data: { electionId: req.params.electionId, ...result.data },
    include: { position: true },
  });

  await auditService.log({
    eventType: 'POSITION_CREATED',
    description: `Cargo "${position.position.name}" adicionado à eleição`,
    electionId: req.params.electionId,
    adminUserId: req.adminUser!.id,
    metadata: { positionId: position.id, order: position.order, slots: position.slots },
  });

  res.status(201).json(position);
});

// PUT /api/positions/:id
positionsRouter.put('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const result = createPositionSchema.partial().safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.errors[0].message });
    return;
  }

  const existing = await prisma.electionPosition.findUnique({
    where: { id: req.params.id },
    include: { election: true, position: true },
  });
  if (!existing) {
    res.status(404).json({ error: 'Cargo não encontrado' });
    return;
  }
  if (existing.election.status === 'OPEN' || existing.election.status === 'CLOSED') {
    throw new AppError('Não é possível alterar cargos de uma eleição aberta ou encerrada', 409);
  }

  const updated = await prisma.electionPosition.update({
    where: { id: req.params.id },
    data: result.data,
    include: { position: true },
  });

  await auditService.log({
    eventType: 'POSITION_UPDATED',
    description: `Cargo "${updated.position.name}" atualizado`,
    electionId: existing.electionId,
    adminUserId: req.adminUser!.id,
  });

  res.json(updated);
});

// PUT /api/positions/election/:electionId/reorder — reordenar todos
const reorderSchema = z.object({
  positions: z.array(z.object({ id: z.string().uuid(), order: z.number().int().min(1) })),
});

positionsRouter.put('/election/:electionId/reorder', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const result = reorderSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.errors[0].message });
    return;
  }

  await prisma.$transaction(
    result.data.positions.map((p) =>
      prisma.electionPosition.update({ where: { id: p.id }, data: { order: p.order } })
    )
  );

  res.json({ message: 'Ordem atualizada com sucesso' });
});

// DELETE /api/positions/:id
positionsRouter.delete('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const existing = await prisma.electionPosition.findUnique({
    where: { id: req.params.id },
    include: { election: true, position: true },
  });
  if (!existing) {
    res.status(404).json({ error: 'Cargo não encontrado' });
    return;
  }
  if (existing.election.status === 'OPEN' || existing.election.status === 'CLOSED') {
    throw new AppError('Não é possível remover cargos de uma eleição aberta ou encerrada', 409);
  }

  await prisma.electionPosition.delete({ where: { id: req.params.id } });

  await auditService.log({
    eventType: 'POSITION_DELETED',
    description: `Cargo "${existing.position.name}" removido da eleição`,
    electionId: existing.electionId,
    adminUserId: req.adminUser!.id,
  });

  res.json({ message: 'Cargo removido com sucesso' });
});
