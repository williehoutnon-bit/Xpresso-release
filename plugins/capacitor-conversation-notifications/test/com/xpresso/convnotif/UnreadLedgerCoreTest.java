package com.xpresso.convnotif;

import java.util.List;

/**
 * Plain-JDK test (no JUnit, no Android): run with  node scripts/test-unread-ledger.mjs
 * Covers the counting rules behind the launcher badge and the "N messages from M chats" header.
 */
public class UnreadLedgerCoreTest {

    private static int passed = 0;
    private static int failed = 0;

    private static void check(String name, boolean ok) {
        if (ok) { passed++; System.out.println("  ok   " + name); }
        else { failed++; System.out.println("  FAIL " + name); }
    }

    private static void eq(String name, Object expected, Object actual) {
        boolean ok = expected == null ? actual == null : expected.equals(actual);
        if (!ok) System.out.println("       expected <" + expected + "> but was <" + actual + ">");
        check(name, ok);
    }

    public static void main(String[] args) {
        System.out.println("counting");
        UnreadLedgerCore l = new UnreadLedgerCore();
        eq("REPORTED BUG: 1st message from Bosco -> 1", 1, l.increment("bosco", "Bosco", "Test", 1000));
        eq("REPORTED BUG: 2nd message from the SAME sender -> 2", 2, l.increment("bosco", "Bosco", "Hello", 2000));
        eq("REPORTED BUG: 3rd message from the SAME sender -> 3", 3, l.increment("bosco", "Bosco", "Justine", 3000));
        eq("badge total follows", 3, l.total());
        eq("one chat", 1, l.chats());

        eq("a second chat starts at 1", 1, l.increment("amy", "Amy", "Hi", 4000));
        eq("total is the sum across chats", 4, l.total());
        eq("two chats", 2, l.chats());
        eq("per-chat count unaffected by the other chat", 3, l.count("bosco"));

        System.out.println("reading / dismissing");
        check("clearing a known chat reports true", l.clear("bosco"));
        eq("REPORTED BUG: badge DECREASES when a chat is read", 1, l.total());
        eq("chat count decreases", 1, l.chats());
        check("clearing an unknown chat reports false", !l.clear("nobody"));
        eq("unknown clear changes nothing", 1, l.total());
        eq("a cleared chat starts again from 1", 1, l.increment("bosco", "Bosco", "Again", 5000));
        l.clearAll();
        eq("clearAll empties the total", 0, l.total());
        eq("clearAll empties the chats", 0, l.chats());

        System.out.println("recency order (drives the header lines)");
        UnreadLedgerCore o = new UnreadLedgerCore();
        o.increment("a", "A", "x", 100);
        o.increment("b", "B", "y", 300);
        o.increment("c", "C", "z", 200);
        List<UnreadLedgerCore.Row> rows = o.snapshot();
        eq("most recent first", "b", rows.get(0).chatId);
        eq("then", "c", rows.get(1).chatId);
        eq("oldest last", "a", rows.get(2).chatId);
        o.increment("a", "A", "x2", 400);
        eq("a chat that gets a new message moves to the top", "a", o.snapshot().get(0).chatId);
        eq("keeps the latest text", "x2", o.snapshot().get(0).lastText);
        eq("an out-of-order older timestamp never moves lastTs backwards", 400L, bump(o));

        System.out.println("survives the process being killed (SharedPreferences round trip)");
        UnreadLedgerCore p = new UnreadLedgerCore();
        p.increment("bosco", "Bosco", "tab\there \\ back\nslash and \"quotes\" \uD83D\uDE00 \u00e9", 1700000000000L);
        p.increment("bosco", "Bosco", "second", 1700000001000L);
        p.increment("grp:1", "Choir \u2013 Fans", "line1\r\nline2", 1700000002000L);
        UnreadLedgerCore back = UnreadLedgerCore.deserialize(p.serialize());
        eq("total survives", p.total(), back.total());
        eq("chats survive", p.chats(), back.chats());
        eq("per-chat count survives", 2, back.count("bosco"));
        eq("text with tabs, newlines, backslashes, emoji survives", p.snapshot().get(1).lastText, back.snapshot().get(1).lastText);
        eq("title with unicode survives", "Choir \u2013 Fans", back.snapshot().get(0).title);
        eq("after a 'restart' the next message continues the count", 3, back.increment("bosco", "Bosco", "third", 1700000003000L));

        System.out.println("bad stored data never crashes");
        eq("null", 0, UnreadLedgerCore.deserialize(null).total());
        eq("empty", 0, UnreadLedgerCore.deserialize("").total());
        eq("wrong version", 0, UnreadLedgerCore.deserialize("v9\nx\t1\t1\tt\tm\n").total());
        eq("garbage", 0, UnreadLedgerCore.deserialize("\u0000\uFFFD not a ledger").total());
        UnreadLedgerCore partial = UnreadLedgerCore.deserialize("v1\ngood\t2\t10\tG\tmsg\nbad\tNaN\t10\tB\tmsg\nshort\t1\nzero\t0\t1\tZ\tm\n\t3\t1\tnoid\tm\n");
        eq("one good record kept, bad/short/zero/id-less skipped", 2, partial.total());
        eq("only the good chat remains", 1, partial.chats());

        System.out.println("size cap");
        UnreadLedgerCore big = new UnreadLedgerCore();
        for (int i = 0; i < UnreadLedgerCore.MAX_CHATS + 25; i++) big.increment("c" + i, "C" + i, "m", i);
        eq("never more than MAX_CHATS chats", UnreadLedgerCore.MAX_CHATS, big.chats());
        eq("the newest chat is kept", 1, big.count("c" + (UnreadLedgerCore.MAX_CHATS + 24)));
        eq("the oldest chat is dropped", 0, big.count("c0"));

        System.out.println("header wording (like WhatsApp's \"7 messages from 3 chats\")");
        eq("one message", "1 new message", NotificationText.summaryLine(1, 1));
        eq("several messages, one chat", "3 new messages", NotificationText.summaryLine(3, 1));
        eq("several chats", "35 messages from 7 chats", NotificationText.summaryLine(35, 7));
        eq("nothing", "", NotificationText.summaryLine(0, 0));
        eq("inbox line", "Bosco: Test", NotificationText.inboxLine("Bosco", "Test"));
        eq("newlines flattened", "Bosco: a b", NotificationText.inboxLine("Bosco", "a\nb"));
        eq("no title", "Test", NotificationText.inboxLine("", "Test"));
        eq("no text", "Bosco", NotificationText.inboxLine("Bosco", ""));
        String longLine = NotificationText.inboxLine("B", new String(new char[300]).replace('\0', 'x'));
        check("long text is shortened with an ellipsis", longLine.length() <= 85 && longLine.endsWith("\u2026"));

        System.out.println("\n" + passed + " passed" + (failed > 0 ? ", " + failed + " FAILED" : ""));
        if (failed > 0) System.exit(1);
    }

    private static long bump(UnreadLedgerCore c) {
        c.increment("a", "A", "old", 50);
        return c.snapshot().get(0).lastTs;
    }
}
