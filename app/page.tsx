'use client';
import { useRouter } from 'next/navigation';
import { useAppStore, getActiveProfile } from '@/lib/store';
import ProfileSelector from '@/components/dashboard/ProfileSelector';
import Mascot from '@/components/ui/Mascot';

export default function HomePage() {
  const router = useRouter();
  const profile = useAppStore(getActiveProfile);

  return (
    <div className="min-h-screen p-4 max-w-md mx-auto">
      {/* Header */}
      <div className="text-center py-6">
        <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500 mb-1">
          MathBloc
        </h1>
        <p className="text-gray-500 font-bold">Fun Math for Kids! 🎉</p>
      </div>

      <Mascot
        mood={profile ? 'happy' : 'idle'}
        message={profile ? `Hi ${profile.name}! Ready to play? 🚀` : 'Pick a player to start! 👇'}
        size="md"
      />

      <div className="mt-6">
        <p className="text-sm font-black text-gray-500 uppercase tracking-wide mb-3">Who's playing?</p>
        <ProfileSelector />
      </div>

      {/* Play button */}
      {profile && (
        <div className="mt-6 space-y-3 animate-bounce-in">
          <button
            onClick={() => router.push('/game')}
            className="btn-game w-full py-5 text-2xl bg-gradient-to-b from-green-400 to-green-500 border-4 border-green-600"
          >
            🎮 Play Now!
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="btn-game w-full py-3 text-lg bg-gradient-to-b from-blue-400 to-blue-500 border-4 border-blue-600"
          >
            📊 Parent Dashboard
          </button>
        </div>
      )}

      <p className="text-center text-xs text-gray-400 mt-6">Ages 2–9 · Math made fun!</p>
    </div>
  );
}
