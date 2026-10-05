import type { MathElement } from '../types/elements';
import { getGeometry } from './registry';

const CELL = 100; // canvas units per grid cell

export class SpatialIndex {
private grid = new Map<string, Set<string>>(); // cellKey → Set<id>
private elements: Map<string, MathElement>;

constructor(elements: Map<string, MathElement>) {
this.elements = elements;
for (const el of elements.values()) this.insert(el);
}

insert(el: MathElement) {
for (const key of this.cellKeys(el)) {
if (!this.grid.has(key)) this.grid.set(key, new Set());
this.grid.get(key)!.add(el.id);
}
}

remove(el: MathElement) {
for (const key of this.cellKeys(el)) this.grid.get(key)?.delete(el.id);
}

/**
* Find all elements whose bounding box overlaps the query region.
* px,py: canvas coordinates. radius: snap threshold in canvas units.
*/
query(px: number, py: number, radius: number): MathElement[] {
const x0 = Math.floor((px - radius) / CELL);
const x1 = Math.floor((px + radius) / CELL);
const y0 = Math.floor((py - radius) / CELL);
const y1 = Math.floor((py + radius) / CELL);

const seen = new Set<string>();
const result: MathElement[] = [];

for (let cx = x0; cx <= x1; cx++) {
for (let cy = y0; cy <= y1; cy++) {
const ids = this.grid.get(`${cx},${cy}`);
if (!ids) continue;

for (const id of ids) {
if (!seen.has(id)) {
seen.add(id);
const element = this.elements.get(id);
if (element) {
result.push(element);
}
}
}
}
}
return result;
}

private cellKeys(el: MathElement): string[] {
const geo = getGeometry(el);
if (!geo) return [];

const { x, y, w, h } = geo.boundingBox();
const x0 = Math.floor(x / CELL); const x1 = Math.floor((x+w) / CELL);
const y0 = Math.floor(y / CELL); const y1 = Math.floor((y+h) / CELL);
const keys: string[] = [];

for (let cx = x0; cx <= x1; cx++) {
for (let cy = y0; cy <= y1; cy++) {
keys.push(`${cx},${cy}`);
}
}
return keys;
}
}
