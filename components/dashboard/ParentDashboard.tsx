'use client';
import { useAppStore, getAccuracy } from '@/lib/store';
import ProgressBar from '@/components/ui/ProgressBar';
import { Operation } from '@/lib/types';

const OP_LABELS: Record<Operation, string> = {
  recognition: '🔢 Number Recognition',
  counting: '🧮 Counting',
  addition: '➕ Addition',
  subtraction: '➖ Subtraction',
  multiplication: '✖️ Multiplication',
  division: '➗ Division',
};

const OP_COLORS: Record<Operation, string> = {
  recognition: 'bg-pink-400',
  counting: 'bg-purple-400',
  addition: 'bg-blue-400',
  subtraction: 'bg-orange-400',
  multiplication: 'bg-green-400',
  division: 'bg-red-400',
};

export default function ParentDashboard() {
  const profiles = useAppStore(s => s.profiles);
  const progress = useAppStore(s => s.progress);
  const deleteProfile = useAppStore(s => s.deleteProfile);

  if (profiles.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">👨‍👩‍👧</div>
        <p className="text-gray-500 font-bold text-lg">No child profiles yet.</p>
        <p className="text-gray-400 text-sm">Add a profile from the home screen.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {profiles.map(profile => {
        const records = progress[profile.id] || [];
        const accuracy = getAccuracy(records);
        const totalTime = records.reduce((s, r) => s + r.avgTimeMs * r.totalAttempts, 0);
        const totalMins = Math.round(totalTime / 60000);

        return (
          <div key={profile.id} className="card-game border-blue-200 p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{profile.avatar}</span>
                <div>
                  <h3 className="font-black text-gray-800 text-lg">{profile.name}</h3>
                  <p className="text-gray-400 text-sm">Ages {profile.ageGroup}</p>
                </div>
              </div>
              <div className="flex gap-2 text-sm">
                <span className="bg-yellow-100 border border-yellow-300 rounded-xl px-2 py-1 font-bold text-yellow-700">⭐ {profile.stars}</span>
                <span className="bg-orange-100 border border-orange-300 rounded-xl px-2 py-1 font-bold text-orange-700">🪙 {profile.coins}</span>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-3 text-center">
                <p className="text-2xl font-black text-green-600">{accuracy}%</p>
                <p className="text-xs text-gray-500 font-bold">Accuracy</p>
              </div>
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-3 text-center">
                <p className="text-2xl font-black text-blue-600">{records.reduce((s, r) => s + r.totalAttempts, 0)}</p>
                <p className="text-xs text-gray-500 font-bold">Questions</p>
              </div>
              <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-3 text-center">
                <p className="text-2xl font-black text-purple-600">{totalMins}m</p>
                <p className="text-xs text-gray-500 font-bold">Time Spent</p>
              </div>
            </div>

            {/* Per-topic progress */}
            {records.length > 0 && (
              <div className="space-y-2 mb-4">
                <p className="text-xs font-black text-gray-500 uppercase tracking-wide">Topic Progress</p>
                {records.map(r => {
                  const acc = r.totalAttempts > 0 ? Math.round((r.correctAttempts / r.totalAttempts) * 100) : 0;
                  return (
                    <ProgressBar
                      key={r.operation}
                      value={acc}
                      color={OP_COLORS[r.operation]}
                      label={OP_LABELS[r.operation]}
                      showPercent
                    />
                  );
                })}
              </div>
            )}

            {/* Badges */}
            {profile.badges.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-black text-gray-500 uppercase tracking-wide mb-2">Badges Earned</p>
                <div className="flex flex-wrap gap-2">
                  {profile.badges.map(b => (
                    <div key={b.id} className="bg-purple-50 border-2 border-purple-200 rounded-xl px-2 py-1 flex items-center gap-1">
                      <span>{b.emoji}</span>
                      <span className="text-xs font-bold text-purple-700">{b.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => deleteProfile(profile.id)}
              className="text-xs text-red-400 underline font-bold"
            >
              Delete Profile
            </button>
          </div>
        );
      })}
    </div>
  );
}
