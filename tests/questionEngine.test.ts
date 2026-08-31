import { describe, it, expect } from 'vitest';
import { generateQuestion, getOperationsForAgeGroup } from '../lib/questionEngine';
import { Operation, Difficulty } from '../lib/types';

describe('questionEngine', () => {
  const operations: Operation[] = [
    'recognition',
    'counting',
    'addition',
    'subtraction',
    'multiplication',
    'division',
  ];

  const difficulties: Difficulty[] = [1, 2, 3, 4, 5];

  describe('generateQuestion invariants', () => {
    operations.forEach(op => {
      difficulties.forEach(diff => {
        it(`generates valid question structure for ${op} at difficulty ${diff}`, () => {
          for (let trial = 0; trial < 15; trial++) {
            const q = generateQuestion(op, diff);

            expect(q.id).toBeTypeOf('string');
            expect(q.id.length).toBeGreaterThan(0);
            expect(q.operation).toBe(op);
            expect(q.difficulty).toBe(diff);
            expect(q.prompt).toBeTypeOf('string');
            expect(q.prompt.length).toBeGreaterThan(0);
            expect(q.answer).toBeTypeOf('number');
            expect(Number.isFinite(q.answer)).toBe(true);
            expect(q.hint).toBeTypeOf('string');
            expect(q.hint.length).toBeGreaterThan(0);

            // Choices invariants
            expect(q.choices).toHaveLength(4);
            // All choices are finite numbers
            q.choices.forEach(choice => {
              expect(choice).toBeTypeOf('number');
              expect(Number.isFinite(choice)).toBe(true);
            });
            // Choices are unique (no duplicates)
            const uniqueChoices = new Set(q.choices);
            expect(uniqueChoices.size).toBe(4);
            // Answer must be present in choices
            expect(q.choices).toContain(q.answer);
          }
        });
      });
    });
  });

  describe('operation-specific question properties', () => {
    describe('recognition', () => {
      it('creates correct prompt, answer ranges and visualPrompt', () => {
        for (let i = 0; i < 20; i++) {
          const lowDiff = generateQuestion('recognition', 1);
          expect(lowDiff.prompt).toBe('What number is this?');
          expect(lowDiff.visualPrompt).toHaveLength(1);
          expect(lowDiff.visualPrompt![0]).toBe(String(lowDiff.answer));
          expect(lowDiff.answer).toBeGreaterThanOrEqual(1);
          expect(lowDiff.answer).toBeLessThanOrEqual(5);

          const highDiff = generateQuestion('recognition', 4);
          expect(highDiff.prompt).toBe('What number is this?');
          expect(highDiff.visualPrompt).toHaveLength(1);
          expect(highDiff.visualPrompt![0]).toBe(String(highDiff.answer));
          expect(highDiff.answer).toBeGreaterThanOrEqual(1);
          expect(highDiff.answer).toBeLessThanOrEqual(10);
        }
      });
    });

    describe('counting', () => {
      it('creates visualPrompt array matching the answer count', () => {
        for (let i = 0; i < 20; i++) {
          const q = generateQuestion('counting', 2);
          expect(q.prompt).toBe('How many are there?');
          expect(q.visualPrompt).toBeDefined();
          expect(q.visualPrompt!.length).toBe(q.answer);
          expect(q.answer).toBeGreaterThanOrEqual(1);
          expect(q.answer).toBeLessThanOrEqual(5);

          const highQ = generateQuestion('counting', 4);
          expect(highQ.visualPrompt!.length).toBe(highQ.answer);
          expect(highQ.answer).toBeGreaterThanOrEqual(1);
          expect(highQ.answer).toBeLessThanOrEqual(10);
        }
      });
    });

    describe('addition', () => {
      it('verifies equation arithmetic matching the answer', () => {
        for (let i = 0; i < 30; i++) {
          const q = generateQuestion('addition', 2);
          const match = q.prompt.match(/^(\d+)\s*\+\s*(\d+)\s*=\s*\?$/);
          expect(match).not.toBeNull();
          const a = Number(match![1]);
          const b = Number(match![2]);
          expect(a + b).toBe(q.answer);
          expect(a).toBeGreaterThanOrEqual(1);
          expect(a).toBeLessThanOrEqual(5);
          expect(b).toBeGreaterThanOrEqual(1);
          expect(b).toBeLessThanOrEqual(5);

          const hardQ = generateQuestion('addition', 4);
          const hardMatch = hardQ.prompt.match(/^(\d+)\s*\+\s*(\d+)\s*=\s*\?$/);
          expect(hardMatch).not.toBeNull();
          const hardA = Number(hardMatch![1]);
          const hardB = Number(hardMatch![2]);
          expect(hardA + hardB).toBe(hardQ.answer);
          expect(hardA).toBeGreaterThanOrEqual(10);
          expect(hardA).toBeLessThanOrEqual(50);
          expect(hardB).toBeGreaterThanOrEqual(10);
          expect(hardB).toBeLessThanOrEqual(50);
        }
      });
    });

    describe('subtraction', () => {
      it('verifies non-negative answer and valid operand ordering', () => {
        for (let i = 0; i < 30; i++) {
          const q = generateQuestion('subtraction', 2);
          const match = q.prompt.match(/^(\d+)\s*-\s*(\d+)\s*=\s*\?$/);
          expect(match).not.toBeNull();
          const a = Number(match![1]);
          const b = Number(match![2]);
          expect(a - b).toBe(q.answer);
          expect(q.answer).toBeGreaterThanOrEqual(0);
          expect(a).toBeGreaterThanOrEqual(b);

          const hardQ = generateQuestion('subtraction', 5);
          const hardMatch = hardQ.prompt.match(/^(\d+)\s*-\s*(\d+)\s*=\s*\?$/);
          expect(hardMatch).not.toBeNull();
          const hardA = Number(hardMatch![1]);
          const hardB = Number(hardMatch![2]);
          expect(hardA - hardB).toBe(hardQ.answer);
          expect(hardQ.answer).toBeGreaterThanOrEqual(0);
          expect(hardA).toBeGreaterThanOrEqual(hardB);
        }
      });
    });

    describe('multiplication', () => {
      it('verifies product matches answer correctly', () => {
        for (let i = 0; i < 30; i++) {
          const q = generateQuestion('multiplication', 3);
          const match = q.prompt.match(/^(\d+)\s*×\s*(\d+)\s*=\s*\?$/);
          expect(match).not.toBeNull();
          const a = Number(match![1]);
          const b = Number(match![2]);
          expect(a * b).toBe(q.answer);
          expect(a).toBeGreaterThanOrEqual(1);
          expect(b).toBeGreaterThanOrEqual(1);
        }
      });
    });

    describe('division', () => {
      it('verifies clean integer division without remainder and no division by zero', () => {
        for (let i = 0; i < 30; i++) {
          const q = generateQuestion('division', 2);
          const match = q.prompt.match(/^(\d+)\s*÷\s*(\d+)\s*=\s*\?$/);
          expect(match).not.toBeNull();
          const a = Number(match![1]);
          const b = Number(match![2]);
          expect(b).toBeGreaterThan(0);
          expect(a % b).toBe(0);
          expect(Math.floor(a / b)).toBe(q.answer);
          expect(q.answer).toBeGreaterThanOrEqual(1);
        }
      });
    });
  });

  describe('getOperationsForAgeGroup', () => {
    it('returns age-appropriate operations for all groups', () => {
      expect(getOperationsForAgeGroup('2-3')).toEqual(['recognition', 'counting']);
      expect(getOperationsForAgeGroup('4-5')).toEqual(['counting', 'addition', 'subtraction']);
      expect(getOperationsForAgeGroup('6-7')).toEqual(['addition', 'subtraction', 'multiplication']);
      expect(getOperationsForAgeGroup('8-9')).toEqual(['multiplication', 'division', 'addition', 'subtraction']);
      expect(getOperationsForAgeGroup('unknown')).toEqual(['recognition', 'counting']);
      expect(getOperationsForAgeGroup('')).toEqual(['recognition', 'counting']);
    });
  });
});
