import { Circle, Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';
import type { GrowthStage, PetMood, PetSpeciesId } from '@/core';
import { mix } from '@/ui/color';
import type { PetAnatomy } from './anatomy';
import { useArtScope } from './artScope';
import { SPECIES_ART } from './speciesArt';

/**
 * The expression vocabulary (docs/ART_DIRECTION.md, "Expressions"). All are
 * positive or neutral: there is no sad, guilty or punished face.
 * - auto: follows mood (content / joyful / sleepy / a calm "lonely")
 * - delighted: happy ^ ^ eyes, open smile
 * - excited: sparkling open eyes, big open smile
 * - curious: eyes glancing up, a small "o"
 * - proud: content closed eyes, a warm closed smile
 * - surprised: round eyes, a round mouth
 * - wink: cool / confident
 * - focused, sleepy, eating, blink
 */
export type FaceExpression = 'auto' | 'blink' | 'delighted' | 'excited' | 'curious' | 'proud' | 'surprised' | 'focused' | 'eating' | 'sleepy' | 'wink';

export const EXPRESSIONS: readonly Exclude<FaceExpression, 'blink'>[] = ['auto', 'delighted', 'excited', 'curious', 'proud', 'surprised', 'wink', 'focused', 'sleepy', 'eating'];

interface Props {
  anatomy: PetAnatomy;
  mood: PetMood;
  stage: GrowthStage;
  expression: FaceExpression;
  cheekColor: string;
  species: PetSpeciesId;
  /** Where the eyes glance, in pet units (idle glances, curiosity). */
  gaze?: { x: number; y: number };
}

const INK = '#2B2140';
const LID = 4.2;

/**
 * Focusling eyes: an ink oval with a gentle vertical gradient, a species tint
 * reflected in the bottom, one primary catchlight and one tiny secondary one.
 * Closed states share one stroke weight so every expression reads as the same
 * character. Babies get bigger eyes.
 */
export function PetFace({ anatomy, mood, stage, expression, cheekColor, species, gaze }: Props) {
  const { eyeY, eyeDx, mouthY } = anatomy;
  const eyeScale = stage === 'baby' ? 1.18 : stage === 'young' ? 1.08 : 1;
  const leftX = 100 - eyeDx;
  const rightX = 100 + eyeDx;
  const tint = SPECIES_ART[species].eyeTint;
  const gradId = `pf-eye-${species}${useArtScope()}`;
  const lonely = expression === 'auto' && mood === 'lonely';
  const sleepyMood = expression === 'auto' && (mood === 'sleepy' || lonely);
  const g = expression === 'curious' ? { x: 1.6, y: -1.8 } : (gaze ?? { x: 0, y: 0 });

  /** One open eye. `sparkle` swaps the catchlight for a tiny star. */
  const openEye = (x: number, { rx = 7.5, ry = 10, half = false, sparkle = false, small = false } = {}) => {
    const RX = rx * eyeScale;
    const RY = (half ? ry * 0.6 : ry) * eyeScale;
    const cx = x + g.x;
    const cy = eyeY + g.y + (half ? 1.5 : 0);
    const c = small ? 0.75 : 1;
    return (
      <G key={x}>
        <Ellipse cx={cx} cy={cy} rx={RX} ry={RY} fill={`url(#${gradId})`} />
        {/* Species tint reflected in the lower eye. */}
        <Path d={`M${cx - RX * 0.72} ${cy + RY * 0.35} Q${cx} ${cy + RY * 1.02} ${cx + RX * 0.72} ${cy + RY * 0.35} Q${cx} ${cy + RY * 0.72} ${cx - RX * 0.72} ${cy + RY * 0.35} Z`} fill={tint} opacity={0.55} />
        {sparkle ? (
          <Path
            d={`M${cx + 2.4} ${cy - 7.5 * eyeScale} l1.1 2.9 2.9 1.1 -2.9 1.1 -1.1 2.9 -1.1 -2.9 -2.9 -1.1 2.9 -1.1 Z`}
            fill="#FFFFFF"
          />
        ) : (
          <Ellipse cx={cx + 2.6 * eyeScale} cy={cy - (half ? 1.2 : 3.8) * eyeScale} rx={3.1 * eyeScale * c} ry={3.4 * eyeScale * c} fill="#FFFFFF" />
        )}
        <Circle cx={cx - 2.8 * eyeScale} cy={cy + 3.4 * eyeScale} r={1.3 * eyeScale} fill="#FFFFFF" opacity={0.75} />
        {half && <Path d={`M${cx - RX - 2} ${cy - RY + 0.5} L${cx + RX + 2} ${cy - RY + 0.5}`} stroke={INK} strokeWidth={3} strokeLinecap="round" />}
      </G>
    );
  };
  /** Closed eye as an arc: `up` for happy (^), otherwise a relaxed downward lid. */
  const closedEye = (x: number, shape: 'happy' | 'sleepy' | 'blink' | 'proud') => {
    const d =
      shape === 'happy'
        ? `M${x - 8} ${eyeY + 3} Q${x} ${eyeY - 8} ${x + 8} ${eyeY + 3}`
        : shape === 'proud'
          ? `M${x - 8} ${eyeY + 1} Q${x} ${eyeY - 5} ${x + 8} ${eyeY + 1}`
          : shape === 'sleepy'
            ? `M${x - 8} ${eyeY + 1} Q${x} ${eyeY + 7} ${x + 8} ${eyeY + 1}`
            : `M${x - 8} ${eyeY} Q${x} ${eyeY + 5} ${x + 8} ${eyeY}`;
    return <Path key={x} d={d} stroke={INK} strokeWidth={LID} strokeLinecap="round" fill="none" />;
  };

  const eyes = (() => {
    switch (expression) {
      case 'delighted':
      case 'eating':
        return [closedEye(leftX, 'happy'), closedEye(rightX, 'happy')];
      case 'proud':
        return [closedEye(leftX, 'proud'), closedEye(rightX, 'proud')];
      case 'sleepy':
        return [closedEye(leftX, 'sleepy'), closedEye(rightX, 'sleepy')];
      case 'blink':
        return [closedEye(leftX, 'blink'), closedEye(rightX, 'blink')];
      case 'wink':
        return [closedEye(leftX, 'happy'), openEye(rightX, { ry: 9 })];
      case 'excited':
        return [openEye(leftX, { rx: 8, ry: 10.5, sparkle: true }), openEye(rightX, { rx: 8, ry: 10.5, sparkle: true })];
      case 'surprised':
        return [openEye(leftX, { rx: 7.6, ry: 8.6, small: true }), openEye(rightX, { rx: 7.6, ry: 8.6, small: true })];
      case 'focused':
        return [openEye(leftX, { rx: 7, ry: 8 }), openEye(rightX, { rx: 7, ry: 8 })];
      default:
        return [openEye(leftX, { half: sleepyMood }), openEye(rightX, { half: sleepyMood })];
    }
  })();

  const smile = (w: number, depth: number) => <Path d={`M${100 - w} ${mouthY - 1} Q100 ${mouthY + depth} ${100 + w} ${mouthY - 1}`} stroke={INK} strokeWidth={3.5} strokeLinecap="round" fill="none" />;
  const open = (w: number, depth: number) => (
    <G>
      <Path d={`M${100 - w} ${mouthY - 2} Q100 ${mouthY + depth} ${100 + w} ${mouthY - 2} Z`} fill={INK} strokeLinejoin="round" />
      <Ellipse cx={100} cy={mouthY + depth * 0.36} rx={w * 0.5} ry={depth * 0.2} fill="#FF8FA8" />
    </G>
  );
  const mouth = (() => {
    switch (expression) {
      case 'delighted':
        return open(8, 12);
      case 'excited':
        return open(10, 15);
      case 'proud':
        return smile(10, 8);
      case 'wink':
        // A little lopsided grin.
        return <Path d={`M92 ${mouthY} Q101 ${mouthY + 7} 109 ${mouthY - 3}`} stroke={INK} strokeWidth={3.5} strokeLinecap="round" fill="none" />;
      case 'sleepy':
        return <Ellipse cx={100} cy={mouthY + 2} rx={3.5} ry={3} fill={INK} />;
      case 'eating':
        return <Ellipse cx={100} cy={mouthY + 3} rx={7} ry={6.5} fill={INK} />;
      case 'surprised':
        return <Ellipse cx={100} cy={mouthY + 3} rx={4.5} ry={5.5} fill={INK} />;
      case 'curious':
        return <Ellipse cx={102} cy={mouthY + 2} rx={3} ry={3.4} fill={INK} />;
      case 'focused':
        return smile(5, 4);
      default:
        if (mood === 'joyful') return open(8, 12);
        if (mood === 'sleepy') return <Ellipse cx={100} cy={mouthY + 1} rx={3.5} ry={3} fill={INK} />;
        // "Lonely" stays calm: a small neutral mouth, never a guilt-trip frown.
        if (lonely) return <Path d={`M95 ${mouthY + 1} L105 ${mouthY + 1}`} stroke={INK} strokeWidth={3.2} strokeLinecap="round" />;
        return smile(8, 7);
    }
  })();

  const cheekBoost = expression === 'proud' || expression === 'excited' || expression === 'delighted' ? 0.75 : 0.55;
  return (
    <G>
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={INK} />
          <Stop offset="1" stopColor={mix(INK, tint, 0.28)} />
        </LinearGradient>
      </Defs>
      {/* Cheeks: a soft blush with a tiny highlight. */}
      {[leftX - 12, rightX + 12].map((x) => (
        <G key={x}>
          <Ellipse cx={x} cy={eyeY + 16} rx={9} ry={5.5} fill={cheekColor} opacity={cheekBoost} />
          <Circle cx={x - 3} cy={eyeY + 14.5} r={1.4} fill="#FFFFFF" opacity={0.55} />
        </G>
      ))}
      {eyes}
      {mouth}
    </G>
  );
}
