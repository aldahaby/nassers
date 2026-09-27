import { Redirect } from 'expo-router';
import { useGameStore, useHomeHref } from '@/state';

/** Entry: onboarding, the self tabs, the child view, or (if it was open) the parent area. */
export default function Index() {
  const home = useHomeHref();
  const parentView = useGameStore((s) => s.save?.mode === 'family' && s.familyView === 'parent');
  return <Redirect href={parentView ? '/parent' : home} />;
}
