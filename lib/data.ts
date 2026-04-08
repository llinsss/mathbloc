import { StoryChapter, Operation } from './types';

export const STORY_CHAPTERS: StoryChapter[] = [
  { id: 1, title: 'Number Island', emoji: '🏝️', description: 'Learn to recognize numbers 1-5!', operations: ['recognition'], requiredStars: 0, unlocked: true },
  { id: 2, title: 'Counting Forest', emoji: '🌲', description: 'Count the animals in the forest!', operations: ['counting'], requiredStars: 3, unlocked: false },
  { id: 3, title: 'Addition Castle', emoji: '🏰', description: 'Add numbers to open the castle gates!', operations: ['addition'], requiredStars: 8, unlocked: false },
  { id: 4, title: 'Subtraction Sea', emoji: '🌊', description: 'Subtract to navigate the sea!', operations: ['subtraction'], requiredStars: 15, unlocked: false },
  { id: 5, title: 'Multiplication Mountain', emoji: '⛰️', description: 'Multiply to climb the mountain!', operations: ['multiplication'], requiredStars: 25, unlocked: false },
  { id: 6, title: 'Division Kingdom', emoji: '👑', description: 'Divide to rule the kingdom!', operations: ['division'], requiredStars: 40, unlocked: false },
];

export const BADGES = [
  { id: 'first-correct', name: 'First Star!', emoji: '⭐' },
  { id: 'streak-5', name: '5 in a Row!', emoji: '🔥' },
  { id: 'streak-10', name: 'On Fire!', emoji: '🚀' },
  { id: 'perfect-session', name: 'Perfect!', emoji: '💎' },
  { id: 'addition-master', name: 'Addition Master', emoji: '➕' },
  { id: 'subtraction-master', name: 'Subtraction Master', emoji: '➖' },
  { id: 'multiplication-master', name: 'Multiplication Master', emoji: '✖️' },
  { id: 'division-master', name: 'Division Master', emoji: '➗' },
  { id: 'speed-demon', name: 'Speed Demon', emoji: '⚡' },
  { id: 'chapter-1', name: 'Island Explorer', emoji: '🏝️' },
  { id: 'chapter-2', name: 'Forest Friend', emoji: '🌲' },
  { id: 'chapter-3', name: 'Castle Knight', emoji: '🏰' },
];

export const AVATARS = ['🐶','🐱','🐸','🦊','🐼','🦁','🐯','🐨','🦄','🐲','🐧','🦋'];

export const AGE_GROUPS = [
  { value: '2-3', label: 'Ages 2–3', emoji: '🌱' },
  { value: '4-5', label: 'Ages 4–5', emoji: '🌿' },
  { value: '6-7', label: 'Ages 6–7', emoji: '🌳' },
  { value: '8-9', label: 'Ages 8–9', emoji: '🏆' },
];

export function speak(text: string) {
  if (typeof window === 'undefined') return;
  window.speechSynthesis?.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 0.85;
  utt.pitch = 1.2;
  window.speechSynthesis?.speak(utt);
}
