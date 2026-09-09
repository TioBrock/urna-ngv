import React from 'react';

interface NumericKeypadProps {
  onDigit: (digit: string) => void;
  onBranco: () => void;
  onCorrige: () => void;
  onConfirma: () => void;
  disabled?: boolean;
  isSubmitting?: boolean;
}

export const NumericKeypad: React.FC<NumericKeypadProps> = ({
  onDigit,
  onBranco,
  onCorrige,
  onConfirma,
  disabled = false,
  isSubmitting = false,
}) => {
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="urna-keyboard">
      {/* Teclado numérico 0-9 */}
      <div className="urna-keypad" role="group" aria-label="Teclado numérico">
        {digits.map((digit) => (
          <button
            key={digit}
            type="button"
            className="urna-key"
            onClick={() => onDigit(digit)}
            disabled={disabled || isSubmitting}
            aria-label={`Dígito ${digit}`}
          >
            {digit}
          </button>
        ))}

        {/* Tecla 0 centralizada */}
        <button
          type="button"
          className="urna-key urna-key-zero"
          onClick={() => onDigit('0')}
          disabled={disabled || isSubmitting}
          aria-label="Dígito 0"
        >
          0
        </button>
      </div>

      {/* Botões funcionais da urna */}
      <div className="urna-actions" role="group" aria-label="Ações de votação">
        <button
          type="button"
          className="urna-btn urna-btn-white"
          onClick={onBranco}
          disabled={disabled || isSubmitting}
          aria-label="Votar em Branco"
        >
          BRANCO
        </button>

        <button
          type="button"
          className="urna-btn urna-btn-correct"
          onClick={onCorrige}
          disabled={disabled || isSubmitting}
          aria-label="Corrigir voto digitado"
        >
          CORRIGE
        </button>

        <button
          type="button"
          className="urna-btn urna-btn-confirm"
          onClick={onConfirma}
          disabled={disabled || isSubmitting}
          aria-label="Confirmar voto"
        >
          {isSubmitting ? 'GRAVANDO...' : 'CONFIRMA'}
        </button>
      </div>
    </div>
  );
};
