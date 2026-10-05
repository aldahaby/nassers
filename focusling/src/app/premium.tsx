import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { getCollection } from '@/config/collections';
import { NIGHTGLOW_ITEMS, PREMIUM_LOOKS } from '@/config/cosmetics';
import { LEGAL } from '@/config/legal';
import { ALWAYS_FREE, PREMIUM_INCLUDES, PREMIUM_PRODUCTS } from '@/config/premium';
import { ROOM_THEMES } from '@/config/roomThemes';
import { playSound } from '@/services/audio';
import { useCapabilities, useEntitlement, useEntitlementStore, useGameStore, useIsChildView, usePetView } from '@/state';
import { AnimatedPet, Button, ItemArt, PetArt, PremiumGlyph, Pressable, RoomScene, Screen, TabIcon, colors, radius, spacing, typography } from '@/ui';

const NIGHTGLOW = getCollection('nightglow')!;

/**
 * Focusling Premium. "Focus for free. Make your Focusling world bigger with
 * Premium." Real content previews on the person's own pet, store-supplied
 * prices only, and clear Restore / Manage / Terms / Privacy / Not now. No
 * countdowns, guilt or urgency, and the pet never asks for money. In Child
 * View there are no purchase controls at all.
 */
export default function PremiumScreen() {
  const view = usePetView();
  const childView = useIsChildView();
  const caps = useCapabilities();
  const entitlement = useEntitlement();
  const { products, storeAvailable, busy, message, studentOffer, storeKind } = useEntitlementStore();
  const { purchase, restore, manageSubscription, clearMessage, refreshProducts } = useEntitlementStore.getState();
  const debug = useGameStore((s) => s.save?.profile.settings.debugToolsEnabled ?? false);
  const { width } = useWindowDimensions();
  const [selected, setSelected] = useState<string>(PREMIUM_PRODUCTS.yearly);
  const [themeIndex, setThemeIndex] = useState(0);
  useEffect(() => {
    void refreshProducts();
    return () => clearMessage();
  }, [clearMessage, refreshProducts]);
  if (!view) return null;
  const { pet, progression } = view;
  const active = caps.canUsePremiumCollections;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const petSize = Math.min(200, width * 0.48);
  const theme = ROOM_THEMES[themeIndex % ROOM_THEMES.length]!;
  const product = products.find((p) => p.id === selected) ?? products[0];

  const subscribe = async () => {
    if (!product) return;
    const outcome = await purchase(product.id);
    if (outcome.status === 'success') playSound('confirm');
    else if (outcome.status === 'failed' || outcome.status === 'unavailable') playSound('unavailable');
  };

  return (
    <Screen scroll>
      <View style={styles.top}>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} style={styles.close}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>

      <RoomScene equipped={{}} theme={theme.id} height={petSize * 1.35}>
        <AnimatedPet speciesId={pet.speciesId} stage={progression.stage} mood="joyful" equipped={NIGHTGLOW.featuredLook} size={petSize} accessibilityLabel={`${pet.name} previewing the Nightglow look in the ${theme.name} room`} />
      </RoomScene>
      <Text style={styles.caption}>
        Preview: {pet.name} in Nightglow, {theme.name}
      </Text>

      <View style={styles.hero}>
        <Text style={styles.kicker}>Focusling Premium</Text>
        <Text style={styles.title} accessibilityRole="header">
          Focus for free.
        </Text>
        <Text style={styles.subtitle}>Make your Focusling’s world bigger with Premium.</Text>
      </View>

      {childView ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your Focusling is complete as it is</Text>
          <Text style={styles.body}>Premium is extra wardrobe and room styles. It’s something a grown-up can look at in the parent area. Nothing here changes how your Focusling grows.</Text>
          <Button label="Back to my Focusling" variant="secondary" onPress={close} />
        </View>
      ) : (
        <>
          <Text style={styles.section}>Nightglow collection</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {NIGHTGLOW_ITEMS.map((item) => (
              <View key={item.id} style={styles.piece} accessible accessibilityLabel={item.name}>
                <ItemArt itemId={item.id} size={52} />
                <Text style={styles.pieceName} numberOfLines={2}>
                  {item.name}
                </Text>
              </View>
            ))}
          </ScrollView>

          <Text style={styles.section}>Room themes</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {ROOM_THEMES.map((t, i) => (
              <Pressable key={t.id} onPress={() => setThemeIndex(i)} sound="select" style={[styles.themeCard, i === themeIndex % ROOM_THEMES.length && styles.themeOn]} accessibilityRole="radio" accessibilityState={{ selected: i === themeIndex % ROOM_THEMES.length }} accessibilityLabel={`Preview ${t.name}`}>
                <RoomScene equipped={{}} theme={t.id} height={84}>
                  <PetArt speciesId={pet.speciesId} stage={progression.stage} mood="content" size={52} />
                </RoomScene>
                <Text style={styles.themeName} numberOfLines={1}>
                  {t.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.section}>Premium Looks</Text>
          <View style={styles.looks}>
            {[{ id: NIGHTGLOW.id, name: 'Nightglow', featuredLook: NIGHTGLOW.featuredLook }, ...PREMIUM_LOOKS].map((look) => (
              <View key={look.id} style={styles.look} accessible accessibilityLabel={`${look.name} look`}>
                <PetArt speciesId={pet.speciesId} stage={progression.stage} mood="content" equipped={look.featuredLook} size={72} />
                <Text style={styles.pieceName}>{look.name}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            {PREMIUM_INCLUDES.map((row) => (
              <View key={row.title} style={styles.row}>
                <PremiumGlyph size={14} />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{row.title}</Text>
                  <Text style={styles.rowBody}>{row.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={[styles.card, styles.freeCard]}>
            <Text style={styles.cardTitle}>Always free</Text>
            {ALWAYS_FREE.map((line) => (
              <View key={line} style={styles.row}>
                <TabIcon name="check" color={colors.success} size={16} />
                <Text style={styles.rowBody}>{line}</Text>
              </View>
            ))}
            <Text style={styles.note}>Premium never changes rewards, growth or focus. It adds things to wear and places to be.</Text>
          </View>

          {active ? (
            <View style={styles.card} accessibilityLiveRegion="polite">
              <Text style={styles.cardTitle}>Premium is active</Text>
              <Text style={styles.body}>
                {entitlement.source === 'devOverride'
                  ? 'Developer override (QA only).'
                  : entitlement.expiresAt
                    ? `${entitlement.willAutoRenew === false ? 'Ends' : 'Renews'} ${new Date(entitlement.expiresAt).toLocaleDateString()}.`
                    : 'Thanks for supporting Focusling.'}
              </Text>
              <Button label="Manage subscription" variant="secondary" onPress={() => void manageSubscription()} />
            </View>
          ) : (
            <View style={styles.card}>
              {debug && studentOffer === 'eligible-mock' && (
                <View style={styles.student}>
                  <Text style={styles.rowTitle}>Student offer (developer demo)</Text>
                  <Text style={styles.rowBody}>How a verified-student offer would appear. Not available to real users; no verification exists yet.</Text>
                </View>
              )}
              {products.length > 0 ? (
                <View style={styles.plans} accessibilityRole="radiogroup">
                  {products.map((p) => {
                    const on = p.id === product?.id;
                    return (
                      <Pressable key={p.id} onPress={() => setSelected(p.id)} sound="select" style={[styles.plan, on && styles.planOn]} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${p.title}, ${p.displayPrice} per ${p.period}`}>
                        <Text style={styles.planTitle}>{p.period === 'year' ? 'Yearly' : p.period === 'month' ? 'Monthly' : p.title}</Text>
                        <Text style={styles.planPrice}>
                          {p.displayPrice}
                          {p.period !== 'unknown' ? ` / ${p.period}` : ''}
                        </Text>
                        {p.introOfferEligible && p.introOfferText ? <Text style={styles.rowBody}>{p.introOfferText}</Text> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.body}>{storeAvailable ? 'Loading subscription options…' : 'Subscriptions aren’t available here right now. You can still preview everything.'}</Text>
              )}
              <Button label={busy ? 'Working…' : 'Subscribe'} sound={null} onPress={() => void subscribe()} disabled={!caps.canPurchase || !product || busy} accessibilityHint="Opens the App Store purchase sheet" />
              {storeKind === 'mock' && <Text style={styles.note}>Preview build: this is a demo store{debug ? ' (Developer tools can simulate purchases)' : ' and nothing can be bought here'}.</Text>}
              <Text style={styles.legal}>
                Payment is charged to your Apple Account. Subscriptions renew automatically unless cancelled at least 24 hours before the end of the current period, and can be managed or cancelled in your Apple Account settings.
              </Text>
            </View>
          )}

          {message ? (
            <Text style={styles.message} accessibilityLiveRegion="polite">
              {message}
            </Text>
          ) : null}

          <View style={styles.links}>
            <Button label="Restore purchases" variant="ghost" onPress={() => void restore()} disabled={busy} />
            {!active && <Button label="Manage subscription" variant="ghost" onPress={() => void manageSubscription()} />}
            <View style={styles.legalRow}>
              <Pressable onPress={() => void Linking.openURL(LEGAL.termsUrl ?? LEGAL.appleStandardEulaUrl)} accessibilityRole="link" accessibilityLabel="Terms of Use" hitSlop={8}>
                <Text style={styles.link}>Terms of Use</Text>
              </Pressable>
              <Text style={styles.dot}>·</Text>
              {LEGAL.privacyPolicyUrl ? (
                <Pressable onPress={() => void Linking.openURL(LEGAL.privacyPolicyUrl!)} accessibilityRole="link" accessibilityLabel="Privacy Policy" hitSlop={8}>
                  <Text style={styles.link}>Privacy Policy</Text>
                </Pressable>
              ) : (
                <Text style={styles.pending}>Privacy Policy (link added before launch)</Text>
              )}
            </View>
            <Button label="Not now" variant="ghost" onPress={close} />
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'flex-end' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 22, fontWeight: '800', color: colors.textMuted },
  caption: { ...typography.label, fontSize: 12, textAlign: 'center', marginTop: -spacing.sm },
  hero: { alignItems: 'center', gap: 2 },
  kicker: { ...typography.label, textTransform: 'uppercase', letterSpacing: 1, color: '#5A3FC0' },
  title: { ...typography.title, fontSize: 30, textAlign: 'center' },
  subtitle: { ...typography.body, fontSize: 18, textAlign: 'center', color: colors.textMuted },
  section: { ...typography.label, textTransform: 'uppercase', letterSpacing: 0.8 },
  strip: { gap: spacing.sm, paddingRight: spacing.lg },
  piece: { width: 84, alignItems: 'center', gap: 4, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: '#E6E4FA' },
  pieceName: { fontSize: 11, fontWeight: '800', color: colors.text, textAlign: 'center' },
  themeCard: { width: 132, gap: 4, borderRadius: radius.md, padding: 3, borderWidth: 2, borderColor: 'transparent' },
  themeOn: { borderColor: '#5A3FC0' },
  themeName: { fontSize: 12, fontWeight: '800', color: colors.text, textAlign: 'center' },
  looks: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  look: { flexGrow: 1, flexBasis: 96, alignItems: 'center', paddingVertical: spacing.xs, borderRadius: radius.md, backgroundColor: colors.surface },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  freeCard: { backgroundColor: colors.successSoft },
  cardTitle: { ...typography.heading, fontSize: 18 },
  body: { ...typography.body, fontSize: 15, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  rowText: { flex: 1, gap: 1 },
  rowTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  rowBody: { fontSize: 14, color: colors.textMuted, flexShrink: 1 },
  note: { ...typography.label, fontWeight: '600', lineHeight: 18 },
  plans: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  plan: { flexGrow: 1, flexBasis: 130, minHeight: 72, padding: spacing.md, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, gap: 2 },
  planOn: { borderColor: '#5A3FC0', backgroundColor: '#F0EBFF' },
  planTitle: { fontSize: 15, fontWeight: '900', color: colors.text },
  planPrice: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  student: { padding: spacing.sm, borderRadius: radius.md, backgroundColor: '#FFF6D6', gap: 2 },
  legal: { fontSize: 11, color: colors.textMuted, lineHeight: 16 },
  message: { ...typography.body, fontSize: 15, textAlign: 'center', color: colors.primaryDark },
  links: { gap: spacing.xs, alignItems: 'stretch' },
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, minHeight: 44 },
  link: { fontSize: 14, fontWeight: '800', color: colors.primaryDark, textDecorationLine: 'underline' },
  pending: { fontSize: 13, color: colors.textMuted },
  dot: { color: colors.textMuted },
});
