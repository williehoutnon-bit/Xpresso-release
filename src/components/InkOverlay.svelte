<script lang="ts">
  import { onMount } from 'svelte';
  import type { StrokeElement } from '../types/ink';
  import { annotationStrokeToSvgPath, pointsToBezierSvgPath, bezierSegmentsToSvgPath, getDisplayStrokeColor } from '../math/inkMath';

  export let strokes: (StrokeElement | any)[] = [];
  export let contentBox: { width: number; height: number } | DOMRect | null = null;
  export let isMe: boolean = true;

  let svgEl: SVGSVGElement | null = null;
  let measuredBox: DOMRect | null = null;
  let resizeObserver: ResizeObserver | null = null;

  function getStrokePath(s: any): string {
    if (!s) return '';
    try {
      if (s.path && typeof s.path === 'string' && s.path.trim().length > 0) return s.path;
      if (s.pathNormalized && typeof s.pathNormalized === 'string' && s.pathNormalized.trim().length > 0) return s.pathNormalized;
      if (s.segments && Array.isArray(s.segments) && s.segments.length > 0) {
        const segPath = bezierSegmentsToSvgPath(s.segments);
        if (segPath) return segPath;
      }
      if (s.points && Array.isArray(s.points) && s.points.length > 0) {
        const ptPath = pointsToBezierSvgPath(s.points);
        if (ptPath) return ptPath;
      }
      return annotationStrokeToSvgPath(s);
    } catch (err) {
      console.warn('[InkOverlay] Error calculating stroke path:', err);
      return '';
    }
  }

  function getEffectiveBox(): DOMRect | { width: number; height: number } | null {
    return contentBox || measuredBox;
  }

  function getScaleTransform(s: any): string {
    const box = getEffectiveBox();
    if (!s || !box) {
      return '';
    }
    const scaleX = box.width / s.containerWidth;
    const scaleY = box.height / s.containerHeight;
    return `scale(${scaleX}, ${scaleY})`;
  }

  function updateMeasurement() {
    if (svgEl) {
      measuredBox = svgEl.getBoundingClientRect();
    }
  }

  onMount(() => {
    updateMeasurement();
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateMeasurement);
      if (svgEl) {
        resizeObserver.observe(svgEl);
      }
    }
    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  });

  $: {
    if (svgEl && !contentBox) {
      updateMeasurement();
    }
  }
</script>

{#if strokes && strokes.length > 0}
  {@const effBox = getEffectiveBox()}
  {@const effWidth = effBox?.width || 0}
  {@const effHeight = effBox?.height || 0}
  <svg
    bind:this={svgEl}
    width={contentBox ? contentBox.width : (measuredBox?.width || '100%')}
    height={contentBox ? contentBox.height : (measuredBox?.height || '100%')}
    class="pointer-events-none absolute inset-0 z-20 overflow-visible"
    style="width: 100%; height: 100%; overflow: visible; min-width: 1px; min-height: 1px;"
  >
    {#each strokes as s, idx (s?.id || idx)}
      {#if s}
        {@const dPath = getStrokePath(s)}
        {#if dPath}
          {#if s.coordSpace === 'normalized-textbox-v1' && s.containerWidth && s.containerHeight && effWidth > 0 && effHeight > 0}
            <!-- For normalized strokes, scale from original container to current container -->
            {@const scaleX = effWidth / s.containerWidth}
            {@const scaleY = effHeight / s.containerHeight}
            <g transform={`scale(${scaleX}, ${scaleY})`}>
              <path
                d={dPath}
                stroke={getDisplayStrokeColor(s.color, isMe)}
                stroke-width={s.width || 2.5}
                stroke-opacity={s.opacity !== undefined ? s.opacity : 1}
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </g>
          {:else if s.containerWidth && s.containerHeight && effWidth > 0 && effHeight > 0}
            <!-- For pixel-coordinate strokes with container metadata -->
            {@const scaleX = effWidth / s.containerWidth}
            {@const scaleY = effHeight / s.containerHeight}
            <g transform={`scale(${scaleX}, ${scaleY})`}>
              <path
                d={dPath}
                stroke={getDisplayStrokeColor(s.color, isMe)}
                stroke-width={s.width || 2.5}
                stroke-opacity={s.opacity !== undefined ? s.opacity : 1}
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </g>
          {:else}
            <!-- For normalized strokes without container dimensions, use viewBox scaling -->
            <svg
              viewBox="0 0 1 1"
              preserveAspectRatio="none"
              class="overflow-visible"
              style="position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible;"
            >
              <path
                d={s.pathNormalized || dPath}
                stroke={getDisplayStrokeColor(s.color, isMe)}
                stroke-width={s.width || 2.5}
                stroke-opacity={s.opacity !== undefined ? s.opacity : 1}
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
                vector-effect="non-scaling-stroke"
              />
            </svg>
          {/if}
        {/if}
      {/if}
    {/each}
  </svg>
{/if}
