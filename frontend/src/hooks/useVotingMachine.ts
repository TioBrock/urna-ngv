import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { votingApi } from '../services/api';
import { Candidate, StartVotingResponse } from '../types';
import { useAudio } from './useAudio';
import toast from 'react-hot-toast';

export function useVotingMachine() {
  const navigate = useNavigate();
  const { playKeyClick, playConfirmCargo, playEndVote } = useAudio();

  // Recupera a sessão iniciada no IdentificationPage
  const [session] = useState<StartVotingResponse | null>(() => {
    const stored = sessionStorage.getItem('urna_session');
    return stored ? JSON.parse(stored) : null;
  });

  const [stateId] = useState<string>(() => {
    return sessionStorage.getItem('urna_state_id') || '';
  });

  const [currentPositionOrder, setCurrentPositionOrder] = useState<number>(() => {
    return session?.currentPositionOrder ?? 1;
  });

  const [currentSlot, setCurrentSlot] = useState<number>(() => {
    return session?.currentSlot ?? 1;
  });

  const [digits, setDigits] = useState<string[]>([]);
  const [isBlank, setIsBlank] = useState(false);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [isNull, setIsNull] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Posição atual ordenada
  const currentPosition = useMemo(() => {
    if (!session?.election?.positions) return null;
    return session.election.positions.find((p) => p.order === currentPositionOrder) || null;
  }, [session, currentPositionOrder]);

  // Se não houver sessão ativa, redireciona para a identificação
  useEffect(() => {
    if (!session) {
      navigate('/votar');
    }
  }, [session, navigate]);

  // Busca de candidato quando todos os dígitos forem preenchidos
  useEffect(() => {
    if (!currentPosition || isBlank) {
      setCandidate(null);
      setIsNull(false);
      return;
    }

    if (digits.length === currentPosition.digitCount) {
      const numberStr = digits.join('');
      setIsSearching(true);

      votingApi
        .findCandidate({
          number: numberStr,
          electionPositionId: currentPosition.id,
          stateId,
          sessionId: session!.sessionId,
        })
        .then((res) => {
          if (res.candidate) {
            setCandidate(res.candidate);
            setIsNull(false);
          } else {
            setCandidate(null);
            setIsNull(true);
          }
        })
        .catch((err) => {
          console.error('Erro ao buscar candidato:', err);
          setCandidate(null);
          setIsNull(true);
        })
        .finally(() => {
          setIsSearching(false);
        });
    } else {
      setCandidate(null);
      setIsNull(false);
    }
  }, [digits, currentPosition, isBlank, stateId, session]);

  // Pressionar tecla numérica
  const pressDigit = useCallback(
    (digit: string) => {
      playKeyClick();
      if (!currentPosition || isSubmitting) return;

      // Se estava em branco, cancela o branco e começa a digitar
      if (isBlank) {
        setIsBlank(false);
        setDigits([digit]);
        return;
      }

      if (digits.length < currentPosition.digitCount) {
        setDigits((prev) => [...prev, digit]);
      }
    },
    [currentPosition, digits.length, isBlank, isSubmitting, playKeyClick]
  );

  // Pressionar tecla BRANCO
  const pressBranco = useCallback(() => {
    playKeyClick();
    if (isSubmitting) return;

    // Só permite branco se não tiver dígitos digitados (ou limpa e vai para branco)
    setDigits([]);
    setCandidate(null);
    setIsNull(false);
    setIsBlank(true);
  }, [isSubmitting, playKeyClick]);

  // Pressionar tecla CORRIGE
  const pressCorrige = useCallback(() => {
    playKeyClick();
    if (isSubmitting) return;

    setDigits([]);
    setIsBlank(false);
    setCandidate(null);
    setIsNull(false);
  }, [isSubmitting, playKeyClick]);

  // Pressionar tecla CONFIRMA
  const pressConfirma = useCallback(async () => {
    if (!currentPosition || !session || isSubmitting) return;

    // Voto válido requer todos os dígitos
    if (!isBlank && digits.length < currentPosition.digitCount) {
      toast('Complete o número do candidato antes de confirmar', {
        icon: '⚠️',
      });
      return;
    }

    setIsSubmitting(true);

    let voteType: 'VALID' | 'BLANK' | 'NULL' = 'NULL';
    let candidateId: string | null = null;

    if (isBlank) {
      voteType = 'BLANK';
    } else if (candidate) {
      voteType = 'VALID';
      candidateId = candidate.id;
    } else {
      voteType = 'NULL';
    }

    try {
      const response = await votingApi.castVote({
        sessionId: session.sessionId,
        electionPositionId: currentPosition.id,
        slot: currentSlot,
        type: voteType,
        candidateId,
      });

      if (response.isFinished) {
        // Toca o som oficial do TSE "FIM"
        playEndVote();

        // Limpa sessão local
        sessionStorage.removeItem('urna_session');
        sessionStorage.removeItem('urna_state_id');
        sessionStorage.setItem('urna_vote_completed', 'true');

        // Redireciona para tela de conclusão após pequeno delay para ouvir o som
        setTimeout(() => {
          navigate('/votar/concluido');
        }, 800);
      } else {
        // Toca som de confirmação de cargo intermediário
        playConfirmCargo();

        // Avança para próximo cargo ou próximo slot
        if (response.nextPositionOrder !== null) {
          setCurrentPositionOrder(response.nextPositionOrder);
        }
        if (response.nextSlot !== null) {
          setCurrentSlot(response.nextSlot);
        }

        // Limpa estados para o próximo voto
        setDigits([]);
        setIsBlank(false);
        setCandidate(null);
        setIsNull(false);
      }
    } catch (err: any) {
      console.error('Erro ao registrar voto:', err);
      const errorMsg = err.response?.data?.message || err.response?.data?.error || 'Erro ao registrar voto';
      toast.error(errorMsg);

      if (err.response?.data?.error === 'DUPLICATE_CANDIDATE') {
        pressCorrige();
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    currentPosition,
    session,
    isSubmitting,
    isBlank,
    digits,
    candidate,
    currentSlot,
    playEndVote,
    navigate,
    playConfirmCargo,
    pressCorrige,
  ]);

  // Suporte a teclado físico do usuário
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Evita atalhos se o foco estiver em um input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        pressDigit(e.key);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        pressConfirma();
      } else if (e.key === 'Backspace' || e.key === 'Escape') {
        e.preventDefault();
        pressCorrige();
      } else if (e.key.toLowerCase() === 'b' || e.key === ' ') {
        e.preventDefault();
        pressBranco();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pressDigit, pressConfirma, pressCorrige, pressBranco]);

  return {
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
  };
}
