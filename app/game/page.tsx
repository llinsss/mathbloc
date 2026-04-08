'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore, getActiveProfile } from '@/lib/store';
import { getOperationsForAgeGroup } from '@/lib/questionEngine';
import { Operation, GameMode } from '@/lib/types';
import RewardBar from '@/components/ui/RewardBar';

const MODE_INFO = [
  { id: 'practice', label: 'Practice', emoji: '📚', desc: 'Learn at your own pace', color: 'from-blue-400 to-blue-500', border: 'border-blue-600' },
  { id: 'challenge', label: 'Challenge', emoji: '⚡', desc: 'Race against the clock!', color: 'from-orange-400 to-orange-500', border: 'border-orange-600' },
  { id: 'story', label: 'Story', emoji: '📖', desc: 'Go on an adventure!', color: 'from-green-400 to-green-500', border: 'border-green-600' },
];

const OP_INFO: Record<Operation, { label: string; emoji: string }> = {
  recognition: { label: 'Numbers', emoji: '🔢' },
  counting: { label: 'Counting', emoji: '🧮' },
  addition: { label: 'Addition', emoji: '➕' },
  subtraction: { label: 'Subtraction', emoji: '➖' },
  multiplication: { label: 'Multiply', emoji: '✖️' },
  division: { label: 'Division', emoji: '➗' },
};

export default function GamePage() {
  const router = useRouter();
  const profile = useAppStore(getActiveProfile);
  const [mode, setMode] = useState<GameMode | null>(null);
  const [operation, setOperation] = useState<Operation | null>(null);

  if (!profile) {
    router.push('/');
    return null;
  }

  const availableOps = getOperationsForAgeGroup(profile.ageGroup);

  function handleStart() {
    if (!mode || (!operation && mode !== 'story')) return;
    const op = operation || 'addition';
    router.push(`/game/${mode}?op=${op}`);
  }

  return (
    <div className="min-h-screen p-4 max-w-md mx-auto">
      <RewardBar coins={profile.coins} stars={profile.stars} name={profile.name} avatar={profile.avatar} />

      <div className="mt-4 mb-2 flex items-center gap-2">
        <button onClick={() => router.push('/')} className="text-gray-400 hover:text-gray-600 font-bold text-sm">← Back</button>
        <h2 className="text-2xl font-black text-gray-800">Choose Mode</h2>
      </div>

      {/* Mode selection */}
      <div className="space-y-3 mb-6">
        {MODE_INFO.map(m => (
          <button
            key={m.id}
            onClick={() => setMode(m.id as GameMode)}
            className={`w-full card-game p-4 flex items-center gap-4 text-left transition-all hover:scale-102 ${
              mode === m.id ? `border-4 border-yellow-400 bg-yellow-50` : 'border-gray-200'
            }`}
          >
            <span className="text-4xl">{m.emoji}</span>
            <div className="flex-1">
              <p className="font-black text-gray-800">{m.label}</p>
              <p className="text-gray-500 text-sm">{m.desc}</p>
            </div>
            {mode === m.id && <span className="text-yellow-500 text-xl">✅</span>}
          </button>
        ))}
      </div>

      {/* Topic selection (not for story mode) */}
      {mode && mode !== 'story' && (
        <div className="mb-6 animate-bounce-in">
          <h3 className="text-lg font-black text-gray-700 mb-3">Choose Topic</h3>
          <div className="grid grid-cols-3 gap-2">
            {availableOps.map(op => (
              <button
                key={op}
                onClick={() => setOperation(op)}
                className={`card-game p-3 text-center transition-all hover:scale-105 ${
                  operation === op ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200'
                }`}
              >
                <div className="text-3xl">{OP_INFO[op].emoji}</div>
                <p className="text-xs font-black text-gray-700 mt-1">{OP_INFO[op].label}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Start button */}
      {mode && (mode === 'story' || operation) && (
        <button
          onClick={handleStart}
          className="btn-game w-full py-5 text-2xl bg-gradient-to-b from-purple-400 to-purple-500 border-4 border-purple-600 animate-bounce-in"
        >
          🚀 Let's Go!
        </button>
      )}
    </div>
  );
}
