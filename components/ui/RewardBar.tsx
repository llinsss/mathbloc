'use client';

interface RewardBarProps {
  coins: number;
  stars: number;
  name: string;
  avatar: string;
}

export default function RewardBar({ coins, stars, name, avatar }: RewardBarProps) {
  return (
    <div className="flex items-center justify-between bg-white/80 backdrop-blur rounded-2xl px-4 py-2 shadow border-2 border-yellow-200">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{avatar}</span>
        <span className="font-bold text-gray-700 text-sm">{name}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 bg-yellow-100 rounded-xl px-3 py-1">
          <span className="text-lg">⭐</span>
          <span className="font-bold text-yellow-700 text-sm">{stars}</span>
        </div>
        <div className="flex items-center gap-1 bg-orange-100 rounded-xl px-3 py-1">
          <span className="text-lg">🪙</span>
          <span className="font-bold text-orange-700 text-sm">{coins}</span>
        </div>
      </div>
    </div>
  );
}
