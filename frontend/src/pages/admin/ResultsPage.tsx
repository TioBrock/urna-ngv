import React, { useEffect, useState } from 'react';
import { resultsApi, electionsApi, statesApi } from '../../services/api';
import { Election, State, ElectionResult } from '../../types';
import { Award, Printer, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export const ResultsPage: React.FC = () => {
  const [elections, setElections] = useState<Election[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState('');
  const [selectedStateId, setSelectedStateId] = useState('');
  const [resultsData, setResultsData] = useState<{ election: any; results: ElectionResult[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([electionsApi.getAll(), statesApi.getActive()]).then(([elecs, sts]) => {
      setElections(elecs);
      setStates(sts);
      if (elecs.length > 0) {
        setSelectedElectionId(elecs[0].id);
      }
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
            Totalização e Boletim de Urna dos cargos e candidatos
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

      {/* Seletores de Eleição e Estado */}
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
            FILTRAR POR ESTADO (UF)
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {res.slots.map((s) => {
                const totalValid = s.candidates.reduce((sum, c) => sum + c.votes, 0);

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
                        marginBottom: '1rem',
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
                        <strong style={{ fontSize: '1.1rem', color: '#4ade80' }}>{totalValid}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>VOTOS EM BRANCO</span>
                        <strong style={{ fontSize: '1.1rem', color: '#cbd5e1' }}>{s.blank}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>VOTOS NULOS</span>
                        <strong style={{ fontSize: '1.1rem', color: '#f87171' }}>{s.null}</strong>
                      </div>
                    </div>

                    {/* Tabela de Candidatos Classificados */}
                    {s.candidates.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b', fontSize: '0.85rem' }}>
                        Nenhum voto nominal recebido para esta vaga ainda.
                      </div>
                    ) : (
                      <div className="admin-table-wrapper">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th style={{ width: '50px' }}>Colocação</th>
                              <th>Candidato</th>
                              <th>Partido</th>
                              <th>Votos</th>
                              <th style={{ width: '40%' }}>Percentual & Barra</th>
                            </tr>
                          </thead>
                          <tbody>
                            {s.candidates.map((c, idx) => {
                              const isElected = idx === 0; // Primeiro colocado
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
                                        <span title="Candidato Líder / Eleito" style={{ display: 'inline-flex' }}>
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
                                          height: '10px',
                                          background: '#334155',
                                          borderRadius: '999px',
                                          overflow: 'hidden',
                                        }}
                                      >
                                        <div
                                          style={{
                                            width: `${c.percentage}%`,
                                            height: '100%',
                                            background: isElected
                                              ? 'linear-gradient(90deg, #16a34a, #4ade80)'
                                              : 'linear-gradient(90deg, #2563eb, #60a5fa)',
                                            borderRadius: '999px',
                                          }}
                                        />
                                      </div>
                                      <span
                                        style={{
                                          fontSize: '0.85rem',
                                          fontWeight: 700,
                                          color: isElected ? '#4ade80' : 'white',
                                          minWidth: '48px',
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
