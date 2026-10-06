import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { LocalNotificationRequest, NotificationPermissionState, NotificationResponseEvent, NotificationService } from './NotificationService';

const START_ACTION = 'studyling.startLock';

/**
 * expo-notifications implementation (iOS/Android builds). Planner reminders
 * use the default system sound only; in-app Sound Effects are separate.
 */
export class ExpoNotificationService implements NotificationService {
  readonly kind = 'expo' as const;
  private filter: (key: string) => boolean = () => true;
  private presented = new Set<(key: string) => void>();

  constructor() {
    Notifications.setNotificationHandler({
      handleNotification: async (n) => {
        const key = String(n.request.content.data?.key ?? '');
        const show = this.filter(key);
        if (show) this.presented.forEach((l) => l(key));
        return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: false, shouldSetBadge: false };
      },
    });
    void Notifications.setNotificationCategoryAsync('studyling.start', [
      { identifier: START_ACTION, buttonTitle: 'Start & Lock', options: { opensAppToForeground: true } },
    ]).catch(() => undefined);
  }

  private static map(status: string): NotificationPermissionState {
    return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
  }

  async getPermission() {
    return ExpoNotificationService.map((await Notifications.getPermissionsAsync()).status);
  }

  async requestPermission() {
    return ExpoNotificationService.map((await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } })).status);
  }

  async schedule(req: LocalNotificationRequest) {
    return Notifications.scheduleNotificationAsync({
      content: { title: req.title, body: req.body, data: req.data, sound: 'default', ...(req.categoryId ? { categoryIdentifier: req.categoryId } : {}) },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: req.fireAt },
    });
  }

  async cancel(osId: string) {
    await Notifications.cancelScheduledNotificationAsync(osId);
  }

  async cancelAll() {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  onResponse(listener: (event: NotificationResponseEvent) => void) {
    const handle = (r: Notifications.NotificationResponse | null) => {
      if (!r) return;
      const data = r.notification.request.content.data ?? {};
      listener({ key: String(data.key ?? ''), planId: typeof data.planId === 'string' ? data.planId : undefined, action: r.actionIdentifier === START_ACTION ? 'start' : 'open' });
    };
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    // A response that launched the app from a killed state.
    void Notifications.getLastNotificationResponseAsync().then((r) => {
      handle(r);
      void Notifications.clearLastNotificationResponseAsync();
    });
    return () => sub.remove();
  }

  onPresented(listener: (key: string) => void) {
    this.presented.add(listener);
    return () => {
      this.presented.delete(listener);
    };
  }

  setForegroundFilter(shouldShow: (key: string) => boolean) {
    this.filter = shouldShow;
  }

  async openSettings() {
    await Linking.openSettings();
  }
}
