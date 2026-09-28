import type { ReactNode, Ref } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@/ui/theme';

/** Content width caps so phones fill the screen and tablets get a centred column. */
export const SCREEN_MAX_WIDTH = { narrow: 640, wide: 1120 } as const;

interface Props {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  /** Wide screens (dashboards) use more of a tablet's width. */
  width?: keyof typeof SCREEN_MAX_WIDTH;
  /** Lets a screen scroll itself, e.g. back up to the pet after picking a piece. */
  scrollRef?: Ref<ScrollView>;
}

/** Standard screen container: safe area, background, padding, optional scrolling. */
export function Screen({ children, scroll = false, contentStyle, width = 'narrow', scrollRef }: Props) {
  const column = { maxWidth: SCREEN_MAX_WIDTH[width] };
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView ref={scrollRef} contentContainerStyle={[styles.content, column, contentStyle]} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill, column, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, width: '100%', alignSelf: 'center' },
  fill: { flex: 1 },
});
