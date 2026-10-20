package com.xpresso.convnotif;

import android.util.Log;

import androidx.annotation.NonNull;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.lang.reflect.Method;
import java.util.Map;

/**
 * Receives every FCM message for the app (see the manifest priority).
 *
 * Chat messages (data.type == "chat_message") become conversation notifications. Everything
 * else, and every token refresh, is handed to Capacitor's push-notifications plugin so the
 * rest of the app keeps working unchanged.
 *
 * Expected data payload (all values are strings):
 *   type         "chat_message"                       required
 *   chatId       stable id of the conversation        required
 *   senderId     stable id of the sender              required
 *   senderName   display name                         required
 *   text         message text (colour markup is stripped here as a safety net)
 *   ts           epoch milliseconds                   optional, default: now
 *   avatarUrl    https URL of the sender's picture    optional
 *   isGroup      "true" for group chats               optional
 *   chatTitle    group name                           optional (groups)
 *   fallbackText shown when text is empty after stripping (e.g. media-only message) optional
 */
public class ChatMessagingService extends FirebaseMessagingService {

    private static final String TYPE_CHAT = "chat_message";
    private static final String CAP_PUSH = "com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        Map<String, String> d = message.getData();
        String chatId = d.get("chatId");

        // Visible in logcat with: adb logcat -s ConvNotif
        Log.i(ChatNotifier.TAG, "FCM received: type=" + d.get("type") + " chatId=" + chatId
                + " keys=" + d.keySet() + " hasNotificationBlock=" + (message.getNotification() != null));

        // Always hand the message to Capacitor's plugin too: when the app is open, the web layer
        // gets its usual "pushNotificationReceived" event (e.g. to refresh the chat list).
        forwardToCapacitor("sendRemoteMessage", RemoteMessage.class, message);

        if (!TYPE_CHAT.equals(d.get("type")) || isBlank(chatId)) {
            Log.i(ChatNotifier.TAG, "not a chat_message payload; leaving it to Capacitor");
            return;
        }

        // The user is looking at this very chat: no notification needed.
        if (ConversationNotificationsPlugin.isChatOnScreen(chatId)) {
            Log.i(ChatNotifier.TAG, "chat is on screen; notification skipped");
            return;
        }

        String senderName = TextSanitizer.toPlainText(d.get("senderName"));
        if (senderName.isEmpty()) senderName = "New message";
        String senderId = isBlank(d.get("senderId")) ? chatId : d.get("senderId");

        String text = TextSanitizer.toPlainText(d.get("text"));
        if (text.isEmpty()) text = TextSanitizer.toPlainText(d.get("fallbackText"));
        if (text.isEmpty()) text = "New message";

        boolean isGroup = "true".equalsIgnoreCase(d.get("isGroup"));
        String chatTitle = TextSanitizer.toPlainText(d.get("chatTitle"));

        long ts = System.currentTimeMillis();
        try {
            if (!isBlank(d.get("ts"))) ts = Long.parseLong(d.get("ts").trim());
        } catch (NumberFormatException ignored) {
        }

        try {
            ChatNotifier.showMessage(this, chatId, senderId, senderName, text, ts,
                    d.get("avatarUrl"), isGroup, chatTitle.isEmpty() ? null : chatTitle);
        } catch (Throwable e) { // Throwable: a missing class/method must not fail silently either
            Log.e(ChatNotifier.TAG, "could not show chat notification", e);
        }
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        forwardToCapacitor("onNewToken", String.class, token);
    }

    /** Reflection keeps this plugin compile-independent of @capacitor/push-notifications. */
    private void forwardToCapacitor(String method, Class<?> argType, Object arg) {
        try {
            Method m = Class.forName(CAP_PUSH).getMethod(method, argType);
            m.invoke(null, arg);
        } catch (ClassNotFoundException e) {
            // @capacitor/push-notifications not installed: nothing to forward to.
        } catch (Exception e) {
            Log.w(ChatNotifier.TAG, "forwarding " + method + " failed: " + e.getMessage());
        }
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
