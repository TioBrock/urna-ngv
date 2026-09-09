import React, { useEffect, useState } from 'react';
import { statesApi } from '../../services/api';
import { State } from '../../types';
import toast from 'react-hot-toast';

export const StatesPage: React.FC = () => {
  const [states, setStates] = useState<(State & { _count?: { voterSessions: number } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchStates = (showLoading = true) => {
    if (showLoading) setLoading(true);
    statesApi
      .getAll()
      .then(setStates)
      .catch(() => toast.error('Erro ao listar estados'))
      .finally(() => {
        if (showLoading) setLoading(false);
      });
  };

  useEffect(() => {
    fetchStates(true);
  }, []);

  const handleToggleActive = async (id: string, current: boolean, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const next = !current;

    // Atualização otimista imediata: mantém o scroll e a tabela intacta
    setStates((prev) =>
      prev.map((st) => (st.id === id ? { ...st, isActive: next } : st))
    );
    setTogglingId(id);

    try {
      await statesApi.update(id, { isActive: next });
      toast.success(`Estado ${next ? 'ativado' : 'desativado'} com sucesso`);
    } catch {
      // Reverter se der erro
      setStates((prev) =>
        prev.map((st) => (st.id === id ? { ...st, isActive: current } : st))
      );
      toast.error('Erro ao atualizar status do estado');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white' }}>Estados & Regiões Eleitorais</h1>
        <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
          Unidades federativas do Brasil disponíveis para o colégio eleitoral do RPG
        </p>
      </div>

      <div className="admin-card">
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Sigla / UF</th>
                <th>Nome do Estado</th>
                <th>Status</th>
                <th>Sessões de Eleitores</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                    Carregando estados...
                  </td>
                </tr>
              ) : states.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    Nenhum estado cadastrado.
                  </td>
                </tr>
              ) : (
                states.map((st) => (
                  <tr key={st.id}>
                    <td>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          fontSize: '0.9rem',
                          padding: '0.2rem 0.5rem',
                          background: 'rgba(59, 130, 246, 0.15)',
                          color: '#60a5fa',
                          borderRadius: '4px',
                        }}
                      >
                        {st.abbreviation}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: 'white' }}>{st.name}</strong>
                    </td>
                    <td>
                      <span
                        style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          background: st.isActive !== false ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: st.isActive !== false ? '#4ade80' : '#f87171',
                        }}
                      >
                        {st.isActive !== false ? 'ATIVO' : 'INATIVO'}
                      </span>
                    </td>
                    <td>{st._count?.voterSessions ?? 0} eleitor(es)</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        disabled={togglingId === st.id}
                        onClick={(e) => handleToggleActive(st.id, st.isActive !== false, e)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          background: st.isActive !== false ? '#334155' : 'rgba(34, 197, 94, 0.2)',
                          color: st.isActive !== false ? '#cbd5e1' : '#4ade80',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          cursor: togglingId === st.id ? 'wait' : 'pointer',
                          opacity: togglingId === st.id ? 0.6 : 1,
                        }}
                      >
                        {st.isActive !== false ? 'Desativar' : 'Ativar'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
