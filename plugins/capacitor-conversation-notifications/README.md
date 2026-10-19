# capacitor-conversation-notifications

Android notifications that Android files under **Conversations** (like WhatsApp), for a Capacitor
app that already uses FCM. Colour markup such as `\color[#1d4ed8]{Hello}` is stripped so the
notification shows only `Hello`.

## What is in the box

| Path | Role |
|------|------|
| `android/.../ChatMessagingService.java` | Receives FCM data messages, builds the notification (also when the app is closed) |
| `android/.../ChatNotifier.java` | MessagingStyle + long-lived shortcut + avatar + stacking of messages per chat |
| `android/.../TextSanitizer.java` | Colour markup -> plain text |
| `android/.../ConversationNotificationsPlugin.java` | JS bridge: shortcuts, active chat, clear, tap handling |
| `android/src/main/AndroidManifest.xml` | Registers the service with priority 100 (beats Capacitor's, priority 0) |
| `js/conversationNotifications.ts` | Typed `registerPlugin` bridge - copy into the app |
| `js/sanitize.ts` | Same sanitizer for the server / app - copy into the app and the edge function |
| `js/App.example.svelte` | Svelte 5 wiring example |

## Install (once)

```bash
# put this folder in the project, e.g. ./plugins/capacitor-conversation-notifications
npm i ./plugins/capacitor-conversation-notifications
npx cap sync android
```

Keep using `@capacitor/push-notifications` for `requestPermissions()` and `register()`.
Then copy `js/*.ts` into the app and mount the wiring from `App.example.svelte`.

## Server: send data-only FCM messages (HTTP v1)

Do NOT include a `notification` key - the system would show it itself and bypass this service.
All `data` values must be strings.

```ts
import { toPlainText } from './sanitize';

const body = {
  message: {
    token: deviceToken,
    data: {
      type: 'chat_message',
      chatId,                     // stable per conversation
      senderId,
      senderName,
      text: toPlainText(rawText), // plain text; the phone strips again as a safety net
      ts: String(Date.now()),
      avatarUrl,                  // optional, https only
      isGroup: 'false',           // 'true' for groups, then also chatTitle
      // fallbackText: 'Photo',   // shown if text is empty after stripping
    },
    android: { priority: 'HIGH' },
  },
};
```

## In the chat screen

```ts
import { ConvNotif } from '$lib/native/conversationNotifications';

onMount(() => { ConvNotif.setActiveChat({ chatId }); });   // no notification for the open chat
onDestroy(() => { ConvNotif.setActiveChat({ chatId: null }); });
```

On logout: `ConvNotif.clearAll()`.

## Status-bar icon

By default a white chat-bubble icon is used. To use your own, add a white-on-transparent
drawable and declare it in the app manifest:

```xml
<meta-data android:name="com.google.firebase.messaging.default_notification_icon"
           android:resource="@drawable/ic_stat_xpresso" />
```

## Limits worth knowing

- Samsung/One UI and stock Android 11+ follow the same Conversations rules; Android 10 and
  older have no Conversations section (the notification still looks like a message).
- The user can move a conversation out of the section; Android also demotes conversations the
  user never interacts with.
- If you use a push plugin other than `@capacitor/push-notifications`, change `CAP_PUSH` in
  `ChatMessagingService` so tokens and non-chat messages reach it.
