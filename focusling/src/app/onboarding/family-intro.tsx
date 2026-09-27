import { Redirect, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { OnboardingStep } from '@/features/onboarding/OnboardingStep';
import { useOnboardingProgress } from '@/features/onboarding/flow';
import { useGameStore } from '@/state';
import { AnimatedPet, Card, colors, spacing, typography } from '@/ui';

const POINTS = [
  { icon: '🔒', text: 'A parent PIN keeps settings in the grown-up area.' },
  { icon: '🎯', text: 'You pick missions, like 45 minutes of homework focus.' },
  { icon: '🐾', text: 'Your child sees only their pet, missions, games and shop.' },
  { icon: '📱', text: 'Everything stays on this device. No accounts, no tracking, no messages read.' },
];

export default function FamilyIntroScreen() {
  const family = useGameStore((s) => s.save?.mode === 'family');
  const progress = useOnboardingProgress('family-intro');
  if (!family) return <Redirect href="/onboarding/who" />;

  return (
    <OnboardingStep {...progress} actionLabel="Create a parent PIN" onAction={() => router.push('/onboarding/family-pin')}>
      <View style={styles.hero}>
        <AnimatedPet speciesId="cloudling" stage="young" mood="joyful" size={130} />
        <Text style={styles.title}>You set the boundaries</Text>
        <Text style={styles.body}>Their Focusling turns healthy screen habits into pet progress and rewards.</Text>
      </View>
      <Card style={styles.card}>
        {POINTS.map((p) => (
          <View key={p.icon} style={styles.row}>
            <Text style={styles.icon}>{p.icon}</Text>
            <Text style={styles.point}>{p.text}</Text>
          </View>
        ))}
      </Card>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.md },
  title: { ...typography.title, textAlign: 'center' },
  body: { ...typography.body, color: colors.textMuted, textAlign: 'center', lineHeight: 24 },
  card: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  icon: { fontSize: 22, width: 28 },
  point: { ...typography.body, fontSize: 15, flex: 1, lineHeight: 21 },
});
