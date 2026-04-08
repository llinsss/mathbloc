'use client';
import { useState, useCallback } from 'react';
import { useAppStore, getActiveProfile } from '@/lib/store';
import { generateQuestion } from '@/lib/questionEngine';
import { getTutorMessage, shouldShowHint } from '@/lib/aiTutor';
import { STORY_CHAPTERS, BADGES, speak } from '@/lib/data';
import { Operation } from '@/lib/types';
import QuestionCard from './QuestionCard';
import ScoreScreen from './ScoreScreen';
import Mascot from '@/components/ui/Mascot';
import RewardBar from '@/components/ui/RewardBar';
import ProgressBar from '@/components/ui/ProgressBar';

const QUESTIONS_PER_CHAPTER = 8;

export default function StoryMode() {
  const store = useAppStore();
  const profile = useAppStore(getActiveProfile);
  const tutorState = useAppStore(s => profile ? (s.tutorStates[profile.id] ?? null) : null);

  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [mascotMood, setMascotMood] = useState<'idle' | 'happy' | 'sad' | 'excited'>('idle');
  const [mascotMsg, setMascotMsg] = useState('');
  const [newBadge, setNewBadge] = useState<{ name: string; emoji: string } | null>(null);
  const [question, setQuestion] = useState<ReturnType<typeof generateQuestion> | null>(null);

  const chapter = selectedChapter !== null ? STORY_CHAPTERS[selectedChapter - 1] : null;

  function startChapter(chapterId: number) {
    const ch = STORY_CHAPTERS[chapterId - 1];
    setSelectedChapter(chapterId);
    setQIndex(0); setScore(0); setDone(false); setNewBadge(null);
    setMascotMood('idle');
    setMascotMsg(`Welcome to ${ch.title}! ${ch.description}`);
    speak(`Welcome to ${ch.title}! ${ch.description}`);
    const op = ch.operations[0] as Operation;
    const t = profile ? store.getTutorState(profile.id) : null;
    setQuestion(generateQuestion(op, t?.currentDifficulty ?? 1));
  }

  const handleAnswer = useCallback((answer: number, timeMs: number, hintsUsed: number) => {
    if (!profile || !chapter || !question) return;
    const op = chapter.operations[0] as Operation;
    const correct = answer === question.answer;
    store.recordResult(profile.id, op, correct, timeMs, hintsUsed);

    const newScore = correct ? score + 1 : score;
    if (correct) store.addReward(profile.id, 10, 2);

    const updatedTutor = store.getTutorState(profile.id);
    const msg = getTutorMessage(updatedTutor, correct, profile.name);
    setMascotMsg(msg);
    setMascotMood(correct ? 'happy' : 'sad');
    speak(msg);

    // Chapter badge
    if (qIndex + 1 >= QUESTIONS_PER_CHAPTER) {
      const badge = BADGES.find(b => b.id === `chapter-${chapter.id}`);
      if (badge && !profile.badges.find(b => b.id === badge.id)) {
        store.awardBadge(profile.id, badge);
        setNewBadge(badge);
      }
      setScore(newScore);
      setDone(true);
    } else {
      setTimeout(() => {
        setQIndex(i => i + 1);
        setScore(newScore);
        setMascotMood('idle');
        const nextTutor = store.getTutorState(profile.id);
        setQuestion(generateQuestion(op, nextTutor.currentDifficulty));
      }, 800);
    }
  }, [question, score, qIndex, profile, chapter, store]);

  if (!profile) return <div className="text-center p-8 text-gray-500">No profile selected.</div>;

  // Chapter selection screen
  if (!selectedChapter) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-100 to-teal-100 p-4">
        <div className="max-w-md mx-auto space-y-4">
          <RewardBar coins={profile.coins} stars={profile.stars} name={profile.name} avatar={profile.avatar} />
          <div className="text-center">
            <h2 className="text-3xl font-black text-gray-800">📖 Story Mode</h2>
            <p className="text-gray-500 font-bold">Choose your adventure!</p>
          </div>
          <div className="space-y-3">
            {STORY_CHAPTERS.map(ch => {
              const unlocked = profile.stars >= ch.requiredStars;
              return (
                <button
                  key={ch.id}
                  onClick={() => unlocked && startChapter(ch.id)}
                  disabled={!unlocked}
                  className={`w-full card-game p-4 flex items-center gap-4 text-left transition-all ${
                    unlocked ? 'border-green-300 hover:scale-102 hover:shadow-2xl cursor-pointer' : 'border-gray-200 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <span className="text-4xl">{ch.emoji}</span>
                  <div className="flex-1">
                    <p className="font-black text-gray-800">{ch.title}</p>
                    <p className="text-gray-500 text-sm">{ch.description}</p>
                  </div>
                  {unlocked ? (
                    <span className="text-green-500 text-2xl">▶️</span>
                  ) : (
                    <div className="text-right">
                      <span className="text-gray-400 text-xl">🔒</span>
                      <p className="text-xs text-gray-400">⭐{ch.requiredStars}</p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-100 to-teal-100 p-4">
      {done && (
        <ScoreScreen
          score={score} total={QUESTIONS_PER_CHAPTER}
          coinsEarned={score * 10} starsEarned={score * 2}
          onPlayAgain={() => startChapter(selectedChapter)}
          newBadge={newBadge}
        />
      )}
      <div className="max-w-md mx-auto space-y-4">
        <RewardBar coins={profile.coins} stars={profile.stars} name={profile.name} avatar={profile.avatar} />

        <div className="card-game border-green-300 p-3 flex items-center gap-3">
          <span className="text-3xl">{chapter!.emoji}</span>
          <div className="flex-1">
            <p className="font-black text-gray-800 text-sm">{chapter!.title}</p>
            <ProgressBar value={(qIndex / QUESTIONS_PER_CHAPTER) * 100} color="bg-green-400" />
          </div>
          <span className="text-sm font-bold text-gray-500">{qIndex}/{QUESTIONS_PER_CHAPTER}</span>
        </div>

        <Mascot mood={mascotMood} message={mascotMsg} size="sm" />

        {question && (
          <QuestionCard
            question={question}
            onAnswer={handleAnswer}
            showHint={tutorState ? shouldShowHint(tutorState) : false}
          />
        )}
      </div>
    </div>
  );
}
