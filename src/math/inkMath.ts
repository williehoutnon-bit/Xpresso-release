import type { MathNode } from './mathModel';
import type { RawPoint, DraftStroke, StrokeElement, MessagePayload } from '../types/ink';
export * from './inkSmoothing';
export * from '../utils/inkColor';

/**
 * STEP 3 — Simplification (Ramer–Douglas–Peucker)
 * Reduces a dense list of pointer coordinates in contentBox pixel space
 * to a small set of control points using the error tolerance (epsilon).
 */
export function simplifyRDP(points: RawPoint[], epsilon = 1.5): RawPoint[] {
  if (points.length < 3) return points;
  let maxDist = 0;
  let index = 0;
  const [first, last] = [points[0], points[points.length - 1]];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], first, last);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyRDP(points.slice(0, index + 1), epsilon);
    const right = simplifyRDP(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }

  return [first, last];
}

/**
 * Computes shortest perpendicular distance from point p to segment ab.
 */
export function perpendicularDistance(p: RawPoint, a: RawPoint, b: RawPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

/**
 * 3 decimal places keeps path strings short.
 * In 0-1 normalized space, more precision than that is invisible on screen
 * but bloats the stored string for no benefit.
 */
export function fmt(n: number): string {
  return Math.round(n * 1000) / 1000 + "";
}

/**
 * STEP 4 — Smoothing (Catmull-Rom → Cubic Bézier)
 * Fits a Catmull-Rom spline through points and converts it to cubic Bézier segments
 * with tension = 6. Outputs an SVG path 'd' string.
 */
export function catmullRomToBezierPath(pts: RawPoint[]): string {
  if (pts.length < 2) return "";
  if (pts.length === 2) {
    return `M ${fmt(pts[0].x)} ${fmt(pts[0].y)} L ${fmt(pts[1].x)} ${fmt(pts[1].y)}`;
  }

  let d = `M ${fmt(pts[0].x)} ${fmt(pts[0].y)} `;
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(n - 1, i + 2)];

    // Catmull-Rom -> Bezier control points (tension = 6 is the standard conversion factor)
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += `C ${fmt(cp1x)} ${fmt(cp1y)}, ${fmt(cp2x)} ${fmt(cp2y)}, ${fmt(p2.x)} ${fmt(p2.y)} `;
  }

  return d.trim();
}

/**
 * STEP 5 — Normalization to 0-1 Content-Box Space
 * Converts points into 0-1 fractions of content bounding box.
 */
export function normalizePoints(
  points: RawPoint[],
  contentBox: DOMRect | { width: number; height: number; [key: string]: any }
): [number, number][] {
  const w = Math.max(contentBox.width, 1);
  const h = Math.max(contentBox.height, 1);
  return points.map(p => [
    p.x / w,
    p.y / h,
  ]);
}

/**
 * Computes bounding box in 0-1 fractions or pixel coordinates.
 */
export function computeBoundingBox(points: any[]): {
  x0: number; y0: number; x1: number; y1: number;
} {
  if (!points || !Array.isArray(points) || points.length === 0) {
    return { x0: 0, y0: 0, x1: 0, y1: 0 };
  }
  const xs = points.map(p => {
    if (Array.isArray(p)) return Number(p[0]) || 0;
    if (p && typeof p === 'object') return Number(p.x) || 0;
    return 0;
  });
  const ys = points.map(p => {
    if (Array.isArray(p)) return Number(p[1]) || 0;
    if (p && typeof p === 'object') return Number(p.y) || 0;
    return 0;
  });
  return {
    x0: Math.min(...xs),
    y0: Math.min(...ys),
    x1: Math.max(...xs),
    y1: Math.max(...ys),
  };
}

/**
 * Checks if two bounding boxes in 0-1 space intersect.
 */
export function rectsIntersect(
  r1: { x0: number; y0: number; x1: number; y1: number },
  r2: { x0: number; y0: number; x1: number; y1: number }
): boolean {
  return !(r2.x0 > r1.x1 || r2.x1 < r1.x0 || r2.y0 > r1.y1 || r2.y1 < r1.y0);
}

/**
 * STEP 6 — Anchor Capture (Reflow Fallback)
 * Queries the rendered MathNode DOM elements whose rects intersect bbox.
 */
export function findAnchors(
  bbox: { x0: number; y0: number; x1: number; y1: number },
  contentTree: MathNode[],
  containerEl?: HTMLElement | null
): string[] {
  if (containerEl && typeof containerEl.querySelectorAll === 'function') {
    const containerRect = containerEl.getBoundingClientRect();
    const cWidth = Math.max(containerRect.width, 1);
    const cHeight = Math.max(containerRect.height, 1);
    const elements = containerEl.querySelectorAll('[data-node-id]');
    const matchingNodeIds = new Set<string>();

    elements.forEach(el => {
      const rect = el.getBoundingClientRect();
      const elBbox = {
        x0: (rect.left - containerRect.left) / cWidth,
        y0: (rect.top - containerRect.top) / cHeight,
        x1: (rect.right - containerRect.left) / cWidth,
        y1: (rect.bottom - containerRect.top) / cHeight,
      };
      if (rectsIntersect(elBbox, bbox)) {
        const nodeId = el.getAttribute('data-node-id');
        if (nodeId) matchingNodeIds.add(nodeId);
      }
    });

    if (matchingNodeIds.size > 0) {
      return Array.from(matchingNodeIds);
    }
  }

  // Fallback: collect all top-level node IDs from tree if none found
  if (contentTree && contentTree.length > 0) {
    return contentTree.slice(0, 3).map(n => n.id);
  }
  return [];
}

