'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface HomeButtonProps {
  gameActive?: boolean; // if true, show warning before leaving
}

export default function HomeButton({ gameActive = true }: HomeButtonProps) {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);

  function handleClick() {
    if (gameActive) {
      setShowWarning(true);
    } else {
      router.push('/');
    }
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center gap-1 bg-white border-2 border-gray-300 rounded-2xl px-3 py-2 font-black text-gray-600 text-sm shadow hover:border-red-300 hover:text-red-500 transition-all active:scale-95"
      >
        🏠 Home
      </button>

      {showWarning && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="card-game border-red-300 p-6 max-w-xs w-full text-center animate-bounce-in">
            <div className="text-5xl mb-3">⚠️</div>
            <h3 className="text-xl font-black text-gray-800 mb-2">Quit the game?</h3>
            <p className="text-gray-500 text-sm mb-5">
              Your current progress will be lost and you won't earn rewards for this session!
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowWarning(false)}
                className="btn-game flex-1 bg-gradient-to-b from-green-400 to-green-500 border-4 border-green-600 py-3 text-base"
              >
                Keep Playing 🎮
              </button>
              <button
                onClick={() => router.push('/')}
                className="btn-game flex-1 bg-gradient-to-b from-red-400 to-red-500 border-4 border-red-600 py-3 text-base"
              >
                Go Home 🏠
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
