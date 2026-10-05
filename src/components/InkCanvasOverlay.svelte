<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { StrokeElement, DraftStroke, RawPoint } from '../types/ink';
  import type { MathNode } from '../math/mathModel';
  import { commitStroke, eraseStrokeById } from '../math/inkMath';

  export let isActive = false;
  export let strokes: StrokeElement[] = [];
  export let contentTree: MathNode[] = [];
  export let containerEl: HTMLElement | null = null;
  export let currentColor = '#e63946'; // Red default
  export let currentWidth = 2.5; // px in natural box space
  export let isEraser = false;
  export let onStrokeCommitted: ((stroke: StrokeElement, allStrokes: StrokeElement[]) => void) | null = null;
  export let onStrokesChanged: ((allStrokes: StrokeElement[]) => void) | null = null;

  let overlaySvgEl: SVGSVGElement | null = null;
  let draft: DraftStroke | null = null;
  let rafPending = false;
  let pendingPoint: RawPoint | null = null;
  let livePolylinePoints = '';
  let contentBoxRect = { width: 1, height: 1, left: 0, top: 0 };
  let isPointerDown = false;
  let activePointerId: number | null = null;

  function updateContentBox(): DOMRect | { width: number; height: number; left: number; top: number } {
    if (overlaySvgEl) {
      const rect = overlaySvgEl.getBoundingClientRect();
      contentBoxRect = {
        width: Math.max(rect.width, 1),
        height: Math.max(rect.height, 1),
        left: rect.left,
        top: rect.top,
      };
      return rect;
    }
    return contentBoxRect;
  }

  function toRawPoint(e: PointerEvent, contentBox: { left: number; top: number }): RawPoint {
    return {
      x: e.clientX - contentBox.left,
      y: e.clientY - contentBox.top,
      t: performance.now(),
    };
  }

  function renderLivePreview(d: DraftStroke | null) {
    if (!d || d.rawPoints.length === 0) {
      livePolylinePoints = '';
      return;
    }
    // Render raw points directly in pixel coordinates for 0-latency preview
    livePolylinePoints = d.rawPoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  }

  function handlePointerDown(e: PointerEvent) {
    if (!isActive) return;
    // Allow all pointer types (mouse, touch, pen)
    // For mouse, only allow left button (button 0)
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    
    e.preventDefault();
    e.stopPropagation();

    const box = updateContentBox();
    if (overlaySvgEl) {
      try {
        overlaySvgEl.setPointerCapture(e.pointerId);
        activePointerId = e.pointerId;
      } catch (err) {
        console.warn('Failed to set pointer capture:', err);
      }
    }

    const startPt = toRawPoint(e, box);
    isPointerDown = true;

    if (isEraser) {
      eraseAtPoint(startPt.x, startPt.y, box);
      return;
    }

    draft = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'strk_' + Math.random().toString(36).substring(2, 10),
      rawPoints: [startPt],
      color: currentColor,
      width: currentWidth,
    };

    renderLivePreview(draft);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isActive) return;
    
    const box = contentBoxRect;
    
    // Check if pointer is down - works for both mouse (buttons) and touch (isPointerDown flag)
    const pointerIsDown = (e.pointerType === 'mouse' && e.buttons > 0) || (e.pointerType !== 'mouse' && isPointerDown);
    
    if (isEraser && pointerIsDown) {
      e.preventDefault();
      const pt = toRawPoint(e, box);
      eraseAtPoint(pt.x, pt.y, box);
      return;
    }

    if (!draft) return;
    e.preventDefault();
    
    pendingPoint = toRawPoint(e, box);

    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(() => {
        if (pendingPoint && draft) {
          draft.rawPoints.push(pendingPoint);
          renderLivePreview(draft);
        }
        rafPending = false;
      });
    }
  }

  function handlePointerUp(e: PointerEvent) {
    if (!isActive) return;
    
    isPointerDown = false;
    
    if (overlaySvgEl && activePointerId !== null) {
      try {
        overlaySvgEl.releasePointerCapture(activePointerId);
      } catch (err) {
        console.warn('Failed to release pointer capture:', err);
      }
      activePointerId = null;
    }

    if (isEraser) {
      return;
    }

    if (!draft || draft.rawPoints.length === 0) {
      draft = null;
      livePolylinePoints = '';
      return;
    }

    // Step 5: commitStroke (simplifies with RDP, normalizes to 0-1, fits Catmull-Rom Bezier, captures anchors)
    const box = updateContentBox();
    const finalStroke = commitStroke(draft, box as DOMRect, contentTree, containerEl);

    strokes = [...strokes, finalStroke];
    draft = null;
    livePolylinePoints = '';

    onStrokeCommitted?.(finalStroke, strokes);
    onStrokesChanged?.(strokes);
  }

  function handlePointerCancel() {
    isPointerDown = false;
    if (overlaySvgEl && activePointerId !== null) {
      try {
        overlaySvgEl.releasePointerCapture(activePointerId);
      } catch (err) {}
      activePointerId = null;
    }
    draft = null;
    livePolylinePoints = '';
  }

  function eraseAtPoint(px: number, py: number, box: { width: number; height: number }) {
    if (strokes.length === 0) return;
    
    // For new strokes with pixel coordinates, use pixel-based hit detection
    // For old strokes with normalized coordinates, convert to normalized first
    const hitThreshold = box.width * 0.04; // 4% of container width in pixels

    const surviving = strokes.filter(s => {
      // Check if this stroke uses pixel coordinates (has containerWidth)
      const usesPixelCoords = s.containerWidth !== undefined && s.containerHeight !== undefined;
      
      let checkPx, checkPy, threshold;
      
      if (usesPixelCoords) {
        // Stroke is in pixel coordinates - compare directly
        checkPx = px;
        checkPy = py;
        threshold = hitThreshold;
      } else {
        // Stroke is in normalized coordinates - convert to normalized
        checkPx = px / box.width;
        checkPy = py / box.height;
        threshold = 0.04; // 4% in normalized space
      }
      
      // Quick bounding box check
      const bb = s.boundingBox;
      if (bb && checkPx >= bb.x0 - threshold && checkPx <= bb.x1 + threshold &&
          checkPy >= bb.y0 - threshold && checkPy <= bb.y1 + threshold) {
        // Point proximity check
        const hit = Array.isArray(s.points) && s.points.some((p: any) => {
          const pointX = Array.isArray(p) ? p[0] : (p?.x ?? 0);
          const pointY = Array.isArray(p) ? p[1] : (p?.y ?? 0);
          const dx = pointX - checkPx;
          const dy = pointY - checkPy;
          return (dx * dx + dy * dy) < (threshold * threshold);
        });
        return !hit;
      }
      return true;
    });

    if (surviving.length !== strokes.length) {
      strokes = surviving;
      onStrokesChanged?.(strokes);
    }
  }

  export function undoLastStroke(): StrokeElement | null {
    if (strokes.length === 0) return null;
    const last = strokes[strokes.length - 1];
    strokes = strokes.slice(0, -1);
    onStrokesChanged?.(strokes);
    return last;
  }

  export function clearAllStrokes() {
    strokes = [];
    draft = null;
    livePolylinePoints = '';
    onStrokesChanged?.(strokes);
  }

  onMount(() => {
    updateContentBox();
    const resizeObserver = new ResizeObserver(() => {
      updateContentBox();
    });
    if (overlaySvgEl) {
      resizeObserver.observe(overlaySvgEl);
    }
    return () => {
      resizeObserver.disconnect();
    };
  });
