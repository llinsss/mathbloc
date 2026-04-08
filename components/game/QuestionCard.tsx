'use client';
import { useState, useEffect } from 'react';
import { Question } from '@/lib/types';
import { speak } from '@/lib/data';

interface QuestionCardProps {
  question: Question;
  onAnswer: (answer: number, timeMs: number, hintsUsed: number) => void;
  showHint?: boolean;
  disabled?: boolean;
}

export default function QuestionCard({ question, onAnswer, showHint, disabled }: QuestionCardProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [startTime] = useState(Date.now());
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintVisible, setHintVisible] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    setSelected(null);
    setHintsUsed(0);
    setHintVisible(false);
    speak(question.prompt);
  }, [question.id]);

  function handleChoice(choice: number) {
    if (disabled || selected !== null) return;
    setSelected(choice);
    const timeMs = Date.now() - startTime;
    if (choice !== question.answer) {
      setShake(true);
      setTimeout(() => setShake(false), 600);
    }
    setTimeout(() => onAnswer(choice, timeMs, hintsUsed), 600);
  }

  function handleHint() {
    setHintVisible(true);
    setHintsUsed(h => h + 1);
    speak(question.hint);
  }

  const isVisual = question.operation === 'counting' || question.operation === 'recognition';

  return (
    <div className={`card-game border-purple-300 p-6 w-full max-w-md mx-auto ${shake ? 'animate-shake' : ''}`}>
      {/* Question prompt */}
      <div className="text-center mb-4">
        <p className="text-gray-500 text-sm font-bold uppercase tracking-wide mb-1">
          {question.operation.charAt(0).toUpperCase() + question.operation.slice(1)}
        </p>

        {/* Visual display for counting/recognition */}
        {isVisual && question.visualPrompt && (
          <div className="flex flex-wrap justify-center gap-2 my-4 min-h-16">
            {question.operation === 'recognition' ? (
              <span className="text-7xl font-black text-purple-600">{question.visualPrompt[0]}</span>
            ) : (
              question.visualPrompt.map((emoji, i) => (
                <span key={i} className="text-3xl animate-bounce-in" style={{ animationDelay: `${i * 0.05}s` }}>
                  {emoji}
                </span>
              ))
            )}
          </div>
        )}

        <h2 className="text-4xl font-black text-gray-800 my-3">{question.prompt}</h2>
      </div>

      {/* Answer choices */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {question.choices.map((choice) => {
          const isCorrect = choice === question.answer;
          const isSelected = selected === choice;
          let btnClass = 'btn-game py-4 text-2xl font-black w-full border-4 ';

          if (isSelected) {
            btnClass += isCorrect
              ? 'bg-green-400 border-green-600 scale-105'
              : 'bg-red-400 border-red-600';
          } else if (selected !== null && isCorrect) {
            btnClass += 'bg-green-400 border-green-600';
          } else {
            btnClass += 'bg-gradient-to-b from-blue-400 to-blue-500 border-blue-600 hover:from-blue-300 hover:to-blue-400 hover:scale-105';
          }

          return (
            <button
              key={choice}
              className={btnClass}
              onClick={() => handleChoice(choice)}
              disabled={disabled || selected !== null}
            >
              {choice}
            </button>
          );
        })}
      </div>

      {/* Hint */}
      {(showHint || hintsUsed > 0) && (
        <div className="text-center">
          {hintVisible ? (
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-3 animate-bounce-in">
              <p className="text-yellow-700 font-bold text-sm">💡 {question.hint}</p>
            </div>
          ) : (
            <button
              onClick={handleHint}
              className="text-sm text-purple-500 underline font-bold"
            >
              💡 Need a hint?
            </button>
          )}
        </div>
      )}
    </div>
  );
}
