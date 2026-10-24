package com.xpresso.convnotif;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Fired when the user SWIPES a notification away (the notification's deleteIntent).
 * Without this, the unread count of a dismissed chat would stay in the ledger and the next
 * message would show a number that no longer matches what is in the tray.
 *
 * Not fired when the app itself cancels a notification, so reading a chat is handled by
 * ChatNotifier.cancelChat instead.
 */
public class NotificationDismissReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        String chatId = intent == null ? null : intent.getStringExtra(ChatNotifier.EXTRA_CHAT_ID);
        if (chatId == null || chatId.isEmpty()) {
            // The whole "Xpresso" bundle was swiped away.
            UnreadLedger.clearAll(context);
        } else {
            UnreadLedger.clear(context, chatId);
        }
        // Keep the bundle header's numbers right; cancels it if nothing is left.
        ChatNotifier.refreshSummary(context);
    }
}
