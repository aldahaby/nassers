import { create } from 'zustand';
import { PARSER_VERSION, type ParserVersion } from '@/config/planner';
import {
  acceptAllProposed,
  acceptPlan,
  addAssignment,
  addCourse,
  addRetrievalItem,
  answerRecoveryOffer,
  applyReminderDiff,
  buildStudyContext,
  buildWidgetSnapshot,
  cancelPlan,
  commitImport,
  completeAssignment,
  completeRetrievalOffer,
  confirmAssignment,
  confirmDraftItem,
  createId,
  createImportDraft,
  createPlannerState,
  deleteAssignment,
  desiredReminders,
  diffReminders,
  discardProposals,
  dismissCapacityNote,
  editDraftItem,
  getEndsAt,
  getProgression,
  liveActivityContent,
  logSessionStart,
  markPresented,
  proposePlans,
  recordAttempt,
  recordFinishedSession,
  reopenAssignment,
  reschedulePlan,
  resolveConflict,
  skipPlan,
  syncReminderRules,
  updateAssignment,
  updateCourse,
  updateSupport,
  type AssignmentField,
  type AssignmentInput,
  type AssignmentPatch,
  type CourseInput,
  type DraftItemPatch,
  type FocusSession,
  type Id,
  type ImportDraft,
  type NewRetrievalItem,
  type PlannerPreferences,
  type PlannerState,
  type ProposeResult,
  type ProtectionMode,
  type ProtectionResult,
  type ReminderPreference,
  type Result,
  type RetrievalResult,
  type StartSource,
  type Syllabus,
  type SyllabusSourceType,
} from '@/core';
import type { DocumentService } from '@/services/documents/DocumentService';
import { joinPages } from '@/services/documents/DocumentService';
import type { NotificationResponseEvent, NotificationService } from '@/services/notifications/NotificationService';
import type { PlannerRepository } from '@/services/planner/PlannerRepository';
import type { StudyWidgetBridge } from '@/services/widgets/StudyWidgetBridge';
import type { createGameStore } from './createGameStore';

type GameStore = ReturnType<typeof createGameStore>;

export interface PlannerStoreDeps {
  repository: PlannerRepository;
  notifications: NotificationService;
  documents: DocumentService;
  widgets: StudyWidgetBridge;
  game: GameStore;
  now?: () => number;
  timezone?: () => string;
}

export type ImportStatus = 'idle' | 'picking' | 'extracting' | 'parsing' | 'error';
export type ImportError = 'unsupported' | 'unreadable' | 'empty' | 'noItems';

export interface StartNotice {
  planId?: Id;
  protection: ProtectionResult;
  error: string | null;
}

export type StartError = 'no-plan' | 'no-pet' | 'session-already-active' | 'invalid' | 'protection';

export interface PlannerStoreState {
  planner: PlannerState | null;
  hydrated: boolean;
  draft: ImportDraft | null;
  importStatus: ImportStatus;
  importProgress: { done: number; total: number } | null;
  importError: ImportError | null;
  lastProposal: Omit<ProposeResult, 'state'> | null;
  /** The protection result of the latest Start & Lock, shown on the session screen. */
  startNotice: StartNotice | null;
  /** Something a notification asked the UI to open. */
  pendingNavigation: { to: 'planner' | 'session' } | null;
  activityId: string | null;

