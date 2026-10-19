package com.xpresso.convnotif;

import android.content.Intent;

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

    /** Dismiss every notification and drop all shortcuts (call on logout). */
    @PluginMethod
    public void clearAll(PluginCall call) {
        ChatNotifier.cancelAll(getContext());
        call.resolve();
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
