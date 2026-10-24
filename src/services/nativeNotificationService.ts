import { Capacitor } from '@capacitor/core';
import { Badge } from '@capawesome/capacitor-badge';
import { PushNotifications, type PushNotificationSchema } from '@capacitor/push-notifications';
import { ConvNotif } from '../native/conversationNotifications';
import { effectiveBadgeCount } from '../native/badgeCount';

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

let pendingClick: { conversationId?: string; data?: any } | null = null;
let isInitialized = false;
let currentPushToken: string | null = (typeof localStorage !== 'undefined' ? localStorage.getItem('xpresso_fcm_token') : null);

class NativeNotificationService {
  /**
   * Listen for user clicking a notification banner to navigate into a chat
   */
  onNotificationClick(callback: NotificationClickCallback) {
    clickListeners.push(callback);
    // A tap that cold-started the app arrives before the UI subscribes; replay it once.
    if (pendingClick) {
      const queued = pendingClick;
      pendingClick = null;
      callback(queued);
    }
    return () => {
      const idx = clickListeners.indexOf(callback);
      if (idx !== -1) clickListeners.splice(idx, 1);
    };
  }

  private dispatchNotificationClick(data: { conversationId?: string; data?: any }) {
    if (clickListeners.length === 0) {
      pendingClick = data;
      return;
    }
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
      // 1. FCM token registration (the conversation-notifications plugin renders chat messages)
      if (Capacitor.isPluginAvailable('PushNotifications')) {
        await this.setupPushListeners().catch((pErr) => {
          console.warn('[NotificationService] Push listeners non-fatal error:', pErr);
        });
      }

      // 2. Notification taps from the conversation-notifications plugin
      if (Capacitor.getPlatform() === 'android') {
        await ConvNotif.addListener('chatOpened', ({ chatId }) => {
          this.dispatchNotificationClick({ conversationId: chatId });
        }).catch((err) => console.warn('[NotificationService] chatOpened listener error:', err));

        ConvNotif.getPendingChat()
          .then(({ chatId }) => {
            if (chatId) this.dispatchNotificationClick({ conversationId: chatId });
          })
          .catch(() => {});
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
                // Only refresh the badge here. Do NOT wipe the tray when the count is 0: the count
                // comes from the local database, which lags behind (no Realtime), so 0 can simply
                // mean "not synced yet" while notifications for new messages are on screen.
                // Notifications are dismissed per chat when it is read (removeDeliveredForConversation).
                await refreshTotalUnreadMessages(user.$id || user.id);
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

      // Register for FCM tokens directly if granted and push plugin available
      if (pushGranted && Capacitor.isPluginAvailable('PushNotifications')) {
        try {
          await PushNotifications.register();
        } catch (regErr) {
          console.warn('[NotificationService] FCM registration safely handled (non-fatal):', regErr);
        }
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
          const user = await authService.getCurrentUser() || authService.getOfflineUser();
          if (user) {
            const { refreshTotalUnreadMessages } = await import('../stores/unread');
            await refreshTotalUnreadMessages(user.$id || user.id);
          }
        } catch (rErr) {
          console.warn('[NotificationService] Foreground push unread refresh error:', rErr);
        }
      });
    } catch (pushListenerErr) {
      console.warn('[NotificationService] Failed to bind push notification listeners:', pushListenerErr);
    }
  }

  /**
   * Post device push token to backend for FCM delivery
   */
  async syncPushTokenToBackend(token?: string, explicitUserId?: string) {
    const tokenToSync = token || currentPushToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('xpresso_fcm_token') : null);
    if (!tokenToSync) return;

    try {
      let targetUserId = explicitUserId;
      if (!targetUserId) {
        const { authService } = await import('./authService');
        const user = await authService.getCurrentUser() || authService.getOfflineUser();
        targetUserId = user?.$id || user?.id;
      }

      if (!targetUserId) {
        console.info('[NotificationService] Token held in local storage; awaiting user authentication to sync with profile.');
        return;
      }

      const { getSupabase } = await import('./supabaseService');
      const client = getSupabase();
      if (!client) return;

      const { error } = await client.rpc('register_push_token', {
        p_token: tokenToSync,
        p_platform: Capacitor.getPlatform(),
      });

      if (error) {
        console.warn('[NotificationService] Failed to upsert token into user_push_tokens:', error.message);
      } else {
        console.info('[NotificationService] Successfully registered push token in Supabase for user:', targetUserId);
      }
    } catch (err) {
      console.warn('[NotificationService] syncPushTokenToBackend caught error:', err);
    }
  }

  /**
   * Authoritative registration flow: initializes listeners, requests permissions,
   * registers with FCM, and syncs token with Supabase immediately.
   */
  async registerAndSyncPushToken(explicitUserId?: string) {
    await this.init();
    if (!Capacitor.isNativePlatform()) return;

    await this.requestPermissions();
    const token = currentPushToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('xpresso_fcm_token') : null);
    if (token) {
      await this.syncPushTokenToBackend(token, explicitUserId);
    }
  }

  /**
   * Re-syncs any locally saved push token upon user login/signup
   */
  async syncSavedPushToken(explicitUserId?: string) {
    await this.syncPushTokenToBackend(undefined, explicitUserId);
  }

  /**
   * Delete push token on logout
   */
  async removePushToken() {
    if (Capacitor.getPlatform() === 'android') {
      await ConvNotif.clearAll().catch(() => {});
    }
    const tokenToRemove = currentPushToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('xpresso_fcm_token') : null);
    if (!tokenToRemove) return;

    try {
      const { getSupabase } = await import('./supabaseService');
      const client = getSupabase();
      if (!client) return;

      await client.rpc('unregister_push_token', { p_token: tokenToRemove }).then(() => {}, () => {});

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
    if (Capacitor.getPlatform() !== 'android' || !conversationId) return;
    await ConvNotif.clearChat({ chatId: conversationId }).catch(() => {});
  }

  /**
   * Tell the plugin which chat is on screen so it does not notify for it (null when none)
   */
  async setActiveChat(conversationId: string | null) {
    if (Capacitor.getPlatform() !== 'android') return;
    await ConvNotif.setActiveChat({ chatId: conversationId }).catch(() => {});
  }

  /**
   * Pre-create conversation shortcuts so Android files notifications under Conversations
   */
  async syncConversationShortcuts(
    conversations: { id: string; name?: string; avatarUrl?: string | null; isGroup?: boolean }[]
  ) {
    if (Capacitor.getPlatform() !== 'android') return;
    for (const c of conversations) {
      if (!c?.id || !c.name) continue;
      const avatar = c.avatarUrl && /^https:\/\//i.test(c.avatarUrl) ? c.avatarUrl : undefined;
      await ConvNotif.upsertShortcut({
        chatId: c.id,
        name: c.name,
        avatarUrl: avatar,
        isGroup: !!c.isGroup,
      }).catch(() => {});
    }
  }

  /**
   * Posts a local conversation notification (no server, no FCM) and returns the state that decides
   * whether pushes can appear. Used to tell phone-side problems from server-side ones.
   */
  async runNotificationSelfTest() {
    if (Capacitor.getPlatform() !== 'android') return null;
    const diagnostics = await ConvNotif.getDiagnostics();
    await ConvNotif.showTestNotification();
    return diagnostics;
  }

  /**
   * Clear all delivered notifications from the notification drawer.
   * Wipes everything the app has shown, including conversation notifications: do not call it from
   * anything driven by the local unread count.
   */
  async clearDeliveredNotifications() {
    if (!Capacitor.isNativePlatform()) return;
    try {
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
  async setBadge(count: number, opts: { force?: boolean } = {}) {
    let validCount = Math.max(0, Math.round(count));

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

    // Android: never go below the unread count the native side holds for the notification tray.
    // `count` comes from the local database, which lags behind new pushes, so a stale 1 used to
    // overwrite the real number. Older APKs without getUnreadTotal() just keep using `count`.
    if (!opts.force && Capacitor.getPlatform() === 'android') {
      try {
        const { total } = await ConvNotif.getUnreadTotal();
        validCount = effectiveBadgeCount(validCount, total);
      } catch {
        /* native side too old to know: keep the database count */
      }
    }

    try {
      if (validCount === 0) {
        if (Capacitor.isPluginAvailable('Badge')) {
          await Badge.clear().catch(() => {});
        }
        // Do NOT clear the notification tray here. This runs on every unread recalculation, and the
        // count is computed from the local database, which lags behind new pushes (no Realtime).
        // A count of 0 right after a push arrives would delete the notification that was just posted.
        // Notifications are removed per chat when the chat is read (removeDeliveredForConversation).
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
    await this.setBadge(0, { force: true });
  }

  /**
   * Shows notification on web/desktop browser fallback.
   * On native Android/iOS platforms, notifications are rendered by the conversation-notifications plugin from FCM data messages.
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
