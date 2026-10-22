/**
 * System clipboard bridge for the math editor.
 *
 * - Android (Capacitor): XpressoClipboardPlugin.java (ClipboardManager). navigator.clipboard.readText()
 *   inside a WebView is permission/focus-gated and can reject, so paste never relies on it there.
 * - Web / desktop: async Clipboard API, then the legacy execCommand fallback.
 *
 * Copy writes TWO representations at once:
 *   text/plain -> readable text for other apps (WhatsApp, Notes): "x^2+1/2"
 *   text/html  -> carries the lossless Xpresso tree (data-xpresso) for Xpresso -> Xpresso paste
 * and remembers the last copy in memory, so paste still round-trips losslessly when the OS or a
 * keyboard clipboard manager strips the HTML.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { MathNode } from '../math/mathModel';
import {
  buildClipboardPayload,
  parseClipboard,
  type ClipPayload
} from '../math/mathSelectionHelpers';

interface XpressoClipboardPlugin {
  write(options: { text: string; html?: string }): Promise<void>;
  read(): Promise<{ text: string; html: string }>;
}

const Native = registerPlugin<XpressoClipboardPlugin>('XpressoClipboard');

let lastCopy: ClipPayload | null = null;

/** Remember a payload that was written through a DOM copy event (desktop / hardware keyboard). */
export function rememberCopy(payload: ClipPayload): void {
  lastCopy = payload;
}

function legacyCopy(text: string): void {
  const previouslyFocused = document.activeElement as HTMLElement | null;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.readOnly = true;
  ta.setAttribute('inputmode', 'none');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch { /* nothing else to try */ }
  document.body.removeChild(ta);
  previouslyFocused?.focus?.();
}

async function writeSystem(p: ClipPayload): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Native.write({ text: p.text, html: p.html });
      return;
    } catch (err) {
      console.warn('[clipboard] native write failed, falling back to web API', err);
    }
  }
  try {
    if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([p.text], { type: 'text/plain' }),
          'text/html': new Blob([p.html], { type: 'text/html' })
        })
      ]);
      return;
    }
  } catch { /* fall through */ }
  try {
    await navigator.clipboard.writeText(p.text);
    return;
  } catch { /* fall through */ }
  legacyCopy(p.text);
}

async function readSystem(): Promise<{ text: string; html: string }> {
  if (Capacitor.isNativePlatform()) {
    try {
      const r = await Native.read();
      return { text: r.text ?? '', html: r.html ?? '' };
    } catch (err) {
      console.warn('[clipboard] native read failed, falling back to web API', err);
    }
  }
  try {
    if (navigator.clipboard?.read) {
      const items = await navigator.clipboard.read();
      let text = '';
      let html = '';
      for (const item of items) {
        if (item.types.includes('text/plain')) text = await (await item.getType('text/plain')).text();
        if (item.types.includes('text/html')) html = await (await item.getType('text/html')).text();
      }
      if (text || html) return { text, html };
    }
  } catch { /* fall through */ }
  try {
    return { text: await navigator.clipboard.readText(), html: '' };
  } catch {
    return { text: '', html: '' };
  }
}

/** Copy nodes to the system clipboard (plain text + lossless HTML payload). */
export async function copyNodes(nodes: MathNode[]): Promise<boolean> {
  if (!nodes || nodes.length === 0) return false;
  const payload = buildClipboardPayload(nodes);
  lastCopy = payload;
  await writeSystem(payload);
  return true;
}

/** Turn clipboard data (e.g. from a DOM paste event) into nodes. */
export function nodesFromClipboard(input: { text?: string; html?: string }): MathNode[] {
  return parseClipboard(input, lastCopy);
}

/**
 * Read the system clipboard as nodes. If the system clipboard cannot be read at all (permission
 * denied) fall back to the last thing copied inside the app.
 */
export async function readNodes(): Promise<MathNode[]> {
  const sys = await readSystem();
  if (!sys.text && !sys.html) {
    return lastCopy ? parseClipboard({ text: lastCopy.text }, lastCopy) : [];
  }
  return parseClipboard(sys, lastCopy);
}
