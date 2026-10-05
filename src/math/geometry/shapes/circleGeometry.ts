import type { GeometryProvider, BoundaryPoint } from '../contract';
import type { CircleElement } from '../../types/elements';

export function circleGeometry(el: CircleElement): GeometryProvider {
return {
boundary(t: number): BoundaryPoint {
const angle = t * 2 * Math.PI;
const cos = Math.cos(angle);
const sin = Math.sin(angle);
return {
x: el.cx + (el.radius * cos),
y: el.cy + (el.radius * sin),
t,
normalX: cos, // outward normal for a circle = unit vector from centre
normalY: sin,
};
},

closestPoint(px: number, py: number) {
const dx = px - el.cx;
const dy = py - el.cy;
let angle = Math.atan2(dy, dx);
let t = ((angle / (2 * Math.PI)) + 1) % 1; // normalise to [0,1]
const bp = this.boundary(t);
const dist = Math.hypot(px - bp.x, py - bp.y);
return { ...bp, distance: dist };
},

boundingBox() {
return {
x: el.cx - el.radius, y: el.cy - el.radius,
w: el.radius * 2, h: el.radius * 2,
};
},

};
}
