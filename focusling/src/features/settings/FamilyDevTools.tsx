import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { PLAY_ECONOMY } from '@/config/play';
import { useCurrentMission, useGameStore, usePlayToday } from '@/state';
import { Button } from '@/ui';
import { devStyles as styles } from './devStyles';

/**
 * Developer shortcuts for Family Mode, missions and Play. Only rendered inside
 * DeveloperTools (hidden unless the setting is on); the store refuses these
 * actions when developer tools are off, too.
 */
export function FamilyDevTools() {
  const store = useGameStore.getState();
  const mode = useGameStore((s) => s.save?.mode ?? 'self');
  const hasFamily = useGameStore((s) => Boolean(s.save?.family));
  const hasPin = useGameStore((s) => Boolean(s.save?.family?.gate));
  const familyView = useGameStore((s) => s.familyView);
  const mission = useCurrentMission();
  const play = usePlayToday();
  const [message, setMessage] = useState<string | null>(null);

  const run = (label: string, action: () => void) => () => {
    action();
    setMessage(label);
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.muted}>Family Mode</Text>
      <Text style={styles.status} accessibilityLabel="Family developer status">
        Mode {mode}
        {mode === 'family' ? ` · ${familyView} view · PIN ${hasPin ? 'set' : 'not set'}` : ''}
      </Text>
      <View style={styles.grid}>
        {mode === 'self' ? (
          <Button
            variant="secondary"
            label="Switch to Family"
            onPress={run('Switched to Family Mode (Child View)', () => {
              store.debugSwitchMode('family');
              router.replace('/(child)');
            })}
            style={styles.cell}
          />
        ) : (
          <Button
            variant="secondary"
            label="Switch to Self"
            onPress={run('Switched to Self mode', () => {
              store.debugSwitchMode('self');
              router.replace('/(tabs)');
            })}
            style={styles.cell}
          />
        )}
        {hasFamily && (
          <>
            <Button
              variant="secondary"
              label="Enter Parent View"
              onPress={run('Parent View', () => {
                if (store.debugEnterParentView()) router.replace('/parent');
              })}
              style={styles.cell}
            />
            <Button
              variant="secondary"
              label="Enter Child View"
              onPress={run('Child View', () => {
                store.enterChildView();
                router.replace('/(child)');
              })}
              style={styles.cell}
            />
            <Button variant="secondary" label="Reset Parent PIN" onPress={run('Parent PIN cleared', store.debugResetParentPin)} style={styles.cell} />
          </>
        )}
      </View>

      <Text style={styles.muted}>Missions{mission ? ` · ${mission.mission.title} ${mission.progress}/${mission.target}` : ' · none active'}</Text>
      <View style={styles.grid}>
        <Button
          variant="secondary"
          label="Complete mission"
          disabled={!mission || mission.completed}
          onPress={run('Mission completed', () => mission && store.debugCompleteMission(mission.mission.id))}
          style={styles.cell}
        />
        <Button
          variant="secondary"
          label="One step left"
          disabled={!mission || mission.completed}
          onPress={run('Mission one step from done', () => mission && store.debugMissionAlmostDone(mission.mission.id))}
          style={styles.cell}
        />
        <Button variant="secondary" label="Simulate next day" onPress={run('Moved to the next day', store.debugSimulateNextDay)} style={styles.cell} />
        <Button variant="secondary" label="Reset today's missions" onPress={run("Today's missions reset", store.debugResetTodaysMissions)} style={styles.cell} />
      </View>

      <Text style={styles.muted}>
        Play · {play?.coinsEarned ?? 0}/{PLAY_ECONOMY.dailyCoinCap} coins today{play && !play.access.open ? ' · locked' : ''}
      </Text>
      <View style={styles.grid}>
        <Button variant="secondary" label="+3 play coins" onPress={run('Granted 3 play coins', () => store.debugGrantPlayCoins(3))} style={styles.cell} />
        <Button variant="secondary" label="Cap: 1 left" onPress={run('Play cap set to one coin left', store.debugPlayCapOneLeft)} style={styles.cell} />
        <Button variant="secondary" label="Reset daily play" onPress={run('Daily play rewards reset', store.debugResetDailyPlay)} style={styles.cell} />
        <Button variant="secondary" label="Unlock Play" onPress={run('Play unlocked for today', store.debugUnlockPlay)} style={styles.cell} />
      </View>
      {message && <Text style={styles.muted}>{message}</Text>}
    </View>
  );
}
