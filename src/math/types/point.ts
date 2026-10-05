// ── Free point: a fixed canvas coordinate ──────────────────────────
export interface FreePoint {
kind: 'free';
x: number; // canvas units (NOT pixels — divide by devicePixelRatio)
y: number;
}

// ── Constrained point: lives on another element's boundary ──────────
export interface ConstrainedPoint {
kind: 'constrained';
onElementId: string; // id of the target element
t: number; // boundary parameter [0,1]
// circle: t=0 → rightmost point, t increases CCW
// path: t=0 → first anchor, t=1 → last
snapKind: SnapKind; // what kind of snap produced this constraint
}

export type PointRef = FreePoint | ConstrainedPoint;

export type SnapKind =
| 'boundary' // snapped to edge/perimeter of shape
| 'center' // snapped to centroid
| 'vertex' // snapped to a corner/anchor of a path
| 'midpoint' // snapped to midpoint of a segment
| 'grid'; // snapped to canvas grid (free point, recorded for UX)
