<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';

  let {
    children,
    label = null
  } = $props<{
    children?: any;
    label?: any;
  }>();

  let contentEl: HTMLSpanElement | null = null;
  let width = $state(0);
  let svgPath = $state('');
  let observer: ResizeObserver | null = null;
  let frameId: number | null = null;

  function measure() {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
    }
    frameId = requestAnimationFrame(() => {
      if (!contentEl) return;
      const rect = contentEl.getBoundingClientRect();
      width = Math.max(16, rect.width);
      if (width > 0) {
        const r = Math.min(6, width / 4);
        svgPath = `M 0 0 
          Q 0 8, ${r} 8
          L ${width/2 - r} 8 
          Q ${width/2} 8, ${width/2} 14 
          Q ${width/2} 8, ${width/2 + r} 8 
          L ${width - r} 8 
          Q ${width} 8, ${width} 0`;
      }
    });
  }

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

<span class="underbrace-container">
  <span bind:this={contentEl} class="underbrace-content">
    {#if children}
      {@render children()}
    {/if}
  </span>
  <svg class="underbrace-svg" width={width} height="16" style="display: block; margin: 0 0 1px 0;">
    <path d={svgPath} fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
  <span class="underbrace-label-wrapper">
    {#if label}
      {@render label()}
    {/if}
  </span>
</span>

<style>
  .underbrace-container {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    vertical-align: middle;
    margin: 0 4px;
    position: relative;
  }
  .underbrace-content {
    display: inline-block;
    white-space: nowrap;
    text-align: center;
  }
  .underbrace-svg {
    overflow: visible;
  }
  .underbrace-label-wrapper {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    min-height: 1.1em;
    font-size: 0.72em;
    text-align: center;
    line-height: 1.1;
  }
</style>
