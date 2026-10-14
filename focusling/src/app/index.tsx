import { Redirect } from 'expo-router';
import { useHomeHref } from '@/state';

/** Entry: onboarding until it's done, then the tabs. */
export default function Index() {
  return <Redirect href={useHomeHref()} />;
}
