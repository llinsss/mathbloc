/**
 * QuestionCard timing tests
 *
 * Verifies that:
 *  1. Every new question starts timing from ~0 ms (no cumulative leakage).
 *  2. Waiting on question N does not inflate the time reported for question N+1.
 *  3. The speed-badge threshold (timeMs < 3000) is evaluated against per-question
 *     time, not session-total time.
 *  4. Backgrounding / rapid question changes have isolated, predictable timing.
 *
 * Strategy:
 *  - Stub performance.now() with vi.stubGlobal so we control the clock precisely.
 *  - Use vi.useFakeTimers() to control setTimeout (feedback animation delay).
 *  - Render QuestionCard with a controlled `question` prop and an `onAnswer` spy.
 *  - Advance performance.now() manually, click an answer, flush the 600 ms timer,
 *    then assert the reported timeMs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import QuestionCard from '@/components/game/QuestionCard';
import { Question } from '@/lib/types';

// ── Mocks ────────────────────────────────────────────────────────────────────

// speak() uses window.speechSynthesis which is not present in jsdom.
vi.mock('@/lib/data', () => ({ speak: vi.fn() }));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    operation: 'addition',
    prompt: '2 + 3 = ?',
    answer: 5,
    choices: [3, 4, 5, 6],
    difficulty: 1,
    hint: 'Count on your fingers',
    ...overrides,
  };
}

/**
 * Returns a mutable performance.now stub.
 * Call `advance(ms)` to move the clock forward.
 * Call `reset()` to bring it back to 0.
 */
