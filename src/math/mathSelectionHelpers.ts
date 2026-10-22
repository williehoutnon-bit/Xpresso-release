/**
 * Selection + clipboard helpers for the Xpresso math editor.
 *
 * Pure TypeScript (no DOM, no Svelte, no Capacitor) so every function here can be
 * unit-tested in Node: see scripts/test-selection-clipboard.ts
 */
import { type MathNode, type CursorPath, type ContainerRef, getContainer, replaceContainer, generateId } from './mathModel';
import { mathNodesToPlainText } from './mathSerialization';
import { getSelectedNodeIds } from './mathPointerResolver';
import { deleteNodes } from './mathOperations';

type SlotList = Array<[ContainerRef['slot'], MathNode[]]>;

/**
 * Child containers of a node, in the SAME order getSelectedNodeIds() walks them.
 * (document order: numerator before denominator, base before exponent, ...)
 */
function slotsOf(node: MathNode): SlotList {
  switch (node.type) {
    case 'fraction': return [['numerator', node.numerator], ['denominator', node.denominator]];
    case 'exponent': return [['base', node.base], ['exponent', node.exponent]];
    case 'subscript': return [['base', node.base], ['subscript', node.subscript]];
    case 'sqrt': return [['content', node.content]];
    case 'nthroot': return [['index', node.index], ['content', node.content]];
    case 'longdiv': {
      const s: SlotList = [['index', node.index], ['content', node.content]];
      if (node.quotient) s.push(['quotient', node.quotient]);
      return s;
    }
    case 'bracket':
    case 'integral': {
      const s: SlotList = [['content', node.content]];
      if (node.subscript) s.push(['subscript', node.subscript]);
      if (node.superscript) s.push(['superscript', node.superscript]);
      return s;
    }
    case 'underbrace': return [['content', node.content], ['label', node.label]];
    default: return [];
  }
}

/** Position of the first selected node in document order (where the caret belongs after a delete). */
export function firstSelectedPath(tree: MathNode[], ids: Set<string>): CursorPath | null {
  function walk(nodes: MathNode[], containerPath: ContainerRef[]): CursorPath | null {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (ids.has(node.id)) return { containerPath, offset: i };
      for (const [slot, child] of slotsOf(node)) {
        const hit = walk(child, [...containerPath, { nodeId: node.id, slot }]);
        if (hit) return hit;
      }
    }
    return null;
  }
  return walk(tree, []);
}

/**
 * Delete the selected nodes and return the new tree AND a caret at the start of what was removed.
 * (The old code reset the caret to the very start of the document, so "paste over a selection"
 * and "type over a selection" landed in the wrong place.)
 */
export function deleteSelectionWithCaret(
  tree: MathNode[],
  ids: Set<string>
): { tree: MathNode[]; cursor: CursorPath } | null {
  if (!ids || ids.size === 0) return null;
  const start = firstSelectedPath(tree, ids);
  const next = deleteNodes(tree, ids);
  const cursor = start ?? { containerPath: [], offset: 0 };
  // Clamp: the container still exists (a container's own node precedes its children in `ids`),
  // but be defensive about the offset.
  try {
    const len = getContainer(next, cursor.containerPath).length;
    return { tree: next, cursor: { containerPath: cursor.containerPath, offset: Math.min(cursor.offset, len) } };
  } catch {
    return { tree: next, cursor: { containerPath: [], offset: Math.min(cursor.offset, next.length) } };
  }
}

/** Select the whole root container. Returns anchor/focus to assign to selectionAnchorPath / currentCursorPath. */
export function selectAllRange(tree: MathNode[]): { anchor: CursorPath; focus: CursorPath } | null {
  if (!tree || tree.length === 0) return null;
  return {
    anchor: { containerPath: [], offset: 0 },
    focus: { containerPath: [], offset: tree.length }
  };
}

const isWordChar = (n: MathNode | undefined) =>
  !!n && n.type === 'char' && /[\p{L}\p{N}_]/u.test(n.value);

/**
 * Long-press selection: expand a caret to the word (run of letters/digits) around it.
 * If the caret sits next to a structure (fraction, root, ...) select that single node instead.
 * Returns null when there is nothing sensible to select (e.g. caret between spaces).
 */
