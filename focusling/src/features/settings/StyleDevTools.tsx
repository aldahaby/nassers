import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { COLLECTION_LIST } from '@/config/collections';
import { PET_SPECIES, STARTER_SPECIES_ORDER } from '@/config/pets';
import type { GrowthStage } from '@/core';
import { useGameStore } from '@/state';
import { Button } from '@/ui';
import { devStyles as styles } from './devStyles';

const STAGES: readonly GrowthStage[] = ['baby', 'young', 'adult', 'evolved'];

/**
 * Style system shortcuts for QA. Only rendered inside DeveloperTools (hidden
 * unless the setting is on); the store refuses these when it's off, too.
 */
export function StyleDevTools() {
  const store = useGameStore.getState();
  const [message, setMessage] = useState<string | null>(null);
  const run = (label: string, action: () => void) => () => {
    action();
    setMessage(label);
  };
  const newCollections = COLLECTION_LIST.filter((c) => c.id !== 'focus-club');

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.muted}>Style · collections</Text>
      {newCollections.map((c) => (
        <View key={c.id} style={{ gap: 4 }}>
          <Text style={styles.status}>{c.name}</Text>
          <View style={styles.grid}>
            <Button variant="secondary" label="Unlock all" onPress={run(`${c.name} unlocked`, () => store.debugUnlockCollection(c.id))} style={styles.cell} />
            <Button variant="secondary" label="One short" onPress={run(`${c.name}: one piece left (a coin piece)`, () => store.debugCollectionAlmostDone(c.id))} style={styles.cell} />
            <Button variant="secondary" label="Wear look" onPress={run(`Wearing the ${c.name} look`, () => store.debugWearCollectionLook(c.id))} style={styles.cell} />
          </View>
        </View>
      ))}
      <View style={styles.grid}>
        <Button variant="secondary" label="Reset collections" onPress={run('Midnight Arcade, Dreamwave and Cloud Racer locked again', store.debugResetCollections)} style={styles.cell} />
        <Button variant="secondary" label="Clear outfit" onPress={run('Outfit cleared', store.debugClearOutfit)} style={styles.cell} />
        <Button variant="secondary" label="Trigger reveal" onPress={run('Reveal shown', () => store.debugTriggerReveal(['ma-visor', 'dw-shades']))} style={styles.cell} />
        <Button variant="secondary" label="Trigger completion" onPress={run('Completion shown', () => store.debugTriggerCollectionComplete('midnight-arcade'))} style={styles.cell} />
        <Button variant="secondary" label="Unlock reactions" onPress={run('All reactions unlocked', store.debugUnlockReactions)} style={styles.cell} />
        <Button variant="secondary" label="Preview reactions" onPress={() => router.push('/wardrobe?tab=reactions' as Href)} style={styles.cell} />
      </View>
      <Text style={styles.muted}>Style · fit QA</Text>
      <View style={styles.grid}>
        {STAGES.map((stage) => (
          <Button key={stage} variant="secondary" label={stage[0]!.toUpperCase() + stage.slice(1)} onPress={run(`Stage: ${stage}`, () => store.debugSetStage(stage))} style={styles.cell} />
        ))}
      </View>
      <View style={styles.grid}>
        {STARTER_SPECIES_ORDER.map((species) => (
          <Button key={species} variant="secondary" label={PET_SPECIES[species].name} onPress={run(`Species: ${species}`, () => store.debugSetSpecies(species))} style={styles.cell} />
        ))}
        <Button variant="secondary" label="Open Fit Lab" onPress={() => router.push('/dev/fit-lab' as Href)} style={styles.cell} />
        <Button variant="secondary" label="Character Lab" onPress={() => router.push('/dev/character-lab' as Href)} style={styles.cell} />
        <Button variant="secondary" label="Audio Lab" onPress={() => router.push('/dev/audio-lab' as Href)} style={styles.cell} />
      </View>
      {message && <Text style={styles.muted}>{message}</Text>}
    </View>
  );
}
