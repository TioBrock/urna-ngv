import { Router, Response } from 'express';
import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';
import { ElectionStatus } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { auditService } from '../services/auditService';
import { AppError } from '../middleware/errorHandler';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Verifica maioria absoluta: candidato precisa de floor(validVotes/2)+1 votos.
 * Retorna true se o candidato mais votado atingiu maioria absoluta.
 */
function checkAbsoluteMajority(
  topCandidateVotes: number,
  validVotes: number
): boolean {
  if (validVotes === 0) return false;
  const threshold = Math.floor(validVotes / 2) + 1;
  return topCandidateVotes >= threshold;
}

/**
 * Consolida resultados de um cargo majoritário com possível 2º turno.
 * Retorna os dois primeiros candidatos e se há necessidade de 2º turno.
 */
async function consolidateMajoritaryPosition(
  electionPositionId: string,
  stateId: string | null,
  hasSecondRound: boolean,
): Promise<{
  validVotes: number;
  topCandidates: Array<{ candidateId: string; name: string; electoralName: string; party: string; votes: number; percentage: string }>;
  decidedInFirstRound: boolean;
  needsSecondRound: boolean;
  winner?: { candidateId: string; name: string; electoralName: string; party: string; votes: number };
}> {
  const where: any = { electionPositionId, type: 'VALID' };
  if (stateId) where.stateId = stateId;

  // Prisma groupBy: conta votos por candidato
  const rawGroups = await prisma.vote.groupBy({
    by: ['candidateId'],
    where,
    _count: { _all: true },
  });

  // Ordena manualmente por quantidade de votos (decrescente)
  const voteGroups = rawGroups
    .map((g) => ({ candidateId: g.candidateId, votes: g._count._all }))
    .sort((a, b) => b.votes - a.votes);

  const validVotes = voteGroups.reduce((s, v) => s + v.votes, 0);
  if (validVotes === 0) {
    return { validVotes: 0, topCandidates: [], decidedInFirstRound: true, needsSecondRound: false };
  }

  const topTwo = voteGroups.slice(0, 2);
  const candidateIds = topTwo.map((v) => v.candidateId!).filter(Boolean);
  const candidatesData = candidateIds.length
    ? await prisma.candidate.findMany({
        where: { id: { in: candidateIds } },
        select: { id: true, name: true, electoralName: true, party: true },
      })
    : [];

  const topCandidates = topTwo.map((v) => {
    const c = candidatesData.find((cd) => cd.id === v.candidateId);
    return {
      candidateId: v.candidateId!,
      name: c?.name ?? 'Desconhecido',
      electoralName: c?.electoralName ?? 'Desconhecido',
      party: c?.party ?? '-',
      votes: v.votes,
      percentage: ((v.votes / validVotes) * 100).toFixed(2),
    };
  });


  if (!hasSecondRound) {
    return {
      validVotes,
      topCandidates,
      decidedInFirstRound: true,
      needsSecondRound: false,
      winner: topCandidates[0]
        ? { ...topCandidates[0] }
        : undefined,
    };
  }

  const topVotes = topCandidates[0]?.votes ?? 0;
  const hasMajority = checkAbsoluteMajority(topVotes, validVotes);

  return {
    validVotes,
    topCandidates,
    decidedInFirstRound: hasMajority,
    needsSecondRound: !hasMajority,
    winner: hasMajority ? { ...topCandidates[0] } : undefined,
  };
}

/**
 * Consolida todos os resultados da eleição e retorna um snapshot JSON para salvar.
 * Inclui análise de 2º turno por cargo/estado quando aplicável.
 */
