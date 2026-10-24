package com.xpresso.convnotif;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.List;

/**
 * Android-side wrapper around UnreadLedgerCore: persists it in SharedPreferences so the counts
 * survive the process being killed between two pushes (FCM wakes the app for every message).
 * One process, so a single in-memory copy is loaded lazily and written through on every change.
 */
final class UnreadLedger {

    private static final String PREFS = "convnotif_unread";
    private static final String KEY = "ledger";
    private static final Object LOCK = new Object();
    private static UnreadLedgerCore cached;

    private UnreadLedger() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static UnreadLedgerCore load(Context ctx) {
        if (cached == null) cached = UnreadLedgerCore.deserialize(prefs(ctx).getString(KEY, ""));
        return cached;
    }

    private static void save(Context ctx, UnreadLedgerCore core) {
        prefs(ctx).edit().putString(KEY, core.serialize()).apply();
    }

    /** +1 unread message for a chat; returns that chat's new count. */
    static int increment(Context ctx, String chatId, String title, String lastText, long ts) {
        synchronized (LOCK) {
            UnreadLedgerCore core = load(ctx);
            int n = core.increment(chatId, title, lastText, ts);
            save(ctx, core);
            return n;
        }
    }

    static void clear(Context ctx, String chatId) {
        synchronized (LOCK) {
            UnreadLedgerCore core = load(ctx);
            if (core.clear(chatId)) save(ctx, core);
        }
    }

    static void clearAll(Context ctx) {
        synchronized (LOCK) {
            UnreadLedgerCore core = load(ctx);
            core.clearAll();
            save(ctx, core);
        }
    }

    static int total(Context ctx) {
        synchronized (LOCK) {
            return load(ctx).total();
        }
    }

    static int chats(Context ctx) {
        synchronized (LOCK) {
            return load(ctx).chats();
        }
    }

    static List<UnreadLedgerCore.Row> snapshot(Context ctx) {
        synchronized (LOCK) {
            return load(ctx).snapshot();
        }
    }
}
