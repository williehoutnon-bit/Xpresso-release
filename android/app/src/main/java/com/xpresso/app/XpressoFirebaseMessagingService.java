package com.xpresso.app;

import android.util.Log;

import androidx.annotation.NonNull;

import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Custom Firebase Cloud Messaging Service for Xpresso.
 *
 * Ensures:
 * 1. Background / killed app receives FCM messages and builds WhatsApp-style Conversation notifications.
 * 2. Notifications appear in the "Conversations" section (not "Alerts").
 * 3. Messages from the same group or sender are grouped under one card with the number shown.
 * 4. The number and card accent use Xpresso Orange (#E58A3A).
 * 5. Passes message through to Capacitor PushNotificationsPlugin if foregrounded.
 */
public class XpressoFirebaseMessagingService extends FirebaseMessagingService {
    private static final String TAG = "XpressoFCMService";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.i(TAG, "Incoming FCM message received from: " + remoteMessage.getFrom());

        // 1. Forward to Capacitor PushNotificationsPlugin if active
        try {
            PushNotificationsPlugin.sendRemoteMessage(remoteMessage);
        } catch (Throwable t) {
            Log.w(TAG, "PushNotificationsPlugin forward warning: " + t.getMessage());
        }

        // 2. Parse payload data
        Map<String, String> data = remoteMessage.getData();
        String conversationId = data.get("conversationId");
        if (conversationId == null) conversationId = data.get("conversation_id");

        String senderId = data.get("senderId");
        if (senderId == null) senderId = data.get("sender_id");

        String senderName = data.get("senderName");
        if (senderName == null) senderName = data.get("sender_name");

        String content = data.get("content");
        if (content == null && remoteMessage.getNotification() != null) {
            content = remoteMessage.getNotification().getBody();
        }
        if (senderName == null && remoteMessage.getNotification() != null) {
            senderName = remoteMessage.getNotification().getTitle();
        }

        String type = data.get("type");
        if (content == null || content.trim().isEmpty()) {
            if ("image".equalsIgnoreCase(type)) content = "📷 Photo";
            else if ("audio".equalsIgnoreCase(type)) content = "🎤 Voice message";
            else if ("file".equalsIgnoreCase(type)) content = "📎 Attachment";
            else content = "New message";
        }

        int badgeCount = 1;
        try {
            String badgeStr = data.get("badge");
            if (badgeStr != null) {
                badgeCount = Integer.parseInt(badgeStr.trim());
            } else if (remoteMessage.getNotification() != null && remoteMessage.getNotification().getNotificationCount() != null) {
                badgeCount = remoteMessage.getNotification().getNotificationCount();
            }
        } catch (Throwable ignored) {}

        boolean isGroup = "true".equalsIgnoreCase(data.get("isGroup")) || "true".equalsIgnoreCase(data.get("is_group"));
        String groupTitle = data.get("groupTitle");
        if (groupTitle == null) groupTitle = data.get("group_title");

        // 3. Render native Conversation notification
        if (conversationId != null && !conversationId.trim().isEmpty()) {
            XpressoNotificationHelper.showConversationNotification(
                    this,
                    conversationId,
                    senderId,
                    senderName,
                    content,
                    isGroup,
                    groupTitle,
                    badgeCount,
                    badgeCount
            );
        }
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.i(TAG, "New FCM Registration Token generated: " + (token != null && token.length() > 10 ? token.substring(0, 10) + "..." : ""));
        try {
            PushNotificationsPlugin.onNewToken(token);
        } catch (Throwable t) {
            Log.w(TAG, "PushNotificationsPlugin token forward warning: " + t.getMessage());
        }
    }
}
