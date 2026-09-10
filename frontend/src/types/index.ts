export interface State {
  id: string;
  name: string;
  abbreviation: string;
  isActive?: boolean;
}

export interface Position {
  id: string;
  name: string;
  description?: string | null;
  scope: 'NACIONAL' | 'ESTADUAL' | 'MUNICIPAL' | string;
  defaultSlots: number;
  defaultDigitCount: number;
  isNational: boolean;
}

export interface ElectionPosition {
  id: string;
  electionId: string;
  positionId: string;
  order: number;
  slots: number;
  digitCount: number;
  isNational: boolean;
  isActive: boolean;
  position: Position;
  _count?: { votes: number };
}

export interface Candidate {
  id: string;
  electionId: string;
  positionId: string;
  stateId?: string | null;
  name: string;
  electoralName: string;
  number: string;
  party: string;
  photoUrl?: string | null;
  viceCandidateName?: string | null;
  viceCandidatePhotoUrl?: string | null;
  isNational: boolean;
  isActive: boolean;
  state?: State | null;
  position?: Position;
}

export type ElectionStatus = 'DRAFT' | 'SCHEDULED' | 'OPEN' | 'PAUSED' | 'CLOSED';

export interface Election {
  id: string;
  name: string;
  description?: string | null;
  year: number;
  status: ElectionStatus;
  startDate?: string | null;
  endDate?: string | null;
  showResultsDuringVoting: boolean;
  validateIp?: boolean;
  createdAt: string;
  updatedAt: string;
  electionPositions?: ElectionPosition[];
  electionStates?: { id: string; state: State }[];
  states?: State[];
  _count?: {
    voterSessions: number;
    candidates: number;
    electionPositions: number;
    electionStates: number;
  };
}

export type VoterStatus = 'IN_PROGRESS' | 'VOTED' | 'ABANDONED';

export interface VoterSession {
  id: string;
  electionId: string;
  stateId: string;
  discordName: string;
  rpgName: string;
  status: VoterStatus;
  startedAt: string;
  completedAt?: string | null;
  state?: State;
}

export interface StartVotingResponse {
  sessionId: string;
  election: {
    id: string;
    name: string;
    positions: {
      id: string;
      positionId: string;
      name: string;
      order: number;
      slots: number;
      digitCount: number;
      isNational: boolean;
    }[];
  };
  currentPositionOrder: number;
  currentSlot: number;
}

export type VoteType = 'VALID' | 'BLANK' | 'NULL';

export interface CastVoteResponse {
  vote: {
    id: string;
    slot: number;
    type: VoteType;
    candidateId?: string | null;
  };
  isFinished: boolean;
  nextPositionOrder: number | null;
  nextSlot: number | null;
}

export interface CandidateResult {
  candidate: {
    id: string;
    name: string;
    electoralName: string;
    number: string;
    party: string;
    photoUrl?: string | null;
  };
  votes: number;
  percentage: string; // % sobre votos válidos
  percentageTotal?: string; // % sobre comparecimento total
}

export interface SlotResult {
  slot: number;
  totalVotes: number;
  validVotes: number;
  blank: number;
  null: number;
  blankPercentage: string;
  nullPercentage: string;
  validPercentage: string;
  candidates: CandidateResult[];
}

export interface StateVoteOverview {
  state: {
    id: string;
    name: string;
    abbreviation: string;
  };
  votes: number;
  voters: number;
  percentage: string;
}

export interface ResultsOverview {
  totalVotes: number;
  totalVoters: number;
  byState: StateVoteOverview[];
}

export interface ElectionResult {
  electionPosition: {
    id: string;
    name: string;
    order: number;
    slots: number;
  };
  slots: SlotResult[];
}

export interface VoterReceipt {
  session: {
    id: string;
    electionName: string;
    electionYear: number;
    discordName: string;
    rpgName: string;
    stateName: string;
    stateAbbreviation: string;
    status: string;
    startedAt: string;
    completedAt?: string | null;
    protocol: string;
  };
  votes: {
    id: string;
    positionName: string;
    slot: number;
    totalSlots: number;
    type: VoteType;
    candidate: {
      id?: string;
      name: string;
      electoralName: string;
      number: string;
      party: string;
      photoUrl?: string | null;
      viceCandidateName?: string | null;
    } | null;
    registeredAt: string;
  }[];
}

export interface AuditLog {
  id: string;
  eventType: string;
  description: string;
  ip?: string;
  metadata?: any;
  createdAt: string;
  election?: { name: string };
  adminUser?: { name: string; email: string };
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
}

export interface DashboardData {
  election: {
    id: string;
    name: string;
    status: ElectionStatus;
    validateIp?: boolean;
    positionsCount: number;
    statesCount: number;
    positions: {
      name: string;
      order: number;
      slots: number;
      votes: number;
    }[];
  } | null;
  stats: {
    voted: number;
    inProgress: number;
    totalVotes: number;
    totalSessions: number;
  };
}
