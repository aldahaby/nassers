import { create } from 'zustand';
import {
  adoptPet,
  createNewSave,
  debugClearInventory,
  debugDressUp,
  debugGrant,
  debugOwnOneOfEach,
  debugPrimeXp,
  debugResetEquipped,
  debugUnlockAll,
  debugSetRemaining,
  endSession,
  equipItem,
  feedPet,
  fail,
  ok,
  petPet,
  playWithToy,
  purchaseItem,
  refreshSave,
  startSession,
  unequipItem,
  unequipSlot,
  type BlockTarget,
  type EquipSlot,
  type FocusError,
  type FocusOutcome,
  type GameSave,
  type InventoryError,
  type PetSpeciesId,
  type Result,
  type SessionReward,
  type SessionSummary,
  type UserSettings,
  type XpPrimeTarget,
} from '@/core';
import type { SaveRepository, ScreenTimeService } from '@/services';

export interface GameStoreDeps {
  saveRepository: SaveRepository;
  screenTime: ScreenTimeService;
  now?: () => number;
  /** Default for the debug-tools setting on a brand-new save. */
  debugDefault?: boolean;
}

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * A one-off event for the pet screen to animate: playing with a toy, eating, or
 * showing off a new item. Consumed (cleared) once the animation starts.
 */
export type PetReaction =
  | { id: number; kind: 'toy'; itemId: string; happinessGained: number; rewarded: boolean }
  | { id: number; kind: 'food'; itemId: string; happinessGained: number; healthGained: number }
  | { id: number; kind: 'equip'; itemId: string };

export interface PurchaseResult {
  firstPurchase: boolean;
  happinessGained: number;
}

export interface GameStore {
  status: LoadStatus;
  error: string | null;
  save: GameSave | null;
  /** Summary of the most recently finished session, until the completion screen dismisses it. */
  lastSummary: SessionSummary | null;
  /** Set when the completion screen closes, so the pet screen can greet the player once. */
  pendingWelcome: FocusOutcome | null;
  petReaction: PetReaction | null;

  hydrate(): Promise<void>;
  /** Apply decay and auto-complete due sessions. Safe to call often. */
  refresh(): void;
  adoptPet(speciesId: PetSpeciesId, name: string): void;
  /** Returns happiness gained (0 while on cooldown). */
  petPet(): number;
  startFocus(minutes: number, targets: BlockTarget[]): Result<null, FocusError>;
  endFocus(outcome: FocusOutcome): Result<SessionReward, FocusError>;
  purchase(itemId: string): Result<PurchaseResult, InventoryError>;
  /** Wear/place an item. `showOnPet` queues a reaction for the pet screen. */
  equip(itemId: string, options?: { showOnPet?: boolean }): Result<null, InventoryError>;
  unequip(slot: EquipSlot): void;
  unequipItem(itemId: string): void;
  /** Feed the pet; always queues an eating reaction. */
  feed(itemId: string): Result<PetReaction, InventoryError>;
  /** Play with a toy; always queues a play reaction (stats only off cooldown). */
  play(itemId: string): Result<PetReaction, InventoryError>;
  consumePetReaction(): void;
  dismissSummary(): void;
  consumeWelcome(): void;
  updateSettings(patch: Partial<UserSettings>): void;
  debugGrant(grant: { coins?: number; xp?: number }): void;
  /** Put the pet 1 XP short of a milestone. */
  debugPrimeXp(target: XpPrimeTarget): void;
  /** Leave only `remainingMs` on the active session. */
  debugSetRemaining(remainingMs: number): void;
  debugClearInventory(): void;
  debugUnlockAll(): void;
  debugOwnOneOfEach(): void;
  debugResetEquipped(): void;
  debugDressUp(): void;
  resetProgress(): Promise<void>;
}

/**
 * The app's single source of truth. Actions delegate all rules to the pure
 * `core` layer, then persist the resulting save. Built from a factory so tests
 * can inject an in-memory repository, a mock screen-time service and a fake clock.
 */
