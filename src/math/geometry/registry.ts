import type { MathElement } from '../types/elements';
import type { GeometryProvider } from './contract';
import { circleGeometry } from './shapes/circleGeometry';
// import { pathGeometry } from './shapes/pathGeometry'; // added in line tool phase

export function getGeometry(el: MathElement): GeometryProvider | null {
switch (el.kind) {
case 'circle': return circleGeometry(el);
// case 'path': return pathGeometry(el);
default: return null; // freehand, text etc. not geometry-queryable
}
}
