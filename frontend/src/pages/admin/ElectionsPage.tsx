import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { electionsApi, statesApi, positionsApi } from '../../services/api';
import { Election, State, Position, ElectionStatus } from '../../types';
import { Plus, Play, Pause, Square, Trash2, Settings, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

export const ElectionsPage: React.FC = () => {
  const [elections, setElections] = useState<Election[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [basePositions, setBasePositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // New election form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [round, setRound] = useState<1 | 2>(1);
  const [showResultsDuringVoting, setShowResultsDuringVoting] = useState(false);
  const [validateIp, setValidateIp] = useState(true);
  const [selectedStateIds, setSelectedStateIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // 2º Turno Disputas
  const [nationalDisputeIds, setNationalDisputeIds] = useState<string[]>([]);
  const [stateDisputes, setStateDisputes] = useState<Record<string, string[]>>({});
  const [expandedPositionId, setExpandedPositionId] = useState<string | null>(null);

  const fetchElections = () => {
    setLoading(true);
    Promise.all([electionsApi.getAll(), statesApi.getActive(), positionsApi.getBasePositions()])
      .then(([elecs, sts, bPositions]) => {
        setElections(elecs);
        setStates(sts);
        setBasePositions(bPositions);
        setSelectedStateIds(sts.map((s) => s.id)); // Padrão: todos os estados
      })
      .catch(() => toast.error('Erro ao listar eleições'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchElections();
  }, []);

  const nationalPositions = basePositions.filter(
    (p) => p.scope === 'NACIONAL' || p.isNational || ['Presidente', 'Vice-Presidente'].includes(p.name)
  );
  const statePositions = basePositions.filter(
    (p) => !nationalPositions.some((np) => np.id === p.id)
  );

  const toggleNationalDispute = (posId: string) => {
    setNationalDisputeIds((prev) =>
      prev.includes(posId) ? prev.filter((id) => id !== posId) : [...prev, posId]
    );
  };

  const toggleStateDispute = (posId: string, stateId: string) => {
    setStateDisputes((prev) => {
      const current = prev[posId] || [];
      const updated = current.includes(stateId)
        ? current.filter((id) => id !== stateId)
        : [...current, stateId];
      return { ...prev, [posId]: updated };
    });
  };

  const selectAllStatesForPosition = (posId: string) => {
    setStateDisputes((prev) => ({
      ...prev,
      [posId]: states.map((s) => s.id),
    }));
  };

  const clearStatesForPosition = (posId: string) => {
    setStateDisputes((prev) => ({
      ...prev,
      [posId]: [],
    }));
  };

  const selectAllDisputes = () => {
    setNationalDisputeIds(nationalPositions.map((p) => p.id));
    const allSt: Record<string, string[]> = {};
    for (const p of statePositions) {
      allSt[p.id] = states.map((s) => s.id);
    }
    setStateDisputes(allSt);
  };

  const clearAllDisputes = () => {
    setNationalDisputeIds([]);
    setStateDisputes({});
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Informe o nome da eleição');
      return;
    }

    if (round === 2) {
      const hasNational = nationalDisputeIds.length > 0;
      const hasState = Object.values(stateDisputes).some((stList) => stList.length > 0);
      if (!hasNational && !hasState) {
        toast.error('Uma eleição de 2º turno deve ter pelo menos uma disputa configurada (cargo nacional ou ao menos um estado com disputa estadual).');
        return;
      }
    } else if (selectedStateIds.length === 0) {
      toast.error('Selecione pelo menos um estado participante');
      return;
    }

    const disputesPayload = round === 2
      ? {
          nationalPositionIds: nationalDisputeIds,
          stateDisputes: Object.entries(stateDisputes)
            .filter(([_, sIds]) => sIds.length > 0)
            .map(([positionId, stateIds]) => ({ positionId, stateIds })),
        }
      : undefined;

    setSubmitting(true);
    try {
      await electionsApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        year: Number(year),
        round,
        showResultsDuringVoting,
        validateIp,
        stateIds: selectedStateIds,
        disputes: disputesPayload,
      });

      toast.success(round === 2 ? 'Eleição de 2º Turno criada com sucesso!' : 'Eleição criada com sucesso!');
      setShowModal(false);
      setName('');
      setDescription('');
      setRound(1);
      setNationalDisputeIds([]);
      setStateDisputes({});
      fetchElections();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao criar eleição');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: ElectionStatus) => {
    try {
      await electionsApi.updateStatus(id, newStatus);
      toast.success(`Status da eleição alterado para ${newStatus}`);
      fetchElections();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao alterar status');
    }
  };

  const handleToggleValidateIp = async (id: string, current: boolean) => {
    try {
      await electionsApi.toggleValidateIp(id, !current);
      toast.success(!current ? '🛡️ Verificação de IP ativada (1 voto por IP)' : '⚡ Modo Teste ativado (IP liberado)');
      fetchElections();
    } catch {
      toast.error('Erro ao alternar verificação de IP');
    }
  };

  const handleDelete = async (id: string, name: string, status: string) => {
    if (status === 'OPEN' || status === 'PAUSED') {
      toast.error('Não é possível excluir uma eleição em andamento ou pausada. Encerre-a primeiro.');
      return;
    }

    const confirmMsg =
      status === 'CLOSED'
        ? `ATENÇÃO: A eleição "${name}" está ENCERRADA. Ao excluí-la, todos os votos, eleitores e candidatos cadastrados nesta eleição serão PERMANENTEMENTE excluídos. Deseja realmente prosseguir?`
        : `Tem certeza que deseja remover o rascunho da eleição "${name}"? Esta ação é irreversível.`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      await electionsApi.delete(id);
      toast.success('Eleição e dados relacionados excluídos com sucesso');
      fetchElections();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao remover eleição');
    }
  };

  const toggleSelectAllStates = () => {
    if (selectedStateIds.length === states.length) {
      setSelectedStateIds([]);
    } else {
      setSelectedStateIds(states.map((s) => s.id));
    }
  };

  const getStatusBadge = (status: ElectionStatus) => {
    switch (status) {
      case 'OPEN':
        return <span style={{ padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80' }}>● ABERTA</span>;
      case 'PAUSED':
        return <span style={{ padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(234, 179, 8, 0.2)', color: '#facc15' }}>❚❚ PAUSADA</span>;
      case 'CLOSED':
        return <span style={{ padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }}>■ ENCERRADA</span>;
      case 'SCHEDULED':
        return <span style={{ padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}>AGENDADA</span>;
      default:
        return <span style={{ padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, background: '#334155', color: '#94a3b8' }}>RASCUNHO</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white' }}>Gestão de Eleições</h1>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Crie novos pleitos, altere status de votação e gerencie cargos/candidatos
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 1.25rem',
            background: 'linear-gradient(135deg, #1e3d5e, #1565c0)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
        >
          <Plus size={18} /> Nova Eleição
        </button>
      </div>

      {/* Tabela de Eleições */}
      <div className="admin-card">
        <div className="admin-table-wrapper admin-table-desktop">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nome do Pleito</th>
                <th>Ano</th>
                <th>Status</th>
                <th>Verificação IP</th>
                <th>Cargos</th>
                <th>Candidatos</th>
                <th>Votantes</th>
                <th style={{ textAlign: 'right', minWidth: '150px', whiteSpace: 'nowrap' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                    Carregando eleições...
                  </td>
                </tr>
              ) : elections.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    Nenhuma eleição cadastrada. Clique em "Nova Eleição" acima.
                  </td>
                </tr>
              ) : (
                elections.map((elec) => (
                  <tr key={elec.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2px', flexWrap: 'wrap' }}>
                        <strong style={{ color: 'white' }}>{elec.name}</strong>
                        {elec.round === 2 ? (
                          <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 800, background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                            2º TURNO
                          </span>
                        ) : (
                          <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 800, background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.4)' }}>
                            1º TURNO
                          </span>
                        )}
                      </div>
                      {elec.description && (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{elec.description}</span>
                      )}
                    </td>
                    <td>{elec.year}</td>
                    <td>{getStatusBadge(elec.status)}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleToggleValidateIp(elec.id, elec.validateIp !== false)}
                        title="Clique para alternar: 1 Voto por IP vs Modo Teste (múltiplos votos liberados)"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                        }}
                      >
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            background: elec.validateIp !== false ? 'rgba(59, 130, 246, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                            color: elec.validateIp !== false ? '#60a5fa' : '#facc15',
                          }}
                        >
                          {elec.validateIp !== false ? '🛡️ 1 VOTO/IP' : '⚡ MODO TESTE'}
                        </span>
                      </button>
                    </td>
                    <td>{elec._count?.electionPositions ?? 0}</td>
                    <td>{elec._count?.candidates ?? 0}</td>
                    <td>{elec._count?.voterSessions ?? 0}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap', minWidth: '150px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem', whiteSpace: 'nowrap' }}>
                        {/* Controle de Status */}
                        {elec.status === 'DRAFT' || elec.status === 'PAUSED' ? (
                          <button
                            title="Abrir Votação"
                            onClick={() => handleStatusChange(elec.id, 'OPEN')}
                            style={{
                              padding: '0.35rem 0.6rem',
                              background: 'rgba(34, 197, 94, 0.2)',
                              color: '#4ade80',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                            }}
                          >
                            <Play size={14} />
                          </button>
                        ) : null}

                        {elec.status === 'OPEN' ? (
                          <>
                            <button
                              title="Pausar Votação"
                              onClick={() => handleStatusChange(elec.id, 'PAUSED')}
                              style={{
                                padding: '0.35rem 0.6rem',
                                background: 'rgba(234, 179, 8, 0.2)',
                                color: '#facc15',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                              }}
                            >
                              <Pause size={14} />
                            </button>
                            <button
                              title="Encerrar Votação"
                              onClick={() => handleStatusChange(elec.id, 'CLOSED')}
                              style={{
                                padding: '0.35rem 0.6rem',
                                background: 'rgba(239, 68, 68, 0.2)',
                                color: '#f87171',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                              }}
                            >
                              <Square size={14} />
                            </button>
                          </>
                        ) : null}

                        <Link
                          to={`/admin/eleicoes/${elec.id}`}
                          title="Detalhes e Configuração"
                          style={{
                            padding: '0.35rem 0.6rem',
                            background: '#334155',
                            color: '#e2e8f0',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                        >
                          <Settings size={14} />
                        </Link>

                        <button
                          title="Remover"
                          onClick={() => handleDelete(elec.id, elec.name, elec.status)}
                          style={{
                            padding: '0.35rem 0.6rem',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Visualização em Cards para Celular */}
        <div className="admin-cards-mobile">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
              Carregando eleições...
            </div>
          ) : elections.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              Nenhuma eleição cadastrada. Clique em "Nova Eleição" acima.
            </div>
          ) : (
            elections.map((elec) => (
              <div key={elec.id} className="admin-mobile-card">
                <div className="admin-mobile-card-header">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '2px', flexWrap: 'wrap' }}>
                      <strong style={{ color: 'white', fontSize: '1rem' }}>{elec.name}</strong>
                      {elec.round === 2 ? (
                        <span style={{ padding: '0.12rem 0.45rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800, background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
                          2º TURNO
                        </span>
                      ) : (
                        <span style={{ padding: '0.12rem 0.45rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800, background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.4)' }}>
                          1º TURNO
                        </span>
                      )}
                    </div>
                    {elec.description && (
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{elec.description}</span>
                    )}
                  </div>
                  <div>{getStatusBadge(elec.status)}</div>
                </div>

                <div className="admin-mobile-card-grid">
                  <div className="admin-mobile-card-field">
                    <span className="admin-mobile-card-label">ANO</span>
                    <span className="admin-mobile-card-value">{elec.year}</span>
                  </div>
                  <div className="admin-mobile-card-field">
                    <span className="admin-mobile-card-label">VERIFICAÇÃO IP</span>
                    <div>
                      <button
                        type="button"
                        onClick={() => handleToggleValidateIp(elec.id, elec.validateIp !== false)}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                      >
                        <span
                          style={{
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            background: elec.validateIp !== false ? 'rgba(59, 130, 246, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                            color: elec.validateIp !== false ? '#60a5fa' : '#facc15',
                          }}
                        >
                          {elec.validateIp !== false ? '🛡️ 1 VOTO/IP' : '⚡ MODO TESTE'}
                        </span>
                      </button>
                    </div>
                  </div>
                  <div className="admin-mobile-card-field">
                    <span className="admin-mobile-card-label">CARGOS</span>
                    <span className="admin-mobile-card-value">{elec._count?.electionPositions ?? 0}</span>
                  </div>
                  <div className="admin-mobile-card-field">
                    <span className="admin-mobile-card-label">CANDIDATOS</span>
                    <span className="admin-mobile-card-value">{elec._count?.candidates ?? 0}</span>
                  </div>
                  <div className="admin-mobile-card-field">
                    <span className="admin-mobile-card-label">VOTANTES</span>
                    <span className="admin-mobile-card-value">{elec._count?.voterSessions ?? 0}</span>
                  </div>
                </div>

                <div className="admin-mobile-card-actions">
                  {elec.status === 'DRAFT' || elec.status === 'PAUSED' ? (
                    <button
                      title="Abrir Votação"
                      onClick={() => handleStatusChange(elec.id, 'OPEN')}
                      style={{
                        padding: '0.4rem 0.75rem',
                        background: 'rgba(34, 197, 94, 0.2)',
                        color: '#4ade80',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                      }}
                    >
                      <Play size={14} /> Abrir
                    </button>
                  ) : null}

                  {elec.status === 'OPEN' ? (
                    <>
                      <button
                        title="Pausar Votação"
                        onClick={() => handleStatusChange(elec.id, 'PAUSED')}
                        style={{
                          padding: '0.35rem 0.6rem',
                          background: 'rgba(234, 179, 8, 0.2)',
                          color: '#facc15',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        <Pause size={14} /> Pausar
                      </button>
                      <button
                        title="Encerrar Votação"
                        onClick={() => handleStatusChange(elec.id, 'CLOSED')}
                        style={{
                          padding: '0.35rem 0.6rem',
                          background: 'rgba(239, 68, 68, 0.2)',
                          color: '#f87171',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        <Square size={14} /> Encerrar
                      </button>
                    </>
                  ) : null}

                  <Link
                    to={`/admin/eleicoes/${elec.id}`}
                    title="Detalhes e Configuração"
                    style={{
                      padding: '0.35rem 0.6rem',
                      background: '#334155',
                      color: '#e2e8f0',
                      borderRadius: '6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    <Settings size={14} /> Config
                  </Link>

                  <button
                    title="Remover"
                    onClick={() => handleDelete(elec.id, elec.name, elec.status)}
                    style={{
                      padding: '0.35rem 0.6rem',
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#ef4444',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal Nova Eleição */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            className="animate-fade-in-scale"
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.75rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white' }}>Criar Nova Eleição</h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Seleção Explícita de Turno */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '6px' }}>
                  TURNO DA ELEIÇÃO *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setRound(1);
                      if (name.includes('2º Turno')) setName(name.replace('2º Turno', '1º Turno'));
                    }}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: `2px solid ${round === 1 ? '#3b82f6' : '#334155'}`,
                      background: round === 1 ? 'rgba(59, 130, 246, 0.15)' : '#0f172a',
                      color: round === 1 ? '#60a5fa' : '#94a3b8',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <span>1º Turno</span>
                    <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: '#334155', color: '#cbd5e1' }}>Padrão</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRound(2);
                      if (name.includes('1º Turno')) setName(name.replace('1º Turno', '2º Turno'));
                      else if (!name.includes('2º Turno')) setName(name ? `${name} - 2º Turno` : 'Eleições Gerais - 2º Turno');
                    }}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: `2px solid ${round === 2 ? '#f59e0b' : '#334155'}`,
                      background: round === 2 ? 'rgba(245, 158, 11, 0.15)' : '#0f172a',
                      color: round === 2 ? '#fbbf24' : '#94a3b8',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <span>2º Turno</span>
                    <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.25)', color: '#fbbf24' }}>Disputa Seletiva</span>
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                  NOME DA ELEIÇÃO *
                </label>
                <input
                  type="text"
                  placeholder={round === 2 ? 'Ex: Eleições Gerais 2026 - 2º Turno' : 'Ex: Eleições Gerais 2026 - 1º Turno'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: 'white',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                  DESCRIÇÃO / OBSERVAÇÕES
                </label>
                <textarea
                  placeholder="Ex: Pleito eleitoral do RPG para cargos e estados configurados"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: 'white',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                    ANO DO PLEITO
                  </label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: 'white',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', paddingTop: '1.25rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', color: '#cbd5e1' }}>
                    <input
                      type="checkbox"
                      checked={showResultsDuringVoting}
                      onChange={(e) => setShowResultsDuringVoting(e.target.checked)}
                      style={{ width: '16px', height: '16px' }}
                    />
                    Exibir apuração parcial durante a votação
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', color: '#cbd5e1' }}>
                  <input
                    type="checkbox"
                    checked={validateIp}
                    onChange={(e) => setValidateIp(e.target.checked)}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <span>
                    <strong>Verificar IP único</strong> (desmarque se for usar em <strong>modo de testes</strong> para permitir múltiplos votos da mesma rede/máquina)
                  </span>
                </label>
              </div>

              {/* SELEÇÃO DE DISPUTAS PARA O 2º TURNO */}
              {round === 2 ? (
                <div
                  style={{
                    background: '#0a0f1d',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    borderRadius: '12px',
                    padding: '1.1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.6rem' }}>
                    <div>
                      <h3 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#fbbf24', margin: 0 }}>
                        Configuração de Disputas do 2º Turno
                      </h3>
                      <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '2px 0 0 0' }}>
                        Selecione quais cargos e estados participarão deste 2º turno.
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={selectAllDisputes}
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem', background: '#1e293b', color: '#60a5fa', border: '1px solid #334155', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Selecionar Todas
                      </button>
                      <button
                        type="button"
                        onClick={clearAllDisputes}
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Limpar Seleção
                      </button>
                    </div>
                  </div>

                  {/* Cargos Nacionais */}
                  {nationalPositions.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.73rem', fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase' }}>
                        Cargos Nacionais (Votação em todo o país)
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {nationalPositions.map((pos) => {
                          const isChecked = nationalDisputeIds.includes(pos.id);
                          return (
                            <label
                              key={pos.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.55rem 0.75rem',
                                background: isChecked ? 'rgba(59, 130, 246, 0.15)' : '#1e293b',
                                border: `1px solid ${isChecked ? '#3b82f6' : '#334155'}`,
                                borderRadius: '8px',
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleNationalDispute(pos.id)}
                                  style={{ width: '16px', height: '16px' }}
                                />
                                <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'white' }}>{pos.name}</span>
                              </div>
                              <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', borderRadius: '4px', fontWeight: 700 }}>
                                NACIONAL
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Cargos Estaduais com seleção seletiva */}
                  {statePositions.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <span style={{ fontSize: '0.73rem', fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase' }}>
                        Cargos Estaduais (Seleção Seletiva por Estado)
                      </span>
                      {statePositions.map((pos) => {
                        const selectedStates = stateDisputes[pos.id] || [];
                        const isExpanded = expandedPositionId === pos.id;
                        return (
                          <div
                            key={pos.id}
                            style={{
                              background: '#1e293b',
                              border: `1px solid ${selectedStates.length > 0 ? '#38bdf8' : '#334155'}`,
                              borderRadius: '8px',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              onClick={() => setExpandedPositionId(isExpanded ? null : pos.id)}
                              style={{
                                padding: '0.55rem 0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                background: selectedStates.length > 0 ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ color: '#94a3b8' }}>{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
                                <strong style={{ fontSize: '0.82rem', color: 'white' }}>{pos.name}</strong>
                                <span style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem', background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', borderRadius: '4px' }}>
                                  ESTADUAL
                                </span>
                              </div>
                              <span style={{ fontSize: '0.73rem', fontWeight: 700, color: selectedStates.length > 0 ? '#38bdf8' : '#64748b' }}>
                                {selectedStates.length} de {states.length} estados
                              </span>
                            </div>

                            {/* Detalhamento de Estados */}
                            {isExpanded && (
                              <div style={{ padding: '0.75rem', borderTop: '1px solid #334155', background: '#0f172a' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                    Marque os estados onde haverá 2º turno para {pos.name}:
                                  </span>
                                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                                    <button
                                      type="button"
                                      onClick={() => selectAllStatesForPosition(pos.id)}
                                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.68rem', background: '#334155', color: '#60a5fa', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                      Todos
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => clearStatesForPosition(pos.id)}
                                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.68rem', background: '#334155', color: '#94a3b8', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                      Nenhum
                                    </button>
                                  </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(65px, 1fr))', gap: '0.3rem' }}>
                                  {states.map((st) => {
                                    const isStSelected = selectedStates.includes(st.id);
                                    return (
                                      <button
                                        type="button"
                                        key={st.id}
                                        onClick={() => toggleStateDispute(pos.id, st.id)}
                                        style={{
                                          padding: '0.25rem 0.35rem',
                                          background: isStSelected ? 'rgba(56, 189, 248, 0.25)' : '#1e293b',
                                          border: `1px solid ${isStSelected ? '#38bdf8' : '#334155'}`,
                                          borderRadius: '4px',
                                          color: isStSelected ? 'white' : '#94a3b8',
                                          fontSize: '0.72rem',
                                          cursor: 'pointer',
                                          fontWeight: isStSelected ? 700 : 400,
                                        }}
                                      >
                                        {st.abbreviation}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* Estados Participantes para 1º Turno */
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1' }}>
                      ESTADOS PARTICIPANTES ({selectedStateIds.length}/{states.length})
                    </label>
                    <button
                      type="button"
                      onClick={toggleSelectAllStates}
                      style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      {selectedStateIds.length === states.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                    </button>
                  </div>

                  <div
                    style={{
                      maxHeight: '130px',
                      overflowY: 'auto',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      padding: '0.5rem',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                      gap: '0.35rem',
                    }}
                  >
                    {states.map((st) => {
                      const isSelected = selectedStateIds.includes(st.id);
                      return (
                        <button
                          type="button"
                          key={st.id}
                          onClick={() => {
                            setSelectedStateIds((prev) =>
                              prev.includes(st.id) ? prev.filter((id) => id !== st.id) : [...prev, st.id]
                            );
                          }}
                          style={{
                            padding: '0.3rem 0.4rem',
                            background: isSelected ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
                            border: `1px solid ${isSelected ? '#3b82f6' : '#334155'}`,
                            borderRadius: '4px',
                            color: isSelected ? 'white' : '#94a3b8',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          {st.abbreviation}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '0.65rem 1.25rem',
                    background: '#334155',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '0.65rem 1.5rem',
                    background: 'linear-gradient(135deg, #1e3d5e, #1565c0)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {submitting ? 'Criando...' : 'Salvar Eleição'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
