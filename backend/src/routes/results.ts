import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

export const resultsRouter = Router();

async function getElectionWithAccess(electionId: string, adminAccess: boolean) {
  const election = await prisma.election.findUnique({
    where: { id: electionId },
    include: {
      electionPositions: {
        where: { isActive: true },
        orderBy: { order: 'asc' },
        include: { position: true },
      },
    },
  });

  if (!election) throw new AppError('Eleição não encontrada', 404);

  if (!adminAccess && election.status !== 'CLOSED' && !election.showResultsDuringVoting) {
    throw new AppError('Resultados não disponíveis durante a votação', 403);
  }

  return election;
}

// GET /api/results/:electionId — resultados gerais (admin)
resultsRouter.get('/:electionId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const election = await getElectionWithAccess(req.params.electionId, true);
  const { stateId } = req.query;

  const results = await Promise.all(
    election.electionPositions.map(async (ep) => {
      const slots = Array.from({ length: ep.slots }, (_, i) => i + 1);

      const slotResults = await Promise.all(
        slots.map(async (slot) => {
          // Votos por candidato neste cargo/vaga
          const votesByCandidate = await prisma.vote.groupBy({
            by: ['candidateId', 'type'],
            where: {
              electionPositionId: ep.id,
              slot,
              ...(stateId ? { stateId: String(stateId) } : {}),
            },
            _count: { _all: true },
          });

          const totalVotes = votesByCandidate.reduce((sum, v) => sum + v._count._all, 0);
          const blank = votesByCandidate.filter((v) => v.type === 'BLANK').reduce((s, v) => s + v._count._all, 0);
          const nullVotes = votesByCandidate.filter((v) => v.type === 'NULL').reduce((s, v) => s + v._count._all, 0);

          const validCandidateIds = votesByCandidate
            .filter((v) => v.type === 'VALID' && v.candidateId)
            .map((v) => v.candidateId!);

          const candidates = validCandidateIds.length
            ? await prisma.candidate.findMany({
                where: { id: { in: validCandidateIds } },
                select: { id: true, name: true, electoralName: true, number: true, party: true, photoUrl: true },
              })
            : [];

          const candidateResults = candidates
            .map((c) => {
              const votes = votesByCandidate.find((v) => v.candidateId === c.id)?._count._all ?? 0;
              return {
                candidate: c,
                votes,
                percentage: totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(2) : '0.00',
              };
            })
            .sort((a, b) => b.votes - a.votes);

          return {
            slot,
            totalVotes,
            blank,
            null: nullVotes,
            candidates: candidateResults,
          };
        })
      );

      return {
        electionPosition: {
          id: ep.id,
          name: ep.position.name,
          order: ep.order,
          slots: ep.slots,
        },
        slots: slotResults,
      };
    })
  );

  res.json({ election: { id: election.id, name: election.name, status: election.status }, results });
});

// GET /api/results/:electionId/summary — resumo rápido para dashboard
resultsRouter.get('/:electionId/summary', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const totalVoters = await prisma.voterSession.count({
    where: { electionId: req.params.electionId, status: 'VOTED' },
  });
  const inProgress = await prisma.voterSession.count({
    where: { electionId: req.params.electionId, status: 'IN_PROGRESS' },
  });
  const totalVotes = await prisma.vote.count({ where: { electionId: req.params.electionId } });

  res.json({ totalVoters, inProgress, totalVotes });
});
