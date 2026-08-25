import { describe, it, expect } from 'vitest';
import {
  createTutorState,
  updateTutor,
  getTutorMessage,
  shouldShowHint,
  getEncouragement,
} from '../lib/aiTutor';
import { SessionResult, Difficulty } from '../lib/types';

describe('aiTutor', () => {
  describe('createTutorState', () => {
    it('creates initial tutor state with default or custom difficulty', () => {
      const defaultState = createTutorState();
      expect(defaultState.currentDifficulty).toBe(1);
      expect(defaultState.weakAreas).toEqual([]);
      expect(defaultState.recentResults).toEqual([]);
      expect(defaultState.consecutiveCorrect).toBe(0);
      expect(defaultState.consecutiveWrong).toBe(0);
      expect(defaultState.hintsGiven).toBe(0);

      const customState = createTutorState(3 as Difficulty);
      expect(customState.currentDifficulty).toBe(3);
    });
  });

  describe('updateTutor adaptive difficulty thresholds', () => {
    const makeResult = (correct: boolean, hintsUsed = 0): SessionResult => ({
      questionId: `q-${Math.random()}`,
      correct,
      timeMs: 1500,
      hintsUsed,
    });

    it('does not adjust difficulty before 5 answers in window', () => {
      let state = createTutorState(2);
      for (let i = 0; i < 4; i++) {
        state = updateTutor(state, makeResult(true), 'addition');
      }
      expect(state.currentDifficulty).toBe(2);
      expect(state.recentResults).toHaveLength(4);
      expect(state.consecutiveCorrect).toBe(4);
    });

    it('increases difficulty when reaching 4/5 correct threshold', () => {
      let state = createTutorState(2);
      // 4 correct, 1 wrong in a window of 5 answers
      state = updateTutor(state, makeResult(true), 'addition');
      state = updateTutor(state, makeResult(true), 'addition');
      state = updateTutor(state, makeResult(true), 'addition');
      state = updateTutor(state, makeResult(false), 'addition');
      state = updateTutor(state, makeResult(true), 'addition');

      expect(state.currentDifficulty).toBe(3);
      expect(state.consecutiveCorrect).toBe(0); // reset on difficulty increase
    });

    it('caps maximum difficulty at 5', () => {
      let state = createTutorState(5);
      for (let i = 0; i < 5; i++) {
        state = updateTutor(state, makeResult(true), 'addition');
      }
      expect(state.currentDifficulty).toBe(5);
    });

    it('decreases difficulty when correct answers < 2 in window of 5', () => {
      let state = createTutorState(3);
      // 1 correct, 4 wrong
      state = updateTutor(state, makeResult(false), 'addition');
      state = updateTutor(state, makeResult(false), 'addition');
      state = updateTutor(state, makeResult(true), 'addition');
      state = updateTutor(state, makeResult(false), 'addition');
      state = updateTutor(state, makeResult(false), 'addition');

      expect(state.currentDifficulty).toBe(2);
      expect(state.consecutiveWrong).toBe(0); // reset on difficulty decrease
    });

    it('caps minimum difficulty at 1', () => {
      let state = createTutorState(1);
      for (let i = 0; i < 5; i++) {
        state = updateTutor(state, makeResult(false), 'addition');
      }
      expect(state.currentDifficulty).toBe(1);
    });

    it('caps recentResults at 10 items max', () => {
      let state = createTutorState(1);
      for (let i = 0; i < 15; i++) {
        state = updateTutor(state, makeResult(true), 'addition');
      }
      expect(state.recentResults).toHaveLength(10);
    });

    it('increments hintsGiven count when hints are used', () => {
      let state = createTutorState(1);
      expect(state.hintsGiven).toBe(0);

      state = updateTutor(state, makeResult(true, 0), 'addition');
      expect(state.hintsGiven).toBe(0);

      state = updateTutor(state, makeResult(true, 1), 'addition');
      expect(state.hintsGiven).toBe(1);

      state = updateTutor(state, makeResult(false, 2), 'addition');
      expect(state.hintsGiven).toBe(2);
    });
  });

  describe('weak areas tracking', () => {
    it('adds operation to weakAreas upon incorrect answer', () => {
      let state = createTutorState(1);
      state = updateTutor(state, { questionId: '1', correct: false, timeMs: 1000, hintsUsed: 0 }, 'multiplication');
      expect(state.weakAreas).toContain('multiplication');
    });

    it('clears operation from weakAreas after 3 correct answers on that operation', () => {
      let state = createTutorState(1);
      state = updateTutor(state, { questionId: '1', correct: false, timeMs: 1000, hintsUsed: 0 }, 'division');
      expect(state.weakAreas).toContain('division');

      // 3 correct answers on division
      state = updateTutor(state, { questionId: '2', correct: true, timeMs: 1000, hintsUsed: 0 }, 'division');
      state = updateTutor(state, { questionId: '3', correct: true, timeMs: 1000, hintsUsed: 0 }, 'division');
      state = updateTutor(state, { questionId: '4', correct: true, timeMs: 1000, hintsUsed: 0 }, 'division');

      expect(state.weakAreas).not.toContain('division');
    });
  });

  describe('getTutorMessage', () => {
    it('returns encouraging streak message when consecutiveCorrect >= 3', () => {
      const state = { ...createTutorState(), consecutiveCorrect: 4 };
      const msg = getTutorMessage(state, true, 'Sam');
      expect(msg).toContain('🔥 4 in a row! You\'re on fire, Sam!');
    });

    it('returns positive message for single correct answer', () => {
      const state = { ...createTutorState(), consecutiveCorrect: 1 };
      const msg = getTutorMessage(state, true, 'Leo');
      expect(msg.length).toBeGreaterThan(0);
    });

    it('returns calming message when consecutiveWrong >= 3', () => {
      const state = { ...createTutorState(), consecutiveWrong: 3 };
      const msg = getTutorMessage(state, false, 'Sam');
      expect(msg).toBe("Let's slow down and try an easier one! 😊");
    });

    it('returns supportive message for incorrect answer', () => {
      const state = { ...createTutorState(), consecutiveWrong: 1 };
      const msg = getTutorMessage(state, false, 'Mia');
      expect(msg.length).toBeGreaterThan(0);
    });
  });

  describe('shouldShowHint & getEncouragement', () => {
    it('shows hint when consecutiveWrong >= 2', () => {
      expect(shouldShowHint({ ...createTutorState(), consecutiveWrong: 0 })).toBe(false);
      expect(shouldShowHint({ ...createTutorState(), consecutiveWrong: 1 })).toBe(false);
      expect(shouldShowHint({ ...createTutorState(), consecutiveWrong: 2 })).toBe(true);
      expect(shouldShowHint({ ...createTutorState(), consecutiveWrong: 5 })).toBe(true);
    });

    it('provides correct encouragement based on performance streaks', () => {
      expect(getEncouragement({ ...createTutorState(), consecutiveWrong: 3 })).toBe("Take your time! 🐢");
      expect(getEncouragement({ ...createTutorState(), consecutiveCorrect: 5 })).toBe("You're a math superstar! ⭐");
      expect(getEncouragement({ ...createTutorState(), consecutiveCorrect: 2, consecutiveWrong: 1 })).toBe("You're doing great! 💪");
    });
  });
});
