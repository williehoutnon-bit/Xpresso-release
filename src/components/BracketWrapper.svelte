<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { generateBracketSVG } from '../utils/bracketSVG';

  export let type: 'round' | 'square' | 'absolute' | 'curly' | 'evaluation' = 'round';
  export let closed = true;
  
  let contentEl: HTMLSpanElement | null = null;
  let leftSVG = '';
  let rightSVG = '';
  let observer: ResizeObserver | null = null;

  let frameId: number | null = null;

  function measure() {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
    }
    frameId = requestAnimationFrame(() => {
      if (!contentEl) return;
      const height = contentEl.getBoundingClientRect().height;
      if (height > 0) {
        if (type === 'evaluation') {
          leftSVG = '';
          rightSVG = generateBracketSVG(height, 'evaluation', 'right');
        } else {
          leftSVG = generateBracketSVG(height, type, 'left');
          rightSVG = generateBracketSVG(height, type, 'right');
        }
      }
    });
  }

  $: if (type !== undefined || closed !== undefined) {
    measure();
  }

  onMount(async () => {
    await tick(); // let the slot content render first
    measure();
    // Re-measure whenever the content changes size
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

<span class="bracket-expression">
  {@html leftSVG}
  <span bind:this={contentEl} class="bracket-inner">
    <slot />
  </span>
  {#if closed}
    {@html rightSVG}
  {/if}
</span>

<style>
  .bracket-expression {
    display: inline-flex;
    align-items: center;
    gap: 1px;
    vertical-align: middle;
  }
  .bracket-expression :global(svg) {
    align-self: center;
  }
  .bracket-inner {
    display: inline-block;
    vertical-align: middle;
  }
</style>
