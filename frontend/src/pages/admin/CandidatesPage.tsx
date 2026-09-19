import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { candidatesApi, electionsApi, positionsApi, statesApi, getPhotoUrl } from '../../services/api';
import { Candidate, Election, Position, State } from '../../types';
import { Plus, Trash2, Search, User, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';

export const CandidatesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [elections, setElections] = useState<Election[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [availableParties, setAvailableParties] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Filtros
  const selectedElectionId = searchParams.get('electionId') || '';
  const [filterPositionId, setFilterPositionId] = useState('');
  const [filterStateId, setFilterStateId] = useState('');
  const [filterParty, setFilterParty] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  // Formulário Novo Candidato
  const [formElectionId, setFormElectionId] = useState('');
  const [formPositionId, setFormPositionId] = useState('');
  const [formStateId, setFormStateId] = useState('');
  const [formName, setFormName] = useState('');
  const [formElectoralName, setFormElectoralName] = useState('');
  const [formNumber, setFormNumber] = useState('');
  const [formParty, setFormParty] = useState('');
  const [formViceName, setFormViceName] = useState('');
  const [formIsNational, setFormIsNational] = useState(false);
  const [formPhoto, setFormPhoto] = useState<File | null>(null);
  const [formPhotoUrl, setFormPhotoUrl] = useState('');
  const [formPhotoType, setFormPhotoType] = useState<'url' | 'file'>('url');
  const [submitting, setSubmitting] = useState(false);

  // Formulário Edição de Candidato
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [editName, setEditName] = useState('');
  const [editElectoralName, setEditElectoralName] = useState('');
  const [editNumber, setEditNumber] = useState('');
  const [editParty, setEditParty] = useState('');
  const [editPositionId, setEditPositionId] = useState('');
  const [editStateId, setEditStateId] = useState('');
  const [editViceName, setEditViceName] = useState('');
  const [editIsNational, setEditIsNational] = useState(false);
  const [editPhoto, setEditPhoto] = useState<File | null>(null);
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [editPhotoType, setEditPhotoType] = useState<'url' | 'file'>('url');
  const [editRemovePhoto, setEditRemovePhoto] = useState(false);
  const [editIsActive, setEditIsActive] = useState(true);

  // Carrega opções iniciais
  useEffect(() => {
    Promise.all([electionsApi.getAll(), positionsApi.getBasePositions(), statesApi.getActive()])
      .then(([elecs, pos, sts]) => {
        setElections(elecs);
        setPositions(pos);
        setStates(sts);
        if (elecs.length > 0 && !selectedElectionId) {
          setSearchParams({ electionId: elecs[0].id });
          setFormElectionId(elecs[0].id);
        } else if (selectedElectionId) {
          setFormElectionId(selectedElectionId);
        }
        if (pos.length > 0) {
          setFormPositionId(pos[0].id);
          setFormIsNational(pos[0].scope === 'NACIONAL' || pos[0].isNational);
        }
      })
      .catch(() => toast.error('Erro ao carregar opções de eleições e cargos'));
  }, []);

  const fetchParties = () => {
    candidatesApi
      .getParties(selectedElectionId || undefined)
      .then(setAvailableParties)
      .catch(() => {});
  };

  const fetchCandidates = () => {
    setLoading(true);
    candidatesApi
      .getAll({
        electionId: selectedElectionId || undefined,
        positionId: filterPositionId || undefined,
        stateId: filterStateId || undefined,
        party: filterParty || undefined,
        search: filterSearch || undefined,
      })
      .then((data) => {
        setCandidates(data);
      })
      .catch(() => toast.error('Erro ao listar candidatos'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCandidates();
    fetchParties();
  }, [selectedElectionId, filterPositionId, filterStateId, filterParty, filterSearch]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formElectionId || !formPositionId || !formNumber || !formElectoralName || !formParty) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    const p = positions.find((pos) => pos.id === formPositionId);
    const isNationalCargo =
      p?.scope === 'NACIONAL' ||
      p?.isNational ||
      ['Presidente', 'Vice-Presidente'].includes(p?.name ?? '') ||
      formIsNational;

    const isNat = isNationalCargo || !formStateId;

    const formData = new FormData();
    formData.append('electionId', formElectionId);
    formData.append('positionId', formPositionId);
    if (!isNat && formStateId) {
      formData.append('stateId', formStateId);
    }
    formData.append('name', formName || formElectoralName);
    formData.append('electoralName', formElectoralName);
    formData.append('number', formNumber);
    formData.append('party', formParty);
    formData.append('isNational', isNat ? 'true' : 'false');
    formData.append('isActive', 'true');
    if (formViceName) {
      formData.append('viceCandidateName', formViceName);
    }
    if (formPhotoType === 'file' && formPhoto) {
      formData.append('photo', formPhoto);
    } else if (formPhotoType === 'url' && formPhotoUrl.trim()) {
      formData.append('photoUrl', formPhotoUrl.trim());
    }

    setSubmitting(true);
    try {
      await candidatesApi.create(formData);
      toast.success('Candidato registrado com sucesso!');
      setShowModal(false);
      // Limpa campos
      setFormName('');
      setFormElectoralName('');
      setFormNumber('');
      setFormParty('');
      setFormViceName('');
      setFormPhoto(null);
      setFormPhotoUrl('');
      fetchCandidates();
      fetchParties();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao registrar candidato');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (candidate: Candidate) => {
    setEditingCandidate(candidate);
    setEditName(candidate.name || candidate.electoralName);
    setEditElectoralName(candidate.electoralName);
    setEditNumber(candidate.number);
    setEditParty(candidate.party);
    setEditPositionId(candidate.positionId);
    setEditStateId(candidate.stateId || '');
    setEditViceName(candidate.viceCandidateName || '');
    setEditIsNational(candidate.isNational ?? false);
    setEditIsActive(candidate.isActive ?? true);
    setEditPhoto(null);
    setEditPhotoUrl(candidate.photoUrl?.startsWith('http') ? candidate.photoUrl : '');
    setEditPhotoType(candidate.photoUrl?.startsWith('http') ? 'url' : 'file');
    setEditRemovePhoto(false);
    setShowEditModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCandidate) return;

    if (!editNumber || !editElectoralName || !editParty) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    const p = positions.find((pos) => pos.id === editPositionId);
    const isNationalCargo =
      p?.scope === 'NACIONAL' ||
      p?.isNational ||
      ['Presidente', 'Vice-Presidente'].includes(p?.name ?? '') ||
      editIsNational;

    const isNat = isNationalCargo || !editStateId;

    const formData = new FormData();
    formData.append('name', editName || editElectoralName);
    formData.append('electoralName', editElectoralName);
    formData.append('number', editNumber);
    formData.append('party', editParty);
    formData.append('positionId', editPositionId);
    if (!isNat && editStateId) {
      formData.append('stateId', editStateId);
    } else {
      formData.append('stateId', '');
    }
    formData.append('isNational', isNat ? 'true' : 'false');
    formData.append('isActive', editIsActive ? 'true' : 'false');
    if (editViceName) {
      formData.append('viceCandidateName', editViceName);
    } else {
      formData.append('viceCandidateName', '');
    }
    if (editRemovePhoto) {
      formData.append('photoUrl', 'CLEAR');
    } else if (editPhotoType === 'file' && editPhoto) {
      formData.append('photo', editPhoto);
    } else if (editPhotoType === 'url' && editPhotoUrl.trim()) {
      formData.append('photoUrl', editPhotoUrl.trim());
    }

    setSubmitting(true);
    try {
      await candidatesApi.update(editingCandidate.id, formData);
      toast.success('Candidato atualizado com sucesso!');
      setShowEditModal(false);
      setEditingCandidate(null);
      fetchCandidates();
      fetchParties();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao atualizar candidato');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Tem certeza que deseja remover o candidato "${name}"?`)) return;

    try {
      await candidatesApi.delete(id);
      toast.success('Candidato removido');
      fetchCandidates();
      fetchParties();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao remover candidato');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white' }}>Gerenciamento de Candidatos</h1>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Registro e edição de chapas eleitorais, partidos e números de urna
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
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Plus size={16} /> Novo Candidato
        </button>
      </div>

      {/* Barra de Filtros */}
      <div className="admin-card" style={{ padding: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Eleição */}
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>ELEIÇÃO</label>
          <select
            value={selectedElectionId}
            onChange={(e) => {
              setSearchParams({ electionId: e.target.value });
              setFormElectionId(e.target.value);
            }}
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

        {/* Cargo */}
        <div style={{ flex: '1 1 180px' }}>
          <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>CARGO</label>
          <select
            value={filterPositionId}
            onChange={(e) => setFilterPositionId(e.target.value)}
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
            <option value="">Todos os cargos</option>
            {positions.map((pos) => (
              <option key={pos.id} value={pos.id}>
                {pos.name}
              </option>
            ))}
          </select>
        </div>

        {/* Partido (Filtro apenas com os partidos inseridos) */}
        <div style={{ flex: '1 1 150px' }}>
          <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>PARTIDO</label>
          <select
            value={filterParty}
            onChange={(e) => setFilterParty(e.target.value)}
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
            <option value="">Todos os Partidos</option>
            {availableParties.map((pty) => (
              <option key={pty} value={pty}>
                {pty}
              </option>
            ))}
          </select>
        </div>

        {/* Estado */}
        <div style={{ flex: '1 1 150px' }}>
          <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>ESTADO (UF)</label>
          <select
            value={filterStateId}
            onChange={(e) => setFilterStateId(e.target.value)}
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
            <option value="">Todos os estados</option>
            {states.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name} ({st.abbreviation})
              </option>
            ))}
          </select>
        </div>

        {/* Busca textual */}
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>BUSCA RÁPIDA</label>
          <div style={{ position: 'relative' }}>
            <Search size={16} color="#64748b" style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Buscar por nome, número ou partido..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
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

      {/* Tabela de Candidatos */}
      <div className="admin-card">
        <div className="admin-table-wrapper admin-table-desktop">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Foto</th>
                <th>Número</th>
                <th>Nome Eleitoral</th>
                <th>Partido</th>
                <th>Cargo</th>
                <th>Estado</th>
                <th>Vice / Suplente</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                    Carregando candidatos...
                  </td>
                </tr>
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    Nenhum candidato encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                candidates.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div
                        style={{
                          width: '40px',
                          height: '50px',
                          borderRadius: '4px',
                          background: '#0f172a',
                          border: '1px solid #334155',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {c.photoUrl ? (
                          <img
                            src={getPhotoUrl(c.photoUrl)}
                            alt={c.electoralName}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <User size={20} color="#64748b" />
                        )}
                      </div>
                    </td>
                    <td>
                      <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', color: '#60a5fa' }}>
                        {c.number}
                      </strong>
                    </td>
                    <td>
                      <strong style={{ color: 'white', display: 'block' }}>{c.electoralName}</strong>
                      {c.name !== c.electoralName && (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{c.name}</span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#cbd5e1' }}>{c.party}</span>
                    </td>
                    <td>{c.position?.name || '-'}</td>
                    <td>
                      {(() => {
                        const isNationalCargo =
                          c.position?.scope === 'NACIONAL' ||
                          c.position?.isNational ||
                          ['Presidente', 'Vice-Presidente'].includes(c.position?.name ?? '');

                        if (isNationalCargo) {
                          return (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '0.25rem 0.6rem',
                                background: 'rgba(168, 85, 247, 0.15)',
                                color: '#c084fc',
                                border: '1px solid rgba(168, 85, 247, 0.3)',
                                borderRadius: '6px',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                              }}
                            >
                              Nacional
                            </span>
                          );
                        }

                        if (c.state) {
                          return (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '0.25rem 0.6rem',
                                background: 'rgba(59, 130, 246, 0.15)',
                                color: '#60a5fa',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                borderRadius: '6px',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                              }}
                            >
                              {c.state.name} ({c.state.abbreviation})
                            </span>
                          );
                        }

                        return (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '0.25rem 0.6rem',
                              background: 'rgba(168, 85, 247, 0.15)',
                              color: '#c084fc',
                              border: '1px solid rgba(168, 85, 247, 0.3)',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                            }}
                          >
                            Nacional
                          </span>
                        );
                      })()}
                    </td>
                    <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                      {c.viceCandidateName || '-'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        {/* Botão Editar Candidato */}
                        <button
                          title="Editar Candidato"
                          onClick={() => handleStartEdit(c)}
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
                        {/* Botão Remover Candidato */}
                        <button
                          title="Remover Candidato"
                          onClick={() => handleDelete(c.id, c.electoralName)}
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
              Carregando candidatos...
            </div>
          ) : candidates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              Nenhum candidato encontrado com os filtros selecionados.
            </div>
          ) : (
            candidates.map((c) => (
              <div key={c.id} className="admin-mobile-card">
                <div className="admin-mobile-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '50px',
                        borderRadius: '4px',
                        background: '#0f172a',
                        border: '1px solid #334155',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {c.photoUrl ? (
                        <img
                          src={getPhotoUrl(c.photoUrl)}
                          alt={c.electoralName}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <User size={20} color="#64748b" />
                      )}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#60a5fa', fontSize: '1.1rem' }}>
                          {c.number}
                        </span>
                        <strong style={{ color: 'white', fontSize: '0.95rem' }}>{c.electoralName}</strong>
                      </div>
                      {c.name !== c.electoralName && (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>{c.name}</span>
                      )}
                    </div>
                  </div>
                  <span style={{ fontWeight: 700, color: '#cbd5e1', fontSize: '0.8rem', background: '#0f172a', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #334155' }}>
                    {c.party}
                  </span>
                </div>

                <div className="admin-mobile-card-grid">
                  <div className="admin-mobile-card-field">
                    <span className="admin-mobile-card-label">CARGO</span>
                    <span className="admin-mobile-card-value">{c.position?.name || '-'}</span>
                  </div>
                  <div className="admin-mobile-card-field">
                    <span className="admin-mobile-card-label">ESTADO / ÂMBITO</span>
                    <span className="admin-mobile-card-value">
                      {c.state ? `${c.state.name} (${c.state.abbreviation})` : 'Nacional'}
                    </span>
                  </div>
                  {c.viceCandidateName && (
                    <div className="admin-mobile-card-field" style={{ gridColumn: 'span 2' }}>
                      <span className="admin-mobile-card-label">VICE / SUPLENTE</span>
                      <span className="admin-mobile-card-value">{c.viceCandidateName}</span>
                    </div>
                  )}
                </div>

                <div className="admin-mobile-card-actions">
                  <button
                    onClick={() => handleStartEdit(c)}
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
                    onClick={() => handleDelete(c.id, c.electoralName)}
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

      {/* ── MODAL NOVO CANDIDATO ── */}
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
              maxWidth: '540px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.75rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white' }}>Cadastrar Novo Candidato</h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                    ELEIÇÃO *
                  </label>
                  <select
                    value={formElectionId}
                    onChange={(e) => setFormElectionId(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: 'white',
                    }}
                  >
                    {elections.map((elec) => (
                      <option key={elec.id} value={elec.id}>
                        {elec.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                    CARGO *
                  </label>
                  <select
                    value={formPositionId}
                    onChange={(e) => {
                      setFormPositionId(e.target.value);
                      const p = positions.find((pos) => pos.id === e.target.value);
                      if (p) {
                        const isNat =
                          p.scope === 'NACIONAL' ||
                          p.isNational ||
                          ['Presidente', 'Vice-Presidente'].includes(p.name);
                        setFormIsNational(isNat);
                        if (isNat) setFormStateId('');
                      }
                    }}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: 'white',
                    }}
                  >
                    {positions.map((pos) => (
                      <option key={pos.id} value={pos.id}>
                        {pos.name} ({pos.scope || (pos.isNational ? 'NACIONAL' : 'ESTADUAL')})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                    NÚMERO NA URNA *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 13, 22, 10123"
                    value={formNumber}
                    onChange={(e) => setFormNumber(e.target.value.replace(/\D/g, ''))}
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
                    SIGLA DO PARTIDO *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: PL, PT, MDB, PSDB"
                    value={formParty}
                    onChange={(e) => setFormParty(e.target.value.toUpperCase())}
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
                  NOME ELEITORAL (NA TELA DA URNA) *
                </label>
                <input
                  type="text"
                  placeholder="Ex: LULA, BOLSONARO, FHC"
                  value={formElectoralName}
                  onChange={(e) => setFormElectoralName(e.target.value)}
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
                  NOME COMPLETO DO CANDIDATO
                </label>
                <input
                  type="text"
                  placeholder="Nome civil ou do personagem no RPG"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
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
                  VICE / SUPLENTE (OPCIONAL)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Geraldo Alckmin, Walter Braga Netto"
                  value={formViceName}
                  onChange={(e) => setFormViceName(e.target.value)}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                    ESTADO {formIsNational ? '(NÃO SE APLICA A CARGO NACIONAL)' : '(OBRIGATÓRIO SE ESTADUAL)'}
                  </label>
                  <select
                    value={formStateId}
                    onChange={(e) => setFormStateId(e.target.value)}
                    disabled={formIsNational}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: formIsNational ? '#64748b' : 'white',
                    }}
                  >
                    <option value="">{formIsNational ? 'Âmbito Nacional (Todos os estados)' : 'Selecione o estado...'}</option>
                    {states.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.abbreviation})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1' }}>
                      FOTO DO CANDIDATO
                    </label>
                    <div style={{ display: 'flex', gap: '0.25rem', background: '#1e293b', padding: '2px', borderRadius: '4px' }}>
                      <button
                        type="button"
                        onClick={() => setFormPhotoType('url')}
                        style={{
                          padding: '2px 6px',
                          fontSize: '0.7rem',
                          borderRadius: '3px',
                          border: 'none',
                          cursor: 'pointer',
                          background: formPhotoType === 'url' ? '#3b82f6' : 'transparent',
                          color: 'white',
                          fontWeight: 600,
                        }}
                      >
                        Link/URL
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormPhotoType('file')}
                        style={{
                          padding: '2px 6px',
                          fontSize: '0.7rem',
                          borderRadius: '3px',
                          border: 'none',
                          cursor: 'pointer',
                          background: formPhotoType === 'file' ? '#3b82f6' : 'transparent',
                          color: 'white',
                          fontWeight: 600,
                        }}
                      >
                        Arquivo
                      </button>
                    </div>
                  </div>

                  {formPhotoType === 'url' ? (
                    <input
                      type="url"
                      placeholder="https://exemplo.com/foto.jpg ou link Discord"
                      value={formPhotoUrl}
                      onChange={(e) => setFormPhotoUrl(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.6rem',
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '0.8rem',
                      }}
                    />
                  ) : (
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setFormPhoto(e.target.files?.[0] || null)}
                      style={{
                        width: '100%',
                        padding: '0.6rem',
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '0.8rem',
                      }}
                    />
                  )}

                  {formPhotoType === 'url' && formPhotoUrl && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                      <img
                        src={formPhotoUrl}
                        alt="Preview"
                        style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #475569' }}
                        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Pré-visualização da imagem</span>
                    </div>
                  )}
                  {formPhotoType === 'file' && formPhoto && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                      <span style={{ fontSize: '0.72rem', color: '#4ade80' }}>Arquivo selecionado: {formPhoto.name}</span>
                    </div>
                  )}
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
                  {submitting ? 'Salvando...' : 'Salvar Candidato'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL EDITAR CANDIDATO ── */}
      {showEditModal && editingCandidate && (
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
              maxWidth: '540px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.75rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Pencil size={18} color="#60a5fa" />
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white', margin: 0 }}>
                  Editar Candidato
                </h2>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                    CARGO POLÍTICO *
                  </label>
                  <select
                    value={editPositionId}
                    onChange={(e) => {
                      setEditPositionId(e.target.value);
                      const p = positions.find((pos) => pos.id === e.target.value);
                      if (p) {
                        const isNat =
                          p.scope === 'NACIONAL' ||
                          p.isNational ||
                          ['Presidente', 'Vice-Presidente'].includes(p.name);
                        setEditIsNational(isNat);
                        if (isNat) setEditStateId('');
                      }
                    }}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: 'white',
                    }}
                  >
                    {positions.map((pos) => (
                      <option key={pos.id} value={pos.id}>
                        {pos.name} ({pos.scope || (pos.isNational ? 'NACIONAL' : 'ESTADUAL')})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                    NÚMERO NA URNA *
                  </label>
                  <input
                    type="text"
                    value={editNumber}
                    onChange={(e) => setEditNumber(e.target.value.replace(/\D/g, ''))}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                    SIGLA DO PARTIDO *
                  </label>
                  <input
                    type="text"
                    value={editParty}
                    onChange={(e) => setEditParty(e.target.value.toUpperCase())}
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
                    NOME ELEITORAL *
                  </label>
                  <input
                    type="text"
                    value={editElectoralName}
                    onChange={(e) => setEditElectoralName(e.target.value)}
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
                  NOME COMPLETO DO CANDIDATO
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
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
                  VICE / SUPLENTE (OPCIONAL)
                </label>
                <input
                  type="text"
                  value={editViceName}
                  onChange={(e) => setEditViceName(e.target.value)}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                    ESTADO {editIsNational ? '(CARGO NACIONAL)' : '(OBRIGATÓRIO SE ESTADUAL)'}
                  </label>
                  <select
                    value={editStateId}
                    onChange={(e) => setEditStateId(e.target.value)}
                    disabled={editIsNational}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: editIsNational ? '#64748b' : 'white',
                    }}
                  >
                    <option value="">{editIsNational ? 'Âmbito Nacional (Todos os estados)' : 'Selecione o estado...'}</option>
                    {states.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.abbreviation})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1' }}>
                      FOTO DO CANDIDATO
                    </label>
                    <div style={{ display: 'flex', gap: '0.25rem', background: '#1e293b', padding: '2px', borderRadius: '4px' }}>
                      <button
                        type="button"
                        onClick={() => { setEditPhotoType('url'); setEditRemovePhoto(false); }}
                        style={{
                          padding: '2px 6px',
                          fontSize: '0.7rem',
                          borderRadius: '3px',
                          border: 'none',
                          cursor: 'pointer',
                          background: editPhotoType === 'url' && !editRemovePhoto ? '#3b82f6' : 'transparent',
                          color: 'white',
                          fontWeight: 600,
                        }}
                      >
                        Link/URL
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditPhotoType('file'); setEditRemovePhoto(false); }}
                        style={{
                          padding: '2px 6px',
                          fontSize: '0.7rem',
                          borderRadius: '3px',
                          border: 'none',
                          cursor: 'pointer',
                          background: editPhotoType === 'file' && !editRemovePhoto ? '#3b82f6' : 'transparent',
                          color: 'white',
                          fontWeight: 600,
                        }}
                      >
                        Arquivo
                      </button>
                    </div>
                  </div>

                  {!editRemovePhoto ? (
                    editPhotoType === 'url' ? (
                      <input
                        type="url"
                        placeholder="https://exemplo.com/foto.jpg ou link Discord"
                        value={editPhotoUrl}
                        onChange={(e) => setEditPhotoUrl(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.6rem',
                          background: '#0f172a',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          color: 'white',
                          fontSize: '0.8rem',
                        }}
                      />
                    ) : (
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setEditPhoto(e.target.files?.[0] || null)}
                        style={{
                          width: '100%',
                          padding: '0.6rem',
                          background: '#0f172a',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          color: 'white',
                          fontSize: '0.8rem',
                        }}
                      />
                    )
                  ) : (
                    <div style={{ padding: '0.5rem', background: 'rgba(239, 68, 68, 0.15)', borderRadius: '6px', fontSize: '0.75rem', color: '#f87171' }}>
                      Foto será removida ao salvar
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginTop: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {editingCandidate?.photoUrl && !editRemovePhoto && (
                        <img
                          src={editPhotoType === 'url' && editPhotoUrl ? editPhotoUrl : getPhotoUrl(editingCandidate.photoUrl)}
                          alt="Foto"
                          style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #475569' }}
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                      )}
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        {editRemovePhoto ? 'Sem foto' : editingCandidate?.photoUrl ? 'Foto atual' : 'Sem foto'}
                      </span>
                    </div>

                    {editingCandidate?.photoUrl && (
                      <button
                        type="button"
                        onClick={() => setEditRemovePhoto(!editRemovePhoto)}
                        style={{
                          padding: '2px 8px',
                          fontSize: '0.7rem',
                          background: editRemovePhoto ? '#334155' : 'rgba(239, 68, 68, 0.15)',
                          color: editRemovePhoto ? 'white' : '#ef4444',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        {editRemovePhoto ? 'Desfazer' : 'Remover foto'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="editIsActive" style={{ fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer' }}>
                  Candidato Ativo (apto a receber votos na urna)
                </label>
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
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {submitting ? 'Atualizando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
