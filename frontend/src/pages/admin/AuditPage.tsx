import React, { useEffect, useState } from 'react';
import { auditApi, electionsApi } from '../../services/api';
import { AuditLog, Election } from '../../types';
import { RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    electionsApi
      .getAll()
      .then((elecs) => {
        setElections(elecs);
      })
      .catch((err) => {
        console.error('Erro ao listar eleições:', err);
      });
  }, []);

  const fetchLogs = () => {
    setLoading(true);
    const req = selectedElectionId
      ? auditApi.getByElection(selectedElectionId, { eventType: eventTypeFilter || undefined })
      : auditApi.getGlobal();

    req
      .then((data) => setLogs(data.logs))
      .catch(() => toast.error('Erro ao buscar logs de auditoria'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedElectionId, eventTypeFilter]);

  const getEventBadge = (eventType: string) => {
    if (eventType.includes('ATTEMPT') || eventType.includes('FAIL')) {
      return (
        <span
          style={{
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            fontSize: '0.7rem',
            fontWeight: 700,
            background: 'rgba(239, 68, 68, 0.2)',
            color: '#f87171',
          }}
        >
          ⚠️ {eventType}
        </span>
      );
    }
    if (eventType.includes('COMPLETED') || eventType.includes('SUCCESS')) {
      return (
        <span
          style={{
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            fontSize: '0.7rem',
            fontWeight: 700,
            background: 'rgba(34, 197, 94, 0.2)',
            color: '#4ade80',
          }}
        >
          ✓ {eventType}
        </span>
      );
    }
    return (
      <span
        style={{
          padding: '0.2rem 0.5rem',
          borderRadius: '4px',
          fontSize: '0.7rem',
          fontWeight: 700,
          background: '#334155',
          color: '#cbd5e1',
        }}
      >
        {eventType}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white' }}>Trilha de Auditoria & Segurança</h1>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Registro imutável de todas as ações de administradores, votações e tentativas irregulares
          </p>
        </div>

        <button
          onClick={fetchLogs}
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
          Atualizar Logs
        </button>
      </div>

      {/* Filtros */}
      <div className="admin-card" style={{ padding: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 250px' }}>
          <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>
            FILTRAR POR ELEIÇÃO
          </label>
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
            <option value="">Todas as Eleições (Global)</option>
            {elections.map((elec) => (
              <option key={elec.id} value={elec.id}>
                {elec.name} ({elec.year})
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: '1 1 220px' }}>
          <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>
            TIPO DE EVENTO
          </label>
          <select
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
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
            <option value="">Todos os eventos</option>
            <option value="DUPLICATE_VOTE_ATTEMPT">Tentativa de Voto Duplicado</option>
            <option value="DUPLICATE_CANDIDATE_ATTEMPT">Tentativa de Candidato Duplicado</option>
            <option value="VOTER_SESSION_STARTED">Sessão de Voto Iniciada</option>
            <option value="VOTER_SESSION_COMPLETED">Voto Concluído</option>
            <option value="ADMIN_LOGIN">Login Administrativo</option>
            <option value="ELECTION_STATUS_CHANGED">Mudança de Status da Eleição</option>
          </select>
        </div>
      </div>

      {/* Tabela de Auditoria */}
      <div className="admin-card">
        <div className="admin-table-wrapper admin-table-desktop">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Data & Hora</th>
                <th>Tipo de Evento</th>
                <th>Descrição do Evento</th>
                <th>Origem / IP</th>
                <th>Responsável / Admin</th>
                <th style={{ textAlign: 'right' }}>Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                    Carregando registros de auditoria...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    Nenhum registro de auditoria encontrado.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', color: '#cbd5e1' }}>
                          {new Date(log.createdAt).toLocaleString('pt-BR')}
                        </td>
                        <td>{getEventBadge(log.eventType)}</td>
                        <td>
                          <span style={{ color: 'white' }}>{log.description}</span>
                        </td>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#94a3b8' }}>
                            {log.ip || '-'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                          {log.adminUser ? log.adminUser.name || log.adminUser.email : 'Sistema'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {log.metadata && Object.keys(log.metadata).length > 0 ? (
                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              style={{
                                padding: '0.25rem 0.5rem',
                                background: '#334155',
                                color: '#60a5fa',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                              }}
                            >
                              {isExpanded ? 'Ocultar' : 'Metadados'}
                            </button>
                          ) : (
                            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>-</span>
                          )}
                        </td>
                      </tr>

                      {isExpanded && log.metadata && (
                        <tr>
                          <td colSpan={6} style={{ background: '#090d16', padding: '1rem 1.5rem' }}>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>
                              Metadados técnicos do evento (JSON):
                            </div>
                            <pre
                              style={{
                                background: '#0f172a',
                                border: '1px solid #334155',
                                borderRadius: '6px',
                                padding: '0.75rem',
                                color: '#a5b4fc',
                                fontSize: '0.75rem',
                                overflowX: 'auto',
                                margin: 0,
                              }}
                            >
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Visualização em Cards para Celular */}
        <div className="admin-cards-mobile">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
              Carregando registros de auditoria...
            </div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              Nenhum registro de auditoria encontrado.
            </div>
          ) : (
            logs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              return (
                <div key={log.id} className="admin-mobile-card">
                  <div className="admin-mobile-card-header">
                    <div>{getEventBadge(log.eventType)}</div>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {new Date(log.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </div>

                  <div>
                    <strong style={{ color: 'white', fontSize: '0.9rem', display: 'block' }}>
                      {log.description}
                    </strong>
                  </div>

                  <div className="admin-mobile-card-grid">
                    <div className="admin-mobile-card-field">
                      <span className="admin-mobile-card-label">ORIGEM / IP</span>
                      <span className="admin-mobile-card-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#94a3b8' }}>
                        {log.ip || '-'}
                      </span>
                    </div>
                    <div className="admin-mobile-card-field">
                      <span className="admin-mobile-card-label">RESPONSÁVEL</span>
                      <span className="admin-mobile-card-value">
                        {log.adminUser ? log.adminUser.name || log.adminUser.email : 'Sistema'}
                      </span>
                    </div>
                  </div>

                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <div className="admin-mobile-card-actions">
                      <button
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        style={{
                          padding: '0.35rem 0.6rem',
                          background: '#334155',
                          color: '#60a5fa',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          width: '100%',
                        }}
                      >
                        {isExpanded ? 'Ocultar Metadados' : 'Ver Metadados'}
                      </button>
                    </div>
                  )}

                  {isExpanded && log.metadata && (
                    <pre
                      style={{
                        background: '#090d16',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        padding: '0.65rem',
                        color: '#a5b4fc',
                        fontSize: '0.7rem',
                        overflowX: 'auto',
                        margin: 0,
                      }}
                    >
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
