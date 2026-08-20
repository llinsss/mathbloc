export const CELO_CHAIN_IDS = {
  mainnet: 42220,
  alfajores: 44787,
} as const;

export type SupportedCeloChainId = (typeof CELO_CHAIN_IDS)[keyof typeof CELO_CHAIN_IDS];

export interface CeloNetworkConfig {
  chainId: SupportedCeloChainId;
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrl: string;
}

export const CELO_NETWORKS: Record<SupportedCeloChainId, CeloNetworkConfig> = {
  [CELO_CHAIN_IDS.mainnet]: {
    chainId: CELO_CHAIN_IDS.mainnet,
    chainName: 'Celo Mainnet',
    nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
    rpcUrls: ['https://forno.celo.org'],
    blockExplorerUrl: 'https://celoscan.io',
  },
  [CELO_CHAIN_IDS.alfajores]: {
    chainId: CELO_CHAIN_IDS.alfajores,
    chainName: 'Celo Alfajores Testnet',
    nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
    rpcUrls: ['https://alfajores-forno.celo-testnet.org'],
    blockExplorerUrl: 'https://alfajores.celoscan.io',
  },
};

export function getCeloNetwork(chainId: number): CeloNetworkConfig | null {
  return CELO_NETWORKS[chainId as SupportedCeloChainId] ?? null;
}

export function getExplorerUrl(chainId: number, address: string): string | null {
  const network = getCeloNetwork(chainId);
  return network ? `${network.blockExplorerUrl}/address/${address}` : null;
}

export function assertContractBytecode(code: string, address: string, chainName: string): void {
  if (code === '0x' || code === '0x0') {
    throw new Error(`No contract bytecode at ${address} on ${chainName}. Check the deployment address.`);
  }
}

export function assertSupportedDeployment(chainId: number, address: string): void {
  if (!Number.isInteger(chainId) || !getCeloNetwork(chainId)) {
    throw new Error(`Unsupported Celo network (${chainId}). Select Celo Mainnet or Alfajores.`);
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error('Invalid contract address in deployment configuration.');
  }
}

export function networkRecoveryMessage(expectedChainId: number, actualChainId?: number): string {
  const expected = getCeloNetwork(expectedChainId);
  if (!expected) return 'Unsupported deployment network. Select Celo Mainnet or Alfajores.';
  if (actualChainId === undefined) return `Select ${expected.chainName} in your wallet, then reconnect.`;
  const actual = getCeloNetwork(actualChainId);
  return actual
    ? `Wrong network. Select ${expected.chainName} in your wallet, then reconnect.`
    : `Unsupported wallet network (${actualChainId}). Select ${expected.chainName}, then reconnect.`;
}

export function isUserRejectedError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: number }).code === 4001;
}

export function isUnknownChainError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: number }).code === 4902;
}

export function toWalletChainConfig(network: CeloNetworkConfig) {
  return {
    chainId: `0x${network.chainId.toString(16)}`,
    chainName: network.chainName,
    nativeCurrency: network.nativeCurrency,
    rpcUrls: network.rpcUrls,
    blockExplorerUrls: [network.blockExplorerUrl],
  };
}