function createPerfNowStub() {
  let current = 0;
  const stub = vi.fn(() => current);
  return {
    stub,
    advance: (ms: number) => { current += ms; },
    reset: () => { current = 0; },
    set: (ms: number) => { current = ms; },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('QuestionCard – timing', () => {
  let perfNow: ReturnType<typeof createPerfNowStub>;

  beforeEach(() => {
    vi.useFakeTimers();
    perfNow = createPerfNowStub();
    vi.stubGlobal('performance', { now: perfNow.stub });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // ── Criterion 1: fresh question starts near 0 ─────────────────────────────

  it('reports ~0 ms when the user answers immediately after mount', async () => {
    const question = makeQuestion();
    const onAnswer = vi.fn();

    // Clock is at 0 when the component mounts (useEffect fires, resets ref to 0).
    render(<QuestionCard question={question} onAnswer={onAnswer} />);

    // Answer instantly — elapsed should be ~0.
    await act(async () => {
      screen.getByRole('button', { name: '5' }).click();
      vi.advanceTimersByTime(600);
    });

    expect(onAnswer).toHaveBeenCalledOnce();
    const [, timeMs] = onAnswer.mock.calls[0] as [number, number, number];
    expect(timeMs).toBe(0);
  });

  it('reports the elapsed time when the user takes 2000 ms to answer', async () => {
    const question = makeQuestion();
    const onAnswer = vi.fn();

    render(<QuestionCard question={question} onAnswer={onAnswer} />);

    // Simulate 2 seconds of thinking.
    await act(async () => { perfNow.advance(2000); });

    await act(async () => {
      screen.getByRole('button', { name: '5' }).click();
      vi.advanceTimersByTime(600);
    });

    expect(onAnswer).toHaveBeenCalledOnce();
    const [, timeMs] = onAnswer.mock.calls[0] as [number, number, number];
    expect(timeMs).toBe(2000);
  });

  // ── Criterion 2: question change resets the clock ─────────────────────────

  it('resets timing on question change — Q2 time is independent of Q1 wait time', async () => {
    const q1 = makeQuestion({ id: 'q1', prompt: '2 + 3 = ?', answer: 5, choices: [3, 4, 5, 6] });
    const q2 = makeQuestion({ id: 'q2', prompt: '1 + 1 = ?', answer: 2, choices: [1, 2, 3, 4] });

    const onAnswer = vi.fn();
    const { rerender } = render(<QuestionCard question={q1} onAnswer={onAnswer} />);

    // User spends 5 000 ms on Q1, then answers.
    await act(async () => { perfNow.advance(5000); });
    await act(async () => {
      screen.getByRole('button', { name: '5' }).click();
      vi.advanceTimersByTime(600);
    });

    const [, q1Time] = onAnswer.mock.calls[0] as [number, number, number];
    expect(q1Time).toBe(5000);

    // Swap in Q2 — the useEffect fires and resets startTimeRef to current perf time.
    // We do NOT advance the clock before the rerender so the reset records ~5000.
    // Then the user answers Q2 after 1500 ms.
    await act(async () => {
      rerender(<QuestionCard question={q2} onAnswer={onAnswer} />);
    });
    await act(async () => { perfNow.advance(1500); });
    await act(async () => {
      screen.getByRole('button', { name: '2' }).click();
      vi.advanceTimersByTime(600);
    });

    expect(onAnswer).toHaveBeenCalledTimes(2);
    const [, q2Time] = onAnswer.mock.calls[1] as [number, number, number];
    // Q2 time should be 1500, not 5000 + 1500 = 6500.
    expect(q2Time).toBe(1500);
  });

  it('does not add Q1 wait time to Q2 time across 3 consecutive questions', async () => {
    const questions = [
      makeQuestion({ id: 'q1', prompt: '1 + 1 = ?', answer: 2, choices: [1, 2, 3, 4] }),
      makeQuestion({ id: 'q2', prompt: '2 + 2 = ?', answer: 4, choices: [2, 3, 4, 5] }),
      makeQuestion({ id: 'q3', prompt: '3 + 3 = ?', answer: 6, choices: [4, 5, 6, 7] }),
    ];
    const waitTimes = [4000, 1000, 2500];

    const onAnswer = vi.fn();
    const { rerender } = render(
      <QuestionCard question={questions[0]} onAnswer={onAnswer} />
    );

    for (let i = 0; i < questions.length; i++) {
      if (i > 0) {
        await act(async () => {
          rerender(<QuestionCard question={questions[i]} onAnswer={onAnswer} />);
        });
      }
      await act(async () => { perfNow.advance(waitTimes[i]); });
      await act(async () => {
        const answer = questions[i].answer;
        screen.getByRole('button', { name: String(answer) }).click();
        vi.advanceTimersByTime(600);
      });
    }

    expect(onAnswer).toHaveBeenCalledTimes(3);
    const reported = onAnswer.mock.calls.map(c => (c as [number, number, number])[1]);
    expect(reported[0]).toBe(4000);
    expect(reported[1]).toBe(1000); // must NOT be 5000
    expect(reported[2]).toBe(2500); // must NOT be 7500
  });

  // ── Criterion 3: speed-badge threshold uses per-question time ─────────────

  it('reports timeMs < 3000 when user answers quickly on Q2 (even after slow Q1)', async () => {
    const q1 = makeQuestion({ id: 'q1', answer: 5, choices: [3, 4, 5, 6] });
    const q2 = makeQuestion({ id: 'q2', prompt: '1 + 1 = ?', answer: 2, choices: [1, 2, 3, 4] });
    const onAnswer = vi.fn();
    const { rerender } = render(<QuestionCard question={q1} onAnswer={onAnswer} />);

    // Q1: 10 seconds (would disqualify speed badge if cumulative).
    await act(async () => { perfNow.advance(10000); });
    await act(async () => {
      screen.getByRole('button', { name: '5' }).click();
      vi.advanceTimersByTime(600);
    });

    // Q2: 1.5 seconds — should qualify for speed badge.
    await act(async () => {
      rerender(<QuestionCard question={q2} onAnswer={onAnswer} />);
    });
    await act(async () => { perfNow.advance(1500); });
    await act(async () => {
      screen.getByRole('button', { name: '2' }).click();
      vi.advanceTimersByTime(600);
    });

    const [, q2Time] = onAnswer.mock.calls[1] as [number, number, number];
    expect(q2Time).toBeLessThan(3000);
    expect(q2Time).toBe(1500);
  });

  // ── Criterion 4: feedback animation delay does not inflate timeMs ─────────

  it('captures timeMs at click time, not after the 600 ms animation delay', async () => {
    const question = makeQuestion();
    const onAnswer = vi.fn();

    render(<QuestionCard question={question} onAnswer={onAnswer} />);

    await act(async () => { perfNow.advance(2000); });

    // Click but do NOT advance past 600 ms yet.
    await act(async () => {
      screen.getByRole('button', { name: '5' }).click();
      // Advance only 300 ms — onAnswer has not been called yet.
      vi.advanceTimersByTime(300);
    });
    expect(onAnswer).not.toHaveBeenCalled();

    // Now the clock advances another 1000 ms BEFORE the timer fires.
    await act(async () => {
      perfNow.advance(1000);
      vi.advanceTimersByTime(300); // total timer now ≥ 600 ms
    });

    expect(onAnswer).toHaveBeenCalledOnce();
    const [, timeMs] = onAnswer.mock.calls[0] as [number, number, number];
    // timeMs must reflect the 2000 ms of thinking, NOT 2000 + 1000 = 3000.
    expect(timeMs).toBe(2000);
  });

  // ── Criterion 5: wrong answer still reports correct timeMs ────────────────

  it('reports timeMs correctly when user answers incorrectly', async () => {
    const question = makeQuestion({ answer: 5, choices: [3, 4, 5, 6] });
    const onAnswer = vi.fn();

    render(<QuestionCard question={question} onAnswer={onAnswer} />);

    await act(async () => { perfNow.advance(3500); });
    await act(async () => {
      screen.getByRole('button', { name: '3' }).click(); // wrong answer
      vi.advanceTimersByTime(600);
    });

    expect(onAnswer).toHaveBeenCalledOnce();
    const [answer, timeMs] = onAnswer.mock.calls[0] as [number, number, number];
    expect(answer).toBe(3);
    expect(timeMs).toBe(3500);
  });

  // ── Criterion 6: hint usage is tracked independently of timing ────────────

  it('counts hints used without affecting timeMs', async () => {
    const question = makeQuestion();
    const onAnswer = vi.fn();

    render(<QuestionCard question={question} onAnswer={onAnswer} showHint />);

    // Open hint after 1000 ms.
    await act(async () => { perfNow.advance(1000); });
    await act(async () => {
      screen.getByRole('button', { name: /Need a hint/ }).click();
    });

    // Answer after another 500 ms.
    await act(async () => { perfNow.advance(500); });
    await act(async () => {
      screen.getByRole('button', { name: '5' }).click();
      vi.advanceTimersByTime(600);
    });

    expect(onAnswer).toHaveBeenCalledOnce();
    const [, timeMs, hintsUsed] = onAnswer.mock.calls[0] as [number, number, number];
    expect(timeMs).toBe(1500);
    expect(hintsUsed).toBe(1);
  });

  // ── Criterion 7: rapid question swaps (question.id changes without answer) ─

  it('uses the latest reset time when the question changes before the user answers', async () => {
    const q1 = makeQuestion({ id: 'q1', answer: 5, choices: [3, 4, 5, 6] });
    const q2 = makeQuestion({ id: 'q2', prompt: '1 + 1 = ?', answer: 2, choices: [1, 2, 3, 4] });
    const onAnswer = vi.fn();

    const { rerender } = render(<QuestionCard question={q1} onAnswer={onAnswer} />);

    // 3 seconds pass, then the question is replaced before the user answers.
    await act(async () => { perfNow.advance(3000); });
    await act(async () => {
      rerender(<QuestionCard question={q2} onAnswer={onAnswer} />);
    });

    // User answers Q2 after 800 ms from the swap.
    await act(async () => { perfNow.advance(800); });
    await act(async () => {
      screen.getByRole('button', { name: '2' }).click();
      vi.advanceTimersByTime(600);
    });

    expect(onAnswer).toHaveBeenCalledOnce();
    const [, timeMs] = onAnswer.mock.calls[0] as [number, number, number];
    // Only 800 ms since Q2 appeared — the 3000 ms on Q1 must not leak.
    expect(timeMs).toBe(800);
  });
});
