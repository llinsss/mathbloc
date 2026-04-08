'use client';
import { useState, useCallback } from 'react';
import { useAppStore, getActiveProfile } from '@/lib/store';
import { generateQuestion } from '@/lib/questionEngine';
import { getTutorMessage, shouldShowHint } from '@/lib/aiTutor';
import { BADGES, speak } from '@/lib/data';
import { Operation } from '@/lib/types';
import QuestionCard from './QuestionCard';
import ScoreScreen from './ScoreScreen';
import Mascot from '@/components/ui/Mascot';
import RewardBar from '@/components/ui/RewardBar';
import HomeButton from '@/components/ui/HomeButton';

const QUESTIONS_PER_SESSION = 10;

interface PracticeModeProps {
  operation: Operation;
}

export default function PracticeMode({ operation }: PracticeModeProps) {
  const store = useAppStore();
  const profile = useAppStore(getActiveProfile);
  const tutorState = useAppStore(s => profile ? (s.tutorStates[profile.id] ?? null) : null);

  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [mascotMood, setMascotMood] = useState<'idle' | 'happy' | 'sad' | 'excited'>('idle');
  const [mascotMsg, setMascotMsg] = useState(`Let's practice ${operation}! 🎯`);
  const [done, setDone] = useState(false);
  const [newBadge, setNewBadge] = useState<{ name: string; emoji: string } | null>(null);
  const [question, setQuestion] = useState(() =>
    generateQuestion(operation, tutorState?.currentDifficulty ?? 1)
  );

  const handleAnswer = useCallback((answer: number, timeMs: number, hintsUsed: number) => {
    if (!profile) return;
    const correct = answer === question.answer;
    const newScore = correct ? score + 1 : score;

    store.recordResult(profile.id, operation, correct, timeMs, hintsUsed);

    if (correct) {
      store.addReward(profile.id, 5, 1);
      setMascotMood('happy');
    } else {
      setMascotMood('sad');
    }

    const updatedTutor = store.getTutorState(profile.id);
    const msg = getTutorMessage(updatedTutor, correct, profile.name);
    setMascotMsg(msg);
    speak(msg);

    // Check badges
    if (qIndex === 0 && correct) {
      const badge = BADGES.find(b => b.id === 'first-correct');
      if (badge && !profile.badges.find(b => b.id === 'first-correct')) {
        store.awardBadge(profile.id, badge);
        setNewBadge(badge);
      }
    }
    if (updatedTutor.consecutiveCorrect >= 5) {
      const badge = BADGES.find(b => b.id === 'streak-5');
      if (badge && !profile.badges.find(b => b.id === badge.id)) {
        store.awardBadge(profile.id, badge);
        setNewBadge(badge);
      }
    }

    setTimeout(() => {
      if (qIndex + 1 >= QUESTIONS_PER_SESSION) {
        setScore(newScore);
        setDone(true);
        if (newScore === QUESTIONS_PER_SESSION) {
          const badge = BADGES.find(b => b.id === 'perfect-session');
          if (badge) { store.awardBadge(profile.id, badge); setNewBadge(badge); }
        }
      } else {
        setQIndex(i => i + 1);
        setScore(newScore);
        setMascotMood('idle');
        const nextTutor = store.getTutorState(profile.id);
        setQuestion(generateQuestion(operation, nextTutor.currentDifficulty));
      }
    }, 800);
  }, [question, score, qIndex, profile, operation, store]);

  function restart() {
    setQIndex(0); setScore(0); setDone(false); setNewBadge(null);
    setMascotMood('idle'); setMascotMsg(`Let's practice ${operation}! 🎯`);
    const t = profile ? store.getTutorState(profile.id) : null;
    setQuestion(generateQuestion(operation, t?.currentDifficulty ?? 1));
  }

  if (!profile) return <div className="text-center p-8 text-gray-500">No profile selected.</div>;

  const starsEarned = score;
  const coinsEarned = score * 5;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-purple-100 p-4">
      {done && (
        <ScoreScreen
          score={score} total={QUESTIONS_PER_SESSION}
          coinsEarned={coinsEarned} starsEarned={starsEarned}
          onPlayAgain={restart} newBadge={newBadge}
        />
      )}

      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <RewardBar coins={profile.coins} stars={profile.stars} name={profile.name} avatar={profile.avatar} />
          </div>
          <HomeButton gameActive={!done} />
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2">
          {Array.from({ length: QUESTIONS_PER_SESSION }).map((_, i) => (
            <div key={i} className={`w-3 h-3 rounded-full border-2 transition-all ${
              i < qIndex ? 'bg-green-400 border-green-600' :
              i === qIndex ? 'bg-yellow-400 border-yellow-600 scale-125' :
              'bg-gray-200 border-gray-300'
            }`} />
          ))}
        </div>

        <Mascot mood={mascotMood} message={mascotMsg} size="sm" />

        <QuestionCard
          question={question}
          onAnswer={handleAnswer}
          showHint={tutorState ? shouldShowHint(tutorState) : false}
        />
      </div>
    </div>
  );
}
