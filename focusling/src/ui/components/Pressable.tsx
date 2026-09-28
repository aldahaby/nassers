import { forwardRef } from 'react';
import { Pressable as RNPressable, type GestureResponderEvent, type PressableProps, type View } from 'react-native';
import type { SoundId } from '@/config/sounds';
import { playSound } from '@/services/audio';

export interface SoundPressableProps extends PressableProps {
  /**
   * The semantic sound for this press. Omitted → inferred from the role:
   * tabs "nav", back/close/cancel "back", switches "toggle-on/off", everything
   * else "tap". `null` = deliberately silent (e.g. the pet, which has its own
   * cue, or presses whose action plays a more specific sound).
   */
  sound?: SoundId | null;
}

const BACK = /^(back|close|cancel|done|not now|dismiss)\b/i;

export function inferSound(props: Pick<PressableProps, 'accessibilityRole' | 'accessibilityLabel' | 'accessibilityState'>): SoundId {
  const role = props.accessibilityRole;
  if (role === 'tab') return 'nav';
  if (role === 'switch' || role === 'checkbox') return props.accessibilityState?.checked ? 'toggle-off' : 'toggle-on';
  if (role === 'radio') return 'select';
  if (typeof props.accessibilityLabel === 'string' && BACK.test(props.accessibilityLabel)) return 'back';
  return 'tap';
}

/**
 * Focusling's Pressable: React Native's Pressable plus one soft UI sound on a
 * successful press (the moment the visual state changes). Disabled presses and
 * presses without a handler stay silent; audio is limited centrally, so fast
 * tapping never piles up and the button itself never slows down.
 */
export const Pressable = forwardRef<View, SoundPressableProps>(function Pressable({ sound, onPress, ...rest }, ref) {
  const handle = onPress
    ? (e: GestureResponderEvent) => {
        if (sound !== null && !rest.disabled) playSound(sound ?? inferSound(rest));
        onPress(e);
      }
    : undefined;
  return <RNPressable ref={ref} onPress={handle} {...rest} />;
});
