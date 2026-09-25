import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import { colors, useNativeDriver } from '@/ui/theme';

const PALETTE = [colors.coin, colors.happiness, colors.xp, colors.health, colors.primary];

interface Piece {
  x: number;
  drift: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
  spin: number;
  round: boolean;
}

function makePieces(count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => ({
    x: Math.random(),
    drift: (Math.random() - 0.5) * 80,
    delay: Math.random() * 600,
    duration: 2200 + Math.random() * 1400,
    color: PALETTE[i % PALETTE.length]!,
    size: 7 + Math.random() * 6,
    spin: (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 360),
    round: Math.random() > 0.6,
  }));
}

/** One burst of falling confetti. Renders nothing when `disabled`. */
export function Confetti({ count = 28, disabled = false }: { count?: number; disabled?: boolean }) {
  const { width, height } = useWindowDimensions();
  const [pieces] = useState(() => makePieces(count));
  const [progress] = useState(() => pieces.map(() => new Animated.Value(0)));

  useEffect(() => {
    if (disabled) return;
    const anims = progress.map((p, i) =>
      Animated.timing(p, {
        toValue: 1,
        duration: pieces[i]!.duration,
        delay: pieces[i]!.delay,
        easing: Easing.in(Easing.quad),
        useNativeDriver,
      }),
    );
    Animated.parallel(anims).start();
    return () => anims.forEach((a) => a.stop());
  }, [disabled, pieces, progress]);

  if (disabled) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece, i) => {
        const p = progress[i]!;
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: piece.x * width,
              top: -20,
              width: piece.size,
              height: piece.round ? piece.size : piece.size * 0.5,
              borderRadius: piece.round ? piece.size : 2,
              backgroundColor: piece.color,
              opacity: p.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
              transform: [
                { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, height * 0.9] }) },
                { translateX: p.interpolate({ inputRange: [0, 1], outputRange: [0, piece.drift] }) },
                { rotate: p.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${piece.spin}deg`] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
}
