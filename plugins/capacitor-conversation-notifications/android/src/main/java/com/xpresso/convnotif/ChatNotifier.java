package com.xpresso.convnotif;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.Rect;
import android.graphics.RectF;
import android.os.Build;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;
import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;

/**
 * Builds the notification that Android files under "Conversations": MessagingStyle + a
 * long-lived sharing shortcut whose id equals the notification's shortcut id (= the chat id).
 */
final class ChatNotifier {

    static final String TAG = "ConvNotif";
    static final String CHANNEL_ID = "chat_messages";
    static final String EXTRA_CHAT_ID = "chatId";

    private static final int MAX_HISTORY = 7; // previous messages kept, + the new one
    private static final int AVATAR_PX = 192;

    private ChatNotifier() {}

    // ---------------------------------------------------------------- public API

    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Messages", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("New chat messages");
        nm.createNotificationChannel(ch);
    }

    /** Creates or refreshes the conversation shortcut for a chat (cheap to call repeatedly). */
    static void upsertShortcut(Context ctx, String chatId, String label, @Nullable String avatarUrl,
                               boolean isGroup, @Nullable Person person) {
        Person p = person;
        if (p == null && !isGroup) {
            p = new Person.Builder().setKey(chatId).setName(label).setIcon(avatarIcon(avatarUrl, label)).build();
        }
        IconCompat icon = (p != null && p.getIcon() != null) ? p.getIcon() : avatarIcon(avatarUrl, label);

        ShortcutInfoCompat.Builder sb = new ShortcutInfoCompat.Builder(ctx, chatId)
                .setShortLabel(label)
                .setLongLived(true)
                .setIcon(icon)
                .setIntent(chatIntent(ctx, chatId, Intent.ACTION_VIEW));
        if (p != null) sb.setPerson(p);
        ShortcutManagerCompat.pushDynamicShortcut(ctx, sb.build());
    }

    @SuppressLint("MissingPermission")
    static void showMessage(Context ctx, String chatId, String senderId, String senderName, String text,
                            long timestamp, @Nullable String avatarUrl, boolean isGroup, @Nullable String chatTitle) {
        ensureChannel(ctx);
        if (!NotificationManagerCompat.from(ctx).areNotificationsEnabled()) return;

        String title = (chatTitle != null && !chatTitle.isEmpty()) ? chatTitle : senderName;
        Person sender = new Person.Builder()
                .setKey(senderId)
                .setName(senderName)
                .setIcon(avatarIcon(avatarUrl, senderName))
                .setImportant(true)
                .build();

        upsertShortcut(ctx, chatId, isGroup ? title : senderName, avatarUrl, isGroup, isGroup ? null : sender);

        int notifId = notificationId(chatId);
        Person me = new Person.Builder().setName("Me").build();
        NotificationCompat.MessagingStyle style = new NotificationCompat.MessagingStyle(me);
        style.setGroupConversation(isGroup);
        if (isGroup) style.setConversationTitle(title);

        // Carry over the messages already showing for this chat so they stack in one notification.
        NotificationCompat.MessagingStyle old = existingStyle(ctx, notifId);
        if (old != null) {
            List<NotificationCompat.MessagingStyle.Message> prev = old.getMessages();
            int from = Math.max(0, prev.size() - MAX_HISTORY);
            for (int i = from; i < prev.size(); i++) {
                NotificationCompat.MessagingStyle.Message m = prev.get(i);
                style.addMessage(new NotificationCompat.MessagingStyle.Message(m.getText(), m.getTimestamp(), m.getPerson()));
            }
        }
        style.addMessage(new NotificationCompat.MessagingStyle.Message(text, timestamp, sender));

        PendingIntent tap = PendingIntent.getActivity(ctx, notifId, chatIntent(ctx, chatId, Intent.ACTION_VIEW),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification n = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setSmallIcon(smallIcon(ctx))
                .setStyle(style)
                .setShortcutId(chatId)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setWhen(timestamp)
                .setShowWhen(true)
                .setAutoCancel(true)
                .setContentIntent(tap)
                .build();

        NotificationManagerCompat.from(ctx).notify(notifId, n);
    }

    static void cancelChat(Context ctx, String chatId) {
        NotificationManagerCompat.from(ctx).cancel(notificationId(chatId));
    }

    static void cancelAll(Context ctx) {
        NotificationManagerCompat.from(ctx).cancelAll();
        try {
            ShortcutManagerCompat.removeAllDynamicShortcuts(ctx);
        } catch (Exception e) {
            Log.w(TAG, "removeAllDynamicShortcuts failed", e);
        }
    }

    static int notificationId(String chatId) {
        return chatId.hashCode();
    }

    // ---------------------------------------------------------------- helpers

    private static Intent chatIntent(Context ctx, String chatId, String action) {
        Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        ComponentName cn = launch != null ? launch.getComponent() : null;
        Intent i = new Intent(action);
        if (cn != null) i.setComponent(cn);
        else i.setPackage(ctx.getPackageName());
        i.putExtra(EXTRA_CHAT_ID, chatId);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return i;
    }

    @Nullable
    private static NotificationCompat.MessagingStyle existingStyle(Context ctx, int notifId) {
        try {
            NotificationManager nm = ctx.getSystemService(NotificationManager.class);
            if (nm == null) return null;
            for (StatusBarNotification sbn : nm.getActiveNotifications()) {
                if (sbn.getId() == notifId) {
                    return NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(sbn.getNotification());
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "could not read active notifications", e);
        }
        return null;
    }

    /** Status-bar icon: the app's FCM default icon if declared, else the plugin's bubble. */
    private static int smallIcon(Context ctx) {
        try {
            ApplicationInfo ai = ctx.getPackageManager().getApplicationInfo(ctx.getPackageName(), PackageManager.GET_META_DATA);
            if (ai.metaData != null) {
                int id = ai.metaData.getInt("com.google.firebase.messaging.default_notification_icon", 0);
                if (id != 0) return id;
            }
        } catch (Exception ignored) {
        }
        return R.drawable.ic_stat_chat;
    }

    private static IconCompat avatarIcon(@Nullable String avatarUrl, String name) {
        Bitmap bmp = fetchAvatar(avatarUrl);
        if (bmp == null) bmp = letterAvatar(name);
        return IconCompat.createWithBitmap(bmp);
    }

    /** Blocking, short timeouts: FCM gives onMessageReceived ~20 s in total. https only. */
    @Nullable
    private static Bitmap fetchAvatar(@Nullable String url) {
        if (url == null || !url.startsWith("https://")) return null;
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(3000);
            c.setReadTimeout(3000);
            c.setInstanceFollowRedirects(true);
            if (c.getResponseCode() != 200) return null;
            try (InputStream in = c.getInputStream()) {
                Bitmap raw = BitmapFactory.decodeStream(in);
                return raw == null ? null : circle(raw);
            }
        } catch (Exception e) {
            Log.w(TAG, "avatar fetch failed: " + e.getMessage());
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private static Bitmap circle(Bitmap src) {
        Bitmap out = Bitmap.createBitmap(AVATAR_PX, AVATAR_PX, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(out);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        canvas.drawARGB(0, 0, 0, 0);
        canvas.drawOval(new RectF(0, 0, AVATAR_PX, AVATAR_PX), paint);
        paint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
        int side = Math.min(src.getWidth(), src.getHeight()); // centre-crop to a square
        Rect from = new Rect((src.getWidth() - side) / 2, (src.getHeight() - side) / 2,
                (src.getWidth() + side) / 2, (src.getHeight() + side) / 2);
        canvas.drawBitmap(src, from, new Rect(0, 0, AVATAR_PX, AVATAR_PX), paint);
        return out;
    }

    /** Coloured circle with the first letter, used when there is no (reachable) avatar. */
    private static Bitmap letterAvatar(String name) {
        String letter = (name == null || name.trim().isEmpty()) ? "?" : name.trim().substring(0, 1).toUpperCase();
        float[] hsv = {Math.abs((name == null ? 0 : name.hashCode()) % 360), 0.55f, 0.65f};
        Bitmap out = Bitmap.createBitmap(AVATAR_PX, AVATAR_PX, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(out);
        Paint bg = new Paint(Paint.ANTI_ALIAS_FLAG);
        bg.setColor(Color.HSVToColor(hsv));
        canvas.drawCircle(AVATAR_PX / 2f, AVATAR_PX / 2f, AVATAR_PX / 2f, bg);
        Paint fg = new Paint(Paint.ANTI_ALIAS_FLAG);
        fg.setColor(Color.WHITE);
        fg.setTextSize(AVATAR_PX * 0.5f);
        fg.setTextAlign(Paint.Align.CENTER);
        float y = AVATAR_PX / 2f - (fg.descent() + fg.ascent()) / 2f;
        canvas.drawText(letter, AVATAR_PX / 2f, y, fg);
        return out;
    }
}
