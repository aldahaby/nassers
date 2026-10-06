/**
 * Local notifications for planner reminders (no push, no server). The planner
 * store decides WHAT should be pending (core/planner/reminderPolicy); this
 * service only talks to the OS.
 */
export type NotificationPermissionState = 'granted' | 'denied' | 'undetermined';

export interface LocalNotificationRequest {
  key: string;
  title: string;
  body: string;
  fireAt: number;
  categoryId?: 'studyling.start';
  data: { key: string; kind: 'startCue' | 'digest'; planId?: string };
}

export interface NotificationResponseEvent {
  key: string;
  planId?: string;
  /** 'start' = the Start & Lock action; 'open' = tapped the notification body. */
  action: 'start' | 'open';
}

export interface NotificationService {
  readonly kind: 'expo' | 'mock';
  getPermission(): Promise<NotificationPermissionState>;
  /** Shows the OS prompt (only when the student turns reminders on). */
  requestPermission(): Promise<NotificationPermissionState>;
  /** Returns the OS identifier. */
  schedule(request: LocalNotificationRequest): Promise<string>;
  cancel(osId: string): Promise<void>;
  cancelAll(): Promise<void>;
  /** Fires when the student taps a notification or its Start & Lock action. */
  onResponse(listener: (event: NotificationResponseEvent) => void): () => void;
  /** Fires when a notification is shown while the app is open (for exposure records). */
  onPresented(listener: (key: string) => void): () => void;
  /** Lets the app hide planner notifications while a study session is active. */
  setForegroundFilter(shouldShow: (key: string) => boolean): void;
  /** Opens the system settings page for this app (after a denial). */
  openSettings(): Promise<void>;
}
