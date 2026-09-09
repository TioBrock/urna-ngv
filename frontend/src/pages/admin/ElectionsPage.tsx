import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { electionsApi, statesApi } from '../../services/api';
import { Election, State, ElectionStatus } from '../../types';
import { Plus, Play, Pause, Square, Trash2, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

export const ElectionsPage: React.FC = () => {
  const [elections, setElections] = useState<Election[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // New election form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [showResultsDuringVoting, setShowResultsDuringVoting] = useState(false);
  const [validateIp, setValidateIp] = useState(true);
  const [selectedStateIds, setSelectedStateIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchElections = () => {
    setLoading(true);
    Promise.all([electionsApi.getAll(), statesApi.getActive()])
      .then(([elecs, sts]) => {
        setElections(elecs);
        setStates(sts);
        setSelectedStateIds(sts.map((s) => s.id)); // Padrão: todos os estados
      })
      .catch(() => toast.error('Erro ao listar eleições'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchElections();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Informe o nome da eleição');
      return;
    }
    if (selectedStateIds.length === 0) {
      toast.error('Selecione pelo menos um estado participante');
      return;
    }

    setSubmitting(true);
    try {
      await electionsApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        year: Number(year),
        showResultsDuringVoting,
        validateIp,
        stateIds: selectedStateIds,
      });

      toast.success('Eleição criada com sucesso!');
      setShowModal(false);
      setName('');
      setDescription('');
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

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Tem certeza que deseja remover a eleição "${name}"? Esta ação é irreversível.`)) {
      return;
    }

    try {
      await electionsApi.delete(id);
      toast.success('Eleição removida');
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
        <div className="admin-table-wrapper">
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
                <th style={{ textAlign: 'right' }}>Ações</th>
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
                      <strong style={{ color: 'white', display: 'block' }}>{elec.name}</strong>
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
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
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
                          onClick={() => handleDelete(elec.id, elec.name)}
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
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                  NOME DA ELEIÇÃO *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Eleições Gerais 2026 - 1º Turno"
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
                  placeholder="Ex: Eleição geral do RPG para Presidente, Governadores e Senadores"
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

              {/* Estados Participantes */}
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
