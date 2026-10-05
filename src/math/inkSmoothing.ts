/**
 * Pepachat Ink Layer: Smart Smoothing (Part 2 of Implementation Guide)
 * 2.1 Stage A: Live input stabilization (velocity-weighted EMA)
 * 2.2 Stage B: Resample -> Simplify -> Curve-fit on stroke end
 * 2.3 Render layer: Bezier reconstruction, never straight segments
 */

import { rdp } from './geometry/rdp';

export type Point = { x: number; y: number };

export type CubicBezierSegment = {
  p0: Point;
  cp1: Point;
  cp2: Point;
  p1: Point;
};

/**
 * 2.1 Stage A: Live input stabilization (velocity-weighted EMA)
 * Lags behind raw pointer input to absorb hand tremor without adding
 * perceptible lag for fast deliberate strokes.
 */
export class StrokeStabilizer {
  private smoothedX: number | null = null;
  private smoothedY: number | null = null;
  private lastT: number | null = null;
  private lastRawX: number | null = null;
  private lastRawY: number | null = null;

  // alphaMin: heavy smoothing at low speed. alphaMax: near-raw tracking at high speed.
  constructor(
    private alphaMin = 0.08,
    private alphaMax = 0.6,
    private velocityRef = 1.2 /* px/ms */
  ) {}

  addPoint(rawX: number, rawY: number, t: number): { x: number; y: number } {
    if (this.smoothedX === null) {
      // First point of the stroke: no lag, snap directly to start position
      this.smoothedX = rawX;
      this.smoothedY = rawY;
      this.lastT = t;
      this.lastRawX = rawX;
      this.lastRawY = rawY;
      return { x: rawX, y: rawY };
    }

    const dt = Math.max(1, t - (this.lastT ?? t));
    const dist = Math.hypot(rawX - (this.lastRawX ?? rawX), rawY - (this.lastRawY ?? rawY));
    const velocity = dist / dt;

    // Map velocity to alpha: faster movement -> higher alpha -> less lag
    const norm = Math.min(1, velocity / this.velocityRef);
    const alpha = this.alphaMin + (this.alphaMax - this.alphaMin) * norm;

    this.smoothedX += (rawX - this.smoothedX) * alpha;
    this.smoothedY += (rawY - this.smoothedY) * alpha;
    this.lastT = t;
    this.lastRawX = rawX;
    this.lastRawY = rawY;

    return { x: this.smoothedX, y: this.smoothedY };
  }

  reset() {
    this.smoothedX = null;
    this.smoothedY = null;
    this.lastT = null;
    this.lastRawX = null;
    this.lastRawY = null;
  }
}

/**
 * 2.2 Stage B: Step 1 — Resample at even arc-length spacing (fixes speed-dependent point clustering)
 */
export function resampleEvenSpacing(rawPoints: Point[], spacing = 4 /* px */): Point[] {
  if (!rawPoints || !Array.isArray(rawPoints) || rawPoints.length < 2) return rawPoints || [];
  const points: Point[] = rawPoints.map(p => {
    if (Array.isArray(p)) return { x: Number(p[0]) || 0, y: Number(p[1]) || 0 };
    return { x: Number(p?.x) || 0, y: Number(p?.y) || 0 };
  });

  const result: Point[] = [points[0]];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    let prev = points[i - 1];
    const curr = points[i];
    let segLen = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    while (carry + segLen >= spacing) {
      const remaining = spacing - carry;
      const t = remaining / segLen;
      const nx = prev.x + (curr.x - prev.x) * t;
      const ny = prev.y + (curr.y - prev.y) * t;
      result.push({ x: nx, y: ny });
      prev = { x: nx, y: ny };
      segLen = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      carry = 0;
    }
    carry += segLen;
  }
  result.push(points[points.length - 1]);
  return result;
}

/**
 * 2.2 Stage B: Step 3 — Fit a Catmull-Rom spline through simplified points and convert to cubic Bezier control points
 */
