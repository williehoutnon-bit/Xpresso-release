import { pack } from 'msgpackr';
import { supabase } from '../../services/supabaseService';
import type { MathOp } from './ops';

const FLUSH_INTERVAL_MS = 800; // batch window — tune per network conditions
const MAX_QUEUE_SIZE = 50; // force-flush if backlog grows

let queue: MathOp[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/**
* Enqueue an operation.
* Ephemeral ops (PREVIEW_ANCHOR) are broadcast immediately — never queued.
*/
export function enqueueOp(op: MathOp, channel: any) {
if (op.op === 'PREVIEW_ANCHOR') {
// Binary broadcast — do not queue, do not persist.
broadcastBinary(op, channel);
return;
}

queue.push(op);
if (queue.length >= MAX_QUEUE_SIZE) { flushQueue(); return; }
if (!flushTimer) flushTimer = setTimeout(flushQueue, FLUSH_INTERVAL_MS);
}

async function flushQueue() {
flushTimer = null;
if (queue.length === 0) return;

const batch = queue.splice(0, queue.length);

// Apply batch to local RxDB (scene graph authority)
await applyOpsToLocal(batch);

// Persist: upload updated MsgPack blob (existing mathStorage.ts)
// await uploadMathDocument(getLocalDocument(batch[0].docId));
}

// Simple hash for binary encode
function hashId(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit int
    }
    return hash;
}

/** Binary-encode a PREVIEW_ANCHOR op using a compact fixed layout. */
function broadcastBinary(
op: Extract<MathOp, { op: 'PREVIEW_ANCHOR' }>,
channel: any
) {
// Layout: [1B type][4B pathId hash][1B anchorIndex][4B x as Int32][4B y as Int32]
const buf = new ArrayBuffer(14);
const view = new DataView(buf);

view.setUint8(0, 0x01); // type = PREVIEW_ANCHOR
view.setUint32(1, hashId(op.pathId), false); // path identifier
view.setUint8(5, op.index); // anchor index
view.setInt32(6, Math.round(op.x * 100), false); // x * 100 → Int32
view.setInt32(10, Math.round(op.y * 100), false); // y * 100 → Int32

// supabase-js >= 2.91.0 accepts ArrayBuffer directly
channel.send({ type: 'broadcast', event: 'preview', payload: buf });
}

async function applyOpsToLocal(batch: MathOp[]) {
    // To be implemented using actual data stores.
}