async function buildFinalResultsSnapshot(electionId: string): Promise<object> {
  const election = await prisma.election.findUnique({
    where: { id: electionId },
    include: {
      electionPositions: {
        where: { isActive: true },
        include: {
          position: { select: { name: true } },
          positionStates: { include: { state: { select: { id: true, name: true, abbreviation: true } } } },
        },
      },
      electionStates: { include: { state: { select: { id: true, name: true, abbreviation: true } } } },
    },
  });

  if (!election) throw new AppError('Eleição não encontrada', 404);

  const positionResults = await Promise.all(
    election.electionPositions.map(async (ep) => {
      const isMajoritary = ep.votingSystem !== 'PROPORCIONAL';
      const eligibleForSecondRound = isMajoritary && ep.hasSecondRound && ep.slots === 1;

      if (eligibleForSecondRound) {
        if (ep.isNational) {
          // Disputa nacional única
          const result = await consolidateMajoritaryPosition(ep.id, null, true);
          return {
            positionId: ep.id,
            positionName: ep.position.name,
            slots: ep.slots,
            choicesPerVoter: ep.choicesPerVoter,
            votingSystem: ep.votingSystem,
            hasSecondRound: ep.hasSecondRound,
            scope: 'NACIONAL',
            ...result,
          };
        } else {
          // Disputa por estado
          const stateResults = await Promise.all(
            election.electionStates.map(async (es) => {
              // Verifica se este estado tem configuração estadual específica de hasSecondRound
              const stateCfg = ep.positionStates.find((ps) => ps.stateId === es.stateId);
              const stateHasSecondRound = stateCfg ? stateCfg.hasSecondRound : ep.hasSecondRound;
              const result = await consolidateMajoritaryPosition(ep.id, es.stateId, stateHasSecondRound);
              return {
                stateId: es.stateId,
                stateName: es.state.name,
                stateAbbr: es.state.abbreviation,
                hasSecondRound: stateHasSecondRound,
                ...result,
              };
            })
          );
          return {
            positionId: ep.id,
            positionName: ep.position.name,
            slots: ep.slots,
            choicesPerVoter: ep.choicesPerVoter,
            votingSystem: ep.votingSystem,
            hasSecondRound: ep.hasSecondRound,
            scope: 'ESTADUAL',
            byState: stateResults,
          };
        }
      } else {
        // Proporcional ou majoritário sem 2º turno — apenas registra os dados básicos
        const voteCount = await prisma.vote.count({ where: { electionPositionId: ep.id } });
        return {
          positionId: ep.id,
          positionName: ep.position.name,
          slots: ep.slots,
          choicesPerVoter: ep.choicesPerVoter,
          votingSystem: ep.votingSystem,
          hasSecondRound: false,
          totalVotes: voteCount,
          needsSecondRound: false,
          decidedInFirstRound: true,
        };
      }
    })
  );

  return {
    consolidatedAt: new Date().toISOString(),
    electionId,
    electionName: election.name,
    round: election.round,
    positions: positionResults,
  };
}

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

// GET /api/elections/:id/final-results — snapshot consolidado ao encerrar (admin)
electionsRouter.get('/:id/final-results', requireAuth, async (req, res: Response): Promise<void> => {
  const election = await prisma.election.findUnique({
    where: { id: req.params.id },
    select: { id: true, name: true, status: true, round: true, finalResults: true, parentElectionId: true },
  });

  if (!election) {
    res.status(404).json({ error: 'Eleição não encontrada' });
    return;
  }

  if (election.status !== 'CLOSED') {
    res.status(409).json({ error: 'Os resultados finais só estão disponíveis após o encerramento da eleição.' });
    return;
  }

  // Se ainda não foi consolidado (eleição encerrada antes desta feature), consolida agora
  if (!election.finalResults) {
    try {
      const snapshot = await buildFinalResultsSnapshot(req.params.id);
      await prisma.election.update({
        where: { id: req.params.id },
        data: { finalResults: snapshot },
      });
      res.json({ electionId: election.id, name: election.name, status: election.status, round: election.round, finalResults: snapshot });
      return;
    } catch (err) {
      res.status(500).json({ error: 'Erro ao consolidar resultados finais.' });
      return;
    }
  }

  res.json({
    electionId: election.id,
    name: election.name,
    status: election.status,
    round: election.round,
    parentElectionId: election.parentElectionId,
    finalResults: election.finalResults,
  });
});

const disputeSchema = z.object({
  nationalPositionIds: z.array(z.string().uuid()).default([]),
  stateDisputes: z
    .array(
      z.object({
        positionId: z.string().uuid(),
        stateIds: z.array(z.string().uuid()),
      })
    )
    .default([]),
});

