'use client';
import { createContext, useContext, type ReactNode } from 'react';
import { useContract, type OnChainPlayer, type LeaderboardEntry } from './useContract';

export interface Web3ContextValue {
  connect: () => Promise<void>;
  connected: boolean;
  address: string | null;
  player: OnChainPlayer | null;
  loading: boolean;
  error: string | null;
  isDeployed: boolean;
  contractAddress: string | null;
  correctNetwork: boolean;
  currentChainId: number | null;
  deploymentChainId: number;
  switchNetwork: () => Promise<void>;
  recordActivity: (score: number, correct: number, attempts: number, topic: string) => Promise<void>;
  register: (username: string) => Promise<void>;
  claimReward: () => Promise<void>;
  getLeaderboard: (topN?: number) => Promise<LeaderboardEntry[]>;
  refreshPlayer: () => Promise<void>;
}

const Web3Ctx = createContext<Web3ContextValue | null>(null);

export function Web3Provider({ children }: { children: ReactNode }) {
  const contract = useContract();
  return <Web3Ctx.Provider value={contract}>{children}</Web3Ctx.Provider>;
}

export function useWeb3(): Web3ContextValue {
  const ctx = useContext(Web3Ctx);
  if (!ctx) throw new Error('useWeb3 must be used within a Web3Provider');
  return ctx;
}
