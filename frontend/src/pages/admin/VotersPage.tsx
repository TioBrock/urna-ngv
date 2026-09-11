import React, { useEffect, useState } from 'react';
import { votersApi, electionsApi } from '../../services/api';
import { VoterSession, Election, VoterReceipt } from '../../types';
import { Search, RefreshCw, FileText, CheckCircle, Printer, X, Copy, Check } from 'lucide-react';
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

  // Estado do Modal de Comprovante & Votos
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState<VoterReceipt | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [copiedProtocol, setCopiedProtocol] = useState(false);

  useEffect(() => {
    electionsApi
      .getAll()
      .then((elecs) => {
        setElections(elecs);
        if (elecs.length > 0) {
          setSelectedElectionId(elecs[0].id);
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Erro ao listar eleições:', err);
        toast.error('Erro ao carregar eleições');
        setLoading(false);
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

  const handleOpenReceipt = async (sessionId: string) => {
    setShowReceiptModal(true);
    setLoadingReceipt(true);
    setCopiedProtocol(false);
    try {
      const data = await votersApi.getReceipt(sessionId);
      setReceiptData(data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao carregar comprovante de votação');
      setShowReceiptModal(false);
    } finally {
      setLoadingReceipt(false);
    }
  };

  const handleCopyProtocol = (protocol: string) => {
    navigator.clipboard.writeText(protocol);
    setCopiedProtocol(true);
    toast.success('Protocolo copiado para a área de transferência!');
    setTimeout(() => setCopiedProtocol(false), 2500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white' }}>Comparecimento & Votantes</h1>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Registro de presença eleitoral, auditoria de votos e comprovantes de votação
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'white' }}>
              Comparecimento Eleitoral por Estado (Total: {totalVoters} eleitores)
            </h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.5rem' }}>
            {byState.map((st) => (
              <div
                key={st.state.id}
                style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '0.5rem 0.75rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <strong style={{ color: 'white', fontSize: '0.85rem' }}>{st.state.abbreviation}</strong>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>{st.state.name}</span>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 700, color: '#60a5fa' }}>
                  {st.voted} eleitor(es)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabela de Votantes */}
      <div className="admin-card">
        <div className="admin-table-wrapper admin-table-desktop">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Usuário Discord</th>
                <th>Nome do Personagem RPG</th>
                <th>Estado (UF)</th>
                <th>Status</th>
                <th>Início da Votação</th>
                <th>Conclusão do Voto</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                    Carregando eleitores...
                  </td>
                </tr>
              ) : voters.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
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
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => handleOpenReceipt(v.id)}
                        disabled={v.status !== 'VOTED'}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.35rem 0.75rem',
                          background: v.status === 'VOTED' ? 'rgba(59, 130, 246, 0.2)' : '#334155',
                          color: v.status === 'VOTED' ? '#60a5fa' : '#64748b',
                          border: v.status === 'VOTED' ? '1px solid rgba(59, 130, 246, 0.4)' : 'none',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: v.status === 'VOTED' ? 'pointer' : 'not-allowed',
                          transition: 'all 0.2s',
                        }}
                        title={v.status === 'VOTED' ? 'Visualizar votos e comprovante' : 'Votação ainda em andamento'}
                      >
                        <FileText size={14} />
                        {v.status === 'VOTED' ? 'Ver Votos & Comprovante' : 'Em votação'}
                      </button>
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
              Carregando eleitores...
            </div>
          ) : voters.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              Nenhum eleitor encontrado para esta eleição.
            </div>
          ) : (
            voters.map((v) => (
              <div key={v.id} className="admin-mobile-card">
                <div className="admin-mobile-card-header">
                  <div>
                    <strong style={{ color: 'white', fontSize: '0.95rem', display: 'block' }}>{v.discordName}</strong>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{v.rpgName}</span>
                  </div>
                  <div>
                    <span
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        background: v.status === 'VOTED' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                        color: v.status === 'VOTED' ? '#4ade80' : '#facc15',
                      }}
                    >
                      {v.status === 'VOTED' ? 'VOTO CONCLUÍDO' : 'EM ANDAMENTO'}
                    </span>
                  </div>
                </div>

                <div className="admin-mobile-card-grid">
                  <div className="admin-mobile-card-field">
                    <span className="admin-mobile-card-label">ESTADO (UF)</span>
                    <span className="admin-mobile-card-value">
                      <span
                        style={{
                          padding: '0.15rem 0.4rem',
                          background: 'rgba(59, 130, 246, 0.15)',
                          color: '#60a5fa',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        {v.state?.abbreviation || '-'}
                      </span>
                    </span>
                  </div>
                  <div className="admin-mobile-card-field">
                    <span className="admin-mobile-card-label">INÍCIO</span>
                    <span className="admin-mobile-card-value" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {new Date(v.startedAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <div className="admin-mobile-card-field" style={{ gridColumn: 'span 2' }}>
                    <span className="admin-mobile-card-label">CONCLUSÃO</span>
                    <span className="admin-mobile-card-value" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {v.completedAt ? new Date(v.completedAt).toLocaleString('pt-BR') : 'Em andamento'}
                    </span>
                  </div>
                </div>

                <div className="admin-mobile-card-actions">
                  <button
                    onClick={() => handleOpenReceipt(v.id)}
                    disabled={v.status !== 'VOTED'}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.4rem 0.75rem',
                      background: v.status === 'VOTED' ? 'rgba(59, 130, 246, 0.2)' : '#334155',
                      color: v.status === 'VOTED' ? '#60a5fa' : '#64748b',
                      border: v.status === 'VOTED' ? '1px solid rgba(59, 130, 246, 0.4)' : 'none',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: v.status === 'VOTED' ? 'pointer' : 'not-allowed',
                      width: '100%',
                      justifyContent: 'center',
                    }}
                  >
                    <FileText size={15} />
                    {v.status === 'VOTED' ? 'Ver Votos & Comprovante' : 'Em votação'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── MODAL DE COMPROVANTE DE VOTAÇÃO E VOTOS AUDITADOS ── */}
      {showReceiptModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={() => setShowReceiptModal(false)}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '12px',
              maxWidth: '620px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #334155',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <FileText size={20} color="#60a5fa" />
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'white', margin: 0 }}>
                  Comprovante de Votação & Cédula
                </h2>
              </div>
              <button
                onClick={() => setShowReceiptModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {loadingReceipt || !receiptData ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.75rem' }} />
                Carregando comprovante e votos do eleitor...
              </div>
            ) : (
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Visual Estilo Comprovante TSE */}
                <div
                  style={{
                    background: '#f8fafc',
                    color: '#0f172a',
                    borderRadius: '8px',
                    padding: '1.25rem',
                    border: '1px dashed #94a3b8',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  <div style={{ textAlign: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 900, letterSpacing: '0.05em', color: '#1e3d5e' }}>
                      JUSTIÇA ELEITORAL — SISTEMA DE VOTAÇÃO RPG
                    </div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569' }}>
                      {receiptData.session.electionName} ({receiptData.session.electionYear})
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.35rem', color: '#15803d', fontSize: '0.75rem', fontWeight: 700 }}>
                      <CheckCircle size={14} /> COMPROVANTE DE VOTAÇÃO
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>ELEITOR (RPG):</span>
                      <strong style={{ color: '#0f172a' }}>{receiptData.session.rpgName}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>DISCORD:</span>
                      <strong style={{ color: '#0f172a' }}>{receiptData.session.discordName}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>ESTADO / UF:</span>
                      <strong style={{ color: '#0f172a' }}>{receiptData.session.stateName} ({receiptData.session.stateAbbreviation})</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>DATA / HORA:</span>
                      <strong style={{ color: '#0f172a' }}>
                        {receiptData.session.completedAt ? new Date(receiptData.session.completedAt).toLocaleString('pt-BR') : '-'}
                      </strong>
                    </div>
                  </div>

                  {/* Protocolo */}
                  <div
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.5rem',
                      background: '#e2e8f0',
                      borderRadius: '6px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.75rem',
                    }}
                  >
                    <div>
                      <span style={{ color: '#64748b' }}>Protocolo de Autenticidade: </span>
                      <strong style={{ fontFamily: 'var(--font-mono)', color: '#0369a1' }}>
                        {receiptData.session.protocol}
                      </strong>
                    </div>
                    <button
                      onClick={() => handleCopyProtocol(receiptData.session.protocol)}
                      style={{
                        background: 'white',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        padding: '0.2rem 0.5rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.7rem',
                        color: '#334155',
                      }}
                    >
                      {copiedProtocol ? <Check size={12} color="#15803d" /> : <Copy size={12} />}
                      {copiedProtocol ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>

                {/* ── DETALHAMENTO DE VOTOS COMPUTADOS ── */}
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'white', marginBottom: '0.75rem' }}>
                    🗳️ Votos Registrados pelo Eleitor
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {receiptData.votes.map((v, i) => (
                      <div
                        key={v.id || i}
                        style={{
                          background: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          padding: '0.75rem 1rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>
                            {v.positionName} {v.totalSlots > 1 ? `(Vaga ${v.slot})` : ''}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>
                            Registrado em {new Date(v.registeredAt).toLocaleTimeString('pt-BR')}
                          </div>
                        </div>

                        <div>
                          {v.type === 'VALID' && v.candidate ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textAlign: 'right' }}>
                              {v.candidate.photoUrl && (
                                <img
                                  src={v.candidate.photoUrl}
                                  alt={v.candidate.electoralName}
                                  style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                                />
                              )}
                              <div>
                                <strong style={{ color: '#4ade80', fontSize: '0.9rem', display: 'block' }}>
                                  {v.candidate.electoralName}
                                </strong>
                                <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                                  Nº {v.candidate.number} • {v.candidate.party}
                                </span>
                              </div>
                            </div>
                          ) : v.type === 'BLANK' ? (
                            <span
                              style={{
                                padding: '0.3rem 0.6rem',
                                background: '#334155',
                                color: '#cbd5e1',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                              }}
                            >
                              VOTO EM BRANCO
                            </span>
                          ) : (
                            <span
                              style={{
                                padding: '0.3rem 0.6rem',
                                background: 'rgba(239, 68, 68, 0.2)',
                                color: '#f87171',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                              }}
                            >
                              VOTO NULO
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Modal */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    onClick={() => window.print()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.5rem 1rem',
                      background: '#334155',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    <Printer size={15} /> Imprimir Comprovante
                  </button>
                  <button
                    onClick={() => setShowReceiptModal(false)}
                    style={{
                      padding: '0.5rem 1.25rem',
                      background: '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Fechar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
