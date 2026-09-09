import React from 'react';
import { Link } from 'react-router-dom';

export const AlreadyVotedPage: React.FC = () => {
  return (
    <div className="already-voted-page">
      <div className="already-voted-card animate-fade-in-scale">
        <div className="already-voted-icon" aria-hidden="true">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>

        <h1
          style={{
            fontSize: '1.4rem',
            fontWeight: 800,
            color: '#b71c1c',
            textTransform: 'uppercase',
            marginBottom: '0.75rem',
            letterSpacing: '0.04em',
          }}
        >
          Voto Já Registrado
        </h1>

        <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '1rem', lineHeight: '1.5' }}>
          Consta em nossos registros que este acesso ou identificador eleitoral{' '}
          <strong>já computou um voto nesta eleição</strong>.
        </p>

        <div
          style={{
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            borderRadius: '8px',
            padding: '1rem',
            fontSize: '0.8rem',
            color: '#9f1239',
            textAlign: 'left',
            lineHeight: '1.4',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: '4px' }}>⚠️ Política de Integridade Eleitoral:</div>
          <div>
            Cada cidadão tem direito a um único voto por pleito para garantir a legitimidade e o equilíbrio da disputa política do RPG.
          </div>
          <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#881337' }}>
            Caso você acredite que isso ocorreu por engano ou divisão de IP/rede, procure os mesários ou a administração do RPG.
          </div>
        </div>

        <Link
          to="/votar"
          className="btn btn-primary"
          style={{
            display: 'inline-flex',
            padding: '0.75rem 1.5rem',
            fontSize: '0.85rem',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          Voltar ao Início
        </Link>
      </div>
    </div>
  );
};