const createElectionSchema = z.object({
  name: z.string().min(1, 'Nome da eleição é obrigatório'),
  description: z.string().optional(),
  year: z.number().int().min(1900).max(2100),
  startDate: z.string().optional().nullable().or(z.literal('')),
  endDate: z.string().optional().nullable().or(z.literal('')),
  showResultsDuringVoting: z.boolean().default(false),
  sessionTimeoutHours: z.number().int().min(1).max(72).default(2),
  validateIp: z.boolean().default(true).optional(),
  stateIds: z.array(z.string()).optional(),
  // Segundo turno: vincula esta eleição como filha de um 1º turno
  parentElectionId: z.string().uuid().optional().nullable(),
  round: z.number().int().min(1).max(2).default(1),
  disputes: disputeSchema.optional(),
});

// POST /api/elections
electionsRouter.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const result = createElectionSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.errors[0].message });
    return;
  }

  const { stateIds, disputes, ...data } = result.data;

  // Validação estrita para 2º Turno:
  if (data.round === 2) {
    const hasNational = disputes && disputes.nationalPositionIds && disputes.nationalPositionIds.length > 0;
    const hasState =
      disputes &&
      disputes.stateDisputes &&
      disputes.stateDisputes.some((sd) => sd.stateIds && sd.stateIds.length > 0);

    if (!hasNational && !hasState) {
      throw new AppError(
        'Uma eleição de 2º turno deve ter pelo menos uma disputa configurada (cargo nacional ou ao menos um estado participante em cargo estadual).',
        400
      );
    }
  }

  // Se parentElectionId foi fornecido, valida se existe e está CLOSED
  if (data.parentElectionId) {
    const parentElection = await prisma.election.findUnique({ where: { id: data.parentElectionId } });
    if (!parentElection) {
      throw new AppError('Eleição de 1º turno referenciada não encontrada.', 404);
    }
    if (parentElection.status !== 'CLOSED') {
      throw new AppError('A eleição de 1º turno deve estar encerrada (CLOSED) antes de criar o 2º turno vinculado.', 400);
    }
  }

  // Determinar quais estados participam desta eleição
  let effectiveStateIds = stateIds ?? [];
  if (data.round === 2 && disputes) {
    if (disputes.nationalPositionIds && disputes.nationalPositionIds.length > 0) {
      // Se há cargo nacional, usa todos os estados selecionados ou todos os ativos
      if (effectiveStateIds.length === 0) {
        const allActiveStates = await prisma.state.findMany({ where: { isActive: true }, select: { id: true } });
        effectiveStateIds = allActiveStates.map((s) => s.id);
      }
    } else {
      // Se apenas disputas estaduais foram configuradas, os estados da eleição são exatamente a união dos estados das disputas
      const disputeStates = new Set<string>();
      for (const sd of disputes.stateDisputes || []) {
        for (const sid of sd.stateIds || []) {
          disputeStates.add(sid);
        }
      }
      effectiveStateIds = Array.from(disputeStates);
    }
  }

  const election = await prisma.$transaction(async (tx) => {
    const createdElection = await tx.election.create({
      data: {
        ...data,
        startDate: data.startDate && data.startDate.trim() !== '' ? new Date(data.startDate) : undefined,
        endDate: data.endDate && data.endDate.trim() !== '' ? new Date(data.endDate) : undefined,
        electionStates: effectiveStateIds.length
          ? { create: effectiveStateIds.map((stateId) => ({ stateId })) }
          : undefined,
      },
      include: { electionStates: { include: { state: true } } },
    });

    // Se for 2º turno com disputas configuradas, cria automaticamente os cargos e suas disputas estaduais
    if (data.round === 2 && disputes) {
      let orderIndex = 1;

      // 1. Cargos nacionais selecionados (ex: Presidente)
      if (disputes.nationalPositionIds && disputes.nationalPositionIds.length > 0) {
        const nationalPositions = await tx.position.findMany({
          where: { id: { in: disputes.nationalPositionIds } },
        });

        for (const p of nationalPositions) {
          await tx.electionPosition.create({
            data: {
              electionId: createdElection.id,
              positionId: p.id,
              order: orderIndex++,
              slots: 1, // 2º Turno sempre 1 vaga por disputa
              choicesPerVoter: 1,
              digitCount: p.defaultDigitCount,
              votingSystem: 'MAJORITARIO',
              isNational: true,
              hasSecondRound: false,
              distributionType: 'NACIONAL',
            },
          });
        }
      }

      // 2. Cargos estaduais com seleção seletiva de estados (ex: Governador em SP, RJ...)
      if (disputes.stateDisputes && disputes.stateDisputes.length > 0) {
        for (const sd of disputes.stateDisputes) {
          if (!sd.stateIds || sd.stateIds.length === 0) continue;

          const p = await tx.position.findUnique({ where: { id: sd.positionId } });
          if (!p) continue;

          await tx.electionPosition.create({
            data: {
              electionId: createdElection.id,
              positionId: p.id,
              order: orderIndex++,
              slots: 1,
              choicesPerVoter: 1,
              digitCount: p.defaultDigitCount,
              votingSystem: 'MAJORITARIO',
              isNational: false,
              hasSecondRound: false,
              distributionType: 'ESTADUAL',
              positionStates: {
                create: sd.stateIds.map((stateId) => ({
                  stateId,
                  slots: 1,
                  hasSecondRound: false,
                })),
              },
            },
          });
        }
      }
    }

    return createdElection;
  });

  await auditService.log({
    eventType: 'ELECTION_CREATED',
    description:
      data.round === 2
        ? `Eleição de 2º Turno "${election.name}" criada com sucesso`
        : `Eleição de 1º Turno "${election.name}" criada`,
    electionId: election.id,
    adminUserId: req.adminUser!.id,
    metadata: { round: election.round, parentElectionId: data.parentElectionId },
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

  // Ao encerrar, consolida resultados finais (incluindo análise de 2º turno) e salva snapshot
  let finalResultsSnapshot: object | null = null;
  if (result.data.status === 'CLOSED') {
    try {
      finalResultsSnapshot = await buildFinalResultsSnapshot(req.params.id);
      await prisma.election.update({
        where: { id: req.params.id },
        data: { finalResults: finalResultsSnapshot },
      });
    } catch (err) {
      // Não impede o encerramento se a consolidação falhar — apenas loga
      console.error('[elections] Erro ao consolidar resultados finais:', err);
    }
  }

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
    metadata: result.data.status === 'CLOSED' ? { consolidatedAt: new Date().toISOString() } : undefined,
  });

  res.json({ ...updated, finalResults: finalResultsSnapshot ?? updated.finalResults });
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

