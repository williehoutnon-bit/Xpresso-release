import { get } from 'svelte/store';
import type { MathOp } from './ops';

// To be replaced with actual store
const sceneStore: any = { subscribe: () => {}, set: () => {}, update: () => {} };
const previewStore: any = { subscribe: () => {}, set: () => {}, update: () => {} };

/** Apply a received op to the local in-memory scene graph. */
export function applyOp(op: MathOp) {
const scene = get(sceneStore) as any;
if (!scene) return;

switch (op.op) {
case 'ADD_ELEMENT':
scene.set(op.element.id, op.element);
break;

case 'UPDATE_ELEMENT': {
const el = scene.get(op.id);
if (el) scene.set(op.id, { ...el, ...op.patch, updatedAt: Date.now() });
break;
}

case 'DELETE_ELEMENT':
scene.delete(op.id);
break;

case 'MOVE_ELEMENT': {
const el = scene.get(op.id);
if (el && 'cx' in el) { // circle
  scene.set(op.id, { ...el, cx: el.cx+op.dx, cy: el.cy+op.dy });
}
break;
}

case 'PREVIEW_ANCHOR':
// update the live-preview store only — not the durable scene graph
previewStore.update((store: any) => {
    store[`${op.pathId}_${op.index}`] = { x: op.x, y: op.y };
    return store;
});
break;
}

sceneStore.set(new Map(scene)); // trigger Svelte reactivity
}

/** Decode the 14-byte binary PREVIEW_ANCHOR frame. */
export function decodeBinaryPreview(buf: ArrayBuffer): MathOp | null {
const view = new DataView(buf);
if (view.getUint8(0) !== 0x01) return null; // not a PREVIEW_ANCHOR

return {
op: 'PREVIEW_ANCHOR',
docId: '', // not encoded in the binary frame — inferred from channel topic
pathId: view.getUint32(1, false).toString(16),
index: view.getUint8(5),
x: view.getInt32(6, false) / 100,
y: view.getInt32(10, false) / 100,
};
}
