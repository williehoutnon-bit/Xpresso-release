/**
 * Copy this file (and sanitize.ts) into the app, e.g. src/lib/native/.
 * No npm import of the plugin is needed: registerPlugin() talks to the native class by name.
 */
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface ConversationNotificationsPlugin {
  /** Pre-create/refresh the conversation shortcut for a chat (e.g. when the chat list loads). */
  upsertShortcut(o: { chatId: string; name: string; avatarUrl?: string; isGroup?: boolean }): Promise<void>;
  /** The chat currently on screen (no notification is shown for it); null when none. */
  setActiveChat(o: { chatId: string | null }): Promise<void>;
  /** Dismiss a chat's notification, e.g. once its messages are read. */
  clearChat(o: { chatId: string }): Promise<void>;
  /** Dismiss everything and drop all shortcuts (logout). */
  clearAll(): Promise<void>;
  /** Chat that cold-started the app from a notification tap; returns once, then null. */
  getPendingChat(): Promise<{ chatId: string | null }>;
  /** Posts a conversation notification locally (no server, no FCM) to test the phone side. */
  showTestNotification(): Promise<void>;
  /** Permission, channel and FCM-service state that decides whether a push can appear. */
  getDiagnostics(): Promise<{
    sdk: number;
    notificationsEnabled: boolean;
    channelImportance?: number;
    fcmServiceThatWins: string;
    dynamicShortcuts: number;
    appInForeground: boolean;
    chatOnScreen: string;
  }>;
  /** App was already running and a notification was tapped. */
  addListener(
    eventName: 'chatOpened',
    listener: (e: { chatId: string }) => void
  ): Promise<PluginListenerHandle>;
}

export const ConvNotif = registerPlugin<ConversationNotificationsPlugin>('ConversationNotifications');
