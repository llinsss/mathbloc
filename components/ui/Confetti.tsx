'use client';

const COLORS = ['#ff6b6b','#ffd93d','#6bcb77','#4d96ff','#ff6bff','#ff9f43'];

export default function Confetti({ active }: { active: boolean }) {
  if (!active) return null;

  const pieces = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: (i * 37) % 100,
      color: COLORS[i % COLORS.length],
      delay: (i % 6) * 0.08,
      size: 8 + (i % 5) * 2,
  }));

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
