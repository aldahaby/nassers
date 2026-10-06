import { StyleSheet, Text, View } from 'react-native';
import type { ConfidenceLevel, Course } from '@/core';
import { TabIcon, colors, radius, spacing } from '@/ui';
import { courseColor, courseLabel, TRUST_LABEL } from './plannerCopy';

/** Trust state: icon + words, never colour alone, never a percentage. */
export function TrustBadge({ level, compact = false }: { level: ConfidenceLevel; compact?: boolean }) {
  const s = TRUST[level];
  return (
    <View style={[styles.badge, { backgroundColor: s.bg, borderColor: s.border }]} accessible accessibilityLabel={TRUST_LABEL[level]}>
      <Text style={[styles.badgeGlyph, { color: s.fg }]}>{s.glyph}</Text>
      {!compact && <Text style={[styles.badgeText, { color: s.fg }]}>{TRUST_LABEL[level]}</Text>}
    </View>
  );
}

const TRUST: Record<ConfidenceLevel, { glyph: string; fg: string; bg: string; border: string }> = {
  confirmed: { glyph: '✓', fg: colors.success, bg: colors.successSoft, border: colors.successBorder },
  likely: { glyph: '~', fg: '#4A3F8F', bg: '#F1EEFF', border: '#DCD4FF' },
  // Calm amber, not red: uncertainty is normal, not an error.
  needsReview: { glyph: '?', fg: '#8A4B00', bg: '#FFF4E0', border: '#F5D7A3' },
};

/** Course label with a colour dot as a secondary cue (text always present). */
export function CourseTag({ course, index = 0 }: { course: Course | undefined; index?: number }) {
  return (
    <View style={styles.course}>
      <View style={[styles.dot, { backgroundColor: courseColor(course, index) }]} />
      <Text style={styles.courseText} numberOfLines={1}>
        {courseLabel(course)}
      </Text>
    </View>
  );
}

export function SectionTitle({ children, action }: { children: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.section} accessibilityRole="header">
        {children}
      </Text>
      {action}
    </View>
  );
}

export function InfoNote({ icon = 'bell', children }: { icon?: 'bell' | 'shield' | 'book' | 'planner' | 'lock'; children: React.ReactNode }) {
  return (
    <View style={styles.note}>
      <TabIcon name={icon} color={colors.primaryDark} size={18} />
      <Text style={styles.noteText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeGlyph: { fontSize: 12, fontWeight: '900' },
  badgeText: { fontSize: 12, fontWeight: '800' },
  course: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  courseText: { fontSize: 13, fontWeight: '800', color: colors.text, flexShrink: 1 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.sm },
  section: { fontSize: 13, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase', color: colors.textMuted },
  note: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: spacing.md },
  noteText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.text },
});
