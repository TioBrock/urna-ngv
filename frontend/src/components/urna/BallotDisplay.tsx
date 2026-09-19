import React, { useState, useEffect } from 'react';
import { Candidate } from '../../types';
import { getPhotoUrl } from '../../services/api';

interface BallotDisplayProps {
  electionName?: string;
  positionName: string;
  slot: number;
  slots: number;
  digitCount: number;
  digits: string[];
  isBlank: boolean;
  isNull: boolean;
  candidate: Candidate | null;
  isSearching: boolean;
}

export const BallotDisplay: React.FC<BallotDisplayProps> = ({
  electionName = 'ELEIÇÃO RPG',
  positionName,
  slot,
  slots,
  digitCount,
  digits,
  isBlank,
  isNull,
  candidate,
  isSearching,
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [candidate?.id, candidate?.photoUrl]);

  // Gera os boxes de dígitos
  const boxes = Array.from({ length: digitCount }, (_, i) => {
    const digit = digits[i];
    const isCurrentActive = i === digits.length && !isBlank && digits.length < digitCount;

    return (
      <div
        key={i}
        className={`urna-number-box ${isCurrentActive ? 'active' : ''}`}
        aria-label={`Dígito ${i + 1}: ${digit || 'vazio'}`}
      >
        {digit ? digit : isCurrentActive ? <span className="cursor" /> : null}
      </div>
    );
  });

  return (
    <div className="urna-screen" role="region" aria-live="polite" aria-label="Tela de Votação">
      {/* Header institucional */}
      <div className="urna-header">
        <div className="urna-logo" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="urna-title-block">
          <div className="urna-institution">JUSTIÇA ELEITORAL NGV</div>
          <div className="urna-election-name">{electionName}</div>
        </div>
      </div>

      {/* Rótulo do cargo */}
      <div className="urna-position-label">SEU VOTO PARA</div>
      <div className="urna-position-name">{positionName}</div>
      {slots > 1 && (
        <div className="urna-slot-label">
          VAGA {slot} DE {slots}
        </div>
      )}

      {/* Conteúdo dinâmico da tela */}
      {isBlank ? (
        <div className="urna-state-box blank animate-fade-in" style={{ margin: '1.5rem 0' }}>
          <div className="urna-state-title" style={{ fontSize: '1.3rem', textAlign: 'center' }}>
            VOTO EM BRANCO
          </div>
          <div className="urna-state-text" style={{ textAlign: 'center' }}>
            Você optou por votar em branco para este cargo.
          </div>
        </div>
      ) : (
        <>
          {/* Fileira de números */}
          <div className="urna-number-display" style={{ marginTop: '0.75rem' }}>
            <span className="urna-number-label">Número:</span>
            <div className="urna-number-boxes">{boxes}</div>
            {isSearching && (
              <span style={{ fontSize: '0.75rem', color: '#6b7a99', marginLeft: '0.5rem' }}>
                Buscando...
              </span>
            )}
          </div>

          {/* Candidato encontrado */}
          {candidate && (
            <div className="urna-candidate animate-fade-in" style={{ marginTop: '0.5rem' }}>
              <div className="urna-candidate-photo">
                {candidate.photoUrl && !imgError ? (
                  <img
                    src={getPhotoUrl(candidate.photoUrl)}
                    alt={candidate.electoralName}
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <span aria-hidden="true">👤</span>
                )}
              </div>
              <div className="urna-candidate-info">
                <div style={{ fontSize: '0.7rem', color: '#6b7a99', fontWeight: 600 }}>NOME:</div>
                <div className="urna-candidate-name">{candidate.electoralName}</div>

                <div style={{ fontSize: '0.7rem', color: '#6b7a99', fontWeight: 600, marginTop: '4px' }}>
                  PARTIDO:
                </div>
                <div className="urna-candidate-party">{candidate.party}</div>

                {candidate.viceCandidateName && (
                  <div style={{ marginTop: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#6b7a99', fontWeight: 600 }}>
                      VICE/SUPLENTE:{' '}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1a1f36' }}>
                      {candidate.viceCandidateName}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Voto nulo (número digitado completo, mas nenhum candidato encontrado) */}
          {isNull && digits.length === digitCount && (
            <div className="urna-state-box null animate-fade-in" style={{ marginTop: '0.75rem' }}>
              <div className="urna-state-title">NÚMERO ERRADO</div>
              <div className="urna-state-title" style={{ fontSize: '1.2rem', margin: '4px 0' }}>
                VOTO NULO
              </div>
              <div className="urna-state-text">
                Nenhum candidato encontrado com este número. Ao confirmar, seu voto será computado como nulo.
              </div>
            </div>
          )}
        </>
      )}

      {/* Instruções de rodapé oficiais da Urna */}
      <div
        style={{
          marginTop: 'auto',
          paddingTop: '0.75rem',
          borderTop: '1px solid #cfd8dc',
          fontSize: '0.7rem',
          color: '#37474f',
          lineHeight: '1.4',
        }}
      >
        <div style={{ fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px', color: '#263238' }}>
          Aperte a tecla:
        </div>
        <div>
          <strong style={{ color: '#1b5e20' }}>VERDE</strong> para{' '}
          <strong style={{ color: '#1b5e20' }}>CONFIRMAR</strong> este voto
        </div>
        <div>
          <strong style={{ color: '#e65100' }}>LARANJA</strong> para{' '}
          <strong style={{ color: '#e65100' }}>REINICIAR</strong> este voto
        </div>
      </div>
    </div>
  );
};
