<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';

  let contentEl: HTMLSpanElement | null = null;
  let height = 24; // default height

  // SVG paths for integral
  let svgPath = '';
  $: w = Math.max(12, height * 0.25);
  $: {
    const topOffset = 2;
    const bottomOffset = 2;
    // Slanted integral curve ∫
    svgPath = `M ${w * 0.8} ${topOffset + 1}
               C ${w * 0.85} ${topOffset - 1}, ${w * 0.55} ${topOffset - 1}, ${w * 0.55} ${height * 0.25}
               C ${w * 0.55} ${height * 0.45}, ${w * 0.45} ${height * 0.55}, ${w * 0.45} ${height * 0.75}
               C ${w * 0.45} ${height - topOffset + 1}, ${w * 0.15} ${height - topOffset + 1}, ${w * 0.2} ${height - bottomOffset - 1}`;
  }

  $: integralSVG = `
    <svg xmlns="http://www.w3.org/2000/svg"
      width="${w}" height="${height}"
      style="display:block; overflow:visible;">
      <path d="${svgPath}"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round" />
    </svg>
  `;

  let observer: ResizeObserver;
  let frameId: number | null = null;

  function measure() {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
    }
    frameId = requestAnimationFrame(() => {
      if (contentEl) {
        const rect = contentEl.getBoundingClientRect();
        // Base minimum height so it always looks proportional
        let newHeight = Math.max(54, rect.height + 30);
        
        if (newHeight !== height) {
          height = newHeight;
        }
      }
    });
  }

  onMount(() => {
    observer = new ResizeObserver(measure);
    if (contentEl) {
      observer.observe(contentEl);
      // initial tick
      tick().then(measure);
    }
  });

  onDestroy(() => {
    if (observer) observer.disconnect();
    if (frameId !== null) cancelAnimationFrame(frameId);
  });
</script>

<span class="integral-expression">
  <span class="integral-symbol-wrapper" style="width: {w}px;">
    {@html integralSVG}
  </span>
  <slot name="limits" />
  <span bind:this={contentEl} class="integral-inner">
    <slot />
  </span>
</span>

<style>
  .integral-expression {
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
    line-height: 1;
    vertical-align: middle;
  }
  .integral-symbol-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
  .integral-inner {
    display: inline-flex;
    align-self: center;
    align-items: center;
    margin-left: 2px;
  }
</style>
