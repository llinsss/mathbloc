export type AgeGroup = '2-3' | '4-5' | '6-7' | '8-9';
export type Operation = 'recognition' | 'counting' | 'addition' | 'subtraction' | 'multiplication' | 'division';
export type GameMode = 'practice' | 'challenge' | 'story';
export type Difficulty = 1 | 2 | 3 | 4 | 5;

export interface ChildProfile {
  id: string;
  name: string;
  avatar: string; // emoji
  ageGroup: AgeGroup;
  coins: number;
  stars: number;
  badges: Badge[];
  createdAt: number;
}

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  earnedAt: number;
}

export interface Question {
  id: string;
  operation: Operation;
  prompt: string;
  visualPrompt?: string[]; // emojis for counting/recognition
  answer: number;
  choices: number[];
  difficulty: Difficulty;
  hint: string;
}

export interface SessionResult {
  questionId: string;
  correct: boolean;
  timeMs: number;
  hintsUsed: number;
}

export interface ProgressRecord {
  profileId: string;
  operation: Operation;
  totalAttempts: number;
  correctAttempts: number;
  avgTimeMs: number;
  difficulty: Difficulty;
  lastPlayed: number;
  streak: number;
}

export interface AITutorState {
  currentDifficulty: Difficulty;
  weakAreas: Operation[];
  recentResults: SessionResult[];
  consecutiveCorrect: number;
  consecutiveWrong: number;
  hintsGiven: number;
}

export interface StoryChapter {
  id: number;
  title: string;
  emoji: string;
  description: string;
  operations: Operation[];
  requiredStars: number;
  unlocked: boolean;
}