</script>

<svg
  bind:this={overlaySvgEl}
  class="absolute inset-0 z-20 overflow-visible select-none {isActive ? 'touch-none pointer-events-auto' : 'pointer-events-none'}"
  style="width: 100%; height: 100%; overflow: visible; pointer-events: {isActive ? 'auto' : 'none'}; {isActive ? (isEraser ? 'cursor: cell;' : 'cursor: crosshair;') : ''}; touch-action: none;"
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerCancel}
>
  <!-- Committed strokes -->
  {#each strokes as s (s.id)}
    {#if s.coordSpace === 'normalized-textbox-v1' && s.containerWidth && s.containerHeight && contentBoxRect.width > 0 && contentBoxRect.height > 0}
      <!-- For normalized strokes, scale from original container to current container -->
      {@const scaleX = contentBoxRect.width / s.containerWidth}
      {@const scaleY = contentBoxRect.height / s.containerHeight}
      <g transform={`scale(${scaleX}, ${scaleY})`}>
        <path
          d={s.path}
          stroke={s.color}
          stroke-width={s.width}
          stroke-opacity={s.opacity !== undefined ? s.opacity : 1}
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </g>
    {:else}
      <!-- Old format: normalized coordinates (backward compatibility) -->
      <svg
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        class="overflow-visible"
        style="position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible;"
      >
        <path
          d={s.pathNormalized || s.path}
          stroke={s.color}
          stroke-width={s.width}
          stroke-opacity={s.opacity !== undefined ? s.opacity : 1}
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
      </svg>
    {/if}
  {/each}

  <!-- Live uncommitted draft polyline rendered directly in pixel space for zero latency -->
  {#if draft && livePolylinePoints}
    <polyline
      points={livePolylinePoints}
      stroke={draft.color}
      stroke-width={draft.width}
      stroke-opacity={0.85}
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  {/if}
</svg>
