# Implementation Plan: Fix Xpresso Conversation Push Notifications

## Problem Analysis & Edge Function / Plugin Audit

Following your requirements, we performed an in-depth audit of:
1. **The FCM payload contract in the Supabase Edge Function** (`send-push-notification/index.ts`)
2. **The custom plugin implementation** (`plugins/capacitor-conversation-notifications`)
3. **The Android manifest and service registration**
4. **The client-side push token registration lifecycle**

### 1. Edge Function Analysis: Data vs Notification Blocks
- **Contract Requirement**: As detailed on Page 4 and Page 6 of the implementation guide, Android 11+ conversation notifications **must use pure `data` payloads with NO `notification` block**. 
- If a top-level `notification: { title, body }` block is present in the FCM message, Android's operating system intercepts the push while the app is in the background or killed, displays a generic card under standard "Alerts", and **never invokes `ChatMessagingService.onMessageReceived()`**.
- **Current State of the Edge Function**:
  - The Edge Function currently sends a `data` block, but also includes an `apns` block and lacked parsing for packed JSON attachment payloads (`{"c":"...", "a":[...]}`) used by photo and media messages.
  - The Edge Function looks up tokens in `user_push_tokens`. Because `user_push_tokens` in Supabase has 0 rows, the Edge Function never actually dispatched any push to FCM.

### 2. Plugin & Android Implementation Mishaps
- **FCM Service Collision in Manifest**: Both `@capacitor/push-notifications` and your custom plugin declare a `<service>` for `com.google.firebase.MESSAGING_EVENT`. Android only binds to **one** service per app. Because `@capacitor/push-notifications` is higher in Gradle dependency order, its default `MessagingService` can win and swallow pushes, preventing `ChatMessagingService` from ever running.
- **Missing `ACTION_VIEW` Intent Filter on `MainActivity`**: `ChatNotifier` creates conversation shortcuts and notification pending intents with `Intent.ACTION_VIEW`. In Samsung One UI and other custom Android ROMs, shortcuts require `MainActivity` to declare an intent-filter for `ACTION_VIEW` to prevent system rejection.
- **Orphaned Summary Notification**: When notifications are dismissed via `cancelChat`, `SUMMARY_ID` was left in the notification drawer on older Android versions if no child notifications remained.
- **Plugin Copy in `node_modules`**: The plugin is installed via `file:plugins/capacitor-conversation-notifications`, which npm copies into `node_modules`. Any updates to the plugin must be mirrored and synced via `npx cap sync android`.

### 3. Client Lifecycle Gap (Why `user_push_tokens` was 0 rows)
- In `src/App.svelte`, notification setup (`init()`, `requestPermissions()`, `syncSavedPushToken()`) was wrapped inside `if (activeUser)` in `onMount`.
- On a fresh install or when logged out, `activeUser` is null on startup.
- When the user logs in on the login screen, `authService.login()` only called `syncSavedPushToken()`. It never called `init()` or `requestPermissions()`, and `PushNotifications.register()` was never executed.
- Because `register()` never ran, Google never generated an FCM token, nothing was saved in `localStorage`, and the token was never sent to Supabase.
- In `messagingService.ts`, `sendImageMessage` never invoked `dispatchPushNotification()`, so sending photos produced zero notifications.

---

## Proposed Changes

### 1. Edge Function Hardening (`supabase/functions/send-push-notification/index.ts`)
- **Strict Data-Only Android Payload**: Ensure the FCM payload for Android contains **only** the `data` block and `android: { priority: "HIGH" }`, with zero top-level `notification` block.
- **Payload Sanitization & JSON Media Unpacking**: When message content is packed JSON (`{"c":"caption", "a":[...]}` from media/images), extract the caption before sanitizing with `toPlainText()`. If empty, apply `fallbackText` ("Photo", "Voice message", "Attachment").
- **Strict String Values**: Verify all keys (`type`, `chatId`, `senderId`, `senderName`, `text`, `fallbackText`, `ts`, `isGroup`, `chatTitle`, `avatarUrl`, `msgType`, `badge`) are guaranteed string primitives as required by the FCM data specification.

### 2. Android Manifest & Plugin Fixes
#### File: `android/app/src/main/AndroidManifest.xml`
- Add `xmlns:tools="http://schemas.android.com/tools"` to `<manifest>`.
- Add `<service android:name="com.capacitorjs.plugins.pushnotifications.MessagingService" tools:node="remove" />` to remove Capacitor's default listener.
- Explicitly register `com.xpresso.convnotif.ChatMessagingService` as the authoritative receiver for `com.google.firebase.MESSAGING_EVENT`.
- Add the `android.intent.action.VIEW` intent filter to `MainActivity` for shortcut handling.

#### File: `plugins/capacitor-conversation-notifications/android/src/main/java/com/xpresso/convnotif/ChatNotifier.java`
- In `cancelChat`, check if active notifications for the app are now empty; if so, cancel the summary notification (`SUMMARY_ID`) so no empty drawer items persist.
- Sync changes to `node_modules/capacitor-conversation-notifications` and run `npx cap sync android`.

### 3. Push Token Registration & Auth Lifecycle
#### File: `src/services/nativeNotificationService.ts`
- Implement an authoritative `registerAndSyncPushToken(userId?: string)`:
  - Initializes push listeners unconditionally.
  - Calls `PushNotifications.requestPermissions()` and `PushNotifications.register()`.
  - When the token arrives (via `registration` listener or cached in `localStorage`/memory), immediately upserts into `user_push_tokens` in Supabase with `onConflict: 'token'`.
  - Includes retry resilience if the network is briefly offline during app boot.

#### File: `src/services/authService.ts` & `src/App.svelte`
- Call `nativeNotificationService.registerAndSyncPushToken()` on:
  - App startup (for restored sessions).
  - Successful user login (`authService.login`).
  - Successful user signup (`authService.signup`).
- Clean up the token on `authService.logout()`.

#### File: `src/services/messagingService.ts`
- In `sendImageMessage`, add the `dispatchPushNotification` call after the image is saved to Supabase, matching the text message flow.

---

## Verification Plan

1. **Compilation & Build Check**:
   - Run `compile_applet` to verify that all TypeScript services and Svelte files compile without errors.
2. **Capacitor Android Sync**:
   - Run `npx cap sync android` to ensure the updated manifest and plugin changes are properly compiled into the Android project.
3. **Real User-to-User Testing**:
   - Log into Account A on your physical Android device.
   - The app will automatically register the device with FCM and store the token in Supabase `user_push_tokens`.
   - Log into Account B on the web preview.
   - Send a message (e.g. `\color[#1d4ed8]{Hello}`) from Account B to Account A while Account A has the app closed or in the background.
   - Check the Android notification shade: verify it appears under **Conversations** with the sender's avatar circle, name, and clean text `Hello` (no markup).
