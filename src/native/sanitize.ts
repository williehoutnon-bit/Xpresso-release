/**
 * JS twin of android/.../TextSanitizer.java. Use it:
 *  - in the Supabase Edge Function / server that builds the FCM payload, so `text` is already plain;
 *  - anywhere in the app that needs a plain-text preview (chat list, share sheet...).
 * The native service sanitizes again as a safety net. Keep both implementations in sync.
 */

const TEXTCOLOR = '\\textcolor';
const COLOR = '\\color';
const MAX_DEPTH = 20;

const isLetter = (c: string) => /[A-Za-z]/.test(c);

function skipBlanks(s: string, p: number): number {
  while (p < s.length && (s[p] === ' ' || s[p] === '\t')) p++;
  return p;
}

/** Index of the brace closing the group opened at `open`, or s.length if unterminated. */
function groupEnd(s: string, open: number): number {
  let depth = 1;
  let j = open + 1;
  while (j < s.length) {
    const c = s[j];
    if (c === '\\' && j + 1 < s.length) {
      j += 2;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return j;
    j++;
  }
  return s.length;
}

function strip(s: string, depth: number): string {
  if (depth > MAX_DEPTH) return s;
  const n = s.length;
  let out = '';
  let i = 0;
  while (i < n) {
    const isText = s.startsWith(TEXTCOLOR, i);
    const isColor = !isText && s.startsWith(COLOR, i);
    const cmdLen = isText ? TEXTCOLOR.length : isColor ? COLOR.length : 0;
    if (cmdLen === 0 || (i + cmdLen < n && isLetter(s[i + cmdLen]))) {
      out += s[i++];
      continue;
    }

    let p = skipBlanks(s, i + cmdLen);

    let bracket: string | null = null;
    if (p < n && s[p] === '[') {
      const close = s.indexOf(']', p);
      if (close < 0) {
        i += cmdLen;
        continue;
      }
      bracket = s.slice(p + 1, close);
      p = skipBlanks(s, close + 1);
    }

    if (p >= n || s[p] !== '{') {
      i = p;
      continue;
    }

    const g1Close = groupEnd(s, p);
    const g1 = s.slice(p + 1, g1Close);
    let next = Math.min(g1Close + 1, n);

    const hashBracket = bracket !== null && bracket.trim().startsWith('#');
    const secondFollows = !hashBracket && next < n && s[next] === '{';

    let text: string;
    if (hashBracket) {
      text = g1;
    } else if (secondFollows) {
      const g2Close = groupEnd(s, next);
      text = s.slice(next + 1, g2Close);
      next = Math.min(g2Close + 1, n);
    } else if (isColor && bracket !== null) {
      text = '';
    } else {
      text = g1;
    }

    out += strip(text, depth + 1);
    i = next;
  }
  return out;
}

/** Plain text of a message that may carry colour markup. Never returns null. */
export function toPlainText(input: string | null | undefined): string {
  if (input == null) return '';
  return strip(input, 0).replace(/[ \t]+/g, ' ').trim();
}
