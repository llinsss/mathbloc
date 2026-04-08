'use client';
import { useRouter } from 'next/navigation';
import Confetti from '@/components/ui/Confetti';

interface ScoreScreenProps {
  score: number;
  total: number;
  coinsEarned: number;
  starsEarned: number;
  onPlayAgain: () => void;
  newBadge?: { name: string; emoji: string } | null;
}

export default function ScoreScreen({ score, total, coinsEarned, starsEarned, onPlayAgain, newBadge }: ScoreScreenProps) {
  const router = useRouter();
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const perfect = score === total;
  const good = pct >= 70;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
      <Confetti active={good} />
      <div className="card-game border-yellow-300 p-8 max-w-sm w-full text-center animate-bounce-in">
        <div className="text-6xl mb-2">{perfect ? '🏆' : good ? '🌟' : '💪'}</div>
        <h2 className="text-3xl font-black text-gray-800 mb-1">
          {perfect ? 'Perfect!' : good ? 'Great Job!' : 'Keep Trying!'}
        </h2>
        <p className="text-gray-500 mb-4 font-bold">{score} / {total} correct ({pct}%)</p>

        {/* Rewards */}
        <div className="flex justify-center gap-4 mb-4">
          <div className="bg-yellow-100 rounded-2xl px-4 py-2 border-2 border-yellow-300">
            <div className="text-2xl">⭐</div>
            <div className="font-black text-yellow-700">+{starsEarned}</div>
          </div>
          <div className="bg-orange-100 rounded-2xl px-4 py-2 border-2 border-orange-300">
            <div className="text-2xl">🪙</div>
            <div className="font-black text-orange-700">+{coinsEarned}</div>
          </div>
        </div>

        {/* New badge */}
        {newBadge && (
          <div className="bg-purple-100 border-2 border-purple-300 rounded-2xl p-3 mb-4 animate-star-pop">
            <p className="text-purple-700 font-black text-sm">🎉 New Badge!</p>
            <p className="text-2xl">{newBadge.emoji}</p>
            <p className="text-purple-600 font-bold text-sm">{newBadge.name}</p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button onClick={onPlayAgain} className="btn-game bg-gradient-to-b from-green-400 to-green-500 border-4 border-green-600 py-3 text-xl w-full">
            🔄 Play Again
          </button>
          <button onClick={() => router.push('/game')} className="btn-game bg-gradient-to-b from-blue-400 to-blue-500 border-4 border-blue-600 py-3 text-xl w-full">
            🏠 Menu
          </button>
        </div>
      </div>
    </div>
  );
}
