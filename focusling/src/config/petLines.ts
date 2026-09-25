import type { PetMood } from '@/core';

/** Things the pet says when tapped, by mood. `{name}` is replaced with the pet's name. */
export const PET_TAP_LINES: Record<PetMood, readonly string[]> = {
  joyful: ['Best day ever!', 'Hehe, that tickles!', "You're doing amazing!", 'Wanna focus together?'],
  content: ['Hi there!', 'Pat pat!', 'I like it when you visit.', 'Ready for a focus break?'],
  sleepy: ['*yawn*… oh, hi!', 'A focus session would perk me up.', 'Mmm, five more minutes…'],
  lonely: ['I missed you!', 'Wanna hang out?', "Let's do a short session together?"],
};

export const PET_FOCUS_LINES: readonly string[] = [
  "You've got this!",
  "I'm right here with you.",
  'Deep breaths, steady focus.',
  'Every minute counts!',
];
