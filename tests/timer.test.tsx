import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import Timer from '../components/ui/Timer';

describe('Timer Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const advanceSeconds = (seconds: number) => {
    for (let i = 0; i < seconds; i++) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }
  };

  it('renders initial countdown seconds and progress bar', () => {
    render(<Timer seconds={60} running={true} onExpire={vi.fn()} />);
    expect(screen.getByText(/60s/)).toBeInTheDocument();
  });

  it('counts down second by second when running is true', () => {
    const onExpire = vi.fn();
    render(<Timer seconds={10} running={true} onExpire={onExpire} />);

    expect(screen.getByText(/10s/)).toBeInTheDocument();

    advanceSeconds(1);
    expect(screen.getByText(/9s/)).toBeInTheDocument();

    advanceSeconds(3);
    expect(screen.getByText(/6s/)).toBeInTheDocument();
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('pauses countdown when running is false', () => {
    const onExpire = vi.fn();
    const { rerender } = render(<Timer seconds={30} running={true} onExpire={onExpire} />);

    advanceSeconds(5);
    expect(screen.getByText(/25s/)).toBeInTheDocument();

    // Pause timer
    rerender(<Timer seconds={30} running={false} onExpire={onExpire} />);

    advanceSeconds(10);
    // Remains 25s while paused
    expect(screen.getByText(/25s/)).toBeInTheDocument();
    expect(onExpire).not.toHaveBeenCalled();

    // Resume timer
    rerender(<Timer seconds={30} running={true} onExpire={onExpire} />);
    advanceSeconds(2);
    expect(screen.getByText(/23s/)).toBeInTheDocument();
  });

  it('triggers onExpire callback when timer reaches 0', () => {
    const onExpire = vi.fn();
    render(<Timer seconds={3} running={true} onExpire={onExpire} />);

    advanceSeconds(3);
    expect(screen.getByText(/0s/)).toBeInTheDocument();
    expect(onExpire).toHaveBeenCalledTimes(1);

    // Ensure it does not keep triggering onExpire after 0
    advanceSeconds(2);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('resets remaining time when seconds prop updates', () => {
    const onExpire = vi.fn();
    const { rerender } = render(<Timer seconds={20} running={true} onExpire={onExpire} />);

    advanceSeconds(5);
    expect(screen.getByText(/15s/)).toBeInTheDocument();

    // Prop reset
    rerender(<Timer seconds={60} running={true} onExpire={onExpire} />);
    expect(screen.getByText(/60s/)).toBeInTheDocument();

    advanceSeconds(1);
    expect(screen.getByText(/59s/)).toBeInTheDocument();
  });

  it('updates color and pulse indicator as time runs low', () => {
    const { container } = render(<Timer seconds={40} running={true} onExpire={vi.fn()} />);

    // >50% -> green
    expect(container.querySelector('.text-green-600')).toBeInTheDocument();

    // Advance to 15s (37.5% -> yellow)
    advanceSeconds(25);
    expect(container.querySelector('.text-yellow-500')).toBeInTheDocument();

    // Advance to 8s (20% -> red and <=10s animate-pulse)
    advanceSeconds(7);
    expect(container.querySelector('.text-red-500')).toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('cleans up timeout on unmount without errors or memory leaks', () => {
    const onExpire = vi.fn();
    const { unmount } = render(<Timer seconds={10} running={true} onExpire={onExpire} />);

    advanceSeconds(2);

    unmount();

    advanceSeconds(15);
    expect(onExpire).not.toHaveBeenCalled();
  });
});
