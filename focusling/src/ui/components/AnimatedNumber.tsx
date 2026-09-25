import { useEffect, useState } from 'react';
import { Animated, Easing, Text, type TextStyle } from 'react-native';

/** Displays `value`, ticking smoothly to each new value (e.g. a coin balance after a purchase). */
export function AnimatedNumber({ value, style, duration = 700 }: { value: number; style?: TextStyle; duration?: number }) {
  const [anim] = useState(() => new Animated.Value(value));
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setShown(Math.round(v)));
    return () => anim.removeListener(id);
  }, [anim]);

  useEffect(() => {
    Animated.timing(anim, { toValue: value, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [anim, value, duration]);

  return <Text style={style}>{shown}</Text>;
}
