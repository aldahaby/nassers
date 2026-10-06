import type { LocalNotificationRequest, NotificationPermissionState, NotificationResponseEvent, NotificationService } from './NotificationService';

/**
 * Web/dev stand-in. Keeps "scheduled" notifications in memory so Planner QA
 * can fire them, show a mock banner, and simulate Start & Lock or a denial.
 * Nothing is delivered by the browser.
 */
export class MockNotificationService implements NotificationService {
  readonly kind = 'mock' as const;
  permission: NotificationPermissionState = 'undetermined';
  /** QA: what the next permission prompt answers. */
  nextAnswer: 'granted' | 'denied' = 'granted';
  pending = new Map<string, LocalNotificationRequest & { osId: string }>();
  delivered: (LocalNotificationRequest & { at: number })[] = [];
  private responders = new Set<(e: NotificationResponseEvent) => void>();
  private presenters = new Set<(key: string) => void>();
  private filter: (key: string) => boolean = () => true;
  private seq = 0;

  async getPermission() {
    return this.permission;
  }
  async requestPermission() {
    if (this.permission === 'undetermined') this.permission = this.nextAnswer;
    return this.permission;
  }
  async schedule(req: LocalNotificationRequest) {
    const osId = `mock-${++this.seq}`;
    this.pending.set(osId, { ...req, osId });
    return osId;
  }
  async cancel(osId: string) {
    this.pending.delete(osId);
  }
  async cancelAll() {
    this.pending.clear();
  }
  onResponse(listener: (e: NotificationResponseEvent) => void) {
    this.responders.add(listener);
    return () => {
      this.responders.delete(listener);
    };
  }
  onPresented(listener: (key: string) => void) {
    this.presenters.add(listener);
    return () => {
      this.presenters.delete(listener);
    };
  }
  setForegroundFilter(shouldShow: (key: string) => boolean) {
    this.filter = shouldShow;
  }
  async openSettings() {}

  /** QA: the earliest pending notification. */
  next() {
    return [...this.pending.values()].sort((a, b) => a.fireAt - b.fireAt)[0] ?? null;
  }
  /** QA: deliver a notification now. Returns whether it would be shown (active sessions hide it). */
  deliver(osId: string, at: number): boolean {
    const n = this.pending.get(osId);
    if (!n) return false;
    this.pending.delete(osId);
    const shown = this.filter(n.key);
    if (shown) {
      this.delivered.push({ ...n, at });
      this.presenters.forEach((l) => l(n.key));
    }
    return shown;
  }
  /** QA: the student taps Start & Lock (or the body). */
  respond(key: string, action: 'start' | 'open') {
    const n = this.delivered.find((d) => d.key === key);
    this.responders.forEach((l) => l({ key, planId: n?.data.planId, action }));
  }
}
