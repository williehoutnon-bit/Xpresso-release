package com.xpresso.app;

import android.content.Context;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "XpressoNotification")
public class XpressoNotificationPlugin extends Plugin {

    @PluginMethod
    public void showConversationNotification(PluginCall call) {
        Context context = getContext();
        String conversationId = call.getString("conversationId", "");
        String senderId = call.getString("senderId", "");
        String senderName = call.getString("senderName", "Xpresso Contact");
        String content = call.getString("content", "New message");
        boolean isGroup = Boolean.TRUE.equals(call.getBoolean("isGroup", false));
        String groupTitle = call.getString("groupTitle", null);
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
}
