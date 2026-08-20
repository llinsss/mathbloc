'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useAppStore, getActiveProfile } from '@/lib/store';
import { generateQuestion } from '@/lib/questionEngine';
import { getTutorMessage } from '@/lib/aiTutor';
import { BADGES, speak } from '@/lib/data';
import { Operation } from '@/lib/types';
import { useSessionSubmit } from '@/lib/useSessionSubmit';
import QuestionCard from './QuestionCard';
import ScoreScreen from './ScoreScreen';
import Mascot from '@/components/ui/Mascot';
import RewardBar from '@/components/ui/RewardBar';
import Timer from '@/components/ui/Timer';
import HomeButton from '@/components/ui/HomeButton';

const CHALLENGE_SECONDS = 60;

interface ChallengeModeProps {
  operation: Operation;
}

export default function ChallengeMode({ operation }: ChallengeModeProps) {
  const store = useAppStore();
  const profile = useAppStore(getActiveProfile);
  const tutorState = useAppStore(s => profile ? (s.tutorStates[profile.id] ?? null) : null);
  const { submitSession, submitStatus, lastError, retry } = useSessionSubmit();

  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const [mascotMood, setMascotMood] = useState<'idle' | 'happy' | 'sad' | 'excited'>('idle');
  const [mascotMsg, setMascotMsg] = useState('Answer as many as you can! ⚡');
  const [newBadge, setNewBadge] = useState<{ name: string; emoji: string } | null>(null);
  const [question, setQuestion] = useState(() =>
    generateQuestion(operation, tutorState?.currentDifficulty ?? 1)
  );
  const [timerKey, setTimerKey] = useState(0);
  const submittedRef = useRef(false);
  const finalScoreRef = useRef({ score: 0, total: 0 });

  const handleExpire = useCallback(() => {
    setDone(true);
    speak('Time is up! Great job!');
  }, []);

  const handleAnswer = useCallback((answer: number, timeMs: number, hintsUsed: number) => {
    if (!profile || done) return;
    const correct = answer === question.answer;
    store.recordResult(profile.id, operation, correct, timeMs, hintsUsed);

    if (correct) {
      store.addReward(profile.id, 8, 1);
      setScore(s => s + 1);
      setMascotMood('excited');
      if (timeMs < 3000) {
        const badge = BADGES.find(b => b.id === 'speed-demon');
        if (badge && !profile.badges.find(b => b.id === badge.id)) {
          store.awardBadge(profile.id, badge);
          setNewBadge(badge);
        }
      }
    } else {
      setMascotMood('sad');
    }

    setTotal(t => t + 1);
    const updatedTutor = store.getTutorState(profile.id);
    const msg = getTutorMessage(updatedTutor, correct, profile.name);
    setMascotMsg(msg);

    setTimeout(() => {
      setMascotMood('idle');
      const nextTutor = store.getTutorState(profile.id);
      setQuestion(generateQuestion(operation, nextTutor.currentDifficulty));
    }, 400);
  }, [question, done, profile, operation, store]);

  useEffect(() => {
    if (done) {
      finalScoreRef.current = { score, total };
    }
  }, [done, score, total]);

  useEffect(() => {
    if (done && profile && !submittedRef.current) {
      submittedRef.current = true;
      const { score: finalScore, total: finalTotal } = finalScoreRef.current;
      submitSession({
        mode: 'challenge',
        topic: operation,
        score: finalScore,
        correct: finalScore,
        attempts: finalTotal,
        profileId: profile.id,
      });
    }
  }, [done, profile, operation, submitSession]);

  function restart() {
    submittedRef.current = false;
    finalScoreRef.current = { score: 0, total: 0 };
    setScore(0); setTotal(0); setDone(false); setStarted(false);
    setNewBadge(null); setMascotMood('idle');
    setMascotMsg('Answer as many as you can! ⚡');
    setTimerKey(key => key + 1);
    const t = profile ? store.getTutorState(profile.id) : null;
    setQuestion(generateQuestion(operation, t?.currentDifficulty ?? 1));
  }

  if (!profile) return <div className="text-center p-8 text-gray-500">No profile selected.</div>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-100 to-red-100 p-4">
      {done && (
        <ScoreScreen
          score={score} total={total}
          coinsEarned={score * 8} starsEarned={score}
          onPlayAgain={restart} newBadge={newBadge}
        >
          <SubmissionStatus status={submitStatus} error={lastError} onRetry={retry} />
        </ScoreScreen>
      )}

      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <RewardBar coins={profile.coins} stars={profile.stars} name={profile.name} avatar={profile.avatar} />
          </div>
          <HomeButton gameActive={started && !done} />
        </div>

        <div className="flex justify-between items-center">
          <div className="bg-white rounded-2xl px-4 py-2 border-2 border-green-300 font-black text-green-700">
            ✅ {score} correct
          </div>
          <Timer key={timerKey} seconds={CHALLENGE_SECONDS} running={started && !done} onExpire={handleExpire} />
          <div className="bg-white rounded-2xl px-4 py-2 border-2 border-gray-300 font-black text-gray-600">
            📝 {total} total
          </div>
        </div>

        <Mascot mood={mascotMood} message={mascotMsg} size="sm" />

        {!started ? (
          <div className="card-game border-orange-300 p-8 text-center">
            <div className="text-6xl mb-4">⚡</div>
            <h2 className="text-2xl font-black text-gray-800 mb-2">Challenge Mode!</h2>
            <p className="text-gray-500 mb-6">Answer as many questions as you can in {CHALLENGE_SECONDS} seconds!</p>
            <button
              onClick={() => setStarted(true)}
              className="btn-game bg-gradient-to-b from-orange-400 to-orange-500 border-4 border-orange-600 py-4 px-8 text-2xl w-full"
            >
              🚀 Start!
            </button>
          </div>
        ) : (
          <QuestionCard question={question} onAnswer={handleAnswer} disabled={done} />
        )}
      </div>
    </div>
  );
}

function SubmissionStatus({ status, error, onRetry }: { status: string; error: string | null; onRetry: () => void }) {
  if (status === 'confirmed' || status === 'idle' || status === 'not-connected') return null;

  return (
    <div className="mt-3 text-center">
      {status === 'pending' && (
        <p className="text-xs text-blue-600 font-bold">Syncing to blockchain...</p>
      )}
      {status === 'rejected' && (
        <div className="space-y-1">
          <p className="text-xs text-red-600 font-bold">On-chain sync failed{error ? `: ${error}` : ''}</p>
          <button onClick={onRetry} className="text-xs text-white bg-red-500 rounded px-3 py-1 font-bold">Retry</button>
        </div>
      )}
      {status === 'wrong-network' && (
        <div className="space-y-1">
          <p className="text-xs text-orange-600 font-bold">Wrong network</p>
        </div>
      )}
      {status === 'not-registered' && (
        <p className="text-xs text-yellow-600 font-bold">Register on-chain from the dashboard to sync scores.</p>
      )}
    </div>
  );
}
