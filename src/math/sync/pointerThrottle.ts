type Point = { x: number; y: number };

export class PointerThrottle {
private pending: Point | null = null;
private rafHandle: number | null = null;
private onFlush: (p: Point) => void;

constructor(onFlush: (p: Point) => void) {
this.onFlush = onFlush;
}

push(p: Point) {
this.pending = p; // overwrite — only the latest position matters
if (this.rafHandle === null) {
this.rafHandle = requestAnimationFrame(() => this.flush());
}
}

private flush() {
this.rafHandle = null;
if (this.pending) { this.onFlush(this.pending); this.pending = null; }
}

destroy() {
if (this.rafHandle !== null) cancelAnimationFrame(this.rafHandle);
}
}
