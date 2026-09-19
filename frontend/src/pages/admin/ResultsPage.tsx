import React, { useEffect, useState } from 'react';
import { resultsApi, electionsApi, statesApi } from '../../services/api';
import { Election, State, ElectionResult, ResultsOverview } from '../../types';
import { Award, Printer, RefreshCw, MapPin, Users, Vote, PieChart as PieIcon, CheckCircle2, Download, ChevronDown, ChevronUp, Layers, Eye, X, FileText } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

const CHART_COLORS = [
  '#3b82f6', // azul
  '#10b981', // verde
  '#f59e0b', // amarelo/âmbar
  '#8b5cf6', // roxo
  '#ec4899', // rosa
  '#06b6d4', // ciano
  '#f97316', // laranja
  '#14b8a6', // teal
  '#6366f1', // índigo
  '#e11d48', // vermelho
];

// Componente do Documento Oficial do Boletim de Urna (A4 para impressão e PDF)
const BoletimUrnaDocument: React.FC<{
  election: any;
  overview?: ResultsOverview;
  results: ElectionResult[];
  selectedState?: State;
  emissionDate: string;
  authHash: string;
}> = ({ election, overview, results, selectedState, emissionDate, authHash }) => {
  return (
    <div className="bu-document-wrapper">
      {/* ── CABEÇALHO OFICIAL ELEITORAL ── */}
      <div className="bu-header">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.6rem', marginBottom: '4px' }}>
          <Vote size={24} color="#1e3a5f" />
          <div className="bu-header-justice">JUSTIÇA ELEITORAL — SISTEMA ELEITORAL NGV</div>
        </div>
        <div className="bu-header-republic">REPÚBLICA FEDERATIVA DO BRASIL</div>
        <div className="bu-header-title">BOLETIM DE URNA (BU)</div>
        <div style={{ fontSize: '7.5pt', color: '#6b7280', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Relatório Oficial de Totalização e Apuração de Votos
        </div>
      </div>

      {/* ── METADADOS DA ELEIÇÃO ── */}
      <div className="bu-meta-box">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div className="bu-meta-item">
            <span className="bu-meta-label">Eleição:</span>
            <span className="bu-meta-value">{election?.name || 'Eleição'} ({election?.year || new Date().getFullYear()})</span>
          </div>
          <div className="bu-meta-item">
            <span className="bu-meta-label">Situação do Pleito:</span>
            <span className="bu-meta-value">{election?.status === 'CLOSED' ? 'ENCERRADA (OFICIAL)' : election?.status || 'OFICIAL'}</span>
          </div>
          <div className="bu-meta-item">
            <span className="bu-meta-label">Âmbito / Abrangência:</span>
            <span className="bu-meta-value">{selectedState ? `${selectedState.name} (${selectedState.abbreviation})` : 'Brasil (Nacional / Consolidado)'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div className="bu-meta-item">
            <span className="bu-meta-label">Data e Hora de Emissão:</span>
            <span className="bu-meta-value">{emissionDate}</span>
          </div>
          <div className="bu-meta-item">
            <span className="bu-meta-label">Eleitores Participantes:</span>
            <span className="bu-meta-value">{(overview?.totalVoters ?? 0).toLocaleString('pt-BR')} comparecimentos</span>
          </div>
          <div className="bu-meta-item">
            <span className="bu-meta-label">Chave de Autenticação:</span>
            <span className="bu-meta-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '7.5pt' }}>{authHash}</span>
          </div>
        </div>
      </div>

      {/* ── COMPARECIMENTO POR UF (se consolidado e houver estados com votos) ── */}
      {!selectedState && overview?.byState && overview.byState.filter((s) => (s.voters ?? s.votes) > 0).length > 0 && (
        <div style={{ marginBottom: '1.25rem', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '0.6rem 0.8rem', background: '#fafafa' }}>
          <div style={{ fontSize: '8pt', fontWeight: 800, color: '#374151', textTransform: 'uppercase', marginBottom: '6px' }}>
            Comparecimento por Unidade da Federação (UF)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '4px 8px', fontSize: '7.5pt' }}>
            {overview.byState.filter((s) => (s.voters ?? s.votes) > 0).map((st) => (
              <div key={st.state.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #e5e7eb', paddingBottom: '1px' }}>
                <span style={{ fontWeight: 700, color: '#1f2937' }}>{st.state.abbreviation}:</span>
                <span style={{ color: '#4b5563' }}>{(st.voters ?? st.votes).toLocaleString('pt-BR')} ({st.percentage}%)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── RESULTADOS CONSOLIDADOS POR CARGO ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {results.map((res) => {
          const isProporcional = (res.votingSystem || 'MAJORITARIO') === 'PROPORCIONAL';

          return (
            <div key={res.electionPosition.id} className="bu-position-card">
              {/* Faixa Cabeçalho do Cargo */}
              <div className="bu-position-header">
                <div className="bu-position-title">
                  {res.electionPosition.order}º CARGO: {res.electionPosition.name}
                </div>
                <div className="bu-position-badges">
                  <span className="bu-badge">{res.electionPosition.slots} {res.electionPosition.slots === 1 ? 'vaga' : 'vagas'}</span>
                  <span className="bu-badge">{isProporcional ? 'SISTEMA PROPORCIONAL' : 'SISTEMA MAJORITÁRIO'}</span>
                </div>
              </div>

              {/* Estatísticas de Votação do Cargo */}
              <div className="bu-position-stats">
                <div className="bu-stat-cell">
                  <span className="bu-stat-label">TOTAL DE VOTOS</span>
                  <span className="bu-stat-val">{res.totalVotes.toLocaleString('pt-BR')}</span>
                </div>
                <div className="bu-stat-cell">
                  <span className="bu-stat-label">VOTOS VÁLIDOS</span>
                  <span className="bu-stat-val" style={{ color: '#15803d' }}>
                    {res.validVotes.toLocaleString('pt-BR')} ({res.validPercentage}%)
                  </span>
                </div>
                <div className="bu-stat-cell">
                  <span className="bu-stat-label">EM BRANCO</span>
                  <span className="bu-stat-val">{res.blank.toLocaleString('pt-BR')} ({res.blankPercentage}%)</span>
                </div>
                <div className="bu-stat-cell">
                  <span className="bu-stat-label">VOTOS NULOS</span>
                  <span className="bu-stat-val" style={{ color: '#b91c1c' }}>
                    {res.null.toLocaleString('pt-BR')} ({res.nullPercentage}%)
                  </span>
                </div>
              </div>

              {/* Informações de Quociente e Distribuição Partidária (se proporcional) */}
              {isProporcional && (
                <div style={{ padding: '0.6rem 0.85rem', background: '#fffbeb', borderBottom: '1px solid #fef3c7', fontSize: '8pt' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: res.partyResults && res.partyResults.length > 0 ? '6px' : '0' }}>
                    <span style={{ fontWeight: 700, color: '#92400e' }}>
                      REGRA PROPORCIONAL (MÉTODO D'HONDT)
                    </span>
                    {res.electoralQuotient != null && (
                      <span style={{ fontWeight: 700, color: '#92400e' }}>
                        Quociente Eleitoral (QE): <strong>{res.electoralQuotient}</strong> votos/vaga
                      </span>
                    )}
                  </div>

                  {res.partyResults && res.partyResults.length > 0 && (
                    <table className="bu-party-table">
                      <thead>
                        <tr>
                          <th>Partido</th>
                          <th>Votos Nominais</th>
                          <th>% Válidos</th>
                          <th>Vagas QP</th>
                          <th>Sobras D'Hondt</th>
                          <th>Total Cadeiras</th>
                        </tr>
                      </thead>
                      <tbody>
                        {res.partyResults.map((pr) => (
                          <tr key={pr.party}>
                            <td>{pr.party}</td>
                            <td>{pr.votes.toLocaleString('pt-BR')}</td>
                            <td>{pr.percentage}%</td>
                            <td>{pr.directSeats}</td>
                            <td>{pr.leftoverSeats}</td>
                            <td style={{ fontWeight: 800, color: '#92400e' }}>{pr.totalSeats}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Tabela de Candidatos */}
              <table className="bu-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>Pos.</th>
                    <th>Candidato</th>
                    <th style={{ width: '60px' }}>Nº</th>
                    <th style={{ width: '80px' }}>Partido</th>
                    <th style={{ width: '80px', textAlign: 'right' }}>Votos</th>
                    <th style={{ width: '70px', textAlign: 'right' }}>% Válidos</th>
                    {isProporcional && <th>Critério / Razão</th>}
                    <th style={{ width: '95px', textAlign: 'center' }}>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {res.candidates.length === 0 ? (
                    <tr>
                      <td colSpan={isProporcional ? 8 : 7} style={{ textAlign: 'center', padding: '1rem', color: '#64748b' }}>
                        Nenhum voto nominal computado para este cargo.
                      </td>
                    </tr>
                  ) : (
                    res.candidates.map((c, idx) => {
                      const isElected = c.isElected ?? (idx < res.electionPosition.slots && c.votes > 0);
                      return (
                        <tr key={c.candidate.id} className={isElected ? 'bu-row-elected' : ''}>
                          <td style={{ fontWeight: 700, color: isElected ? '#15803d' : '#4b5563' }}>
                            {idx + 1}º
                          </td>
                          <td style={{ fontWeight: isElected ? 700 : 500 }}>
                            {c.candidate.electoralName}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>{c.candidate.number}</td>
                          <td style={{ fontWeight: 600 }}>{c.candidate.party}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>
                            {c.votes.toLocaleString('pt-BR')}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: isElected ? 700 : 400 }}>
                            {c.percentage}%
                          </td>
                          {isProporcional && (
                            <td style={{ fontSize: '7.5pt', color: c.electedReason ? '#92400e' : '#6b7280' }}>
                              {c.electedReason || '—'}
                            </td>
                          )}
                          <td style={{ textAlign: 'center' }}>
                            {isElected ? (
                              <span className="bu-badge-elected">ELEITO</span>
                            ) : (
                              <span className="bu-badge-not-elected">NÃO ELEITO</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {/* Linhas de Fechamento */}
                  <tr style={{ background: '#f8fafc', fontWeight: 600 }}>
                    <td colSpan={4} style={{ textAlign: 'right', color: '#4b5563' }}>Votos em Branco:</td>
                    <td style={{ textAlign: 'right' }}>{res.blank.toLocaleString('pt-BR')}</td>
                    <td style={{ textAlign: 'right', color: '#64748b' }}>{res.blankPercentage}%</td>
                    {isProporcional && <td>—</td>}
                    <td></td>
                  </tr>
                  <tr style={{ background: '#f8fafc', fontWeight: 600 }}>
                    <td colSpan={4} style={{ textAlign: 'right', color: '#4b5563' }}>Votos Nulos:</td>
                    <td style={{ textAlign: 'right' }}>{res.null.toLocaleString('pt-BR')}</td>
                    <td style={{ textAlign: 'right', color: '#64748b' }}>{res.nullPercentage}%</td>
                    {isProporcional && <td>—</td>}
                    <td></td>
                  </tr>
                  <tr style={{ background: '#f1f5f9', fontWeight: 800, borderTop: '2px solid #cbd5e1' }}>
                    <td colSpan={4} style={{ textAlign: 'right', color: '#1e293b' }}>TOTAL GERAL COMPUTADO:</td>
                    <td style={{ textAlign: 'right', color: '#1e293b' }}>{res.totalVotes.toLocaleString('pt-BR')}</td>
                    <td style={{ textAlign: 'right', color: '#1e293b' }}>100.00%</td>
                    {isProporcional && <td>—</td>}
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      {/* ── RODAPÉ DE AUTENTICIDADE E ASSINATURAS ── */}
      <div className="bu-footer">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontWeight: 800, color: '#1f2937', marginBottom: '2px' }}>
              TERMO DE ENCERRAMENTO E AUTENTICAÇÃO OFICIAL
            </div>
            <div>Documento extraído eletronicamente pelo Sistema de Votação NGV.</div>
            <div>A veracidade desta totalização pode ser confirmada pelos registros do banco de dados e logs de auditoria.</div>
            <div style={{ marginTop: '4px', fontFamily: 'var(--font-mono)', fontSize: '7.5pt', color: '#1e3a5f' }}>
              CHAVE DE VALIDAÇÃO: {authHash}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div>Emissão: {emissionDate}</div>
            <div style={{ fontWeight: 700, color: '#1f2937' }}>Urna Eletrônica NGV v1.0</div>
          </div>
        </div>

        <div className="bu-signatures">
          <div>
            <div style={{ height: '35px' }}></div>
            <div className="bu-sign-line">Presidente da Mesa Receptora / Apuradora</div>
          </div>
          <div>
            <div style={{ height: '35px' }}></div>
            <div className="bu-sign-line">Fiscal / Representante Partidário</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ResultsPage: React.FC = () => {
  const [elections, setElections] = useState<Election[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState('');
  const [selectedStateId, setSelectedStateId] = useState('');
  const [resultsData, setResultsData] = useState<{
    election: any;
    overview: ResultsOverview;
    results: ElectionResult[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSlots, setExpandedSlots] = useState<Record<string, boolean>>({});
  const [showBuPreview, setShowBuPreview] = useState(false);

  const toggleSlotDetails = (positionId: string) => {
    setExpandedSlots((prev) => ({ ...prev, [positionId]: !prev[positionId] }));
  };

  useEffect(() => {
    Promise.all([electionsApi.getAll(), statesApi.getActive()])
      .then(([elecs, sts]) => {
        setElections(elecs);
        setStates(sts);
        if (elecs.length > 0) {
          setSelectedElectionId(elecs[0].id);
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Erro ao carregar dados:', err);
        toast.error('Erro ao carregar dados iniciais');
        setLoading(false);
      });
  }, []);

  const fetchResults = () => {
    if (!selectedElectionId) return;
    setLoading(true);

    resultsApi
      .getResults(selectedElectionId, selectedStateId || undefined)
      .then(setResultsData)
      .catch((err) => {
        toast.error(err.response?.data?.error || 'Erro ao carregar apuração dos resultados');
        setResultsData(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchResults();
  }, [selectedElectionId, selectedStateId]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = async () => {
    if (!selectedElectionId) return;
    try {
      toast.loading('Gerando arquivo CSV do Boletim de Urna...', { id: 'csv-download' });
      const blob = await resultsApi.getCsv(selectedElectionId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const currentElec = elections.find((e) => e.id === selectedElectionId);
      const safeName = (currentElec?.name || 'apuracao').toLowerCase().replace(/[^a-z0-9]/gi, '_');
      a.download = `boletim_urna_${safeName}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Boletim de Urna exportado em CSV com sucesso!', { id: 'csv-download' });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao exportar resultados em CSV', { id: 'csv-download' });
    }
  };

  const currentElec = elections.find((e) => e.id === selectedElectionId);
  const currentState = states.find((s) => s.id === selectedStateId);
  const emissionDate = new Date().toLocaleString('pt-BR');
  const authHash = selectedElectionId
    ? `BU-${selectedElectionId.replace(/-/g, '').slice(0, 8).toUpperCase()}.${resultsData?.overview?.totalVotes || 0}.${currentElec?.year || 2026}`
    : 'BU-OFICIAL-NGV';

  return (
    <>
      {/* ── VISUALIZAÇÃO INTERATIVA EM TELA (OCULTA NO PRINT / PDF) ── */}
      <div className="results-screen-view" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Topo com controles */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white' }}>Apuração Oficial & Resultados</h1>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Totalização e Boletim de Urna dos cargos e candidatos — Regra Oficial de Votos Válidos
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={fetchResults}
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
            Atualizar Apuração
          </button>

          <button
            onClick={() => setShowBuPreview(true)}
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
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title="Visualizar modelo oficial do Boletim de Urna (A4) na tela antes de imprimir"
          >
            <Eye size={16} /> Prévia do BU
          </button>

          <button
            onClick={handlePrint}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: 'linear-gradient(135deg, #1e3d5e, #1565c0)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title="Imprimir ou Salvar em PDF o Boletim de Urna Oficial"
          >
            <Printer size={16} /> Imprimir / Salvar PDF
          </button>

          <button
            onClick={handleExportCsv}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: '#059669',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Download size={16} /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Seletores de Eleição e Filtro Opcional de Estado */}
      <div className="admin-card" style={{ padding: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 250px' }}>
          <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>
            SELECIONAR ELEIÇÃO
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
            {elections.map((elec) => (
              <option key={elec.id} value={elec.id}>
                {elec.name} ({elec.year}) — {elec.status}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>
            FILTRAR CARGOS POR ESTADO (OPCIONAL)
          </label>
          <select
            value={selectedStateId}
            onChange={(e) => setSelectedStateId(e.target.value)}
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
            <option value="">Brasil (Nacional / Consolidado)</option>
            {states.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name} ({st.abbreviation})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── PAINEL GERAL: TOTAL DE VOTOS E VOTOS POR ESTADO (SEM PRECISAR FILTRAR) ── */}
      {resultsData?.overview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Cards de Métricas Gerais */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="admin-card" style={{ padding: '1.25rem', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>TOTAL GERAL DE VOTOS</span>
                <Vote size={18} color="#3b82f6" />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'white', marginTop: '0.35rem' }}>
                {resultsData.overview.totalVotes.toLocaleString('pt-BR')}
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Votos computados em todos os cargos</span>
            </div>

            <div className="admin-card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>ELEITORES QUE VOTARAM</span>
                <Users size={18} color="#10b981" />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'white', marginTop: '0.35rem' }}>
                {resultsData.overview.totalVoters.toLocaleString('pt-BR')}
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Sessões de votação concluídas</span>
            </div>

            <div className="admin-card" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>ESTADOS PARTICIPANTES</span>
                <MapPin size={18} color="#f59e0b" />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'white', marginTop: '0.35rem' }}>
                {resultsData.overview.byState.length}
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>UFs com eleitores registrados</span>
            </div>
          </div>

          {/* Grid de Totais por Estado (Permanente, sem filtro) */}
          <div className="admin-card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <MapPin size={18} color="#60a5fa" />
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'white' }}>
                Eleitores Votantes por Estado
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: 'auto' }}>
                Pessoas participantes de cada UF nesta eleição
              </span>
            </div>

            {resultsData.overview.byState.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1rem', color: '#64748b', fontSize: '0.85rem' }}>
                Nenhum estado participante registrado nesta eleição.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '0.75rem',
                }}
              >
                {resultsData.overview.byState.map((st) => (
                  <div
                    key={st.state.id}
                    style={{
                      background: selectedStateId === st.state.id ? 'rgba(59, 130, 246, 0.15)' : '#0f172a',
                      border: selectedStateId === st.state.id ? '1px solid #3b82f6' : '1px solid #334155',
                      borderRadius: '8px',
                      padding: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onClick={() => setSelectedStateId(selectedStateId === st.state.id ? '' : st.state.id)}
                    title="Clique para filtrar/desfiltrar este estado nos cargos"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'white' }}>
                        {st.state.abbreviation}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {st.state.name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#60a5fa' }}>
                        {(st.voters ?? st.votes).toLocaleString('pt-BR')}{' '}
                        <span style={{ fontSize: '0.7rem', fontWeight: 500, color: '#94a3b8' }}>
                          {(st.voters ?? st.votes) === 1 ? 'eleitor' : 'eleitores'}
                        </span>
                      </span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4ade80' }}>
                        {st.percentage}%
                      </span>
                    </div>

                    {/* Barra de participação */}
                    <div
                      style={{
                        width: '100%',
                        height: '5px',
                        background: '#1e293b',
                        borderRadius: '999px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${st.percentage}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                          borderRadius: '999px',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resultados por Cargo */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          Totalizando os votos computados...
        </div>
      ) : !resultsData || resultsData.results.length === 0 ? (
        <div className="admin-card" style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
          Nenhum resultado disponível para esta seleção.
        </div>
      ) : (
        resultsData.results.map((res) => {
          // Dados para o Gráfico de Círculo Consolidado (apenas candidatos válidos)
          const pieData = res.candidates.map((c) => ({
            name: `${c.candidate.electoralName} (${c.candidate.party})`,
            number: c.candidate.number,
            party: c.candidate.party,
            votes: c.votes,
            percentage: c.percentage,
          }));

          const isMultiSlot = res.electionPosition.slots > 1;

          return (
            <div key={res.electionPosition.id} className="admin-card" style={{ padding: '1.5rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.25rem',
                  borderBottom: '1px solid #334155',
                  paddingBottom: '0.75rem',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white', textTransform: 'uppercase' }}>
                    {res.electionPosition.name}
                  </h2>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '4px',
                        padding: '2px 8px',
                        color: '#94a3b8',
                      }}
                    >
                      Ordem de votação: {res.electionPosition.order}º
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        background: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '4px',
                        padding: '2px 8px',
                        color: '#60a5fa',
                      }}
                    >
                      {res.electionPosition.slots} {res.electionPosition.slots === 1 ? 'vaga' : 'vagas'}
                    </span>
                    {/* Badge: Sistema de Votação */}
                    <span
                      style={{
                        fontSize: '0.75rem',
                        background: (res.votingSystem || 'MAJORITARIO') === 'PROPORCIONAL'
                          ? 'rgba(245, 158, 11, 0.15)' : 'rgba(100, 116, 139, 0.12)',
                        border: `1px solid ${(res.votingSystem || 'MAJORITARIO') === 'PROPORCIONAL' ? 'rgba(245,158,11,0.35)' : 'rgba(100,116,139,0.3)'}`,
                        borderRadius: '4px',
                        padding: '2px 8px',
                        color: (res.votingSystem || 'MAJORITARIO') === 'PROPORCIONAL' ? '#fbbf24' : '#94a3b8',
                        fontWeight: 700,
                      }}
                    >
                      {(res.votingSystem || 'MAJORITARIO') === 'PROPORCIONAL' ? '⊖ Proporcional (D’Hondt)' : '✓ Majoritário'}
                    </span>
                    {isMultiSlot && (res.votingSystem || 'MAJORITARIO') !== 'PROPORCIONAL' && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          background: 'rgba(74, 222, 128, 0.1)',
                          border: '1px solid rgba(74, 222, 128, 0.3)',
                          borderRadius: '4px',
                          padding: '2px 8px',
                          color: '#4ade80',
                          fontWeight: 700,
                        }}
                      >
                        🏆 Os {res.electionPosition.slots} mais votados no total são eleitos
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Resumo Consolidado de Votos do Cargo */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '0.75rem',
                  marginBottom: '1.25rem',
                  padding: '0.75rem',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>TOTAL DE VOTOS</span>
                  <strong style={{ fontSize: '1.1rem', color: 'white' }}>{res.totalVotes}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>VOTOS VÁLIDOS</span>
                  <strong style={{ fontSize: '1.1rem', color: '#4ade80' }}>
                    {res.validVotes} ({res.validPercentage}%)
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>EM BRANCO</span>
                  <strong style={{ fontSize: '1.1rem', color: '#cbd5e1' }}>
                    {res.blank} ({res.blankPercentage}%)
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>VOTOS NULOS</span>
                  <strong style={{ fontSize: '1.1rem', color: '#f87171' }}>
                    {res.null} ({res.nullPercentage}%)
                  </strong>
                </div>
              </div>

              {/* Aviso da regra eleitoral oficial (CF/88 / TSE) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: (res.votingSystem || 'MAJORITARIO') === 'PROPORCIONAL'
                    ? 'rgba(245, 158, 11, 0.08)' : 'rgba(59, 130, 246, 0.1)',
                  border: `1px solid ${(res.votingSystem || 'MAJORITARIO') === 'PROPORCIONAL' ? 'rgba(245,158,11,0.25)' : 'rgba(59, 130, 246, 0.25)'}`,
                  borderRadius: '6px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.75rem',
                  color: (res.votingSystem || 'MAJORITARIO') === 'PROPORCIONAL' ? '#fde68a' : '#93c5fd',
                  marginBottom: '1.25rem',
                }}
              >
                <CheckCircle2 size={15} color={(res.votingSystem || 'MAJORITARIO') === 'PROPORCIONAL' ? '#f59e0b' : '#60a5fa'} style={{ flexShrink: 0 }} />
                <span>
                  {(res.votingSystem || 'MAJORITARIO') === 'PROPORCIONAL' ? (
                    <>
                      <strong>Sistema Proporcional (D’Hondt):</strong> Vagas distribuídas entre partidos por Quociente Eleitoral.
                      {res.electoralQuotient != null && (
                        <> QE = <strong>{res.electoralQuotient}</strong> votos/vaga.</>                      )}
                      {' '}Eleitos são os mais votados dentro de cada partido até o limite de vagas do partido.
                    </>
                  ) : (
                    <>
                      <strong>Regra Eleitoral Oficial:</strong> As porcentagens são calculadas sobre os <strong>votos válidos</strong>.
                      {isMultiSlot && (
                        <> Os <strong>{res.electionPosition.slots} candidatos mais votados</strong> são declarados eleitos.</>
                      )}
                    </>
                  )}
                </span>
              </div>

              {/* Tabela de Resultado por Partido (apenas para Proporcional) */}
              {(res.votingSystem || 'MAJORITARIO') === 'PROPORCIONAL' && res.partyResults && res.partyResults.length > 0 && (
                <div
                  style={{
                    background: '#0f172a',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1.25rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <Layers size={16} color="#fbbf24" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fbbf24' }}>Distribuição de Vagas por Partido</span>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #334155' }}>
                          {['Partido', 'Votos', '% Votos', 'Vagas QP', 'Sobras', 'Total Vagas'].map((h) => (
                            <th key={h} style={{ padding: '0.4rem 0.6rem', textAlign: 'right', color: '#94a3b8', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {res.partyResults.map((pr, idx) => (
                          <tr key={pr.party} style={{ borderBottom: '1px solid rgba(51,65,85,0.5)', background: idx % 2 === 0 ? 'transparent' : 'rgba(15,23,42,0.4)' }}>
                            <td style={{ padding: '0.4rem 0.6rem', fontWeight: 700, color: 'white' }}>{pr.party}</td>
                            <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', color: '#e2e8f0' }}>{pr.votes}</td>
                            <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', color: '#94a3b8' }}>{pr.percentage}%</td>
                            <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', color: '#60a5fa' }}>{pr.directSeats}</td>
                            <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', color: '#c084fc' }}>{pr.leftoverSeats}</td>
                            <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>
                              <span style={{ background: 'rgba(250,204,21,0.15)', color: '#fbbf24', padding: '2px 8px', borderRadius: '4px', fontWeight: 800 }}>
                                {pr.totalSeats}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {res.candidates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b', fontSize: '0.85rem' }}>
                  Nenhum voto nominal recebido para este cargo ainda.
                </div>
              ) : (
                <div className="results-grid-layout">
                  {/* ── GRÁFICO DE CÍRCULO (DONUT CHART) COM RECHARTS ── */}
                  <div
                    style={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                      <PieIcon size={16} color="#60a5fa" />
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'white' }}>
                        Distribuição dos Votos Válidos
                      </span>
                    </div>

                    <div style={{ width: '100%', height: '220px', position: 'relative' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            dataKey="votes"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={3}
                          >
                            {pieData.map((_, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={CHART_COLORS[index % CHART_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div
                                    style={{
                                      background: '#0f172a',
                                      border: '1px solid #334155',
                                      borderRadius: '6px',
                                      padding: '0.5rem 0.75rem',
                                      fontSize: '0.75rem',
                                      color: 'white',
                                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
                                    }}
                                  >
                                    <div style={{ fontWeight: 700 }}>{data.name}</div>
                                    <div style={{ color: '#4ade80', marginTop: '2px' }}>
                                      {data.votes} votos ({data.percentage}%)
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>

                      {/* Centro do donut */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          textAlign: 'center',
                          pointerEvents: 'none',
                        }}
                      >
                        <span style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'block' }}>VÁLIDOS</span>
                        <strong style={{ fontSize: '1.2rem', color: '#4ade80' }}>{res.validVotes}</strong>
                      </div>
                    </div>

                    {/* Legenda compacta do gráfico */}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.4rem',
                        justifyContent: 'center',
                        marginTop: '0.5rem',
                        fontSize: '0.7rem',
                      }}
                    >
                      {pieData.map((item, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            background: '#1e293b',
                            padding: '0.2rem 0.45rem',
                            borderRadius: '4px',
                          }}
                        >
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: CHART_COLORS[idx % CHART_COLORS.length],
                              display: 'inline-block',
                            }}
                          />
                          <span style={{ color: '#cbd5e1' }}>{item.party}</span>
                          <strong style={{ color: 'white' }}>{item.percentage}%</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── TABELA DE CANDIDATOS CLASSIFICADOS CONSOLIDADA ── */}
                  <div className="admin-table-wrapper">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th style={{ width: '45px' }}>Pos.</th>
                          <th>Candidato</th>
                          <th>Partido</th>
                          <th>Votos Totais</th>
                          <th style={{ width: '30%' }}>% Votos Válidos</th>
                          {(res.votingSystem || 'MAJORITARIO') === 'PROPORCIONAL' && (
                            <th>Razão</th>
                          )}
                          <th style={{ width: '110px' }}>Situação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {res.candidates.map((c, idx) => {
                          const isElected = c.isElected ?? (idx < res.electionPosition.slots && c.votes > 0);
                          const barColor = CHART_COLORS[idx % CHART_COLORS.length];

                          return (
                            <tr
                              key={c.candidate.id}
                              style={{
                                background: isElected ? 'rgba(74, 222, 128, 0.04)' : undefined,
                              }}
                            >
                              <td>
                                <span
                                  style={{
                                    fontWeight: 800,
                                    fontSize: '0.9rem',
                                    color: isElected ? '#4ade80' : '#94a3b8',
                                  }}
                                >
                                  {idx + 1}º
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                  {c.candidate.photoUrl ? (
                                    <img
                                      src={c.candidate.photoUrl}
                                      alt={c.candidate.electoralName}
                                      style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                        border: isElected ? '2px solid #4ade80' : '1px solid #475569',
                                        flexShrink: 0,
                                      }}
                                    />
                                  ) : null}
                                  <strong style={{ color: 'white' }}>{c.candidate.electoralName}</strong>
                                  <span
                                    style={{
                                      fontFamily: 'var(--font-mono)',
                                      fontSize: '0.8rem',
                                      color: '#60a5fa',
                                    }}
                                  >
                                    ({c.candidate.number})
                                  </span>
                                </div>
                              </td>
                              <td>
                                <span style={{ fontWeight: 600, color: '#cbd5e1' }}>
                                  {c.candidate.party}
                                </span>
                              </td>
                              <td>
                                <strong style={{ color: 'white', fontSize: '0.95rem' }}>
                                  {c.votes.toLocaleString('pt-BR')}
                                </strong>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                  <div
                                    style={{
                                      flex: 1,
                                      height: '9px',
                                      background: '#334155',
                                      borderRadius: '999px',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: `${c.percentage}%`,
                                        height: '100%',
                                        background: barColor,
                                        borderRadius: '999px',
                                      }}
                                    />
                                  </div>
                                  <span
                                    style={{
                                      fontSize: '0.85rem',
                                      fontWeight: 700,
                                      color: isElected ? '#4ade80' : 'white',
                                      minWidth: '52px',
                                    }}
                                  >
                                    {c.percentage}%
                                  </span>
                                </div>
                              </td>
                              {(res.votingSystem || 'MAJORITARIO') === 'PROPORCIONAL' && (
                                <td style={{ fontSize: '0.72rem', color: c.electedReason ? '#fbbf24' : '#64748b', maxWidth: '150px' }}>
                                  {c.electedReason || '—'}
                                </td>
                              )}
                              <td>
                                {isElected ? (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      background: 'rgba(34, 197, 94, 0.15)',
                                      color: '#4ade80',
                                      border: '1px solid rgba(74, 222, 128, 0.4)',
                                      borderRadius: '6px',
                                      padding: '2px 8px',
                                      fontSize: '0.75rem',
                                      fontWeight: 800,
                                    }}
                                  >
                                    <Award size={13} color="#4ade80" /> ELEITO
                                  </span>
                                ) : (
                                  <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>
                                    NÃO ELEITO
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── AUDITORIA INDIVIDUAL POR VAGA (SE MULTI-VAGAS) ── */}
              {isMultiSlot && (
                <div style={{ marginTop: '1.25rem', borderTop: '1px solid #1e293b', paddingTop: '1rem' }}>
                  <button
                    onClick={() => toggleSlotDetails(res.electionPosition.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      color: '#94a3b8',
                      borderRadius: '6px',
                      padding: '0.45rem 0.85rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <Layers size={14} color="#60a5fa" />
                    {expandedSlots[res.electionPosition.id]
                      ? 'Ocultar detalhamento por vaga individual'
                      : `Ver auditoria por vaga de votação (Vagas 1 a ${res.electionPosition.slots})`}
                    {expandedSlots[res.electionPosition.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {expandedSlots[res.electionPosition.id] && (
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {res.slots.map((s) => (
                        <div
                          key={s.slot}
                          style={{
                            background: '#0a0f1d',
                            border: '1px solid #1e293b',
                            borderRadius: '8px',
                            padding: '1rem',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '0.75rem',
                              flexWrap: 'wrap',
                              gap: '0.5rem',
                            }}
                          >
                            <strong style={{ fontSize: '0.85rem', color: '#60a5fa' }}>
                              Cédula / Vaga {s.slot} de {res.electionPosition.slots}
                            </strong>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                              Total nesta vaga: <strong>{s.totalVotes}</strong> | Válidos: <strong style={{ color: '#4ade80' }}>{s.validVotes}</strong> | Brancos: {s.blank} | Nulos: {s.null}
                            </span>
                          </div>

                          {s.candidates.length === 0 ? (
                            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
                              Nenhum voto nominal registrado para a vaga {s.slot}.
                            </p>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                              {s.candidates.map((sc) => (
                                <div
                                  key={sc.candidate.id}
                                  style={{
                                    background: '#1e293b',
                                    borderRadius: '6px',
                                    padding: '0.4rem 0.75rem',
                                    fontSize: '0.75rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                  }}
                                >
                                  <span style={{ color: 'white', fontWeight: 600 }}>{sc.candidate.electoralName}</span>
                                  <span style={{ color: '#60a5fa' }}>({sc.candidate.number})</span>
                                  <strong style={{ color: '#4ade80' }}>{sc.votes} votos</strong>
                                  <span style={{ color: '#94a3b8' }}>({sc.percentage}%)</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
      {/* Fim da visualização interativa em tela */}
      </div>

      {/* ── DOCUMENTO OFICIAL PARA IMPRESSÃO NATIVA (VISÍVEL APENAS NO PRINT / SALVAR PDF) ── */}
      {resultsData && (
        <div className="bu-print-document">
          <BoletimUrnaDocument
            election={resultsData.election || currentElec}
            overview={resultsData.overview}
            results={resultsData.results}
            selectedState={currentState}
            emissionDate={emissionDate}
            authHash={authHash}
          />
        </div>
      )}

      {/* ── MODAL DE PRÉVIA DO BOLETIM DE URNA NA TELA ── */}
      {showBuPreview && resultsData && (
        <div className="bu-preview-modal-overlay" onClick={() => setShowBuPreview(false)}>
          <div className="bu-preview-container animate-fade-in-scale" onClick={(e) => e.stopPropagation()}>
            <div className="bu-preview-header-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <FileText size={20} color="#60a5fa" />
                <div>
                  <strong style={{ fontSize: '0.95rem', color: 'white', display: 'block' }}>
                    Pré-visualização Oficial do Boletim de Urna (BU)
                  </strong>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    Padrão A4 oficial da Justiça Eleitoral — Pronto para impressão ou salvamento em PDF
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  onClick={handlePrint}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.45rem 1rem',
                    background: 'linear-gradient(135deg, #1e3d5e, #1565c0)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Printer size={15} /> Imprimir / Salvar PDF
                </button>
                <button
                  onClick={() => setShowBuPreview(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '0.3rem',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Fechar prévia"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <BoletimUrnaDocument
              election={resultsData.election || currentElec}
              overview={resultsData.overview}
              results={resultsData.results}
              selectedState={currentState}
              emissionDate={emissionDate}
              authHash={authHash}
            />
          </div>
        </div>
      )}
    </>
  );
};

