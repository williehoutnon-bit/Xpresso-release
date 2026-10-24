package com.xpresso.convnotif;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.os.Build;

import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.pm.ShortcutManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * JS-facing side. The heavy lifting happens in ChatMessagingService (which also runs when the
 * app is closed); this class only lets the web layer pre-create shortcuts, say which chat is
 * open, clear notifications, and learn which chat a tapped notification wants.
 */
@CapacitorPlugin(name = "ConversationNotifications")
public class ConversationNotificationsPlugin extends Plugin {

    private static volatile boolean foreground = false;
    private static volatile String activeChatId = null;

    private static final ExecutorService IO = Executors.newSingleThreadExecutor();

    private String pendingChatId = null;

    /** True when the app is in front AND that chat is the one on screen. */
    static boolean isChatOnScreen(String chatId) {
        return foreground && chatId != null && chatId.equals(activeChatId);
    }

    @Override
    public void load() {
        ChatNotifier.ensureChannel(getContext());
        if (getActivity() != null) pendingChatId = chatIdFrom(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        String id = chatIdFrom(intent);
        if (id != null) {
            JSObject data = new JSObject();
            data.put("chatId", id);
            notifyListeners("chatOpened", data, true);
        }
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        foreground = true;
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        foreground = false;
    }

    // ------------------------------------------------------------------ JS methods

    /** { chatId, name, avatarUrl?, isGroup? } */
    @PluginMethod
    public void upsertShortcut(PluginCall call) {
        final String chatId = call.getString("chatId");
        final String name = call.getString("name");
        if (chatId == null || name == null) {
            call.reject("chatId and name are required");
            return;
        }
        final String avatarUrl = call.getString("avatarUrl");
        final boolean isGroup = Boolean.TRUE.equals(call.getBoolean("isGroup", false));
        IO.execute(() -> {
            try {
                ChatNotifier.upsertShortcut(getContext(), chatId, TextSanitizer.toPlainText(name), avatarUrl, isGroup, null);
                call.resolve();
            } catch (Exception e) {
                call.reject("upsertShortcut failed: " + e.getMessage());
            }
        });
    }

    /** { chatId: string | null } - the chat currently on screen; null when none. */
    @PluginMethod
    public void setActiveChat(PluginCall call) {
        activeChatId = call.getString("chatId");
        if (activeChatId != null) ChatNotifier.cancelChat(getContext(), activeChatId);
        call.resolve();
    }

    /** { chatId } - dismiss that chat's notification (call when the user reads the chat). */
    @PluginMethod
    public void clearChat(PluginCall call) {
        String chatId = call.getString("chatId");
        if (chatId == null) {
            call.reject("chatId is required");
            return;
        }
        ChatNotifier.cancelChat(getContext(), chatId);
        call.resolve();
    }

    /**
     * Unread messages currently represented by notifications on this phone: { total, chats }.
     * The JS badge writer uses it so it never lowers the launcher badge below this number.
     */
    @PluginMethod
    public void getUnreadTotal(PluginCall call) {
        JSObject r = new JSObject();
        r.put("total", UnreadLedger.total(getContext()));
        r.put("chats", UnreadLedger.chats(getContext()));
        call.resolve(r);
    }

    /** Dismiss every notification and drop all shortcuts (call on logout). */
    @PluginMethod
    public void clearAll(PluginCall call) {
        ChatNotifier.cancelAll(getContext());
        call.resolve();
    }

    /**
     * Posts a conversation notification locally, with no server or FCM involved. If this one shows
     * under Conversations, the phone side works and any remaining problem is on the sending side.
     */
    @PluginMethod
    public void showTestNotification(PluginCall call) {
        IO.execute(() -> {
            try {
                ChatNotifier.showMessage(getContext(), "xpresso_self_test", "xpresso_self_test",
                        "Xpresso test", "If you can read this under Conversations, notifications work on this phone.",
                        System.currentTimeMillis(), null, false, null);
                call.resolve();
            } catch (Throwable e) {
                call.reject("showTestNotification failed: " + e);
            }
        });
    }

    /** State that decides whether a push can show up: permission, channel, which FCM service wins. */
    @PluginMethod
    public void getDiagnostics(PluginCall call) {
        Context ctx = getContext();
        JSObject r = new JSObject();
        r.put("sdk", Build.VERSION.SDK_INT);
        r.put("notificationsEnabled", NotificationManagerCompat.from(ctx).areNotificationsEnabled());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = ctx.getSystemService(NotificationManager.class);
            NotificationChannel ch = nm == null ? null : nm.getNotificationChannel(ChatNotifier.CHANNEL_ID);
            // 4 = high (heads-up), 3 = default, 0 = switched off, -1 = channel does not exist yet
            r.put("channelImportance", ch == null ? -1 : ch.getImportance());
        }
        try {
            Intent probe = new Intent("com.google.firebase.MESSAGING_EVENT").setPackage(ctx.getPackageName());
            ResolveInfo ri = ctx.getPackageManager().resolveService(probe, 0);
            // Must end with ChatMessagingService. If it names Capacitor's MessagingService, the plugin never runs.
            r.put("fcmServiceThatWins", ri == null || ri.serviceInfo == null ? "none" : ri.serviceInfo.name);
        } catch (Throwable e) {
            r.put("fcmServiceThatWins", "error: " + e);
        }
        try {
            r.put("dynamicShortcuts", ShortcutManagerCompat.getDynamicShortcuts(ctx).size());
        } catch (Throwable e) {
            r.put("dynamicShortcuts", -1);
        }
        r.put("appInForeground", foreground);
        r.put("chatOnScreen", activeChatId == null ? "" : activeChatId);
        call.resolve(r);
    }

    /** Chat that launched the app from a tapped notification (cold start), once. */
    @PluginMethod
    public void getPendingChat(PluginCall call) {
        JSObject res = new JSObject();
        res.put("chatId", pendingChatId); // null when none
        if (pendingChatId != null && getActivity() != null) {
            getActivity().getIntent().removeExtra(ChatNotifier.EXTRA_CHAT_ID);
        }
        pendingChatId = null;
        call.resolve(res);
    }

    private static String chatIdFrom(Intent intent) {
        return intent == null ? null : intent.getStringExtra(ChatNotifier.EXTRA_CHAT_ID);
    }
}
