package com.xpresso.convnotif;

/** Wording for the bundled "Xpresso" notification header. Pure Java, unit-tested. */
final class NotificationText {

    private NotificationText() {}

    /** "1 new message", "3 new messages", "5 messages from 2 chats" (WhatsApp-style). */
    static String summaryLine(int totalMessages, int chats) {
        if (totalMessages <= 0) return "";
        if (totalMessages == 1) return "1 new message";
        if (chats <= 1) return totalMessages + " new messages";
        return totalMessages + " messages from " + chats + " chats";
    }

    /** One line of the expanded summary: "Bosco: Test" (long text is shortened). */
    static String inboxLine(String title, String lastText) {
        String t = title == null ? "" : title.trim();
        String m = lastText == null ? "" : lastText.replace('\n', ' ').trim();
        if (m.length() > 80) m = m.substring(0, 79) + "\u2026";
        if (t.isEmpty()) return m;
        return m.isEmpty() ? t : t + ": " + m;
    }
}
