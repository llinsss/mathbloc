'use client';

interface ProgressBarProps {
  value: number; // 0-100
  color?: string;
  label?: string;
  showPercent?: boolean;
}

export default function ProgressBar({ value, color = 'bg-green-400', label, showPercent }: ProgressBarProps) {
  return (
    <div className="w-full">
      {(label || showPercent) && (
        <div className="flex justify-between mb-1">
          {label && <span className="text-xs font-bold text-gray-600">{label}</span>}
          {showPercent && <span className="text-xs font-bold text-gray-500">{value}%</span>}
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden border-2 border-gray-300">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}
