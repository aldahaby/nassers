import { useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { FOCUS_CONFIG } from '@/config/focus';
import { useEquipped, useGameStore, usePetView, useRewardEstimate, useDebugToolsEnabled } from '@/state';
import { AnimatedPet, Button, Card, Screen, colors, radius, spacing, typography } from '@/ui';
import { DurationPicker } from './DurationPicker';
import { FocusDevPanel } from './FocusDevPanel';
import { RewardTiles } from './RewardTiles';

/** Choose a length, see what it pays, start. The pet sits at the top, ready to go. */
export function FocusSetup() {
  const view = usePetView();
  const equipped = useEquipped();
  const startFocus = useGameStore((s) => s.startFocus);
  const debug = useDebugToolsEnabled();
  const { width } = useWindowDimensions();

  const [minutes, setMinutes] = useState<number>(FOCUS_CONFIG.defaultMinutes);
  const [custom, setCustom] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const estimate = useRewardEstimate(minutes);

  if (!view || !estimate) return null;
  const { pet, progression, mood } = view;
  const bonusPct = Math.round((estimate.bonusMultiplier - 1) * 100);

  const start = () => {
    const result = startFocus(minutes, []);
    setError(result.ok ? null : 'That session could not start. Try a length between 5 and 180 minutes.');
  };

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <View style={[styles.petStage, { width: Math.min(220, width * 0.55), height: Math.min(220, width * 0.55) }]}>
          <AnimatedPet
            speciesId={pet.speciesId}
            stage={progression.stage}
            mood={mood === 'joyful' ? 'joyful' : 'content'}
            equipped={equipped}
            size={Math.min(170, width * 0.42)}
            accessibilityLabel={`${pet.name} is ready to focus`}
          />
        </View>
        <Text style={styles.title}>Focus with {pet.name}</Text>
        <Text style={styles.subtitle}>Pick a length. {pet.name} will keep you company.</Text>
      </View>

      <DurationPicker
        minutes={minutes}
        custom={custom}
        onSelectPreset={(m) => {
          setCustom(false);
          setMinutes(m);
        }}
        onSelectCustom={() => setCustom(true)}
        onChangeCustom={setMinutes}
      />

      <Card>
        <Text style={styles.cardTitle}>Finish {minutes} minutes to earn</Text>
        <RewardTiles
          tiles={[
            { icon: '🪙', value: `+${estimate.coins}`, label: 'coins', color: colors.coinDark },
            { icon: '✨', value: `+${estimate.xp}`, label: 'XP', color: colors.xp },
            { icon: '💖', value: `+${Math.round(estimate.happinessDelta)}`, label: 'happiness', color: colors.happiness },
          ]}
        />
        <Text style={styles.note}>
          Includes a +{estimate.completionBonusCoins} coin bonus for finishing
          {bonusPct > 0 ? ` and +${bonusPct}% from your streak and items` : ''}.
        </Text>
      </Card>

      {error && <Text style={styles.error}>{error}</Text>}
      <Button label="Start Focus" icon="⏳" onPress={start} accessibilityHint={`Starts a ${minutes} minute session`} />

      {debug && <FocusDevPanel mode="setup" />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.xs },
  petStage: {
    borderRadius: radius.pill,
    backgroundColor: colors.roomWall,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { ...typography.title, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  cardTitle: { ...typography.label, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.8 },
  note: { ...typography.label, fontWeight: '600', textAlign: 'center', lineHeight: 18 },
  error: { ...typography.label, color: colors.danger, textAlign: 'center' },
});
