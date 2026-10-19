<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { MathNode } from '../math/mathModel';
  import StaticMathRenderer from '../math/StaticMathRenderer.svelte';
  import MathNodeRenderer from '../math/MathNodeRenderer.svelte';
  import { deserializeTree } from '../math/mathSerialization';
  import {
    StrokeStabilizer,
    processStrokeEnd,
    pointsToBezierSvgPath,
    bezierSegmentsToSvgPath,
    getDisplayStrokeColor,
    isBlueColor,
    type CubicBezierSegment
  } from '../math/inkMath';

  export let text: string = '';
  export let nodes: MathNode[] | null = null;
  export let annotations: any[] = [];
  export let strokes: any[] = [];
  export let readonly: boolean = true;
  export let isMe: boolean = true;
  export let isEditor: boolean = false;
  export let isSketchMode: boolean = false;
  export let isEraser: boolean = false;
  export let enableDirectDrawing: boolean = false;
  export let activeColor: string = '#e63946';
  export let activeWidth: number = 2.5;
  export let textColor: string = '#1d4ed8';
  export let isBold: boolean = false;
  export let isItalic: boolean = false;
  export let isUnderlined: boolean = false;
  export let fontFamily: string = 'inherit';
  export let currentCursorPath: any = { containerPath: [], offset: 0 };
  export let selectedNodeIds: Set<string> = new Set();
  export let textareaEl: HTMLElement | null = null;
  export let onAnnotationCreate: ((ann: any) => void) | null = null;
  export let onStrokesChanged: ((allStrokes: any[]) => void) | null = null;
  export let onpointerdown: ((e: PointerEvent) => void) | null = null;
  export let onkeydown: ((e: KeyboardEvent) => void) | null = null;
  export let oncopy: ((e: ClipboardEvent) => void) | null = null;
  export let oncut: ((e: ClipboardEvent) => void) | null = null;
  export let onpaste: ((e: ClipboardEvent) => void) | null = null;

  let textEl: HTMLElement | null = null;
  let box = { width: 0, height: 0 };
  let currentStroke: { x: number; y: number }[] = [];
  let drawing = false;
  let isPointerDown = false;
  let resizeObserver: ResizeObserver | null = null;
  // High responsiveness (0.85 alphaMin) eliminates initial drag / resistance at stroke start
  const stabilizer = new StrokeStabilizer(0.85, 0.98, 0.5);
  let lastRawClient: { x: number; y: number } | null = null;
  let svgEl: SVGSVGElement | null = null;
  let windowListenersAttached = false;

  function attachWindowListeners() {
    if (windowListenersAttached || typeof window === 'undefined') return;
    windowListenersAttached = true;
    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
  }

  function cleanupWindowListeners() {
    if (!windowListenersAttached || typeof window === 'undefined') return;
    windowListenersAttached = false;
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerCancel);
  }

  $: canDraw = !readonly && isSketchMode && enableDirectDrawing;

  $: resolvedNodes = nodes || (text ? deserializeTree(text) : []);
  $: allAnnotations = [
    ...(Array.isArray(annotations) ? annotations : []),
    ...(Array.isArray(strokes) ? strokes : [])
  ];

  export function measure() {
    if (!textEl) return;
    const r = textEl.getBoundingClientRect();
    const parent = textEl.parentElement;
    const parentR = parent ? parent.getBoundingClientRect() : null;
    const computedW = r.width > 0 ? r.width : (parentR?.width ?? 0);
    const computedH = r.height > 0 ? r.height : (parentR?.height ?? 0);
    if (computedW > 0 || computedH > 0) {
      box = { width: computedW, height: computedH };
    }
  }

  onMount(() => {
    measure();
    if (textEl && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        measure();
      });
      resizeObserver.observe(textEl);
    }
    window.addEventListener('resize', measure);
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(measure);
    }
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', measure);
      cleanupWindowListeners();
    };
  });

  onDestroy(() => {
    cleanupWindowListeners();
  });

  // Convert raw client px to normalized [0, 1] relative to text box
  function toNormalized(clientX: number, clientY: number): { x: number; y: number } {
    if (!textEl) return { x: 0, y: 0 };
    const r = textEl.getBoundingClientRect();
    const w = box.width > 0 ? box.width : (r.width > 0 ? r.width : 100);
    const h = box.height > 0 ? box.height : (r.height > 0 ? r.height : 40);
    return {
      x: (clientX - r.left) / w,
      y: (clientY - r.top) / h
    };
  }

  // Convert normalized [0, 1] to absolute px in the text box
  // For strokes with containerWidth, use their original container as reference to maintain positioning
  function toAbsolute(pt: any, referenceWidth?: number, referenceHeight?: number): { x: number; y: number } {
    const validRefW = typeof referenceWidth === 'number' && referenceWidth > 0 ? referenceWidth : undefined;
    const validRefH = typeof referenceHeight === 'number' && referenceHeight > 0 ? referenceHeight : undefined;
    const w = validRefW || box.width || (textEl ? textEl.getBoundingClientRect().width : 0) || 1;
    const h = validRefH || box.height || (textEl ? textEl.getBoundingClientRect().height : 0) || 1;
    const px = typeof pt === 'object' && pt !== null && !Array.isArray(pt) ? (pt.x ?? 0) : (Array.isArray(pt) ? pt[0] : 0);
    const py = typeof pt === 'object' && pt !== null && !Array.isArray(pt) ? (pt.y ?? 0) : (Array.isArray(pt) ? pt[1] : 0);
    return { x: px * w, y: py * h };
  }

  // 2.3 Render layer: Bezier reconstruction, never straight lineTo/L segments
  function pointsToPath(points: any[], refWidth?: number, refHeight?: number): string {
    if (!points || !points.length) return '';
    const absPoints = points.map(p => toAbsolute(p, refWidth, refHeight));
    return pointsToBezierSvgPath(absPoints);
  }

  function annotationToPath(ann: any): string {
    if (!ann) return '';
    const w = box.width || (textEl ? textEl.getBoundingClientRect().width : 0) || 1;
    const h = box.height || (textEl ? textEl.getBoundingClientRect().height : 0) || 1;

    const pts = ann.points || ann.rawPoints;

    // 1. If it has stored Bezier segments (Part 2 canonical geometry), reconstruct with reference dimensions
    if (ann.coordSpace === 'normalized-textbox-v1' && Array.isArray(ann.segments) && ann.segments.length > 0) {
      const refW = ann.containerWidth || w;
      const refH = ann.containerHeight || h;
      const scaledSegments: CubicBezierSegment[] = ann.segments.map((seg: any) => ({
        p0: { x: seg.p0.x * refW, y: seg.p0.y * refH },
        cp1: { x: seg.cp1.x * refW, y: seg.cp1.y * refH },
        cp2: { x: seg.cp2.x * refW, y: seg.cp2.y * refH },
        p1: { x: seg.p1.x * refW, y: seg.p1.y * refH }
      }));
      return bezierSegmentsToSvgPath(scaledSegments);
    }

    // 2. For normalized-textbox-v1 strokes without segments, use their original container dimensions as reference
    if (ann.coordSpace === 'normalized-textbox-v1' && Array.isArray(pts) && pts.length > 0) {
      const refW = ann.containerWidth || w;
      const refH = ann.containerHeight || h;
      return pointsToPath(pts, refW, refH);
    }

    // 3. If it has container dimensions (external pixel coordinate system), scale relative to original container
    if (Array.isArray(pts) && pts.length > 0 && ann.containerWidth && ann.containerHeight) {
      const scaleX = w / ann.containerWidth;
      const scaleY = h / ann.containerHeight;
      
      const scaledPoints = pts.map((p: any) => {
        const px = Array.isArray(p) ? p[0] : (p?.x ?? 0);
        const py = Array.isArray(p) ? p[1] : (p?.y ?? 0);
        return {
          x: px * scaleX,
          y: py * scaleY
        };
      });
      return pointsToBezierSvgPath(scaledPoints);
    }

    // 4. Normalized points without container info
    if (Array.isArray(pts) && pts.length > 0) {
      return pointsToPath(pts);
    }

    // 5. Fallback to pre-computed path string if no points array exists
    if (ann.path && typeof ann.path === 'string') {
      return ann.path;
    }
    return '';
  }

  function handlePointerDown(e: PointerEvent) {
    if (readonly || !isSketchMode) {
      onpointerdown?.(e);
      return;
    }
    // Allow all pointer types (mouse, touch, pen)
    // For mouse, only allow left button (button 0)
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    // Safely capture pointer on the SVG overlay container
    if (svgEl && typeof svgEl.setPointerCapture === 'function') {
      try {
        svgEl.setPointerCapture(e.pointerId);
      } catch (err) {
        // Ignore if pointer capture fails on certain platforms
      }
    }

    if (isEraser) {
      eraseAtClientPoint(e.clientX, e.clientY);
      return;
    }

    drawing = true;
    isPointerDown = true;
    measure();

    // Attach window listeners so all pointer movements are caught everywhere on screen
    attachWindowListeners();

    // 2.1 Stage A: Live input stabilization (reset on pointer down)
    stabilizer.reset();
    const t = e.timeStamp || performance.now();
    const smoothed = stabilizer.addPoint(e.clientX, e.clientY, t);
    lastRawClient = { x: e.clientX, y: e.clientY };
    const pt = toNormalized(smoothed.x, smoothed.y);
    currentStroke = [pt];
  }

  function handlePointerMove(e: PointerEvent) {
    if (readonly || !isSketchMode) return;
    
    // Check if pointer is down - works for both mouse (buttons) and touch (isPointerDown flag)
    const pointerIsDown = (e.pointerType === 'mouse' && e.buttons > 0) || (e.pointerType !== 'mouse' && isPointerDown);
    
    if (isEraser && pointerIsDown) {
      e.preventDefault();
      eraseAtClientPoint(e.clientX, e.clientY);
      return;
    }
    if (!drawing || !isPointerDown) return;
    e.preventDefault();
    e.stopPropagation();

    // Skip redundant identical points if distance moved is negligible (< 1px)
    if (lastRawClient) {
      const d = Math.hypot(e.clientX - lastRawClient.x, e.clientY - lastRawClient.y);
      if (d < 1) return;
    }

    // 2.1 Stage A: Feed raw pointer to stabilizer and draw/store smoothed point
    const t = e.timeStamp || performance.now();
    const smoothed = stabilizer.addPoint(e.clientX, e.clientY, t);
    lastRawClient = { x: e.clientX, y: e.clientY };
    const pt = toNormalized(smoothed.x, smoothed.y);
    currentStroke.push(pt);
    currentStroke = currentStroke;
  }

  function handlePointerUp(e: PointerEvent) {
    if (readonly || !isSketchMode) return;
    cleanupWindowListeners();

    if (svgEl && typeof svgEl.releasePointerCapture === 'function') {
      try {
        svgEl.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }

    isPointerDown = false;
    if (!drawing) return;
    drawing = false;

    if (currentStroke.length >= 1) {
      // If it's a single dot/tap, add a micro-offset point so it renders and persists as a valid dot
      let strokePoints = currentStroke;
      if (strokePoints.length === 1) {
        strokePoints = [
          strokePoints[0],
          { x: strokePoints[0].x + 0.0001, y: strokePoints[0].y + 0.0001 }
        ];
      }

      // 1. Convert normalized points to pixel coordinates for processing
      const pixelPoints = strokePoints.map(p => toAbsolute(p));

      // 2.2 Stage B: Resample (4px) -> RDP Simplify (1.2px) -> Catmull-Rom to Cubic Bezier
      const processed = processStrokeEnd(pixelPoints, 4, 1.2);
      const pixelSegments = processed.segments;

      // 2.3 Render layer: Compute smooth Bezier SVG path (never straight L segments)
      const strokePath = bezierSegmentsToSvgPath(pixelSegments) || pointsToPath(strokePoints);

      const w = box.width || (textEl ? textEl.getBoundingClientRect().width : 0) || 1;
      const h = box.height || (textEl ? textEl.getBoundingClientRect().height : 0) || 1;

      // Normalize points and Bezier segments for persistent storage
      const normPoints = processed.simplifiedPoints.map(p => ({
        x: p.x / w,
        y: p.y / h
      }));

      const normSegments = pixelSegments.map(seg => ({
        p0: { x: seg.p0.x / w, y: seg.p0.y / h },
        cp1: { x: seg.cp1.x / w, y: seg.cp1.y / h },
        cp2: { x: seg.cp2.x / w, y: seg.cp2.y / h },
        p1: { x: seg.p1.x / w, y: seg.p1.y / h }
      }));

      const xs = normPoints.length > 0 ? normPoints.map(p => p.x) : strokePoints.map(p => p.x);
      const ys = normPoints.length > 0 ? normPoints.map(p => p.y) : strokePoints.map(p => p.y);

      const newAnn = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'ann_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        coordSpace: 'normalized-textbox-v1',
        color: activeColor,
        strokeWidth: activeWidth,
        width: activeWidth,
        points: normPoints.length > 0 ? normPoints : strokePoints,
        segments: normSegments,
        path: strokePath,
        pathNormalized: bezierSegmentsToSvgPath(normSegments),
        // Store original container dimensions for correct scaling on receiver side
        containerWidth: w,
        containerHeight: h,
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
        }
      };

      const updated = [...allAnnotations, newAnn];
      onAnnotationCreate?.(newAnn);
      onStrokesChanged?.(updated);
    }
    currentStroke = [];
  }

  // Lets the parent message row act as a boundary-less drawing surface: a touch anywhere on the
  // row starts a stroke here, instead of only touches that land on the text-sized SVG.
  export function beginStroke(e: PointerEvent) {
    if (!canDraw) return;
    if (svgEl && e.target instanceof Node && svgEl.contains(e.target)) return;
    handlePointerDown(e);
  }

  function handlePointerCancel(e: PointerEvent) {
    cleanupWindowListeners();

    if (svgEl && typeof svgEl.releasePointerCapture === 'function') {
      try {
        svgEl.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }

    // Only commit if the stroke has at least 5 points (a real deliberate stroke),
    // and never commit 1-point micro-dots on accidental browser cancellations
    if (drawing && currentStroke.length >= 5) {
      handlePointerUp(e);
      return;
    }
    drawing = false;
    isPointerDown = false;
    currentStroke = [];
  }

  function eraseAtClientPoint(clientX: number, clientY: number) {
    const pt = toNormalized(clientX, clientY);
    const threshold = 0.06;
    const surviving = allAnnotations.filter(ann => {
      const pts = ann.points || ann.rawPoints;
      if (!Array.isArray(pts)) return true;
      return !pts.some((p: any) => {
        const px = typeof p === 'object' && !Array.isArray(p) ? p.x : p[0];
        const py = typeof p === 'object' && !Array.isArray(p) ? p.y : p[1];
        const dx = px - pt.x;
        const dy = py - pt.y;
        return (dx * dx + dy * dy) < (threshold * threshold);
      });
    });
    if (surviving.length !== allAnnotations.length) {
      onStrokesChanged?.(surviving);
    }
  }

  $: {
    if (textEl && (text || nodes)) {
      measure();
    }
    if (textEl && isEditor) {
      textareaEl = textEl;
    }
  }
</script>

<div class="annotatable-wrap relative inline-block w-full overflow-visible" style={isSketchMode ? 'touch-action: none;' : undefined}>
  {#if isEditor}
    <div 
      bind:this={textEl}
      class="m-0 break-words whitespace-pre-wrap tracking-normal w-full text-left math-root {isSketchMode ? 'touch-none' : ''} outline-none focus:outline-none focus-visible:outline-none {isItalic ? 'italic' : ''} {isUnderlined ? 'underline underline-offset-4 decoration-2' : ''}"
      style="font-size: var(--chat-font-size, 1.0625rem); line-height: var(--chat-line-height, 1.75rem); color: {textColor}; font-weight: {isBold ? '550' : '400'}; min-height: var(--chat-line-height, 1.75rem); cursor: text; font-family: {fontFamily}; user-select: text; -webkit-user-select: text;"
      data-container-path="[]"
      tabindex={isSketchMode ? -1 : 0}
      {oncopy}
      {oncut}
      {onpaste}
      {onkeydown}
      onpointerdown={!isSketchMode ? handlePointerDown : undefined}
    >
      <MathNodeRenderer nodes={resolvedNodes} containerPath={[]} {currentCursorPath} {selectedNodeIds} />
    </div>
  {:else}
    <p 
      bind:this={textEl}
      class="m-0 break-words whitespace-pre-wrap tracking-normal w-full text-left {isItalic ? 'italic' : ''} {isUnderlined ? 'underline underline-offset-4 decoration-2' : ''}"
      style="font-size: var(--chat-font-size, 1.0625rem); line-height: var(--chat-line-height, 1.75rem); color: {getDisplayStrokeColor(textColor, isMe)}; font-weight: {isBold ? '550' : '400'}; min-height: var(--chat-line-height, 1.75rem); font-family: {fontFamily};"
    >
      <StaticMathRenderer nodes={resolvedNodes} {isMe} />
    </p>
  {/if}

  <!-- SVG Annotation Overlay anchored directly to text element's box -->
  {#if isSketchMode || allAnnotations.length > 0 || drawing || (box.width > 0 && box.height > 0)}
    <svg
      bind:this={svgEl}
      class="annotation-overlay pointer-events-none absolute inset-0 z-20 overflow-visible select-none"
      width={box.width > 0 ? box.width : '100%'}
      height={box.height > 0 ? box.height : '100%'}
      style="width: {box.width > 0 ? box.width + 'px' : '100%'}; height: {box.height > 0 ? box.height + 'px' : '100%'}; overflow: visible; pointer-events: {!readonly && isSketchMode && enableDirectDrawing ? 'auto' : 'none'}; {!readonly && isSketchMode && enableDirectDrawing ? (isEraser ? 'cursor: cell;' : 'cursor: crosshair;') : ''}; min-width: 100%; min-height: 100%; touch-action: none;"
      onpointerdown={handlePointerDown}
      onpointerup={handlePointerUp}
      onpointercancel={handlePointerCancel}
    >
      {#each allAnnotations as ann, idx (ann.id || idx)}
        {@const pathData = annotationToPath(ann)}
        {#if pathData}
          <path
            d={pathData}
            stroke={getDisplayStrokeColor(ann.color, isMe)}
            stroke-width={ann.strokeWidth || ann.width || 2.5}
            stroke-opacity={ann.opacity !== undefined ? ann.opacity : 1}
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke"
          />
        {/if}
      {/each}

      {#if drawing && currentStroke.length > 0}
        <path
          d={pointsToPath(currentStroke)}
          stroke={activeColor || '#2f5bea'}
          stroke-width={activeWidth || 2.5}
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
      {/if}
    </svg>
  {/if}
</div>

<style>
  .annotatable-wrap {
    position: relative;
    display: inline-block;
  }
  .annotation-overlay {
    position: absolute;
    top: 0;
    left: 0;
    touch-action: none;
  }
</style>
