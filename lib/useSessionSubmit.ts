'use client';
import { useState, useCallback, useRef } from 'react';
import { useWeb3 } from './Web3Context';
import { Operation, GameMode } from './types';

export interface SessionPayload {
  mode: GameMode;
  topic: Operation;
  score: number;
  correct: number;
  attempts: number;
  profileId: string;
}

export type SubmitStatus =
  | 'idle'
  | 'pending'
  | 'confirmed'
  | 'rejected'
  | 'wrong-network'
  | 'not-connected'
  | 'not-registered';

const DEDUP_PREFIX = 'mathbloc-submitted-';

function dedupKey(payload: SessionPayload): string {
  return `${DEDUP_PREFIX}${payload.profileId}-${payload.topic}-${payload.mode}-${payload.attempts}-${payload.correct}-${payload.score}`;
}

function isAlreadySubmitted(payload: SessionPayload): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(dedupKey(payload)) === '1';
}

function markSubmitted(payload: SessionPayload): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(dedupKey(payload), '1');
}

export interface UseSessionSubmitReturn {
  submitSession: (payload: SessionPayload) => void;
  submitStatus: SubmitStatus;
  lastError: string | null;
  retry: () => void;
}

export function useSessionSubmit(): UseSessionSubmitReturn {
  const web3 = useWeb3();
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const payloadRef = useRef<SessionPayload | null>(null);

  const doSubmit = useCallback(async (payload: SessionPayload) => {
    if (isAlreadySubmitted(payload)) {
      setSubmitStatus('confirmed');
      return;
    }

    if (!web3.connected) {
      setSubmitStatus('not-connected');
      return;
    }

    if (!web3.player?.exists) {
      setSubmitStatus('not-registered');
      return;
    }

    if (!web3.correctNetwork) {
      setSubmitStatus('wrong-network');
      setLastError(
        `Wrong network. Please switch to the Celo network (chain ${web3.deploymentChainId}).`
      );
      return;
    }

    setSubmitStatus('pending');
    setLastError(null);

    try {
      await web3.recordActivity(payload.score, payload.correct, payload.attempts, payload.topic);
      markSubmitted(payload);
      setSubmitStatus('confirmed');
      await web3.refreshPlayer();
    } catch (err: unknown) {
      setSubmitStatus('rejected');
      setLastError((err as Error).message || 'Transaction failed');
    }
  }, [web3]);

  const submitSession = useCallback((payload: SessionPayload) => {
    payloadRef.current = payload;
    doSubmit(payload);
  }, [doSubmit]);

  const retry = useCallback(() => {
    if (payloadRef.current) {
      doSubmit(payloadRef.current);
    }
  }, [doSubmit]);

  return { submitSession, submitStatus, lastError, retry };
}

/**
 * Wallet-to-profile mapping:
 *
 * The on-chain contract tracks stats per wallet address (one address = one Player).
 * The local app supports multiple child profiles under the same browser/device.
 * All local profiles share the same connected wallet, so on-chain stats aggregate
 * activity from ALL profiles under that wallet.
 *
 * This is a known limitation. Individual per-child on-chain tracking would require
 * either: (a) each child having their own wallet, or (b) a profile-ID field added
 * to the on-chain recordActivity call. Neither is implemented in this version.
 *
 * Tradeoffs:
 * - Pro: Simple UX — parent connects one wallet, all children's on-chain rewards go there.
 * - Con: On-chain leaderboard/streaks mix all children's activity.
 * - Con: Cannot attribute on-chain achievements to a specific child profile.
 */
