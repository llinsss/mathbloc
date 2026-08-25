import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionSubmit, SessionPayload } from '../lib/useSessionSubmit';
import { Web3ContextValue } from '../lib/Web3Context';

let mockWeb3State: Web3ContextValue = {
  connect: vi.fn(),
  connected: true,
  address: '0x1234567890123456789012345678901234567890',
  player: {
    username: 'Alice',
    totalScore: 100n,
    totalCorrect: 10n,
    totalAttempts: 10n,
    streak: 1n,
    coinsEarned: 30n,
    lastActivityDay: 1n,
    registeredAt: BigInt(Date.now()),
    exists: true,
  },
  loading: false,
  error: null,
  isDeployed: true,
  contractAddress: '0x47e8c3F53eE2ebE822d56a3501867Fea4B4D5815',
  correctNetwork: true,
  currentChainId: 44787,
  deploymentChainId: 44787,
  switchNetwork: vi.fn(),
  recordActivity: vi.fn(),
  register: vi.fn(),
  claimReward: vi.fn(),
  getLeaderboard: vi.fn().mockResolvedValue([]),
  refreshPlayer: vi.fn(),
};

vi.mock('@/lib/Web3Context', () => ({
  useWeb3: () => mockWeb3State,
}));

describe('useSessionSubmit', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockWeb3State = {
      connect: vi.fn(),
      connected: true,
      address: '0x1234567890123456789012345678901234567890',
      player: {
        username: 'Alice',
        totalScore: 100n,
        totalCorrect: 10n,
        totalAttempts: 10n,
        streak: 1n,
        coinsEarned: 30n,
        lastActivityDay: 1n,
        registeredAt: BigInt(Date.now()),
        exists: true,
      },
      loading: false,
      error: null,
      isDeployed: true,
      contractAddress: '0x47e8c3F53eE2ebE822d56a3501867Fea4B4D5815',
      correctNetwork: true,
      currentChainId: 44787,
      deploymentChainId: 44787,
      switchNetwork: vi.fn(),
      recordActivity: vi.fn().mockResolvedValue(undefined),
      register: vi.fn(),
      claimReward: vi.fn(),
      getLeaderboard: vi.fn().mockResolvedValue([]),
      refreshPlayer: vi.fn().mockResolvedValue(undefined),
    };
  });

  const payload: SessionPayload = {
    mode: 'practice',
    topic: 'addition',
    score: 10,
    correct: 10,
    attempts: 10,
    profileId: 'p-1',
  };

  it('submits session and transitions to confirmed upon success', async () => {
    const { result } = renderHook(() => useSessionSubmit());
    expect(result.current.submitStatus).toBe('idle');

    await act(async () => {
      result.current.submitSession(payload);
    });

    expect(mockWeb3State.recordActivity).toHaveBeenCalledWith(10, 10, 10, 'addition');
    expect(mockWeb3State.refreshPlayer).toHaveBeenCalled();
    expect(result.current.submitStatus).toBe('confirmed');
  });

  it('sets not-connected status when wallet is not connected', async () => {
    mockWeb3State.connected = false;
    const { result } = renderHook(() => useSessionSubmit());

    await act(async () => {
      result.current.submitSession(payload);
    });

    expect(result.current.submitStatus).toBe('not-connected');
    expect(mockWeb3State.recordActivity).not.toHaveBeenCalled();
  });

  it('sets not-registered status when player is not registered on chain', async () => {
    mockWeb3State.player = null;
    const { result } = renderHook(() => useSessionSubmit());

    await act(async () => {
      result.current.submitSession(payload);
    });

    expect(result.current.submitStatus).toBe('not-registered');
    expect(mockWeb3State.recordActivity).not.toHaveBeenCalled();
  });

  it('sets wrong-network status when connected to incorrect chain', async () => {
    mockWeb3State.correctNetwork = false;
    const { result } = renderHook(() => useSessionSubmit());

    await act(async () => {
      result.current.submitSession(payload);
    });

    expect(result.current.submitStatus).toBe('wrong-network');
    expect(result.current.lastError).toContain('Wrong network');
    expect(mockWeb3State.recordActivity).not.toHaveBeenCalled();
  });

  it('handles transaction rejection / error and allows retry', async () => {
    mockWeb3State.recordActivity = vi.fn().mockRejectedValueOnce(new Error('User rejected transaction'));
    const { result } = renderHook(() => useSessionSubmit());

    await act(async () => {
      result.current.submitSession(payload);
    });

    expect(result.current.submitStatus).toBe('rejected');
    expect(result.current.lastError).toBe('User rejected transaction');

    // Retry after failure
    mockWeb3State.recordActivity = vi.fn().mockResolvedValueOnce(undefined);
    await act(async () => {
      result.current.retry();
    });

    expect(result.current.submitStatus).toBe('confirmed');
  });

  it('prevents duplicate submissions using localStorage dedup', async () => {
    const { result } = renderHook(() => useSessionSubmit());

    await act(async () => {
      result.current.submitSession(payload);
    });

    expect(mockWeb3State.recordActivity).toHaveBeenCalledTimes(1);
    expect(result.current.submitStatus).toBe('confirmed');

    // Second submit of exact same payload
    await act(async () => {
      result.current.submitSession(payload);
    });

    expect(mockWeb3State.recordActivity).toHaveBeenCalledTimes(1); // not called again
    expect(result.current.submitStatus).toBe('confirmed');
  });
});
