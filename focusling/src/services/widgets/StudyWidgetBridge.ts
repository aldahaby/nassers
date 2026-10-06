import type { WidgetSnapshot } from '@/core';
import { StudylingNative, type LiveActivityPayload } from '../native/studylingNative';

/**
 * Hands the minimal widget snapshot to the iOS widget extension and drives the
 * study-session Live Activity. The mock records the latest values so the web
 * preview and Planner QA can render labelled mock widgets.
 */
export interface StudyWidgetBridge {
  readonly kind: 'native' | 'mock';
  publishSnapshot(snapshot: WidgetSnapshot): Promise<void>;
  startActivity(payload: LiveActivityPayload): Promise<string | null>;
  updateActivity(id: string, payload: LiveActivityPayload): Promise<void>;
  endActivity(id: string): Promise<void>;
}

export class NativeStudyWidgetBridge implements StudyWidgetBridge {
  readonly kind = 'native' as const;
  async publishSnapshot(snapshot: WidgetSnapshot) {
    await StudylingNative?.writeWidgetSnapshot(JSON.stringify(snapshot)).catch(() => undefined);
  }
  async startActivity(payload: LiveActivityPayload) {
    if (!StudylingNative?.liveActivitiesEnabled()) return null;
    return StudylingNative.startLiveActivity(payload).catch(() => null);
  }
  async updateActivity(id: string, payload: LiveActivityPayload) {
    await StudylingNative?.updateLiveActivity(id, payload).catch(() => undefined);
  }
  async endActivity(id: string) {
    await StudylingNative?.endLiveActivity(id).catch(() => undefined);
  }
}

export class MockStudyWidgetBridge implements StudyWidgetBridge {
  readonly kind = 'mock' as const;
  snapshot: WidgetSnapshot | null = null;
  activity: (LiveActivityPayload & { id: string; updates: number }) | null = null;
  private listeners = new Set<() => void>();
  private seq = 0;
  subscribe(l: () => void) {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  }
  private emit() {
    this.listeners.forEach((l) => l());
  }
  async publishSnapshot(snapshot: WidgetSnapshot) {
    this.snapshot = snapshot;
    this.emit();
  }
  async startActivity(payload: LiveActivityPayload) {
    this.activity = { ...payload, id: `mock-activity-${++this.seq}`, updates: 0 };
    this.emit();
    return this.activity.id;
  }
  async updateActivity(id: string, payload: LiveActivityPayload) {
    if (this.activity?.id === id) this.activity = { ...this.activity, ...payload, updates: this.activity.updates + 1 };
    this.emit();
  }
  async endActivity(id: string) {
    if (this.activity?.id === id) this.activity = null;
    this.emit();
  }
}
