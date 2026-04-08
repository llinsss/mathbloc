import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChildProfile, ProgressRecord, Operation, AITutorState, GameMode, Difficulty, Badge } from './types';
import { createTutorState, updateTutor } from './aiTutor';

interface GameSession {
  mode: GameMode;
  operation: Operation;
  score: number;
  total: number;
  timeLeft: number; // for challenge mode
  active: boolean;
  chapterId?: number;
}

interface AppState {
  profiles: ChildProfile[];
  activeProfileId: string | null;
  progress: Record<string, ProgressRecord[]>; // profileId -> records
  tutorStates: Record<string, AITutorState>;   // profileId -> tutor
  session: GameSession | null;

  // Profile actions
  addProfile: (profile: Omit<ChildProfile, 'id' | 'createdAt' | 'coins' | 'stars' | 'badges'>) => void;
  setActiveProfile: (id: string) => void;
  deleteProfile: (id: string) => void;

  // Progress actions
  recordResult: (profileId: string, operation: Operation, correct: boolean, timeMs: number, hintsUsed: number) => void;
  addReward: (profileId: string, coins: number, stars: number) => void;
  awardBadge: (profileId: string, badge: Omit<Badge, 'earnedAt'>) => void;

  // Session actions
  startSession: (mode: GameMode, operation: Operation, chapterId?: number) => void;
  endSession: () => void;

  // Tutor
  getTutorState: (profileId: string) => AITutorState;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeProfileId: null,
      progress: {},
      tutorStates: {},
      session: null,

      addProfile: (data) => {
        const id = `profile-${Date.now()}`;
        const profile: ChildProfile = { ...data, id, coins: 0, stars: 0, badges: [], createdAt: Date.now() };
        set(s => ({ profiles: [...s.profiles, profile] }));
      },

      setActiveProfile: (id) => set({ activeProfileId: id }),

      deleteProfile: (id) => set(s => ({
        profiles: s.profiles.filter(p => p.id !== id),
        activeProfileId: s.activeProfileId === id ? null : s.activeProfileId,
      })),

      recordResult: (profileId, operation, correct, timeMs, hintsUsed) => {
        const state = get();
        const existing = state.progress[profileId] || [];
        const rec = existing.find(r => r.operation === operation);
        const tutorState = state.tutorStates[profileId] || createTutorState();

        const sessionResult = { questionId: '', correct, timeMs, hintsUsed };
        const newTutor = updateTutor(tutorState, sessionResult, operation);

        let updated: ProgressRecord;
        if (rec) {
          const total = rec.totalAttempts + 1;
          updated = {
            ...rec,
            totalAttempts: total,
            correctAttempts: rec.correctAttempts + (correct ? 1 : 0),
            avgTimeMs: Math.round((rec.avgTimeMs * rec.totalAttempts + timeMs) / total),
            difficulty: newTutor.currentDifficulty,
            lastPlayed: Date.now(),
            streak: correct ? rec.streak + 1 : 0,
          };
        } else {
          updated = {
            profileId, operation,
            totalAttempts: 1,
            correctAttempts: correct ? 1 : 0,
            avgTimeMs: timeMs,
            difficulty: newTutor.currentDifficulty,
            lastPlayed: Date.now(),
            streak: correct ? 1 : 0,
          };
        }

        set(s => ({
          progress: {
            ...s.progress,
            [profileId]: [...existing.filter(r => r.operation !== operation), updated],
          },
          tutorStates: { ...s.tutorStates, [profileId]: newTutor },
        }));
      },

      addReward: (profileId, coins, stars) => set(s => ({
        profiles: s.profiles.map(p =>
          p.id === profileId ? { ...p, coins: p.coins + coins, stars: p.stars + stars } : p
        ),
      })),

      awardBadge: (profileId, badge) => set(s => ({
        profiles: s.profiles.map(p =>
          p.id === profileId && !p.badges.find(b => b.id === badge.id)
            ? { ...p, badges: [...p.badges, { ...badge, earnedAt: Date.now() }] }
            : p
        ),
      })),

      startSession: (mode, operation, chapterId) => set({
        session: { mode, operation, score: 0, total: 0, timeLeft: 60, active: true, chapterId },
      }),

      endSession: () => set({ session: null }),

      getTutorState: (profileId) => {
        return get().tutorStates[profileId] || createTutorState();
      },
    }),
    { name: 'mathgame-store' }
  )
);

// Selectors
export const getActiveProfile = (state: AppState) =>
  state.profiles.find(p => p.id === state.activeProfileId);

export const getProfileProgress = (state: AppState, profileId: string) =>
  state.progress[profileId] || [];

export const getAccuracy = (records: ProgressRecord[]) => {
  const total = records.reduce((s, r) => s + r.totalAttempts, 0);
  const correct = records.reduce((s, r) => s + r.correctAttempts, 0);
  return total === 0 ? 0 : Math.round((correct / total) * 100);
};
