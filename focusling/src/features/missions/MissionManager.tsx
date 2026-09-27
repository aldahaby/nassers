import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MISSION_PRESETS } from '@/config/missions';
import { draftFromMission, draftFromPreset, type MissionDraft } from '@/core';
import { useGameStore, useMissionViews } from '@/state';
import { Button, colors, spacing, typography } from '@/ui';
import { EMPTY_DRAFT, MissionEditor } from './MissionEditor';
import { MissionCard } from './MissionCard';
import { PresetOption } from './PresetOption';

type Editing = { kind: 'new'; draft: MissionDraft } | { kind: 'edit'; id: string; draft: MissionDraft } | null;

interface Props {
  /** Copy tweaks: a parent manages their child's missions; self users manage their own. */
  audience: 'parent' | 'self';
}

/** Mission management: current missions with pause/edit/remove, templates, and a custom editor. */
export function MissionManager({ audience }: Props) {
  const views = useMissionViews();
  const { addMission, updateMission, setMissionActive, removeMission } = useGameStore.getState();
  const [editing, setEditing] = useState<Editing>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const usedPresets = new Set(views.map((v) => v.mission.presetId).filter(Boolean));

  const submit = (draft: MissionDraft) => {
    if (!editing) return null;
    const result = editing.kind === 'edit' ? updateMission(editing.id, draft) : addMission(draft);
    if (!result.ok) return result.error;
    setNotice(editing.kind === 'edit' ? `Saved “${draft.title.trim()}”.` : `Added “${draft.title.trim()}”.`);
    setEditing(null);
    return null;
  };

  const addPreset = (presetId: string) => {
    const preset = MISSION_PRESETS.find((p) => p.id === presetId);
    if (!preset?.available) return;
    const result = addMission(draftFromPreset(preset));
    setNotice(result.ok ? `Added “${preset.title}”.` : 'You already have the most active missions allowed. Pause one first.');
  };

  if (editing) {
    return (
      <MissionEditor
        initial={editing.draft}
        submitLabel={editing.kind === 'edit' ? 'Save' : 'Add mission'}
        onSubmit={submit}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <View style={styles.wrap}>
      {notice && (
        <Text style={styles.notice} accessibilityLiveRegion="polite">
          {notice}
        </Text>
      )}
      <Text style={styles.section}>{audience === 'parent' ? 'Their missions' : 'Your missions'}</Text>
      {views.length === 0 && (
        <Text style={styles.muted}>No missions yet. Pick a template below or make your own.</Text>
      )}
      {views.map((view) => (
        <View key={view.mission.id} style={styles.item}>
          <MissionCard view={view} />
          <View style={styles.row}>
            <Button
              variant="secondary"
              label="Edit"
              onPress={() => setEditing({ kind: 'edit', id: view.mission.id, draft: draftFromMission(view.mission) })}
              style={styles.cell}
            />
            <Button
              variant="secondary"
              label={view.mission.active ? 'Pause' : 'Resume'}
              onPress={() => setMissionActive(view.mission.id, !view.mission.active)}
              style={styles.cell}
            />
            {confirmRemove === view.mission.id ? (
              <Button
                variant="danger"
                label="Remove?"
                onPress={() => {
                  removeMission(view.mission.id);
                  setConfirmRemove(null);
                }}
                style={styles.cell}
              />
            ) : (
              <Button variant="ghost" label="Remove" onPress={() => setConfirmRemove(view.mission.id)} style={styles.cell} />
            )}
          </View>
        </View>
      ))}

      <Text style={styles.section}>Add a mission</Text>
      <Button variant="secondary" icon="✏️" label="Create a custom mission" onPress={() => setEditing({ kind: 'new', draft: EMPTY_DRAFT })} />
      <View style={styles.presets}>
        {MISSION_PRESETS.map((preset) => (
          <PresetOption
            key={preset.id}
            preset={preset}
            actionLabel={usedPresets.has(preset.id) ? 'Add again' : 'Add'}
            onPress={() => addPreset(preset.id)}
          />
        ))}
      </View>
      <Text style={styles.muted}>
        Missions count successful focus sessions only. Missing one never costs coins or pet happiness.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  section: { ...typography.heading, marginTop: spacing.sm },
  muted: { ...typography.body, fontSize: 14, color: colors.textMuted },
  notice: { ...typography.label, color: '#1F8A55' },
  item: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { flexGrow: 1, flexBasis: 90 },
  presets: { gap: spacing.md },
});