export function catmullRomToBezier(rawPoints: Point[]): CubicBezierSegment[] {
  const segments: CubicBezierSegment[] = [];
  if (!rawPoints || !Array.isArray(rawPoints) || rawPoints.length < 2) return segments;

  const points: Point[] = rawPoints.map(p => {
    if (Array.isArray(p)) return { x: Number(p[0]) || 0, y: Number(p[1]) || 0 };
    return { x: Number(p?.x) || 0, y: Number(p?.y) || 0 };
  });

  if (points.length === 2) {
    const p0 = points[0];
    const p1 = points[1];
    // Straight line segment as cubic Bezier
    const cp1 = { x: p0.x + (p1.x - p0.x) / 3, y: p0.y + (p1.y - p0.y) / 3 };
    const cp2 = { x: p0.x + (2 * (p1.x - p0.x)) / 3, y: p0.y + (2 * (p1.y - p0.y)) / 3 };
    return [{ p0, cp1, cp2, p1 }];
  }

  const pts = [points[0], ...points, points[points.length - 1]]; // pad ends
  for (let i = 0; i < pts.length - 3; i++) {
    const p0 = pts[i], p1 = pts[i + 1], p2 = pts[i + 2], p3 = pts[i + 3];
    // Standard Catmull-Rom -> cubic Bezier control point conversion
    const cp1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const cp2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    segments.push({ p0: p1, cp1, cp2, p1: p2 });
  }
  return segments;
}

/**
 * 2.3 Render layer: Bezier reconstruction for SVG path 'd' string
 * Reconstructs smooth curves using cubic Bezier ('C'), never straight ('L') lines.
 * Handles both CubicBezierSegment format ({ p0, cp1, cp2, p1 }) and database annotation segment format ({ c1, c2, end })
 */
export function bezierSegmentsToSvgPath(segments: (CubicBezierSegment | any)[]): string {
  if (!segments || !Array.isArray(segments) || segments.length === 0) return '';
  
  const getX = (p: any): number => {
    if (!p) return 0;
    if (Array.isArray(p)) return Number(p[0]) || 0;
    return Number(p.x) || 0;
  };
  const getY = (p: any): number => {
    if (!p) return 0;
    if (Array.isArray(p)) return Number(p[1]) || 0;
    return Number(p.y) || 0;
  };

  const first = segments[0];
  if (!first) return '';

  // Case 1: CubicBezierSegment format: { p0, cp1, cp2, p1 }
  if (first.p0 || first.cp1) {
    const startX = getX(first.p0);
    const startY = getY(first.p0);
    let d = `M${startX.toFixed(2)},${startY.toFixed(2)}`;
    for (const seg of segments) {
      if (!seg) continue;
      const cp1x = getX(seg.cp1);
      const cp1y = getY(seg.cp1);
      const cp2x = getX(seg.cp2);
      const cp2y = getY(seg.cp2);
      const p1x = getX(seg.p1);
      const p1y = getY(seg.p1);
      d += ` C${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p1x.toFixed(2)},${p1y.toFixed(2)}`;
    }
    return d;
  }

  // Case 2: Annotation stroke format: { c1, c2, end }
  if (first.c1 || first.end) {
    const startX = getX(first.start || first.c1);
    const startY = getY(first.start || first.c1);
    let d = `M ${startX.toFixed(2)} ${startY.toFixed(2)}`;
    for (const seg of segments) {
      if (!seg) continue;
      if (seg.c1 && seg.c2 && seg.end) {
        d += ` C ${getX(seg.c1).toFixed(2)} ${getY(seg.c1).toFixed(2)}, ${getX(seg.c2).toFixed(2)} ${getY(seg.c2).toFixed(2)}, ${getX(seg.end).toFixed(2)} ${getY(seg.end).toFixed(2)}`;
      } else if (seg.end) {
        d += ` L ${getX(seg.end).toFixed(2)} ${getY(seg.end).toFixed(2)}`;
      }
    }
    return d;
  }

  return '';
}

/**
 * Converts a sequence of points directly to a smooth Bezier SVG path 'd' string.
 * Used for live draft rendering and dynamic point-based rendering.
 * Supports both {x, y} objects and [x, y] coordinate tuples.
 */
