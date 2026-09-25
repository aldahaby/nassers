import type { BlockTarget } from '@/core';
import type {
  BlockRequest,
  ScreenTimeAuthorization,
  ScreenTimeListener,
  ScreenTimeService,
} from './ScreenTimeService';

/**
 * Prototype implementation: nothing is actually blocked. Sessions always
 * succeed unless a developer calls `simulateViolation()` from the debug tools.
 */
export class MockScreenTimeService implements ScreenTimeService {
  readonly kind = 'mock' as const;
  private authorization: ScreenTimeAuthorization = 'notDetermined';
  private active: BlockRequest | null = null;
  private listeners = new Set<ScreenTimeListener>();

  async getAuthorization(): Promise<ScreenTimeAuthorization> {
    return this.authorization;
  }

  async requestAuthorization(): Promise<ScreenTimeAuthorization> {
    this.authorization = 'approved';
    return this.authorization;
  }

  async selectTargets(current: BlockTarget[]): Promise<BlockTarget[]> {
    return current;
  }

  async startBlocking(request: BlockRequest): Promise<void> {
    this.active = request;
  }

  async stopBlocking(sessionId: string): Promise<void> {
    if (this.active?.sessionId === sessionId) this.active = null;
  }

  subscribe(listener: ScreenTimeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get activeRequest(): BlockRequest | null {
    return this.active;
  }

  /** Debug: pretend the user opened a blocked app. */
  simulateViolation(): void {
    if (!this.active) return;
    const event = {
      type: 'violation' as const,
      sessionId: this.active.sessionId,
      targetId: this.active.targets[0]?.id ?? 'unknown',
      at: Date.now(),
    };
    this.listeners.forEach((listener) => listener(event));
  }
}
