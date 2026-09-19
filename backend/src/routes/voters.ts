import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { auditService } from '../services/auditService';

export const votersRouter = Router();

// GET /api/voters/:electionId — lista de votantes (admin)
votersRouter.get('/:electionId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { status, stateId, search, page = '1', limit = '50' } = req.query;
  const pageNum = Math.max(1, parseInt(String(page)) || 1);
  const limitNum = Math.max(1, Math.min(parseInt(String(limit)) || 50, 200));
  const skip = (pageNum - 1) * limitNum;

  const where = {
    electionId: req.params.electionId,
    ...(status ? { status: String(status) as 'IN_PROGRESS' | 'VOTED' | 'ABANDONED' } : {}),
    ...(stateId ? { stateId: String(stateId) } : {}),
    ...(search
      ? {
          OR: [
            { discordName: { contains: String(search), mode: 'insensitive' as const } },
            { rpgName: { contains: String(search), mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [voters, total] = await Promise.all([
    prisma.voterSession.findMany({
      where,
      select: {
        id: true,
        discordName: true,
        rpgName: true,
        status: true,
        startedAt: true,
        completedAt: true,
        state: { select: { name: true, abbreviation: true } },
        // NÃO expor IP na listagem
      },
      orderBy: { startedAt: 'desc' },
      skip,
      take: limitNum,
    }),
    prisma.voterSession.count({ where }),
  ]);

  res.json({
    voters,
    pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
  });
});

// GET /api/voters/:electionId/by-state — participação por estado
votersRouter.get('/:electionId/by-state', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const groups = await prisma.voterSession.groupBy({
    by: ['stateId', 'status'],
    where: { electionId: req.params.electionId },
    _count: { _all: true },
  });

  // Buscar nomes dos estados
  const stateIds = [...new Set(groups.map((g) => g.stateId))];
  const states = await prisma.state.findMany({
    where: { id: { in: stateIds } },
    select: { id: true, name: true, abbreviation: true },
  });

  const stateMap = new Map(states.map((s) => [s.id, s]));
  const totalVoters = groups.filter((g) => g.status === 'VOTED').reduce((sum, g) => sum + g._count._all, 0);

  const result = stateIds.map((stateId) => {
    const state = stateMap.get(stateId);
    const voted = groups.find((g) => g.stateId === stateId && g.status === 'VOTED')?._count._all ?? 0;
    const inProgress = groups.find((g) => g.stateId === stateId && g.status === 'IN_PROGRESS')?._count._all ?? 0;
    return {
      state,
      voted,
      inProgress,
      total: voted + inProgress,
      percentage: totalVoters > 0 ? ((voted / totalVoters) * 100).toFixed(1) : '0.0',
    };
  });

  result.sort((a, b) => b.voted - a.voted);
  res.json({ byState: result, totalVoters });
});

// GET /api/voters/receipt/:sessionId — comprovante de votação e votos do eleitor
votersRouter.get('/receipt/:sessionId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const session = await prisma.voterSession.findUnique({
    where: { id: req.params.sessionId },
    include: {
      election: { select: { id: true, name: true, year: true } },
      state: { select: { id: true, name: true, abbreviation: true } },
      votes: {
        include: {
          electionPosition: {
            include: { position: { select: { name: true } } },
          },
          candidate: {
            select: { id: true, name: true, electoralName: true, number: true, party: true, photoUrl: true, viceCandidateName: true },
          },
        },
        orderBy: [
          { electionPosition: { order: 'asc' } },
          { slot: 'asc' },
        ],
      },
    },
  });

  if (!session) {
    res.status(404).json({ error: 'Sessão de votação não encontrada' });
    return;
  }

  const protocol = `NGV-${session.id.slice(0, 8).toUpperCase()}-${session.id.slice(-4).toUpperCase()}`;

  res.json({
    session: {
      id: session.id,
      electionName: session.election.name,
      electionYear: session.election.year,
      discordName: session.discordName,
      rpgName: session.rpgName,
      stateName: session.state.name,
      stateAbbreviation: session.state.abbreviation,
      status: session.status,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      protocol,
    },
    votes: session.votes.map((v) => ({
      id: v.id,
      positionName: v.electionPosition.position.name,
      slot: v.slot,
      totalSlots: v.electionPosition.slots,
      type: v.type,
      candidate: v.candidate
        ? {
            id: v.candidate.id,
            name: v.candidate.name,
            electoralName: v.candidate.electoralName,
            number: v.candidate.number,
            party: v.candidate.party,
            photoUrl: v.candidate.photoUrl,
            viceCandidateName: v.candidate.viceCandidateName,
          }
        : null,
      registeredAt: v.registeredAt,
    })),
  });
});

// DELETE /api/voters/:sessionId — Excluir sessão e anular votos de um eleitor específico
votersRouter.delete('/:sessionId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { sessionId } = req.params;

  const session = await prisma.voterSession.findUnique({
    where: { id: sessionId },
    include: {
      election: { select: { id: true, name: true } },
      votes: { select: { id: true } },
    },
  });

  if (!session) {
    res.status(404).json({ error: 'Sessão de eleitor não encontrada' });
    return;
  }

  const votesCount = session.votes.length;

  await prisma.$transaction([
    prisma.vote.deleteMany({ where: { voterSessionId: sessionId } }),
    prisma.voterSession.delete({ where: { id: sessionId } }),
  ]);

  await auditService.log({
    eventType: 'CONFIG_CHANGED',
    description: `Votos do eleitor "${session.discordName}" (${session.rpgName}) foram excluídos da eleição "${session.election.name}" (${votesCount} votos removidos)`,
    electionId: session.electionId,
    adminUserId: req.adminUser!.id,
    metadata: {
      sessionId: session.id,
      discordName: session.discordName,
      rpgName: session.rpgName,
      votesDeleted: votesCount,
    },
  });

  res.json({
    message: `Votos do eleitor "${session.discordName}" foram excluídos com sucesso.`,
    deletedVotesCount: votesCount,
  });
});

