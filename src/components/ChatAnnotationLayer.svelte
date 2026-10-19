<script lang="ts">
  import type { StrokeElement } from '../types/ink';
  import {
    StrokeStabilizer,
    processStrokeEnd,
    pointsToBezierSvgPath,
    bezierSegmentsToSvgPath
  } from '../math/inkMath';

  export let isActive: boolean = false;
  export let isEraser: boolean = false;
  export let activeColor: string = '#1d4ed8';
  export let strokeWidth: number = 2.5;
  export let containerEl: HTMLElement | null = null;
  export let onStrokeCommitted: ((targetId: string, stroke: StrokeElement) => void) | null = null;
  export let onErase: ((clientX: number, clientY: number) => void) | null = null;
  export let onCanvasTransform: ((scale: number, panX: number, panY: number, isPinching: boolean) => void) | null = null;
  export let zoomScale: number = 1.0;

  const DRAFT_TARGET = '__draft__';

  let svgEl: SVGSVGElement | null = null;
  let drawing = false;
  let livePath = '';
  let liveClientPoints: { x: number; y: number }[] = [];
  let activeTarget: { id: string; isDraft: boolean; targetContainer?: 'image' | 'text'; targetRect: DOMRect; targetEl?: HTMLElement } | null = null;

  // Track all active pointers for simultaneous multi-touch detection
  const activePointers = new Map<number, { clientX: number; clientY: number }>();
  let pinchStartDistance = 0;
  let pinchStartScale = 1.0;
  let pinchStartPanX = 0;
  let pinchStartPanY = 0;
  let pinchStartMidpoint = { x: 0, y: 0 };
  let currentScale = 1.0;
  let currentPanX = 0;
  let currentPanY = 0;
  let isPinching = false;

  // Responsive stabilizer (0.85 alphaMin) eliminates initial lag/resistance at stroke start
  const stabilizer = new StrokeStabilizer(0.85, 0.98, 0.5);

  $: if (!isActive) {
    drawing = false;
    liveClientPoints = [];
    livePath = '';
    activeTarget = null;
    activePointers.clear();
    isPinching = false;
    currentScale = 1.0;
    currentPanX = 0;
    currentPanY = 0;
    onCanvasTransform?.(1.0, 0, 0, false);
  }

  function clientToSvg(clientX: number, clientY: number): { x: number; y: number } {
    const r = svgEl?.getBoundingClientRect();
    return {
      x: clientX - (r?.left ?? 0),
      y: clientY - (r?.top ?? 0)
    };
  }

  function resolveTarget(clientX: number, clientY: number): { id: string; isDraft: boolean; targetContainer?: 'image' | 'text'; targetRect: DOMRect; targetEl?: HTMLElement } {
    // 1. Raycast direct elements from point
    if (typeof document !== 'undefined' && typeof document.elementsFromPoint === 'function') {
      const elements = document.elementsFromPoint(clientX, clientY);
      for (const el of elements) {
        if (el === svgEl || (svgEl && svgEl.contains(el))) continue;

        // Check if cursor is directly on or inside an image container or img element
        const imgContainer = el.closest<HTMLElement>('[data-image-container], .group\\/img, [data-media-container]');
        if (imgContainer) {
          const isDraftContainer = imgContainer.getAttribute('data-image-container') === 'draft';
          const draftParent = imgContainer.closest<HTMLElement>('[data-draft-id]');
          if (draftParent || isDraftContainer) {
            return { id: DRAFT_TARGET, isDraft: true, targetContainer: 'image', targetRect: imgContainer.getBoundingClientRect(), targetEl: imgContainer };
          }
          const msgParent = imgContainer.closest<HTMLElement>('[data-message-id]');
          const targetId = msgParent?.dataset.messageId || imgContainer.getAttribute('data-image-container');
          if (targetId) {
            const isDraft = targetId === 'draft' || targetId === DRAFT_TARGET;
            return { id: isDraft ? DRAFT_TARGET : targetId, isDraft, targetContainer: 'image', targetRect: imgContainer.getBoundingClientRect(), targetEl: imgContainer };
          }
        }

        if (el.tagName === 'IMG' || el instanceof HTMLImageElement) {
          const container = (el.closest<HTMLElement>('[data-image-container]') || el.parentElement || el) as HTMLElement;
          const isDraftContainer = container?.getAttribute('data-image-container') === 'draft';
          const draftParent = el.closest<HTMLElement>('[data-draft-id]');
          if (draftParent || isDraftContainer) {
            return { id: DRAFT_TARGET, isDraft: true, targetContainer: 'image', targetRect: container.getBoundingClientRect(), targetEl: container };
          }
          const msgParent = el.closest<HTMLElement>('[data-message-id]');
          const targetId = msgParent?.dataset.messageId || container.getAttribute('data-image-container');
          if (targetId) {
            const isDraft = targetId === 'draft' || targetId === DRAFT_TARGET;
            return { id: isDraft ? DRAFT_TARGET : targetId, isDraft, targetContainer: 'image', targetRect: container.getBoundingClientRect(), targetEl: container };
          }
        }

        // Check if cursor is directly on or inside an annotatable wrap
        const directWrap = el.closest<HTMLElement>('.annotatable-wrap');
        if (directWrap) {
          const draftParent = directWrap.closest<HTMLElement>('[data-draft-id]');
          if (draftParent) {
            return { id: DRAFT_TARGET, isDraft: true, targetContainer: 'text', targetRect: directWrap.getBoundingClientRect(), targetEl: directWrap };
          }
          const msgParent = directWrap.closest<HTMLElement>('[data-message-id]');
          if (msgParent && msgParent.dataset.messageId) {
            return { id: msgParent.dataset.messageId, isDraft: false, targetContainer: 'text', targetRect: directWrap.getBoundingClientRect(), targetEl: directWrap };
          }
        }

        const draft = el.closest<HTMLElement>('[data-draft-id]');
        if (draft) {
          const img = draft.querySelector<HTMLElement>('[data-image-container]');
          if (img) {
            const imgRect = img.getBoundingClientRect();
            if (clientY >= imgRect.top - 5 && clientY <= imgRect.bottom + 5) {
              return { id: DRAFT_TARGET, isDraft: true, targetContainer: 'image', targetRect: imgRect, targetEl: img };
            }
          }
          const wrap = draft.querySelector<HTMLElement>('.annotatable-wrap') || draft;
          return { id: DRAFT_TARGET, isDraft: true, targetContainer: 'text', targetRect: wrap.getBoundingClientRect(), targetEl: wrap };
        }
        const bubble = el.closest<HTMLElement>('[data-message-id]');
        if (bubble && bubble.dataset.messageId) {
          const img = bubble.querySelector<HTMLElement>('[data-image-container]');
          if (img) {
            const imgRect = img.getBoundingClientRect();
            if (clientY >= imgRect.top - 5 && clientY <= imgRect.bottom + 5) {
              return { id: bubble.dataset.messageId, isDraft: false, targetContainer: 'image', targetRect: imgRect, targetEl: img };
            }
          }
          const wrap = bubble.querySelector<HTMLElement>('.annotatable-wrap') || bubble;
          return { id: bubble.dataset.messageId, isDraft: false, targetContainer: 'text', targetRect: wrap.getBoundingClientRect(), targetEl: wrap };
        }
      }
    }

    // 2. If hit empty space (gutter, margin, divider), associate with the vertically aligned or closest bubble
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('[data-message-id], [data-draft-id]'));
    if (candidates.length > 0) {
      let bestEl: HTMLElement | null = null;
      let bestDist = Infinity;

      for (const el of candidates) {
        const r = el.getBoundingClientRect();
        let dist = 0;
        if (clientY < r.top) {
          dist = r.top - clientY;
        } else if (clientY > r.bottom) {
          dist = clientY - r.bottom;
        } else {
          dist = 0; // Vertically within bounds!
        }

        if (dist < bestDist) {
          bestDist = dist;
          bestEl = el;
          if (dist === 0) break;
        }
      }

      if (bestEl) {
        const isDraft = bestEl.hasAttribute('data-draft-id');
        const id = isDraft ? DRAFT_TARGET : (bestEl.dataset.messageId || DRAFT_TARGET);
        const img = bestEl.querySelector<HTMLElement>('[data-image-container]');
        if (img) {
          const imgRect = img.getBoundingClientRect();
          if (clientY >= imgRect.top - 10 && clientY <= imgRect.bottom + 10) {
            return { id, isDraft, targetContainer: 'image', targetRect: imgRect, targetEl: img };
          }
        }
        const wrap = bestEl.querySelector<HTMLElement>('.annotatable-wrap') || bestEl;
        return { id, isDraft, targetContainer: 'text', targetRect: wrap.getBoundingClientRect(), targetEl: wrap };
      }
    }

    // 3. Fallback: Prefer draft bubble if present in DOM, else viewport container
    if (typeof document !== 'undefined') {
      const draftFallback = document.querySelector<HTMLElement>('[data-draft-id]');
      if (draftFallback) {
        const wrap = draftFallback.querySelector<HTMLElement>('.annotatable-wrap') || draftFallback;
        return { id: DRAFT_TARGET, isDraft: true, targetContainer: 'text', targetRect: wrap.getBoundingClientRect(), targetEl: wrap };
      }
    }

    const containerRect = containerEl?.getBoundingClientRect() || svgEl?.getBoundingClientRect() || new DOMRect(0, 0, 300, 300);
    return { id: DRAFT_TARGET, isDraft: true, targetContainer: 'text', targetRect: containerRect, targetEl: containerEl || undefined };
  }

  function handlePointerDown(e: PointerEvent) {
    if (!isActive) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

    // Eraser mode takes priority
    if (isEraser) {
      e.preventDefault();
      e.stopPropagation();
      onErase?.(e.clientX, e.clientY);
      return;
    }

    // Multi-touch gesture detected (2 or more fingers) -> Pinch-to-zoom mode
    if (activePointers.size >= 2) {
      if (drawing) {
        // Discard accidental single-touch stroke that preceded the second finger
        drawing = false;
        liveClientPoints = [];
        livePath = '';
        activeTarget = null;
      }
      isPinching = true;
      const pts = Array.from(activePointers.values());
      const p1 = pts[0];
      const p2 = pts[1];
      pinchStartDistance = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
      pinchStartScale = currentScale;
      pinchStartPanX = currentPanX;
      pinchStartPanY = currentPanY;
      pinchStartMidpoint = {
        x: (p1.clientX + p2.clientX) / 2,
        y: (p1.clientY + p2.clientY) / 2
      };
      e.preventDefault();
      return;
    }

    // Single pointer -> Start drawing stroke
    e.preventDefault();
    e.stopPropagation();

    if (svgEl && typeof svgEl.setPointerCapture === 'function') {
      try {
        svgEl.setPointerCapture(e.pointerId);
      } catch (err) {}
    }

    drawing = true;
    activeTarget = resolveTarget(e.clientX, e.clientY);

    stabilizer.reset();
    const t = e.timeStamp || performance.now();
    const smoothed = stabilizer.addPoint(e.clientX, e.clientY, t);
    liveClientPoints = [{ x: smoothed.x, y: smoothed.y }];

    const ptSvg = clientToSvg(smoothed.x, smoothed.y);
    livePath = `M ${ptSvg.x.toFixed(1)} ${ptSvg.y.toFixed(1)}`;
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isActive || !activePointers.has(e.pointerId)) return;

    activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

    // Multi-touch two-finger pinch-to-zoom on canvas
    if (activePointers.size >= 2) {
      e.preventDefault();
      const pts = Array.from(activePointers.values());
      const p1 = pts[0];
      const p2 = pts[1];
      const dist = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
      const mid = {
        x: (p1.clientX + p2.clientX) / 2,
        y: (p1.clientY + p2.clientY) / 2
      };

      if (pinchStartDistance > 5) {
        const factor = dist / pinchStartDistance;
        const newScale = Math.min(Math.max(pinchStartScale * factor, 1.0), 3.0);
        
        // Pan smoothly with the midpoint
        const dx = mid.x - pinchStartMidpoint.x;
        const dy = mid.y - pinchStartMidpoint.y;
        
        currentScale = newScale;
        if (currentScale > 1.0) {
          currentPanX = pinchStartPanX + dx;
          currentPanY = pinchStartPanY + dy;
        } else {
          currentPanX = 0;
          currentPanY = 0;
        }

        onCanvasTransform?.(currentScale, currentPanX, currentPanY, true);
      }
      return;
    }

    // Eraser mode drag
    if (isEraser) {
      e.preventDefault();
      onErase?.(e.clientX, e.clientY);
      return;
    }

    if (!drawing) return;
    e.preventDefault();
    e.stopPropagation();

    const t = e.timeStamp || performance.now();
    const smoothed = stabilizer.addPoint(e.clientX, e.clientY, t);

    // Skip redundant points within 1px
    const last = liveClientPoints[liveClientPoints.length - 1];
    if (last) {
      const d = Math.hypot(smoothed.x - last.x, smoothed.y - last.y);
      if (d < 1) return;
    }

    liveClientPoints.push({ x: smoothed.x, y: smoothed.y });

    // Update live SVG preview path in screen coords
    const svgPts = liveClientPoints.map(p => clientToSvg(p.x, p.y));
    livePath = pointsToBezierSvgPath(svgPts);
  }

  function handlePointerUp(e: PointerEvent) {
    if (!isActive) return;

    activePointers.delete(e.pointerId);

    if (svgEl && typeof svgEl.releasePointerCapture === 'function') {
      try {
        svgEl.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }

    if (activePointers.size < 2 && isPinching) {
      isPinching = false;
      onCanvasTransform?.(currentScale, currentPanX, currentPanY, false);
    }

    if (!drawing || activePointers.size > 0) return;
    drawing = false;

    if (liveClientPoints.length >= 1 && activeTarget) {
      e.preventDefault();
      e.stopPropagation();

      let pts = liveClientPoints;
      if (pts.length === 1) {
        pts = [pts[0], { x: pts[0].x + 0.1, y: pts[0].y + 0.1 }];
      }

      const targetRect = activeTarget.targetEl ? activeTarget.targetEl.getBoundingClientRect() : activeTarget.targetRect;
      const targetW = Math.max(targetRect.width, 1);
      const targetH = Math.max(targetRect.height, 1);

      // Convert client coordinates to unscaled target-local coordinates
      const scaleToUse = Math.max(currentScale, 0.001);
      const unscaledTargetW = targetW / scaleToUse;
      const unscaledTargetH = targetH / scaleToUse;

      const targetLocalPts = pts.map(p => ({
        x: (p.x - targetRect.left) / scaleToUse,
        y: (p.y - targetRect.top) / scaleToUse
      }));

      // Curve smoothing and Catmull-Rom Bezier fitting
      const processed = processStrokeEnd(targetLocalPts, 4, 1.2);
      const pixelSegments = processed.segments;
      const strokePath = bezierSegmentsToSvgPath(pixelSegments) || pointsToBezierSvgPath(targetLocalPts);

      // Normalized coordinates relative to target's unscaled bounding box
      const normPoints = processed.simplifiedPoints.map(p => ({
        x: p.x / unscaledTargetW,
        y: p.y / unscaledTargetH
      }));

      const normSegments = pixelSegments.length > 0
        ? pixelSegments.map(seg => ({
            p0: { x: seg.p0.x / unscaledTargetW, y: seg.p0.y / unscaledTargetH },
            cp1: { x: seg.cp1.x / unscaledTargetW, y: seg.cp1.y / unscaledTargetH },
            cp2: { x: seg.cp2.x / unscaledTargetW, y: seg.cp2.y / unscaledTargetH },
            p1: { x: seg.p1.x / unscaledTargetW, y: seg.p1.y / unscaledTargetH }
          }))
        : (normPoints.length > 0 ? [{
            p0: normPoints[0],
            cp1: normPoints[0],
            cp2: normPoints[normPoints.length - 1],
            p1: normPoints[normPoints.length - 1]
          }] : []);

      const xs = normPoints.map(p => p.x);
      const ys = normPoints.map(p => p.y);

      const stroke: StrokeElement = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : 'stroke_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
        coordSpace: 'normalized-textbox-v1',
        color: activeColor,
        strokeWidth,
        width: strokeWidth,
        points: normPoints,
        segments: normSegments,
        path: strokePath,
        pathNormalized: bezierSegmentsToSvgPath(normSegments),
        containerWidth: unscaledTargetW,
        containerHeight: unscaledTargetH,
        boundingBox: {
          x0: Math.min(...xs),
          y0: Math.min(...ys),
          x1: Math.max(...xs),
          y1: Math.max(...ys)
        },
        boundingBoxNormalized: {
          x0: Math.min(...xs),
          y0: Math.min(...ys),
          x1: Math.max(...xs),
          y1: Math.max(...ys)
        },
        targetMessageId: activeTarget.isDraft ? undefined : activeTarget.id,
        targetContainer: activeTarget.targetContainer || 'text',
        targetElement: activeTarget.targetContainer || 'text',
        createdAt: Date.now()
      };

      onStrokeCommitted?.(activeTarget.id, stroke);
    }

    liveClientPoints = [];
    livePath = '';
    activeTarget = null;
  }

  function handlePointerCancel(e: PointerEvent) {
    activePointers.delete(e.pointerId);

    if (svgEl && typeof svgEl.releasePointerCapture === 'function') {
      try {
        svgEl.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }

    if (activePointers.size < 2 && isPinching) {
      isPinching = false;
      onCanvasTransform?.(currentScale, currentPanX, currentPanY, false);
    }

    if (drawing && liveClientPoints.length >= 1) {
      handlePointerUp(e);
      return;
    }

    drawing = false;
    liveClientPoints = [];
    livePath = '';
    activeTarget = null;
  }
</script>

<!-- Full-screen interactive annotation overlay covering the chat viewport -->
<svg
  bind:this={svgEl}
  class="absolute inset-0 z-30 w-full h-full select-none"
  style="pointer-events: {isActive ? 'auto' : 'none'}; touch-action: none; {isActive ? (isEraser ? 'cursor: cell;' : 'cursor: crosshair;') : ''}"
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerCancel}
  onwheel={(e) => {
    if (isActive && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
      currentScale = Math.min(Math.max(currentScale + zoomDelta, 1.0), 3.0);
      if (currentScale <= 1.0) {
        currentPanX = 0;
        currentPanY = 0;
      }
      onCanvasTransform?.(currentScale, currentPanX, currentPanY, false);
    }
  }}
  aria-hidden="true"
>
  <!-- In-flight live stroke drawing with smooth Catmull-Rom Bezier curves -->
  {#if livePath && drawing}
    <path
      d={livePath}
      fill="none"
      stroke={activeColor}
      stroke-width={strokeWidth}
      stroke-linecap="round"
      stroke-linejoin="round"
      vector-effect="non-scaling-stroke"
    />
  {/if}
</svg>

<style>
  svg {
    overflow: visible;
  }
</style>
