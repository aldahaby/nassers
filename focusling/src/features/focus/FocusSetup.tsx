import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { FOCUS_CONFIG } from '@/config/focus';
import type { ProtectionStartError } from '@/core';
import { ProtectionSummaryRow } from '@/features/protection/ProtectionSummaryRow';
import { isSelectiveFailure, startErrorMessage } from '@/features/protection/protectionCopy';
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
  const [error, setError] = useState<ProtectionStartError | 'invalid' | null>(null);
  const [starting, setStarting] = useState(false);
  const updateProtection = useGameStore((s) => s.updateProtection);
  const estimate = useRewardEstimate(minutes);

  if (!view || !estimate) return null;
  const { pet, progression, mood } = view;
  const bonusPct = Math.round((estimate.bonusMultiplier - 1) * 100);

  const start = async () => {
    setStarting(true);
    const result = await startFocus(minutes);
    setStarting(false);
    if (result.ok) return setError(null);
    const e = result.error;
    setError(e === 'invalid-duration' || e === 'session-already-active' || e === 'no-pet' || e === 'no-active-session' ? 'invalid' : e);
  };

  /** Offered only after Reels-only fails; the person chooses, nothing switches silently. */
  const useWholeAppInstead = async () => {
    updateProtection({ mode: 'wholeApp' });
    await start();
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

      <ProtectionSummaryRow />

      {error && (
        <Card style={styles.errorCard}>
          <Text style={styles.errorText}>
            {error === 'invalid' ? 'That session could not start. Try a length between 5 and 180 minutes.' : startErrorMessage(error)}
          </Text>
          {error !== 'invalid' && isSelectiveFailure(error) && (
            <Button label="Block Instagram entirely instead" variant="secondary" onPress={useWholeAppInstead} />
          )}
          {error !== 'invalid' && !isSelectiveFailure(error) && (
            <Button label="Set up protection" variant="secondary" onPress={() => router.push('/protection')} />
          )}
        </Card>
      )}
      <Button
        label={starting ? 'Starting protection…' : 'Start Focus'}
        icon="⏳"
        onPress={() => void start()}
        disabled={starting}
        accessibilityHint={`Starts a ${minutes} minute session`}
      />

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
  errorCard: { gap: spacing.sm },
  errorText: { ...typography.body, fontSize: 15, color: colors.text, textAlign: 'center' },
});
