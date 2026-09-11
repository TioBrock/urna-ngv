import axios from 'axios';
import {
  Election,
  ElectionPosition,
  Position,
  Candidate,
  State,
  VoterSession,
  StartVotingResponse,
  CastVoteResponse,
  ElectionResult,
  ResultsOverview,
  VoterReceipt,
  AuditLog,
  DashboardData,
  AdminUser,
} from '../types';

const apiBase = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api';

export const api = axios.create({
  baseURL: apiBase,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname.startsWith('/admin')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/admin/login') {
        window.location.href = '/admin/login';
      }
    }
    return Promise.reject(error);
  }
);

// ── AUTH ──
export const authService = {
  login: async (email: string, password: string): Promise<{ token: string; user: AdminUser }> => {
    const res = await api.post('/auth/login', { email, password });
    return res.data;
  },
  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },
  me: async (): Promise<{ user: AdminUser }> => {
    const res = await api.get('/auth/me');
    return res.data;
  },
};

// ── VOTING (PÚBLICO) ──
export const votingApi = {
  getActiveElection: async (): Promise<Election> => {
    const res = await api.get('/voting/election/active');
    return res.data;
  },
  startVoting: async (data: {
    electionId: string;
    discordName: string;
    rpgName: string;
    stateId: string;
  }): Promise<StartVotingResponse> => {
    const res = await api.post('/voting/start', data);
    return res.data;
  },
  getSession: async (sessionId: string): Promise<any> => {
    const res = await api.get(`/voting/session/${sessionId}`);
    return res.data;
  },
  findCandidate: async (params: {
    number: string;
    electionPositionId: string;
    stateId: string;
    sessionId: string;
  }): Promise<{ candidate: Candidate | null }> => {
    const res = await api.get('/voting/candidate', { params });
    return res.data;
  },
  castVote: async (data: {
    sessionId: string;
    electionPositionId: string;
    slot: number;
    type: 'VALID' | 'BLANK' | 'NULL';
    candidateId?: string | null;
  }): Promise<CastVoteResponse> => {
    const res = await api.post('/voting/vote', data);
    return res.data;
  },
};

// ── ELECTIONS (ADMIN) ──
export const electionsApi = {
  getAll: async (): Promise<Election[]> => {
    const res = await api.get('/elections');
    return res.data;
  },
  getById: async (id: string): Promise<Election> => {
    const res = await api.get(`/elections/${id}`);
    return res.data;
  },
  create: async (data: Partial<Election> & { stateIds?: string[] }): Promise<Election> => {
    const res = await api.post('/elections', data);
    return res.data;
  },
  update: async (id: string, data: Partial<Election> & { stateIds?: string[] }): Promise<Election> => {
    const res = await api.put(`/elections/${id}`, data);
    return res.data;
  },
  updateStatus: async (id: string, status: string): Promise<Election> => {
    const res = await api.put(`/elections/${id}/status`, { status });
    return res.data;
  },
  toggleValidateIp: async (id: string, validateIp: boolean): Promise<Election> => {
    const res = await api.patch(`/elections/${id}/validate-ip`, { validateIp });
    return res.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/elections/${id}`);
  },
};

// ── POSITIONS (ADMIN) ──
export const positionsApi = {
  getBasePositions: async (): Promise<Position[]> => {
    const res = await api.get('/positions');
    return res.data;
  },
  createBasePosition: async (data: {
    name: string;
    description?: string;
    scope: 'NACIONAL' | 'ESTADUAL' | 'MUNICIPAL';
    defaultDigitCount: number;
    defaultSlots: number;
  }): Promise<Position> => {
    const res = await api.post('/positions', data);
    return res.data;
  },
  updateBasePosition: async (id: string, data: Partial<Position>): Promise<Position> => {
    const res = await api.put(`/positions/base/${id}`, data);
    return res.data;
  },
  deleteBasePosition: async (id: string): Promise<void> => {
    await api.delete(`/positions/base/${id}`);
  },
  getElectionPositions: async (electionId: string): Promise<ElectionPosition[]> => {
    const res = await api.get(`/positions/election/${electionId}`);
    return res.data;
  },
  addElectionPosition: async (
    electionId: string,
    data: {
      positionId: string;
      order: number;
      slots: number;
      digitCount: number;
      isNational: boolean;
    }
  ): Promise<ElectionPosition> => {
    const res = await api.post(`/positions/election/${electionId}`, data);
    return res.data;
  },
  reorder: async (
    electionId: string,
    positions: { id: string; order: number }[]
  ): Promise<void> => {
    await api.put(`/positions/election/${electionId}/reorder`, { positions });
  },
  updateElectionPosition: async (
    id: string,
    data: Partial<{
      order: number;
      slots: number;
      digitCount: number;
      isNational: boolean;
      isActive: boolean;
    }>
  ): Promise<ElectionPosition> => {
    const res = await api.put(`/positions/${id}`, data);
    return res.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/positions/${id}`);
  },
};

