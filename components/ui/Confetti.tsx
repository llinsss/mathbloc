'use client';
import { useEffect, useState } from 'react';

const COLORS = ['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#ff6bff','#ff9f43'];

export default function Confetti({ active }: { active: boolean }) {
  const [pieces, setPieces] = useState<{ id: number; x: number; color: string; delay: number; size: number }[]>([]);

  useEffect(() => {
    if (!active) { setPieces([]); return; }
    setPieces(Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: Math.random() * 0.5,
      size: Math.random() * 10 + 8,
    })));
  }, [active]);

  if (!pieces.length) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map(p => (
        <div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.x}%`,
            top: '-20px',
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animation: `confetti-fall 1.5s ease-in ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}