export function expandToWord(
  tree: MathNode[],
  at: CursorPath
): { anchor: CursorPath; focus: CursorPath } | null {
  let container: MathNode[];
  try { container = getContainer(tree, at.containerPath); } catch { return null; }
  const k = Math.max(0, Math.min(at.offset, container.length));
  const mk = (s: number, e: number) => ({
    anchor: { containerPath: at.containerPath, offset: s },
    focus: { containerPath: at.containerPath, offset: e }
  });

  let idx = -1;
  if (isWordChar(container[k])) idx = k;
  else if (isWordChar(container[k - 1])) idx = k - 1;

  if (idx >= 0) {
    let s = idx, e = idx + 1;
    while (s > 0 && isWordChar(container[s - 1])) s--;
    while (e < container.length && isWordChar(container[e])) e++;
    return mk(s, e);
  }
  // Structure next to the caret: select it as one unit.
  if (container[k] && container[k].type !== 'char') return mk(k, k + 1);
  if (container[k - 1] && container[k - 1].type !== 'char') return mk(k - 1, k);
  return null;
}

/** Insert nodes at a caret; returns the new tree and a caret placed just after them. */
export function insertNodesAtCaret(
  tree: MathNode[],
  cursor: CursorPath,
  nodes: MathNode[]
): { tree: MathNode[]; cursor: CursorPath } {
  let container: MathNode[];
  let path = cursor.containerPath;
  try { container = getContainer(tree, path); } catch { container = tree; path = []; }
  const off = Math.max(0, Math.min(cursor.offset, container.length));
  const merged = [...container.slice(0, off), ...nodes, ...container.slice(off)];
  return {
    tree: replaceContainer(tree, path, merged),
    cursor: { containerPath: path, offset: off + nodes.length }
  };
}

/* ------------------------------------------------------------------ clipboard payload */
/*
 * The clipboard carries the AST itself (JSON), NOT a rendering and NOT the serializeTree() text format.
 *
 * Why: SVG (radical, integral sign, long-division bracket, underbrace) is only how a node is DRAWN.
 * Copy/paste never touches it: it reads and writes MathNode objects. serializeTree() is lossy
 * (drops the open/closed flag of brackets and an empty longdiv quotient), so it is not used here.
 *
 * Clipboard content is untrusted input (any app can write to it), so paste never trusts the JSON:
 * sanitizeNodes() rebuilds every node from a whitelist of types and fields, with size and depth
 * caps, fresh ids, and validated colours.
 */

export const CLIP_ATTR = 'data-xpresso';
/** Hard cap on pasted plain text (characters). */
export const MAX_PASTE_CHARS = 20000;
/** Hard cap on the JSON payload (characters). */
export const MAX_PAYLOAD_CHARS = 400000;
const MAX_NODES = 5000;
const MAX_DEPTH = 24;

const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20}|rgba?\([0-9 ,.%]{1,40}\))$/;
const BRACKET_KINDS = ['round', 'square', 'curly', 'absolute', 'evaluation'] as const;

