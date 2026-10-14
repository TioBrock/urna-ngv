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
        include: {
          position: true,
          positionStates: { include: { state: true } },
        },
      },
    },
  });

  if (!election) throw new AppError('Eleição não encontrada', 404);

  if (!adminAccess && election.status !== 'CLOSED' && !election.showResultsDuringVoting) {
    throw new AppError('Resultados não disponíveis durante a votação', 403);
  }

  return election;
}

interface PartySeats {
  party: string;
  votes: number;
  percentage: string;
  directSeats: number;
  leftoverSeats: number;
  totalSeats: number;
}

function calculateElectedCandidates(
  candidatesList: Array<{ candidate: any; votes: number; percentage: string; percentageTotal?: string }>,
  validVotes: number,
  slots: number,
  votingSystem: string,
  hasSecondRound: boolean = false,
  round: number = 1
): {
  rankedCandidates: Array<{
    candidate: any;
    votes: number;
    percentage: string;
    percentageTotal?: string;
    isElected: boolean;
    isSecondRound?: boolean;
    isTie?: boolean;
    status: 'ELEITO' | '2º TURNO' | 'EMPATE' | 'NÃO ELEITO';
    electedReason?: string;
  }>;
  electoralQuotient: number | null;
  partyResults: PartySeats[];
} {
  if (candidatesList.length === 0 || validVotes <= 0 || slots <= 0) {
    return {
      rankedCandidates: candidatesList.map((c) => ({
        ...c,
        isElected: false,
        status: 'NÃO ELEITO' as const,
      })),
      electoralQuotient: votingSystem === 'PROPORCIONAL' ? 1 : null,
      partyResults: [],
    };
  }

  // 1. SISTEMA MAJORITÁRIO
  if (votingSystem !== 'PROPORCIONAL') {
    const sorted = [...candidatesList].sort(
      (a, b) => b.votes - a.votes || a.candidate.number.localeCompare(b.candidate.number, undefined, { numeric: true })
    );

    // CASO A: Eleição de 1º Turno com Segundo Turno configurado
    if (round === 1 && hasSecondRound) {
      const first = sorted[0];
      // Para ser eleito no 1º turno precisa de 50%+1 dos votos válidos (estritamente > 50%)
      const hasAbsoluteMajority = first && first.votes > validVotes / 2;

      if (hasAbsoluteMajority) {
        const rankedCandidates = sorted.map((c, idx) => ({
          ...c,
          isElected: idx === 0,
          isSecondRound: false,
          isTie: false,
          status: idx === 0 ? ('ELEITO' as const) : ('NÃO ELEITO' as const),
          electedReason: idx === 0 ? 'Eleito em 1º Turno (Maioria Absoluta)' : undefined,
        }));
        return { rankedCandidates, electoralQuotient: null, partyResults: [] };
      }

      // NÃO houve maioria absoluta: NINGUÉM é eleito direto no 1º turno -> Classificação para 2º Turno
      const topVotes = sorted[0].votes;
      const secondVotes = sorted[1]?.votes ?? -1;

      // Verificação de empates
      const tieCountTop = sorted.filter((s) => s.votes === topVotes && topVotes > 0).length;
      const tieAtSecond =
        sorted.length > 2 &&
        sorted[1].votes === sorted[2].votes &&
        sorted[1].votes > 0 &&
        topVotes > secondVotes;

      const rankedCandidates = sorted.map((c, idx) => {
        // Se 3 ou mais empataram no 1º lugar:
        if (tieCountTop > 2 && c.votes === topVotes) {
          return {
            ...c,
            isElected: false,
            isSecondRound: false,
            isTie: true,
            status: 'EMPATE' as const,
            electedReason: 'Empate para vaga de 2º Turno',
          };
        }

        // Se exatamente 2 empataram no 1º lugar: ambos vão para o 2º turno
        if (tieCountTop === 2 && c.votes === topVotes) {
          return {
            ...c,
            isElected: false,
            isSecondRound: true,
            isTie: false,
            status: '2º TURNO' as const,
            electedReason: 'Classificado para o 2º Turno (Empate em 1º)',
          };
        }

        // 1º colocado isolado:
        if (idx === 0) {
          return {
            ...c,
            isElected: false,
            isSecondRound: true,
            isTie: false,
            status: '2º TURNO' as const,
            electedReason: 'Classificado para o 2º Turno',
          };
        }

        // Se há empate na 2ª vaga:
        if (tieAtSecond && c.votes === secondVotes) {
          return {
            ...c,
            isElected: false,
            isSecondRound: false,
            isTie: true,
            status: 'EMPATE' as const,
            electedReason: 'Empate para vaga de 2º Turno',
          };
        }

        // 2º colocado isolado:
        if (idx === 1 && !tieAtSecond && c.votes > 0) {
          return {
            ...c,
            isElected: false,
            isSecondRound: true,
            isTie: false,
            status: '2º TURNO' as const,
            electedReason: 'Classificado para o 2º Turno',
          };
        }

        // Demais não classificados:
        return {
          ...c,
          isElected: false,
          isSecondRound: false,
          isTie: false,
          status: 'NÃO ELEITO' as const,
          electedReason: undefined,
        };
      });

      return { rankedCandidates, electoralQuotient: null, partyResults: [] };
    }

    // CASO B: Segundo Turno (round === 2) OU Majoritário SEM Segundo Turno (hasSecondRound === false)
    // "se der empate onde não tem segundo turno ou em um segundo turno, informar apenas empate."
    if (slots === 1) {
      const first = sorted[0];
      const second = sorted[1];
      const isTieAtTop = second && first.votes === second.votes && first.votes > 0;

      if (isTieAtTop) {
        const rankedCandidates = sorted.map((c) => {
          if (c.votes === first.votes) {
            return {
              ...c,
              isElected: false,
              isTie: true,
              status: 'EMPATE' as const,
              electedReason: 'Empate',
            };
          }
          return {
            ...c,
            isElected: false,
            status: 'NÃO ELEITO' as const,
          };
        });
        return { rankedCandidates, electoralQuotient: null, partyResults: [] };
      }

      // 1º colocado isolado
      const rankedCandidates = sorted.map((c, idx) => ({
        ...c,
        isElected: idx === 0 && c.votes > 0,
        status: idx === 0 && c.votes > 0 ? ('ELEITO' as const) : ('NÃO ELEITO' as const),
        electedReason:
          idx === 0 && c.votes > 0
            ? round === 2
              ? 'Eleito em 2º Turno'
              : 'Majoritário (Mais votado)'
            : undefined,
      }));
      return { rankedCandidates, electoralQuotient: null, partyResults: [] };
    }

    // Múltiplas vagas (ex: Senador com 2 vagas)
    const cutoffIndex = slots - 1;
    const cutoffVotes = sorted[cutoffIndex]?.votes ?? 0;
    const nextVotes = sorted[slots]?.votes ?? -1;
    const isTieAtCutoff = sorted.length > slots && cutoffVotes === nextVotes && cutoffVotes > 0;

    const rankedCandidates = sorted.map((c, idx) => {
      if (isTieAtCutoff && c.votes === cutoffVotes) {
        return {
          ...c,
          isElected: false,
          isTie: true,
          status: 'EMPATE' as const,
          electedReason: 'Empate',
        };
      }

      const isElected = idx < slots && c.votes > 0;
      return {
        ...c,
        isElected,
        status: isElected ? ('ELEITO' as const) : ('NÃO ELEITO' as const),
        electedReason: isElected ? 'Majoritário (Mais votado)' : undefined,
      };
    });

    return { rankedCandidates, electoralQuotient: null, partyResults: [] };
  }

  // 2. SISTEMA PROPORCIONAL (Quociente Eleitoral + Quociente Partidário + Sobras D'Hondt)
  const qe = Math.max(1, Math.round(validVotes / slots));

  // Votos por partido
  const partyVotesMap = new Map<string, number>();
  for (const c of candidatesList) {
    const p = (c.candidate.party || 'SEM PARTIDO').trim().toUpperCase();
    partyVotesMap.set(p, (partyVotesMap.get(p) ?? 0) + c.votes);
  }

  const partyList: Array<{ party: string; votes: number; directSeats: number; leftoverSeats: number; totalSeats: number }> = [];
  let totalDirectSeats = 0;

  for (const [party, votes] of partyVotesMap.entries()) {
    const directSeats = Math.floor(votes / qe);
    totalDirectSeats += directSeats;
    partyList.push({
      party,
      votes,
      directSeats,
      leftoverSeats: 0,
      totalSeats: directSeats,
    });
  }

  // Se a soma dos QP ultrapassar o total de vagas (caso de arredondamento raro), limitar
  if (totalDirectSeats > slots) {
    partyList.sort((a, b) => (b.votes % qe) - (a.votes % qe));
    let allocated = 0;
    for (const p of partyList) {
      if (allocated + p.directSeats <= slots) {
        allocated += p.directSeats;
        p.totalSeats = p.directSeats;
      } else {
        p.directSeats = Math.max(0, slots - allocated);
        p.totalSeats = p.directSeats;
        allocated = slots;
      }
    }
  } else {
    // Distribuição das sobras pelo Método D'Hondt (Maiores Médias)
    let leftoversRemaining = slots - totalDirectSeats;

    while (leftoversRemaining > 0) {
      let bestParty: (typeof partyList)[0] | null = null;
      let highestAverage = -1;

      for (const p of partyList) {
        if (p.votes <= 0) continue;
        // Limitar vagas por partido ao número de candidatos com votos E ao máximo global de slots
        const candidatesInPartyWithVotes = candidatesList.filter(
          (c) => (c.candidate.party || 'SEM PARTIDO').trim().toUpperCase() === p.party && c.votes > 0
        ).length;
        if (p.totalSeats >= Math.min(candidatesInPartyWithVotes, slots)) continue;

        const avg = p.votes / (p.totalSeats + 1);
        if (avg > highestAverage || (avg === highestAverage && bestParty && p.votes > bestParty.votes)) {
          highestAverage = avg;
          bestParty = p;
        }
      }

      if (!bestParty) break;

      bestParty.leftoverSeats += 1;
      bestParty.totalSeats += 1;
      leftoversRemaining -= 1;
    }
  }

  // Determinar candidatos eleitos dentro de cada partido (respeitando teto total de vagas)
  const electedCandidateIds = new Set<string>();
  const electedReasonMap = new Map<string, string>();
  let totalElected = 0;

  // Ordenar partidos por vagas desc para determinismo
  const partyListSorted = [...partyList].sort((a, b) => b.totalSeats - a.totalSeats || b.votes - a.votes);

  for (const p of partyListSorted) {
    if (p.totalSeats <= 0 || totalElected >= slots) continue;
    const partyCandidates = candidatesList
      .filter((c) => (c.candidate.party || 'SEM PARTIDO').trim().toUpperCase() === p.party && c.votes > 0)
      .sort((a, b) => b.votes - a.votes);

    const seatsToGive = Math.min(p.totalSeats, partyCandidates.length, slots - totalElected);
    for (let i = 0; i < seatsToGive; i++) {
      const cand = partyCandidates[i];
      electedCandidateIds.add(cand.candidate.id);
      const isDirect = i < p.directSeats;
      electedReasonMap.set(
        cand.candidate.id,
        isDirect ? `Quociente Partidário (${p.party})` : `Média / Sobras (${p.party})`
      );
      totalElected++;
    }
  }

  const sorted = [...candidatesList].sort(
    (a, b) => b.votes - a.votes || a.candidate.number.localeCompare(b.candidate.number, undefined, { numeric: true })
  );
  const rankedCandidates = sorted.map((c) => {
    const isElected = electedCandidateIds.has(c.candidate.id);
    return {
      ...c,
      isElected,
      status: isElected ? ('ELEITO' as const) : ('NÃO ELEITO' as const),
      electedReason: electedReasonMap.get(c.candidate.id),
    };
  });

  const partyResults: PartySeats[] = partyList
    .map((p) => ({
      party: p.party,
      votes: p.votes,
      percentage: validVotes > 0 ? ((p.votes / validVotes) * 100).toFixed(2) : '0.00',
      directSeats: p.directSeats,
      leftoverSeats: p.leftoverSeats,
      totalSeats: p.totalSeats,
    }))
    .sort((a, b) => b.totalSeats - a.totalSeats || b.votes - a.votes);

  return {
    rankedCandidates,
    electoralQuotient: qe,
    partyResults,
  };
}

