import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore, getActiveProfile, getProfileProgress, getAccuracy } from '../lib/store';
import { ProgressRecord } from '../lib/types';

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAppStore.setState({
      profiles: [],
      activeProfileId: null,
      progress: {},
      tutorStates: {},
      session: null,
    });
  });

  describe('Profile management', () => {
    it('adds a new profile with default stats and sets creation timestamp', () => {
      const { addProfile } = useAppStore.getState();
      addProfile({ name: 'Emma', ageGroup: '4-5', avatar: '🐱' });

      const state = useAppStore.getState();
      expect(state.profiles).toHaveLength(1);
      const profile = state.profiles[0];
      expect(profile.name).toBe('Emma');
      expect(profile.ageGroup).toBe('4-5');
      expect(profile.avatar).toBe('🐱');
      expect(profile.coins).toBe(0);
      expect(profile.stars).toBe(0);
      expect(profile.badges).toEqual([]);
      expect(profile.id).toMatch(/^profile-\d+/);
      expect(profile.createdAt).toBeTypeOf('number');
    });

    it('sets active profile and retrieves with getActiveProfile selector', () => {
      const profile = {
        id: 'profile-1',
        name: 'Alex',
        ageGroup: '6-7' as const,
        avatar: '🚀',
        coins: 0,
        stars: 0,
        badges: [],
        createdAt: Date.now(),
      };
      useAppStore.setState({ profiles: [profile] });

      useAppStore.getState().setActiveProfile('profile-1');
      expect(useAppStore.getState().activeProfileId).toBe('profile-1');

      const active = getActiveProfile(useAppStore.getState());
      expect(active).toBeDefined();
      expect(active?.id).toBe('profile-1');
      expect(active?.name).toBe('Alex');
    });

    it('deletes profile and resets activeProfileId if active profile was deleted', () => {
      const p1 = { id: 'p-1', name: 'Player1', ageGroup: '2-3' as const, avatar: '🍎', coins: 0, stars: 0, badges: [], createdAt: 1 };
      const p2 = { id: 'p-2', name: 'Player2', ageGroup: '8-9' as const, avatar: '🌟', coins: 0, stars: 0, badges: [], createdAt: 2 };
      useAppStore.setState({ profiles: [p1, p2], activeProfileId: 'p-1' });

      const { deleteProfile } = useAppStore.getState();
      deleteProfile('p-1');

      expect(useAppStore.getState().profiles).toHaveLength(1);
      expect(useAppStore.getState().profiles[0].id).toBe('p-2');
      expect(useAppStore.getState().activeProfileId).toBeNull();
    });

    it('deletes profile without resetting activeProfileId when non-active is deleted', () => {
      const p1 = { id: 'p-1', name: 'P1', ageGroup: '2-3' as const, avatar: '🍎', coins: 0, stars: 0, badges: [], createdAt: 1 };
      const p2 = { id: 'p-2', name: 'P2', ageGroup: '8-9' as const, avatar: '🌟', coins: 0, stars: 0, badges: [], createdAt: 2 };
      useAppStore.setState({ profiles: [p1, p2], activeProfileId: 'p-2' });

      const { deleteProfile } = useAppStore.getState();
      deleteProfile('p-1');

      expect(useAppStore.getState().activeProfileId).toBe('p-2');
      expect(useAppStore.getState().profiles).toHaveLength(1);
    });
  });

  describe('Progress and result recording', () => {
    it('records first result for an operation correctly', () => {
      const { recordResult } = useAppStore.getState();
      const profileId = 'test-profile-1';

      recordResult(profileId, 'addition', true, 1200, 0);

      const state = useAppStore.getState();
      const records = getProfileProgress(state, profileId);
      expect(records).toHaveLength(1);

      const record = records[0];
      expect(record.operation).toBe('addition');
      expect(record.totalAttempts).toBe(1);
      expect(record.correctAttempts).toBe(1);
      expect(record.avgTimeMs).toBe(1200);
      expect(record.streak).toBe(1);
      expect(record.lastPlayed).toBeTypeOf('number');

      // Check tutor state was initialized and updated
      const tutor = state.getTutorState(profileId);
      expect(tutor).toBeDefined();
      expect(tutor.recentResults).toHaveLength(1);
    });

    it('accumulates multiple results and calculates weighted average time and streak', () => {
      const { recordResult } = useAppStore.getState();
      const profileId = 'test-profile-2';

      // 1st: correct, 1000ms
      recordResult(profileId, 'addition', true, 1000, 0);
      // 2nd: correct, 2000ms
      recordResult(profileId, 'addition', true, 2000, 0);
      // 3rd: wrong, 3000ms
      recordResult(profileId, 'addition', false, 3000, 0);

      const records = getProfileProgress(useAppStore.getState(), profileId);
      expect(records).toHaveLength(1);
      const record = records[0];

      expect(record.totalAttempts).toBe(3);
      expect(record.correctAttempts).toBe(2);
      // avg: (1000 + 2000 + 3000) / 3 = 2000
      expect(record.avgTimeMs).toBe(2000);
      expect(record.streak).toBe(0); // reset on wrong answer
    });

    it('maintains separate progress records per operation', () => {
      const { recordResult } = useAppStore.getState();
      const profileId = 'test-profile-3';

      recordResult(profileId, 'addition', true, 1000, 0);
      recordResult(profileId, 'subtraction', false, 1500, 0);

      const records = getProfileProgress(useAppStore.getState(), profileId);
      expect(records).toHaveLength(2);
      expect(records.find(r => r.operation === 'addition')?.correctAttempts).toBe(1);
      expect(records.find(r => r.operation === 'subtraction')?.correctAttempts).toBe(0);
    });
  });

  describe('Rewards and Badges', () => {
    it('adds coins and stars to active profile', () => {
      const profile = { id: 'p-maya', name: 'Maya', ageGroup: '4-5' as const, avatar: '🐱', coins: 0, stars: 0, badges: [], createdAt: 1 };
      useAppStore.setState({ profiles: [profile], activeProfileId: 'p-maya' });

      const { addReward } = useAppStore.getState();
      addReward('p-maya', 50, 5);
      let updated = useAppStore.getState().profiles[0];
      expect(updated.coins).toBe(50);
      expect(updated.stars).toBe(5);

      addReward('p-maya', 25, 2);
      updated = useAppStore.getState().profiles[0];
      expect(updated.coins).toBe(75);
      expect(updated.stars).toBe(7);
    });

    it('awards badge and avoids duplicate badges with same id', () => {
      const profile = { id: 'p-maya', name: 'Maya', ageGroup: '4-5' as const, avatar: '🐱', coins: 0, stars: 0, badges: [], createdAt: 1 };
      useAppStore.setState({ profiles: [profile], activeProfileId: 'p-maya' });

      const { awardBadge } = useAppStore.getState();
      const badge = {
        id: 'speed_demon',
        name: 'Speed Demon',
        emoji: '⚡',
      };

      awardBadge('p-maya', badge);
      expect(useAppStore.getState().profiles[0].badges).toHaveLength(1);
      expect(useAppStore.getState().profiles[0].badges[0].id).toBe('speed_demon');
      expect(useAppStore.getState().profiles[0].badges[0].earnedAt).toBeTypeOf('number');

      // Attempt duplicate award
      awardBadge('p-maya', badge);
      expect(useAppStore.getState().profiles[0].badges).toHaveLength(1);
    });
  });

  describe('Game Session State', () => {
    it('starts and ends game sessions properly', () => {
      const { startSession, endSession } = useAppStore.getState();
      expect(useAppStore.getState().session).toBeNull();

      startSession('practice', 'multiplication', 2);
      const session = useAppStore.getState().session;
      expect(session).not.toBeNull();
      expect(session?.mode).toBe('practice');
      expect(session?.operation).toBe('multiplication');
      expect(session?.chapterId).toBe(2);
      expect(session?.score).toBe(0);
      expect(session?.total).toBe(0);
      expect(session?.timeLeft).toBe(60);
      expect(session?.active).toBe(true);

      endSession();
      expect(useAppStore.getState().session).toBeNull();
    });
  });

  describe('Selectors and Helper Functions', () => {
    it('computes accuracy percentage accurately across records', () => {
      expect(getAccuracy([])).toBe(0);

      const records: ProgressRecord[] = [
        {
          profileId: 'p1',
          operation: 'addition',
          totalAttempts: 10,
          correctAttempts: 8,
          avgTimeMs: 1000,
          difficulty: 1,
          lastPlayed: Date.now(),
          streak: 2,
        },
        {
          profileId: 'p1',
          operation: 'subtraction',
          totalAttempts: 10,
          correctAttempts: 6,
          avgTimeMs: 1500,
          difficulty: 1,
          lastPlayed: Date.now(),
          streak: 1,
        },
      ];

      // total: 20 attempts, 14 correct -> 70%
      expect(getAccuracy(records)).toBe(70);
    });
  });
});
