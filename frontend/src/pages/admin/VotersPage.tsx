import React, { useEffect, useState } from 'react';
import { votersApi, electionsApi } from '../../services/api';
import { VoterSession, Election } from '../../types';
import { Search, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export const VotersPage: React.FC = () => {
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState('');
  const [voters, setVoters] = useState<VoterSession[]>([]);
  const [byState, setByState] = useState<any[]>([]);
  const [totalVoters, setTotalVoters] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    electionsApi.getAll().then((elecs) => {
      setElections(elecs);
      if (elecs.length > 0) {
        setSelectedElectionId(elecs[0].id);
      }
    });
  }, []);

  const fetchVoters = () => {
    if (!selectedElectionId) return;
    setLoading(true);

    Promise.all([
      votersApi.getByElection(selectedElectionId, {
        search: search || undefined,
        status: statusFilter || undefined,
      }),
      votersApi.getByState(selectedElectionId),
    ])
      .then(([voterData, stateData]) => {
        setVoters(voterData.voters);
        setByState(stateData.byState);
        setTotalVoters(stateData.totalVoters);
      })
      .catch(() => toast.error('Erro ao carregar lista de votantes'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchVoters();
  }, [selectedElectionId, search, statusFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white' }}>Comparecimento & Votantes</h1>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Registro seguro de presença eleitoral (voto secreto e auditável)
          </p>
        </div>

        <button
          onClick={fetchVoters}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: '#334155',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Atualizar Lista
        </button>
      </div>

      {/* Filtros */}
      <div className="admin-card" style={{ padding: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1 1 220px' }}>
          <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>ELEIÇÃO</label>
          <select
            value={selectedElectionId}
            onChange={(e) => setSelectedElectionId(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: 'white',
              fontSize: '0.85rem',
            }}
          >
            {elections.map((elec) => (
              <option key={elec.id} value={elec.id}>
                {elec.name} ({elec.year})
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: '1 1 180px' }}>
          <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>STATUS</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: 'white',
              fontSize: '0.85rem',
            }}
          >
            <option value="">Todos os status</option>
            <option value="VOTED">Voto Concluído</option>
            <option value="IN_PROGRESS">Em Andamento</option>
          </select>
        </div>

        <div style={{ flex: '1 1 250px' }}>
          <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>BUSCAR ELEITOR</label>
          <div style={{ position: 'relative' }}>
            <Search size={16} color="#64748b" style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Buscar por usuário Discord ou nome RPG..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.5rem 0.5rem 2rem',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: 'white',
                fontSize: '0.85rem',
              }}
            />
          </div>
        </div>
      </div>

      {/* Participação por Estado (Top Estados) */}
      {byState.length > 0 && (
        <div className="admin-card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'white', marginBottom: '0.75rem' }}>
            Participação por Estado / UF (Total: {totalVoters} votos computados)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.5rem' }}>
            {byState.slice(0, 10).map((st, i) => (
              <div
                key={i}
                style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '0.5rem 0.75rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: '#60a5fa' }}>{st.state?.abbreviation}</span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{st.percentage}%</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'white', marginTop: '2px' }}>
                  {st.voted} eleitor(es)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabela de Votantes */}
      <div className="admin-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Usuário Discord</th>
                <th>Nome do Personagem RPG</th>
                <th>Estado (UF)</th>
                <th>Status</th>
                <th>Início da Votação</th>
                <th>Conclusão do Voto</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                    Carregando eleitores...
                  </td>
                </tr>
              ) : voters.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    Nenhum eleitor encontrado para esta eleição.
                  </td>
                </tr>
              ) : (
                voters.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <strong style={{ color: 'white' }}>{v.discordName}</strong>
                    </td>
                    <td>{v.rpgName}</td>
                    <td>
                      <span
                        style={{
                          padding: '0.2rem 0.5rem',
                          background: 'rgba(59, 130, 246, 0.15)',
                          color: '#60a5fa',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                        }}
                      >
                        {v.state?.abbreviation || '-'}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          background: v.status === 'VOTED' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                          color: v.status === 'VOTED' ? '#4ade80' : '#facc15',
                        }}
                      >
                        {v.status === 'VOTED' ? 'VOTO CONCLUÍDO' : 'EM ANDAMENTO'}
                      </span>
                    </td>
                    <td style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                      {new Date(v.startedAt).toLocaleString('pt-BR')}
                    </td>
                    <td style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                      {v.completedAt ? new Date(v.completedAt).toLocaleString('pt-BR') : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
