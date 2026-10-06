import { create } from 'zustand';
import {
  adoptPet,
  applyLook,
  clearLook,
  debugClearOutfit,
  debugCollectionAlmostDone,
  debugResetCollections,
  debugSetSpecies,
  debugSetStage,
  debugUnlockCollection,
  debugUnlockReactions,
  equipReaction,
  markItemsSeen,
  processStyleRewards,
  renameLook,
  saveLook,
  wearCollectionLook,
  type GrowthStage,
  type PetSpeciesId as StylePetSpecies,
  addMission,
  chooseAppMode,
  completeFamilySetup,
  completeGameRound,
  createId,
  createParentGate,
  debugCompleteMission,
  debugGrantPlayCoins,
  debugMissionAlmostDone,
  debugPlayCapOneLeft,
  debugResetDailyPlay,
  debugResetTodaysMissions,
  debugSimulateNextDay,
  debugUnlockPlay,
  isValidPin,
  removeMission,
  setChildNickname,
  setMissionActive,
  setParentGate,
  setPlaySettings,
  updateMission,
  verifyParentPin,
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
  type AppMode,
  type EquipSlot,
  type GameId,
  type GameRoundResult,
  type MissionCompletion,
  type MissionDraft,
  type MissionError,
  type PlaySettings,
  type FocusError,
  type FocusOutcome,
  type GameSave,
  type InventoryError,
  type PetSpeciesId,
  type ProtectionSettings,
  type ProtectionStartError,
  type ProtectionMode,
  type ProtectionResult,
  type StudyContext,
  type ProtectionStatus,
  type ReconcileNotice,
  type Result,
  type SessionReward,
  type SessionSummary,
  type UserSettings,
  type XpPrimeTarget,
  setRoomColor,
  setRoomTheme,
  wearOutfit,
  capabilitiesFor,
  FREE_ENTITLEMENT,
  type Capabilities,
} from '@/core';
import { getRoomTheme } from '@/config/roomThemes';
import { DETECTION_POLICY } from '@/config/protection';
import type { FocusProtectionService, ProtectionEndReason, ProtectionEvent, SaveRepository } from '@/services';

export interface StartFocusOptions {
  study?: StudyContext;
  /** Protection to request for this session (default: the student's Focus protection setting). */
  protectionMode?: ProtectionMode;
  /** Planner Start & Lock: study even if protection can't start (reported truthfully). */
  continueWithoutProtection?: boolean;
}

export interface StartFocusOutcome {
  sessionId: string;
  protection: ProtectionResult;
  protectionError: ProtectionStartError | null;
}

export interface GameStoreDeps {
  saveRepository: SaveRepository;
  protection: FocusProtectionService;
  now?: () => number;
  /** Default for the debug-tools setting on a brand-new save. */
  debugDefault?: boolean;
  /**
   * Current product capabilities (from the entitlement store, never the save).
   * Used only to let Premium pieces/themes be worn or chosen. Defaults to Free.
   */
  capabilities?: () => Capabilities;
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

export type FamilyView = 'child' | 'parent';

/**
 * A style moment shown outside the session summary (after a purchase, or from
 * developer tools): a collection completed, or items revealed.
 */
export type StyleCelebration = { kind: 'collection'; collectionId: string } | { kind: 'items'; ids: string[] };

export type ParentUnlockResult =
  | { ok: true }
  | { ok: false; reason: 'wrong'; attemptsBeforePause: number }
  | { ok: false; reason: 'locked'; retryAt: number }
  | { ok: false; reason: 'no-pin' };

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
  /** Family Mode: which view is open. In memory only, so a restart always opens Child View. */
  familyView: FamilyView;
  /** A mission finished outside a session (e.g. developer tools), to celebrate on the pet screen. */
  missionCelebration: MissionCompletion | null;
  styleCelebration: StyleCelebration | null;

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
  /**
   * Start the one study/focus timer. `study` attaches Studyling context (plan,
   * course, start source). With `continueWithoutProtection`, a protection
   * failure doesn't block studying: the session starts unprotected and the
   * result says so (it is never reported as protected).
   */
  startFocus(minutes: number, options?: StartFocusOptions): Promise<Result<StartFocusOutcome, FocusError | ProtectionStartError>>;
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
  /** Free room colour (null = default room). Allowed in Self Mode and Child View; no gate. */
  setRoomColor(color: string | null): void;
  /** Room theme (Premium themes need Premium at the time of choosing; null clears). */
  setRoomTheme(themeId: string | null): void;
  /** Wear an arbitrary outfit (e.g. a curated Premium Look), skipping pieces the person can't use. */
  wearOutfitPreview(outfit: Partial<Record<'head' | 'face' | 'neck' | 'charm' | 'aura', string>>): void;
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
  /** Clear "New" badges for these items. */
  markItemsSeen(ids: string[]): void;
  saveLook(index: number, name?: string): void;
  applyLook(index: number): void;
  clearLook(index: number): void;
  renameLook(index: number, name: string): void;
  wearCollectionLook(collectionId: string): void;
  equipReaction(id: string): Result<null, 'unknown-reaction' | 'locked'>;
  consumeStyleCelebration(): void;
  debugUnlockCollection(collectionId: string): void;
  debugCollectionAlmostDone(collectionId: string): void;
  debugResetCollections(): void;
  debugTriggerReveal(ids: string[]): void;
  debugTriggerCollectionComplete(collectionId: string): void;
  debugUnlockReactions(): void;
  debugWearCollectionLook(collectionId: string): void;
  debugClearOutfit(): void;
  debugSetStage(stage: GrowthStage): void;
  debugSetSpecies(speciesId: StylePetSpecies): void;
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