// GET /api/results/:electionId — resultados gerais (admin)
resultsRouter.get('/:electionId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const election = await getElectionWithAccess(req.params.electionId, true);
  const { stateId } = req.query;

  // Totais gerais e por estado da eleição (sem depender de filtro)
  const [totalVotersOverall, electionStates, votesByStateGroup, votersByStateGroup] = await Promise.all([
    // totalVotes = quantidade de eleitores que votaram (não soma de votos por cargo)
    prisma.voterSession.count({ where: { electionId: req.params.electionId, status: 'VOTED' } }),
    prisma.electionState.findMany({
      where: { electionId: req.params.electionId },
      include: { state: { select: { id: true, name: true, abbreviation: true } } },
      orderBy: { state: { name: 'asc' } },
    }),
    prisma.vote.groupBy({
      by: ['stateId'],
      where: { electionId: req.params.electionId },
      _count: { _all: true },
    }),
    prisma.voterSession.groupBy({
      by: ['stateId'],
      where: { electionId: req.params.electionId, status: 'VOTED' },
      _count: { _all: true },
    }),
  ]);

  const statesOverview = electionStates.map((es) => {
    // Quantidade de eleitores (pessoas) que votaram neste estado (não a soma de votos de cargos)
    const stateVoters = votersByStateGroup.find((g) => g.stateId === es.stateId)?._count._all ?? 0;
    return {
      state: es.state,
      votes: stateVoters,
      voters: stateVoters,
      percentage: totalVotersOverall > 0 ? ((stateVoters / totalVotersOverall) * 100).toFixed(1) : '0.0',
    };
  });

  const results = await Promise.all(
    election.electionPositions.map(async (ep) => {
      const votingSystem = ep.votingSystem || 'MAJORITARIO';

      // 1. Apuração CONSOLIDADA do cargo (soma de todas as vagas/slots para este cargo)
      const votesByCandidateOverall = await prisma.vote.groupBy({
        by: ['candidateId', 'type'],
        where: {
          electionPositionId: ep.id,
          ...(stateId ? { stateId: String(stateId) } : {}),
        },
        _count: { _all: true },
      });

      const totalVotes = votesByCandidateOverall.reduce((sum, v) => sum + v._count._all, 0);
      const blank = votesByCandidateOverall.filter((v) => v.type === 'BLANK').reduce((s, v) => s + v._count._all, 0);
      const nullVotes = votesByCandidateOverall.filter((v) => v.type === 'NULL').reduce((s, v) => s + v._count._all, 0);
      const validVotes = totalVotes - blank - nullVotes;

      // Busca todos os candidatos ativos cadastrados para este cargo na eleição
      const candidates = await prisma.candidate.findMany({
        where: {
          electionId: election.id,
          positionId: ep.positionId,
          isActive: true,
          ...(stateId
            ? {
                OR: [
                  { stateId: String(stateId) },
                  { isNational: true },
                  { stateId: null },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          name: true,
          electoralName: true,
          number: true,
          party: true,
          photoUrl: true,
          stateId: true,
          isNational: true,
        },
        orderBy: [{ number: 'asc' }],
      });

      const candidateResults = candidates
        .map((c) => {
          const votes = votesByCandidateOverall.find((v) => v.candidateId === c.id)?._count._all ?? 0;
          return {
            candidate: c,
            votes,
            percentage: validVotes > 0 ? ((votes / validVotes) * 100).toFixed(2) : '0.00',
            percentageTotal: totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(2) : '0.00',
          };
        })
        .sort((a, b) => {
          if (b.votes !== a.votes) return b.votes - a.votes;
          return a.candidate.number.localeCompare(b.candidate.number, undefined, { numeric: true });
        });

      // Determinar eleitos:
      // Se for cargo estadual (isNational === false) e NÃO foi passado filtro de estado:
      // A eleição de representantes ocorre por estado participante!
      let rankedCandidates: Array<any> = [];
      let electoralQuotient: number | null = null;
      let partyResults: PartySeats[] = [];

      // Calcular por estado apenas se distributionType for ESTADUAL ou TOTAL_DISTRIBUIDO.
      // NACIONAL = pool único de vagas compartilhado entre todos os estados.
      const usePerStateCalc = !ep.isNational && !stateId && ep.distributionType !== 'NACIONAL';
      if (usePerStateCalc) {
        // Apuração estado a estado
        const electedSet = new Set<string>();
        const statusMap = new Map<string, 'ELEITO' | '2º TURNO' | 'EMPATE' | 'NÃO ELEITO'>();
        const reasonMap = new Map<string, string>();
        const consolidatedPartyMap = new Map<string, { votes: number; directSeats: number; leftoverSeats: number; totalSeats: number }>();

        const votesByCandidateAndState = await prisma.vote.groupBy({
          by: ['candidateId', 'stateId'],
          where: {
            electionPositionId: ep.id,
            type: 'VALID',
          },
          _count: { _all: true },
        });

        const applicableStates = ep.positionStates && ep.positionStates.length > 0
          ? electionStates.filter((es) => ep.positionStates.some((ps: any) => ps.stateId === es.stateId))
          : electionStates;

        for (const es of applicableStates) {
          const stateVotes = votesByCandidateAndState.filter((v) => v.stateId === es.stateId);
          const stateValidVotes = stateVotes.reduce((sum, v) => sum + v._count._all, 0);

          const stateCandidateResults = candidates
            .filter((c) => c.stateId === es.stateId || c.isNational || !c.stateId)
            .map((c) => {
              const v = stateVotes.find((sv) => sv.candidateId === c.id)?._count._all ?? 0;
              return {
                candidate: c,
                votes: v,
                percentage: stateValidVotes > 0 ? ((v / stateValidVotes) * 100).toFixed(2) : '0.00',
                percentageTotal: stateValidVotes > 0 ? ((v / stateValidVotes) * 100).toFixed(2) : '0.00',
              };
            })
            .sort((a, b) => {
              if (b.votes !== a.votes) return b.votes - a.votes;
              return a.candidate.number.localeCompare(b.candidate.number, undefined, { numeric: true });
            });

          if (stateCandidateResults.length === 0) continue;

          const stateCfg = ep.positionStates?.find((ps: any) => ps.stateId === es.stateId);
          const stateSlots = stateCfg?.slots ?? ep.slots;
          const stateHasSecondRound = stateCfg ? stateCfg.hasSecondRound : ep.hasSecondRound;

          const stateCalculation = calculateElectedCandidates(
            stateCandidateResults,
            stateValidVotes,
            stateSlots,
            votingSystem,
            stateHasSecondRound,
            election.round
          );

          const stateAbbr = es.state?.abbreviation || '';
          for (const rc of stateCalculation.rankedCandidates) {
            if (rc.isElected) {
              electedSet.add(rc.candidate.id);
            }
            if (rc.status && rc.status !== 'NÃO ELEITO') {
              statusMap.set(rc.candidate.id, rc.status);
            }
            if (rc.electedReason) {
              const existing = reasonMap.get(rc.candidate.id);
              reasonMap.set(
                rc.candidate.id,
                existing ? `${existing}, ${stateAbbr}` : `${rc.electedReason} [${stateAbbr}]`
              );
            }
          }

          for (const pr of stateCalculation.partyResults) {
            const cur = consolidatedPartyMap.get(pr.party) ?? { votes: 0, directSeats: 0, leftoverSeats: 0, totalSeats: 0 };
            cur.votes += pr.votes;
            cur.directSeats += pr.directSeats;
            cur.leftoverSeats += pr.leftoverSeats;
            cur.totalSeats += pr.totalSeats;
            consolidatedPartyMap.set(pr.party, cur);
          }
        }

        if (statusMap.size === 0 && candidateResults.length > 0) {
          const calc = calculateElectedCandidates(
            candidateResults,
            validVotes,
            ep.slots,
            votingSystem,
            ep.hasSecondRound,
            election.round
          );
          rankedCandidates = calc.rankedCandidates;
          electoralQuotient = calc.electoralQuotient;
          partyResults = calc.partyResults;
        } else {
          rankedCandidates = candidateResults.map((c) => {
            const status = statusMap.get(c.candidate.id) || (electedSet.has(c.candidate.id) ? 'ELEITO' : 'NÃO ELEITO');
            return {
              ...c,
              isElected: status === 'ELEITO',
              isSecondRound: status === '2º TURNO',
              isTie: status === 'EMPATE',
              status,
              electedReason: reasonMap.get(c.candidate.id),
            };
          });

          partyResults = Array.from(consolidatedPartyMap.entries())
            .map(([party, data]) => ({
              party,
              votes: data.votes,
              percentage: validVotes > 0 ? ((data.votes / validVotes) * 100).toFixed(2) : '0.00',
              directSeats: data.directSeats,
              leftoverSeats: data.leftoverSeats,
              totalSeats: data.totalSeats,
            }))
            .sort((a, b) => b.totalSeats - a.totalSeats || b.votes - a.votes);

          electoralQuotient = null;
        }
      } else {
        // Circunscrição única (Nacional ou Estado específico filtrado)
        const calc = calculateElectedCandidates(
          candidateResults,
          validVotes,
          ep.slots,
          votingSystem,
          ep.hasSecondRound,
          election.round
        );
        rankedCandidates = calc.rankedCandidates;
        electoralQuotient = calc.electoralQuotient;
        partyResults = calc.partyResults;
      }

      // 2. Detalhamento por vaga individual (preservado para auditoria se necessário)
      const slots = Array.from({ length: ep.slots }, (_, i) => i + 1);
      const slotResults = await Promise.all(
        slots.map(async (slot) => {
          const votesByCandidate = await prisma.vote.groupBy({
            by: ['candidateId', 'type'],
            where: {
              electionPositionId: ep.id,
              slot,
              ...(stateId ? { stateId: String(stateId) } : {}),
            },
            _count: { _all: true },
          });

          const slotTotalVotes = votesByCandidate.reduce((sum, v) => sum + v._count._all, 0);
          const slotBlank = votesByCandidate.filter((v) => v.type === 'BLANK').reduce((s, v) => s + v._count._all, 0);
          const slotNullVotes = votesByCandidate.filter((v) => v.type === 'NULL').reduce((s, v) => s + v._count._all, 0);
          const slotValidVotes = slotTotalVotes - slotBlank - slotNullVotes;

          const slotValidCandidateIds = votesByCandidate
            .filter((v) => v.type === 'VALID' && v.candidateId)
            .map((v) => v.candidateId!);

          const slotCandidates = slotValidCandidateIds.length
            ? await prisma.candidate.findMany({
                where: { id: { in: slotValidCandidateIds } },
                select: { id: true, name: true, electoralName: true, number: true, party: true, photoUrl: true },
              })
            : [];

          const slotCandidateResults = slotCandidates
            .map((c) => {
              const votes = votesByCandidate.find((v) => v.candidateId === c.id)?._count._all ?? 0;
              return {
                candidate: c,
                votes,
                percentage: slotValidVotes > 0 ? ((votes / slotValidVotes) * 100).toFixed(2) : '0.00',
                percentageTotal: slotTotalVotes > 0 ? ((votes / slotTotalVotes) * 100).toFixed(2) : '0.00',
              };
            })
            .sort((a, b) => b.votes - a.votes);

          return {
            slot,
            totalVotes: slotTotalVotes,
            validVotes: slotValidVotes,
            blank: slotBlank,
            null: slotNullVotes,
            blankPercentage: slotTotalVotes > 0 ? ((slotBlank / slotTotalVotes) * 100).toFixed(2) : '0.00',
            nullPercentage: slotTotalVotes > 0 ? ((slotNullVotes / slotTotalVotes) * 100).toFixed(2) : '0.00',
            validPercentage: slotTotalVotes > 0 ? ((slotValidVotes / slotTotalVotes) * 100).toFixed(2) : '0.00',
            candidates: slotCandidateResults,
          };
        })
      );

      return {
        electionPosition: {
          id: ep.id,
          name: ep.position.name,
          order: ep.order,
          slots: ep.slots,
          choicesPerVoter: ep.choicesPerVoter,
          hasSecondRound: ep.hasSecondRound,
          votingSystem,
          isNational: ep.isNational,
        },
        votingSystem,
        electoralQuotient,
        partyResults,
        totalVotes,
        validVotes,
        blank,
        null: nullVotes,
        blankPercentage: totalVotes > 0 ? ((blank / totalVotes) * 100).toFixed(2) : '0.00',
        nullPercentage: totalVotes > 0 ? ((nullVotes / totalVotes) * 100).toFixed(2) : '0.00',
        validPercentage: totalVotes > 0 ? ((validVotes / totalVotes) * 100).toFixed(2) : '0.00',
        candidates: rankedCandidates,
        slots: slotResults,
      };
    })
  );

  res.json({
    election: {
      id: election.id,
      name: election.name,
      status: election.status,
      round: election.round,
      parentElectionId: election.parentElectionId,
    },
    overview: {
      totalVotes: totalVotersOverall,
      totalVoters: totalVotersOverall,
      byState: statesOverview,
    },
    results,
  });
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

// GET /api/results/:electionId/csv — exportação do Boletim de Urna (BU) em formato CSV
resultsRouter.get('/:electionId/csv', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const election = await getElectionWithAccess(req.params.electionId, true);
  const { stateId } = req.query;

  const [totalVotersOverall, electionStates, votersByStateGroup] = await Promise.all([
    prisma.voterSession.count({ where: { electionId: req.params.electionId, status: 'VOTED' } }),
    prisma.electionState.findMany({
      where: { electionId: req.params.electionId },
      include: { state: { select: { id: true, name: true, abbreviation: true } } },
      orderBy: { state: { name: 'asc' } },
    }),
    prisma.voterSession.groupBy({
      by: ['stateId'],
      where: { electionId: req.params.electionId, status: 'VOTED' },
      _count: { _all: true },
    }),
  ]);

  const statesOverview = electionStates.map((es) => {
    const stateVoters = votersByStateGroup.find((g) => g.stateId === es.stateId)?._count._all ?? 0;
    return {
      name: es.state.name,
      abbreviation: es.state.abbreviation,
      voters: stateVoters,
      percentage: totalVotersOverall > 0 ? ((stateVoters / totalVotersOverall) * 100).toFixed(1) : '0.0',
    };
  });

  const lines: string[] = [];
  const escapeCsv = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;

  // Cabeçalho institucional
  lines.push(`${escapeCsv('SISTEMA ELEITORAL NGV - BOLETIM DE URNA (BU)')};;;;;;;;`);
  lines.push(`${escapeCsv('Eleição')};${escapeCsv(election.name)};;;;;;;`);
  lines.push(`${escapeCsv('Ano')};${escapeCsv(election.year)};;;;;;;`);
  lines.push(`${escapeCsv('Status')};${escapeCsv(election.status)};;;;;;;`);
  lines.push(`${escapeCsv('Data de Emissão')};${escapeCsv(new Date().toLocaleString('pt-BR'))};;;;;;;`);
  lines.push(`${escapeCsv('Total de Eleitores que Votaram')};${escapeCsv(totalVotersOverall)};;;;;;;`);
  lines.push(';;;;;;;;');

  // Seção de comparecimento por estado
  lines.push(`${escapeCsv('COMPARECIMENTO POR ESTADO (UF)')};;;;;;;;`);
  lines.push(`${escapeCsv('Estado')};${escapeCsv('Sigla')};${escapeCsv('Eleitores')};${escapeCsv('% Participação')};;;;;`);
  for (const st of statesOverview) {
    lines.push(`${escapeCsv(st.name)};${escapeCsv(st.abbreviation)};${escapeCsv(st.voters)};${escapeCsv(`${st.percentage}%`)};;;;;`);
  }
  lines.push(';;;;;;;;');

  // Seção de apuração consolidada por cargo
  lines.push(`${escapeCsv('RESULTADOS CONSOLIDADOS POR CARGO (TOTALIZAÇÃO OFICIAL)')};;;;;;;;;;;`);
  lines.push(
    [
      escapeCsv('Cargo'),
      escapeCsv('Sistema'),
      escapeCsv('Vagas'),
      escapeCsv('Colocação'),
      escapeCsv('Situação'),
      escapeCsv('Critério / Razão'),
      escapeCsv('Candidato / Opção'),
      escapeCsv('Número'),
      escapeCsv('Partido'),
      escapeCsv('Votos Totais'),
      escapeCsv('% Votos Válidos'),
      escapeCsv('% Total Votos'),
    ].join(';')
  );

  for (const ep of election.electionPositions) {
    const votingSystem = ep.votingSystem || 'MAJORITARIO';

    // 1. Totalização unificada de todas as vagas do cargo
    const votesByCandidateOverall = await prisma.vote.groupBy({
      by: ['candidateId', 'type'],
      where: {
        electionPositionId: ep.id,
        ...(stateId ? { stateId: String(stateId) } : {}),
      },
      _count: { _all: true },
    });

    const totalVotes = votesByCandidateOverall.reduce((sum, v) => sum + v._count._all, 0);
    const blank = votesByCandidateOverall.filter((v) => v.type === 'BLANK').reduce((s, v) => s + v._count._all, 0);
    const nullVotes = votesByCandidateOverall.filter((v) => v.type === 'NULL').reduce((s, v) => s + v._count._all, 0);
    const validVotes = totalVotes - blank - nullVotes;

    // Busca todos os candidatos ativos cadastrados para este cargo na eleição
    const candidates = await prisma.candidate.findMany({
      where: {
        electionId: election.id,
        positionId: ep.positionId,
        isActive: true,
        ...(stateId
          ? {
              OR: [
                { stateId: String(stateId) },
                { isNational: true },
                { stateId: null },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        electoralName: true,
        number: true,
        party: true,
        stateId: true,
        isNational: true,
      },
      orderBy: [{ number: 'asc' }],
    });

    const candidateResults = candidates
      .map((c) => {
        const votes = votesByCandidateOverall.find((v) => v.candidateId === c.id)?._count._all ?? 0;
        return {
          candidate: c,
          votes,
          percentage: validVotes > 0 ? ((votes / validVotes) * 100).toFixed(2) : '0.00',
          percentageValid: validVotes > 0 ? ((votes / validVotes) * 100).toFixed(2) : '0.00',
          percentageTotal: totalVotes > 0 ? ((votes / totalVotes) * 100).toFixed(2) : '0.00',
        };
      })
      .sort((a, b) => {
        if (b.votes !== a.votes) return b.votes - a.votes;
        return a.candidate.number.localeCompare(b.candidate.number, undefined, { numeric: true });
      });

    let rankedCandidates: Array<any> = [];

    const usePerStateCalc = !ep.isNational && !stateId && ep.distributionType !== 'NACIONAL';
    if (usePerStateCalc) {
      const electedSet = new Set<string>();
      const statusMap = new Map<string, 'ELEITO' | '2º TURNO' | 'EMPATE' | 'NÃO ELEITO'>();
      const reasonMap = new Map<string, string>();

      const votesByCandidateAndState = await prisma.vote.groupBy({
        by: ['candidateId', 'stateId'],
        where: {
          electionPositionId: ep.id,
          type: 'VALID',
        },
        _count: { _all: true },
      });

      const applicableStates = ep.positionStates && ep.positionStates.length > 0
        ? electionStates.filter((es) => ep.positionStates.some((ps: any) => ps.stateId === es.stateId))
        : electionStates;

      for (const es of applicableStates) {
        const stateVotes = votesByCandidateAndState.filter((v) => v.stateId === es.stateId);
        const stateValidVotes = stateVotes.reduce((sum, v) => sum + v._count._all, 0);

        const stateCandidateResults = candidates
          .filter((c) => c.stateId === es.stateId || c.isNational || !c.stateId)
          .map((c) => {
            const v = stateVotes.find((sv) => sv.candidateId === c.id)?._count._all ?? 0;
            return {
              candidate: c,
              votes: v,
              percentage: stateValidVotes > 0 ? ((v / stateValidVotes) * 100).toFixed(2) : '0.00',
              percentageValid: stateValidVotes > 0 ? ((v / stateValidVotes) * 100).toFixed(2) : '0.00',
              percentageTotal: stateValidVotes > 0 ? ((v / stateValidVotes) * 100).toFixed(2) : '0.00',
            };
          })
          .sort((a, b) => {
            if (b.votes !== a.votes) return b.votes - a.votes;
            return a.candidate.number.localeCompare(b.candidate.number, undefined, { numeric: true });
          });

        if (stateCandidateResults.length === 0) continue;

        const stateCfg = ep.positionStates?.find((ps: any) => ps.stateId === es.stateId);
        const stateSlots = stateCfg?.slots ?? ep.slots;
        const stateHasSecondRound = stateCfg ? stateCfg.hasSecondRound : ep.hasSecondRound;

        const stateCalculation = calculateElectedCandidates(
          stateCandidateResults,
          stateValidVotes,
          stateSlots,
          votingSystem,
          stateHasSecondRound,
          election.round
        );

        const stateAbbr = es.state?.abbreviation || '';
        for (const rc of stateCalculation.rankedCandidates) {
          if (rc.isElected) {
            electedSet.add(rc.candidate.id);
          }
          if (rc.status && rc.status !== 'NÃO ELEITO') {
            statusMap.set(rc.candidate.id, rc.status);
          }
          if (rc.electedReason) {
            const existing = reasonMap.get(rc.candidate.id);
            reasonMap.set(rc.candidate.id, existing ? `${existing}, ${stateAbbr}` : `${rc.electedReason} [${stateAbbr}]`);
          }
        }
      }

      if (statusMap.size === 0 && candidateResults.length > 0) {
        const calc = calculateElectedCandidates(
          candidateResults,
          validVotes,
          ep.slots,
          votingSystem,
          ep.hasSecondRound,
          election.round
        );
        rankedCandidates = calc.rankedCandidates;
      } else {
        rankedCandidates = candidateResults.map((c) => {
          const status = statusMap.get(c.candidate.id) || (electedSet.has(c.candidate.id) ? 'ELEITO' : 'NÃO ELEITO');
          return {
            ...c,
            isElected: status === 'ELEITO',
            isSecondRound: status === '2º TURNO',
            isTie: status === 'EMPATE',
            status,
            electedReason: reasonMap.get(c.candidate.id),
          };
        });
      }
    } else {
      const calc = calculateElectedCandidates(
        candidateResults,
        validVotes,
        ep.slots,
        votingSystem,
        ep.hasSecondRound,
        election.round
      );
      rankedCandidates = calc.rankedCandidates;
    }

    let colocacao = 1;
    for (const cr of rankedCandidates) {
      const situacao = cr.status || (cr.isElected ? 'ELEITO' : 'NÃO ELEITO');
      const razao = cr.electedReason || (cr.isElected ? 'Majoritário (Mais votado)' : situacao === 'EMPATE' ? 'Empate' : situacao === '2º TURNO' ? '2º Turno' : '-');
      lines.push(
        [
          escapeCsv(ep.position.name),
          escapeCsv(votingSystem),
          escapeCsv(ep.slots),
          escapeCsv(`${colocacao}º`),
          escapeCsv(situacao),
          escapeCsv(razao),
          escapeCsv(cr.candidate.electoralName),
          escapeCsv(cr.candidate.number),
          escapeCsv(cr.candidate.party),
          escapeCsv(cr.votes),
          escapeCsv(`${cr.percentageValid || cr.percentage}%`),
          escapeCsv(`${cr.percentageTotal}%`),
        ].join(';')
      );
      colocacao++;
    }

    const blankPct = totalVotes > 0 ? ((blank / totalVotes) * 100).toFixed(2) : '0.00';
    const nullPct = totalVotes > 0 ? ((nullVotes / totalVotes) * 100).toFixed(2) : '0.00';

    lines.push(
      [
        escapeCsv(ep.position.name),
        escapeCsv(votingSystem),
        escapeCsv(ep.slots),
        escapeCsv('-'),
        escapeCsv('-'),
        escapeCsv('-'),
        escapeCsv('Votos em Branco'),
        escapeCsv('-'),
        escapeCsv('-'),
        escapeCsv(blank),
        escapeCsv('-'),
        escapeCsv(`${blankPct}%`),
      ].join(';')
    );

    lines.push(
      [
        escapeCsv(ep.position.name),
        escapeCsv(votingSystem),
        escapeCsv(ep.slots),
        escapeCsv('-'),
        escapeCsv('-'),
        escapeCsv('-'),
        escapeCsv('Votos Nulos'),
        escapeCsv('-'),
        escapeCsv('-'),
        escapeCsv(nullVotes),
        escapeCsv('-'),
        escapeCsv(`${nullPct}%`),
      ].join(';')
    );

    lines.push(
      [
        escapeCsv(ep.position.name),
        escapeCsv(votingSystem),
        escapeCsv(ep.slots),
        escapeCsv('TOTAL'),
        escapeCsv('-'),
        escapeCsv('-'),
        escapeCsv('Total de Votos Válidos'),
        escapeCsv('-'),
        escapeCsv('-'),
        escapeCsv(validVotes),
        escapeCsv('100.00%'),
        escapeCsv(totalVotes > 0 ? `${((validVotes / totalVotes) * 100).toFixed(2)}%` : '0.00%'),
      ].join(';')
    );

    lines.push(
      [
        escapeCsv(ep.position.name),
        escapeCsv(votingSystem),
        escapeCsv(ep.slots),
        escapeCsv('TOTAL'),
        escapeCsv('-'),
        escapeCsv('-'),
        escapeCsv('Total Geral Computado'),
        escapeCsv('-'),
        escapeCsv('-'),
        escapeCsv(totalVotes),
        escapeCsv('-'),
        escapeCsv('100.00%'),
      ].join(';')
    );

    lines.push(';;;;;;;;;;;;');
  }

  // UTF-8 BOM (\uFEFF) para garantir abertura correta no Excel sem caracteres corrompidos
  const csvContent = '\uFEFF' + lines.join('\r\n');
  const safeName = election.name.toLowerCase().replace(/[^a-z0-9]/gi, '_');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="resultado_eleicao_${safeName}.csv"`);
  res.send(csvContent);
});
