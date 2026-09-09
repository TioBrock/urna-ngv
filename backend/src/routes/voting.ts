import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { VoteType, ElectionStatus } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { votingService } from '../services/votingService';
import { extractIp } from '../utils/ipExtractor';
import { AppError } from '../middleware/errorHandler';

export const votingRouter = Router();

// POST /api/voting/start — identificar eleitor e iniciar sessão
const startSchema = z.object({
  electionId: z.string().uuid('ID de eleição inválido'),
  discordName: z.string().min(1, 'Nome no Discord é obrigatório').max(100),
  rpgName: z.string().min(1, 'Nome no RPG é obrigatório').max(100),
  stateId: z.string().uuid('Estado inválido'),
});

votingRouter.post('/start', async (req: Request, res: Response): Promise<void> => {
  const result = startSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.errors[0].message });
    return;
  }

  const ip = extractIp(req);

  try {
    const session = await votingService.startVoting({ ...result.data, ip });
    res.status(201).json(session);
  } catch (err) {
    if (err instanceof AppError && err.message === 'DUPLICATE_VOTE') {
      res.status(409).json({
        error: 'DUPLICATE_VOTE',
        message: 'ESTE ACESSO JÁ REGISTROU UM VOTO NESTA ELEIÇÃO.',
        detail: 'Se você acredita que isso ocorreu por engano, procure a administração/mesário.',
      });
      return;
    }
    throw err;
  }
});

// GET /api/voting/session/:sessionId — estado atual da sessão
votingRouter.get('/session/:sessionId', async (req: Request, res: Response): Promise<void> => {
  const session = await votingService.getSession(req.params.sessionId);
  // Não expor IP na resposta pública
  const { ...sessionData } = session as typeof session & { ip?: string };
  delete (sessionData as { ip?: string }).ip;
  res.json(sessionData);
});

// GET /api/voting/candidate — buscar candidato por número
const findCandidateSchema = z.object({
  number: z.string().min(1),
  electionPositionId: z.string().uuid(),
  stateId: z.string().uuid(),
  sessionId: z.string().uuid(),
});

votingRouter.get('/candidate', async (req: Request, res: Response): Promise<void> => {
  const result = findCandidateSchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ error: result.error.errors[0].message });
    return;
  }

  const candidate = await votingService.findCandidate(result.data);
  res.json({ candidate: candidate ?? null });
});

// POST /api/voting/vote — registrar voto
const voteSchema = z.object({
  sessionId: z.string().uuid(),
  electionPositionId: z.string().uuid(),
  slot: z.number().int().min(1),
  type: z.enum(['VALID', 'BLANK', 'NULL']),
  candidateId: z.string().uuid().nullable().optional(),
});

votingRouter.post('/vote', async (req: Request, res: Response): Promise<void> => {
  const result = voteSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.errors[0].message });
    return;
  }

  const ip = extractIp(req);

  // Validação: candidateId obrigatório para voto VALID
  if (result.data.type === 'VALID' && !result.data.candidateId) {
    res.status(400).json({ error: 'Candidato é obrigatório para voto válido' });
    return;
  }

  try {
    const voteResult = await votingService.castVote({
      ...result.data,
      type: result.data.type as VoteType,
      candidateId: result.data.candidateId ?? null,
      ip,
    });

    res.json(voteResult);
  } catch (err) {
    if (err instanceof AppError && err.message === 'DUPLICATE_CANDIDATE') {
      res.status(409).json({
        error: 'DUPLICATE_CANDIDATE',
        message: 'ESTE CANDIDATO JÁ FOI SELECIONADO.',
        detail: 'Escolha outro candidato para esta vaga.',
      });
      return;
    }
    throw err;
  }
});

// GET /api/voting/election — buscar eleição ativa (público, para a tela de identificação)
votingRouter.get('/election/active', async (_req: Request, res: Response): Promise<void> => {
  const election = await prisma.election.findFirst({
    where: { status: ElectionStatus.OPEN },
    select: {
      id: true,
      name: true,
      description: true,
      year: true,
      electionStates: {
        where: { state: { isActive: true } },
        include: { state: { select: { id: true, name: true, abbreviation: true, isActive: true } } },
        orderBy: { state: { name: 'asc' } },
      },
    },
  });

  if (!election) {
    res.status(404).json({ error: 'Nenhuma eleição aberta no momento' });
    return;
  }

  res.json({
    ...election,
    states: election.electionStates.map((es) => es.state),
  });
});
