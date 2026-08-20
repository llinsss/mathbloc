import assert from 'node:assert/strict';
import {
  CELO_CHAIN_IDS,
  assertContractBytecode,
  assertSupportedDeployment,
  getCeloNetwork,
  getExplorerUrl,
  isUserRejectedError,
  networkRecoveryMessage,
  toWalletChainConfig,
} from '../lib/networkConfig';

const mainnetAddress = '0xCcA8f0878E703425Ec8000d38aDbEDaCD10F5d7d';
const alfajoresAddress = '0x0000000000000000000000000000000000000001';

assert.equal(getCeloNetwork(CELO_CHAIN_IDS.mainnet)?.chainName, 'Celo Mainnet');
assert.equal(getCeloNetwork(CELO_CHAIN_IDS.alfajores)?.chainName, 'Celo Alfajores Testnet');
assert.equal(getExplorerUrl(CELO_CHAIN_IDS.mainnet, mainnetAddress), `https://celoscan.io/address/${mainnetAddress}`);
assert.equal(getExplorerUrl(CELO_CHAIN_IDS.alfajores, alfajoresAddress), `https://alfajores.celoscan.io/address/${alfajoresAddress}`);
assert.equal(getCeloNetwork(1), null);
assert.equal(getExplorerUrl(1, mainnetAddress), null);
assert.doesNotThrow(() => assertSupportedDeployment(CELO_CHAIN_IDS.mainnet, mainnetAddress));
assert.doesNotThrow(() => assertSupportedDeployment(CELO_CHAIN_IDS.alfajores, alfajoresAddress));
assert.throws(() => assertSupportedDeployment(1, mainnetAddress), /Unsupported Celo network/);
assert.throws(() => assertSupportedDeployment(CELO_CHAIN_IDS.mainnet, '0x123'), /Invalid contract address/);
assert.doesNotThrow(() => assertContractBytecode('0x6000', mainnetAddress, 'Celo Mainnet'));
assert.throws(() => assertContractBytecode('0x', mainnetAddress, 'Celo Mainnet'), /No contract bytecode/);
assert.equal(networkRecoveryMessage(CELO_CHAIN_IDS.mainnet, CELO_CHAIN_IDS.alfajores), 'Wrong network. Select Celo Mainnet in your wallet, then reconnect.');
assert.match(networkRecoveryMessage(CELO_CHAIN_IDS.alfajores, 1), /Unsupported wallet network/);
assert.equal(toWalletChainConfig(getCeloNetwork(CELO_CHAIN_IDS.mainnet)!).chainId, '0xa4ec');
assert.equal(toWalletChainConfig(getCeloNetwork(CELO_CHAIN_IDS.alfajores)!).chainId, '0xaef3');
assert.equal(isUserRejectedError({ code: 4001 }), true);
assert.equal(isUserRejectedError({ code: 4902 }), false);

console.log('networkConfig tests passed');
