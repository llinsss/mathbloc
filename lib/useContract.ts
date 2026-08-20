import { useCallback, useEffect, useRef, useState } from 'react';
import { ethers, BrowserProvider, Contract } from 'ethers';
import contractDeployment from './contract.json';
import { assertContractBytecode, assertSupportedDeployment, getCeloNetwork, isUnknownChainError, isUserRejectedError, networkRecoveryMessage, toWalletChainConfig } from './networkConfig';

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

const deploymentData: { address: string; abi: unknown[]; chainId: number } | null =
  contractDeployment && (contractDeployment as Record<string, unknown>).address
    ? (contractDeployment as { address: string; abi: unknown[]; chainId: number })
    : null;

export interface OnChainPlayer { username: string; totalScore: bigint; totalCorrect: bigint; totalAttempts: bigint; streak: bigint; lastActivityDay: bigint; coinsEarned: bigint; registeredAt: bigint; exists: boolean; }
export interface LeaderboardEntry { player: string; username: string; totalScore: bigint; streak: bigint; }

function errorMessage(error: unknown, fallback: string): string {
  if (isUserRejectedError(error)) return 'Request rejected. Approve the wallet request, then reconnect.';
  return error instanceof Error && error.message ? error.message : fallback;
}

const CELO_ALFAJORES = {
  chainId: '0xAEF3',
  chainName: 'Celo Alfajores Testnet',
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: ['https://alfajores-forno.celo-testnet.org'],
  blockExplorerUrls: ['https://alfajores.celoscan.io'],
};

const CELO_MAINNET = {
  chainId: '0xA4EC',
  chainName: 'Celo Mainnet',
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: ['https://forno.celo.org'],
  blockExplorerUrls: ['https://celoscan.io'],
};

const NETWORK_CONFIGS: Record<number, typeof CELO_ALFAJORES> = {
  44787: CELO_ALFAJORES,
  42220: CELO_MAINNET,
};

const DEPLOYMENT_CHAIN_ID = deploymentData?.chainId ?? 42220;

function hexToDecimal(hex: string): number {
  return parseInt(hex, 16);
}

async function getCurrentChainId(): Promise<number | null> {
  if (typeof window === 'undefined' || !window.ethereum) return null;
  try {
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    return hexToDecimal(chainId as string);
  } catch {
    return null;
  }
}

export function useContract() {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [player, setPlayer] = useState<OnChainPlayer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [currentChainId, setCurrentChainId] = useState<number | null>(null);

  const correctNetwork = currentChainId === DEPLOYMENT_CHAIN_ID;

  const refreshPlayer = useCallback(async () => {
    if (!contract || !address) return;
    try {
      const p: OnChainPlayer = await contract.getPlayer(address);
      setPlayer(p.exists ? p : null);
    } catch {
      // Player might not exist yet
    }
  }, [contract, address]);

  const connect = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setError('No wallet found. Install MetaMask or Celo Wallet.');
      return;
    }
    if (!deploymentData) {
      setError('Contract not deployed yet.');
      return;
    }

  const connect = useCallback(async () => {
    const ethereum = typeof window !== 'undefined' ? window.ethereum : undefined;
    if (!ethereum) { setError('No wallet found. Install MetaMask or Celo Wallet.'); return; }
    if (!deploymentData) { setError('Contract not deployed yet.'); return; }
    try {
      setLoading(true);
      setError(null);

      const web3Provider = new BrowserProvider(window.ethereum);

      const targetNetwork = NETWORK_CONFIGS[DEPLOYMENT_CHAIN_ID] ?? CELO_MAINNET;

      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: targetNetwork.chainId }],
        });
      } catch (switchErr: unknown) {
        if ((switchErr as { code: number }).code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [targetNetwork],
          });
        } else {
          throw switchErr;
        }
        walletNetwork = await web3Provider.getNetwork();
      }

      const accounts = await web3Provider.send('eth_requestAccounts', []);
      const signer = await web3Provider.getSigner();
      const gameContract = new Contract(
        deploymentData.address,
        deploymentData.abi as ethers.InterfaceAbi,
        signer
      );

      const chainId = await getCurrentChainId();

      setProvider(web3Provider);
      setContract(gameContract);
      setAddress(accounts[0]);
      setConnected(true);
      setCurrentChainId(chainId);

      const p: OnChainPlayer = await gameContract.getPlayer(accounts[0]);
      if (p.exists) setPlayer(p);
    } catch (err: unknown) {
      setError((err as Error).message || 'Connection failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const switchNetwork = useCallback(async () => {
    if (!window.ethereum || !deploymentData) return;
    const targetNetwork = NETWORK_CONFIGS[DEPLOYMENT_CHAIN_ID] ?? CELO_MAINNET;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetNetwork.chainId }],
      });
      const chainId = await getCurrentChainId();
      setCurrentChainId(chainId);

      if (chainId === DEPLOYMENT_CHAIN_ID && address) {
        const web3Provider = new BrowserProvider(window.ethereum);
        const signer = await web3Provider.getSigner();
        const gameContract = new Contract(
          deploymentData.address,
          deploymentData.abi as ethers.InterfaceAbi,
          signer
        );
        setProvider(web3Provider);
        setContract(gameContract);
        const p: OnChainPlayer = await gameContract.getPlayer(address);
        if (p.exists) setPlayer(p);
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Network switch failed');
    }
  }, [address]);

  const register = useCallback(async (username: string) => {
    if (!contract || !address || !connected) return; setLoading(true);
    try { const tx = await contract.register(username); await tx.wait(); setPlayer(await contract.getPlayer(address)); }
    catch (err: unknown) { setError(errorMessage(err, 'Registration failed.')); } finally { setLoading(false); }
  }, [address, connected, contract]);

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

  const claimReward = useCallback(async () => {
    if (!contract || !address || !connected) return; setLoading(true);
    try { const tx = await contract.claimCeloReward({ gasLimit: 200000 }); await tx.wait(); setPlayer(await contract.getPlayer(address)); }
    catch (err: unknown) { setError(errorMessage(err, 'Claim failed.')); } finally { setLoading(false); }
  }, [address, connected, contract]);

  const getLeaderboard = useCallback(async (topN = 10): Promise<LeaderboardEntry[]> => {
    if (!contract || !connected) return [];
    try { return await contract.getLeaderboard(topN); } catch { return []; }
  }, [connected, contract]);

  return {
    connect, register, recordActivity, claimReward, getLeaderboard, refreshPlayer,
    provider, contract, address, player, loading, error, connected,
    isDeployed, contractAddress,
    correctNetwork, currentChainId, deploymentChainId: DEPLOYMENT_CHAIN_ID,
    switchNetwork,
  };
}
