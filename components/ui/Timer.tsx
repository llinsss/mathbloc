'use client';
import { useEffect, useState } from 'react';

interface TimerProps {
  seconds: number;
  running: boolean;
  onExpire: () => void;
}

export default function Timer({ seconds, running, onExpire }: TimerProps) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => { setLeft(seconds); }, [seconds]);

  useEffect(() => {
    if (!running) return;
    if (left <= 0) { onExpire(); return; }
    const t = setTimeout(() => setLeft(l => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left, running, onExpire]);

  const pct = (left / seconds) * 100;
  const color = pct > 50 ? 'text-green-600' : pct > 25 ? 'text-yellow-500' : 'text-red-500';
  const bgColor = pct > 50 ? 'bg-green-400' : pct > 25 ? 'bg-yellow-400' : 'bg-red-400';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`text-3xl font-black ${color} ${left <= 10 ? 'animate-pulse' : ''}`}>
        ⏱ {left}s
      </div>
      <div className="w-32 bg-gray-200 rounded-full h-3 border-2 border-gray-300 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-1000 ${bgColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
