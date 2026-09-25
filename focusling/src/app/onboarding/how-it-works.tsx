import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { OnboardingStep } from '@/features/onboarding/OnboardingStep';
import { Card, colors, spacing, typography } from '@/ui';

const LOOP = [
  { icon: '⏳', title: 'Focus in real life', body: 'Pick the apps that pull you in and set a focus session.' },
  { icon: '💛', title: 'Your pet benefits', body: 'Every focused minute makes your pet happier, healthier and wiser.' },
  { icon: '🪙', title: 'Earn rewards', body: 'Collect coins and XP. Finish whole sessions for bonuses.' },
  { icon: '🎀', title: 'Make it yours', body: 'Spend coins on food, toys, outfits and room decor.' },
];

export default function HowItWorksScreen() {
  return (
    <OnboardingStep step={2} actionLabel="Choose my pet" onAction={() => router.push('/onboarding/choose')}>
      <Text style={styles.title}>How it works</Text>
      <View style={styles.list}>
        {LOOP.map((item) => (
          <Card key={item.title} style={styles.card}>
            <Text style={styles.icon}>{item.icon}</Text>
            <View style={styles.text}>
              <Text style={typography.heading}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </View>
          </Card>
        ))}
      </View>
      <Text style={styles.note}>Slipped up? No worries: you just earn less that session. Your pet never gets sick.</Text>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, textAlign: 'center' },
  list: { gap: spacing.md },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.md },
  icon: { fontSize: 34 },
  text: { flex: 1, gap: 2 },
  body: { ...typography.body, fontSize: 15, color: colors.textMuted },
  note: { ...typography.label, textAlign: 'center', lineHeight: 19 },
});