  // ── Family Mode ──
  chooseMode(mode: AppMode): void;
  setParentPin(pin: string): Result<null, 'invalid-pin'>;
  setChildNickname(nickname: string): void;
  finishFamilySetup(): void;
  /** Leaving Child View always requires the parent PIN. */
  unlockParentView(pin: string): ParentUnlockResult;
  enterChildView(): void;
  updatePlaySettings(patch: Partial<PlaySettings>): void;

  // ── Missions ──
  addMission(draft: MissionDraft): Result<null, MissionError>;
  updateMission(id: string, draft: MissionDraft): Result<null, MissionError>;
  setMissionActive(id: string, active: boolean): void;
  removeMission(id: string): void;
  consumeMissionCelebration(): void;

  // ── Play ──
  /** A new round ID; only a completed round with this ID can be rewarded, once. */
  startGameRound(gameId: GameId): string;
  completeGameRound(round: { gameId: GameId; roundId: string; score: number }): GameRoundResult;

  // ── Developer tools (refuse to run unless Developer tools are on) ──
  debugEnterParentView(): boolean;
  debugResetParentPin(): void;
  debugSwitchMode(mode: AppMode): void;
  debugCompleteMission(id: string): void;
  debugMissionAlmostDone(id: string): void;
  debugSimulateNextDay(): void;
  debugResetTodaysMissions(): void;
  debugGrantPlayCoins(coins: number): void;
  debugPlayCapOneLeft(): void;
  debugResetDailyPlay(): void;
  debugUnlockPlay(): void;
}

/**
 * The app's single source of truth. Actions delegate all rules to the pure
 * `core` layer, then persist the resulting save. Built from a factory so tests
 * can inject an in-memory repository, a mock screen-time service and a fake clock.
 */