/**
 * Builds the path directly from normalized points so it is already stored in 0-1 space.
 * Also stores pixel-space coordinates and container dimensions for consistent rendering
 * across different screen sizes.
 */
export function commitStroke(
  draft: DraftStroke,
  contentBox: DOMRect | { width: number; height: number; left?: number; top?: number },
  contentTree: MathNode[] = [],
  containerEl?: HTMLElement | null
): StrokeElement {
  const simplified = simplifyRDP(draft.rawPoints, 1.5); // pixel space
  const normalized = normalizePoints(simplified, contentBox); // 0-1 space
  const normalizedAsRaw = normalized.map(p => {
    const x = Array.isArray(p) ? p[0] : (p?.x ?? 0);
    const y = Array.isArray(p) ? p[1] : (p?.y ?? 0);
    return { x, y, t: 0 };
  });
  const pathNormalized = catmullRomToBezierPath(normalizedAsRaw); // 0-1 space path
  
  // Also create path in pixel space for perfect fidelity
  const simplifiedAsRaw = simplified.map(p => ({ x: p.x, y: p.y, t: p.t || 0 }));
  const pathPixels = catmullRomToBezierPath(simplifiedAsRaw); // pixel space path
  
  const bboxNormalized = computeBoundingBox(normalized);
  const bboxPixels = computeBoundingBox(simplified.map(p => [p.x, p.y]));
  
  const boxWidth = Math.max(contentBox.width, 1);
  const boxHeight = Math.max(contentBox.height, 1);

  const strokeId = draft.id || (typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : 'stroke_' + Math.random().toString(36).substring(2, 10));

  // Store container dimensions for proper scaling on different screens
  const containerWidth = contentBox.width;
  const containerHeight = contentBox.height;
  const containerAspectRatio = containerWidth / containerHeight;

  return {
    id: strokeId,
    path: pathPixels, // Store pixel-space path for perfect fidelity
    points: simplified.map(p => [p.x, p.y]), // Store pixel coordinates
    color: draft.color || '#e63946',
    width: draft.width || 2.5,
    opacity: 1,
    boundingBox: bboxPixels,
    anchorElementIds: findAnchors(bboxNormalized, contentTree, containerEl),
    createdAt: Date.now(),
    // Container metadata for cross-device consistency
    containerWidth,
    containerHeight,
    containerAspectRatio,
    // Keep normalized data for backward compatibility
    pathNormalized: pathNormalized,
    pointsNormalized: normalized,
    boundingBoxNormalized: bboxNormalized,
  } as StrokeElement;
}

/**
 * STEP 8 — Attaching Strokes to the Message
 * Omits strokes key entirely when empty.
 */
export function buildMessagePayload(
  content: MathNode[],
  strokes: StrokeElement[] = []
): MessagePayload {
  return {
    content,
    ...(strokes.length > 0 ? { strokes } : {}),
  };
}

/**
 * Erase a stroke by ID from an array of StrokeElements
 */
export function eraseStrokeById(strokes: StrokeElement[], strokeId: string): StrokeElement[] {
  return strokes.filter(s => s.id !== strokeId);
}

/**
 * Convert a Supabase annotation_strokes item into an SVG path 'd' string
 */
export function annotationStrokeToSvgPath(stroke: any): string {
  if (!stroke) return '';
  if (stroke.path && typeof stroke.path === 'string' && stroke.path.trim().length > 0) return stroke.path;
  if (stroke.pathNormalized && typeof stroke.pathNormalized === 'string' && stroke.pathNormalized.trim().length > 0) return stroke.pathNormalized;

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

  if (stroke.segments && Array.isArray(stroke.segments) && stroke.segments.length > 0) {
    const firstSeg = stroke.segments[0];
    const startX = stroke.start ? getX(stroke.start) : (firstSeg?.p0 ? getX(firstSeg.p0) : getX(firstSeg?.c1));
    const startY = stroke.start ? getY(stroke.start) : (firstSeg?.p0 ? getY(firstSeg.p0) : getY(firstSeg?.c1));
    let d = `M ${startX.toFixed(2)} ${startY.toFixed(2)}`;
    for (const seg of stroke.segments) {
      if (!seg) continue;
      if (seg.c1 && seg.c2 && seg.end) {
        d += ` C ${getX(seg.c1).toFixed(2)} ${getY(seg.c1).toFixed(2)}, ${getX(seg.c2).toFixed(2)} ${getY(seg.c2).toFixed(2)}, ${getX(seg.end).toFixed(2)} ${getY(seg.end).toFixed(2)}`;
      } else if (seg.cp1 && seg.cp2 && seg.p1) {
        d += ` C ${getX(seg.cp1).toFixed(2)} ${getY(seg.cp1).toFixed(2)}, ${getX(seg.cp2).toFixed(2)} ${getY(seg.cp2).toFixed(2)}, ${getX(seg.p1).toFixed(2)} ${getY(seg.p1).toFixed(2)}`;
      } else if (seg.end) {
        d += ` L ${getX(seg.end).toFixed(2)} ${getY(seg.end).toFixed(2)}`;
      } else if (seg.p1) {
        d += ` L ${getX(seg.p1).toFixed(2)} ${getY(seg.p1).toFixed(2)}`;
      }
    }
    return d;
  }

  if (stroke.points && Array.isArray(stroke.points) && stroke.points.length > 0) {
    return pointsToBezierSvgPath(stroke.points);
  }

  return '';
}

