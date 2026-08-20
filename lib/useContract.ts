import { useCallback, useEffect, useRef, useState } from 'react';
import { ethers, BrowserProvider, Contract } from 'ethers';
import contractDeployment from './contract.json';
import { assertContractBytecode, assertSupportedDeployment, getCeloNetwork, isUnknownChainError, isUserRejectedError, networkRecoveryMessage, toWalletChainConfig } from './networkConfig';

type EthereumEventHandler = (...args: unknown[]) => void;
type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: EthereumEventHandler) => void;
  removeListener?: (event: string, handler: EthereumEventHandler) => void;
};
declare global { interface Window { ethereum?: EthereumProvider; } }

type DeploymentData = { address: string; abi: unknown[]; chainId: number };
const deploymentData: DeploymentData | null = contractDeployment?.address ? contractDeployment : null;

export interface OnChainPlayer { username: string; totalScore: bigint; totalCorrect: bigint; totalAttempts: bigint; streak: bigint; lastActivityDay: bigint; coinsEarned: bigint; registeredAt: bigint; exists: boolean; }
export interface LeaderboardEntry { player: string; username: string; totalScore: bigint; streak: bigint; }

function errorMessage(error: unknown, fallback: string): string {
  if (isUserRejectedError(error)) return 'Request rejected. Approve the wallet request, then reconnect.';
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useContract() {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [player, setPlayer] = useState<OnChainPlayer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const ethereumRef = useRef<EthereumProvider | null>(null);

  const clearConnection = useCallback((message?: string) => {
    setProvider(null); setContract(null); setAddress(null); setPlayer(null); setConnected(false);
    if (message) setError(message);
  }, []);

  const connect = useCallback(async () => {
    const ethereum = typeof window !== 'undefined' ? window.ethereum : undefined;
    if (!ethereum) { setError('No wallet found. Install MetaMask or Celo Wallet.'); return; }
    if (!deploymentData) { setError('Contract not deployed yet.'); return; }
    try {
      assertSupportedDeployment(deploymentData.chainId, deploymentData.address);
      setLoading(true); setError(null);
      const expectedNetwork = getCeloNetwork(deploymentData.chainId);
      if (!expectedNetwork) throw new Error(networkRecoveryMessage(deploymentData.chainId));
      const web3Provider = new BrowserProvider(ethereum);
      let walletNetwork = await web3Provider.getNetwork();
      if (Number(walletNetwork.chainId) !== deploymentData.chainId) {
        try {
          await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: toWalletChainConfig(expectedNetwork).chainId }] });
        } catch (switchError: unknown) {
          if (isUnknownChainError(switchError)) {
            await ethereum.request({ method: 'wallet_addEthereumChain', params: [toWalletChainConfig(expectedNetwork)] });
          } else throw switchError;
        }
        walletNetwork = await web3Provider.getNetwork();
      }
      if (Number(walletNetwork.chainId) !== deploymentData.chainId) throw new Error(networkRecoveryMessage(deploymentData.chainId, Number(walletNetwork.chainId)));
      assertContractBytecode(await web3Provider.getCode(deploymentData.address), deploymentData.address, expectedNetwork.chainName);
      const accounts = await web3Provider.send('eth_requestAccounts', []) as string[];
      const account = accounts[0];
      if (!account) throw new Error('No wallet account selected. Connect an account, then retry.');
      const signer = await web3Provider.getSigner(account);
      const gameContract = new Contract(deploymentData.address, deploymentData.abi as ethers.InterfaceAbi, signer);
      const nextPlayer: OnChainPlayer = await gameContract.getPlayer(account);
      ethereumRef.current = ethereum;
      setProvider(web3Provider); setContract(gameContract); setAddress(account); setPlayer(nextPlayer.exists ? nextPlayer : null); setConnected(true);
    } catch (err: unknown) { clearConnection(errorMessage(err, 'Connection failed.')); }
    finally { setLoading(false); }
  }, [clearConnection]);

  const refreshAccount = useCallback(async (account: string) => {
    if (!provider || !contract || !deploymentData) return;
    try {
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== deploymentData.chainId) { clearConnection(networkRecoveryMessage(deploymentData.chainId, Number(network.chainId))); return; }
      const nextContract = new Contract(deploymentData.address, deploymentData.abi as ethers.InterfaceAbi, await provider.getSigner(account));
      const nextPlayer: OnChainPlayer = await nextContract.getPlayer(account);
      setContract(nextContract); setAddress(account); setPlayer(nextPlayer.exists ? nextPlayer : null); setConnected(true); setError(null);
    } catch (err: unknown) { clearConnection(errorMessage(err, 'Unable to refresh wallet account. Reconnect and retry.')); }
  }, [clearConnection, contract, provider]);

  useEffect(() => {
    const ethereum = ethereumRef.current ?? (typeof window !== 'undefined' ? window.ethereum : undefined);
    if (!ethereum?.on) return;
    const onChainChanged: EthereumEventHandler = () => clearConnection(deploymentData ? networkRecoveryMessage(deploymentData.chainId) : 'Contract deployment is unavailable.');
    const onAccountsChanged: EthereumEventHandler = (accountsArg) => { const accounts = accountsArg as string[]; if (!accounts?.[0]) clearConnection('Wallet disconnected. Connect an account, then retry.'); else void refreshAccount(accounts[0]); };
    ethereum.on('chainChanged', onChainChanged); ethereum.on('accountsChanged', onAccountsChanged);
    return () => { ethereum.removeListener?.('chainChanged', onChainChanged); ethereum.removeListener?.('accountsChanged', onAccountsChanged); };
  }, [clearConnection, refreshAccount]);

  const register = useCallback(async (username: string) => {
    if (!contract || !address || !connected) return; setLoading(true);
    try { const tx = await contract.register(username); await tx.wait(); setPlayer(await contract.getPlayer(address)); }
    catch (err: unknown) { setError(errorMessage(err, 'Registration failed.')); } finally { setLoading(false); }
  }, [address, connected, contract]);

  const recordActivity = useCallback(async (score: number, correct: number, attempts: number, topic: string) => {
    if (!contract || !address || !player?.exists || !connected) return; setLoading(true);
    try { const tx = await contract.recordActivity(score, correct, attempts, topic, { gasLimit: 300000 }); await tx.wait(); setPlayer(await contract.getPlayer(address)); }
    catch (err: unknown) { setError(errorMessage(err, 'Saving activity failed.')); } finally { setLoading(false); }
  }, [address, connected, contract, player]);

  const claimReward = useCallback(async () => {
    if (!contract || !address || !connected) return; setLoading(true);
    try { const tx = await contract.claimCeloReward({ gasLimit: 200000 }); await tx.wait(); setPlayer(await contract.getPlayer(address)); }
    catch (err: unknown) { setError(errorMessage(err, 'Claim failed.')); } finally { setLoading(false); }
  }, [address, connected, contract]);

  const getLeaderboard = useCallback(async (topN = 10): Promise<LeaderboardEntry[]> => {
    if (!contract || !connected) return [];
    try { return await contract.getLeaderboard(topN); } catch { return []; }
  }, [connected, contract]);

  const network = deploymentData ? getCeloNetwork(deploymentData.chainId) : null;
  return { connect, register, recordActivity, claimReward, getLeaderboard, provider, contract, address, player, loading, error, connected, isDeployed: !!deploymentData, contractAddress: deploymentData?.address ?? null, chainId: deploymentData?.chainId ?? null, networkName: network?.chainName ?? null, explorerUrl: deploymentData && network ? `${network.blockExplorerUrl}/address/${deploymentData.address}` : null };
}
