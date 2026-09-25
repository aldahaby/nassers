import { useEffect, useState } from 'react';
import { Animated, Easing, Text, type TextStyle } from 'react-native';

interface Props {
  from: number;
  to: number;
  duration?: number;
  delay?: number;
  style?: TextStyle | TextStyle[];
  prefix?: string;
  suffix?: string;
  /** Skip the animation (reduced motion). */
  instant?: boolean;
}

/** A number that ticks from `from` to `to`. */
export function CountUpText({ from, to, duration = 900, delay = 0, style, prefix = '', suffix = '', instant = false }: Props) {
  const [value, setValue] = useState(instant ? to : from);

  useEffect(() => {
    if (instant) return;
    const anim = new Animated.Value(from);
    const id = anim.addListener(({ value: v }) => setValue(Math.round(v)));
    Animated.timing(anim, { toValue: to, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => {
      anim.stopAnimation();
      anim.removeListener(id);
    };
  }, [from, to, duration, delay, instant]);

  return (
    <Text style={style}>
      {prefix}
      {instant ? to : value}
      {suffix}
    </Text>
  );
}
