import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { AssignmentType, Id } from '@/core';
import { playSound } from '@/services/audio';
import { useAppRoutes } from '@/hooks/useAppRoutes';
import { usePlannerStore } from '@/state';
import { Button, Card, colors, radius, spacing, typography } from '@/ui';
import { Chips, DateField, EffortField, TimeField, TypeChips } from './AssignmentFields';
import { SectionTitle } from './PlannerBits';
import { COURSE_COLORS, formatDayKey, formatMinutes, TYPE_LABEL } from './plannerCopy';

/** Manual entry: a course and its deadlines, no syllabus or class site needed. */
export function ManualEntry({ courseId: initialCourse }: { courseId?: string }) {
  const planner = usePlannerStore((s) => s.planner);
  const routes = useAppRoutes();
  const store = usePlannerStore.getState();
  const courses = Object.values(planner?.courses ?? {}).filter((c) => c.active);
  const [courseId, setCourseId] = useState<Id | 'new'>(initialCourse ?? courses[0]?.id ?? 'new');
  const [courseName, setCourseName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<AssignmentType>('assignment');
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [effort, setEffort] = useState<number | null>(null);
  const [added, setAdded] = useState<{ id: Id; title: string; type: AssignmentType; day: string | null; effort: number | null }[]>([]);
  const [formKey, setFormKey] = useState(0);

  const canAdd = title.trim() && (courseId !== 'new' || courseName.trim());

  const add = () => {
    let cid = courseId;
    if (cid === 'new') {
      cid = store.addCourse({ name: courseName.trim(), code: courseCode.trim() || undefined, color: COURSE_COLORS[courses.length % COURSE_COLORS.length] });
      setCourseId(cid);
    }
    const id = store.addAssignment({ courseId: cid, title: title.trim(), type, dueDayKey: day, dueTime: time, estimatedMinutes: effort });
    playSound('confirm');
    setAdded((a) => [...a, { id, title: title.trim(), type, day, effort }]);
    setTitle('');
    setDay(null);
    setTime(null);
    setEffort(null);
    setFormKey((k) => k + 1);
  };

  const done = () => {
    if (added.length) usePlannerStore.getState().proposePlans(added.map((a) => a.id));
    router.dismissTo(routes.planner as Href);
  };

  return (
    <View style={styles.wrap}>
      <Card>
        <Chips
          label="Course"
          options={[...courses.map((c) => ({ value: c.id, label: c.code ?? c.name })), { value: 'new', label: '+ New course' }]}
          value={courseId}
          onChange={(v) => setCourseId(v)}
        />
        {courseId === 'new' && (
          <>
            <TextInput value={courseName} onChangeText={setCourseName} placeholder="Course name, e.g. Chemistry" placeholderTextColor={colors.textMuted} style={styles.input} accessibilityLabel="Course name" />
            <TextInput value={courseCode} onChangeText={setCourseCode} placeholder="Code (optional), e.g. CHEM 101" placeholderTextColor={colors.textMuted} style={styles.input} accessibilityLabel="Course code (optional)" autoCapitalize="characters" />
          </>
        )}
      </Card>

      <Card key={formKey}>
        <Text style={typography.heading}>Assignment</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder="Name, e.g. Problem Set 4" placeholderTextColor={colors.textMuted} style={styles.input} accessibilityLabel="Assignment name" />
        <TypeChips value={type} onChange={setType} />
        <DateField value={day} onChange={setDay} />
        <TimeField value={time} onChange={setTime} />
        <EffortField value={effort} onChange={setEffort} />
        <Button label="Add assignment" onPress={add} disabled={!canAdd} sound={null} />
      </Card>

      {added.length > 0 && (
        <>
          <SectionTitle>{`Added (${added.length})`}</SectionTitle>
          <Card>
            {added.map((a) => (
              <Text key={a.id} style={styles.added}>
                {a.title} · {TYPE_LABEL[a.type]}
                {a.day ? ` · ${formatDayKey(a.day)}` : ' · no date yet'}
                {a.effort ? ` · ${formatMinutes(a.effort)}` : ''}
              </Text>
            ))}
          </Card>
        </>
      )}
      <Button label={added.length ? 'Done · plan my study' : 'Done'} variant={added.length ? 'primary' : 'secondary'} onPress={done} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  input: { minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, fontSize: 15, color: colors.text },
  added: { fontSize: 15, fontWeight: '600', color: colors.text, paddingVertical: 4 },
});
