import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { electionsApi, positionsApi } from '../../services/api';
import { Election, Position } from '../../types';
import { ArrowLeft, Plus, Trash2, Users, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';

export const ElectionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [election, setElection] = useState<Election | null>(null);
  const [basePositions, setBasePositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPosModal, setShowAddPosModal] = useState(false);
  const [showEditPosModal, setShowEditPosModal] = useState(false);

  // Form para adicionar cargo à eleição
  const [selectedBasePosId, setSelectedBasePosId] = useState('');
  const [posOrder, setPosOrder] = useState(1);
  const [posSlots, setPosSlots] = useState(1);
  const [posDigits, setPosDigits] = useState(2);
  const [posIsNational, setPosIsNational] = useState(false);
  const [posVotingSystem, setPosVotingSystem] = useState<'MAJORITARIO' | 'PROPORCIONAL'>('MAJORITARIO');
  const [submitting, setSubmitting] = useState(false);

  // Form para editar cargo da eleição
  const [editingElectionPos, setEditingElectionPos] = useState<any | null>(null);
  const [editPosOrder, setEditPosOrder] = useState(1);
  const [editPosSlots, setEditPosSlots] = useState(1);
  const [editPosDigits, setEditPosDigits] = useState(2);
  const [editPosIsNational, setEditPosIsNational] = useState(false);
  const [editPosVotingSystem, setEditPosVotingSystem] = useState<'MAJORITARIO' | 'PROPORCIONAL'>('MAJORITARIO');

  const fetchDetails = () => {
    if (!id) return;
    setLoading(true);
    Promise.all([electionsApi.getById(id), positionsApi.getBasePositions()])
      .then(([elec, bPos]) => {
        setElection(elec);
        setBasePositions(bPos);
        if (bPos.length > 0) {
          setSelectedBasePosId(bPos[0].id);
          setPosDigits(bPos[0].defaultDigitCount || 2);
          setPosSlots(bPos[0].defaultSlots || 1);
          setPosIsNational(bPos[0].isNational);
          setPosVotingSystem((bPos[0].defaultVotingSystem as any) || 'MAJORITARIO');
        }
        // Sugere próxima ordem
        const maxOrder = elec.electionPositions?.reduce((max, p) => Math.max(max, p.order), 0) ?? 0;
        setPosOrder(maxOrder + 1);
      })
      .catch(() => toast.error('Erro ao carregar detalhes da eleição'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const handleBasePosChange = (baseId: string) => {
    setSelectedBasePosId(baseId);
    const pos = basePositions.find((p) => p.id === baseId);
    if (pos) {
      setPosDigits(pos.defaultDigitCount);
      setPosSlots(pos.defaultSlots);
      setPosIsNational(pos.isNational);
      setPosVotingSystem((pos.defaultVotingSystem as any) || 'MAJORITARIO');
    }
  };

  const handleAddPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !selectedBasePosId) return;

    setSubmitting(true);
    try {
      await positionsApi.addElectionPosition(id, {
        positionId: selectedBasePosId,
        order: Number(posOrder),
        slots: Number(posSlots),
        digitCount: Number(posDigits),
        isNational: posIsNational,
        votingSystem: posVotingSystem,
      });

      toast.success('Cargo adicionado à cédula eleitoral!');
      setShowAddPosModal(false);
      fetchDetails();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao adicionar cargo');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEditPos = (ep: any) => {
    setEditingElectionPos(ep);
    setEditPosOrder(ep.order);
    setEditPosSlots(ep.slots);
    setEditPosDigits(ep.digitCount);
    setEditPosIsNational(ep.isNational);
    setEditPosVotingSystem((ep.votingSystem as any) || 'MAJORITARIO');
    setShowEditPosModal(true);
  };

  const handleUpdateElectionPos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingElectionPos) return;

    setSubmitting(true);
    try {
      await positionsApi.updateElectionPosition(editingElectionPos.id, {
        order: Number(editPosOrder),
        slots: Number(editPosSlots),
        digitCount: Number(editPosDigits),
        isNational: editPosIsNational,
        votingSystem: editPosVotingSystem,
      });

      toast.success('Cargo atualizado com sucesso!');
      setShowEditPosModal(false);
      setEditingElectionPos(null);
      fetchDetails();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao atualizar cargo');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePosition = async (posId: string) => {
    if (!window.confirm('Deseja realmente remover este cargo da eleição?')) return;

    try {
      await positionsApi.delete(posId);
      toast.success('Cargo removido da eleição');
      fetchDetails();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao remover cargo');
    }
  };

  const handleToggleValidateIp = async () => {
    if (!election) return;
    const nextState = election.validateIp === false ? true : false;
    try {
      await electionsApi.toggleValidateIp(election.id, nextState);
      setElection((prev) => (prev ? { ...prev, validateIp: nextState } : prev));
      toast.success(
        nextState
          ? '🛡️ Verificação de IP ativada (1 voto por IP)'
          : '⚡ Modo Teste ativado (múltiplos votos liberados)'
      );
    } catch {
      toast.error('Erro ao alternar verificação de IP');
    }
  };

  if (loading && !election) {
    return <div style={{ color: '#94a3b8' }}>Carregando dados da eleição...</div>;
  }

  if (!election) {
    return <div style={{ color: '#ef4444' }}>Eleição não encontrada.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Botão voltar */}
      <div>
        <Link
          to="/admin/eleicoes"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: '#94a3b8',
            fontSize: '0.85rem',
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={16} /> Voltar para lista de eleições
        </Link>
      </div>

      {/* Cabeçalho da eleição */}
      <div className="admin-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white' }}>{election.name}</h1>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>
              Ano: {election.year} • Status atual:{' '}
              <strong style={{ color: election.status === 'OPEN' ? '#4ade80' : '#facc15' }}>
                {election.status}
              </strong>
            </p>
            {election.description && (
              <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '8px' }}>
                {election.description}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleToggleValidateIp}
              title="Clique para alternar entre 1 voto por IP ou Modo Teste livre"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 1rem',
                background: election.validateIp !== false ? 'rgba(59, 130, 246, 0.15)' : 'rgba(234, 179, 8, 0.2)',
                color: election.validateIp !== false ? '#60a5fa' : '#facc15',
                border: `1px solid ${election.validateIp !== false ? 'rgba(59, 130, 246, 0.4)' : 'rgba(234, 179, 8, 0.5)'}`,
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {election.validateIp !== false ? '🛡️ IP Único (Ativado)' : '⚡ Modo Teste (IP Liberado)'}
            </button>
            <Link
              to={`/admin/candidatos?electionId=${election.id}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 1rem',
                background: 'rgba(59, 130, 246, 0.2)',
                color: '#60a5fa',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                borderRadius: '8px',
                fontSize: '0.85rem',
              }}
            >
              <Users size={16} /> Candidatos ({election._count?.candidates ?? 0})
            </Link>
          </div>
        </div>
      </div>

      {/* Configuração da Ordem de Votação (Cargos da Urna) */}
      <div className="admin-card">
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>
              Ordem de Votação na Urna (Cargos)
            </h2>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Define os cargos e a sequência exata em que aparecerão para o eleitor na urna
            </p>
          </div>

          <button
            onClick={() => setShowAddPosModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 1rem',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Plus size={16} /> Adicionar Cargo
          </button>
        </div>

        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ordem</th>
                <th>Cargo</th>
                <th>Dígitos</th>
                <th>Vagas</th>
                <th>Âmbito</th>
                <th>Sistema</th>
                <th>Votos Gravados</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {!election.electionPositions || election.electionPositions.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    Nenhum cargo configurado. Adicione cargos para que a urna funcione.
                  </td>
                </tr>
              ) : (
                election.electionPositions.map((ep) => (
                  <tr key={ep.id}>
                    <td>
                      <strong style={{ color: '#60a5fa' }}>{ep.order}º</strong>
                    </td>
                    <td>
                      <strong style={{ color: 'white' }}>{ep.position.name}</strong>
                    </td>
                    <td>{ep.digitCount} dígitos</td>
                    <td>{ep.slots} vaga(s)</td>
                    <td>
                      <span
                        style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          background: ep.isNational ? 'rgba(59, 130, 246, 0.2)' : 'rgba(168, 85, 247, 0.2)',
                          color: ep.isNational ? '#60a5fa' : '#c084fc',
                        }}
                      >
                        {ep.isNational ? 'NACIONAL' : 'ESTADUAL'}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          background: ep.votingSystem === 'PROPORCIONAL' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(100, 116, 139, 0.2)',
                          color: ep.votingSystem === 'PROPORCIONAL' ? '#f59e0b' : '#94a3b8',
                          border: `1px solid ${ep.votingSystem === 'PROPORCIONAL' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(100, 116, 139, 0.3)'}`,
                        }}
                      >
                        {ep.votingSystem === 'PROPORCIONAL' ? 'Proporcional' : 'Majoritário'}
                      </span>
                    </td>
                    <td>{ep._count?.votes ?? 0}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <button
                          title="Editar Cargo"
                          onClick={() => handleStartEditPos(ep)}
                          style={{
                            padding: '0.35rem 0.6rem',
                            background: 'rgba(59, 130, 246, 0.15)',
                            color: '#60a5fa',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          title="Remover Cargo"
                          onClick={() => handleDeletePosition(ep.id)}
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

      {/* Modal Adicionar Cargo */}
      {showAddPosModal && (
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
              maxWidth: '480px',
              padding: '1.75rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white' }}>Adicionar Cargo à Eleição</h2>
              <button
                onClick={() => setShowAddPosModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddPosition} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                  CARGO BASE
                </label>
                <select
                  value={selectedBasePosId}
                  onChange={(e) => handleBasePosChange(e.target.value)}
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
                >
                  {basePositions.map((bp) => (
                    <option key={bp.id} value={bp.id}>
                      {bp.name} (Padrão: {bp.defaultDigitCount} dígitos, {bp.defaultSlots} vaga)
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                    ORDEM NA URNA
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={posOrder}
                    onChange={(e) => setPosOrder(Number(e.target.value))}
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
                    QTD. DÍGITOS
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={posDigits}
                    onChange={(e) => setPosDigits(Number(e.target.value))}
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
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                    VAGAS A ELEGER
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={posSlots}
                    onChange={(e) => setPosSlots(Number(e.target.value))}
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
                      checked={posIsNational}
                      onChange={(e) => setPosIsNational(e.target.checked)}
                      style={{ width: '16px', height: '16px' }}
                    />
                    Cargo Nacional (ex: Presidente)
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                  SISTEMA DE VOTAÇÃO
                </label>
                <select
                  value={posVotingSystem}
                  onChange={(e) => setPosVotingSystem(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: 'white',
                    outline: 'none',
                  }}
                >
                  <option value="MAJORITARIO">Majoritário (mais votados vencem)</option>
                  <option value="PROPORCIONAL">Proporcional (quociente eleitoral / partidário)</option>
                </select>
                <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                  {posVotingSystem === 'PROPORCIONAL' 
                    ? 'Eleitos segundo votos do partido/legenda e quocientes eleitoral e partidário.'
                    : 'Eleitos os candidatos mais votados nominalmente.'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddPosModal(false)}
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
                  {submitting ? 'Salvando...' : 'Adicionar Cargo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Editar Cargo da Eleição */}
      {showEditPosModal && editingElectionPos && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={() => setShowEditPosModal(false)}
        >
          <div
            className="animate-fade-in-scale"
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '480px',
              padding: '1.75rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Pencil size={18} color="#60a5fa" />
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white', margin: 0 }}>
                  Editar Cargo: {editingElectionPos.position?.name}
                </h2>
              </div>
              <button
                onClick={() => setShowEditPosModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateElectionPos} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                    ORDEM NA URNA
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={editPosOrder}
                    onChange={(e) => setEditPosOrder(Number(e.target.value))}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: 'white',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                    QTD. DÍGITOS
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={editPosDigits}
                    onChange={(e) => setEditPosDigits(Number(e.target.value))}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: 'white',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                  VAGAS A ELEGER
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={editPosSlots}
                  onChange={(e) => setEditPosSlots(Number(e.target.value))}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: 'white',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                <input
                  type="checkbox"
                  id="editPosIsNational"
                  checked={editPosIsNational}
                  onChange={(e) => setEditPosIsNational(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="editPosIsNational" style={{ fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer' }}>
                  Cargo de Âmbito Nacional (candidatos concorrem em todos os estados)
                </label>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                  SISTEMA DE VOTAÇÃO
                </label>
                <select
                  value={editPosVotingSystem}
                  onChange={(e) => setEditPosVotingSystem(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: 'white',
                    outline: 'none',
                  }}
                >
                  <option value="MAJORITARIO">Majoritário (mais votados vencem)</option>
                  <option value="PROPORCIONAL">Proporcional (quociente eleitoral / partidário)</option>
                </select>
                <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                  {editPosVotingSystem === 'PROPORCIONAL' 
                    ? 'Eleitos segundo votos do partido/legenda e quocientes eleitoral e partidário.'
                    : 'Eleitos os candidatos mais votados nominalmente.'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowEditPosModal(false)}
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
                  {submitting ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