export function createGameStore(deps: GameStoreDeps) {
  const now = deps.now ?? Date.now;
  const caps = deps.capabilities ?? (() => capabilitiesFor(FREE_ENTITLEMENT, { childView: false, storeAvailable: false }));
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

    /** Developer actions are ignored unless Developer tools are enabled. */
    const devOnly = (fn: (save: GameSave) => GameSave | void) => {
      const save = get().save;
      if (!save?.profile.settings.debugToolsEnabled) return false;
      const next = fn(save);
      if (next) commit(next);
      return true;
    };

    const randomSalt = () => {
      const bytes = new Uint8Array(16);
      const cryptoApi = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
      if (cryptoApi?.getRandomValues) cryptoApi.getRandomValues(bytes);
      else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    };

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
      familyView: 'child',
      missionCelebration: null,
      styleCelebration: null,

      async hydrate() {
        if (get().status === 'loading') return;
        set({ status: 'loading', error: null });
        try {
          const loaded = await deps.saveRepository.load();
          const base = loaded ?? createNewSave(now(), { debugToolsEnabled: deps.debugDefault });
          // Items added in an update (or milestones reached before cosmetics existed) are
          // granted quietly on launch; they show a "New" badge in the wardrobe.
          const { save, completedSummary } = refreshSave(processStyleRewards(base, now()).save, now());
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
        const save = requireSave();
        // Family setup finishes later (after the first mission), so it doesn't complete onboarding here.
        commit(adoptPet(save, speciesId, name, now(), { completeOnboarding: save.mode !== 'family' }));
      },

      petPet() {
        const result = petPet(requireSave(), now());
        if (result.happinessGained > 0) commit(result.save);
        return result.happinessGained;
      },

      async startFocus(minutes, options = {}) {
        const before = requireSave();
        const requested: ProtectionMode = options.protectionMode ?? before.protection.mode;
        // Validate the game side first (duration, pet, no overlapping session).
        const dryRun = startSession(before, minutes, [], now(), { protectionMode: requested });
        if (!dryRun.ok) return dryRun;

        const sessionId = createId('session');
        let mode = requested;
        let protectionResult: ProtectionResult = requested === 'none' ? 'notRequested' : 'failed';
        let protectionError: ProtectionStartError | undefined;
        if (requested !== 'none') {
          const started = await startNativeProtection(sessionId, requested, now() + minutes * 60_000);
          if (started.ok) {
            // Only the platform's own confirmation counts; the web/dev mock is a simulation.
            protectionResult = started.value.platform === 'ios' ? 'activated' : 'simulated';
          } else {
            if (!options.continueWithoutProtection) return started;
            protectionError = started.error;
            mode = 'none';
          }
        }
        const study: StudyContext | undefined = options.study
          ? { ...options.study, protectionRequested: requested !== 'none', protectionResult, protectionMode: requested, ...(protectionError ? { protectionError } : {}) }
          : { startSource: 'app', startContext: 'unscheduled', independentStart: true, protectionRequested: requested !== 'none', protectionResult, protectionMode: requested, ...(protectionError ? { protectionError } : {}) };
        // The game session starts only after native answered (confirmed, or failed and the caller chose to continue).
        const result = startSession(requireSave(), minutes, [], now(), { protectionMode: mode, sessionId, study });
        if (!result.ok) {
          if (mode !== 'none') await stopProtection(sessionId, 'error-recovery');
          return result;
        }
        commit(result.value, { protectionNotice: null, interventionsThisSession: 0 });
        return ok({ sessionId, protection: protectionResult, protectionError: protectionError ?? null });
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
        // Buying the last piece of a collection completes it (once).
        const style = processStyleRewards(result.value.save, now());
        const completed = style.completedCollections[0];
        commit(style.save, completed ? { styleCelebration: { kind: 'collection', collectionId: completed } } : {});
        return ok({ firstPurchase: result.value.firstPurchase, happinessGained: result.value.happinessGained });
      },

      equip(itemId, options) {
        const result = applyResult(equipItem(requireSave(), itemId, caps()));
        if (result.ok && options?.showOnPet) set({ petReaction: { id: nextReactionId(), kind: 'equip', itemId } });
        return result;
      },

      unequip: (slot) => commit(unequipSlot(requireSave(), slot)),
      markItemsSeen: (ids) => {
        const save = requireSave();
        const next = markItemsSeen(save, ids);
        if (next !== save) commit(next);
      },
      saveLook: (index, name) => commit(saveLook(requireSave(), index, now(), name)),
      renameLook: (index, name) => commit(renameLook(requireSave(), index, name)),
      wearCollectionLook: (collectionId) => commit(wearCollectionLook(requireSave(), collectionId, caps())),
      equipReaction(id) {
        const result = equipReaction(requireSave(), id);
        if (!result.ok) return result;
        commit(result.value);
        return ok(null);
      },
      consumeStyleCelebration: () => set({ styleCelebration: null }),
      debugUnlockCollection(collectionId) {
        devOnly((save) => {
          const style = processStyleRewards(debugUnlockCollection(save, collectionId, now()), now());
          if (style.completedCollections.includes(collectionId)) set({ styleCelebration: { kind: 'collection', collectionId } });
          return style.save;
        });
      },
      debugCollectionAlmostDone: (collectionId) => void devOnly((save) => debugCollectionAlmostDone(save, collectionId, now()).save),
      debugResetCollections: () => void devOnly((save) => debugResetCollections(save)),
      debugTriggerReveal: (ids) => void devOnly((save) => {
        set({ styleCelebration: { kind: 'items', ids } });
        return save;
      }),
      debugTriggerCollectionComplete: (collectionId) => void devOnly((save) => {
        set({ styleCelebration: { kind: 'collection', collectionId } });
        return save;
      }),
      debugUnlockReactions: () => void devOnly((save) => debugUnlockReactions(save)),
      debugWearCollectionLook: (collectionId) =>
        void devOnly((save) => wearCollectionLook(processStyleRewards(debugUnlockCollection(save, collectionId, now()), now()).save, collectionId)),
      debugClearOutfit: () => void devOnly((save) => debugClearOutfit(save)),
      debugSetStage: (stage) => void devOnly((save) => processStyleRewards(debugSetStage(save, stage), now()).save),
      debugSetSpecies: (speciesId) => void devOnly((save) => debugSetSpecies(save, speciesId)),
      applyLook: (index) => commit(applyLook(requireSave(), index, caps())),
      clearLook: (index) => commit(clearLook(requireSave(), index)),
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

      setRoomColor(color) {
        commit(setRoomColor(requireSave(), color));
      },

      setRoomTheme(themeId) {
        commit(
          setRoomTheme(requireSave(), themeId, {
            known: (id) => Boolean(getRoomTheme(id)),
            premium: (id) => getRoomTheme(id)?.access === 'premium',
            entitled: caps().canUsePremiumRoomThemes,
          }),
        );
      },

      wearOutfitPreview(outfit) {
        commit(wearOutfit(requireSave(), outfit, caps()));
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
        commit(fresh, { lastSummary: null, pendingWelcome: null, petReaction: null, familyView: 'child', missionCelebration: null, styleCelebration: null });
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

      chooseMode(mode) {
        commit(chooseAppMode(requireSave(), mode));
      },

      setParentPin(pin) {
        if (!isValidPin(pin)) return fail('invalid-pin');
        commit(setParentGate(requireSave(), createParentGate(pin, randomSalt())));
        return ok(null);
      },

      setChildNickname(nickname) {
        commit(setChildNickname(requireSave(), nickname));
      },

      finishFamilySetup() {
        commit(completeFamilySetup(requireSave(), now()), { familyView: 'child' });
      },

      unlockParentView(pin) {
        const save = requireSave();
        const gate = save.family?.gate;
        if (!gate) return { ok: false, reason: 'no-pin' };
        const check = verifyParentPin(gate, pin, now());
        commit(setParentGate(save, check.gate), check.ok ? { familyView: 'parent' } : {});
        if (check.ok) return { ok: true };
        return check.reason === 'locked'
          ? { ok: false, reason: 'locked', retryAt: check.retryAt }
          : { ok: false, reason: 'wrong', attemptsBeforePause: check.attemptsBeforePause };
      },

      enterChildView() {
        set({ familyView: 'child' });
      },

      updatePlaySettings(patch) {
        commit(setPlaySettings(requireSave(), patch));
      },

      addMission(draft) {
        const result = addMission(requireSave(), draft, createId('mission'), now());
        if (!result.ok) return result;
        commit(result.value);
        return ok(null);
      },

      updateMission(id, draft) {
        const result = updateMission(requireSave(), id, draft);
        if (!result.ok) return result;
        commit(result.value);
        return ok(null);
      },

      setMissionActive: (id, active) => commit(setMissionActive(requireSave(), id, active)),
      removeMission: (id) => commit(removeMission(requireSave(), id)),
      consumeMissionCelebration: () => set({ missionCelebration: null }),

      startGameRound: () => createId('round'),

      completeGameRound(round) {
        const { save, result } = completeGameRound(requireSave(), round, now());
        if (!result.duplicate && !result.locked) commit(save);
        return result;
      },

      debugEnterParentView() {
        return devOnly(() => set({ familyView: 'parent' }));
      },

      debugResetParentPin() {
        // Clears the PIN; the next visit to Parent View asks to create a new one.
        devOnly((save) => (save.family ? { ...save, family: { ...save.family, gate: null } } : save));
      },

      debugSwitchMode(mode) {
        devOnly((save) => {
          let next = chooseAppMode(save, mode);
          if (mode === 'family' && next.family && !next.family.child.nickname) next = setChildNickname(next, 'Test child');
          if (mode === 'family') next = completeFamilySetup(next, now());
          set({ familyView: 'child' });
          return next;
        });
      },

      debugCompleteMission(id) {
        devOnly((save) => {
          const result = debugCompleteMission(save, id, now());
          if (result.completion) set({ missionCelebration: result.completion });
          return result.save;
        });
      },

      debugMissionAlmostDone: (id) => void devOnly((save) => debugMissionAlmostDone(save, id, now())),
      debugSimulateNextDay: () => void devOnly((save) => debugSimulateNextDay(save)),
      debugResetTodaysMissions: () => void devOnly((save) => debugResetTodaysMissions(save, now())),
      debugGrantPlayCoins: (coins) => void devOnly((save) => debugGrantPlayCoins(save, coins, now())),
      debugPlayCapOneLeft: () => void devOnly((save) => debugPlayCapOneLeft(save, now())),
      debugResetDailyPlay: () => void devOnly((save) => debugResetDailyPlay(save, now())),
      debugUnlockPlay: () => void devOnly((save) => debugUnlockPlay(save, now())),
    };
  });
}

export type GameStoreHook = ReturnType<typeof createGameStore>;
