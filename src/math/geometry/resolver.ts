import type { PointRef, FreePoint } from '../types/point';
import type { MathElement, CircleElement } from '../types/elements';

export interface ResolvedPoint { x: number; y: number }

/**
* Convert any PointRef → canvas coordinate.
* sceneMap: Map — the live scene graph.
*/
export function resolvePoint(
ref: PointRef,
sceneMap: Map<string, MathElement>
): ResolvedPoint {
if (ref.kind === 'free') return { x: ref.x, y: ref.y };

const target = sceneMap.get(ref.onElementId);
if (!target) {
// Target deleted — fall back to last known position.
// Caller should clean up dangling references separately.
return { x: 0, y: 0 };
}

return boundaryPoint(target, ref.t);
}

/** Evaluate the boundary of an element at parameter t ∈ [0,1]. */
function boundaryPoint(el: MathElement, t: number): ResolvedPoint {
switch (el.kind) {
case 'circle': {
const angle = t * 2 * Math.PI; // t=0 → right, increases CCW
return {
x: el.cx + (el.radius * Math.cos(angle)),
y: el.cy + (el.radius * Math.sin(angle)),
};
}
// Add 'path' case in Phase 5 (geometry kernel).
default:
return { x: 0, y: 0 };
}
}