  hydrate(): Promise<void>;
  reset(): Promise<void>;
  // Import
  pickAndExtract(): Promise<void>;
  importText(text: string, sourceType: SyllabusSourceType, opts?: { filename?: string; extraction?: Syllabus['extraction']; parserVersion?: ParserVersion }): ImportDraft | null;
  editDraftItem(key: string, patch: DraftItemPatch): void;
  confirmDraftItem(key: string): void;
  setDraftCourse(index: number, patch: { name?: string; code?: string | null; timezone?: string }): void;
  cancelDraft(): void;
  commitDraft(keepOriginal: boolean): { courseIds: Id[]; assignmentIds: Id[] } | null;
  // Manual entry
  addCourse(input: Omit<CourseInput, 'timezone'> & { timezone?: string }): Id;
  updateCourse(id: Id, patch: Partial<CourseInput>): void;
  addAssignment(input: AssignmentInput): Id;
  updateAssignment(id: Id, patch: AssignmentPatch): void;
  confirmAssignment(id: Id): void;
  completeAssignment(id: Id): void;
  reopenAssignment(id: Id): void;
  deleteAssignment(id: Id): void;
  resolveConflict(id: Id, field: AssignmentField, keep: 'mine' | 'source'): void;
  // Planning
  proposePlans(assignmentIds?: Id[]): Omit<ProposeResult, 'state'>;
  acceptPlan(planId: Id): void;
  acceptAllProposed(assignmentId?: Id): void;
  discardProposals(assignmentId?: Id): void;
  reschedulePlan(planId: Id, start: number, minutes?: number): void;
  skipPlan(planId: Id): void;
  cancelPlan(planId: Id): void;
  dismissCapacityNote(assignmentId: Id): void;
  updatePreferences(patch: Partial<PlannerPreferences>): void;
  // Reminders
  enableReminders(): Promise<'granted' | 'denied' | 'undetermined'>;
  disableReminders(): void;
  setReminderPreference(pref: ReminderPreference): void;
  answerRecovery(answer: 'restore' | 'calm'): void;
  syncReminders(): Promise<void>;
  handleNotificationResponse(event: NotificationResponseEvent): Promise<void>;
  markPresented(key: string): void;
  // Sessions
  startPlan(planId: Id, source: StartSource): Promise<Result<StartNotice, StartError>>;
  startStudy(opts: { assignmentId?: Id; courseId?: Id; minutes: number; source: StartSource }): Promise<Result<StartNotice, StartError>>;
  clearStartNotice(): void;
  consumeNavigation(): void;
  // Retrieval
  completeRetrieval(outcome: Parameters<typeof completeRetrievalOffer>[1]): void;
  addRetrievalItem(input: NewRetrievalItem): Id;
  recordRetrievalAttempt(itemId: Id, result: RetrievalResult): void;
  // Widget / Live Activity
  refreshWidget(): Promise<void>;
  /** Re-check missed plans / reminder support, pending reminders and the widget. */
  refresh(): Promise<void>;
  /** Planner QA: replace the whole document (Developer tools only; refused otherwise). */
  debugReplace(state: PlannerState, devToolsEnabled: boolean): void;
}

const deviceTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

