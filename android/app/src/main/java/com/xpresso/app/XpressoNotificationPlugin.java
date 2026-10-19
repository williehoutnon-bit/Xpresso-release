package com.xpresso.app;

import android.content.Context;
import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "XpressoNotification")
public class XpressoNotificationPlugin extends Plugin {

    private static final String EXTRA_CONVERSATION_ID = "conversationId";

    private static volatile boolean foreground = false;
    private static volatile String activeConversationId = null;

    private String pendingConversationId = null;

    /** True when the app is in front AND that conversation is the one on screen. */
    static boolean isConversationOnScreen(String conversationId) {
        return foreground && conversationId != null && conversationId.equals(activeConversationId);
    }

    @Override
    public void load() {
        if (getActivity() != null) pendingConversationId = conversationIdFrom(getActivity().getIntent());
    }

    // Our notifications carry no google.message_id extra, so Capacitor's
    // pushNotificationActionPerformed never fires for them; taps are reported here instead.
    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        String id = conversationIdFrom(intent);
        if (id != null) {
            JSObject data = new JSObject();
            data.put("conversationId", id);
            notifyListeners("notificationTapped", data, true);
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

    @PluginMethod
    public void showConversationNotification(PluginCall call) {
        Context context = getContext();
        String conversationId = call.getString("conversationId", "");
        String senderId = call.getString("senderId", "");
        String senderName = TextSanitizer.toPlainText(call.getString("senderName", "Xpresso Contact"));
        String content = TextSanitizer.toPlainText(call.getString("content", "New message"));
        boolean isGroup = Boolean.TRUE.equals(call.getBoolean("isGroup", false));
        String groupTitle = call.getString("groupTitle", null);
        if (groupTitle != null) groupTitle = TextSanitizer.toPlainText(groupTitle);
        int unreadCount = call.getInt("unreadCount", 1);
        int totalBadgeCount = call.getInt("totalBadgeCount", unreadCount);

        if (conversationId.isEmpty()) {
            call.reject("conversationId is required");
            return;
        }

        XpressoNotificationHelper.showConversationNotification(
                context,
                conversationId,
                senderId,
                senderName,
                content,
                isGroup,
                groupTitle,
                unreadCount,
                totalBadgeCount
        );

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    /** { conversationId: string | null } - the chat on screen; its notification is dismissed. */
    @PluginMethod
    public void setActiveConversation(PluginCall call) {
        String id = call.getString("conversationId");
        activeConversationId = (id == null || id.isEmpty()) ? null : id;
        if (activeConversationId != null) {
            XpressoNotificationHelper.clearConversationNotification(getContext(), activeConversationId);
        }
        call.resolve();
    }

    /** Conversation that cold-started the app from a notification tap; returned once. */
    @PluginMethod
    public void getPendingConversation(PluginCall call) {
        JSObject res = new JSObject();
        res.put("conversationId", pendingConversationId);
        if (pendingConversationId != null && getActivity() != null) {
            getActivity().getIntent().removeExtra(EXTRA_CONVERSATION_ID);
        }
        pendingConversationId = null;
        call.resolve(res);
    }

    @PluginMethod
    public void dismissConversation(PluginCall call) {
        Context context = getContext();
        String conversationId = call.getString("conversationId", "");
        if (!conversationId.isEmpty()) {
            XpressoNotificationHelper.clearConversationNotification(context, conversationId);
        }
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void dismissAll(PluginCall call) {
        Context context = getContext();
        XpressoNotificationHelper.clearAllNotifications(context);
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    private static String conversationIdFrom(Intent intent) {
        if (intent == null) return null;
        String id = intent.getStringExtra(EXTRA_CONVERSATION_ID);
        return (id == null || id.isEmpty()) ? null : id;
    }
}
