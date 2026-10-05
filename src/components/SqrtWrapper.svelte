<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { generateSqrtSVG } from '../utils/sqrtSVG';

  const TICK_WIDTH = 16; // must match the value in sqrtSVG.ts

  let { index = null, children, hasSuperscript = false, hasOuterSuperscript = false } = $props<{ index?: any; children?: any; hasSuperscript?: boolean; hasOuterSuperscript?: boolean }>();

  const PAD = $derived(hasSuperscript ? 11 : 2);
  const CONTENT_GAP = 2;
  const paddingTop = $derived(PAD + CONTENT_GAP);
  const paddingBottom = 2;

  let contentEl: HTMLSpanElement | null = null;
  let wrapperEl: HTMLSpanElement | null = null;
  let svgMarkup = $state(generateSqrtSVG(14, 20, hasSuperscript, hasOuterSuperscript));
  let observer: ResizeObserver | null = null;

  let frameId: number | null = null;

  function measure() {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
    }
    frameId = requestAnimationFrame(() => {
      if (!contentEl) return;
      const rect = contentEl.getBoundingClientRect();
      // Use the dynamic generator specified in the PDF
      svgMarkup = generateSqrtSVG(rect.width, rect.height, hasSuperscript, hasOuterSuperscript);
    });
  }

  $effect(() => {
    // re-run measure when hasSuperscript or hasOuterSuperscript changes
    const _ = { hasSuperscript, hasOuterSuperscript };
    tick().then(measure);
  });

  onMount(async () => {
    await tick();
    measure();
    if (contentEl) {
      observer = new ResizeObserver(measure);
      observer.observe(contentEl);
    }
  });

  onDestroy(() => {
    if (observer) observer.disconnect();
    if (frameId !== null) cancelAnimationFrame(frameId);
  });
</script>

<!--
 The wrapper is position:relative so the absolute SVG
 stays anchored to it. The left padding pushes the slot
 content right to leave room for the tick.
-->
<span
  bind:this={wrapperEl}
  class="sqrt-wrapper"
  style="padding-left:{TICK_WIDTH}px; padding-top:{paddingTop}px; padding-bottom:{paddingBottom}px; padding-right:{hasOuterSuperscript ? 8 : 0}px;"
>
  <!-- SVG overlaid on top, anchored to wrapper -->
  {@html svgMarkup}

  <!-- Index sits top-left, before the tick -->
  {#if index}
    <span class="sqrt-index">
      {#if typeof index === 'function'}
        {@render index()}
      {:else}
        {index}
      {/if}
    </span>
  {/if}

  <!-- Slot content — anything goes here -->
  <span bind:this={contentEl} class="sqrt-inner">
    {#if children}
      {@render children()}
    {/if}
  </span>
</span>

<style>
  .sqrt-wrapper {
    display: inline-flex;
    align-items: center;
    position: relative;
    box-sizing: border-box;
    vertical-align: middle;
  }
  .sqrt-inner {
    display: inline-flex;
    align-items: center;
  }
  .sqrt-index {
    position: absolute;
    top: 0;
    left: 0;
    font-size: 0.65em;
    line-height: 1;
  }
  :global(.sqrt-inner sup) {
    top: -1.3em !important;
  }
</style>