export function createPlannerStore(deps: PlannerStoreDeps) {
  const now = deps.now ?? Date.now;
  const tz = deps.timezone ?? deviceTimeZone;
  const ids = (prefix: string) => createId(prefix);
  let reminderChain: Promise<void> = Promise.resolve();

  return create<PlannerStoreState>()((set, get) => {
    const current = (): PlannerState => get().planner ?? createPlannerState(now(), tz());

    const persist = (planner: PlannerState) => {
      void deps.repository.save(planner).catch(() => undefined);
    };

    /** Commit a new planner document, then keep reminders and the widget in step. */
    const commit = (planner: PlannerState, extra: Partial<PlannerStoreState> = {}, opts: { sync?: boolean } = {}) => {
      set({ planner, ...extra });
      persist(planner);
      if (opts.sync !== false) {
        void get().syncReminders();
        void get().refreshWidget();
      }
    };

    const activeSession = (): FocusSession | null => deps.game.getState().save?.focus.active ?? null;

    const liveActivity = async (session: FocusSession | null) => {
      const planner = get().planner;
      if (!planner) return;
      if (session) {
        const content = liveActivityContent(planner, {
          endsAt: getEndsAt(session),
          plannedMinutes: session.plannedDurationMinutes,
          courseId: session.study?.courseId,
          assignmentId: session.study?.assignmentId,
          protection: session.study?.protectionResult ?? (session.protectionMode === 'none' ? 'notRequested' : 'unknown'),
        });
        const payload = { title: content.title, subtitle: content.subtitle, endsAtMs: content.endsAt, protection: content.protection };
        const id = get().activityId;
        if (id) await deps.widgets.updateActivity(id, payload);
        else set({ activityId: await deps.widgets.startActivity(payload) });
      } else if (get().activityId) {
        await deps.widgets.endActivity(get().activityId!);
        set({ activityId: null });
      }
    };

    // Watch the one session timer: starts update the Live Activity and silence
    // reminders; finished sessions become StudySession records.
    let lastActiveId: string | null = null;
    let lastHistoryId: string | null = null;
    const onGameChange = () => {
      const save = deps.game.getState().save;
      if (!save || !get().hydrated) return;
      const active = save.focus.active;
      if ((active?.id ?? null) !== lastActiveId) {
        lastActiveId = active?.id ?? null;
        void liveActivity(active);
        void get().syncReminders();
        void get().refreshWidget();
      }
      const finished = save.focus.history[0];
      if (finished && finished.id !== lastHistoryId) {
        lastHistoryId = finished.id;
        const planner = get().planner;
        if (planner) {
          const recorded = recordFinishedSession(planner, finished, ids);
          if (recorded !== planner) commit(updateSupport(recorded, now(), ids));
        }
      }
    };

    const startWith = async (minutes: number, ctxReq: { planId?: Id; assignmentId?: Id; courseId?: Id; source: StartSource }, protectionMode: ProtectionMode): Promise<Result<StartNotice, StartError>> => {
      const planner = current();
      const at = now();
      const ctx = buildStudyContext(planner, { ...ctxReq, protectionMode }, at);
      const result = await deps.game.getState().startFocus(minutes, { study: ctx, protectionMode, continueWithoutProtection: true });
      if (!result.ok) {
        const e = result.error;
        return { ok: false, error: e === 'no-pet' ? 'no-pet' : e === 'session-already-active' ? 'session-already-active' : e === 'invalid-duration' ? 'invalid' : 'protection' };
      }
      const started = deps.game.getState().save?.focus.active?.study ?? { ...ctx, protectionResult: result.value.protection };
      const notice: StartNotice = { planId: ctxReq.planId, protection: result.value.protection, error: result.value.protectionError };
      commit(logSessionStart(get().planner ?? planner, started, at, ids), { startNotice: notice });
      return { ok: true, value: notice };
    };

    return {
      planner: null,
      hydrated: false,
      draft: null,
      importStatus: 'idle',
      importProgress: null,
      importError: null,
      lastProposal: null,
      startNotice: null,
      pendingNavigation: null,
      activityId: null,

      async hydrate() {
        if (get().hydrated) return;
        let loaded: PlannerState | null = null;
        try {
          loaded = await deps.repository.load(now(), tz());
        } catch {
          loaded = null; // An unreadable planner was backed up by the repository; start empty, never crash.
        }
        const planner = loaded ?? createPlannerState(now(), tz());
        const permission = await deps.notifications.getPermission().catch(() => 'undetermined' as const);
        const prefs = { ...planner.preferences, notificationPermission: permission === 'granted' ? ('granted' as const) : permission === 'denied' ? ('denied' as const) : planner.preferences.notificationPermission === 'denied' ? ('denied' as const) : ('unknown' as const) };
        const save = deps.game.getState().save;
        lastActiveId = save?.focus.active?.id ?? null;
        // Sessions that finished before the planner existed are not back-filled; ones that finished while it was closed are.
        lastHistoryId = null;
        set({ planner: { ...planner, preferences: prefs }, hydrated: true });
        deps.notifications.setForegroundFilter(() => !activeSession());
        deps.notifications.onResponse((e) => void get().handleNotificationResponse(e));
        deps.notifications.onPresented((key) => get().markPresented(key));
        deps.game.subscribe(onGameChange);
        // Record any session that ended since the last run (each once).
        const history = save?.focus.history ?? [];
        let next = get().planner!;
        const known = new Set(Object.values(next.studySessions).map((s) => s.focusSessionId));
        const plannerCreatedAt = next.progress.supportChangedAt;
        for (const f of [...history].reverse()) if (!known.has(f.id) && f.study && (f.endedAt ?? 0) >= plannerCreatedAt) next = recordFinishedSession(next, f, ids);
        lastHistoryId = history[0]?.id ?? null;
        next = updateSupport(next, now(), ids);
        commit(next);
        if (save?.focus.active) void liveActivity(save.focus.active);
      },

      async reset() {
        await deps.notifications.cancelAll().catch(() => undefined);
        await deps.repository.clear().catch(() => undefined);
        if (get().activityId) await deps.widgets.endActivity(get().activityId!);
        const fresh = createPlannerState(now(), tz());
        set({ planner: fresh, draft: null, lastProposal: null, startNotice: null, activityId: null, importStatus: 'idle', importError: null });
        persist(fresh);
        void get().refreshWidget();
      },

      // ── Import ──────────────────────────────────────────────────
      async pickAndExtract() {
        set({ importStatus: 'picking', importError: null, importProgress: null });
        const doc = await deps.documents.pick().catch(() => null);
        if (!doc) return set({ importStatus: 'idle' });
        set({ importStatus: 'extracting' });
        const extracted = await deps.documents.extract(doc, (done, total) => set({ importProgress: { done, total } }));
        if (!extracted.ok) return set({ importStatus: 'error', importError: extracted.error === 'cancelled' ? null : extracted.error });
        set({ importStatus: 'parsing' });
        const draft = get().importText(joinPages(extracted.value), doc.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'emailText', { filename: doc.name, extraction: extracted.value.method });
        if (!draft) return;
        set({ importStatus: 'idle', importProgress: null });
      },

      importText(text, sourceType, opts = {}) {
        if (!text.trim()) {
          set({ importStatus: 'error', importError: 'empty' });
          return null;
        }
        const draft = createImportDraft(current(), { text, sourceType, filename: opts.filename, timezone: current().preferences.timezone, now: now(), parserVersion: opts.parserVersion ?? PARSER_VERSION, extraction: opts.extraction });
        if (!draft.items.length && !draft.duplicateOfSyllabusId) {
          set({ importStatus: 'error', importError: 'noItems', draft });
          return draft;
        }
        set({ draft, importStatus: 'idle', importError: null });
        return draft;
      },

      editDraftItem(key, patch) {
        const d = get().draft;
        if (d) set({ draft: editDraftItem(d, key, patch) });
      },
      confirmDraftItem(key) {
        const d = get().draft;
        if (d) set({ draft: confirmDraftItem(d, key) });
      },
      setDraftCourse(index, patch) {
        const d = get().draft;
        if (!d) return;
        set({ draft: { ...d, courses: d.courses.map((c) => (c.index === index ? { ...c, ...patch, name: patch.name ?? c.name } : c)) } });
      },
      cancelDraft() {
        // Discarding the draft drops the raw text with it.
        set({ draft: null, importStatus: 'idle', importError: null, importProgress: null });
      },
      commitDraft(keepOriginal) {
        const d = get().draft;
        if (!d) return null;
        const res = commitImport(current(), d, { now: now(), ids, keepOriginal });
        commit(res.state, { draft: null });
        return { courseIds: res.courseIds, assignmentIds: res.createdAssignmentIds };
      },

      // ── Manual entry ────────────────────────────────────────────
      addCourse(input) {
        const r = addCourse(current(), { ...input, timezone: input.timezone ?? current().preferences.timezone }, now(), ids);
        commit(r.state);
        return r.courseId;
      },
      updateCourse: (id, patch) => commit(updateCourse(current(), id, patch, now())),
      addAssignment(input) {
        const r = addAssignment(current(), input, now(), ids);
        commit(r.state);
        return r.assignmentId;
      },
      updateAssignment: (id, patch) => commit(updateAssignment(current(), id, patch, now()).state),
      confirmAssignment: (id) => commit(confirmAssignment(current(), id, now())),
      completeAssignment: (id) => commit(completeAssignment(current(), id, now(), ids)),
      reopenAssignment: (id) => commit(reopenAssignment(current(), id, now())),
      deleteAssignment: (id) => commit(deleteAssignment(current(), id, now())),
      resolveConflict(id, field, keep) {
        const a = current().assignments[id];
        if (a) commit({ ...current(), assignments: { ...current().assignments, [id]: resolveConflict(a, field, keep, now()) } });
      },

      // ── Planning ────────────────────────────────────────────────
      proposePlans(assignmentIds) {
        const { state, ...rest } = proposePlans(current(), now(), ids, assignmentIds);
        commit(state, { lastProposal: rest });
        return rest;
      },
      acceptPlan: (planId) => commit(acceptPlan(current(), planId, now(), ids)),
      acceptAllProposed(assignmentId) {
        commit(acceptAllProposed(current(), now(), ids, assignmentId), { lastProposal: null });
      },
      discardProposals: (assignmentId) => commit(discardProposals(current(), assignmentId), { lastProposal: null }),
      reschedulePlan: (planId, start, minutes) => commit(reschedulePlan(current(), planId, start, now(), ids, minutes)),
      skipPlan: (planId) => commit(skipPlan(current(), planId, now(), ids)),
      cancelPlan: (planId) => commit(cancelPlan(current(), planId, now(), ids)),
      dismissCapacityNote: (assignmentId) => commit(dismissCapacityNote(current(), assignmentId)),
      updatePreferences: (patch) => commit({ ...current(), preferences: { ...current().preferences, ...patch } }),

      // ── Reminders ───────────────────────────────────────────────
      async enableReminders() {
        // Asked only here, when the student turns reminders on (never at first launch).
        let permission = await deps.notifications.getPermission();
        if (permission === 'undetermined') permission = await deps.notifications.requestPermission();
        const prefs = current().preferences;
        commit({ ...current(), preferences: { ...prefs, remindersEnabled: permission === 'granted', notificationPermission: permission === 'granted' ? 'granted' : permission === 'denied' ? 'denied' : 'unknown' } });
        return permission;
      },
      disableReminders() {
        commit({ ...current(), preferences: { ...current().preferences, remindersEnabled: false } });
      },
      setReminderPreference(pref) {
        commit(updateSupport({ ...current(), preferences: { ...current().preferences, reminderPreference: pref } }, now(), ids));
      },
      answerRecovery(answer) {
        commit({ ...current(), progress: answerRecoveryOffer(current().progress, answer, now()) });
      },
      syncReminders() {
        // Serialised so overlapping syncs can never schedule duplicates.
        reminderChain = reminderChain.then(async () => {
          const planner = get().planner;
          if (!planner) return;
          const at = now();
          const active = activeSession();
          const withRules = syncReminderRules(planner, at, ids);
          const desired = desiredReminders(withRules, at, { activeSessionUntil: active ? getEndsAt(active) : null });
          const diff = diffReminders(withRules.scheduledReminders, desired);
          if (!diff.toCancel.length && !diff.toSchedule.length && withRules === planner) return;
          for (const c of diff.toCancel) await deps.notifications.cancel(c.osId).catch(() => undefined);
          const osIds: Record<string, string> = {};
          for (const d of diff.toSchedule) {
            try {
              osIds[d.key] = await deps.notifications.schedule({ key: d.key, title: d.title, body: d.body, fireAt: d.fireAt, categoryId: d.categoryId, data: { key: d.key, kind: d.kind, planId: d.kind === 'startCue' ? d.planIds[0] : undefined } });
            } catch {
              // Not scheduled: left out of the pending table so the next sync retries.
            }
          }
          const next = applyReminderDiff(get().planner ?? withRules, diff, osIds, at, ids);
          const merged: PlannerState = { ...next, reminderRules: withRules.reminderRules, plans: { ...next.plans, ...Object.fromEntries(Object.entries(withRules.plans).filter(([, p]) => p.reminderRuleId)) } };
          set({ planner: merged });
          persist(merged);
        });
        return reminderChain;
      },
      async handleNotificationResponse(event) {
        get().markPresented(event.key);
        if (event.action === 'start' && event.planId) {
          const r = await get().startPlan(event.planId, 'notification');
          set({ pendingNavigation: { to: r.ok ? 'session' : 'planner' } });
        } else set({ pendingNavigation: { to: 'planner' } });
      },
      markPresented(key) {
        const planner = get().planner;
        if (!planner) return;
        const next = markPresented(planner, key, now(), ids);
        if (next !== planner) commit(next, {}, { sync: false });
      },

      // ── Sessions ────────────────────────────────────────────────
      async startPlan(planId, source) {
        const plan = current().plans[planId];
        if (!plan || !(plan.status === 'accepted' || plan.status === 'rescheduled' || plan.status === 'proposed')) return { ok: false, error: 'no-plan' };
        if (plan.status === 'proposed') commit(acceptPlan(current(), planId, now(), ids), {}, { sync: false });
        const profile = plan.protectionProfileId ?? 'default';
        const mode: ProtectionMode = profile === 'default' ? deps.game.getState().save?.protection.mode ?? 'none' : profile;
        return startWith(plan.plannedMinutes, { planId, source }, mode);
      },
      async startStudy({ assignmentId, courseId, minutes, source }) {
        const mode = deps.game.getState().save?.protection.mode ?? 'none';
        return startWith(minutes, { assignmentId, courseId, source }, mode);
      },
      clearStartNotice: () => set({ startNotice: null }),
      consumeNavigation: () => set({ pendingNavigation: null }),

      // ── Retrieval ───────────────────────────────────────────────
      completeRetrieval(outcome) {
        commit(completeRetrievalOffer(current(), outcome, now(), ids), {}, { sync: false });
      },
      addRetrievalItem(input) {
        const r = addRetrievalItem(current(), input, now(), ids);
        commit(r.state, {}, { sync: false });
        return r.itemId;
      },
      recordRetrievalAttempt: (itemId, result) => commit(recordAttempt(current(), itemId, result, now(), ids), {}, { sync: false }),

      // ── Widget ──────────────────────────────────────────────────
      async refreshWidget() {
        const planner = get().planner;
        if (!planner) return;
        const save = deps.game.getState().save;
        const active = save?.focus.active ?? null;
        const pet = save?.pet ? { speciesId: save.pet.speciesId, stage: getProgression(save.pet.lifetimeXp).stage } : null;
        const snapshot = buildWidgetSnapshot(planner, now(), {
          activeSession: active ? { endsAt: getEndsAt(active), protection: active.study?.protectionResult ?? 'unknown' } : null,
          pet,
        });
        await deps.widgets.publishSnapshot(snapshot);
      },

      async refresh() {
        const planner = get().planner;
        if (!planner) return;
        const next = updateSupport(planner, now(), ids);
        if (next !== planner) commit(next);
        else {
          await get().syncReminders();
          await get().refreshWidget();
        }
      },

      debugReplace(state, devToolsEnabled) {
        if (!devToolsEnabled) return;
        commit(state);
      },
    };
  });
}
