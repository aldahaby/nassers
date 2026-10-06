import { StyleSheet, Text, View } from 'react-native';
import type { LiveActivityContent, WidgetSnapshot } from '@/core';
import { PetArt, colors, radius, spacing } from '@/ui';
import { formatMinutes } from './plannerCopy';

/**
 * WEB MOCKS of the iOS widget and Live Activity designs, drawn from the same
 * minimal snapshot the native extension reads. Clearly labelled: these are
 * not screenshots of a running device.
 */
const clock = (ts: number | null, tz?: string) =>
  ts ? new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', ...(tz ? { timeZone: tz } : {}) }) : '—';

export function MockLabel() {
  return <Text style={styles.mock}>MOCK · design preview, not running on a device</Text>;
}

export function SmallWidgetMock({ snap }: { snap: WidgetSnapshot }) {
  const course = snap.courseDisplayName ?? (snap.nextPlanId ? 'Study block' : 'Nothing planned');
  return (
    <View style={[styles.widget, styles.small]} accessible accessibilityLabel={`Small widget mock. Studyling. ${course}. ${snap.plannedStart ? clock(snap.plannedStart) : ''}. Start.`}>
      <View style={styles.headRow}>
        <Text style={styles.brand}>Studyling</Text>
        {snap.pet && <PetArt speciesId={snap.pet.speciesId} stage={snap.pet.stage} mood="content" size={26} />}
      </View>
      <Text style={styles.course} numberOfLines={1}>
        {course}
      </Text>
      <Text style={styles.time}>{snap.activeSession ? `Until ${clock(snap.activeSession.endsAt)}` : clock(snap.plannedStart)}</Text>
      <View style={styles.cta}>
        <Text style={styles.ctaText}>{snap.activeSession ? 'Studying' : 'Start'}</Text>
      </View>
    </View>
  );
}

export function MediumWidgetMock({ snap }: { snap: WidgetSnapshot }) {
  const title = snap.assignmentDisplayTitle ?? (snap.nextPlanId ? 'Study session' : 'Nothing planned');
  return (
    <View style={[styles.widget, styles.medium]} accessible accessibilityLabel={`Medium widget mock. ${title}. ${snap.plannedMinutes ?? 0} minutes. Today ${snap.todayPlanCount} blocks. Start and Lock.`}>
      <View style={styles.flex}>
        <Text style={styles.brand}>Studyling</Text>
        {snap.courseDisplayName && <Text style={styles.sub}>{snap.courseDisplayName}</Text>}
        <Text style={styles.course} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.sub}>
          {snap.plannedMinutes ? `${snap.plannedMinutes} min · ${clock(snap.plannedStart)}` : ''}
        </Text>
        <Text style={styles.sub}>
          Today: {snap.todayPlanCount} block{snap.todayPlanCount === 1 ? '' : 's'}
          {snap.todayMinutes ? ` · ${formatMinutes(snap.todayMinutes)}` : ''}
        </Text>
      </View>
      <View style={styles.right}>
        {snap.pet && <PetArt speciesId={snap.pet.speciesId} stage={snap.pet.stage} mood="content" size={44} />}
        <View style={styles.cta}>
          <Text style={styles.ctaText}>Start & Lock</Text>
        </View>
      </View>
    </View>
  );
}

export function LiveActivityMock({ content, now }: { content: LiveActivityContent; now: number }) {
  const left = Math.max(0, Math.round((content.endsAt - now) / 60_000));
  const prot = content.protection === 'on' ? 'Protected' : content.protection === 'simulated' ? 'Protection simulated' : 'Not protected';
  return (
    <View style={styles.activity} accessible accessibilityLabel={`Live Activity mock. ${content.title}. ${content.subtitle}. ${left} minutes left. ${prot}.`}>
      <View style={styles.flex}>
        <Text style={styles.actBrand}>{content.title}</Text>
        <Text style={styles.actSub} numberOfLines={1}>
          {content.subtitle}
        </Text>
        <Text style={styles.actProt}>{prot}</Text>
      </View>
      <Text style={styles.actTime}>{left} min</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mock: { fontSize: 11, fontWeight: '900', letterSpacing: 0.6, color: '#8A4B00', backgroundColor: '#FFF4E0', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  widget: { backgroundColor: '#FFFDF9', borderRadius: 22, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  small: { width: 158, height: 158, justifyContent: 'space-between' },
  medium: { width: 338, maxWidth: '100%', height: 158, flexDirection: 'row', gap: spacing.md },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontSize: 12, fontWeight: '900', color: colors.primaryDark },
  course: { fontSize: 16, fontWeight: '800', color: colors.text },
  time: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  sub: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  cta: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 10, alignItems: 'center' },
  ctaText: { fontSize: 13, fontWeight: '900', color: colors.white },
  flex: { flex: 1, gap: 2 },
  right: { alignItems: 'center', justifyContent: 'space-between' },
  activity: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1A2E', borderRadius: 22, padding: spacing.md, gap: spacing.md, maxWidth: 360 },
  actBrand: { fontSize: 12, fontWeight: '900', color: '#C9BCFF' },
  actSub: { fontSize: 15, fontWeight: '800', color: colors.white },
  actProt: { fontSize: 12, fontWeight: '700', color: '#B8B3C9' },
  actTime: { fontSize: 22, fontWeight: '900', color: colors.white, fontVariant: ['tabular-nums'] },
});
