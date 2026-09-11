import React, { useEffect, useState } from 'react';
import { positionsApi } from '../../services/api';
import { Position } from '../../types';
import { Award, Plus, Globe, Building2, Landmark, Trash2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';

export const PositionsPage: React.FC = () => {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State Novo
  const [formName, setFormName] = useState('');
  const [formScope, setFormScope] = useState<'NACIONAL' | 'ESTADUAL' | 'MUNICIPAL'>('ESTADUAL');
  const [formDigitCount, setFormDigitCount] = useState(2);
  const [formSlots, setFormSlots] = useState(1);
  const [formDescription, setFormDescription] = useState('');

  // Form State Edição
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [editName, setEditName] = useState('');
  const [editScope, setEditScope] = useState<'NACIONAL' | 'ESTADUAL' | 'MUNICIPAL'>('ESTADUAL');
  const [editDigitCount, setEditDigitCount] = useState(2);
  const [editSlots, setEditSlots] = useState(1);
  const [editDescription, setEditDescription] = useState('');

  const fetchPositions = () => {
    setLoading(true);
    positionsApi
      .getBasePositions()
      .then(setPositions)
      .catch(() => toast.error('Erro ao listar cargos base'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPositions();
  }, []);

  const handleCreatePosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Informe o nome do cargo');
      return;
    }

    setSubmitting(true);
    try {
      await positionsApi.createBasePosition({
        name: formName.trim(),
        scope: formScope,
        defaultDigitCount: Number(formDigitCount),
        defaultSlots: Number(formSlots),
        description: formDescription.trim() || undefined,
      });

      toast.success('Cargo político cadastrado com sucesso!');
      setShowModal(false);
      setFormName('');
      setFormDescription('');
      setFormDigitCount(2);
      setFormSlots(1);
      setFormScope('ESTADUAL');
      fetchPositions();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao cadastrar cargo');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (pos: Position) => {
    setEditingPosition(pos);
    setEditName(pos.name);
    setEditScope((pos.scope as any) || (pos.isNational ? 'NACIONAL' : 'ESTADUAL'));
    setEditDigitCount(pos.defaultDigitCount ?? 2);
    setEditSlots(pos.defaultSlots ?? 1);
    setEditDescription(pos.description || '');
    setShowEditModal(true);
  };

  const handleUpdatePosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPosition) return;
    if (!editName.trim()) {
      toast.error('Informe o nome do cargo');
      return;
    }

    setSubmitting(true);
    try {
      await positionsApi.updateBasePosition(editingPosition.id, {
        name: editName.trim(),
        scope: editScope,
        defaultDigitCount: Number(editDigitCount),
        defaultSlots: Number(editSlots),
        description: editDescription.trim() || undefined,
      });

      toast.success('Cargo atualizado com sucesso!');
      setShowEditModal(false);
      setEditingPosition(null);
      fetchPositions();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao atualizar cargo');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePosition = async (id: string, name: string) => {
    if (!window.confirm(`Deseja remover o cargo base "${name}"?`)) return;
    try {
      await positionsApi.deleteBasePosition(id);
      toast.success('Cargo removido com sucesso!');
      fetchPositions();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Não foi possível remover este cargo.');
    }
  };

  const nacionalCount = positions.filter((p) => (p.scope || '').toUpperCase() === 'NACIONAL').length;
  const estadualCount = positions.filter((p) => (p.scope || '').toUpperCase() === 'ESTADUAL').length;
  const municipalCount = positions.filter((p) => (p.scope || '').toUpperCase() === 'MUNICIPAL').length;

  const getScopeBadge = (scopeRaw?: string, isNational?: boolean) => {
    const scope = (scopeRaw || (isNational ? 'NACIONAL' : 'ESTADUAL')).toUpperCase();

    if (scope === 'NACIONAL') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.25rem 0.6rem',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: 700,
            background: 'rgba(59, 130, 246, 0.15)',
            color: '#60a5fa',
            border: '1px solid rgba(59, 130, 246, 0.3)',
          }}
        >
          <Globe size={13} />
          NACIONAL
        </span>
      );
    }

    if (scope === 'MUNICIPAL') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.25rem 0.6rem',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: 700,
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#34d399',
            border: '1px solid rgba(16, 185, 129, 0.3)',
          }}
        >
          <Landmark size={13} />
          MUNICIPAL
        </span>
      );
    }

    // Padrão: ESTADUAL
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: '0.25rem 0.6rem',
          borderRadius: '6px',
          fontSize: '0.75rem',
          fontWeight: 700,
          background: 'rgba(168, 85, 247, 0.15)',
          color: '#c084fc',
          border: '1px solid rgba(168, 85, 247, 0.3)',
        }}
      >
        <Building2 size={13} />
        ESTADUAL
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white' }}>Catálogo de Cargos Políticos</h1>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Definições de cargos, âmbitos eleitorais, contagem de dígitos e vagas para as eleições do RPG
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
          <Plus size={18} /> Novo Cargo Base
        </button>
      </div>

      {/* Cards de Resumo por Âmbito */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div
          className="admin-card"
          style={{
            padding: '1.1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            borderLeft: '4px solid #60a5fa',
          }}
        >
          <div style={{ padding: '0.65rem', background: 'rgba(59, 130, 246, 0.15)', borderRadius: '10px', color: '#60a5fa' }}>
            <Globe size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>ÂMBITO NACIONAL</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white' }}>{nacionalCount} cargos</div>
          </div>
        </div>

        <div
          className="admin-card"
          style={{
            padding: '1.1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            borderLeft: '4px solid #c084fc',
          }}
        >
          <div style={{ padding: '0.65rem', background: 'rgba(168, 85, 247, 0.15)', borderRadius: '10px', color: '#c084fc' }}>
            <Building2 size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>ÂMBITO ESTADUAL</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white' }}>{estadualCount} cargos</div>
          </div>
        </div>

        <div
          className="admin-card"
          style={{
            padding: '1.1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            borderLeft: '4px solid #34d399',
          }}
        >
          <div style={{ padding: '0.65rem', background: 'rgba(168, 185, 129, 0.15)', borderRadius: '10px', color: '#34d399' }}>
            <Landmark size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>ÂMBITO MUNICIPAL</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white' }}>{municipalCount} cargos</div>
          </div>
        </div>
      </div>

      {/* Tabela de Cargos */}
      <div className="admin-card">
        <div className="admin-table-wrapper admin-table-desktop">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Cargo Político</th>
                <th>Dígitos Padrão</th>
                <th>Vagas Padrão</th>
                <th>Âmbito</th>
                <th>Descrição / Regras TSE</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                    Carregando cargos...
                  </td>
                </tr>
              ) : positions.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    Nenhum cargo cadastrado.
                  </td>
                </tr>
              ) : (
                positions.map((pos) => (
                  <tr key={pos.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{ padding: '0.4rem', background: 'rgba(30, 41, 59, 0.8)', borderRadius: '6px' }}>
                          <Award size={16} color="#60a5fa" />
                        </div>
                        <strong style={{ color: 'white', fontSize: '0.9rem' }}>{pos.name}</strong>
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          color: '#f8fafc',
                          background: '#0f172a',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          border: '1px solid #334155',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                        }}
                      >
                        {pos.defaultDigitCount ?? 2} dígitos
                      </span>
                    </td>
                    <td>
                      <span style={{ color: '#cbd5e1', fontWeight: 600 }}>
                        {pos.defaultSlots ?? 1} vaga(s)
                      </span>
                    </td>
                    <td>{getScopeBadge(pos.scope, pos.isNational)}</td>
                    <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                      {pos.description || 'Padrão do Tribunal Superior Eleitoral'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <button
                          title="Editar Cargo Base"
                          onClick={() => handleStartEdit(pos)}
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
                          title="Remover Cargo Base"
                          onClick={() => handleDeletePosition(pos.id, pos.name)}
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
              Carregando cargos...
            </div>
          ) : positions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              Nenhum cargo cadastrado.
            </div>
          ) : (
            positions.map((pos) => (
              <div key={pos.id} className="admin-mobile-card">
                <div className="admin-mobile-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ padding: '0.4rem', background: 'rgba(30, 41, 59, 0.8)', borderRadius: '6px' }}>
                      <Award size={16} color="#60a5fa" />
                    </div>
                    <strong style={{ color: 'white', fontSize: '0.95rem' }}>{pos.name}</strong>
                  </div>
                  <div>{getScopeBadge(pos.scope, pos.isNational)}</div>
                </div>

                <div className="admin-mobile-card-grid">
                  <div className="admin-mobile-card-field">
                    <span className="admin-mobile-card-label">DÍGITOS</span>
                    <span className="admin-mobile-card-value">{pos.defaultDigitCount ?? 2} dígitos</span>
                  </div>
                  <div className="admin-mobile-card-field">
                    <span className="admin-mobile-card-label">VAGAS</span>
                    <span className="admin-mobile-card-value">{pos.defaultSlots ?? 1} vaga(s)</span>
                  </div>
                  {pos.description && (
                    <div className="admin-mobile-card-field" style={{ gridColumn: 'span 2' }}>
                      <span className="admin-mobile-card-label">DESCRIÇÃO</span>
                      <span className="admin-mobile-card-value" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        {pos.description}
                      </span>
                    </div>
                  )}
                </div>

                <div className="admin-mobile-card-actions">
                  <button
                    onClick={() => handleStartEdit(pos)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.4rem 0.75rem',
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: '#60a5fa',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Pencil size={14} /> Editar
                  </button>
                  <button
                    onClick={() => handleDeletePosition(pos.id, pos.name)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.4rem 0.75rem',
                      background: 'rgba(239, 68, 68, 0.1)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={14} /> Excluir
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal Novo Cargo Base */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
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
              maxWidth: '520px',
              padding: '1.75rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white' }}>Novo Cargo Político</h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePosition} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                  NOME DO CARGO *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Primeiro-Ministro, Chanceler, Deputado Distrital"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
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
                  ÂMBITO ELEITORAL *
                </label>
                <select
                  value={formScope}
                  onChange={(e) => setFormScope(e.target.value as any)}
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
                  <option value="NACIONAL">NACIONAL (Candidatos aparecem em todos os estados — ex: Presidente)</option>
                  <option value="ESTADUAL">ESTADUAL (Candidatos específicos por Estado — ex: Governador, Deputado)</option>
                  <option value="MUNICIPAL">MUNICIPAL (Candidatos específicos por Cidade — ex: Prefeito, Vereador)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                    QTD. DÍGITOS PADRÃO *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={formDigitCount}
                    onChange={(e) => setFormDigitCount(Number(e.target.value))}
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
                    VAGAS A ELEGER *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={formSlots}
                    onChange={(e) => setFormSlots(Number(e.target.value))}
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

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                  DESCRIÇÃO / NOTAS DAS REGRAS
                </label>
                <input
                  type="text"
                  placeholder="Ex: Representante do poder executivo conforme regras da constituição do RPG"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
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

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '0.75rem 1.25rem',
                    background: '#334155',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'linear-gradient(135deg, #1e3d5e, #1565c0)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                >
                  {submitting ? 'Cadastrando...' : 'Cadastrar Cargo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Editar Cargo Base */}
      {showEditModal && editingPosition && (
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
          onClick={() => setShowEditModal(false)}
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
                  Editar Cargo Base
                </h2>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdatePosition} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                  NOME DO CARGO POLÍTICO *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
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
                  ÂMBITO DO CARGO *
                </label>
                <select
                  value={editScope}
                  onChange={(e) => setEditScope(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: 'white',
                  }}
                >
                  <option value="ESTADUAL">Estadual (Governador, Deputado Estadual...)</option>
                  <option value="NACIONAL">Nacional (Presidente, Senador, Dep. Federal...)</option>
                  <option value="MUNICIPAL">Municipal (Prefeito, Vereador...)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                    QTD. DÍGITOS PADRÃO
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={editDigitCount}
                    onChange={(e) => setEditDigitCount(Number(e.target.value))}
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
                    VAGAS PADRÃO
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={editSlots}
                    onChange={(e) => setEditSlots(Number(e.target.value))}
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
                  DESCRIÇÃO / OBSERVAÇÃO ELEITORAL
                </label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: 'white',
                    resize: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
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
                    cursor: 'pointer',
                    fontWeight: 700,
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
