/**
 * Run: npx tsx scripts/test-selection-clipboard.ts
 * Exercises the REAL math functions the editor and MathKeyboard use.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deserializeTree, serializeTree, mathNodesToPlainText } from '../src/math/mathSerialization';
import { sliceTree } from '../src/math/treeSlice';
import { getSelectedNodeIds } from '../src/math/mathPointerResolver';
import * as ops from '../src/math/mathOperations';
const { insertChar, backspace, deleteNodes } = ops;
import type { CursorPath, MathNode } from '../src/math/mathModel';
import {
  buildClipboardPayload, parseClipboard, plainTextToNodes, insertNodesAtCaret,
  deleteSelectionWithCaret, selectAllRange, expandToWord, firstSelectedPath, MAX_PASTE_CHARS, MAX_PAYLOAD_CHARS, sanitizeNodes
} from '../src/math/mathSelectionHelpers';

let passed = 0;
const test = (name: string, fn: () => void) => {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e: any) { console.error('  FAIL ' + name + '\n       ' + (e?.message ?? e)); process.exitCode = 1; }
};
const ser = serializeTree;
const root = (offset: number): CursorPath => ({ containerPath: [], offset });

const SRC = 'a+\\frac{1}{x}=\\exp{y}{2}+\\sqrt{9}';
const RICH = SRC + '+\\integral{xy}{0}{1}+\\bracket[round]{p}{q}{r}+\\underbrace{u}{lbl}';

console.log('selection model (what the editor derives from anchor + caret)');
test('serialize/deserialize round-trips a rich expression', () => {
  assert.equal(ser(deserializeTree(RICH)), RICH);
});
test('REGRESSION: anchor == null (current app) selects nothing', () => {
  const t = deserializeTree(SRC);
  const anchor: CursorPath | null = null;
  const ids = anchor ? getSelectedNodeIds(t, anchor, root(5)) : new Set<string>();
  assert.equal(ids.size, 0);
});
test('anchor + caret selects a range; slice / delete / serialize agree', () => {
  const t = deserializeTree(SRC);
  const ids = getSelectedNodeIds(t, root(1), root(5));
  assert.equal(ser(sliceTree(t, ids)), '+\\frac{1}{x}=\\exp{y}{2}');
  assert.equal(ser(deleteNodes(t, ids)), 'a+\\sqrt{9}');
});
test('reversed selection (caret before anchor) selects the same nodes', () => {
  const t = deserializeTree(SRC);
  const a = getSelectedNodeIds(t, root(1), root(5));
  const b = getSelectedNodeIds(t, root(5), root(1));
  assert.deepEqual([...a].sort(), [...b].sort());
});
test('select all copies the whole expression', () => {
  const t = deserializeTree(RICH);
  const r = selectAllRange(t)!;
  const ids = getSelectedNodeIds(t, r.anchor, r.focus);
  assert.equal(ser(sliceTree(t, ids)), RICH);
});
test('selection can start INSIDE an integral and end outside (needed the traversal fix)', () => {
  const t = deserializeTree('\\integral{xy}{0}{1}+z');
  const integral = t[0];
  const anchor: CursorPath = { containerPath: [{ nodeId: integral.id, slot: 'content' }], offset: 1 };
  const ids = getSelectedNodeIds(t, anchor, root(2));
  assert.equal(ser(sliceTree(t, ids)), '\\integral{y}{0}{1}+');
});
test('selection inside bracket superscript works', () => {
  const t = deserializeTree('\\bracket[round]{p}{q}{rs}+z');
  const b = t[0];
  const anchor: CursorPath = { containerPath: [{ nodeId: b.id, slot: 'superscript' }], offset: 1 };
  const ids = getSelectedNodeIds(t, anchor, root(2));
  assert.equal(ser(sliceTree(t, ids)), '\\bracket[round]{}{}{s}+');
});

console.log('caret placement after delete / cut (was: always jumped to document start)');
test('caret lands where the selection started', () => {
  const t = deserializeTree(SRC);
  const ids = getSelectedNodeIds(t, root(1), root(5));
  const r = deleteSelectionWithCaret(t, ids)!;
  assert.deepEqual(r.cursor, root(1));
});
test('selection starting inside a numerator puts the caret inside that numerator', () => {
  const t = deserializeTree('\\frac{ab}{cd}+z');
  const frac = t[0];
  const anchor: CursorPath = { containerPath: [{ nodeId: frac.id, slot: 'numerator' }], offset: 1 };
  const ids = getSelectedNodeIds(t, anchor, root(1));
  const r = deleteSelectionWithCaret(t, ids)!;
  assert.equal(ser(r.tree), '\\frac{a}{}+z');
  assert.equal(r.cursor.containerPath[0]?.slot, 'numerator');
  assert.equal(r.cursor.offset, 1);
});
test('firstSelectedPath is null for an empty selection', () => {
  assert.equal(firstSelectedPath(deserializeTree(SRC), new Set()), null);
});

console.log('custom keyboard path: type / backspace after select, cut, paste');
test('KEYBOARD: typing over a selection puts the char at the selection start', () => {
  const t = deserializeTree(SRC);
  const ids = getSelectedNodeIds(t, root(1), root(5));
  const del = deleteSelectionWithCaret(t, ids)!;
  const typed = insertChar(del.tree, del.cursor, 'Z');
  assert.equal(ser(typed.tree), 'aZ+\\sqrt{9}');
});
test('KEYBOARD: old behaviour (caret reset to 0) would have typed Z at the start', () => {
  const t = deserializeTree(SRC);
  const ids = getSelectedNodeIds(t, root(1), root(5));
  const typed = insertChar(deleteNodes(t, ids), root(0), 'Z');
  assert.equal(ser(typed.tree), 'Za+\\sqrt{9}');
});
test('KEYBOARD: after paste the caret is after the pasted nodes; typing + backspace behave', () => {
  const base = deserializeTree('ab');
  const pasted = deserializeTree('\\frac{1}{2}');
  const r = insertNodesAtCaret(base, root(1), pasted);
  assert.equal(ser(r.tree), 'a\\frac{1}{2}b');
  assert.equal(r.cursor.offset, 2);
  const typed = insertChar(r.tree, r.cursor, 'x');
  assert.equal(ser(typed.tree), 'a\\frac{1}{2}xb');
  const bs = backspace(typed.tree, typed.cursor);
  assert.equal(ser(bs.tree), 'a\\frac{1}{2}b');
});
test('KEYBOARD: paste inside a numerator stays inside the numerator', () => {
  const base = deserializeTree('\\frac{a}{b}');
  const frac = base[0];
  const at: CursorPath = { containerPath: [{ nodeId: frac.id, slot: 'numerator' }], offset: 1 };
  const r = insertNodesAtCaret(base, at, plainTextToNodes('12'));
  assert.equal(ser(r.tree), '\\frac{a12}{b}');
  assert.deepEqual(r.cursor.containerPath, at.containerPath);
  assert.equal(r.cursor.offset, 3);
});
test('paste over a selection replaces it at the right place', () => {
  const t = deserializeTree(SRC);
  const ids = getSelectedNodeIds(t, root(1), root(5));
  const del = deleteSelectionWithCaret(t, ids)!;
  const r = insertNodesAtCaret(del.tree, del.cursor, plainTextToNodes('Q'));
  assert.equal(ser(r.tree), 'aQ+\\sqrt{9}');
});

console.log('clipboard payload (AST as JSON, validated on paste)');
// ids differ between copies by design (fresh ids on paste); compare structure only
const strip = (v: any): any => Array.isArray(v) ? v.map(strip)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([k, x]) => k !== 'id' && x !== undefined).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, strip(x)])) : v;
const same = (a: any, b: any) => JSON.stringify(strip(a)) === JSON.stringify(strip(b));

test('Xpresso -> Xpresso is lossless via the HTML payload', () => {
  const t = deserializeTree(RICH);
  assert.ok(same(parseClipboard({ text: 'x', html: buildClipboardPayload(t).html }), t));
});
test('lossless even when the OS strips the HTML (fingerprint fallback)', () => {
  const t = deserializeTree('\\frac{1}{2}+\\sqrt{x}');
  const p = buildClipboardPayload(t);
  assert.ok(same(parseClipboard({ text: p.text }, p), t));
});
test('pasted nodes get fresh ids (no duplicate ids after pasting twice)', () => {
  const p = buildClipboardPayload(deserializeTree('\\frac{1}{2}'));
  const a = parseClipboard({ html: p.html }), b = parseClipboard({ html: p.html });
  assert.notEqual(a[0].id, b[0].id);
  assert.notEqual((a[0] as any).numerator[0].id, (b[0] as any).numerator[0].id);
});
test('other apps get readable text, not raw \\frac{..} commands', () => {
  const p = buildClipboardPayload(deserializeTree('x+\\frac{1}{2}=\\exp{y}{2}+\\sqrt{9}'));
  assert.equal(p.text, 'x+1/2=y^2+√(9)');
});
test('external text with braces and backslashes stays literal', () => {
  const nodes = plainTextToNodes('a{b}\\c');
  assert.equal(nodes.length, 6);
  assert.ok(nodes.every((n: MathNode) => n.type === 'char'));
});
test('external text: emoji stay whole, CRLF becomes a single newline', () => {
  const vals = plainTextToNodes('hi 😀\r\nok').map((n: any) => n.value);
  assert.ok(vals.includes('😀'));
  assert.equal(vals.filter((v: string) => v === '\n').length, 1);
});
test('external text that merely looks like LaTeX is NOT executed', () => {
  assert.ok(parseClipboard({ text: '\\frac{1}{2}' }).every((n: MathNode) => n.type === 'char'));
});
test('oversized plain text is capped', () => {
  assert.equal(plainTextToNodes('x'.repeat(MAX_PASTE_CHARS + 500)).length, MAX_PASTE_CHARS);
});

console.log('untrusted clipboard JSON is rejected or sanitised');
const htmlOf = (json: string) => `<span data-xpresso="${encodeURIComponent(json)}">x</span>`;
const asText = (nodes: MathNode[]) => nodes.every((n) => n.type === 'char');
test('garbage / truncated payload falls back to plain text, never throws', () => {
  assert.equal(ser(parseClipboard({ html: '<span data-xpresso="%E0%A4%A">oops</span>', text: 'oops' })), 'oops');
  assert.equal(sanitizeNodes('{not json'), null);
});
test('unknown node type is rejected', () => {
  assert.equal(sanitizeNodes('[{"type":"script","content":[]}]'), null);
});
test('payload over the size cap is rejected', () => {
  assert.equal(sanitizeNodes('[' + '{"type":"char","value":"a"},'.repeat(MAX_PAYLOAD_CHARS / 20) + '{"type":"char","value":"a"}]'), null);
});
test('too many nodes is rejected', () => {
  assert.equal(sanitizeNodes(JSON.stringify(Array.from({ length: 6000 }, () => ({ type: 'char', value: 'a' })))), null);
});
test('absurd nesting depth is rejected', () => {
  let n: any = { type: 'char', value: 'a' };
  for (let i = 0; i < 200; i++) n = { type: 'sqrt', content: [n] };
  assert.equal(sanitizeNodes(JSON.stringify([n])), null);
});
test('oversized char value is rejected', () => {
  assert.equal(sanitizeNodes(JSON.stringify([{ type: 'char', value: 'x'.repeat(100) }])), null);
});
test('colour must look like a colour (CSS injection attempt is dropped)', () => {
  const out = sanitizeNodes(JSON.stringify([{ type: 'char', value: 'a', color: 'red;background:url(//evil)' }]))!;
  assert.equal((out[0] as any).color, undefined);
  const ok = sanitizeNodes(JSON.stringify([{ type: 'char', value: 'a', color: '#1d4ed8' }]))!;
  assert.equal((ok[0] as any).color, '#1d4ed8');
});
test('extra / hostile fields are not copied (prototype pollution, unknown props)', () => {
  const out = sanitizeNodes('[{"type":"char","value":"a","__proto__":{"polluted":1},"onclick":"x","evil":{"a":1}}]')!;
  assert.deepEqual(Object.keys(out[0]).sort(), ['id', 'type', 'value']);
  assert.equal(({} as any).polluted, undefined);
});
test('bad bracket kind is rejected', () => {
  assert.equal(sanitizeNodes('[{"type":"bracket","bracketKind":"<img>","content":[]}]'), null);
});
test('hostile HTML payload: parseClipboard falls back to literal text', () => {
  assert.ok(asText(parseClipboard({ html: htmlOf('[{"type":"script"}]'), text: 'hi' })));
});

console.log('COLOUR: default typed text is #1d4ed8, so every real message is coloured');
test('REGRESSION: \\color[hex]{...} (what serializeTree emits) deserializes', () => {
  const t = deserializeTree('\\color[#1d4ed8]{ab}');
  assert.equal(t.length, 2);
  assert.ok(t.every((n: any) => n.type === 'char' && n.color === '#1d4ed8'));
});
test('coloured text next to plain text keeps both', () => {
  assert.equal(deserializeTree('x\\color[#dc2626]{ab}y').length, 4);
});
test('nested coloured structures survive', () => {
  const t = deserializeTree('\\color[#dc2626]{\\frac{\\color[#dc2626]{1}}{\\color[#dc2626]{2}}}');
  assert.equal(t.length, 1);
  assert.equal(t[0].type, 'fraction');
  assert.equal((t[0] as any).numerator[0].value, '1');
});
test('legacy \\color{spec}{content} form still parses', () => {
  const t = deserializeTree('\\color{#dc2626}{ab}');
  assert.equal(t.length, 2);
  assert.equal((t[0] as any).color, '#dc2626');
});
test('draft undo/redo path (serializeTree -> deserializeTree) keeps coloured text', () => {
  const typed = (() => { let r: any = { tree: [], cursor: root(0) }; for (const c of 'x+1') r = insertChar(r.tree, r.cursor, c, '#1d4ed8'); return r.tree as MathNode[]; })();
  assert.ok(same(deserializeTree(serializeTree(typed)), typed));
});

console.log('EVERY KEYBOARD OPERATION, with the app default colour and without');
type R = { tree: MathNode[]; cursor: CursorPath };
const typeStr = (r: R, str: string, c?: string): R => { for (const ch of str) r = insertChar(r.tree, r.cursor, ch, c); return r; };
const start = (): R => ({ tree: [], cursor: root(0) });
const scenarios: Record<string, (c?: string) => R> = {
  chars:                    (c) => typeStr(start(), 'ab12+x', c),
  fraction:                 (c) => typeStr(ops.insertFraction([], root(0), c), '12', c),
  exponent:                 (c) => typeStr(ops.insertExponent(typeStr(start(), 'x', c).tree, root(1), c), '2', c),
  subscript:                (c) => typeStr(ops.insertSubscript(typeStr(start(), 'x', c).tree, root(1), c), 'n', c),
  sqrt:                     (c) => typeStr(ops.insertSqrt([], root(0), c), '9', c),
  nthroot:                  (c) => typeStr(ops.insertNthroot([], root(0), c), '8', c),
  longdiv:                  (c) => typeStr(ops.insertLongdiv([], root(0), c), '12', c),
  underbrace:               (c) => typeStr(ops.insertUnderbrace([], root(0), c), 'ab', c),
  'bracket round (open)':   (c) => typeStr(ops.insertBracket([], root(0), 'parentheses', c), 'x', c),
  'bracket square (open)':  (c) => typeStr(ops.insertBracket([], root(0), 'square', c), 'x', c),
  'bracket curly (open)':   (c) => typeStr(ops.insertBracket([], root(0), 'curly', c), 'x', c),
  'bracket absolute (open)':(c) => typeStr(ops.insertBracket([], root(0), 'absolute', c), 'x', c),
  'bracket round (closed)': (c) => { const r = typeStr(ops.insertBracket([], root(0), 'parentheses', c), 'x', c); return ops.closeAndExitBracket(r.tree, r.cursor, ')'); },
  integral:                 (c) => typeStr(ops.insertIntegral([], root(0), c), 'x', c),
  'integral with limits':   (c) => typeStr(ops.insertIntegralWithLimits([], root(0), c), 'x', c),
  'evaluation bar':         (c) => typeStr(ops.insertEvaluationBar([], root(0), c), 'x', c),
};
const APP_DEFAULT = '#1d4ed8';
for (const [name, build] of Object.entries(scenarios)) {
  for (const color of [APP_DEFAULT, undefined]) {
    const label = `${name}${color ? ' (coloured)' : ''}`;
    test(`${label}: copy -> paste is lossless`, () => {
      const tree = build(color).tree;
      assert.ok(tree.length > 0);
      const ids = getSelectedNodeIds(tree, root(0), root(tree.length));
      const copied = sliceTree(tree, ids);
      assert.ok(same(copied, tree), 'select-all slice must equal the original');
      const p = buildClipboardPayload(copied);
      const pasted = parseClipboard({ text: p.text, html: p.html });
      assert.ok(same(pasted, tree), 'pasted must equal the original (incl. open brackets, quotient, colours)');
      assert.equal(typeof mathNodesToPlainText(pasted), 'string');
    });
    test(`${label}: pasted tree is usable by the keyboard (type + backspace after it)`, () => {
      const tree = build(color).tree;
      const p = buildClipboardPayload(tree);
      const r = insertNodesAtCaret([], root(0), parseClipboard({ html: p.html }));
      const typed = insertChar(r.tree, r.cursor, 'Z', color);
      assert.equal(typed.tree.length, tree.length + 1);
      assert.ok(same(backspace(typed.tree, typed.cursor).tree, tree));
    });
  }
}
console.log('EVERY KEY ON THE REAL KEYBOARD (read from src/components/MathKeyboard.svelte)');
const kbSrc = readFileSync(new URL('../src/components/MathKeyboard.svelte', import.meta.url), 'utf8');
const jsValue = (raw: string) => new Function(`return '${raw}'`)() as string;
const keysInSource = [...new Set([...kbSrc.matchAll(/onPress\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => jsValue(m[1])))];
// keys that get their own branch in onPress(); each is exercised by the `scenarios` table above
const STRUCTURAL_KEYS = new Set([
  'fraction', 'longdiv', 'nthroot', 'underbrace', 'evaluation', 'evaluation_subsup', 'integration', 'integration_subsup',
  '()', '(', ')', '[', ']', '{', '}', ']subsup', '|□|', '□ⁿ', '□ₙ', 'e^', '10^', '√',
  'BACKSPACE', 'ENTER', 'LEFT', 'RIGHT', 'SHIFT', 'GREEK', 'ABC', 'Tab'
]);
const charKeys = keysInSource.filter((k) => !STRUCTURAL_KEYS.has(k));

test(`keyboard source parsed (${keysInSource.length} keys, ${charKeys.length} plain-character keys)`, () => {
  assert.ok(keysInSource.length > 80 && charKeys.length > 60);
});
test('GUARD: every key with its own onPress branch is a known, tested structural key', () => {
  // if this fails, someone added a new structural key: add a scenario for it above and list it in STRUCTURAL_KEYS
  const branches = [...new Set([...kbSrc.matchAll(/key === '((?:[^'\\]|\\.)*)'/g)].map((m) => jsValue(m[1])))];
  const unknown = branches.filter((k) => !STRUCTURAL_KEYS.has(k));
  assert.deepEqual(unknown, [], 'untested structural keys: ' + unknown.join(', '));
});
test('every plain-character key (letters, digits, Greek, sin/cos/log, d/dx, matrices...) copy -> paste is lossless', () => {
  for (const key of charKeys) for (const color of [APP_DEFAULT, undefined]) {
    const tree = insertChar([], root(0), key, color).tree;
    const p = buildClipboardPayload(tree);
    const pasted = parseClipboard({ text: p.text, html: p.html });
    assert.ok(same(pasted, tree), `key ${JSON.stringify(key)} not preserved`);
    assert.equal(p.text, key, `key ${JSON.stringify(key)} should paste as itself into other apps`);
  }
});

test('wire format (serializeTree) is lossless for every operation except two KNOWN limits', () => {
  // known: an OPEN bracket comes back closed; an empty longdiv quotient comes back absent.
  const norm = (v: any): any => Array.isArray(v) ? v.map(norm)
    : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v)
        .filter(([k, x]) => k !== 'id' && x !== undefined && !(k === 'quotient' && Array.isArray(x) && x.length === 0))
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([k, x]) => [k, k === 'closed' ? true : norm(x)])) : v;
  for (const [name, build] of Object.entries(scenarios)) for (const color of [APP_DEFAULT, undefined]) {
    const tree = build(color).tree;
    assert.equal(JSON.stringify(norm(deserializeTree(serializeTree(tree)))), JSON.stringify(norm(tree)), name + (color ? ' (coloured)' : ''));
  }
});

console.log('long-press word selection');
test('long-press inside a word selects the word', () => {
  const t = deserializeTree('x+12ab c');
  const w = expandToWord(t, root(4))!;
  assert.equal(ser(sliceTree(t, getSelectedNodeIds(t, w.anchor, w.focus))), '12ab');
});
test('long-press next to a fraction selects the fraction', () => {
  const t = deserializeTree('a \\frac{1}{2} b');
  const w = expandToWord(t, root(2))!;
  assert.equal(ser(sliceTree(t, getSelectedNodeIds(t, w.anchor, w.focus))), '\\frac{1}{2}');
});
test('long-press between two spaces selects nothing', () => {
  assert.equal(expandToWord(deserializeTree('a  b'), root(2)), null);
});

console.log(`\n${passed} passed${process.exitCode ? ', SOME FAILED' : ''}`);
