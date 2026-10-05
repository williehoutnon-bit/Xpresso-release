// This file runs in a Web Worker — no DOM, no Svelte, no canvas access.
import { pack, unpack } from 'msgpackr';

self.onmessage = (e: MessageEvent) => {
const { type, payload } = e.data;

switch (type) {
case 'PACK': {
const buffer = pack(payload);
// Transfer ownership of the buffer — zero copy
// @ts-ignore
self.postMessage({ type: 'PACKED', buffer }, [buffer.buffer || buffer]);
break;
}

case 'UNPACK': {
const doc = unpack(new Uint8Array(payload));
self.postMessage({ type: 'UNPACKED', doc });
break;
}
}
};