export function pointsToBezierSvgPath(points: (Point | any)[]): string {
  if (!points || !Array.isArray(points) || points.length === 0) return '';
  
  const cleanPoints: Point[] = points.map(p => {
    if (!p) return { x: 0, y: 0 };
    if (Array.isArray(p)) return { x: Number(p[0]) || 0, y: Number(p[1]) || 0 };
    return { x: Number(p.x) || 0, y: Number(p.y) || 0 };
  });

  if (cleanPoints.length === 1) {
    return `M${cleanPoints[0].x.toFixed(2)},${cleanPoints[0].y.toFixed(2)} L${cleanPoints[0].x.toFixed(2)},${cleanPoints[0].y.toFixed(2)}`;
  }
  const segments = catmullRomToBezier(cleanPoints);
  return bezierSegmentsToSvgPath(segments);
}

/**
 * 2.3 Render layer: Canvas 2D Bezier renderer
 */
export function renderStroke(
  ctx: CanvasRenderingContext2D,
  segments: (CubicBezierSegment | any)[],
  color: string,
  width: number
) {
  if (!segments || !Array.isArray(segments) || segments.length === 0) return;
  const getX = (p: any): number => Array.isArray(p) ? Number(p[0]) || 0 : Number(p?.x) || 0;
  const getY = (p: any): number => Array.isArray(p) ? Number(p[1]) || 0 : Number(p?.y) || 0;

  const first = segments[0];
  if (!first) return;

  const startX = first.p0 ? getX(first.p0) : (first.start ? getX(first.start) : getX(first.c1));
  const startY = first.p0 ? getY(first.p0) : (first.start ? getY(first.start) : getY(first.c1));

  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  for (const seg of segments) {
    if (!seg) continue;
    if (seg.cp1 && seg.cp2 && seg.p1) {
      ctx.bezierCurveTo(getX(seg.cp1), getY(seg.cp1), getX(seg.cp2), getY(seg.cp2), getX(seg.p1), getY(seg.p1));
    } else if (seg.c1 && seg.c2 && seg.end) {
      ctx.bezierCurveTo(getX(seg.c1), getY(seg.c1), getX(seg.c2), getY(seg.c2), getX(seg.end), getY(seg.end));
    } else if (seg.end) {
      ctx.lineTo(getX(seg.end), getY(seg.end));
    } else if (seg.p1) {
      ctx.lineTo(getX(seg.p1), getY(seg.p1));
    }
  }
  ctx.stroke();
}

/**
 * Full Stage B pipeline on stroke end:
 * Resample (spacing = 4px) -> RDP (epsilon = 1.2px) -> Catmull-Rom to Cubic Bezier
 */
export function processStrokeEnd(
  points: Point[],
  spacing = 4 /* px */,
  epsilon = 1.2 /* px */
): {
  simplifiedPoints: Point[];
  segments: CubicBezierSegment[];
  rawCount: number;
  resampledCount: number;
  rdpCount: number;
  bezierSegmentCount: number;
} {
  const rawCount = points.length;
  if (rawCount < 2) {
    return {
      simplifiedPoints: points,
      segments: [],
      rawCount,
      resampledCount: rawCount,
      rdpCount: rawCount,
      bezierSegmentCount: 0
    };
  }

  // 1. Resample at even arc-length spacing
  const resampled = resampleEvenSpacing(points, spacing);
  const resampledCount = resampled.length;

  // 2. Run RDP simplification
  const simplified = rdp(resampled, epsilon);
  const rdpCount = simplified.length;

  // 3. Fit Catmull-Rom spline and convert to cubic Bezier
  const segments = catmullRomToBezier(simplified);
  const bezierSegmentCount = segments.length;

  // [DIAG] Verification log required by 2.2
  console.log('[DIAG-smoothing] Stroke end processed', {
    rawCount,
    resampledCount,
    rdpCount,
    bezierSegmentCount
  });

  return {
    simplifiedPoints: simplified,
    segments,
    rawCount,
    resampledCount,
    rdpCount,
    bezierSegmentCount
  };
}