// DELETE /api/elections/:id (DRAFT ou CLOSED)
electionsRouter.delete('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const existing = await prisma.election.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: 'Eleição não encontrada' });
    return;
  }
  if (existing.status === 'OPEN' || existing.status === 'PAUSED') {
    throw new AppError('Não é possível excluir uma eleição em andamento ou pausada. Encerre-a antes de excluir.', 409);
  }

  // Deletar fotos físicas de candidatos locais vinculados à eleição
  const candidatesWithPhotos = await prisma.candidate.findMany({
    where: { electionId: req.params.id, photoUrl: { not: null } },
    select: { photoUrl: true },
  });
  for (const c of candidatesWithPhotos) {
    if (c.photoUrl && c.photoUrl.startsWith('/uploads/')) {
      const oldPath = path.join(process.cwd(), c.photoUrl);
      await fs.unlink(oldPath).catch(() => {});
    }
  }

  // Limpeza em cascata transacional para manter integridade do banco
  await prisma.$transaction([
    prisma.vote.deleteMany({ where: { electionId: req.params.id } }),
    prisma.voterSession.deleteMany({ where: { electionId: req.params.id } }),
    prisma.candidate.deleteMany({ where: { electionId: req.params.id } }),
    prisma.electionPosition.deleteMany({ where: { electionId: req.params.id } }),
    prisma.electionState.deleteMany({ where: { electionId: req.params.id } }),
    prisma.auditLog.updateMany({ where: { electionId: req.params.id }, data: { electionId: null } }),
    prisma.election.delete({ where: { id: req.params.id } }),
  ]);

  await auditService.log({
    eventType: 'CONFIG_CHANGED',
    description: `Eleição "${existing.name}" (${existing.year}) e todos os seus dados foram excluídos`,
    adminUserId: req.adminUser!.id,
    metadata: {
      deletedElectionId: existing.id,
      electionName: existing.name,
      electionStatus: existing.status,
    },
  });

  res.json({ message: 'Eleição e dados relacionados excluídos com sucesso' });
});
