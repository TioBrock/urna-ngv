import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { requireAuth } from '../middleware/auth';

export const dashboardRouter = Router();

// GET /api/dashboard — panorama geral
dashboardRouter.get('/', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  // Eleição ativa ou mais recente
  const activeElection = await prisma.election.findFirst({
    where: { status: { in: ['OPEN', 'CLOSED', 'SCHEDULED'] } },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      electionPositions: {
        where: { isActive: true },
        include: { position: { select: { name: true } } },
      },
      electionStates: true,
      _count: { select: { voterSessions: true } },
    },
  });

  if (!activeElection) {
    res.json({ election: null });
    return;
  }

  const [voted, inProgress, totalVotes, recentVoters] = await Promise.all([
    prisma.voterSession.count({ where: { electionId: activeElection.id, status: 'VOTED' } }),
    prisma.voterSession.count({ where: { electionId: activeElection.id, status: 'IN_PROGRESS' } }),
    prisma.vote.count({ where: { electionId: activeElection.id } }),
    prisma.voterSession.findMany({
      where: { electionId: activeElection.id },
      select: {
        discordName: true,
        rpgName: true,
        status: true,
        completedAt: true,
        state: { select: { name: true, abbreviation: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 10,
    }),
  ]);

  res.json({
    election: {
      id: activeElection.id,
      name: activeElection.name,
      status: activeElection.status,
      validateIp: activeElection.validateIp,
      positionsCount: activeElection.electionPositions.length,
      statesCount: activeElection.electionStates.length,
      positions: activeElection.electionPositions.map((ep) => ({
        name: ep.position.name,
        order: ep.order,
        slots: ep.slots,
      })),
    },
    stats: { voted, inProgress, totalVotes, totalSessions: voted + inProgress },
    recentVoters,
  });
});
