import { create } from 'zustand';
import {
  adoptPet,
  createId,
  createNewSave,
  isCurrentSessionEvent,
  isProtectionActiveFor,
  protectionPreflight,
  reconcileProtection,
  updateProtectionSettings,
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
  type EquipSlot,
  type FocusError,
  type FocusOutcome,
  type GameSave,
  type InventoryError,
  type PetSpeciesId,
  type ProtectionSettings,
  type ProtectionStartError,
  type ProtectionStatus,
  type ReconcileNotice,
  type Result,
  type SessionReward,
  type SessionSummary,
  type UserSettings,
  type XpPrimeTarget,
} from '@/core';
import { DETECTION_POLICY } from '@/config/protection';
import type { FocusProtectionService, ProtectionEndReason, ProtectionEvent, SaveRepository } from '@/services';

export interface GameStoreDeps {
  saveRepository: SaveRepository;
  protection: FocusProtectionService;
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
  /** Latest authoritative protection status from native (or the mock). */
  protection: ProtectionStatus | null;
  /** A protection problem to show during the session (never changes rewards). */
  protectionNotice: ReconcileNotice;
  /** Distractions interrupted during the current session (not persisted; stats come later). */
  interventionsThisSession: number;

  hydrate(): Promise<void>;
  /** Apply decay and auto-complete due sessions. Safe to call often. */
  refresh(): void;
  adoptPet(speciesId: PetSpeciesId, name: string): void;
  /** Returns happiness gained (0 while on cooldown). */
  petPet(): number;
  /**
   * Start a session. With protection on, native protection must confirm it is
   * running for this session ID before the game session begins.
   */
  startFocus(minutes: number): Promise<Result<null, FocusError | ProtectionStartError>>;
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

  // ── Focus protection ──
  updateProtection(patch: Partial<ProtectionSettings>): void;
  requestProtectionAuthorization(): Promise<void>;
  selectProtectedApps(): Promise<void>;
  /** Re-read native status and reconcile it with the game session. */
  refreshProtection(): Promise<void>;
  handleProtectionEvent(event: ProtectionEvent): void;
  /** Try to restart selective protection for the running session. */
  restartProtection(): Promise<Result<null, ProtectionStartError>>;
  /** The person chose whole-app blocking instead (never automatic). */
  switchSessionToWholeApp(): Promise<Result<null, ProtectionStartError>>;
  dismissProtectionNotice(): void;
  emergencyProtectionCleanup(): Promise<void>;
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

    /**
     * The one protection cleanup path. Every way a session ends goes through here,
     * so capture, detection, temporary shields, whole-app shields and DeviceActivity
     * monitoring all stop together.
     */
    const stopProtection = async (sessionId: string | null, reason: ProtectionEndReason) => {
      try {
        await deps.protection.endProtection(sessionId, reason);
      } catch (error) {
        console.warn('[focusling] protection cleanup failed', error);
      }
      try {
        set({ protection: await deps.protection.getStatus(), protectionNotice: null, interventionsThisSession: 0 });
      } catch {
        set({ protectionNotice: null, interventionsThisSession: 0 });
      }
    };

