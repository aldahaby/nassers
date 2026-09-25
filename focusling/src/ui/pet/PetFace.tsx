import { Circle, Ellipse, G, Path } from 'react-native-svg';
import type { GrowthStage, PetMood } from '@/core';
import type { PetAnatomy } from './anatomy';

export type FaceExpression = 'auto' | 'blink' | 'delighted' | 'focused';

interface Props {
  anatomy: PetAnatomy;
  mood: PetMood;
  stage: GrowthStage;
  expression: FaceExpression;
  cheekColor: string;
}

const INK = '#2B2140';

/** Eyes, cheeks and mouth. Babies get bigger eyes. */
export function PetFace({ anatomy, mood, stage, expression, cheekColor }: Props) {
  const { eyeY, eyeDx, mouthY } = anatomy;
  const eyeScale = stage === 'baby' ? 1.18 : stage === 'young' ? 1.08 : 1;
  const leftX = 100 - eyeDx;
  const rightX = 100 + eyeDx;

  const eyes = (() => {
    if (expression === 'delighted') {
      // Happy closed "^ ^" eyes.
      return [leftX, rightX].map((x) => (
        <Path
          key={x}
          d={`M${x - 8} ${eyeY + 3} Q${x} ${eyeY - 8} ${x + 8} ${eyeY + 3}`}
          stroke={INK}
          strokeWidth={4.5}
          strokeLinecap="round"
          fill="none"
        />
      ));
    }
    if (expression === 'blink') {
      return [leftX, rightX].map((x) => (
        <Path key={x} d={`M${x - 8} ${eyeY} Q${x} ${eyeY + 5} ${x + 8} ${eyeY}`} stroke={INK} strokeWidth={4} strokeLinecap="round" fill="none" />
      ));
    }
    const sleepy = expression === 'auto' && (mood === 'sleepy' || mood === 'lonely');
    if (expression === 'focused') {
      // Calm, attentive eyes: a little narrower, gaze softly lowered.
      return [leftX, rightX].map((x) => (
        <G key={x}>
          <Ellipse cx={x} cy={eyeY + 1} rx={7 * eyeScale} ry={8 * eyeScale} fill={INK} />
          <Circle cx={x + 2.2} cy={eyeY - 1.5} r={2.6 * eyeScale} fill="#FFFFFF" />
        </G>
      ));
    }
    return [leftX, rightX].map((x) => (
      <G key={x}>
        <Ellipse cx={x} cy={eyeY} rx={7.5 * eyeScale} ry={(sleepy ? 6 : 10) * eyeScale} fill={INK} />
        <Circle cx={x + 2.5} cy={eyeY - (sleepy ? 1.5 : 4)} r={3 * eyeScale} fill="#FFFFFF" />
        <Circle cx={x - 2.5} cy={eyeY + 3} r={1.4 * eyeScale} fill="#FFFFFF" opacity={0.8} />
        {sleepy && (
          // Heavy eyelid.
          <Path d={`M${x - 10} ${eyeY - 3} L${x + 10} ${eyeY - 3}`} stroke={INK} strokeWidth={3} strokeLinecap="round" />
        )}
      </G>
    ));
  })();

  const mouth = (() => {
    if (expression === 'delighted' || (expression === 'auto' && mood === 'joyful')) {
      return (
        <G>
          <Path d={`M${92} ${mouthY - 2} Q100 ${mouthY + 12} ${108} ${mouthY - 2} Z`} fill={INK} />
          <Ellipse cx={100} cy={mouthY + 4} rx={4} ry={2.5} fill="#FF8FA8" />
        </G>
      );
    }
    if (expression === 'focused') {
      return <Path d={`M95 ${mouthY} Q100 ${mouthY + 4} 105 ${mouthY}`} stroke={INK} strokeWidth={3.2} strokeLinecap="round" fill="none" />;
    }
    if (mood === 'sleepy') return <Ellipse cx={100} cy={mouthY + 1} rx={3.5} ry={3} fill={INK} />;
    if (mood === 'lonely') {
      return <Path d={`M93 ${mouthY + 3} Q100 ${mouthY - 3} 107 ${mouthY + 3}`} stroke={INK} strokeWidth={3.5} strokeLinecap="round" fill="none" />;
    }
    return <Path d={`M92 ${mouthY - 1} Q100 ${mouthY + 7} 108 ${mouthY - 1}`} stroke={INK} strokeWidth={3.5} strokeLinecap="round" fill="none" />;
  })();

  return (
    <G>
      <Ellipse cx={leftX - 12} cy={eyeY + 16} rx={9} ry={5.5} fill={cheekColor} opacity={0.55} />
      <Ellipse cx={rightX + 12} cy={eyeY + 16} rx={9} ry={5.5} fill={cheekColor} opacity={0.55} />
      {eyes}
      {mouth}
    </G>
  );
}
