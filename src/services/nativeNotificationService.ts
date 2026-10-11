import { Capacitor } from '@capacitor/core';
import { Badge } from '@capawesome/capacitor-badge';
import { PushNotifications, type PushNotificationSchema, type ActionPerformed } from '@capacitor/push-notifications';
import { LocalNotifications, type LocalNotificationSchema, type ActionPerformed as LocalActionPerformed } from '@capacitor/local-notifications';

export interface NotificationPayload {
  id?: number;
  title: string;
  body: string;
  conversationId?: string;
  senderId?: string;
  senderName?: string;
  extra?: Record<string, any>;
}

type NotificationClickCallback = (payload: { conversationId?: string; data?: any }) => void;
const clickListeners: NotificationClickCallback[] = [];

let isInitialized = false;
let currentPushToken: string | null = null;

class NativeNotificationService {
  /**
   * Listen for user clicking a notification banner to navigate into a chat
   */
  onNotificationClick(callback: NotificationClickCallback) {
    clickListeners.push(callback);
    return () => {
      const idx = clickListeners.indexOf(callback);
      if (idx !== -1) clickListeners.splice(idx, 1);
    };
  }

  private dispatchNotificationClick(data: { conversationId?: string; data?: any }) {
    clickListeners.forEach((listener) => {
      try {
        listener(data);
      } catch (err) {
        console.error('[NotificationService] Error executing click listener:', err);
      }
    });
  }

  /**
   * Initialize native channels, badges, and push listeners
   */
  async init() {
    if (isInitialized) return;
    isInitialized = true;

    if (!Capacitor.isNativePlatform()) {
      console.info('[NotificationService] Web environment: Native push/badge hooks active in fallback mode');
      return;
    }

    try {
      // 1. Create Android Notification Channel (Required for Android 8.0+)
      await this.setupChannels().catch((err) => {
        console.warn('[NotificationService] Channel setup non-fatal error:', err);
      });

      // 2. Setup Local Notification action listener if plugin available
      if (Capacitor.isPluginAvailable('LocalNotifications')) {
        try {
          await LocalNotifications.addListener('localNotificationActionPerformed', (notification: LocalActionPerformed) => {
            const extra = notification.notification?.extra || {};
            const conversationId = extra.conversationId || extra.conversation_id;
            console.info('[NotificationService] Local notification clicked:', { conversationId, extra });
            this.dispatchNotificationClick({ conversationId, data: extra });
          });
        } catch (lErr) {
          console.warn('[NotificationService] Local notification listener error:', lErr);
        }
      }

      // 3. Setup Push Notification listeners if plugin available
      if (Capacitor.isPluginAvailable('PushNotifications')) {
        await this.setupPushListeners().catch((pErr) => {
          console.warn('[NotificationService] Push listeners non-fatal error:', pErr);
        });
      }
    } catch (err) {
      console.warn('[NotificationService] Error initializing native notification service:', err);
    }
  }

  /**
   * Create high-importance notification channel with badge support
   */
  async setupChannels() {
    if (!Capacitor.isNativePlatform()) return;

    try {
      const channel = {
        id: 'xpresso_messages',
        name: 'New Messages',
        description: 'Instant notifications for new direct messages and study group chats',
        importance: 5, // High: Heads-up banner, sound, vibration
        visibility: 1, // Public (shows on lock screen)
        vibration: true,
        lights: true,
        lightColor: '#0050D8',
      };

      if (Capacitor.isPluginAvailable('LocalNotifications')) {
        await LocalNotifications.createChannel(channel).catch(() => {});
      }
      if (Capacitor.isPluginAvailable('PushNotifications')) {
        await PushNotifications.createChannel(channel).catch(() => {});
      }
      console.info('[NotificationService] Notification channels configured with badge support');
    } catch (err) {
      console.warn('[NotificationService] Failed to create notification channel:', err);
    }
  }

  /**
   * Request permissions from the user (Required on Android 13+ and iOS)
   */
  async requestPermissions(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      if ('Notification' in window) {
        try {
          const perm = await Notification.requestPermission();
          return perm === 'granted';
        } catch {
          return false;
        }
      }
      return false;
    }

