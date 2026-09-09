import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { requireAuth } from '../middleware/auth';

export const votersRouter = Router();

// GET /api/voters/:electionId — lista de votantes (admin)
votersRouter.get('/:electionId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { status, stateId, search, page = '1', limit = '50' } = req.query;
  const pageNum = parseInt(String(page));
  const limitNum = Math.min(parseInt(String(limit)), 200);
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
