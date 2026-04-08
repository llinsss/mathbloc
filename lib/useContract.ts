import { useState, useEffect, useCallback } from 'react';
import { ethers, BrowserProvider, Contract } from 'ethers';

// Extend window type for ethereum wallet
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

// Loaded after deployment — will be empty object before deploy
let deploymentData: { address: string; abi: unknown[]; chainId: number } | null = null;
try {
  deploymentData = require('./contract.json');
} catch {
  // contract not deployed yet
}

export interface OnChainPlayer {
  username: string;
  totalScore: bigint;
  totalCorrect: bigint;
  totalAttempts: bigint;
  streak: bigint;
  lastActivityDay: bigint;
  coinsEarned: bigint;
  registeredAt: bigint;
  exists: boolean;
}

export interface LeaderboardEntry {
  player: string;
  username: string;
  totalScore: bigint;
  streak: bigint;
}

const CELO_ALFAJORES = {
  chainId: '0xAEF3', // 44787
  chainName: 'Celo Alfajores Testnet',
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: ['https://alfajores-forno.celo-testnet.org'],
  blockExplorerUrls: ['https://alfajores.celoscan.io'],
};

export function useContract() {
  const [provider, setProvider]   = useState<BrowserProvider | null>(null);
  const [contract, setContract]   = useState<Contract | null>(null);
  const [address, setAddress]     = useState<string | null>(null);
  const [player, setPlayer]       = useState<OnChainPlayer | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  // Connect wallet
  const connect = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setError('No wallet found. Install MetaMask or Celo Wallet.');
      return;
    }
    if (!deploymentData) {
      setError('Contract not deployed yet.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const web3Provider = new BrowserProvider(window.ethereum);

      // Switch to Celo Alfajores
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: CELO_ALFAJORES.chainId }],
        });
      } catch (switchErr: unknown) {
        if ((switchErr as { code: number }).code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [CELO_ALFAJORES],
          });
        }
      }

      const accounts = await web3Provider.send('eth_requestAccounts', []);
      const signer   = await web3Provider.getSigner();
      const gameContract = new Contract(deploymentData.address, deploymentData.abi as ethers.InterfaceAbi, signer);

      setProvider(web3Provider);
      setContract(gameContract);
      setAddress(accounts[0]);
      setConnected(true);

      // Load player data
      const p: OnChainPlayer = await gameContract.getPlayer(accounts[0]);
      if (p.exists) setPlayer(p);
    } catch (err: unknown) {
      setError((err as Error).message || 'Connection failed');
    } finally {
      setLoading(false);
    }
  }, []);

  // Register on-chain
  const register = useCallback(async (username: string) => {
    if (!contract) return;
    setLoading(true);
    try {
      const tx = await contract.register(username);
      await tx.wait();
      const p: OnChainPlayer = await contract.getPlayer(address!);
      setPlayer(p);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [contract, address]);

  // Record game session on-chain
  const recordActivity = useCallback(async (
    score: number,
    correct: number,
    attempts: number,
    topic: string
  ) => {
    if (!contract || !player?.exists) return;
    setLoading(true);
    try {
      const tx = await contract.recordActivity(score, correct, attempts, topic, { gasLimit: 300000 });
      await tx.wait();
      const p: OnChainPlayer = await contract.getPlayer(address!);
      setPlayer(p);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [contract, player, address]);

  // Claim CELO reward
  const claimReward = useCallback(async () => {
    if (!contract) return;
    setLoading(true);
    try {
      const tx = await contract.claimCeloReward({ gasLimit: 200000 });
      await tx.wait();
      const p: OnChainPlayer = await contract.getPlayer(address!);
      setPlayer(p);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [contract, address]);

  // Fetch leaderboard
  const getLeaderboard = useCallback(async (topN = 10): Promise<LeaderboardEntry[]> => {
    if (!contract) return [];
    try {
      return await contract.getLeaderboard(topN);
    } catch {
      return [];
    }
  }, [contract]);

  const isDeployed = !!deploymentData;
  const contractAddress = deploymentData?.address ?? null;

  return {
    connect, register, recordActivity, claimReward, getLeaderboard,
    provider, contract, address, player, loading, error, connected,
    isDeployed, contractAddress,
  };
}
