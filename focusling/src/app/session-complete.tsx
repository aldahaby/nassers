import { Redirect, router, type Href } from 'expo-router';
import { useState } from 'react';
import { CelebrationView } from '@/features/completion/CelebrationView';
import { RewardSummary } from '@/features/completion/RewardSummary';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useEquipped, useGameStore, useHomeHref, usePetView, usePlannerStore } from '@/state';

/**
 * Shown whenever a session ends: the reward summary first, then (if earned)
 * a separate level-up / growth / evolution celebration.
 */
export default function SessionCompleteScreen() {
  // Snapshot the summary so the screen stays intact while it animates away.
  const [summary] = useState(() => useGameStore.getState().lastSummary);
  const [phase, setPhase] = useState<'rewards' | 'celebration'>('rewards');
  const view = usePetView();
  const equipped = useEquipped();
  const reducedMotion = useReducedMotion();
  const home = useHomeHref();

  if (!summary || !view) return <Redirect href={home} />;
  const { pet, progression } = view;
  const { celebration } = summary;

  const finish = () => {
    useGameStore.getState().dismissSummary();
    // Eligible study sessions get one brief retrieval offer before going home.
    if (usePlannerStore.getState().planner?.pendingRetrieval) {
      router.replace('/planner/retrieval' as Href);
      return;
    }
    // Pop back to the existing tabs (never push a second copy) and land on the pet.
    router.dismissTo(home === '/onboarding' ? '/' : home);
  };

  if (phase === 'celebration' && celebration) {
    return (
      <CelebrationView
        celebration={celebration}
        pet={{ name: pet.name, speciesId: pet.speciesId, stage: progression.stage, equipped }}
        onDone={finish}
        reducedMotion={reducedMotion}
      />
    );
  }

  // Before a growth/evolution reveal, keep showing the pet's previous form.
  const rewardStage = celebration && celebration.kind !== 'levelUp' ? celebration.from : progression.stage;
  return (
    <RewardSummary
      summary={summary}
      pet={{ name: pet.name, speciesId: pet.speciesId, stage: rewardStage, equipped }}
      continueLabel={celebration ? 'Continue ✨' : `Back to ${pet.name}`}
      onContinue={celebration ? () => setPhase('celebration') : finish}
      reducedMotion={reducedMotion}
    />
  );
}
