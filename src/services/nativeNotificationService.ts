import { Capacitor, registerPlugin } from '@capacitor/core';
import { Badge } from '@capawesome/capacitor-badge';
import { PushNotifications, type PushNotificationSchema, type ActionPerformed } from '@capacitor/push-notifications';

export const XPRESSO_ORANGE = '#E58A3A';

interface XpressoNotificationPluginInterface {
  showConversationNotification(options: {
    conversationId: string;
    senderId?: string;
    senderName?: string;
    content: string;
    isGroup?: boolean;
    groupTitle?: string;
    unreadCount?: number;
    totalBadgeCount?: number;
  }): Promise<{ success: boolean }>;
  dismissConversation(options: { conversationId: string }): Promise<{ success: boolean }>;
  dismissAll(): Promise<{ success: boolean }>;
}

const XpressoNotification = registerPlugin<XpressoNotificationPluginInterface>('XpressoNotification');

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
let currentPushToken: string | null = (typeof localStorage !== 'undefined' ? localStorage.getItem('xpresso_fcm_token') : null);

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

      // 2. Setup FCM Push Notification listeners (FCM is the sole notification pipeline)
      if (Capacitor.isPluginAvailable('PushNotifications')) {
        await this.setupPushListeners().catch((pErr) => {
          console.warn('[NotificationService] Push listeners non-fatal error:', pErr);
        });
      }

      // 4. Listen for app foreground / resume to sync unread badge and clear delivered notifications if all read
      try {
        const { App } = await import('@capacitor/app');
        App.addListener('appStateChange', async (state) => {
          if (state.isActive) {
            try {
              const { authService } = await import('./authService');
              const user = await authService.getCurrentUser();
              if (user) {
                const { refreshTotalUnreadMessages } = await import('../stores/unread');
                const unread = await refreshTotalUnreadMessages(user.$id || user.id);
                if (unread === 0) {
                  await this.clearDeliveredNotifications();
                }
              }
            } catch (syncErr) {
              console.warn('[NotificationService] App resume badge sync warning:', syncErr);
            }
          }
        });
      } catch (appErr) {
        console.warn('[NotificationService] App listener setup non-fatal:', appErr);
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
        name: 'Conversations',
        description: 'Instant notifications for new direct messages and study group chats',
        importance: 5, // High: Heads-up banner, sound, vibration
        visibility: 1, // Public (shows on lock screen)
        vibration: true,
        lights: true,
        lightColor: XPRESSO_ORANGE,
      };

      if (Capacitor.isPluginAvailable('PushNotifications')) {
        await PushNotifications.createChannel(channel).catch(() => {});
      }
      console.info('[NotificationService] Notification channels configured with Xpresso orange badge support');
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
      // Check or Request FCM push notification permission
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

      // Register for FCM tokens safely if granted and push plugin available
      if (pushGranted && Capacitor.isPluginAvailable('PushNotifications')) {
        setTimeout(async () => {
          try {
            await PushNotifications.register();
          } catch (regErr) {
            console.warn('[NotificationService] FCM registration safely handled (non-fatal):', regErr);
          }
        }, 500);
      }

      return pushGranted;
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
        console.info('[NotificationService] FCM Registration Token received:', token.value ? token.value.substring(0, 15) + '...' : '(empty)');
        currentPushToken = token.value;
        if (typeof localStorage !== 'undefined' && token.value) {
          localStorage.setItem('xpresso_fcm_token', token.value);
        }
        this.syncPushTokenToBackend(token.value).catch((err) => {
          console.warn('[NotificationService] Token sync error:', err);
        });
      });

      // Registration failed
      await PushNotifications.addListener('registrationError', (error) => {
        console.warn('[NotificationService] Push registration failed safely:', error.error);
      });

      // Notification arrived while app is open
      await PushNotifications.addListener('pushNotificationReceived', async (notification: PushNotificationSchema) => {
        console.info('[NotificationService] Push notification received in foreground:', notification);
        try {
          const { authService } = await import('./authService');
          const user = await authService.getCurrentUser();
          if (user) {
            const { refreshTotalUnreadMessages } = await import('../stores/unread');
            await refreshTotalUnreadMessages(user.$id || user.id);
          }
        } catch (rErr) {
          console.warn('[NotificationService] Foreground push unread refresh error:', rErr);
        }
      });

      // Notification tapped by user
      await PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
        const data = notification.notification?.data || {};
        const conversationId = data.conversationId || data.conversation_id;
        console.info('[NotificationService] Push notification action performed:', { conversationId, data });
        if (conversationId) {
          this.removeDeliveredForConversation(conversationId).catch(() => {});
        }
        this.dispatchNotificationClick({ conversationId, data });
      });
    } catch (pushListenerErr) {
      console.warn('[NotificationService] Failed to bind push notification listeners:', pushListenerErr);
    }
  }

  /**
   * Post device push token to backend for FCM delivery
   */
  async syncPushTokenToBackend(token?: string) {
    const tokenToSync = token || currentPushToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('xpresso_fcm_token') : null);
    if (!tokenToSync) return;

    try {
      const { authService } = await import('./authService');
      const user = await authService.getCurrentUser();
      if (!user) {
        console.info('[NotificationService] Token held in local storage; awaiting user authentication to sync with profile.');
        return;
      }

      const { getSupabase, getSupabaseAdmin } = await import('./supabaseService');
      const adminClient = getSupabaseAdmin();
      const regularClient = getSupabase();
      const client = adminClient || regularClient;
      if (!client) return;

      const userId = user.$id || user.id;
      const { error } = await client
        .from('user_push_tokens')
        .upsert(
          {
            user_id: userId,
            token: tokenToSync,
            platform: Capacitor.getPlatform(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'token' }
        );

      if (error) {
        console.warn('[NotificationService] Failed to upsert token into user_push_tokens:', error.message);
      } else {
        console.info('[NotificationService] Successfully registered push token in Supabase for user:', userId);
      }
    } catch (err) {
      console.warn('[NotificationService] syncPushTokenToBackend caught error:', err);
    }
  }

  /**
   * Re-syncs any locally saved push token upon user login/signup
   */
  async syncSavedPushToken() {
    await this.syncPushTokenToBackend();
  }

  /**
   * Delete push token on logout
   */
  async removePushToken() {
    const tokenToRemove = currentPushToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('xpresso_fcm_token') : null);
    if (!tokenToRemove) return;

    try {
      const { getSupabase, getSupabaseAdmin } = await import('./supabaseService');
      const client = getSupabaseAdmin() || getSupabase();
      if (!client) return;

      await client
        .from('user_push_tokens')
        .delete()
        .eq('token', tokenToRemove)
        .catch(() => {});

      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('xpresso_fcm_token');
      }
      currentPushToken = null;
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
    type?: string;
    recipientId?: string;
    recipientIds?: string[];
  }) {
    try {
      const { getSupabase } = await import('./supabaseService');
      const supabase = getSupabase();
      if (!supabase) return;

      console.info('[NotificationService] Invoking send-push-notification for conversation:', payload.conversationId);
      const { data, error } = await supabase.functions
        .invoke('send-push-notification', {
          body: payload,
        });

      if (error) {
        console.warn('[NotificationService] send-push-notification returned error:', error);
      } else {
        console.info('[NotificationService] Push notification dispatch response:', data);
      }
    } catch (err) {
      console.warn('[NotificationService] Exception calling send-push-notification:', err);
    }
  }

  /**
   * Remove delivered notifications for a specific conversation from the notification drawer
   */
  async removeDeliveredForConversation(conversationId: string) {
    if (!Capacitor.isNativePlatform() || !conversationId) return;

    try {
      try {
        await XpressoNotification.dismissConversation({ conversationId }).catch(() => {});
      } catch (e) {}

      if (Capacitor.isPluginAvailable('PushNotifications')) {
        const delivered = await PushNotifications.getDeliveredNotifications().catch(() => null);
        if (delivered?.notifications?.length) {
          const matching = delivered.notifications.filter((n) => {
            const data = n.data || {};
            const extra = (n as any).extra || {};
            return (
              data.conversationId === conversationId ||
              data.conversation_id === conversationId ||
              extra.conversationId === conversationId ||
              extra.conversation_id === conversationId
            );
          });
          if (matching.length > 0) {
            await PushNotifications.removeDeliveredNotifications({ notifications: matching }).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.warn('[NotificationService] removeDeliveredForConversation non-fatal warning:', err);
    }
  }

  /**
   * Clear all delivered notifications from the notification drawer
   */
  async clearDeliveredNotifications() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      try {
        await XpressoNotification.dismissAll().catch(() => {});
      } catch (e) {}

      if (Capacitor.isPluginAvailable('PushNotifications')) {
        await PushNotifications.removeAllDeliveredNotifications().catch(() => {});
      }
    } catch (err) {
      console.warn('[NotificationService] clearDeliveredNotifications non-fatal warning:', err);
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
      if (validCount === 0) {
        if (Capacitor.isPluginAvailable('Badge')) {
          await Badge.clear().catch(() => {});
        }
        // Critical for Android & Samsung One UI:
        // Clear delivered tray notifications so Samsung Launcher removes the badge dot/counter
        await this.clearDeliveredNotifications();
      } else {
        if (Capacitor.isPluginAvailable('Badge')) {
          await Badge.set({ count: validCount }).catch(() => {});
        }
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
   * Shows notification on web/desktop browser fallback.
   * On native Android/iOS platforms, all notifications are handled exclusively via FCM.
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
    }
  }

  getPushToken() {
    return currentPushToken;
  }
}

export const nativeNotificationService = new NativeNotificationService();