export function createGameStore(deps: GameStoreDeps) {
  const now = deps.now ?? Date.now;
  let writeChain: Promise<void> = Promise.resolve();
  let reactionId = 0;

  return create<GameStore>()((set, get) => {
    /** Store and persist a new save. Writes are serialised so they land in order. */
    const commit = (next: GameSave, extra: Partial<GameStore> = {}) => {
      const stamped = { ...next, savedAt: now() };
      set({ save: stamped, ...extra });
      writeChain = writeChain
        .then(() => deps.saveRepository.save(stamped))
        .catch((error: unknown) => console.warn('[focusling] failed to persist save', error));
    };

    /** Run an inventory-style action that returns Result<GameSave>. */
    const applyResult = <E extends string>(result: Result<GameSave, E>): Result<null, E> => {
      if (!result.ok) return result;
      commit(result.value);
      return ok(null);
    };

    const nextReactionId = () => (reactionId += 1);

    const requireSave = (): GameSave => {
      const save = get().save;
      if (!save) throw new Error('Game state used before hydration');
      return save;
    };

    return {
      status: 'idle',
      error: null,
      save: null,
      lastSummary: null,
      pendingWelcome: null,
      petReaction: null,

      async hydrate() {
        if (get().status === 'loading') return;
        set({ status: 'loading', error: null });
        try {
          const loaded = await deps.saveRepository.load();
          const base = loaded ?? createNewSave(now(), { debugToolsEnabled: deps.debugDefault });
          const { save, completedSummary } = refreshSave(base, now());
          commit(save, { status: 'ready', lastSummary: completedSummary });
        } catch (error) {
          set({ status: 'error', error: error instanceof Error ? error.message : String(error) });
        }
      },

      refresh() {
        const save = get().save;
        if (!save) return;
        const result = refreshSave(save, now());
        if (result.completedSummary) {
          void deps.screenTime.stopBlocking(result.completedSummary.sessionId);
          commit(result.save, { lastSummary: result.completedSummary });
        } else if (result.save.pet !== save.pet) {
          set({ save: result.save });
        }
      },

      adoptPet(speciesId, name) {
        commit(adoptPet(requireSave(), speciesId, name, now()));
      },

      petPet() {
        const result = petPet(requireSave(), now());
        if (result.happinessGained > 0) commit(result.save);
        return result.happinessGained;
      },

      startFocus(minutes, targets) {
        const result = startSession(requireSave(), minutes, targets, now());
        if (!result.ok) return result;
        commit(result.value);
        const session = result.value.focus.active!;
        deps.screenTime
          .startBlocking({
            sessionId: session.id,
            targets,
            endsAt: session.startedAt + session.plannedDurationMinutes * 60_000,
          })
          .catch((error: unknown) => console.warn('[focusling] failed to start blocking', error));
        return ok(null);
      },

      endFocus(outcome) {
        const save = requireSave();
        const sessionId = save.focus.active?.id;
        const result = endSession(save, outcome, now());
        if (!result.ok) return fail(result.error);
        commit(result.value.save, { lastSummary: result.value.summary });
        if (sessionId) void deps.screenTime.stopBlocking(sessionId);
        return ok(result.value.reward);
      },

      purchase(itemId) {
        const result = purchaseItem(requireSave(), itemId, now());
        if (!result.ok) return result;
        commit(result.value.save);
        return ok({ firstPurchase: result.value.firstPurchase, happinessGained: result.value.happinessGained });
      },

      equip(itemId, options) {
        const result = applyResult(equipItem(requireSave(), itemId));
        if (result.ok && options?.showOnPet) set({ petReaction: { id: nextReactionId(), kind: 'equip', itemId } });
        return result;
      },

      unequip: (slot) => commit(unequipSlot(requireSave(), slot)),
      unequipItem: (itemId) => commit(unequipItem(requireSave(), itemId)),

      feed(itemId) {
        const result = feedPet(requireSave(), itemId, now());
        if (!result.ok) return result;
        const reaction: PetReaction = {
          id: nextReactionId(),
          kind: 'food',
          itemId,
          happinessGained: result.value.happinessGained,
          healthGained: result.value.healthGained,
        };
        commit(result.value.save, { petReaction: reaction });
        return ok(reaction);
      },

      play(itemId) {
        const result = playWithToy(requireSave(), itemId, now());
        if (!result.ok) return result;
        const reaction: PetReaction = {
          id: nextReactionId(),
          kind: 'toy',
          itemId,
          happinessGained: result.value.happinessGained,
          rewarded: result.value.rewarded,
        };
        commit(result.value.save, { petReaction: reaction });
        return ok(reaction);
      },

      consumePetReaction() {
        set({ petReaction: null });
      },

      dismissSummary() {
        set({ pendingWelcome: get().lastSummary?.outcome ?? null, lastSummary: null });
      },

      consumeWelcome() {
        set({ pendingWelcome: null });
      },

      updateSettings(patch) {
        const save = requireSave();
        commit({ ...save, profile: { ...save.profile, settings: { ...save.profile.settings, ...patch } } });
      },

      debugGrant(grant) {
        commit(debugGrant(requireSave(), grant));
      },

      debugPrimeXp(target) {
        commit(debugPrimeXp(requireSave(), target));
      },

      debugSetRemaining(remainingMs) {
        commit(debugSetRemaining(requireSave(), remainingMs, now()));
      },

      debugClearInventory: () => commit(debugClearInventory(requireSave())),
      debugUnlockAll: () => commit(debugUnlockAll(requireSave(), now())),
      debugOwnOneOfEach: () => commit(debugOwnOneOfEach(requireSave(), now())),
      debugResetEquipped: () => commit(debugResetEquipped(requireSave())),
      debugDressUp: () => commit(debugDressUp(requireSave(), now())),

      async resetProgress() {
        const active = get().save?.focus.active;
        if (active) await deps.screenTime.stopBlocking(active.id);
        await writeChain;
        await deps.saveRepository.clear();
        const fresh = createNewSave(now(), { debugToolsEnabled: get().save?.profile.settings.debugToolsEnabled });
        commit(fresh, { lastSummary: null, pendingWelcome: null, petReaction: null });
      },
    };
  });
}

export type GameStoreHook = ReturnType<typeof createGameStore>;
