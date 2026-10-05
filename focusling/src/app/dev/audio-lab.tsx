import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SOUND_RULES, SOUNDS, VOICES_PER_CUE, type SoundGroup, type SoundId } from '@/config/sounds';
import { SettingRow } from '@/features/settings/SettingRow';
import { soundService } from '@/services/audio';
import { useDebugToolsEnabled, useGameStore } from '@/state';
import { Pressable, Screen, TabIcon, colors, radius, spacing, typography } from '@/ui';

const GROUPS: readonly { id: SoundGroup; name: string }[] = [
  { id: 'ui', name: 'UI' },
  { id: 'reward', name: 'Rewards' },
  { id: 'focus', name: 'Focus' },
  { id: 'pet', name: 'Pets' },
  { id: 'reaction', name: 'Reaction accents' },
];

/**
 * Developer-only Audio Lab: preview every semantic sound with its asset, length,
 * mix level, status and provenance; test rapid-tap protection; mute. Hidden and
 * route-refused when Developer tools are off. Screens can't prove a sound is
 * pleasant: listen on a real phone.
 */
export default function AudioLab() {
  const debug = useDebugToolsEnabled();
  const settings = useGameStore((s) => s.save?.profile.settings);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const [muted, setMuted] = useState(false);
  const [last, setLast] = useState<string>('');
  if (!debug || !settings) return <Redirect href="/" />;

  const preview = (id: SoundId) => {
    const played = soundService.play(id);
    setLast(`${id}: ${played ? 'played' : 'refused (off, muted, focus rule or rate limit)'}`);
  };
  const rapid = () => {
    let played = 0;
    for (let i = 0; i < 10; i += 1) if (soundService.play('tap')) played += 1;
    setLast(`10 instant taps → ${played} played (rapid-tap protection)`);
  };

  return (
    <Screen scroll width="wide">
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityRole="button" accessibilityLabel="Back">
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>
      <Text style={typography.title}>Audio Lab</Text>
      <Text style={styles.note}>Original placeholder SFX, synthesised by tools/sfx/generate.py. Unit tests check wiring, not taste: judge them on a physical phone.</Text>
      <View style={styles.card}>
        <SettingRow label="Sound Effects" value={settings.soundEnabled} onChange={(v) => updateSettings({ soundEnabled: v })} />
        <SettingRow
          label="Mute all (this session)"
          value={muted}
          onChange={(v) => {
            setMuted(v);
            soundService.update({ enabled: !v && settings.soundEnabled });
          }}
        />
        <View style={styles.actions}>
          <Pressable onPress={rapid} sound={null} style={styles.small} accessibilityRole="button" accessibilityLabel="Rapid tap test">
            <Text style={styles.smallText}>Rapid tap ×10</Text>
          </Pressable>
        </View>
        {last ? <Text style={styles.last} accessibilityLiveRegion="polite">{last}</Text> : null}
      </View>
      {GROUPS.map((g) => (
        <View key={g.id} style={styles.group}>
          <Text style={styles.h}>{g.name}</Text>
          {SOUNDS.filter((s) => s.group === g.id).map((s) => (
            <View key={s.id} style={styles.row}>
              <Pressable onPress={() => preview(s.id)} sound={null} style={styles.play} accessibilityRole="button" accessibilityLabel={`Play ${s.label}`}>
                <TabIcon name="sound" color={colors.white} size={20} />
              </Pressable>
              <View style={styles.meta}>
                <Text style={styles.name}>{s.label}</Text>
                <Text style={styles.detail}>
                  {s.id} · assets/sfx/{s.file}.wav · {s.durationMs} ms · level {Math.round(s.volume * 100)}% · retrigger ≥{s.retriggerMs ?? SOUND_RULES.retriggerMs} ms · {VOICES_PER_CUE} voice · {s.status}
                </Text>
                <Text style={styles.feeling}>{s.feeling}</Text>
              </View>
            </View>
          ))}
        </View>
      ))}
      <Text style={styles.note}>Provenance: {SOUNDS[0]!.provenance}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { ...typography.label, fontSize: 16, color: colors.primaryDark },
  note: { ...typography.label, fontWeight: '600', lineHeight: 19 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm },
  small: { minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.primarySoft, justifyContent: 'center' },
  smallText: { fontWeight: '800', color: colors.primaryDark },
  last: { ...typography.label },
  group: { gap: spacing.xs },
  h: { ...typography.heading, fontSize: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm },
  play: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  meta: { flex: 1, gap: 1 },
  name: { ...typography.body, fontWeight: '800' },
  detail: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  feeling: { fontSize: 12, color: colors.text, fontStyle: 'italic' },
});
