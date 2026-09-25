import { create } from 'zustand';
import {
  adoptPet,
  createNewSave,
  debugGrant,
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
  type UserSettings,
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

export interface GameStore {
  status: LoadStatus;
  error: string | null;
  save: GameSave | null;
  /** Reward from the most recently finished session, until the UI dismisses it. */
  lastReward: SessionReward | null;

  hydrate(): Promise<void>;
  /** Apply decay and auto-complete due sessions. Safe to call often. */
  refresh(): void;
  adoptPet(speciesId: PetSpeciesId, name: string): void;
  /** Returns happiness gained (0 while on cooldown). */
  petPet(): number;
  startFocus(minutes: number, targets: BlockTarget[]): Result<null, FocusError>;
  endFocus(outcome: FocusOutcome): Result<SessionReward, FocusError>;
  purchase(itemId: string): Result<null, InventoryError>;
  equip(itemId: string): Result<null, InventoryError>;
  unequip(slot: EquipSlot): void;
  feed(itemId: string): Result<null, InventoryError>;
  play(itemId: string): Result<null, InventoryError>;
  dismissReward(): void;
  updateSettings(patch: Partial<UserSettings>): void;
  debugGrant(grant: { coins?: number; xp?: number }): void;
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

    const requireSave = (): GameSave => {
      const save = get().save;
      if (!save) throw new Error('Game state used before hydration');
      return save;
    };

    return {
      status: 'idle',
      error: null,
      save: null,
      lastReward: null,

      async hydrate() {
        if (get().status === 'loading') return;
        set({ status: 'loading', error: null });
        try {
          const loaded = await deps.saveRepository.load();
          const base = loaded ?? createNewSave(now(), { debugToolsEnabled: deps.debugDefault });
          const { save, completedReward } = refreshSave(base, now());
          commit(save, { status: 'ready', lastReward: completedReward });
        } catch (error) {
          set({ status: 'error', error: error instanceof Error ? error.message : String(error) });
        }
      },

      refresh() {
        const save = get().save;
        if (!save) return;
        const result = refreshSave(save, now());
        if (result.completedReward) {
          void deps.screenTime.stopBlocking(save.focus.active?.id ?? '');
          commit(result.save, { lastReward: result.completedReward });
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
        commit(result.value.save, { lastReward: result.value.reward });
        if (sessionId) void deps.screenTime.stopBlocking(sessionId);
        return ok(result.value.reward);
      },

      purchase: (itemId) => applyResult(purchaseItem(requireSave(), itemId, now())),
      equip: (itemId) => applyResult(equipItem(requireSave(), itemId)),
      unequip: (slot) => commit(unequipSlot(requireSave(), slot)),
      feed: (itemId) => applyResult(feedPet(requireSave(), itemId, now())),
      play: (itemId) => applyResult(playWithToy(requireSave(), itemId, now())),

      dismissReward() {
        set({ lastReward: null });
      },

      updateSettings(patch) {
        const save = requireSave();
        commit({ ...save, profile: { ...save.profile, settings: { ...save.profile.settings, ...patch } } });
      },

      debugGrant(grant) {
        commit(debugGrant(requireSave(), grant));
      },

      async resetProgress() {
        const active = get().save?.focus.active;
        if (active) await deps.screenTime.stopBlocking(active.id);
        await writeChain;
        await deps.saveRepository.clear();
        const fresh = createNewSave(now(), { debugToolsEnabled: get().save?.profile.settings.debugToolsEnabled });
        commit(fresh, { lastReward: null });
      },
    };
  });
}

export type GameStoreHook = ReturnType<typeof createGameStore>;
