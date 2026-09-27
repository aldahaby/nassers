import { MEMORY_GARDEN } from '@/config/play';

/** Pure Memory Garden rules: no timer, no speed scoring. */
export interface MemoryCard {
  id: number;
  itemId: string;
  matched: boolean;
}

export interface MemoryState {
  cards: MemoryCard[];
  /** Indexes of face-up, unmatched cards (0–2). */
  revealed: number[];
  moves: number;
}

/** Small deterministic PRNG so a shuffle can be reproduced in tests. */
export function seededRandom(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function createMemoryDeck(seed: number, items: readonly string[] = MEMORY_GARDEN.cardItems): MemoryState {
  const pairs = items.slice(0, MEMORY_GARDEN.pairs);
  const cards = [...pairs, ...pairs].map((itemId, id) => ({ id, itemId, matched: false }));
  const rand = seededRandom(seed);
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [cards[i], cards[j]] = [cards[j]!, cards[i]!];
  }
  return { cards, revealed: [], moves: 0 };
}

export type FlipOutcome = 'ignored' | 'revealed' | 'match' | 'mismatch';

/** Flip a card. A mismatch leaves both face up until `hideMismatch` is called. */
export function flipCard(state: MemoryState, index: number): { state: MemoryState; outcome: FlipOutcome } {
  const card = state.cards[index];
  if (!card || card.matched || state.revealed.includes(index) || state.revealed.length >= 2) {
    return { state, outcome: 'ignored' };
  }
  const revealed = [...state.revealed, index];
  if (revealed.length < 2) return { state: { ...state, revealed }, outcome: 'revealed' };

  const [a, b] = revealed.map((i) => state.cards[i]!);
  const moves = state.moves + 1;
  if (a!.itemId === b!.itemId) {
    const cards = state.cards.map((c, i) => (revealed.includes(i) ? { ...c, matched: true } : c));
    return { state: { cards, revealed: [], moves }, outcome: 'match' };
  }
  return { state: { ...state, revealed, moves }, outcome: 'mismatch' };
}

export function hideMismatch(state: MemoryState): MemoryState {
  return { ...state, revealed: [] };
}

export function isMemoryComplete(state: MemoryState): boolean {
  return state.cards.length > 0 && state.cards.every((c) => c.matched);
}

export function pairsFound(state: MemoryState): number {
  return state.cards.filter((c) => c.matched).length / 2;
}
