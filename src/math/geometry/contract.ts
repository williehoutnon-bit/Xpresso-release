export interface BoundaryPoint {
x: number; y: number;
t: number; // the parameter that produced this point
normalX: number; // outward unit normal — used for tangent lines
normalY: number;
}

/**
* Every geometry-capable element kind implements this contract.
* The kernel calls these functions — not element-specific code.
*/
export interface GeometryProvider {
/** Evaluate the boundary at parameter t ∈ [0,1]. */
boundary(t: number): BoundaryPoint;

/** Find the nearest boundary point to canvas coordinate (px, py). */
closestPoint(px: number, py: number): BoundaryPoint & { distance: number };

/** Axis-aligned bounding box — used by the spatial index. */
boundingBox(): { x: number; y: number; w: number; h: number };
}
