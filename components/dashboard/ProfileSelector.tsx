'use client';
import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { AVATARS, AGE_GROUPS, speak } from '@/lib/data';
import { AgeGroup } from '@/lib/types';

export default function ProfileSelector() {
  const { profiles, addProfile, setActiveProfile, activeProfileId } = useAppStore();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('4-5');

  function handleCreate() {
    if (!name.trim()) return;
    addProfile({ name: name.trim(), avatar, ageGroup });
    setCreating(false);
    setName('');
  }

  function handleSelect(id: string, profileName: string) {
    setActiveProfile(id);
    speak(`Hello ${profileName}! Let's play!`);
  }

  return (
    <div className="space-y-4">
      {/* Existing profiles */}
      <div className="grid grid-cols-2 gap-3">
        {profiles.map(p => (
          <button
            key={p.id}
            onClick={() => handleSelect(p.id, p.name)}
            className={`card-game p-4 text-center transition-all hover:scale-105 ${
              activeProfileId === p.id ? 'border-yellow-400 bg-yellow-50 animate-pulse-glow' : 'border-blue-200'
            }`}
          >
            <div className="text-5xl mb-1">{p.avatar}</div>
            <p className="font-black text-gray-800 truncate">{p.name}</p>
            <p className="text-xs text-gray-400">Ages {p.ageGroup}</p>
            <div className="flex justify-center gap-2 mt-1">
              <span className="text-xs text-yellow-600 font-bold">⭐{p.stars}</span>
              <span className="text-xs text-orange-600 font-bold">🪙{p.coins}</span>
            </div>
            {activeProfileId === p.id && (
              <div className="mt-1 text-xs bg-yellow-400 text-yellow-900 rounded-full px-2 py-0.5 font-black">Active</div>
            )}
          </button>
        ))}

        {/* Add new profile button */}
        <button
          onClick={() => setCreating(true)}
          className="card-game border-dashed border-gray-300 p-4 text-center hover:border-blue-400 hover:bg-blue-50 transition-all"
        >
          <div className="text-5xl mb-1">➕</div>
          <p className="font-bold text-gray-400 text-sm">Add Child</p>
        </button>
      </div>

      {/* Create profile modal */}
      {creating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card-game border-purple-300 p-6 w-full max-w-sm animate-bounce-in">
            <h3 className="text-2xl font-black text-gray-800 mb-4 text-center">New Profile 🌟</h3>

            <input
              type="text"
              placeholder="Child's name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border-4 border-purple-200 rounded-2xl px-4 py-3 text-lg font-bold text-gray-700 mb-4 focus:outline-none focus:border-purple-400"
              maxLength={20}
            />

            {/* Avatar picker */}
            <p className="text-sm font-black text-gray-500 mb-2">Pick an avatar:</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {AVATARS.map(a => (
                <button
                  key={a}
                  onClick={() => setAvatar(a)}
                  className={`text-3xl p-1 rounded-xl border-2 transition-all ${avatar === a ? 'border-purple-500 bg-purple-100 scale-110' : 'border-transparent'}`}
                >
                  {a}
                </button>
              ))}
            </div>

            {/* Age group picker */}
            <p className="text-sm font-black text-gray-500 mb-2">Age group:</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {AGE_GROUPS.map(ag => (
                <button
                  key={ag.value}
                  onClick={() => setAgeGroup(ag.value as AgeGroup)}
                  className={`rounded-2xl border-4 py-2 font-bold text-sm transition-all ${
                    ageGroup === ag.value ? 'border-purple-500 bg-purple-100 text-purple-700' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {ag.emoji} {ag.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setCreating(false)} className="btn-game bg-gray-200 text-gray-700 border-4 border-gray-300 py-3 flex-1">Cancel</button>
              <button onClick={handleCreate} disabled={!name.trim()} className="btn-game bg-gradient-to-b from-purple-400 to-purple-500 border-4 border-purple-600 py-3 flex-1 disabled:opacity-50">
                Create! 🎉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
