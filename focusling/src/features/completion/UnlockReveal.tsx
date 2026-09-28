import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { getShopItem } from '@/config/shopCatalog';
import { nextUnlock } from '@/core';
import { cosmeticName, describeEarned, describeProgress, describeUnlock } from '@/features/wardrobe/cosmeticCopy';
import { useGameStore } from '@/state';
import { Button, ItemArt, TabIcon, colors, motion, radius, spacing, typography, useNativeDriver } from '@/ui';
import { sparklePath } from '@/ui/pet/focusClubArt';
import Svg, { Path } from 'react-native-svg';

interface Props {
  unlocked: string[];
  petName: string;
  /** When the card appears (after the reward rows). */
  delay: number;
  reducedMotion: boolean;
  /** Lets the screen's pet react when something is worn. */
  onWear: () => void;
  /** Show the "next up" line (completed sessions only). */
  showNext: boolean;
}

/**
 * The reward reveal: a new item pops in with one small sparkle, says how it was
 * earned, and offers "Wear it" or "Later". Quick and skippable (it's just a card
 * in the summary); Reduce Motion gets a fade.
 */
export function UnlockReveal({ unlocked, petName, delay, reducedMotion, onWear, showNext }: Props) {
  const save = useGameStore((s) => s.save);
  const equipped = useGameStore((s) => s.save?.inventory.equipped);
  const { equip, markItemsSeen } = useGameStore.getState();
  const [pop] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));
  const [sparkle] = useState(() => new Animated.Value(0));
  const [later, setLater] = useState(false);

  useEffect(() => {
    if (reducedMotion) return;
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(pop, { toValue: 1, friction: 6, tension: 90, useNativeDriver }),
        Animated.timing(sparkle, { toValue: 1, duration: motion.equip, easing: Easing.out(Easing.cubic), useNativeDriver }),
      ]),
    ]).start();
  }, [delay, pop, reducedMotion, sparkle]);

  const next = save && showNext ? nextUnlock(save) : null;
  const items = unlocked.map((id) => getShopItem(id)).filter((i) => i !== undefined);

  const wear = (id: string) => {
    equip(id);
    markItemsSeen([id]);
    onWear();
  };

  return (
    <>
      {items.length > 0 && (
        <Animated.View
          style={[styles.card, { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.kicker}>New for {petName}</Text>
          {items.map((item) => {
            const wearing = item.equipSlot ? equipped?.[item.equipSlot] === item.id : false;
            return (
              <View key={item.id} style={styles.item} accessible={false}>
                <View style={styles.artWrap}>
                  <View style={styles.glow} />
                  {!reducedMotion &&
                    [0, 1, 2, 3].map((i) => {
                      const a = (i / 4) * Math.PI * 2 + 0.4;
                      return (
                        <Animated.View
                          key={i}
                          style={[
                            styles.spark,
                            {
                              opacity: sparkle.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 0] }),
                              transform: [
                                { translateX: sparkle.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(a) * 46] }) },
                                { translateY: sparkle.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(a) * 40] }) },
                              ],
                            },
                          ]}
                        >
                          <Svg width={14} height={14} viewBox="0 0 24 24">
                            <Path d={sparklePath(12, 12, 11)} fill={colors.coin} />
                          </Svg>
                        </Animated.View>
                      );
                    })}
                  {/* Wrapped so it stacks above the absolute glow on web too. */}
                  <View>
                    <ItemArt itemId={item.id} size={72} />
                  </View>
                </View>
                <View style={styles.text} accessible accessibilityLabel={`New: ${cosmeticName(item)}. ${describeEarned(item)}.`}>
                  <Text style={styles.name}>{cosmeticName(item)}</Text>
                  <Text style={styles.earned}>{describeEarned(item)}</Text>
                </View>
                {wearing ? (
                  <View style={styles.wearing} accessible accessibilityLabel={`${petName} is wearing it`}>
                    <TabIcon name="check" color={colors.success} size={16} />
                    <Text style={styles.wearingText}>Wearing</Text>
                  </View>
                ) : later ? (
                  <Text style={styles.saved}>In your wardrobe</Text>
                ) : (
                  <View style={styles.actions}>
                    <Button label="Wear it" onPress={() => wear(item.id)} style={styles.action} />
                  </View>
                )}
              </View>
            );
          })}
          {!later && items.some((i) => i.equipSlot && equipped?.[i.equipSlot] !== i.id) && (
            <Pressable onPress={() => setLater(true)} style={styles.later} accessibilityRole="button" accessibilityLabel="Later">
              <Text style={styles.laterText}>Later</Text>
            </Pressable>
          )}
        </Animated.View>
      )}
      {next?.item.unlock && (
        <View style={styles.next} accessible accessibilityLabel={`Next: ${cosmeticName(next.item)}. ${describeUnlock(next.item.unlock)}, ${describeProgress(next.item.unlock, next.progress)}.`}>
          <View style={styles.nextArt}>
            <ItemArt itemId={next.item.id} size={34} />
          </View>
          <Text style={styles.nextText}>
            Next: <Text style={styles.nextName}>{cosmeticName(next.item)}</Text>
            {'\n'}
            {describeUnlock(next.item.unlock)} · {describeProgress(next.item.unlock, next.progress)}
          </Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch', backgroundColor: colors.ink, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  kicker: { ...typography.label, color: colors.coin, textTransform: 'uppercase', letterSpacing: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  artWrap: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 84, height: 84, borderRadius: 42, backgroundColor: '#46396A' },
  spark: { position: 'absolute', left: 37, top: 37 },
  text: { flex: 1, minWidth: 120, gap: 2 },
  name: { ...typography.heading, fontSize: 18, color: colors.white },
  earned: { ...typography.label, color: '#CFC6E8' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { minWidth: 120 },
  wearing: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.successSoft, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 6 },
  wearingText: { fontWeight: '800', color: colors.success },
  saved: { ...typography.label, color: '#CFC6E8' },
  later: { alignSelf: 'center', minHeight: 44, paddingHorizontal: spacing.xl, justifyContent: 'center' },
  laterText: { fontSize: 16, fontWeight: '800', color: '#E4DDF7' },
  next: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md },
  nextArt: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.stageGlow, alignItems: 'center', justifyContent: 'center', opacity: 0.8 },
  nextText: { ...typography.body, fontSize: 14, flex: 1, color: colors.textMuted, lineHeight: 20 },
  nextName: { fontWeight: '800', color: colors.text },
});
