import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi, electionsApi } from '../../services/api';
import { DashboardData } from '../../types';
import { Users, CheckCircle, Clock, Vote, RefreshCw, BarChart2, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = () => {
    setLoading(true);
    dashboardApi
      .getDashboard()
      .then(setData)
      .catch(() => toast.error('Erro ao carregar dados do painel'))
      .finally(() => setLoading(false));
  };

  const handleToggleValidateIp = async () => {
    if (!data?.election) return;
    const nextState = data.election.validateIp === false ? true : false;
    try {
      await electionsApi.toggleValidateIp(data.election.id, nextState);
      setData((prev) =>
        prev && prev.election
          ? { ...prev, election: { ...prev.election, validateIp: nextState } }
          : prev
      );
      toast.success(
        nextState
          ? '🛡️ Verificação de IP ATIVADA (1 voto por IP)'
          : '⚡ Modo Teste ATIVADO (múltiplos votos por IP permitidos)'
      );
    } catch {
      toast.error('Erro ao alternar verificação de IP');
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 15000); // Polling a cada 15s
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return <div style={{ color: '#94a3b8' }}>Carregando dados eleitorais...</div>;
  }

  const { election, stats } = data || {
    election: null,
    stats: { voted: 0, inProgress: 0, totalVotes: 0, totalSessions: 0 },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header com botão de atualizar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white' }}>Painel Geral de Votação</h1>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Acompanhamento em tempo real das eleições e fluxo eleitoral do RPG
          </p>
        </div>
        <button
          onClick={fetchDashboard}
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
          Atualizar Dados
        </button>
      </div>

      {/* Cards de Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="admin-stat-card">
          <div className="admin-stat-icon" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' }}>
            <CheckCircle size={24} />
          </div>
          <div className="admin-stat-value">{stats.voted}</div>
          <div className="admin-stat-label">Eleitores que Votaram</div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#facc15' }}>
            <Clock size={24} />
          </div>
          <div className="admin-stat-value">{stats.inProgress}</div>
          <div className="admin-stat-label">Votações em Andamento</div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
            <Vote size={24} />
          </div>
          <div className="admin-stat-value">{stats.totalVotes}</div>
          <div className="admin-stat-label">Total de Votos Registrados</div>
        </div>

        <div className="admin-stat-card">
          <div className="admin-stat-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
            <Users size={24} />
          </div>
          <div className="admin-stat-value">{stats.totalSessions}</div>
          <div className="admin-stat-label">Sessões Totais Criadas</div>
        </div>
      </div>

      {/* Eleição Ativa */}
      {election ? (
        <div className="admin-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <span
                  style={{
                    padding: '0.25rem 0.65rem',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: election.status === 'OPEN' ? 'rgba(34, 197, 94, 0.2)' : '#334155',
                    color: election.status === 'OPEN' ? '#4ade80' : '#cbd5e1',
                  }}
                >
                  {election.status === 'OPEN' ? '● ELEIÇÃO ABERTA' : election.status}
                </span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white' }}>{election.name}</h2>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                {election.positionsCount} cargos configurados • {election.statesCount} estados participantes
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Link
                to={`/admin/resultados`}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'rgba(59, 130, 246, 0.2)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <BarChart2 size={16} /> Ver Resultados
              </Link>
              <Link
                to={`/admin/eleicoes/${election.id}`}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#334155',
                  color: 'white',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  textDecoration: 'none',
                }}
              >
                Configurar Eleição
              </Link>
            </div>
          </div>

          {/* Banner de Verificação de IP */}
          <div
            style={{
              marginTop: '1.25rem',
              padding: '0.85rem 1.25rem',
              borderRadius: '8px',
              background: election.validateIp !== false ? 'rgba(59, 130, 246, 0.08)' : 'rgba(234, 179, 8, 0.1)',
              border: `1px solid ${election.validateIp !== false ? 'rgba(59, 130, 246, 0.3)' : 'rgba(234, 179, 8, 0.4)'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    color: election.validateIp !== false ? '#60a5fa' : '#facc15',
                  }}
                >
                  {election.validateIp !== false ? '🛡️ Verificação de IP: ATIVADA' : '⚡ Modo de Teste: DESATIVADA (Múltiplos Votos Liberados)'}
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                {election.validateIp !== false
                  ? 'Cada endereço IP só pode votar uma única vez nesta eleição (recomendado para eleições reais).'
                  : 'Você e os testadores podem votar várias vezes da mesma máquina ou rede sem bloqueio.'}
              </p>
            </div>

            <button
              onClick={handleToggleValidateIp}
              style={{
                padding: '0.45rem 0.95rem',
                borderRadius: '6px',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
                background: election.validateIp !== false ? '#d97706' : '#2563eb',
                color: 'white',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              }}
            >
              {election.validateIp !== false ? 'Desativar Verificação (Modo Teste)' : 'Ativar Verificação (Modo Seguro)'}
            </button>
          </div>
        </div>
      ) : (
        <div className="admin-card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>Nenhuma eleição aberta no momento.</p>
          <Link
            to="/admin/eleicoes"
            style={{
              padding: '0.65rem 1.25rem',
              background: '#2563eb',
              color: 'white',
              borderRadius: '8px',
              fontWeight: 600,
            }}
          >
            Criar Nova Eleição
          </Link>
        </div>
      )}

      {/* Progresso de Votos por Cargo */}
      {election && election.positions.length > 0 && (
        <div className="admin-card">
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={18} color="#60a5fa" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'white' }}>Progresso de Votos por Cargo</h3>
          </div>

          <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {election.positions.map((p, idx) => {
              // Total esperado = votantes que concluíram × slots do cargo
              const expectedVotes = stats.voted * p.slots;
              const percent = expectedVotes > 0 ? Math.min(100, Math.round((p.votes / expectedVotes) * 100)) : 0;

              return (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          background: '#0f172a',
                          border: '1px solid #334155',
                          borderRadius: '4px',
                          padding: '0.15rem 0.45rem',
                          fontSize: '0.7rem',
                          color: '#60a5fa',
                          fontWeight: 700,
                        }}
                      >
                        {p.order}º
                      </span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'white' }}>{p.name}</span>
                      {p.slots > 1 && (
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>({p.slots} vagas)</span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                      <strong style={{ color: 'white' }}>{p.votes}</strong> votos registrados
                    </span>
                  </div>
                  <div
                    style={{
                      height: '8px',
                      background: '#1e293b',
                      borderRadius: '999px',
                      border: '1px solid #334155',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${percent}%`,
                        background: 'linear-gradient(90deg, #2563eb, #7c3aed)',
                        borderRadius: '999px',
                        transition: 'width 0.5s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
