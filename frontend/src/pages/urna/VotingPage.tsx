import React from 'react';
import { useVotingMachine } from '../../hooks/useVotingMachine';
import { BallotDisplay } from '../../components/urna/BallotDisplay';
import { NumericKeypad } from '../../components/urna/NumericKeypad';

export const VotingPage: React.FC = () => {
  const {
    session,
    currentPosition,
    currentSlot,
    digits,
    isBlank,
    isNull,
    candidate,
    isSearching,
    isSubmitting,
    pressDigit,
    pressBranco,
    pressCorrige,
    pressConfirma,
  } = useVotingMachine();

  if (!session || !currentPosition) {
    return (
      <div className="urna-page">
        <div style={{ color: 'white', textAlign: 'center' }}>
          <p>Carregando cédula eleitoral...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="urna-page">
      <div className="urna-container animate-fade-in">
        <div className="urna-frame">
          {/* Tela LCD da Urna */}
          <BallotDisplay
            electionName={session.election.name}
            positionName={currentPosition.name}
            slot={currentSlot}
            slots={currentPosition.slots}
            digitCount={currentPosition.digitCount}
            digits={digits}
            isBlank={isBlank}
            isNull={isNull}
            candidate={candidate}
            isSearching={isSearching}
          />

          {/* Teclado Físico/Virtual da Urna */}
          <NumericKeypad
            onDigit={pressDigit}
            onBranco={pressBranco}
            onCorrige={pressCorrige}
            onConfirma={pressConfirma}
            disabled={isSearching}
            isSubmitting={isSubmitting}
          />
        </div>

        {/* Dica de atalhos do teclado físico — oculta no mobile para economizar espaço */}
        <div className="urna-keyboard-hint">
          <span>💡 Você também pode usar seu <strong>teclado físico</strong>: </span>
          <span><strong>0-9</strong> números • </span>
          <span><strong>ENTER</strong> confirma • </span>
          <span><strong>BACKSPACE/ESC</strong> corrige • </span>
          <span><strong>ESPAÇO/B</strong> branco</span>
        </div>
      </div>
    </div>
  );
};
