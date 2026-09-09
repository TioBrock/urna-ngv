import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';

export const FinishedPage: React.FC = () => {
  const discordName = sessionStorage.getItem('urna_discord_name') || 'Eleitor';
  const rpgName = sessionStorage.getItem('urna_rpg_name') || 'Cidadão';

  // Gera protocolo fictício para o comprovante
  const protocol = useMemo(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 12; i++) {
      if (i > 0 && i % 4 === 0) code += '-';
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }, []);

  const voteDate = useMemo(() => {
    return new Date().toLocaleString('pt-BR');
  }, []);

  return (
    <div className="finished-page">
      <div className="finished-card animate-fade-in-scale">
        {/* Ícone de sucesso / Urna */}
        <div className="finished-icon" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        {/* Display icônico "FIM" */}
        <div
          style={{
            background: '#f8fafc',
            border: '2px solid #cbd5e1',
            borderRadius: '12px',
            padding: '1.5rem',
            margin: '0 auto 1.5rem',
            maxWidth: '280px',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '3.5rem',
              fontWeight: 900,
              color: '#0f172a',
              letterSpacing: '0.15em',
              lineHeight: 1,
            }}
          >
            FIM
          </div>
          <div
            style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#15803d',
              marginTop: '0.5rem',
              letterSpacing: '0.1em',
            }}
          >
            VOTO GRAVADO COM SUCESSO
          </div>
        </div>

        <h1 className="finished-title" style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>
          Obrigado por votar!
        </h1>
        <p className="finished-subtitle" style={{ fontSize: '0.9rem', color: '#475569' }}>
          Seu voto foi registrado e computado de forma anônima e segura.
        </p>

        {/* Comprovante de votação */}
        <div
          style={{
            background: '#f1f5f9',
            borderRadius: '8px',
            padding: '1rem',
            marginTop: '1.25rem',
            textAlign: 'left',
            fontSize: '0.75rem',
            color: '#334155',
            border: '1px dashed #94a3b8',
          }}
        >
          <div style={{ fontWeight: 800, textAlign: 'center', marginBottom: '0.5rem', color: '#1e293b' }}>
            COMPROVANTE DE VOTAÇÃO — RPG
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>Eleitor:</span>
            <strong>{rpgName}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>Discord:</span>
            <strong>{discordName}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span>Data/Hora:</span>
            <strong>{voteDate}</strong>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              borderTop: '1px solid #cbd5e1',
              paddingTop: '6px',
              marginTop: '6px',
            }}
          >
            <span>Protocolo:</span>
            <strong style={{ fontFamily: 'var(--font-mono)', color: '#0f2440' }}>{protocol}</strong>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem' }}>
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
    </div>
  );
};
