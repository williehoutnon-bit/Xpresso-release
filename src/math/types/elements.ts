// ── Base shared by every element kind ──────────────────────────────
export interface BaseElement {
id: string; // nanoid(10) — stable within this document
kind: ElementKind; // discriminant field
zIndex: number; // render order
locked: boolean; // chalk-lock: true = this user owns it
createdAt: number; // Date.now() — ms since epoch
updatedAt: number;
}

export type ElementKind =
| 'freehand' // existing ink strokes — no change to structure
| 'path' // NEW: line tool, curve tool, pen tool output
| 'circle' // NEW: circle primitive
| 'text' // existing text element — migrate id only
| 'equation' // existing equation block — migrate id only
| 'graph' // future: graph/chart element
| 'image'; // future: embedded image

// ── Freehand (ink) — existing structure preserved, id added ─────────
export interface FreehandElement extends BaseElement {
kind: 'freehand';
points: Array<{ x: number; y: number; pressure?: number }>;
color: string;
width: number;
}

// ── Handle type for Bezier anchors ─────────────────────────────────
export type HandleKind = 'corner' | 'smooth' | 'asymmetric';

export interface PathAnchor {
point: import('./point').PointRef; // where this anchor sits
handleIn?: { dx: number; dy: number }; // incoming Bezier handle (offset)
handleOut?: { dx: number; dy: number }; // outgoing Bezier handle (offset)
handleKind: HandleKind;
}

export interface PathElement extends BaseElement {
kind: 'path';
anchors: PathAnchor[]; // ordered list — minimum 2 for a visible segment
closed: boolean; // true = last anchor connects back to first
stroke: string;
strokeWidth: number;
fill: string | null; // only meaningful when closed = true
}

// Add PathElement to the union:
export type MathElement = FreehandElement | CircleElement | PathElement;
export interface CircleElement extends BaseElement {
kind: 'circle';
cx: number; // centre x in canvas units
cy: number; // centre y in canvas units
radius: number;
stroke: string;
fill: string | null;
strokeWidth: number;
}
