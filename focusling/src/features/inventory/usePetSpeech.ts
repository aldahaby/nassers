import { useCallback, useEffect, useRef, useState } from 'react';
import { getShopItem } from '@/config/shopCatalog';
import { PET_ITEM_LINES } from '@/config/petLines';
import type { PetReaction } from '@/state';
import { pickRandom } from '@/utils/format';

const BUBBLE_MS = 2400;

/** Speech bubble text with auto-hide, plus the line to say for an item reaction. */
export function usePetSpeech() {
  const [bubble, setBubble] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const say = useCallback((line: string | null, ms = BUBBLE_MS) => {
    setBubble(line);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setBubble(null), ms);
  }, []);

  const sayForReaction = useCallback(
    (reaction: PetReaction) => {
      const item = getShopItem(reaction.itemId);
      let line: string | undefined;
      if (reaction.kind === 'toy') {
        line = pickRandom(PET_ITEM_LINES.toy);
        if (reaction.happinessGained > 0) line = `${line}  +${Math.round(reaction.happinessGained)} 💖`;
      } else if (reaction.kind === 'food') {
        const gains = [
          reaction.healthGained > 0 ? `+${Math.round(reaction.healthGained)} 🍀` : null,
          reaction.happinessGained > 0 ? `+${Math.round(reaction.happinessGained)} 💖` : null,
        ].filter(Boolean);
        line = `${pickRandom(PET_ITEM_LINES.food) ?? ''}${gains.length ? `  ${gains.join(' ')}` : ''}`;
      } else {
        line = pickRandom(item?.category === 'decoration' ? PET_ITEM_LINES.decoration : PET_ITEM_LINES.accessory);
      }
      // Speak once the animation is underway.
      setTimeout(() => say(line ?? null, 2600), 400);
    },
    [say],
  );

  return { bubble, say, sayForReaction };
}
