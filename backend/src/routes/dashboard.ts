import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { requireAuth } from '../middleware/auth';

export const dashboardRouter = Router();

// GET /api/dashboard — panorama geral
dashboardRouter.get('/', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  // Apenas eleição ABERTA
  const activeElection = await prisma.election.findFirst({
    where: { status: 'OPEN' },
    orderBy: { createdAt: 'desc' },
    include: {
      electionPositions: {
        where: { isActive: true },
        orderBy: { order: 'asc' },
        include: {
          position: { select: { name: true } },
          _count: { select: { votes: true } },
        },
      },
      electionStates: true,
      _count: { select: { voterSessions: true } },
    },
  });

  if (!activeElection) {
    res.json({
      election: null,
      stats: { voted: 0, inProgress: 0, totalVotes: 0, totalSessions: 0 },
    });
    return;
  }

  const [voted, inProgress, totalVotes] = await Promise.all([
    prisma.voterSession.count({ where: { electionId: activeElection.id, status: 'VOTED' } }),
    prisma.voterSession.count({ where: { electionId: activeElection.id, status: 'IN_PROGRESS' } }),
    prisma.vote.count({ where: { electionId: activeElection.id } }),
  ]);

  // Progresso de votos por cargo
  const positionProgress = activeElection.electionPositions.map((ep) => ({
    name: ep.position.name,
    order: ep.order,
    slots: ep.slots,
    votes: ep._count.votes,
  }));

  res.json({
    election: {
      id: activeElection.id,
      name: activeElection.name,
      status: activeElection.status,
      validateIp: activeElection.validateIp,
      positionsCount: activeElection.electionPositions.length,
      statesCount: activeElection.electionStates.length,
      positions: positionProgress,
    },
    stats: { voted, inProgress, totalVotes, totalSessions: voted + inProgress },
  });
});
