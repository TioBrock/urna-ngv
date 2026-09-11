import React from 'react';

export const NoElectionPage: React.FC = () => {
  return (
    <div className="identification-page">
      <div className="identification-card animate-fade-in-up" style={{ textAlign: 'center', padding: '2.5rem 2rem' }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            background: 'linear-gradient(135deg, #1e3d5e, #2d5986)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem',
            fontSize: '1.8rem',
            color: 'white',
          }}
        >
          🗳️
        </div>

        <h1
          style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            color: '#1a3a5c',
            textTransform: 'uppercase',
            marginBottom: '0.5rem',
          }}
        >
          Nenhuma Eleição Aberta
        </h1>

        <p style={{ fontSize: '0.85rem', color: '#6b7a99', lineHeight: '1.5', marginBottom: '1.5rem' }}>
          Não há nenhuma eleição com votação aberta no momento. Fique atento aos anúncios da Justiça Eleitoral no Discord do RPG para saber a abertura do próximo pleito.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary"
            style={{
              padding: '0.65rem 1.25rem',
              fontSize: '0.85rem',
              width: 'auto',
              cursor: 'pointer',
            }}
          >
            Verificar Novamente
          </button>
        </div>
      </div>
    </div>
  );
};
