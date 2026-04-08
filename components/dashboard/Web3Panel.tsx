'use client';
import { useState, useEffect } from 'react';
import { useContract, LeaderboardEntry } from '@/lib/useContract';
import { useAppStore, getActiveProfile } from '@/lib/store';

export default function Web3Panel() {
  const { connect, register, claimReward, getLeaderboard, player, address, loading, error, connected, isDeployed, contractAddress } = useContract();
  const profile = useAppStore(getActiveProfile);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    if (connected) {
      getLeaderboard(10).then(setLeaderboard);
    }
  }, [connected, getLeaderboard]);

  if (!isDeployed) {
    return (
      <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-4 text-center">
        <p className="text-yellow-700 font-bold text-sm">⚠️ Contract not deployed yet.</p>
        <p className="text-yellow-600 text-xs mt-1">Run: <code className="bg-yellow-100 px-1 rounded">npm run deploy:alfajores</code></p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toggle button */}
      <button
        onClick={() => setShowPanel(v => !v)}
        className="w-full btn-game bg-gradient-to-b from-indigo-400 to-indigo-500 border-4 border-indigo-600 py-3 text-lg"
      >
        🔗 {showPanel ? 'Hide' : 'Show'} Blockchain Panel
      </button>

      {showPanel && (
        <div className="card-game border-indigo-200 p-4 space-y-4 animate-bounce-in">
          {/* Contract info */}
          <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-200">
            <p className="text-xs font-black text-indigo-500 uppercase">Contract (Celo Alfajores)</p>
            <p className="text-xs text-indigo-700 font-mono break-all">{contractAddress}</p>
            <a
              href={`https://alfajores.celoscan.io/address/${contractAddress}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-indigo-500 underline"
            >
              View on CeloScan ↗
            </a>
          </div>

          {/* Connect wallet */}
          {!connected ? (
            <button
              onClick={connect}
              disabled={loading}
              className="btn-game w-full bg-gradient-to-b from-green-400 to-green-500 border-4 border-green-600 py-3 text-lg disabled:opacity-50"
            >
              {loading ? '⏳ Connecting...' : '🦊 Connect Wallet'}
            </button>
          ) : (
            <div className="space-y-3">
              {/* Wallet info */}
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-3">
                <p className="text-xs font-black text-green-600">✅ Connected</p>
                <p className="text-xs text-gray-500 font-mono break-all">{address}</p>
              </div>

              {/* Register on-chain */}
              {!player?.exists && profile && (
                <button
                  onClick={() => register(profile.name)}
                  disabled={loading}
                  className="btn-game w-full bg-gradient-to-b from-purple-400 to-purple-500 border-4 border-purple-600 py-3 disabled:opacity-50"
                >
                  {loading ? '⏳ Registering...' : `📝 Register "${profile.name}" On-Chain`}
                </button>
              )}

              {/* On-chain stats */}
              {player?.exists && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3 text-center">
                    <p className="text-xl font-black text-blue-600">{player.totalScore.toString()}</p>
                    <p className="text-xs text-gray-500 font-bold">On-Chain Score</p>
                  </div>
                  <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-3 text-center">
                    <p className="text-xl font-black text-orange-600">{player.streak.toString()}</p>
                    <p className="text-xs text-gray-500 font-bold">Day Streak 🔥</p>
                  </div>
                  <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-3 text-center">
                    <p className="text-xl font-black text-yellow-600">{player.coinsEarned.toString()}</p>
                    <p className="text-xs text-gray-500 font-bold">🪙 Coins</p>
                  </div>
                  <div className="bg-green-50 border-2 border-green-200 rounded-xl p-3 text-center">
                    <p className="text-xl font-black text-green-600">
                      {player.totalAttempts > BigInt(0)
                        ? Math.round(Number(player.totalCorrect * BigInt(100) / player.totalAttempts))
                        : 0}%
                    </p>
                    <p className="text-xs text-gray-500 font-bold">Accuracy</p>
                  </div>
                </div>
              )}

              {/* Claim CELO */}
              {player?.exists && player.coinsEarned >= BigInt(100) && (
                <button
                  onClick={claimReward}
                  disabled={loading}
                  className="btn-game w-full bg-gradient-to-b from-yellow-400 to-yellow-500 border-4 border-yellow-600 py-3 animate-pulse-glow disabled:opacity-50"
                >
                  {loading ? '⏳ Claiming...' : '🎁 Claim 0.001 CELO Reward!'}
                </button>
              )}
            </div>
          )}

          {/* Leaderboard */}
          {leaderboard.length > 0 && (
            <div>
              <p className="text-sm font-black text-gray-600 mb-2">🏆 On-Chain Leaderboard</p>
              <div className="space-y-1">
                {leaderboard.map((entry, i) => (
                  <div key={entry.player} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-gray-400">#{i + 1}</span>
                      <span className="text-sm font-bold text-gray-700">{entry.username}</span>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <span className="text-blue-600 font-bold">{entry.totalScore.toString()} pts</span>
                      <span className="text-orange-500 font-bold">🔥{entry.streak.toString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3">
              <p className="text-red-600 text-xs font-bold">❌ {error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