/**
 * Convert local StrokeElement array into the remote database (Supabase) annotation_strokes schema
 */
export function convertStrokesToAnnotationStrokes(strokes: (StrokeElement | any)[]): any[] {
  if (!strokes || !Array.isArray(strokes) || strokes.length === 0) return [];
  return strokes.map(s => {
    if (!s) return null;
    const rawPts = s.points || s.pointsNormalized || s.rawPoints;
    const pts: { x: number; y: number }[] = [];
    if (Array.isArray(rawPts)) {
      for (const p of rawPts) {
        if (!p) continue;
        if (Array.isArray(p)) {
          pts.push({ x: Number(p[0]) || 0, y: Number(p[1]) || 0 });
        } else if (typeof p === 'object') {
          pts.push({ x: Number(p.x) || 0, y: Number(p.y) || 0 });
        }
      }
    }

    const strokeColor = s.color || '#dc2626';
    const strokeWidth = s.width || s.strokeWidth || 2.5;
    const opacity = s.opacity !== undefined ? s.opacity : 1;
    const bbox = s.boundingBox || s.boundingBoxNormalized || { x0: 0, y0: 0, x1: 0, y1: 0 };
    const startX = s.start?.x ?? bbox.x0 ?? (pts.length > 0 ? pts[0].x : 0);
    const startY = s.start?.y ?? bbox.y0 ?? (pts.length > 0 ? pts[0].y : 0);

    if (pts.length === 0) {
      return {
        color: strokeColor,
        frame: 'message',
        start: { x: startX, y: startY },
        width: strokeWidth,
        opacity,
        segments: Array.isArray(s.segments) ? s.segments : [],
        anchorElementId: s.anchorElementIds?.[0] || null,
        path: s.path || s.pathNormalized || '',
        containerWidth: s.containerWidth,
        containerHeight: s.containerHeight,
        containerAspectRatio: s.containerAspectRatio
      };
    }

    const segments: any[] = [];
    const n = pts.length;
    if (n === 1) {
      segments.push({
        c1: { x: pts[0].x, y: pts[0].y },
        c2: { x: pts[0].x, y: pts[0].y },
        end: { p: 0, x: pts[0].x, y: pts[0].y }
      });
    } else if (n === 2) {
      segments.push({
        c1: { x: pts[0].x, y: pts[0].y },
        c2: { x: pts[1].x, y: pts[1].y },
        end: { p: 0, x: pts[1].x, y: pts[1].y }
      });
    } else {
      for (let i = 0; i < n - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(n - 1, i + 2)];

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        segments.push({
          c1: { x: cp1x, y: cp1y },
          c2: { x: cp2x, y: cp2y },
          end: { p: 0, x: p2.x, y: p2.y }
        });
      }
    }

    let resolvedPath = s.path;
    if (!resolvedPath) {
      resolvedPath = `M ${pts[0].x} ${pts[0].y}`;
      for (const seg of segments) {
        if (seg.c1 && seg.c2 && seg.end) {
          resolvedPath += ` C ${seg.c1.x} ${seg.c1.y}, ${seg.c2.x} ${seg.c2.y}, ${seg.end.x} ${seg.end.y}`;
        } else if (seg.end) {
          resolvedPath += ` L ${seg.end.x} ${seg.end.y}`;
        }
      }
    }

    return {
      color: strokeColor,
      frame: 'message',
      start: { x: pts[0].x, y: pts[0].y },
      width: strokeWidth,
      opacity,
      segments,
      anchorElementId: s.anchorElementIds?.[0] || null,
      path: resolvedPath,
      containerWidth: s.containerWidth,
      containerHeight: s.containerHeight,
      containerAspectRatio: s.containerAspectRatio
    };
  }).filter(Boolean);
}

/**
 * Re-colors or re-sizes a committed stroke without modifying geometry
 */
export function updateStrokeStyle(
  stroke: StrokeElement,
  changes: { color?: string; width?: number; opacity?: number }
): StrokeElement {
  return {
    ...stroke,
    ...(changes.color !== undefined ? { color: changes.color } : {}),
    ...(changes.width !== undefined ? { width: changes.width } : {}),
    ...(changes.opacity !== undefined ? { opacity: changes.opacity } : {}),
  };
}
