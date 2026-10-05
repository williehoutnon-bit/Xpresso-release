<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { generateLongdivSVG } from '../utils/longdivSVG';

  const TICK_WIDTH = 10; // must match the value in longdivSVG.ts

  let {
    index = null,
    children,
    quotient = null,
    hasSuperscript = false,
    hasOuterSuperscript = false
  } = $props<{
    index?: any;
    children?: any;
    quotient?: any;
    hasSuperscript?: boolean;
    hasOuterSuperscript?: boolean;
  }>();

  const PAD = $derived(hasSuperscript ? 11 : 2);
  const CONTENT_GAP = 2;
  const paddingTop = $derived(PAD + CONTENT_GAP);
  const paddingBottom = 2;

  let contentEl: HTMLSpanElement | null = null;
  let wrapperEl: HTMLSpanElement | null = null;
  let svgMarkup = $state(generateLongdivSVG(14, 20, hasSuperscript, hasOuterSuperscript));
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
      svgMarkup = generateLongdivSVG(rect.width, rect.height, hasSuperscript, hasOuterSuperscript);
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
<span bind:this={wrapperEl} class="longdiv-wrapper">
  {#if index}
    <span class="longdiv-index">
      {#if typeof index === 'function'}
        {@render index()}
      {:else}
        {index}
      {/if}
    </span>
  {/if}
  <span class="longdiv-stack">
    {#if quotient}
      <span class="longdiv-quotient" style="padding-left:{TICK_WIDTH}px;">
        {#if typeof quotient === 'function'}
          {@render quotient()}
        {:else}
          {quotient}
        {/if}
      </span>
    {/if}
    <span 
      class="longdiv-bracket-container"
      style="padding-left:{TICK_WIDTH}px; padding-top:{paddingTop}px; padding-bottom:{paddingBottom}px; padding-right:{hasOuterSuperscript ? 8 : 0}px;">
      <!-- SVG overlaid on top, anchored to wrapper -->
      {@html svgMarkup}
      
      <!-- Slot content — anything goes here -->
      <span bind:this={contentEl} class="longdiv-inner">
        {#if children}
          {@render children()}
        {/if}
      </span>
    </span>
  </span>
</span>

<style>
  .longdiv-wrapper {
    display: inline-flex;
    align-items: center;
    vertical-align: middle;
  }
  .longdiv-stack {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
  }
  .longdiv-quotient {
    font-family: 'Kalam', sans-serif;
    line-height: 1;
    white-space: nowrap;
    margin-bottom: 1px;
  }
  .longdiv-bracket-container {
    display: inline-flex;
    align-items: center;
    position: relative;
    box-sizing: border-box;
  }
  .longdiv-inner {
    display: inline-flex;
    align-items: center;
  }
  .longdiv-index {
    display: inline-flex;
    align-items: center;
    margin-right: 2px;
  }
  :global(.longdiv-inner sup) {
    top: -1.3em !important;
  }
</style>
