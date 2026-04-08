'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import ChallengeMode from '@/components/game/ChallengeMode';
import { Operation } from '@/lib/types';

function ChallengeContent() {
  const params = useSearchParams();
  const op = (params.get('op') || 'addition') as Operation;
  return <ChallengeMode operation={op} />;
}

export default function ChallengePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-4xl">⚡</div>}>
      <ChallengeContent />
    </Suspense>
  );
}