    try {
      // 1. Check or Request push notification permission if available
      let pushGranted = false;
      if (Capacitor.isPluginAvailable('PushNotifications')) {
        try {
          const checkStatus = await PushNotifications.checkPermissions().catch(() => null);
          if (checkStatus?.receive === 'granted') {
            pushGranted = true;
          } else {
            const pushStatus = await PushNotifications.requestPermissions();
            pushGranted = pushStatus.receive === 'granted';
          }
        } catch (e) {
          console.warn('[NotificationService] Push permission request error:', e);
        }
      }

      // 2. Request local notifications permission separately if available
      let localGranted = false;
      if (Capacitor.isPluginAvailable('LocalNotifications')) {
        try {
          const checkLocal = await LocalNotifications.checkPermissions().catch(() => null);
          if (checkLocal?.display === 'granted') {
            localGranted = true;
          } else {
            const localStatus = await LocalNotifications.requestPermissions();
            localGranted = localStatus.display === 'granted';
          }
        } catch (e) {
          console.warn('[NotificationService] Local notification permission request error:', e);
        }
      }

      // 3. Register for FCM tokens safely if granted and push plugin available
      if (pushGranted && Capacitor.isPluginAvailable('PushNotifications')) {
        setTimeout(async () => {
          try {
            await PushNotifications.register();
          } catch (regErr) {
            console.warn('[NotificationService] FCM registration safely handled (non-fatal):', regErr);
          }
        }, 500);
      }

      return pushGranted || localGranted;
    } catch (err) {
      console.warn('[NotificationService] Permission request error:', err);
      return false;
    }
  }

  private async setupPushListeners() {
    if (!Capacitor.isPluginAvailable('PushNotifications')) return;

    try {
      // Successfully registered with FCM
      await PushNotifications.addListener('registration', (token) => {
        console.info('[NotificationService] FCM Registration Token:', token.value);
        currentPushToken = token.value;
        this.syncPushTokenToBackend(token.value).catch(() => {});
      });

      // Registration failed
      await PushNotifications.addListener('registrationError', (error) => {
        console.warn('[NotificationService] Push registration failed safely:', error.error);
      });

      // Notification arrived while app is open
      await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        console.info('[NotificationService] Push notification received in foreground:', notification);
        // Increment or refresh badge
        const badgeVal = notification.badge;
        if (typeof badgeVal === 'number') {
          this.setBadge(badgeVal);
        }
      });

      // Notification tapped by user
      await PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
        const data = notification.notification?.data || {};
        const conversationId = data.conversationId || data.conversation_id;
        console.info('[NotificationService] Push notification action performed:', { conversationId, data });
        this.dispatchNotificationClick({ conversationId, data });
      });
    } catch (pushListenerErr) {
      console.warn('[NotificationService] Failed to bind push notification listeners:', pushListenerErr);
    }
  }

  /**
   * Post device push token to backend for FCM delivery
   */
  async syncPushTokenToBackend(token: string) {
    try {
      const { authService } = await import('./authService');
      const user = await authService.getCurrentUser();
      if (!user) return;

      const { getSupabase } = await import('./supabaseService');
      const supabase = getSupabase();
      if (!supabase) return;

      // Upsert into user_push_tokens if table exists
      await supabase
        .from('user_push_tokens')
        .upsert(
          {
            user_id: user.$id || user.id,
            token,
            platform: Capacitor.getPlatform(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'token' }
        )
        .catch(() => {});
    } catch (err) {
      // Non-fatal if table not yet provisioned
    }
  }

  /**
   * Delete push token on logout
   */
  async removePushToken() {
    if (!currentPushToken) return;
    try {
      const { getSupabase } = await import('./supabaseService');
      const supabase = getSupabase();
      if (!supabase) return;

      await supabase
        .from('user_push_tokens')
        .delete()
        .eq('token', currentPushToken)
        .catch(() => {});
    } catch (err) {}
  }

  /**
   * Dispatches push notification via Supabase Edge Function to notify offline recipients
   */
  async dispatchPushNotification(payload: {
    conversationId: string;
    senderId: string;
    senderName?: string;
    content: string;
  }) {
    try {
      const { getSupabase } = await import('./supabaseService');
      const supabase = getSupabase();
      if (!supabase) return;

      await supabase.functions
        .invoke('send-push-notification', {
          body: payload,
        })
        .catch(() => {});
    } catch (err) {
      // Non-blocking
    }
  }

  /**
   * Set the unread badge count on the launcher icon (1, 2, 3...)
   */
  async setBadge(count: number) {
    const validCount = Math.max(0, Math.round(count));

    if (!Capacitor.isNativePlatform()) {
      // PWA Badging API fallback
      if ('setAppBadge' in navigator) {
        if (validCount > 0) {
          (navigator as any).setAppBadge(validCount).catch(() => {});
        } else {
          (navigator as any).clearAppBadge().catch(() => {});
        }
      }
      return;
    }

    try {
      if (!Capacitor.isPluginAvailable('Badge')) return;
      if (validCount === 0) {
        await Badge.clear().catch(() => {});
      } else {
        await Badge.set({ count: validCount }).catch(() => {});
      }
    } catch (err) {
      // Silently catch launchers that don't support badging
    }
  }

  /**
   * Clear the unread badge from the app icon
   */
  async clearBadge() {
    await this.setBadge(0);
  }

  /**
   * Trigger a native local notification (shows in Android notification tray)
   */
  async showLocalNotification(payload: NotificationPayload) {
    if (!Capacitor.isNativePlatform()) {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(payload.title, {
          body: payload.body,
          icon: '/pwa-192x192.png',
          data: payload.extra || { conversationId: payload.conversationId },
        });
      }
      return;
    }

    try {
      if (!Capacitor.isPluginAvailable('LocalNotifications')) return;

      const id = payload.id || Math.floor(Math.random() * 100000);
      const notification: LocalNotificationSchema = {
        id,
        title: payload.title,
        body: payload.body,
        channelId: 'xpresso_messages',
        smallIcon: 'ic_launcher_foreground',
        iconColor: '#0050D8',
        extra: {
          conversationId: payload.conversationId,
          senderId: payload.senderId,
          senderName: payload.senderName,
          ...(payload.extra || {}),
        },
      };

      await LocalNotifications.schedule({
        notifications: [notification],
      });
    } catch (err) {
      console.warn('[NotificationService] Failed to schedule local notification:', err);
    }
  }

  getPushToken() {
    return currentPushToken;
  }
}

export const nativeNotificationService = new NativeNotificationService();
