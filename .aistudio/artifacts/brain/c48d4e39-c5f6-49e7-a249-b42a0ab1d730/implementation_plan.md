# Implementation Plan: Notification Avatar, Badge Accuracy & Xpresso Branding

This plan addresses the five specific improvements for Xpresso conversation notifications based on your answers:
1. Displaying the sender's actual profile avatar in the notification tray (falling back to a monogram letter circle if no photo is available).
2. Fixing the launcher icon badge so it accurately reflects total unread messages instead of sticking at 1.
3. Automatically dismissing notifications from the system tray when the user opens the app and reads the conversation.
4. Reducing the badge count based on read messages in real time.
5. Ensuring the app name "Xpresso" and the Xpresso icon with brand blue (`#0050D8`) appear clearly on the notification cards.

---

## Proposed Changes

### 1. Sender Avatar Handling (Tray Profile Photo)
#### File: `supabase/functions/send-push-notification/index.ts`
- When resolving `senderProfile`:
  - If `senderProfile.avatar_url` is a Supabase Storage path (e.g., `chat_media/...` or `avatars/...`), format it into the full public HTTPS URL.
  - If it is a Dicebear URL ending with `/svg`, convert `/svg` to `/png` so Android's `BitmapFactory` can decode the raster image natively.
  - If no avatar URL exists, pass an empty string so the Android plugin renders the requested monogram letter circle.

#### File: `plugins/capacitor-conversation-notifications/android/src/main/java/com/xpresso/convnotif/ChatNotifier.java`
- In `fetchAvatar`:
  - Enhance HTTP connection to follow redirects (HTTP 301, 302, 307, 308) across HTTPS and CDNs.
  - Convert any `/svg` URL to `/png` dynamically as a safety net.
  - If a valid bitmap is returned, center-crop it into a circular icon with `circle(raw)`.
  - If null or unreachable, fall back to `letterAvatar(name)` (the clean monogram letter circle).

---

### 2. Accurate Message Count Badge & Reduction on Read
#### File: `plugins/capacitor-conversation-notifications/android/src/main/java/com/xpresso/convnotif/ChatMessagingService.java`
- Read the `badge` field from the FCM data payload (`d.get("badge")`).
- Pass the integer `badgeCount` into `ChatNotifier.showMessage(...)`.

#### File: `plugins/capacitor-conversation-notifications/android/src/main/java/com/xpresso/convnotif/ChatNotifier.java`
- In `showMessage(...)`, add `.setNumber(badgeCount)` to the notification builder.
- On Android 8.0+ (Oreo through Android 15), `.setNumber()` controls the notification badge count on launcher icons (Samsung One UI, Pixel Launcher, Nova, etc.).
- Call `ShortcutBadger.applyCount(ctx, badgeCount)` or notify the badge manager so background pushes immediately set the exact unread number on Samsung/Xiaomi home screen icons.

#### File: `src/stores/unread.ts` & `src/services/messagingService.ts`
- Ensure `markConversationAsRead` updates `lastReadAt` in RxDB and Supabase, recalculates `calculateTotalUnread(userId)`, and immediately calls `nativeNotificationService.setBadge(count)`.
- The badge number on the home screen icon will decrement in real time as each conversation is read.

---

### 3. Auto-Delete Notification on Reading Messages
#### File: `src/views/InboxView.svelte`
- When a user taps a conversation from the inbox (`onopenchat`), immediately call `nativeNotificationService.removeDeliveredForConversation(convo.id)`.

#### File: `src/views/ChatWindow.svelte`
- When `ChatWindow` mounts or `activeConversationId` changes, immediately call `nativeNotificationService.removeDeliveredForConversation(activeConversationId)`.
- When messages become visible and are marked as read (`readOnVisible` / `throttledMarkAsRead`), ensure `removeDeliveredForConversation` is invoked.

#### File: `plugins/capacitor-conversation-notifications/android/src/main/java/com/xpresso/convnotif/ChatNotifier.java`
- In `cancelChat`:
  - Cancel the per-conversation notification via `NotificationManagerCompat.cancel(notificationId(chatId))`.
  - Check active notifications; if no other chats remain, cancel the summary notification (`SUMMARY_ID`) so no empty cards persist in the notification drawer.

---

### 4. Xpresso Branding & Icon on Notification Cards
#### File: `plugins/capacitor-conversation-notifications/android/src/main/java/com/xpresso/convnotif/ChatNotifier.java`
- Update channel name in `ensureChannel` to `"Xpresso Messages"`.
- Set `.setSubText("Xpresso")` on the notification builder so "Xpresso" explicitly appears at the top header of the card alongside the small icon.
- In `postSummary`, set `.setContentTitle("Xpresso")` and `.setSummaryText("Xpresso")`.
- Set the notification accent color to `#0050D8` (`xpresso_blue`) so the badge and header text are tinted with the brand color.

#### File: `plugins/capacitor-conversation-notifications/android/src/main/res/drawable/ic_stat_chat.xml` & `android/app/src/main/res/drawable-*/ic_stat_xpresso.png`
- Verify that `ic_stat_xpresso` is used as the small icon, appearing in the status bar and as the badge on the bottom-right corner of the contact avatar.

---

## Verification Plan

1. **Codebase Compilation**:
   - Run `compile_applet` to verify that all Svelte components and services compile without errors.
2. **Capacitor Android Sync**:
   - Run `npx cap sync android` to ensure changes to the Java plugin files, drawables, and manifests are updated in the Android project.
3. **User Flow Testing**:
   - Send messages while the recipient device is in the background: verify that the sender's avatar circle displays in the notification drawer.
   - Verify that the notification card header displays "Xpresso" with the brand blue accent color and Xpresso icon.
   - Verify that the launcher icon badge accurately reflects the unread count (e.g. 2, 3, etc.).
   - Open the app and view the conversation: verify that the notification automatically disappears from the notification tray and the home screen badge decrements accordingly.
