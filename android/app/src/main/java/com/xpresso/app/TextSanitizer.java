package com.xpresso.app;

/**
 * Turns a chat message that carries colour markup into the plain text a notification should show.
 *
 * Handled forms (nesting and braces inside the text are supported):
 *   \color[#1d4ed8]{Hello}            -> Hello      (the form the app produces)
 *   \color{red}{Hello}                -> Hello
 *   \textcolor{red}{Hello}            -> Hello
 *   \textcolor[HTML]{FF0000}{Hello}   -> Hello
 *
 * Anything else, including normal text with braces, is left untouched. The TS twin of this class
 * is supabase/functions/_shared/sanitize.ts; keep the two in sync.
 */
public final class TextSanitizer {

    private static final String TEXTCOLOR = "\\textcolor";
    private static final String COLOR = "\\color";
    private static final int MAX_DEPTH = 20;

    private TextSanitizer() {}

    /** Never returns null. */
    public static String toPlainText(String input) {
        if (input == null) return "";
        String s = strip(input, 0);
        return s.replaceAll("[ \\t]+", " ").trim();
    }

    private static String strip(String s, int depth) {
        if (depth > MAX_DEPTH) return s;
        int n = s.length();
        StringBuilder out = new StringBuilder(n);
        int i = 0;
        while (i < n) {
            boolean isText = s.startsWith(TEXTCOLOR, i);
            boolean isColor = !isText && s.startsWith(COLOR, i);
            int cmdLen = isText ? TEXTCOLOR.length() : (isColor ? COLOR.length() : 0);
            // "\colorbox" and friends are other commands, not ours.
            if (cmdLen == 0 || (i + cmdLen < n && Character.isLetter(s.charAt(i + cmdLen)))) {
                out.append(s.charAt(i++));
                continue;
            }

            int p = skipBlanks(s, i + cmdLen);

            String bracket = null;
            if (p < n && s.charAt(p) == '[') {
                int close = s.indexOf(']', p);
                if (close < 0) {
                    i += cmdLen;
                    continue;
                }
                bracket = s.substring(p + 1, close);
                p = skipBlanks(s, close + 1);
            }

            if (p >= n || s.charAt(p) != '{') {
                i = p;
                continue;
            }

            int g1Close = groupEnd(s, p);
            String g1 = s.substring(p + 1, g1Close);
            int next = Math.min(g1Close + 1, n);

            boolean hashBracket = bracket != null && bracket.trim().startsWith("#");
            boolean secondFollows = !hashBracket && next < n && s.charAt(next) == '{';

            String text;
            if (hashBracket) {
                text = g1;
            } else if (secondFollows) {
                int g2Close = groupEnd(s, next);
                text = s.substring(next + 1, g2Close);
                next = Math.min(g2Close + 1, n);
            } else if (isColor && bracket != null) {
                text = ""; // \color[model]{spec}: a colour switch with nothing wrapped
            } else {
                text = g1;
            }

            out.append(strip(text, depth + 1));
            i = next;
        }
        return out.toString();
    }

    private static int groupEnd(String s, int open) {
        int depth = 1;
        int n = s.length();
        int j = open + 1;
        while (j < n) {
            char c = s.charAt(j);
            if (c == '\\' && j + 1 < n) {
                j += 2;
                continue;
            }
            if (c == '{') depth++;
            else if (c == '}' && --depth == 0) return j;
            j++;
        }
        return n;
    }

    private static int skipBlanks(String s, int p) {
        while (p < s.length() && (s.charAt(p) == ' ' || s.charAt(p) == '\t')) p++;
        return p;
    }
}
