'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import PracticeMode from '@/components/game/PracticeMode';
import { Operation } from '@/lib/types';

function PracticeContent() {
  const params = useSearchParams();
  const op = (params.get('op') || 'addition') as Operation;
  return <PracticeMode operation={op} />;
}

export default function PracticePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-4xl">🎮</div>}>
      <PracticeContent />
    </Suspense>
  );
}
