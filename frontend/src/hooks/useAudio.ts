import { useCallback, useRef } from 'react';

/**
 * Hook de áudio que sintetiza os sons da Urna Eletrônica Brasileira usando Web Audio API.
 * 100% nativo, sem latência e sem dependência de arquivos externos mp3/wav.
 */
export function useAudio() {
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  /**
   * Som de clique ao pressionar qualquer tecla do teclado da urna.
   * Tom mecânico sutil e seco (~480Hz por 35ms).
   */
  const playKeyClick = useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.035);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.035);
    } catch {
      // Falha silenciosa se áudio bloqueado pelo navegador
    }
  }, [getAudioContext]);

  /**
   * Som de confirmação de cargo intermediário.
   * Bip duplo ou curto de transição (~880Hz / A5 por 120ms).
   */
  const playConfirmCargo = useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // Silencioso
    }
  }, [getAudioContext]);

  /**
   * O lendário som de finalização da Urna Eletrônica do TSE ("Pirililili... PIIIII").
   * Sequência sintetizada reproduzindo com fidelidade a melodia de encerramento do voto.
   */
  const playEndVote = useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      // Trinado de notas rápidas característico da urna brasileira
      const notes = [
        { freq: 900, start: 0, dur: 0.06 },
        { freq: 1100, start: 0.06, dur: 0.06 },
        { freq: 900, start: 0.12, dur: 0.06 },
        { freq: 1100, start: 0.18, dur: 0.06 },
        { freq: 900, start: 0.24, dur: 0.06 },
        { freq: 1100, start: 0.30, dur: 0.06 },
        { freq: 1400, start: 0.36, dur: 0.06 },
        { freq: 1800, start: 0.42, dur: 0.8 }, // Nota final longa e aguda
      ];

      notes.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle'; // triangle/sine dá timbre característico do buzzer da urna
        osc.frequency.setValueAtTime(freq, now + start);

        gain.gain.setValueAtTime(0.4, now + start);
        if (dur > 0.1) {
          gain.gain.setValueAtTime(0.4, now + start + dur - 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
        } else {
          gain.gain.exponentialRampToValueAtTime(0.01, now + start + dur);
        }

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + start);
        osc.stop(now + start + dur);
      });
    } catch {
      // Silencioso
    }
  }, [getAudioContext]);

  return {
    playKeyClick,
    playConfirmCargo,
    playEndVote,
  };
}
