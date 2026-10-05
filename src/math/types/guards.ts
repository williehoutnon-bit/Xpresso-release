import type { MathElement } from './elements';

const VALID_KINDS = new Set(['freehand','path','circle','text','equation','graph','image']);

export function assertElement(el: unknown): asserts el is MathElement {
if (!el || typeof el !== 'object') throw new Error('Element must be an object');
const e = el as any;
if (!VALID_KINDS.has(e.kind)) throw new Error(`Unknown element kind: ${e.kind}`);
if (typeof e.id !== 'string' || e.id.length < 4)
throw new Error('Element missing valid id');
}
