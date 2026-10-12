package com.xpresso.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;
import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

import me.leolin.shortcutbadger.ShortcutBadger;

/**
 * WhatsApp-style Native Android Conversation Notification Engine.
 *
 * Implements:
 * 1. Android 11+ (API 30+) People & Conversations space placement (shows under "Conversations" rather than "Alerts").
 * 2. NotificationCompat.MessagingStyle with message stacking for the same group/sender on one card.
 * 3. Card message counter styled with Xpresso Orange (#E58A3A).
 * 4. Launcher icon badge synchronization via ShortcutBadger.
 */
public class XpressoNotificationHelper {
    private static final String TAG = "XpressoNotifHelper";

    public static final String CHANNEL_ID = "xpresso_messages";
    public static final String CHANNEL_NAME = "Conversations";
    public static final String CHANNEL_DESCRIPTION = "Direct messages and study group conversations";
    public static final int COLOR_XPRESSO_ORANGE = Color.parseColor("#E58A3A");

    private static final String PREFS_NAME = "xpresso_conversation_notifications";
    private static final String KEY_PREFIX_MESSAGES = "msgs_";

    public static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) return;

            NotificationChannel channel = manager.getNotificationChannel(CHANNEL_ID);
            if (channel == null) {
                channel = new NotificationChannel(
                        CHANNEL_ID,
                        CHANNEL_NAME,
                        NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription(CHANNEL_DESCRIPTION);
                channel.enableLights(true);
                channel.setLightColor(COLOR_XPRESSO_ORANGE);
                channel.enableVibration(true);
                channel.setShowBadge(true);
                channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
                manager.createNotificationChannel(channel);
                Log.i(TAG, "Configured high-importance conversation notification channel: " + CHANNEL_ID);
            }
        }
    }

    /**
     * Display or update a conversation notification under the Android "Conversations" section.
     */
    public static void showConversationNotification(
            Context context,
            String conversationId,
            String senderId,
            String senderName,
            String content,
            boolean isGroup,
            String groupTitle,
            int conversationUnreadCount,
            int totalBadgeCount
    ) {
        try {
            if (context == null || conversationId == null || conversationId.isEmpty()) return;

            createNotificationChannel(context);

            String safeSenderName = (senderName != null && !senderName.trim().isEmpty())
                    ? senderName.trim()
                    : "Xpresso Contact";
            String safeContent = (content != null && !content.trim().isEmpty())
                    ? content.trim()
                    : "New message";

            // 1. Persist and stack messages for this conversation card
            List<StoredMessage> history = recordMessage(context, conversationId, safeSenderName, safeContent);
            int displayCount = Math.max(conversationUnreadCount > 0 ? conversationUnreadCount : history.size(), 1);

            // 2. Intent to open MainActivity and jump straight to the conversation
            Intent launchIntent = new Intent(context, MainActivity.class);
            launchIntent.setAction(Intent.ACTION_VIEW);
            launchIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            launchIntent.putExtra("conversationId", conversationId);
            launchIntent.putExtra("senderId", senderId != null ? senderId : "");
            launchIntent.putExtra("senderName", safeSenderName);

            int requestCode = Math.abs(conversationId.hashCode());
            PendingIntent pendingIntent = PendingIntent.getActivity(
                    context,
                    requestCode,
                    launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
            );

            // 3. Construct Person objects
            Person userPerson = new Person.Builder()
                    .setName("Me")
                    .setKey("current_user")
                    .build();

            Person senderPerson = new Person.Builder()
                    .setName(safeSenderName)
                    .setKey(senderId != null ? senderId : safeSenderName)
                    .build();

            // 4. Android 11+ Dynamic Conversation Shortcut
            // Required by Android 11, 12, 13, 14, 15 to classify this notification under "Conversations" instead of "Alerts"!
            try {
                ShortcutInfoCompat.Builder shortcutBuilder = new ShortcutInfoCompat.Builder(context, conversationId)
                        .setShortLabel(isGroup && groupTitle != null ? groupTitle : safeSenderName)
                        .setLongLived(true)
                        .setPerson(senderPerson)
                        .setIntent(launchIntent);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    shortcutBuilder.setIsConversation();
                }

                ShortcutInfoCompat shortcut = shortcutBuilder.build();
                ShortcutManagerCompat.pushDynamicShortcut(context, shortcut);
            } catch (Throwable sErr) {
                Log.w(TAG, "Conversation shortcut push non-fatal warning: " + sErr.getMessage());
            }

            // 5. Build MessagingStyle card with stacked messages
            NotificationCompat.MessagingStyle messagingStyle = new NotificationCompat.MessagingStyle(userPerson);
            if (isGroup && groupTitle != null && !groupTitle.trim().isEmpty()) {
                messagingStyle.setConversationTitle(groupTitle.trim());
                messagingStyle.setGroupConversation(true);
            } else {
                messagingStyle.setGroupConversation(false);
            }

            for (StoredMessage msg : history) {
                Person p = new Person.Builder()
                        .setName(msg.senderName)
                        .setKey(msg.senderName)
                        .build();
                messagingStyle.addMessage(new NotificationCompat.MessagingStyle.Message(
                        msg.content,
                        msg.timestamp,
                        p
                ));
            }

            // 6. Build notification with Xpresso Orange styling and Conversation metadata
            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(R.mipmap.ic_launcher_foreground)
                    .setColor(COLOR_XPRESSO_ORANGE) // Colors card accent, small icon, and number in Xpresso Orange (#E58A3A)!
                    .setColorized(false)
                    .setStyle(messagingStyle)
                    .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                    .setShortcutId(conversationId) // Places in the "Conversations" space on Android 11+!
                    .setGroup("xpresso_chat_" + conversationId)
                    .setGroupAlertBehavior(NotificationCompat.GROUP_ALERT_SUMMARY)
                    .setNumber(displayCount) // Displays the unread count number on the card!
                    .setContentIntent(pendingIntent)
                    .setAutoCancel(true)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setDefaults(NotificationCompat.DEFAULT_ALL);

            NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
            int notificationId = Math.abs(conversationId.hashCode());
            notificationManager.notify("conv_" + conversationId, notificationId, builder.build());
            Log.i(TAG, "Dispatched WhatsApp-style conversation notification for conversation: " + conversationId + ", unread: " + displayCount);

            // 7. Synchronize launcher icon badge
            if (totalBadgeCount >= 0) {
                try {
                    ShortcutBadger.applyCount(context, totalBadgeCount);
                } catch (Throwable bErr) {
                    Log.w(TAG, "Badge count sync warning: " + bErr.getMessage());
                }
            }
        } catch (Throwable e) {
            Log.e(TAG, "Failed to display conversation notification", e);
        }
    }

    /**
     * Clear delivered notification for a conversation and clear its message stack.
     */
    public static void clearConversationNotification(Context context, String conversationId) {
        if (context == null || conversationId == null) return;
        try {
            NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
            int notificationId = Math.abs(conversationId.hashCode());
            notificationManager.cancel("conv_" + conversationId, notificationId);
            notificationManager.cancel("xpresso_conv_" + conversationId, notificationId);
            notificationManager.cancel(notificationId);

            // Clear stored message history for this conversation
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().remove(KEY_PREFIX_MESSAGES + conversationId).apply();
            Log.i(TAG, "Cleared conversation notification for: " + conversationId);
        } catch (Throwable t) {
            Log.w(TAG, "Error clearing conversation notification: " + t.getMessage());
        }
    }

    /**
     * Dismiss all Xpresso notifications from the notification shade and reset message stacks.
     */
    public static void clearAllNotifications(Context context) {
        if (context == null) return;
        try {
            NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
            notificationManager.cancelAll();

            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().clear().apply();

            try {
                ShortcutBadger.applyCount(context, 0);
            } catch (Throwable ignored) {}
            Log.i(TAG, "Cleared all notifications and reset badge to 0");
        } catch (Throwable t) {
            Log.w(TAG, "Error clearing all notifications: " + t.getMessage());
        }
    }

    private static class StoredMessage {
        String senderName;
        String content;
        long timestamp;

        StoredMessage(String senderName, String content, long timestamp) {
            this.senderName = senderName;
            this.content = content;
            this.timestamp = timestamp;
        }
    }

    private static synchronized List<StoredMessage> recordMessage(
            Context context,
            String conversationId,
            String senderName,
            String content
    ) {
        List<StoredMessage> list = new ArrayList<>();
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String key = KEY_PREFIX_MESSAGES + conversationId;

        try {
            String raw = prefs.getString(key, null);
            if (raw != null) {
                JSONArray arr = new JSONArray(raw);
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject obj = arr.getJSONObject(i);
                    list.add(new StoredMessage(
                            obj.optString("senderName", "Xpresso Contact"),
                            obj.optString("content", ""),
                            obj.optLong("timestamp", System.currentTimeMillis())
                    ));
                }
            }
        } catch (Throwable ignored) {}

        // Append new message (keep up to 10 most recent messages for the card)
        list.add(new StoredMessage(senderName, content, System.currentTimeMillis()));
        if (list.size() > 10) {
            list = list.subList(list.size() - 10, list.size());
        }

        try {
            JSONArray arr = new JSONArray();
            for (StoredMessage msg : list) {
                JSONObject obj = new JSONObject();
                obj.put("senderName", msg.senderName);
                obj.put("content", msg.content);
                obj.put("timestamp", msg.timestamp);
                arr.put(obj);
            }
            prefs.edit().putString(key, arr.toString()).apply();
        } catch (Throwable ignored) {}

        return list;
    }
}
