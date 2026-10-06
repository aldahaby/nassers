import { router, type Href } from 'expo-router';
import { useEffect, useReducer, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { REVISED } from '@/core/planner/fixtures/syllabi';
import { buildWidgetSnapshot, effectiveSupport, FIELD_CLASSIFICATION, liveActivityContent, nextPlan, WIDGET_SNAPSHOT_KEYS, type SupportLevel, type SupportObservation } from '@/core';
import { LiveActivityMock, MediumWidgetMock, MockLabel, SmallWidgetMock } from '@/features/planner/MockWidgets';
import { SectionTitle } from '@/features/planner/PlannerBits';
import { PlannerScreen } from '@/features/planner/PlannerScreen';
import { formatClock, formatDay } from '@/features/planner/plannerCopy';
import { buildScenario, QA_SCENARIOS } from '@/features/planner/qaFixtures';
import { useAppRoutes } from '@/hooks/useAppRoutes';
import { useNow } from '@/hooks/useNow';
import { appClock, MockNotificationService, MockProtectionService, MockStudyWidgetBridge, services } from '@/services';
import { useDebugToolsEnabled, useGameStore, usePlannerStore } from '@/state';
import { Button, Card, colors, radius, spacing, typography } from '@/ui';

const HOUR = 3_600_000;

/**
 * Planner QA (Developer tools only): simulated time, semester scenarios,
 * mock notifications / widget / Live Activity, protection success and
 * failure, reminder-support states, and the privacy inspector.
 */
export default function PlannerQA() {
  const debug = useDebugToolsEnabled();
  const planner = usePlannerStore((s) => s.planner);
  const active = useGameStore((s) => s.save?.focus.active ?? null);
  const pet = useGameStore((s) => s.save?.pet ?? null);
  const now = useNow(1000);
  const routes = useAppRoutes();
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const [banner, setBanner] = useState<{ key: string; title: string; body: string; suppressed: boolean } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const mockNotes = services.notifications instanceof MockNotificationService ? services.notifications : null;
  const mockProtection = services.protection instanceof MockProtectionService ? services.protection : null;
  const mockWidgets = services.widgets instanceof MockStudyWidgetBridge ? services.widgets : null;
  useEffect(() => mockWidgets?.subscribe(rerender), [mockWidgets]);

  if (!debug || !planner) {
    return (
      <PlannerScreen title="Planner QA">
        <Card>
          <Text style={styles.body}>Turn on Developer tools in Settings to use Planner QA.</Text>
        </Card>
      </PlannerScreen>
    );
  }
  const store = usePlannerStore.getState();
  const tz = planner.preferences.timezone;
  const next = nextPlan(planner, now);
  const setTime = (t: number) => {
    appClock.setTime(t, debug);
    void store.refresh();
  };
  const say = (m: string) => setMessage(m);

  const forceLevel = (level: SupportLevel) => {
    store.debugReplace({ ...planner, progress: { ...planner.progress, supportLevel: level, supportChangedAt: now, supportReason: `Set to ${level} in Planner QA.`, recoveryOffer: 'none' } }, debug);
    say(`Reminder support set to ${level}.`);
  };
  const addObservations = (kind: 'independent' | 'missed') => {
    const start = now - 9 * 24 * HOUR;
    const obs: SupportObservation[] = Array.from({ length: kind === 'independent' ? 4 : 3 }, (_, i) => ({
      planId: `qa-obs-${now}-${i}`,
      plannedStartAt: start + i * 24 * HOUR,
      started: kind === 'independent' || i === 0,
      onTime: kind === 'independent' || i === 0,
      independent: kind === 'independent',
    }));
    store.debugReplace({ ...planner, progress: { ...planner.progress, supportChangedAt: start - HOUR, observations: [...planner.progress.observations, ...obs] } }, debug);
    void store.refresh();
    say(kind === 'independent' ? 'Added 4 on-time, independent starts.' : 'Added 3 recent plans, 2 missed.');
  };

  const fireNext = () => {
    if (!mockNotes) return say('Real notifications are scheduled with the OS on this device.');
    const n = mockNotes.next();
    if (!n) return say('No reminder is pending. Turn reminders on and accept a plan inside the next 72 hours.');
    setTime(n.fireAt);
    const shown = mockNotes.deliver(n.osId, n.fireAt);
    setBanner({ key: n.key, title: n.title, body: n.body, suppressed: !shown });
  };

  const snapshot = buildWidgetSnapshot(planner, now, { activeSession: active ? { endsAt: active.startedAt + active.plannedDurationMinutes * 60_000, protection: active.study?.protectionResult ?? 'unknown' } : null, pet: pet ? { speciesId: pet.speciesId, stage: 'baby' } : null });
  const privateSnap = buildWidgetSnapshot({ ...planner, preferences: { ...planner.preferences, lockScreenDetail: 'private' } }, now, { activeSession: null, pet: snapshot.pet });
  const detailedSnap = buildWidgetSnapshot({ ...planner, preferences: { ...planner.preferences, lockScreenDetail: 'detailed' } }, now, { activeSession: null, pet: snapshot.pet });
  const sessionForActivity = active ?? (next ? { startedAt: next.plannedStartAt, plannedDurationMinutes: next.plannedMinutes, study: { courseId: next.courseId, assignmentId: next.assignmentId, protectionResult: 'failed' as const } } : null);
  const activityFor = (detail: 'private' | 'detailed') =>
    sessionForActivity
      ? liveActivityContent({ ...planner, preferences: { ...planner.preferences, lockScreenDetail: detail } }, {
          endsAt: sessionForActivity.startedAt + sessionForActivity.plannedDurationMinutes * 60_000,
          plannedMinutes: sessionForActivity.plannedDurationMinutes,
          courseId: sessionForActivity.study?.courseId,
          assignmentId: sessionForActivity.study?.assignmentId,
          protection: sessionForActivity.study?.protectionResult ?? 'unknown',
        })
      : null;

  return (
    <PlannerScreen title="Planner QA" subtitle="Developer · simulated time and mock services" width="wide">
      <Card>
        <Text style={styles.title}>
          Simulated time: {formatDay(now, tz)} {formatClock(now, tz)} {appClock.offset() ? '(shifted)' : '(real)'}
        </Text>
        <View style={styles.row}>
          <Button label="+1 hour" variant="secondary" onPress={() => setTime(now + HOUR)} style={styles.flex} />
          <Button label="+1 day" variant="secondary" onPress={() => setTime(now + 24 * HOUR)} style={styles.flex} />
          <Button
            label="Real time"
            variant="ghost"
            onPress={() => {
              appClock.setOffset(0, debug);
              void store.refresh();
            }}
            style={styles.flex}
          />
        </View>
        {message && (
          <Text style={styles.message} accessibilityLiveRegion="polite">
            {message}
          </Text>
        )}
      </Card>

      <SectionTitle>Scenarios</SectionTitle>
      <Card>
        <View style={styles.row}>
          {QA_SCENARIOS.map((s) => (
            <Button
              key={s.id}
              label={s.label}
              variant="secondary"
              onPress={() => {
                const built = buildScenario(s.id, planner);
                appClock.setTime(built.now, debug);
                store.debugReplace(built.state, debug);
                say(`Loaded "${s.label}".`);
              }}
              style={styles.flex}
            />
          ))}
          <Button
            label="Assignment date changes"
            variant="secondary"
            onPress={() => {
              store.importText(REVISED.text, 'pdf', { filename: 'revised.pdf' });
              const r = usePlannerStore.getState().commitDraft(false);
              say(r ? 'Applied the revised syllabus (dates moved, stale plans cancelled).' : 'Nothing to apply.');
            }}
            style={styles.flex}
          />
          <Button label="Clear planner" variant="ghost" onPress={() => void store.reset()} style={styles.flex} />
        </View>
      </Card>

      <SectionTitle>Permissions & protection</SectionTitle>
      <Card>
        <View style={styles.row}>
          <Button
            label="Notifications: next answer denied"
            variant="secondary"
            onPress={() => {
              if (mockNotes) {
                mockNotes.permission = 'undetermined';
                mockNotes.nextAnswer = 'denied';
              }
              store.updatePreferences({ remindersEnabled: false, notificationPermission: 'unknown' });
              say('Next permission prompt will be denied. Turn reminders on to see it.');
            }}
            style={styles.flex}
          />
          <Button
            label="Notifications: allow"
            variant="secondary"
            onPress={() => {
              if (mockNotes) {
                mockNotes.permission = 'undetermined';
                mockNotes.nextAnswer = 'granted';
              }
              void store.enableReminders().then((p) => say(`Reminders ${p === 'granted' ? 'on' : p}.`));
            }}
            style={styles.flex}
          />
          <Button
            label="Protection success"
            variant="secondary"
            onPress={async () => {
              await services.protection.requestAuthorization();
              await services.protection.selectApps();
              useGameStore.getState().updateProtection({ mode: 'wholeApp' });
              await useGameStore.getState().refreshProtection?.();
              say('Protection ready (simulated on this device).');
            }}
            style={styles.flex}
          />
          <Button
            label="Protection denied"
            variant="secondary"
            onPress={() => {
              mockProtection?.simulateAuthorizationRevoked();
              useGameStore.getState().updateProtection({ mode: 'wholeApp' });
              say('Screen Time access denied: the next Start & Lock runs unprotected and says so.');
            }}
            style={styles.flex}
          />
        </View>
      </Card>

      <SectionTitle>Reminder support</SectionTitle>
      <Card>
        <Text style={styles.body}>
          Adaptive level: {planner.progress.supportLevel} · effective: {effectiveSupport(planner.progress, planner.preferences.reminderPreference)} · preference: {planner.preferences.reminderPreference} · policy {planner.progress.policyVersion}
          {planner.progress.recoveryOffer === 'pending' ? ' · help offer pending' : ''}
        </Text>
        <View style={styles.row}>
          {(['standard', 'light', 'ambient'] as const).map((l) => (
            <Button key={l} label={l[0]!.toUpperCase() + l.slice(1)} variant="secondary" onPress={() => forceLevel(l)} style={styles.flex} />
          ))}
          <Button label="4 independent starts" variant="secondary" onPress={() => addObservations('independent')} style={styles.flex} />
          <Button label="Missed starts" variant="secondary" onPress={() => addObservations('missed')} style={styles.flex} />
        </View>
      </Card>

      <SectionTitle>Actions</SectionTitle>
      <Card>
        <Text style={styles.body}>
          Next plan: {next ? `${formatDay(next.plannedStartAt, tz, now)} ${formatClock(next.plannedStartAt, tz)} · ${next.plannedMinutes} min` : 'none'} · pending reminders: {Object.keys(planner.scheduledReminders).length}
          {active ? ' · session running' : ''}
        </Text>
        <View style={styles.row}>
          <Button label="Fire next reminder" variant="secondary" onPress={fireNext} style={styles.flex} />
          <Button
            label="Start from widget"
            variant="secondary"
            onPress={async () => {
              if (!next) return say('No plan to start.');
              const r = await store.startPlan(next.id, 'widget');
              say(r.ok ? `Started from widget · protection: ${r.value.protection}` : `Not started: ${r.error}`);
            }}
            style={styles.flex}
          />
          <Button
            label="Complete session"
            variant="secondary"
            onPress={() => {
              const r = useGameStore.getState().endFocus('completed');
              say(r.ok ? 'Session completed.' : 'No session running.');
            }}
            style={styles.flex}
          />
          <Button
            label="End early"
            variant="secondary"
            onPress={() => {
              const r = useGameStore.getState().endFocus('abandoned');
              say(r.ok ? 'Session ended early.' : 'No session running.');
            }}
            style={styles.flex}
          />
          <Button label="Trigger retrieval" variant="secondary" onPress={() => (planner.pendingRetrieval ? router.push('/planner/retrieval' as Href) : say('No retrieval offer pending (complete an eligible session first).'))} style={styles.flex} />
        </View>
        {banner && (
          <View style={styles.banner} accessible accessibilityLabel={`Mock notification: ${banner.title}. ${banner.body}`}>
            <MockLabel />
            {banner.suppressed ? (
              <Text style={styles.body}>Delivered while a study session was running, so it stayed silent and hidden.</Text>
            ) : (
              <>
                <Text style={styles.bannerTitle}>{banner.title}</Text>
                <Text style={styles.body}>{banner.body}</Text>
                <View style={styles.row}>
                  <Button
                    label="Start & Lock"
                    sound={null}
                    onPress={() => {
                      mockNotes?.respond(banner.key, 'start');
                      setBanner(null);
                    }}
                    style={styles.flex}
                  />
                  <Button label="Dismiss" variant="ghost" onPress={() => setBanner(null)} style={styles.flex} />
                </View>
              </>
            )}
          </View>
        )}
        <Button label="Open Focus" variant="ghost" onPress={() => router.navigate(routes.focus)} />
      </Card>

      <SectionTitle>Widget & Live Activity (mock)</SectionTitle>
      <Card>
        <MockLabel />
        <Text style={styles.muted}>Detailed lock-screen mode</Text>
        <View style={styles.row}>
          <SmallWidgetMock snap={detailedSnap} />
          <MediumWidgetMock snap={detailedSnap} />
        </View>
        <Text style={styles.muted}>Private mode</Text>
        <View style={styles.row}>
          <SmallWidgetMock snap={privateSnap} />
          <MediumWidgetMock snap={privateSnap} />
        </View>
        {activityFor('detailed') && (
          <>
            <Text style={styles.muted}>Live Activity · detailed / private</Text>
            <LiveActivityMock content={activityFor('detailed')!} now={now} />
            <LiveActivityMock content={activityFor('private')!} now={now} />
          </>
        )}
        <Text style={styles.muted}>Bridge: {services.widgets.kind}{mockWidgets?.activity ? ` · activity running (${mockWidgets.activity.updates} updates)` : ''}</Text>
      </Card>

      <SectionTitle>Privacy inspector</SectionTitle>
      <Card>
        {FIELD_CLASSIFICATION.map((f) => (
          <View key={f.field} style={styles.privacyRow}>
            <Text style={styles.privacyField}>{f.field}</Text>
            <Text style={styles.privacyClass}>{f.classes.join(' · ')}</Text>
            <Text style={styles.muted}>{f.note}</Text>
          </View>
        ))}
        <Text style={styles.muted}>Widget snapshot keys ({WIDGET_SNAPSHOT_KEYS.length}): {WIDGET_SNAPSHOT_KEYS.join(', ')}</Text>
        <Text style={styles.mono}>{JSON.stringify(snapshot)}</Text>
      </Card>

      <SectionTitle>Recent events (local only)</SectionTitle>
      <Card>
        {planner.events.slice(-14).reverse().map((e) => (
          <Text key={e.id} style={styles.mono}>
            {formatClock(e.at, tz)} {e.type}
            {e.data ? ` ${Object.entries(e.data).map(([k, v]) => `${k}=${v}`).join(' ')}` : ''}
          </Text>
        ))}
      </Card>
    </PlannerScreen>
  );
}

const styles = StyleSheet.create({
  body: { ...typography.body, fontSize: 14, lineHeight: 20 },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  muted: { ...typography.label, lineHeight: 18 },
  message: { fontSize: 14, fontWeight: '700', color: colors.primaryDark },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  flex: { flexGrow: 1, flexBasis: 150 },
  banner: { backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  bannerTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
  privacyRow: { gap: 2, borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.sm },
  privacyField: { fontSize: 14, fontWeight: '800', color: colors.text },
  privacyClass: { fontSize: 12, fontWeight: '900', color: colors.primaryDark, letterSpacing: 0.4 },
  mono: { fontSize: 11, fontFamily: 'monospace', color: colors.textMuted },
});
