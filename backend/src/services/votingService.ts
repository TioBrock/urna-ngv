import { prisma } from '../utils/prisma';
import { VoteType, VoterStatus, ElectionStatus } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { auditService } from './auditService';

export interface StartVotingParams {
  electionId: string;
  discordName: string;
  rpgName: string;
  stateId: string;
  ip: string;
}

export interface CastVoteParams {
  sessionId: string;
  electionPositionId: string;
  slot: number;
  type: VoteType;
  candidateId: string | null;
  ip: string;
}

export const votingService = {
  /**
   * Inicia uma sessão de votação.
   * Verifica: eleição ativa, estado válido, IP não usado.
   */
  async startVoting(params: StartVotingParams) {
    const { electionId, discordName, rpgName, stateId, ip } = params;

    // 1. Verificar se eleição está aberta
    const election = await prisma.election.findUnique({
      where: { id: electionId, status: ElectionStatus.OPEN },
      include: {
        electionStates: { where: { stateId }, select: { id: true } },
        electionPositions: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
          include: { position: true },
        },
      },
    });

    if (!election) {
      throw new AppError('Eleição não encontrada ou não está aberta', 404);
    }

    // 2. Verificar se o estado participa da eleição
    if (election.electionStates.length === 0) {
      throw new AppError('Estado não participa desta eleição', 400);
    }

    // 3. Verificar se IP já votou NESTA eleição (somente se validação por IP estiver ativa)
    if (election.validateIp) {
      const existingVoted = await prisma.voterSession.findFirst({
        where: { electionId, ip, status: VoterStatus.VOTED },
      });

      if (existingVoted) {
        await auditService.log({
          eventType: 'DUPLICATE_VOTE_ATTEMPT',
          description: `Tentativa de votação duplicada (IP já votou) — Discord: ${discordName}`,
          electionId,
          ip,
          metadata: { discordName, rpgName, stateId, existingSessionId: existingVoted.id },
        });
        throw new AppError('DUPLICATE_VOTE', 409);
      }
    }

    // 4. Criar sessão
    const session = await prisma.voterSession.create({
      data: {
        electionId,
        stateId,
        discordName: discordName.trim(),
        rpgName: rpgName.trim(),
        ip,
        status: VoterStatus.IN_PROGRESS,
        currentPositionOrder: election.electionPositions[0]?.order ?? 1,
        currentSlot: 1,
      },
    });

    await auditService.log({
      eventType: 'VOTER_SESSION_STARTED',
      description: `Sessão de votação iniciada — Discord: ${discordName} — Estado: ${stateId}`,
      electionId,
      ip,
      metadata: { sessionId: session.id, discordName, rpgName, stateId },
    });

    return {
      sessionId: session.id,
      election: {
        id: election.id,
        name: election.name,
        positions: election.electionPositions.map((ep) => ({
          id: ep.id,
          positionId: ep.positionId,
          name: ep.position.name,
          order: ep.order,
          slots: ep.slots,
          digitCount: ep.digitCount,
          isNational: ep.isNational,
        })),
      },
      currentPositionOrder: session.currentPositionOrder,
      currentSlot: session.currentSlot,
    };
  },

  /**
   * Busca candidato pelo número digitado, cargo e estado do eleitor.
   */
  async findCandidate(params: {
    number: string;
    electionPositionId: string;
    stateId: string;
    sessionId: string;
  }) {
    const { number, electionPositionId, stateId, sessionId } = params;

    // Verificar sessão ativa
    const session = await prisma.voterSession.findUnique({
      where: { id: sessionId, status: VoterStatus.IN_PROGRESS },
    });
    if (!session) {
      throw new AppError('Sessão de votação inválida ou encerrada', 400);
    }

    const electionPosition = await prisma.electionPosition.findUnique({
      where: { id: electionPositionId },
      include: { position: true },
    });
    if (!electionPosition) {
      throw new AppError('Cargo não encontrado', 404);
    }

    const isNationalCargo =
      electionPosition.isNational ||
      electionPosition.position?.isNational ||
      electionPosition.position?.scope === 'NACIONAL' ||
      ['Presidente', 'Vice-Presidente'].includes(electionPosition.position?.name ?? '');

    // Buscar candidato: se for cargo nacional, votável por todos os estados. Se estadual, filtrar por estado.
    const candidate = await prisma.candidate.findFirst({
      where: {
        electionId: session.electionId,
        positionId: electionPosition.positionId,
        number,
        isActive: true,
        ...(isNationalCargo
          ? {} // Cargo nacional: qualquer candidato desta eleição/cargo é votável por todos os estados
          : {
              OR: [
                { stateId },
                { isNational: true },
              ],
            }),
      },
      include: {
        state: { select: { id: true, name: true, abbreviation: true } },
      },
    });

    return candidate;
  },

  /**
   * Registra um voto de forma transacional com todas as validações.
   */
  async castVote(params: CastVoteParams) {
    const { sessionId, electionPositionId, slot, type, candidateId, ip } = params;

    return await prisma.$transaction(async (tx) => {
      // 1. Buscar e validar sessão
      const session = await tx.voterSession.findUnique({
        where: { id: sessionId },
        include: {
          election: {
            include: {
              electionPositions: { where: { isActive: true }, orderBy: { order: 'asc' } },
            },
          },
        },
      });

      if (!session) {
        throw new AppError('Sessão de votação não encontrada', 404);
      }
      if (session.status !== VoterStatus.IN_PROGRESS) {
        throw new AppError('Esta sessão de votação já foi encerrada', 409);
      }
      if (session.election.status !== ElectionStatus.OPEN) {
        throw new AppError('Esta eleição não está mais aberta', 409);
      }

      // 2. Verificar se o voto para esta vaga já existe (idempotência)
      const existingVote = await tx.vote.findUnique({
        where: { voterSessionId_electionPositionId_slot: { voterSessionId: sessionId, electionPositionId, slot } },
      });
      if (existingVote) {
        throw new AppError('Voto já registrado para esta vaga', 409);
      }

      // 3. Validar cargo e vaga
      const electionPosition = await tx.electionPosition.findUnique({
        where: { id: electionPositionId },
        include: { position: true },
      });
      if (!electionPosition || electionPosition.electionId !== session.electionId) {
        throw new AppError('Cargo inválido para esta eleição', 400);
      }
      if (slot < 1 || slot > electionPosition.slots) {
        throw new AppError(`Vaga inválida. Este cargo possui ${electionPosition.slots} vaga(s).`, 400);
      }

      // 4. Validar candidato para votos válidos
      if (type === VoteType.VALID && candidateId) {
        const candidate = await tx.candidate.findUnique({ where: { id: candidateId } });
        if (!candidate || candidate.electionId !== session.electionId || candidate.positionId !== electionPosition.positionId) {
          await auditService.log({
            eventType: 'INVALID_CANDIDATE_ATTEMPT',
            description: `Candidato inválido para este cargo — sessão ${sessionId}`,
            electionId: session.electionId,
            ip,
            metadata: { candidateId, electionPositionId },
          });
          throw new AppError('Candidato inválido para este cargo', 400);
        }
        if (!candidate.isActive) {
          throw new AppError('Candidato inativo', 400);
        }

        const isNationalCargo =
          electionPosition.isNational ||
          electionPosition.position?.isNational ||
          electionPosition.position?.scope === 'NACIONAL' ||
          ['Presidente', 'Vice-Presidente'].includes(electionPosition.position?.name ?? '');

        // Para cargos não nacionais, verificar se o candidato é restrito a outro estado
        if (!isNationalCargo && !candidate.isNational && candidate.stateId && candidate.stateId !== session.stateId) {
          throw new AppError('Candidato não disponível para o seu estado', 400);
        }

        // 5. Verificar candidato repetido em vagas múltiplas
        if (electionPosition.slots > 1 && slot > 1) {
          const previousVote = await tx.vote.findFirst({
            where: {
              voterSessionId: sessionId,
              electionPositionId,
              candidateId,
              slot: { lt: slot },
            },
          });
          if (previousVote) {
            await auditService.log({
              eventType: 'DUPLICATE_CANDIDATE_ATTEMPT',
              description: `Candidato já selecionado em vaga anterior — sessão ${sessionId}`,
              electionId: session.electionId,
              ip,
              metadata: { candidateId, electionPositionId, slot },
            });
            throw new AppError('DUPLICATE_CANDIDATE', 409);
          }
        }
      }

      // 6. Registrar voto
      const vote = await tx.vote.create({
        data: {
          voterSessionId: sessionId,
          electionId: session.electionId,
          electionPositionId,
          stateId: session.stateId,
          slot,
          type,
          candidateId: type === VoteType.VALID ? candidateId : null,
        },
      });

      // 7. Calcular próxima posição
      const positions = session.election.electionPositions;
      const currentPosIndex = positions.findIndex((p) => p.id === electionPositionId);
      const currentPos = positions[currentPosIndex];

      let nextPositionOrder = session.currentPositionOrder;
      let nextSlot = session.currentSlot;
      let isFinished = false;

      if (slot < currentPos.slots) {
        // Próxima vaga do mesmo cargo
        nextSlot = slot + 1;
      } else if (currentPosIndex + 1 < positions.length) {
        // Próximo cargo
        nextPositionOrder = positions[currentPosIndex + 1].order;
        nextSlot = 1;
      } else {
        // Todos os cargos votados
        isFinished = true;
      }

      // 8. Atualizar sessão
      await tx.voterSession.update({
        where: { id: sessionId },
        data: {
          currentPositionOrder: nextPositionOrder,
          currentSlot: nextSlot,
          status: isFinished ? VoterStatus.VOTED : VoterStatus.IN_PROGRESS,
          completedAt: isFinished ? new Date() : undefined,
        },
      });

      if (isFinished) {
        await auditService.log({
          eventType: 'VOTER_SESSION_COMPLETED',
          description: `Votação concluída — Discord: ${session.discordName}`,
          electionId: session.electionId,
          ip,
          metadata: { sessionId },
        });
      }

      return {
        vote,
        isFinished,
        nextPositionOrder: isFinished ? null : nextPositionOrder,
        nextSlot: isFinished ? null : nextSlot,
      };
    });
  },

  /**
   * Retorna o estado atual de uma sessão de votação.
   */
  async getSession(sessionId: string) {
    const session = await prisma.voterSession.findUnique({
      where: { id: sessionId },
      include: {
        election: {
          include: {
            electionPositions: {
              where: { isActive: true },
              orderBy: { order: 'asc' },
              include: { position: true },
            },
          },
        },
        state: { select: { id: true, name: true, abbreviation: true } },
        votes: {
          select: {
            electionPositionId: true,
            slot: true,
            type: true,
            candidateId: true,
          },
        },
      },
    });

    if (!session) {
      throw new AppError('Sessão não encontrada', 404);
    }

    return session;
  },
};
