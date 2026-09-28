import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { CHILD_NICKNAME_MAX_LENGTH } from '@/config/family';
import type { PlayAccess } from '@/core';
import { ParentHeader } from '@/features/family/ParentHeader';
import { PinPad } from '@/features/family/PinPad';
import { DeveloperTools } from '@/features/settings/DeveloperTools';
import { ResetCard } from '@/features/settings/ResetCard';
import { SettingRow } from '@/features/settings/SettingRow';
import { useGameStore } from '@/state';
import { Button, Card, Screen, colors, radius, spacing, typography, Pressable } from '@/ui';

const PLAY_OPTIONS: readonly { value: PlayAccess; title: string; body: string }[] = [
  { value: 'always', title: 'Always available', body: 'Games can be played any time.' },
  { value: 'afterMission', title: 'After completing a mission', body: 'Play unlocks for the day once a mission is done.' },
];

export default function ParentSettingsScreen() {
  const family = useGameStore((s) => s.save?.family);
  const settings = useGameStore((s) => s.save?.profile.settings);
  const petName = useGameStore((s) => s.save?.pet?.name ?? 'the pet');
  const { setChildNickname, updatePlaySettings, updateSettings, enterChildView } = useGameStore.getState();
  const [nickname, setNickname] = useState(family?.child.nickname ?? '');
  const [saved, setSaved] = useState<string | null>(null);
  if (!family || !settings) return null;

  const saveNickname = () => {
    if (!nickname.trim()) return;
    setChildNickname(nickname);
    setSaved('Nickname saved.');
  };

  return (
    <Screen scroll>
      <ParentHeader title="Parent settings" />

      <Card>
        <Text style={typography.heading}>Child</Text>
        <Text style={styles.muted}>Only a nickname is stored, on this device.</Text>
        <View style={styles.inline}>
          <TextInput
            value={nickname}
            onChangeText={setNickname}
            maxLength={CHILD_NICKNAME_MAX_LENGTH}
            style={styles.input}
            accessibilityLabel="Child nickname"
            autoComplete="off"
          />
          <Button variant="secondary" label="Save" onPress={saveNickname} disabled={!nickname.trim()} />
        </View>
        {saved && <Text style={styles.saved}>{saved}</Text>}
      </Card>

      <Card>
        <Text style={typography.heading}>Play</Text>
        <Text style={styles.muted}>Calm mini-games with {petName}. Play coins are capped each day either way.</Text>
        <View style={styles.options} accessibilityRole="radiogroup">
          {PLAY_OPTIONS.map((option) => {
            const selected = family.play.access === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => updatePlaySettings({ access: option.value })}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${option.title}. ${option.body}`}
                style={[styles.option, selected && styles.optionOn]}
              >
                <View style={[styles.radio, selected && styles.radioOn]} />
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.muted}>{option.body}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <ChangePinCard />

      <Card>
        <Text style={typography.heading}>Protection</Text>
        <Text style={styles.muted}>Choose what protection runs during focus sessions.</Text>
        <Button variant="secondary" label="Protection settings" onPress={() => router.push('/protection')} />
      </Card>

      <Card>
        <SettingRow label="Haptics" value={settings.hapticsEnabled} onChange={(v) => updateSettings({ hapticsEnabled: v })} />
        <SettingRow label="Sound Effects" value={settings.soundEnabled} onChange={(v) => updateSettings({ soundEnabled: v })} />
        <SettingRow label="Developer tools" value={settings.debugToolsEnabled} onChange={(v) => updateSettings({ debugToolsEnabled: v })} />
      </Card>

      {settings.debugToolsEnabled && <DeveloperTools />}
      <ResetCard />
      <Button
        icon="🐾"
        label="Back to Child View"
        onPress={() => {
          enterChildView();
          router.dismissTo('/(child)');
        }}
      />
    </Screen>
  );
}

/** Change the parent PIN: current PIN first, then the new one twice. */
function ChangePinCard() {
  const { unlockParentView, setParentPin } = useGameStore.getState();
  const [step, setStep] = useState<'idle' | 'current' | 'new' | 'confirm'>('idle');
  const [value, setValue] = useState('');
  const [first, setFirst] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const onComplete = (pin: string) => {
    setValue('');
    if (step === 'current') {
      const result = unlockParentView(pin);
      if (result.ok) {
        setStep('new');
        setMessage(null);
      } else {
        setMessage(result.reason === 'locked' ? 'Too many tries. Please wait a moment.' : "That PIN isn't right.");
      }
    } else if (step === 'new') {
      setFirst(pin);
      setStep('confirm');
    } else if (step === 'confirm') {
      if (pin !== first) {
        setStep('new');
        setMessage("Those didn't match. Enter the new PIN again.");
        return;
      }
      setParentPin(pin);
      setStep('idle');
      setMessage('Parent PIN changed.');
    }
  };

  const prompt = { current: 'Enter the current PIN', new: 'Enter a new PIN', confirm: 'Enter the new PIN again', idle: '' }[step];

  return (
    <Card>
      <Text style={typography.heading}>Parent PIN</Text>
      <Text style={styles.muted}>Stored on this device as a salted hash, never as the digits. It keeps curious hands out; it isn’t a replacement for device-level parental controls.</Text>
      {step === 'idle' ? (
        <Button variant="secondary" label="Change PIN" onPress={() => setStep('current')} />
      ) : (
        <View style={styles.pin}>
          <Text style={styles.optionTitle}>{prompt}</Text>
          <PinPad value={value} onChange={setValue} onComplete={onComplete} />
          <Button variant="ghost" label="Cancel" onPress={() => { setStep('idle'); setValue(''); setMessage(null); }} />
        </View>
      )}
      {message && (
        <Text style={styles.saved} accessibilityLiveRegion="polite">
          {message}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  muted: { ...typography.body, fontSize: 14, color: colors.textMuted },
  inline: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    minHeight: 50,
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  saved: { ...typography.label, color: colors.primaryDark },
  options: { gap: spacing.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border },
  radioOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  optionText: { flex: 1, gap: 2 },
  optionTitle: { ...typography.body, fontWeight: '800' },
  pin: { alignItems: 'center', gap: spacing.md },
});
