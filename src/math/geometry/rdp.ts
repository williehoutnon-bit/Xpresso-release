type Pt = { x: number; y: number };

/** Ramer-Douglas-Peucker path simplification. epsilon in canvas units. */
export function rdp(points: Pt[], epsilon: number): Pt[] {
if (points.length <= 2) return points;

let maxDist = 0; let maxIdx = 0;
const end = points.length - 1;

for (let i = 1; i < end; i++) {
const d = perpendicularDist(points[i], points[0], points[end]);
if (d > maxDist) { maxDist = d; maxIdx = i; }
}

if (maxDist <= epsilon) return [points[0], points[end]];

return [
...rdp(points.slice(0, maxIdx + 1), epsilon),
...rdp(points.slice(maxIdx), epsilon).slice(1),
];
}

function perpendicularDist(p: Pt, a: Pt, b: Pt): number {
const dx = b.x-a.x; const dy = b.y-a.y;
if (dx===0 && dy===0) return Math.hypot(p.x-a.x, p.y-a.y);
const t = ((p.x-a.x)*dx + (p.y-a.y)*dy) / (dx*dx + dy*dy);
return Math.hypot(p.x - (a.x+t*dx), p.y - (a.y+t*dy));
}
