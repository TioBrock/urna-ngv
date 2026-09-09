import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { votingApi, statesApi } from '../../services/api';
import { Election, State } from '../../types';
import toast from 'react-hot-toast';

export const IdentificationPage: React.FC = () => {
  const navigate = useNavigate();
  const [election, setElection] = useState<Election | null>(null);
  const [states, setStates] = useState<State[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [discordName, setDiscordName] = useState('');
  const [rpgName, setRpgName] = useState('');
  const [stateId, setStateId] = useState('');

  useEffect(() => {
    // Busca a eleição ativa
    votingApi
      .getActiveElection()
      .then((data: any) => {
        setElection(data);
        const activeElectionStates = (data.states || []).filter((st: any) => st.isActive !== false);
        if (activeElectionStates.length > 0) {
          setStates(activeElectionStates);
          setStateId(activeElectionStates[0].id);
        } else {
          // Fallback para buscar apenas estados ativos
          statesApi.getActive().then((sts) => {
            const activeOnly = (sts || []).filter((st: any) => st.isActive !== false);
            setStates(activeOnly);
            if (activeOnly.length > 0) setStateId(activeOnly[0].id);
          });
        }
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          navigate('/votar/sem-eleicao');
        } else {
          toast.error('Erro ao conectar com a Central Eleitoral');
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!election) return;
    if (!discordName.trim()) {
      toast.error('Por favor, informe seu usuário no Discord');
      return;
    }
    if (!rpgName.trim()) {
      toast.error('Por favor, informe o nome do seu personagem no RPG');
      return;
    }
    if (!stateId) {
      toast.error('Por favor, selecione seu Estado / UF eleitoral');
      return;
    }

    setSubmitting(true);

    try {
      const response = await votingApi.startVoting({
        electionId: election.id,
        discordName: discordName.trim(),
        rpgName: rpgName.trim(),
        stateId,
      });

      // Salva sessão localmente para a urna
      sessionStorage.setItem('urna_session', JSON.stringify(response));
      sessionStorage.setItem('urna_state_id', stateId);
      sessionStorage.setItem('urna_discord_name', discordName.trim());
      sessionStorage.setItem('urna_rpg_name', rpgName.trim());

      toast.success('Eleitor identificado! Iniciando urna...');
      navigate('/votar/urna');
    } catch (err: any) {
      if (err.response?.status === 409 && err.response?.data?.error === 'DUPLICATE_VOTE') {
        navigate('/votar/ja-votou');
      } else {
        const msg = err.response?.data?.error || 'Erro ao iniciar votação. Tente novamente.';
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="identification-page">
        <div style={{ color: 'white', textAlign: 'center' }}>
          <div className="animate-spin" style={{ fontSize: '2rem', marginBottom: '1rem' }}>
            ⏳
          </div>
          <p>Conectando aos servidores do Tribunal Eleitoral NGV...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="identification-page">
      <div className="identification-card animate-fade-in-up">
        <div className="identification-header">
          <div className="identification-header-icon" aria-hidden="true">
            🗳️
          </div>
          <h1>JUSTIÇA ELEITORAL NGV</h1>
          <p>{election?.name || 'Eleição Geral'}</p>
        </div>

        <form onSubmit={handleSubmit} className="identification-body">
          <div style={{ fontSize: '0.85rem', color: '#6b7a99', lineHeight: '1.4' }}>
            Identifique-se com suas credenciais do RPG para liberar a cabine de votação eletrônica.
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="discordName">
              Usuário no Discord <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              id="discordName"
              type="text"
              className="form-control"
              placeholder="Ex: usuario#0000 ou usuario"
              value={discordName}
              onChange={(e) => setDiscordName(e.target.value)}
              required
              disabled={submitting}
              autoFocus
            />
            <span style={{ fontSize: '0.7rem', color: '#9aa5be', marginTop: '4px' }}>
              Identificador único para verificação de voto único
            </span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="rpgName">
              Nome do Personagem no RPG <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              id="rpgName"
              type="text"
              className="form-control"
              placeholder="Ex: Senador Carlos Oliveira"
              value={rpgName}
              onChange={(e) => setRpgName(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="stateId">
              Título Eleitoral / Estado (UF) <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              id="stateId"
              className="form-control"
              value={stateId}
              onChange={(e) => setStateId(e.target.value)}
              required
              disabled={submitting}
            >
              {states.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} ({st.abbreviation})
                </option>
              ))}
            </select>
            <span style={{ fontSize: '0.7rem', color: '#9aa5be', marginTop: '4px' }}>
              Os candidatos estaduais exibidos serão filtrados por este estado
            </span>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '0.85rem',
              fontWeight: 700,
              fontSize: '0.9rem',
              marginTop: '0.5rem',
            }}
            disabled={submitting}
          >
            {submitting ? 'VALIDANDO IDENTIFICAÇÃO...' : 'ENTRAR NA CABINE DE VOTAÇÃO ➔'}
          </button>

          <div
            style={{
              textAlign: 'center',
              marginTop: '0.5rem',
              fontSize: '0.72rem',
              color: '#9aa5be',
            }}
          >
            🔒 Voto secreto protegido por criptografia de dados
          </div>
        </form>
      </div>
    </div>
  );
};
