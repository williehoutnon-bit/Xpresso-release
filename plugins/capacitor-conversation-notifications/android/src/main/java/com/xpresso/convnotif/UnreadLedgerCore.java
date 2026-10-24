package com.xpresso.convnotif;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * How many unread messages each chat has on THIS device, as far as the notification tray is
 * concerned. Pure Java (no Android imports) so it can be unit-tested with a plain JDK:
 * see plugins/capacitor-conversation-notifications/test/UnreadLedgerCoreTest.java
 *
 * Semantics (they match how Samsung and stock launchers badge an app):
 *  - +1 for every chat message that is shown as a notification
 *  - a chat's entry is removed when the chat is opened/read or its notification is swiped away
 *  - total() is what the launcher badge should show; chats() is the "from N chats" part
 */
final class UnreadLedgerCore {

    static final int MAX_CHATS = 100;

    static final class Row {
        final String chatId;
        final int count;
        final String title;
        final String lastText;
        final long lastTs;

        Row(String chatId, int count, String title, String lastText, long lastTs) {
            this.chatId = chatId;
            this.count = count;
            this.title = title;
            this.lastText = lastText;
            this.lastTs = lastTs;
        }
    }

    private final LinkedHashMap<String, Row> rows = new LinkedHashMap<>();

    /** Adds one unread message to a chat and returns that chat's new unread count. */
    synchronized int increment(String chatId, String title, String lastText, long ts) {
        Row old = rows.get(chatId);
        int count = (old == null ? 0 : old.count) + 1;
        long lastTs = old == null ? ts : Math.max(old.lastTs, ts);
        rows.put(chatId, new Row(chatId, count, safe(title), safe(lastText), lastTs));
        evictOldest();
        return count;
    }

    /** Removes a chat (read, opened or dismissed). Returns true if it had unread messages. */
    synchronized boolean clear(String chatId) {
        return rows.remove(chatId) != null;
    }

    synchronized void clearAll() {
        rows.clear();
    }

    synchronized int count(String chatId) {
        Row r = rows.get(chatId);
        return r == null ? 0 : r.count;
    }

    synchronized int total() {
        int t = 0;
        for (Row r : rows.values()) t += r.count;
        return t;
    }

    synchronized int chats() {
        return rows.size();
    }

    /** Copy of all rows, most recently active chat first. */
    synchronized List<Row> snapshot() {
        List<Row> out = new ArrayList<>(rows.values());
        Collections.sort(out, (a, b) -> Long.compare(b.lastTs, a.lastTs));
        return out;
    }

    private void evictOldest() {
        while (rows.size() > MAX_CHATS) {
            String oldestId = null;
            long oldest = Long.MAX_VALUE;
            for (Map.Entry<String, Row> e : rows.entrySet()) {
                if (e.getValue().lastTs < oldest) {
                    oldest = e.getValue().lastTs;
                    oldestId = e.getKey();
                }
            }
            if (oldestId == null) return;
            rows.remove(oldestId);
        }
    }

    private static String safe(String s) {
        return s == null ? "" : s;
    }

    // ------------------------------------------------------------------ persistence
    // One record per line: chatId \t count \t ts \t title \t lastText
    // with backslash, tab, CR and LF escaped. No JSON library needed.

    synchronized String serialize() {
        StringBuilder sb = new StringBuilder("v1\n");
        for (Row r : rows.values()) {
            sb.append(esc(r.chatId)).append('\t')
              .append(r.count).append('\t')
              .append(r.lastTs).append('\t')
              .append(esc(r.title)).append('\t')
              .append(esc(r.lastText)).append('\n');
        }
        return sb.toString();
    }

    /** Never throws: unreadable or corrupt data just yields an empty (or partial) ledger. */
    static UnreadLedgerCore deserialize(String data) {
        UnreadLedgerCore core = new UnreadLedgerCore();
        if (data == null || !data.startsWith("v1\n")) return core;
        String[] lines = data.substring(3).split("\n");
        for (String line : lines) {
            if (line.isEmpty()) continue;
            String[] f = splitTabs(line);
            if (f.length != 5) continue;
            try {
                int count = Integer.parseInt(f[1]);
                long ts = Long.parseLong(f[2]);
                String id = unesc(f[0]);
                if (id.isEmpty() || count <= 0) continue;
                core.rows.put(id, new Row(id, count, unesc(f[3]), unesc(f[4]), ts));
            } catch (NumberFormatException ignored) {
                // skip the bad record, keep the rest
            }
        }
        core.evictOldest();
        return core;
    }

    private static String[] splitTabs(String line) {
        List<String> parts = new ArrayList<>();
        int start = 0;
        for (int i = 0; i < line.length(); i++) {
            if (line.charAt(i) == '\t') {
                parts.add(line.substring(start, i));
                start = i + 1;
            }
        }
        parts.add(line.substring(start));
        return parts.toArray(new String[0]);
    }

    private static String esc(String s) {
        StringBuilder sb = new StringBuilder(s.length() + 8);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '\\': sb.append("\\\\"); break;
                case '\t': sb.append("\\t"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                default: sb.append(c);
            }
        }
        return sb.toString();
    }

    private static String unesc(String s) {
        StringBuilder sb = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '\\' && i + 1 < s.length()) {
                char n = s.charAt(++i);
                switch (n) {
                    case 't': sb.append('\t'); break;
                    case 'n': sb.append('\n'); break;
                    case 'r': sb.append('\r'); break;
                    default: sb.append(n);
                }
            } else {
                sb.append(c);
            }
        }
        return sb.toString();
    }
}
