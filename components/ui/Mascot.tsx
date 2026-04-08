'use client';

interface MascotProps {
  mood: 'idle' | 'happy' | 'sad' | 'thinking' | 'excited';
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

const MOODS: Record<string, string> = {
  idle: '🦉',
  happy: '🦉',
  sad: '🦉',
  thinking: '🦉',
  excited: '🦉',
};

const MOOD_CLASSES: Record<string, string> = {
  idle: 'animate-float',
  happy: 'animate-bounce-in',
  sad: 'animate-wiggle',
  thinking: 'animate-float',
  excited: 'animate-bounce-in',
};

const SIZES = { sm: 'text-4xl', md: 'text-6xl', lg: 'text-8xl' };

export default function Mascot({ mood, message, size = 'md' }: MascotProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`${SIZES[size]} ${MOOD_CLASSES[mood]} select-none`}>
        {mood === 'happy' || mood === 'excited' ? '🦉' : mood === 'sad' ? '🦉' : '🦉'}
        {mood === 'happy' && <span className="text-2xl absolute -mt-2 -mr-2">✨</span>}
      </div>
      {message && (
        <div className="relative bg-white rounded-2xl border-4 border-yellow-300 px-4 py-2 max-w-xs text-center shadow-lg animate-bounce-in">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-transparent border-b-yellow-300" />
          <p className="text-gray-700 font-bold text-sm leading-snug">{message}</p>
        </div>
      )}
    </div>
  );
}
