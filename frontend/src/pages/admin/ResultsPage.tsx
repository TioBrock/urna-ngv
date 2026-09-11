import React, { useEffect, useState } from 'react';
import { resultsApi, electionsApi, statesApi } from '../../services/api';
import { Election, State, ElectionResult, ResultsOverview } from '../../types';
import { Award, Printer, RefreshCw, MapPin, Users, Vote, PieChart as PieIcon, CheckCircle2 } from 'lucide-react';
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
          >
            <Printer size={16} /> Imprimir Boletim (BU)
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
        resultsData.results.map((res) => (
          <div key={res.electionPosition.id} className="admin-card" style={{ padding: '1.5rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.25rem',
                borderBottom: '1px solid #334155',
                paddingBottom: '0.75rem',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'white', textTransform: 'uppercase' }}>
                  {res.electionPosition.name}
                </h2>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Ordem de votação: {res.electionPosition.order}º • Total de vagas:{' '}
                  {res.electionPosition.slots}
                </span>
              </div>
            </div>

            {/* Vagas (Slots) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {res.slots.map((s) => {
                // Dados para o Gráfico de Círculo (apenas candidatos válidos, conforme regra oficial)
                const pieData = s.candidates.map((c) => ({
                  name: `${c.candidate.electoralName} (${c.candidate.party})`,
                  number: c.candidate.number,
                  party: c.candidate.party,
                  votes: c.votes,
                  percentage: c.percentage,
                }));

                return (
                  <div
                    key={s.slot}
                    style={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '10px',
                      padding: '1.25rem',
                    }}
                  >
                    {res.electionPosition.slots > 1 && (
                      <div
                        style={{
                          fontSize: '0.9rem',
                          fontWeight: 700,
                          color: '#60a5fa',
                          marginBottom: '0.75rem',
                        }}
                      >
                        VAGA {s.slot} DE {res.electionPosition.slots}
                      </div>
                    )}

                    {/* Resumo de votos neste slot */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                        gap: '0.75rem',
                        marginBottom: '1.25rem',
                        padding: '0.75rem',
                        background: '#1e293b',
                        borderRadius: '8px',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>TOTAL DE VOTOS</span>
                        <strong style={{ fontSize: '1.1rem', color: 'white' }}>{s.totalVotes}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>VOTOS VÁLIDOS</span>
                        <strong style={{ fontSize: '1.1rem', color: '#4ade80' }}>
                          {s.validVotes} ({s.validPercentage}%)
                        </strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>EM BRANCO</span>
                        <strong style={{ fontSize: '1.1rem', color: '#cbd5e1' }}>
                          {s.blank} ({s.blankPercentage}%)
                        </strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>VOTOS NULOS</span>
                        <strong style={{ fontSize: '1.1rem', color: '#f87171' }}>
                          {s.null} ({s.nullPercentage}%)
                        </strong>
                      </div>
                    </div>

                    {/* Aviso da regra eleitoral oficial (CF/88 / TSE) */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.25)',
                        borderRadius: '6px',
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.75rem',
                        color: '#93c5fd',
                        marginBottom: '1.25rem',
                      }}
                    >
                      <CheckCircle2 size={15} color="#60a5fa" />
                      <span>
                        <strong>Regra Eleitoral Oficial:</strong> As porcentagens dos candidatos são calculadas exclusivamente sobre os <strong>votos válidos</strong> (brancos e nulos são desconsiderados para a definição do vencedor).
                      </span>
                    </div>

                    {s.candidates.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b', fontSize: '0.85rem' }}>
                        Nenhum voto nominal recebido para esta vaga ainda.
                      </div>
                    ) : (
                      <div className="results-grid-layout">
                        {/* ── GRÁFICO DE CÍRCULO (DONUT CHART) COM RECHARTS ── */}
                        <div
                          style={{
                            background: '#1e293b',
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
                              <strong style={{ fontSize: '1.2rem', color: '#4ade80' }}>{s.validVotes}</strong>
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
                                  background: '#0f172a',
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

                        {/* ── TABELA DE CANDIDATOS CLASSIFICADOS ── */}
                        <div className="admin-table-wrapper">
                          <table className="admin-table">
                            <thead>
                              <tr>
                                <th style={{ width: '45px' }}>Pos.</th>
                                <th>Candidato</th>
                                <th>Partido</th>
                                <th>Votos</th>
                                <th style={{ width: '38%' }}>% Votos Válidos</th>
                              </tr>
                            </thead>
                            <tbody>
                              {s.candidates.map((c, idx) => {
                                const isElected = idx === 0;
                                const barColor = CHART_COLORS[idx % CHART_COLORS.length];

                                return (
                                  <tr key={c.candidate.id}>
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
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {isElected && (
                                          <span title="Candidato Eleito / Líder" style={{ display: 'inline-flex' }}>
                                            <Award size={16} color="#4ade80" />
                                          </span>
                                        )}
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
                                      <strong style={{ color: 'white' }}>{c.votes}</strong>
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
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
};
