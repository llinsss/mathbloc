import { AITutorState, SessionResult, Operation, Difficulty } from './types';

const WINDOW = 5; // look at last 5 answers
const UP_THRESHOLD = 4;   // 4/5 correct → increase difficulty
const DOWN_THRESHOLD = 2; // <2/5 correct → decrease difficulty

export function createTutorState(startDifficulty: Difficulty = 1): AITutorState {
  return {
    currentDifficulty: startDifficulty,
    weakAreas: [],
    recentResults: [],
    consecutiveCorrect: 0,
    consecutiveWrong: 0,
    hintsGiven: 0,
  };
}

export function updateTutor(state: AITutorState, result: SessionResult, operation: Operation): AITutorState {
  const recentResults = [...state.recentResults, result].slice(-10);
  const window = recentResults.slice(-WINDOW);
  const correctInWindow = window.filter(r => r.correct).length;

  let difficulty = state.currentDifficulty;
  let consecutiveCorrect = result.correct ? state.consecutiveCorrect + 1 : 0;
  let consecutiveWrong = !result.correct ? state.consecutiveWrong + 1 : 0;

  // Adapt difficulty
  if (window.length >= WINDOW) {
    if (correctInWindow >= UP_THRESHOLD && difficulty < 5) {
      difficulty = Math.min(5, difficulty + 1) as Difficulty;
      consecutiveCorrect = 0;
    } else if (correctInWindow < DOWN_THRESHOLD && difficulty > 1) {
      difficulty = Math.max(1, difficulty - 1) as Difficulty;
      consecutiveWrong = 0;
    }
  }

  // Track weak areas
  const opResults = recentResults.filter((_, i) => i >= recentResults.length - 6);
  const weakAreas = new Set(state.weakAreas);
  if (!result.correct) {
    weakAreas.add(operation);
  } else {
    // Remove from weak if 3 consecutive correct on this op
    const opCorrect = opResults.filter(r => r.correct).length;
    if (opCorrect >= 3) weakAreas.delete(operation);
  }

  return {
    currentDifficulty: difficulty,
    weakAreas: Array.from(weakAreas),
    recentResults,
    consecutiveCorrect,
    consecutiveWrong,
    hintsGiven: result.hintsUsed > 0 ? state.hintsGiven + 1 : state.hintsGiven,
  };
}

export function getTutorMessage(state: AITutorState, correct: boolean, childName: string): string {
  if (correct) {
    const messages = [
      `Amazing, ${childName}! 🌟`,
      `You're so smart! 🎉`,
      `Correct! Keep going! 🚀`,
      `Wonderful! You got it! ⭐`,
      `Brilliant work, ${childName}! 🏆`,
    ];
    if (state.consecutiveCorrect >= 3) {
      return `🔥 ${state.consecutiveCorrect} in a row! You're on fire, ${childName}!`;
    }
    return messages[Math.floor(Math.random() * messages.length)];
  } else {
    const messages = [
      `Almost! Let's try again! 💪`,
      `Don't give up, ${childName}! You can do it! 🌈`,
      `Good try! Let me give you a hint! 💡`,
      `That's okay! Every mistake helps us learn! 🌱`,
    ];
    if (state.consecutiveWrong >= 3) {
      return `Let's slow down and try an easier one! 😊`;
    }
    return messages[Math.floor(Math.random() * messages.length)];
  }
}

export function shouldShowHint(state: AITutorState): boolean {
  return state.consecutiveWrong >= 2;
}

export function getEncouragement(state: AITutorState): string {
  if (state.consecutiveWrong >= 3) return "Take your time! 🐢";
  if (state.consecutiveCorrect >= 5) return "You're a math superstar! ⭐";
  return "You're doing great! 💪";
}
