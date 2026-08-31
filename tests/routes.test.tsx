import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HomePage from '../app/page';
import GamePage from '../app/game/page';
import DashboardPage from '../app/dashboard/page';
import PracticePage from '../app/game/practice/page';
import ChallengePage from '../app/game/challenge/page';
import StoryPage from '../app/game/story/page';
import { useAppStore } from '../lib/store';

// Mock Next.js navigation
const mockPush = vi.fn();
const mockReplace = vi.fn();
let mockSearchParams = new URLSearchParams('op=addition');

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  useSearchParams: () => mockSearchParams,
}));

// Mock speech synthesis
vi.mock('@/lib/data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/data')>();
  return {
    ...actual,
    speak: vi.fn(),
  };
});

// Mock Web3Context hook
vi.mock('@/lib/Web3Context', () => ({
  useWeb3: () => ({
    connect: vi.fn(),
    connected: false,
    address: null,
    player: null,
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
  }),
  Web3Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('App Routes and Page Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams('op=addition');
    useAppStore.setState({
      profiles: [],
      activeProfileId: null,
      progress: {},
      tutorStates: {},
      session: null,
    });
  });

  describe('HomePage (/)', () => {
    it('renders landing screen with title, mascot and profile selector when no profile is active', () => {
      render(<HomePage />);

      expect(screen.getByText('MathBloc')).toBeInTheDocument();
      expect(screen.getByText('Fun Math for Kids! 🎉')).toBeInTheDocument();
      expect(screen.getByText('Pick a player to start! 👇')).toBeInTheDocument();
      expect(screen.queryByText('🎮 Play Now!')).not.toBeInTheDocument();
    });

    it('renders Play and Dashboard buttons when a profile is selected', () => {
      const profile = {
        id: 'profile-1',
        name: 'Lily',
        ageGroup: '4-5' as const,
        avatar: '🐱',
        coins: 10,
        stars: 2,
        badges: [],
        createdAt: Date.now(),
      };

      useAppStore.setState({
        profiles: [profile],
        activeProfileId: 'profile-1',
      });

      render(<HomePage />);

      expect(screen.getByText(/Hi Lily! Ready to play\?/)).toBeInTheDocument();
      const playBtn = screen.getByText('🎮 Play Now!');
      const dashBtn = screen.getByText('📊 Parent Dashboard');

      expect(playBtn).toBeInTheDocument();
      expect(dashBtn).toBeInTheDocument();

      fireEvent.click(playBtn);
      expect(mockPush).toHaveBeenCalledWith('/game');

      fireEvent.click(dashBtn);
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  describe('GamePage (/game)', () => {
    it('redirects to home if no active profile exists', () => {
      render(<GamePage />);
      expect(mockReplace).toHaveBeenCalledWith('/');
    });

    it('renders game mode options when profile is active and navigates correctly', () => {
      const profile = {
        id: 'profile-1',
        name: 'Tommy',
        ageGroup: '6-7' as const,
        avatar: '🚀',
        coins: 20,
        stars: 5,
        badges: [],
        createdAt: Date.now(),
      };

      useAppStore.setState({
        profiles: [profile],
        activeProfileId: 'profile-1',
      });

      render(<GamePage />);

      expect(screen.getByText('Choose Mode')).toBeInTheDocument();
      expect(screen.getByText('Practice')).toBeInTheDocument();
      expect(screen.getByText('Challenge')).toBeInTheDocument();
      expect(screen.getByText('Story')).toBeInTheDocument();

      // Select Practice Mode
      fireEvent.click(screen.getByText('Practice'));
      expect(screen.getByText('Choose Topic')).toBeInTheDocument();

      // Select Addition Topic
      fireEvent.click(screen.getByText('Addition'));

      // Click Let's Go
      const startBtn = screen.getByText("🚀 Let's Go!");
      fireEvent.click(startBtn);

      expect(mockPush).toHaveBeenCalledWith('/game/practice?op=addition');
    });
  });

  describe('DashboardPage (/dashboard)', () => {
    it('renders Parent Dashboard with Web3 Panel', () => {
      render(<DashboardPage />);
      expect(screen.getByText('📊 Parent Dashboard')).toBeInTheDocument();
    });
  });

  describe('Game Mode Pages (/game/practice, /game/challenge, /game/story)', () => {
    beforeEach(() => {
      const profile = {
        id: 'profile-1',
        name: 'Alice',
        ageGroup: '4-5' as const,
        avatar: '🌸',
        coins: 10,
        stars: 2,
        badges: [],
        createdAt: Date.now(),
      };

      useAppStore.setState({
        profiles: [profile],
        activeProfileId: 'profile-1',
      });
    });

    it('renders PracticePage with active profile and question card', () => {
      render(<PracticePage />);
      expect(screen.getByText(/Let's practice addition!/)).toBeInTheDocument();
    });

    it('renders ChallengePage with timer and countdown', () => {
      render(<ChallengePage />);
      expect(screen.getByText(/⏱/)).toBeInTheDocument();
    });

    it('renders StoryPage with chapter selection or story prompt', () => {
      render(<StoryPage />);
      expect(screen.getByText(/Adventure/i)).toBeInTheDocument();
    });
  });
});
