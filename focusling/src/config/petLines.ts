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

/** Said when the player returns to the pet screen after a session ends. */
export const PET_WELCOME_BACK_LINES: Record<'completed' | 'abandoned', readonly string[]> = {
  completed: ['Thanks for focusing with me!', 'We did it!', 'That felt great. Again soon?'],
  abandoned: ['Every bit counts. Welcome back!', 'Nice try! We can go again anytime.'],
};

/** Said when the pet uses or receives items. */
export const PET_ITEM_LINES = {
  toy: ['Wheee!', 'Again! Again!', 'Best toy ever!', 'So fun!'],
  food: ['Yum!', 'Delicious!', 'Nom nom nom!', 'Thank you!'],
  accessory: ['Do I look good?', 'I love it!', 'So stylish!'],
  decoration: ['So cozy!', 'Our room looks great!', 'I love it here!'],
} as const;
