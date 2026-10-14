import { Router, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
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
  defaultSlots: z.number().int().min(1).max(100).default(1),
  defaultChoicesPerVoter: z.number().int().min(1).max(20).default(1),
  defaultVotingSystem: z.enum(['MAJORITARIO', 'PROPORCIONAL']).default('MAJORITARIO'),
  defaultHasSecondRound: z.boolean().default(false),
  defaultDistribution: z.enum(['NACIONAL', 'ESTADUAL', 'TOTAL_DISTRIBUIDO']).default('ESTADUAL'),
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

  if (result.data.defaultHasSecondRound) {
    if (result.data.defaultVotingSystem !== 'MAJORITARIO' || result.data.defaultSlots !== 1) {
      throw new AppError('O segundo turno só pode ser habilitado em cargos com sistema Majoritário e 1 vaga.', 400);
    }
  }

  const position = await prisma.position.create({
    data: {
      name: result.data.name,
      description: result.data.description,
      scope: result.data.scope,
      defaultDigitCount: result.data.defaultDigitCount,
      defaultSlots: result.data.defaultSlots,
      defaultChoicesPerVoter: result.data.defaultChoicesPerVoter,
      defaultVotingSystem: result.data.defaultVotingSystem,
      defaultHasSecondRound: result.data.defaultHasSecondRound,
      defaultDistribution: result.data.defaultDistribution,
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

  const votingSys = result.data.defaultVotingSystem ?? existing.defaultVotingSystem;
  const slots = result.data.defaultSlots ?? existing.defaultSlots;
  const hasSecondRound = result.data.defaultHasSecondRound ?? existing.defaultHasSecondRound;

  if (hasSecondRound && (votingSys !== 'MAJORITARIO' || slots !== 1)) {
    throw new AppError('O segundo turno só pode ser habilitado em cargos com sistema Majoritário e 1 vaga.', 400);
  }

  const updated = await prisma.position.update({
    where: { id: req.params.id },
    data: {
      ...result.data,
      ...(isNational !== undefined ? { isNational } : {}),
    },
  });

  // Se alterou defaultSlots, sincroniza com election_positions de eleições em DRAFT
  if (result.data.defaultSlots !== undefined) {
    await prisma.electionPosition.updateMany({
      where: {
        positionId: req.params.id,
        election: { status: 'DRAFT' },
      },
      data: {
        slots: result.data.defaultSlots,
      },
    });
  }

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
      positionStates: {
        include: { state: { select: { id: true, name: true, abbreviation: true } } },
      },
      _count: { select: { votes: true } },
    },
  });
  res.json(positions);
});

const stateConfigSchema = z.object({
  stateId: z.string().uuid(),
  slots: z.number().int().min(1).max(100),
  hasSecondRound: z.boolean().default(false),
});

