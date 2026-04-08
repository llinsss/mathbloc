import { Question, Operation, Difficulty } from './types';

const EMOJIS = ['🍎','🌟','🐶','🦋','🍕','🎈','🐱','🌸','🍦','🚀','🐸','🎯','🍓','🦄','🐠'];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function wrongChoices(answer: number, count: number, min: number, max: number): number[] {
  const wrongs = new Set<number>();
  let attempts = 0;
  while (wrongs.size < count && attempts < 100) {
    const w = answer + randomInt(-3, 3);
    if (w !== answer && w >= min && w <= max) wrongs.add(w);
    attempts++;
  }
  // fill if not enough
  let fill = min;
  while (wrongs.size < count) {
    if (fill !== answer) wrongs.add(fill);
    fill++;
  }
  return Array.from(wrongs).slice(0, count);
}

function makeChoices(answer: number, min: number, max: number): number[] {
  const wrongs = wrongChoices(answer, 3, min, max);
  return shuffle([answer, ...wrongs]);
}

const HINTS: Record<Operation, string[]> = {
  recognition: ['Look at the number carefully!', 'Count the dots to find the number!'],
  counting: ['Count each item one by one!', 'Point to each one as you count!'],
  addition: ['Start with the bigger number and count up!', 'Use your fingers to count!'],
  subtraction: ['Start big and count backwards!', 'Take away means remove some!'],
  multiplication: ['Multiplication is repeated addition!', 'Count groups of the same number!'],
  division: ['Division means sharing equally!', 'How many groups can you make?'],
};

function getHint(op: Operation): string {
  const hints = HINTS[op];
  return hints[randomInt(0, hints.length - 1)];
}

export function generateQuestion(operation: Operation, difficulty: Difficulty): Question {
  const id = `${operation}-${difficulty}-${Date.now()}-${randomInt(0,9999)}`;

  switch (operation) {
    case 'recognition': {
      const num = difficulty <= 2 ? randomInt(1, 5) : randomInt(1, 10);
      const emoji = EMOJIS[randomInt(0, EMOJIS.length - 1)];
      return {
        id, operation, difficulty,
        prompt: 'What number is this?',
        visualPrompt: [String(num)],
        answer: num,
        choices: makeChoices(num, 1, 10),
        hint: getHint(operation),
      };
    }

    case 'counting': {
      const count = difficulty <= 2 ? randomInt(1, 5) : randomInt(1, 10);
      const emoji = EMOJIS[randomInt(0, EMOJIS.length - 1)];
      return {
        id, operation, difficulty,
        prompt: 'How many are there?',
        visualPrompt: Array(count).fill(emoji),
        answer: count,
        choices: makeChoices(count, 1, 10),
        hint: getHint(operation),
      };
    }

    case 'addition': {
      let a: number, b: number;
      if (difficulty <= 2) { a = randomInt(1, 5); b = randomInt(1, 5); }
      else if (difficulty === 3) { a = randomInt(1, 10); b = randomInt(1, 10); }
      else { a = randomInt(10, 50); b = randomInt(10, 50); }
      const answer = a + b;
      return {
        id, operation, difficulty,
        prompt: `${a} + ${b} = ?`,
        answer,
        choices: makeChoices(answer, 0, answer + 10),
        hint: getHint(operation),
      };
    }

    case 'subtraction': {
      let a: number, b: number;
      if (difficulty <= 2) { a = randomInt(2, 8); b = randomInt(1, a); }
      else if (difficulty === 3) { a = randomInt(5, 15); b = randomInt(1, a); }
      else { a = randomInt(20, 80); b = randomInt(10, a); }
      const answer = a - b;
      return {
        id, operation, difficulty,
        prompt: `${a} - ${b} = ?`,
        answer,
        choices: makeChoices(answer, 0, a),
        hint: getHint(operation),
      };
    }

    case 'multiplication': {
      let a: number, b: number;
      if (difficulty <= 3) { a = randomInt(1, 5); b = randomInt(1, 5); }
      else { a = randomInt(2, 9); b = randomInt(2, 9); }
      const answer = a * b;
      return {
        id, operation, difficulty,
        prompt: `${a} × ${b} = ?`,
        answer,
        choices: makeChoices(answer, 0, answer + 10),
        hint: getHint(operation),
      };
    }

    case 'division': {
      let b: number, answer: number;
      if (difficulty <= 3) { b = randomInt(1, 4); answer = randomInt(1, 5); }
      else { b = randomInt(2, 9); answer = randomInt(2, 9); }
      const a = b * answer;
      return {
        id, operation, difficulty,
        prompt: `${a} ÷ ${b} = ?`,
        answer,
        choices: makeChoices(answer, 1, answer + 8),
        hint: getHint(operation),
      };
    }
  }
}

export function getOperationsForAgeGroup(ageGroup: string): Operation[] {
  switch (ageGroup) {
    case '2-3': return ['recognition', 'counting'];
    case '4-5': return ['counting', 'addition', 'subtraction'];
    case '6-7': return ['addition', 'subtraction', 'multiplication'];
    case '8-9': return ['multiplication', 'division', 'addition', 'subtraction'];
    default: return ['recognition', 'counting'];
  }
}