export interface ClipPayload {
  /** Readable text for other apps (WhatsApp, Notes...): x^2 + 1/2 */
  text: string;
  /** HTML carrying the lossless AST for Xpresso -> Xpresso paste */
  html: string;
  /** The AST as JSON (ids stripped; they are re-created on paste) */
  json: string;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function buildClipboardPayload(nodes: MathNode[]): ClipPayload {
  const json = JSON.stringify(nodes, (k, v) => (k === 'id' ? undefined : v));
  const text = mathNodesToPlainText(nodes);
  const html = `<span ${CLIP_ATTR}="${encodeURIComponent(json)}">${escapeHtml(text)}</span>`;
  return { text, html, json };
}

type Budget = { n: number };

function sanitizeList(v: unknown, b: Budget, depth: number): MathNode[] {
  if (!Array.isArray(v) || depth > MAX_DEPTH) throw new Error('invalid list');
  return v.map((x) => sanitizeNode(x, b, depth + 1));
}

function optionalList(v: unknown, b: Budget, depth: number): MathNode[] | undefined {
  return v === undefined || v === null ? undefined : sanitizeList(v, b, depth);
}

function sanitizeNode(x: any, b: Budget, depth: number): MathNode {
  if (!x || typeof x !== 'object' || ++b.n > MAX_NODES) throw new Error('invalid node');
  const id = generateId();
  const color: { color?: string } =
    typeof x.color === 'string' && COLOR_RE.test(x.color) ? { color: x.color } : {};

  switch (x.type) {
    case 'char':
      if (typeof x.value !== 'string' || x.value.length === 0 || x.value.length > 8) throw new Error('bad char');
      return { id, type: 'char', value: x.value, ...color };
    case 'fraction':
      return { id, type: 'fraction', numerator: sanitizeList(x.numerator, b, depth), denominator: sanitizeList(x.denominator, b, depth), ...color };
    case 'exponent':
      return { id, type: 'exponent', base: sanitizeList(x.base, b, depth), exponent: sanitizeList(x.exponent, b, depth), ...color };
    case 'subscript':
      return { id, type: 'subscript', base: sanitizeList(x.base, b, depth), subscript: sanitizeList(x.subscript, b, depth), ...color };
    case 'sqrt':
      return { id, type: 'sqrt', content: sanitizeList(x.content, b, depth), ...color };
    case 'nthroot':
      return { id, type: 'nthroot', index: sanitizeList(x.index, b, depth), content: sanitizeList(x.content, b, depth), ...color };
    case 'longdiv':
      return { id, type: 'longdiv', index: sanitizeList(x.index, b, depth), content: sanitizeList(x.content, b, depth), quotient: sanitizeList(x.quotient ?? [], b, depth), ...color };
    case 'bracket': {
      if (!BRACKET_KINDS.includes(x.bracketKind)) throw new Error('bad bracket kind');
      const sub = optionalList(x.subscript, b, depth);
      const sup = optionalList(x.superscript, b, depth);
      return {
        id, type: 'bracket', bracketKind: x.bracketKind, content: sanitizeList(x.content, b, depth),
        closed: typeof x.closed === 'boolean' ? x.closed : true,
        ...(sub ? { subscript: sub } : {}), ...(sup ? { superscript: sup } : {}), ...color
      };
    }
    case 'integral': {
      const sub = optionalList(x.subscript, b, depth);
      const sup = optionalList(x.superscript, b, depth);
      return {
        id, type: 'integral', content: sanitizeList(x.content, b, depth),
        ...(sub ? { subscript: sub } : {}), ...(sup ? { superscript: sup } : {}), ...color
      };
    }
    case 'underbrace':
      return { id, type: 'underbrace', content: sanitizeList(x.content, b, depth), label: sanitizeList(x.label, b, depth), ...color };
    default:
      throw new Error('unknown node type');
  }
}

/** Validate untrusted JSON into a fresh MathNode[] (new ids, whitelisted fields). Returns null if invalid. */
export function sanitizeNodes(json: string): MathNode[] | null {
  if (!json || json.length > MAX_PAYLOAD_CHARS) return null;
  try {
    const nodes = sanitizeList(JSON.parse(json), { n: 0 }, 0);
    return nodes.length > 0 ? nodes : null;
  } catch {
    return null;
  }
}

/** Plain external text -> char nodes (no command parsing: backslashes and braces stay literal). */
export function plainTextToNodes(text: string): MathNode[] {
  const clean = (text ?? '').replace(/\r\n?/g, '\n');
  return Array.from(clean)
    .slice(0, MAX_PASTE_CHARS)
    .map((value) => ({ id: generateId(), type: 'char' as const, value }));
}

/**
 * Decide what a paste means:
 *  1. HTML carrying our payload            -> validated AST (lossless)
 *  2. text equal to what WE last copied    -> validated AST (the OS / keyboard stripped the HTML)
 *  3. anything else                        -> literal characters
 */
export function parseClipboard(
  input: { text?: string; html?: string },
  last?: ClipPayload | null
): MathNode[] {
  const m = input.html ? input.html.match(new RegExp(`${CLIP_ATTR}="([^"]*)"`)) : null;
  if (m) {
    let json = '';
    try { json = decodeURIComponent(m[1]); } catch { json = ''; }
    const nodes = sanitizeNodes(json);
    if (nodes) return nodes;
  }
  if (last && input.text !== undefined && input.text === last.text) {
    const nodes = sanitizeNodes(last.json);
    if (nodes) return nodes;
  }
  return plainTextToNodes(input.text ?? '');
}