const createPositionSchema = z.object({
  positionId: z.string().uuid(),
  order: z.number().int().min(1),
  slots: z.number().int().min(1).max(100),
  choicesPerVoter: z.number().int().min(1).max(20).default(1),
  digitCount: z.number().int().min(1).max(6),
  votingSystem: z.enum(['MAJORITARIO', 'PROPORCIONAL']).default('MAJORITARIO'),
  hasSecondRound: z.boolean().default(false),
  distributionType: z.enum(['NACIONAL', 'ESTADUAL', 'TOTAL_DISTRIBUIDO']).default('ESTADUAL'),
  isNational: z.boolean().default(true),
  isActive: z.boolean().default(true),
  stateConfigurations: z.array(stateConfigSchema).optional(),
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

  const { stateConfigurations, ...positionData } = result.data;

  // Validação de segundo turno: somente permitido para sistema Majoritário com 1 vaga
  if (positionData.hasSecondRound && (positionData.votingSystem !== 'MAJORITARIO' || positionData.slots !== 1)) {
    throw new AppError('O segundo turno só pode ser configurado em disputas majoritárias de vaga única (1 vaga).', 400);
  }

  // Validação de distribuição territorial: se TOTAL_DISTRIBUIDO, a soma das vagas estaduais deve bater com o total
  if (positionData.distributionType === 'TOTAL_DISTRIBUIDO') {
    if (!stateConfigurations || stateConfigurations.length === 0) {
      throw new AppError('Para o modelo "Total nacional distribuído por estado", informe a distribuição de vagas para os estados participantes.', 400);
    }
    const sumStateSlots = stateConfigurations.reduce((acc, cur) => acc + cur.slots, 0);
    if (sumStateSlots !== positionData.slots) {
      throw new AppError(`A soma das vagas distribuídas entre os estados (${sumStateSlots}) deve ser exatamente igual ao total de vagas do cargo (${positionData.slots}).`, 400);
    }
  }

  const position = await prisma.electionPosition.create({
    data: {
      electionId: req.params.electionId,
      ...positionData,
      positionStates: stateConfigurations?.length
        ? {
            create: stateConfigurations.map((sc) => ({
              stateId: sc.stateId,
              slots: sc.slots,
              hasSecondRound: sc.hasSecondRound && positionData.votingSystem === 'MAJORITARIO' && sc.slots === 1,
            })),
          }
        : undefined,
    },
    include: {
      position: true,
      positionStates: { include: { state: true } },
    },
  });

  await auditService.log({
    eventType: 'POSITION_CREATED',
    description: `Cargo "${position.position.name}" adicionado à eleição (${position.votingSystem}) — ${position.slots} vaga(s), ${position.choicesPerVoter} escolha(s)/eleitor`,
    electionId: req.params.electionId,
    adminUserId: req.adminUser!.id,
    metadata: {
      positionId: position.id,
      order: position.order,
      slots: position.slots,
      choicesPerVoter: position.choicesPerVoter,
      votingSystem: position.votingSystem,
      hasSecondRound: position.hasSecondRound,
      distributionType: position.distributionType,
    },
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
    include: { election: true, position: true, positionStates: true },
  });
  if (!existing) {
    res.status(404).json({ error: 'Cargo não encontrado' });
    return;
  }
  const { stateConfigurations, ...positionData } = result.data;

  if (existing.election.status === 'OPEN' || existing.election.status === 'CLOSED') {
    // Permite alterar parâmetros de apuração e vagas (slots, hasSecondRound, choicesPerVoter, votingSystem).
    // Bloqueia alterar apenas quantidade de dígitos se já houver votos registrados.
    const voteCount = await prisma.vote.count({ where: { electionPositionId: req.params.id } });
    if (voteCount > 0 && positionData.digitCount !== undefined && positionData.digitCount !== existing.digitCount) {
      throw new AppError('Não é possível alterar a quantidade de dígitos de um cargo com votos já registrados.', 409);
    }
  }

  const targetSlots = positionData.slots ?? existing.slots;
  const targetVotingSystem = positionData.votingSystem ?? existing.votingSystem;
  const targetHasSecondRound = positionData.hasSecondRound ?? existing.hasSecondRound;
  const targetDistType = positionData.distributionType ?? existing.distributionType;

  if (targetHasSecondRound && (targetVotingSystem !== 'MAJORITARIO' || targetSlots !== 1)) {
    throw new AppError('O segundo turno só pode ser configurado em disputas majoritárias de vaga única (1 vaga).', 400);
  }

  if (targetDistType === 'TOTAL_DISTRIBUIDO' && stateConfigurations !== undefined) {
    const sumStateSlots = stateConfigurations.reduce((acc, cur) => acc + cur.slots, 0);
    if (sumStateSlots !== targetSlots) {
      throw new AppError(`A soma das vagas distribuídas entre os estados (${sumStateSlots}) deve ser exatamente igual ao total de vagas do cargo (${targetSlots}).`, 400);
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (stateConfigurations !== undefined) {
      await tx.electionPositionState.deleteMany({ where: { electionPositionId: req.params.id } });
      if (stateConfigurations.length > 0) {
        await tx.electionPositionState.createMany({
          data: stateConfigurations.map((sc) => ({
            electionPositionId: req.params.id,
            stateId: sc.stateId,
            slots: sc.slots,
            hasSecondRound: sc.hasSecondRound && targetVotingSystem === 'MAJORITARIO' && sc.slots === 1,
          })),
        });
      }
    } else if (positionData.slots !== undefined && targetDistType !== 'TOTAL_DISTRIBUIDO') {
      // Se não enviou stateConfigurations específicas e o total de vagas mudou, mantém slots dos estados alinhados
      await tx.electionPositionState.updateMany({
        where: { electionPositionId: req.params.id },
        data: { slots: positionData.slots },
      });
    }

    return tx.electionPosition.update({
      where: { id: req.params.id },
      data: positionData,
      include: {
        position: true,
        positionStates: { include: { state: true } },
      },
    });
  });

  // Se a eleição estava encerrada, limpa snapshot para garantir recálculo imediato com as novas vagas
  if (existing.election.status === 'CLOSED') {
    await prisma.election.update({
      where: { id: existing.electionId },
      data: { finalResults: Prisma.DbNull },
    });
  }

  await auditService.log({
    eventType: 'POSITION_UPDATED',
    description: `Cargo "${updated.position.name}" atualizado — ${updated.slots} vaga(s), ${updated.choicesPerVoter} escolha(s)/eleitor`,
    electionId: existing.electionId,
    adminUserId: req.adminUser!.id,
    metadata: {
      slots: updated.slots,
      choicesPerVoter: updated.choicesPerVoter,
      hasSecondRound: updated.hasSecondRound,
      distributionType: updated.distributionType,
    },
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

  await prisma.$transaction(async (tx) => {
    // Fase 1: ordens temporárias negativas para não colidir na restrição única @@unique([electionId, order])
    for (let i = 0; i < result.data.positions.length; i++) {
      const p = result.data.positions[i];
      await tx.electionPosition.update({
        where: { id: p.id },
        data: { order: -(i + 1) },
      });
    }
    // Fase 2: aplicar as ordens definitivas desejadas
    for (const p of result.data.positions) {
      await tx.electionPosition.update({
        where: { id: p.id },
        data: { order: p.order },
      });
    }
  });

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