// ── CANDIDATES (ADMIN) ──
export const candidatesApi = {
  getAll: async (params?: {
    electionId?: string;
    positionId?: string;
    stateId?: string;
    party?: string;
    search?: string;
  }): Promise<Candidate[]> => {
    const res = await api.get('/candidates', { params });
    return res.data;
  },
  getParties: async (electionId?: string): Promise<string[]> => {
    const res = await api.get('/candidates/parties', { params: { electionId } });
    return res.data;
  },
  create: async (formData: FormData): Promise<Candidate> => {
    const res = await api.post('/candidates', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  update: async (id: string, formData: FormData): Promise<Candidate> => {
    const res = await api.put(`/candidates/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/candidates/${id}`);
  },
};

// ── STATES ──
export const statesApi = {
  getActive: async (): Promise<State[]> => {
    const res = await api.get('/states');
    return res.data;
  },
  getAll: async (): Promise<State[]> => {
    const res = await api.get('/states/all');
    return res.data;
  },
  update: async (id: string, data: Partial<State>): Promise<State> => {
    const res = await api.put(`/states/${id}`, data);
    return res.data;
  },
};

// ── VOTERS (ADMIN) ──
export const votersApi = {
  getByElection: async (
    electionId: string,
    params?: { status?: string; stateId?: string; search?: string; page?: number; limit?: number }
  ): Promise<{ voters: VoterSession[]; pagination: { total: number; page: number; limit: number; pages: number } }> => {
    const res = await api.get(`/voters/${electionId}`, { params });
    return res.data;
  },
  getByState: async (electionId: string): Promise<{ byState: any[]; totalVoters: number }> => {
    const res = await api.get(`/voters/${electionId}/by-state`);
    return res.data;
  },
  getReceipt: async (sessionId: string): Promise<VoterReceipt> => {
    const res = await api.get(`/voters/receipt/${sessionId}`);
    return res.data;
  },
};

// ── RESULTS (ADMIN) ──
export const resultsApi = {
  getResults: async (
    electionId: string,
    stateId?: string
  ): Promise<{
    election: { id: string; name: string; status: string };
    overview: ResultsOverview;
    results: ElectionResult[];
  }> => {
    const res = await api.get(`/results/${electionId}`, { params: { stateId } });
    return res.data;
  },
  getSummary: async (
    electionId: string
  ): Promise<{ totalVoters: number; inProgress: number; totalVotes: number }> => {
    const res = await api.get(`/results/${electionId}/summary`);
    return res.data;
  },
};

// ── AUDIT (ADMIN) ──
export const auditApi = {
  getByElection: async (
    electionId: string,
    params?: { eventType?: string; page?: number; limit?: number }
  ): Promise<{ logs: AuditLog[]; pagination: { total: number; page: number; limit: number; pages: number } }> => {
    const res = await api.get(`/audit/${electionId}`, { params });
    return res.data;
  },
  getGlobal: async (params?: {
    page?: number;
    limit?: number;
  }): Promise<{ logs: AuditLog[]; pagination: { total: number; page: number; limit: number; pages: number } }> => {
    const res = await api.get('/audit', { params });
    return res.data;
  },
};

// ── DASHBOARD (ADMIN) ──
export const dashboardApi = {
  getDashboard: async (): Promise<DashboardData> => {
    const res = await api.get('/dashboard');
    return res.data;
  },
};
