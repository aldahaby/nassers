import type { SoundId } from '@/config/sounds';

/**
 * Bundled sound files (static requires so Metro bundles them; nothing is
 * downloaded). Replacing a sound = replacing the file with the same name.
 */
export const SOUND_ASSETS: Record<SoundId, number> = {
  tap: require('../../../assets/sfx/tap.wav'),
  primary: require('../../../assets/sfx/primary.wav'),
  nav: require('../../../assets/sfx/nav.wav'),
  back: require('../../../assets/sfx/back.wav'),
  'toggle-on': require('../../../assets/sfx/toggle-on.wav'),
  'toggle-off': require('../../../assets/sfx/toggle-off.wav'),
  select: require('../../../assets/sfx/select.wav'),
  equip: require('../../../assets/sfx/equip.wav'),
  confirm: require('../../../assets/sfx/confirm.wav'),
  unlock: require('../../../assets/sfx/unlock.wav'),
  purchase: require('../../../assets/sfx/purchase.wav'),
  unavailable: require('../../../assets/sfx/unavailable.wav'),
  'focus-start': require('../../../assets/sfx/focus-start.wav'),
  'focus-complete': require('../../../assets/sfx/focus-complete.wav'),
  'pet-cloudling': require('../../../assets/sfx/pet-cloudling.wav'),
  'pet-sproutling': require('../../../assets/sfx/pet-sproutling.wav'),
  'pet-emberling': require('../../../assets/sfx/pet-emberling.wav'),
  'rx-wave': require('../../../assets/sfx/rx-wave.wav'),
  'rx-hop': require('../../../assets/sfx/rx-hop.wav'),
  'rx-sleepy': require('../../../assets/sfx/rx-sleepy.wav'),
  'rx-cool': require('../../../assets/sfx/rx-cool.wav'),
  'rx-twirl': require('../../../assets/sfx/rx-twirl.wav'),
  'rx-pixel': require('../../../assets/sfx/rx-pixel.wav'),
  'rx-dream': require('../../../assets/sfx/rx-dream.wav'),
  'rx-victory': require('../../../assets/sfx/rx-victory.wav'),
  'rx-firefly': require('../../../assets/sfx/rx-firefly.wav'),
};