    /** Start native protection for a session and confirm it's actually running. */
    const startNativeProtection = async (
      sessionId: string,
      mode: 'selective' | 'wholeApp',
      endsAt: number,
    ): Promise<Result<ProtectionStatus, ProtectionStartError>> => {
      const settings = requireSave().protection;
      const current = await deps.protection.getStatus();
      const blocked = protectionPreflight(mode, current);
      if (blocked) {
        set({ protection: current });
        return fail(blocked);
      }
      const result = await deps.protection.startProtection({
        sessionId,
        mode,
        surfaces: settings.surfaces,
        endsAt,
        policy: { ...DETECTION_POLICY },
        petName: requireSave().pet?.name ?? 'Your pet',
      });
      if (!result.ok) {
        set({ protection: await deps.protection.getStatus() });
        return fail(result.error);
      }
      if (!isProtectionActiveFor(result.status, sessionId)) {
        await deps.protection.endProtection(sessionId, 'error-recovery');
        set({ protection: await deps.protection.getStatus() });
        return fail('capture-not-confirmed');
      }
      set({ protection: result.status });
      return ok(result.status);
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
      lastSummary: null,
      pendingWelcome: null,
      petReaction: null,
      protection: null,
      protectionNotice: null,
      interventionsThisSession: 0,

      async hydrate() {
        if (get().status === 'loading') return;
        set({ status: 'loading', error: null });
        try {
          const loaded = await deps.saveRepository.load();
          const base = loaded ?? createNewSave(now(), { debugToolsEnabled: deps.debugDefault });
          const { save, completedSummary } = refreshSave(base, now());
          commit(save, { status: 'ready', lastSummary: completedSummary });
          if (completedSummary) void stopProtection(completedSummary.sessionId, 'completed');
          void get().refreshProtection();
        } catch (error) {
          set({ status: 'error', error: error instanceof Error ? error.message : String(error) });
        }
      },

      refresh() {
        const save = get().save;
        if (!save) return;
        const result = refreshSave(save, now());
        if (result.completedSummary) {
          commit(result.save, { lastSummary: result.completedSummary });
          void stopProtection(result.completedSummary.sessionId, 'completed');
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

      async startFocus(minutes) {
        const before = requireSave();
        const mode = before.protection.mode;
        // Validate the game side first (duration, pet, no overlapping session).
        const dryRun = startSession(before, minutes, [], now(), { protectionMode: mode });
        if (!dryRun.ok) return dryRun;

        const sessionId = createId('session');
        if (mode !== 'none') {
          const started = await startNativeProtection(sessionId, mode, now() + minutes * 60_000);
          if (!started.ok) return started;
        }
        // The game session starts only after native confirmed protection.
        const result = startSession(requireSave(), minutes, [], now(), { protectionMode: mode, sessionId });
        if (!result.ok) {
          if (mode !== 'none') await stopProtection(sessionId, 'error-recovery');
          return result;
        }
        commit(result.value, { protectionNotice: null, interventionsThisSession: 0 });
        return ok(null);
      },

      endFocus(outcome) {
        const save = requireSave();
        const sessionId = save.focus.active?.id;
        const result = endSession(save, outcome, now());
        if (!result.ok) return fail(result.error);
        commit(result.value.save, { lastSummary: result.value.summary });
        if (sessionId) void stopProtection(sessionId, outcome === 'completed' ? 'completed' : 'ended-early');
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
        // Reset always clears native protection, whether or not a session is running.
        await stopProtection(get().save?.focus.active?.id ?? null, 'reset');
        await writeChain;
        await deps.saveRepository.clear();
        const fresh = createNewSave(now(), { debugToolsEnabled: get().save?.profile.settings.debugToolsEnabled });
        commit(fresh, { lastSummary: null, pendingWelcome: null, petReaction: null });
      },

      updateProtection(patch) {
        commit(updateProtectionSettings(requireSave(), patch));
      },

      async requestProtectionAuthorization() {
        await deps.protection.requestAuthorization();
        set({ protection: await deps.protection.getStatus() });
      },

      async selectProtectedApps() {
        await deps.protection.selectApps();
        set({ protection: await deps.protection.getStatus() });
      },

      async refreshProtection() {
        let native: ProtectionStatus;
        try {
          native = await deps.protection.getStatus();
        } catch {
          return;
        }
        const active = get().save?.focus.active ?? null;
        const { actions, notice } = reconcileProtection({
          gameSessionId: active?.id ?? null,
          gameProtectionMode: active?.protectionMode ?? null,
          native,
        });
        for (const action of actions) {
          if (action.kind === 'stop-native') await deps.protection.endProtection(action.sessionId, 'reconcile');
          if (action.kind === 'clear-stale-shields') await deps.protection.debug.clearShields();
        }
        set({ protection: actions.length ? await deps.protection.getStatus() : native, protectionNotice: notice });
      },

      handleProtectionEvent(event) {
        const activeId = get().save?.focus.active?.id ?? null;
        switch (event.type) {
          case 'status':
            set({ protection: event.status });
            return;
          case 'intervention':
            // A caught distraction is a success: the session continues untouched.
            if (isCurrentSessionEvent(event.sessionId, activeId)) {
              set({ interventionsThisSession: get().interventionsThisSession + 1 });
            }
            return;
          case 'capture-stopped':
            if (isCurrentSessionEvent(event.sessionId, activeId)) set({ protectionNotice: 'reels-protection-stopped' });
            return;
          case 'authorization-lost':
            if (activeId && get().save?.focus.active?.protectionMode !== 'none') set({ protectionNotice: 'authorization-lost' });
            return;
        }
      },

      async restartProtection() {
        const active = get().save?.focus.active;
        if (!active || active.protectionMode === 'none') return fail('native-error');
        const endsAt = active.startedAt + active.plannedDurationMinutes * 60_000;
        await deps.protection.endProtection(active.id, 'error-recovery');
        const result = await startNativeProtection(active.id, active.protectionMode, endsAt);
        if (result.ok) set({ protectionNotice: null });
        return result.ok ? ok(null) : result;
      },

      async switchSessionToWholeApp() {
        const save = requireSave();
        const active = save.focus.active;
        if (!active) return fail('native-error');
        await deps.protection.endProtection(active.id, 'error-recovery');
        const endsAt = active.startedAt + active.plannedDurationMinutes * 60_000;
        const result = await startNativeProtection(active.id, 'wholeApp', endsAt);
        if (!result.ok) return result;
        const latest = requireSave();
        commit(
          { ...latest, focus: { ...latest.focus, active: latest.focus.active && { ...latest.focus.active, protectionMode: 'wholeApp' } } },
          { protectionNotice: null },
        );
        return ok(null);
      },

      dismissProtectionNotice() {
        set({ protectionNotice: null });
      },

      async emergencyProtectionCleanup() {
        await deps.protection.emergencyCleanup();
        set({ protection: await deps.protection.getStatus(), protectionNotice: null });
      },
    };
  });
}

export type GameStoreHook = ReturnType<typeof createGameStore>;
