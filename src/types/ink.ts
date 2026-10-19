import type { MathNode } from '../math/mathModel';

/**
 * 1.1 — StrokeElement
 * Stored representation of a finished, simplified, smoothed freehand stroke.
 * Stores both pixel-space coordinates (for perfect fidelity) and normalized coordinates (for backward compatibility).
 */
export interface StrokeElement {
  id: string; // uuid v4, generated client-side at stroke start
  path: string; // final smoothed SVG path 'd' string
  points: ([number, number] | { x: number; y: number } | any)[]; // simplified control points
  color: string; // hex, e.g. "#e63946"
  width: number; // stroke width in px
  opacity?: number; // 0-1, default 1
  boundingBox?: {
    x0: number; y0: number; // coordinates, top-left
    x1: number; y1: number; // coordinates, bottom-right
  };
  anchorElementIds?: string[]; // MathNode ids intersecting boundingBox at draw time
  createdAt?: number; // epoch ms
  createdBy?: string; // user id, for multi-user annotation threads
  // Container metadata for consistent rendering across different screen sizes
  containerWidth?: number; // Width of container when stroke was drawn (in pixels)
  containerHeight?: number; // Height of container when stroke was drawn (in pixels)
  containerAspectRatio?: number; // Aspect ratio of container (width/height)
  // Backward compatibility: normalized data
  pathNormalized?: string; // SVG path in 0-1 normalized space
  pointsNormalized?: ([number, number] | { x: number; y: number } | any)[]; // Points in 0-1 normalized space
  boundingBoxNormalized?: {
    x0: number; y0: number;
    x1: number; y1: number;
  };
  strokeWidth?: number;
  coordSpace?: string;
  /** Existing message bubble this stroke annotates; absent for new annotation-only messages. */
  targetMessageId?: string;
  /** Sub-container target: 'image' when anchored directly to an image, 'text' for text/wrap */
  targetContainer?: 'image' | 'text' | string;
  targetElement?: 'image' | 'text' | string;
}

/**
 * 1.2 — Message payload extension
 * Optional strokes array next to the existing math content tree.
 */
export interface MessagePayload {
  content: MathNode[]; // existing math tree — unchanged
  strokes?: StrokeElement[]; // NEW — optional, omitted entirely if empty
  id?: string;
  senderId?: string;
  timestamp?: number | string;
  [key: string]: any;
}

/**
 * 1.3 — Ephemeral capture types (not persisted)
 * These only exist in memory while the user is actively drawing. Discarded on commit.
 */
export interface RawPoint {
  x: number; // raw pixel or pointer coordinate, pre-normalization
  y: number;
  t: number; // ms since stroke start, for velocity-based width later if wanted
}

export interface DraftStroke {
  id: string;
  rawPoints: RawPoint[]; // grows every pointermove, discarded on commit
  color: string;
  width: number;
}
