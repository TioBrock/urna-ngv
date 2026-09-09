import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { candidatesApi, electionsApi, positionsApi, statesApi } from '../../services/api';
import { Candidate, Election, Position, State } from '../../types';
import { Plus, Trash2, Search, User } from 'lucide-react';
import toast from 'react-hot-toast';

export const CandidatesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [elections, setElections] = useState<Election[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Filtros
  const selectedElectionId = searchParams.get('electionId') || '';
  const [filterPositionId, setFilterPositionId] = useState('');
  const [filterStateId, setFilterStateId] = useState('');
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
  const [submitting, setSubmitting] = useState(false);

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

  const fetchCandidates = () => {
    setLoading(true);
    candidatesApi
      .getAll({
        electionId: selectedElectionId || undefined,
        positionId: filterPositionId || undefined,
        stateId: filterStateId || undefined,
        search: filterSearch || undefined,
      })
      .then(setCandidates)
      .catch(() => toast.error('Erro ao listar candidatos'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCandidates();
  }, [selectedElectionId, filterPositionId, filterStateId, filterSearch]);

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
    if (formPhoto) {
      formData.append('photo', formPhoto);
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
      setFormStateId('');
      setFormPhoto(null);
      fetchCandidates();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao registrar candidato');
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
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao remover candidato');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white' }}>Gestão de Candidatos</h1>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Cadastre chapas, números e fotos que aparecerão na urna eletrônica
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
          <Plus size={18} /> Novo Candidato
        </button>
      </div>

      {/* Barra de Filtros */}
      <div className="admin-card" style={{ padding: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>ELEIÇÃO</label>
          <select
            value={selectedElectionId}
            onChange={(e) => setSearchParams({ electionId: e.target.value })}
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
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: '1 1 140px' }}>
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
            <option value="">Nacional / Todos</option>
            {states.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name} ({st.abbreviation})
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>BUSCA</label>
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
        <div className="admin-table-wrapper">
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
                          <img src={c.photoUrl} alt={c.electoralName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Novo Candidato */}
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
                    placeholder="Ex: PL, PT, MDB, UNIÃO"
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
                  placeholder="Ex: LULA, BOLSONARO, EDUARDO LEITE"
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
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                    FOTO DO CANDIDATO
                  </label>
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
    </div>
  );
};
