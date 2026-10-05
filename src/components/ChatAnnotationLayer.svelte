<script lang="ts">
  import { onMount } from 'svelte';
  import type { StrokeElement } from '../types/ink';

  export let isActive = false;
  export let containerEl: HTMLElement | null = null;
  export let strokes: StrokeElement[] = [];
  export let onStrokeCommitted: ((stroke: StrokeElement) => void) | null = null;

  let svgEl: SVGSVGElement | null = null;
  let width = 1;
  let height = 1;
  let active: { points: { x: number; y: number }[]; targetId?: string; targetRect?: DOMRect; color: string; width: number } | null = null;
  let livePath = '';

  const point = (e: PointerEvent) => {
    const r = svgEl?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };

  const pathFor = (points: { x: number; y: number }[]) => points.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  function measure() {
    const r = containerEl?.getBoundingClientRect();
    if (r) { width = Math.max(1, r.width); height = Math.max(1, r.height); }
  }

  function resolveTarget(e: PointerEvent) {
    if (!svgEl) return null;
    const previous = svgEl.style.pointerEvents;
    svgEl.style.pointerEvents = 'none';
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    svgEl.style.pointerEvents = previous;
    const bubble = el?.closest<HTMLElement>('[data-message-id]');
    return bubble ? { id: bubble.dataset.messageId!, rect: bubble.getBoundingClientRect() } : null;
  }

  function down(e: PointerEvent) {
    if (!isActive || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    e.stopPropagation();
    svgEl?.setPointerCapture(e.pointerId);
    const target = resolveTarget(e);
    active = { points: [point(e)], targetId: target?.id, targetRect: target?.rect, color: '#1d4ed8', width: 2.5 };
    livePath = pathFor(active.points);
  }

  function move(e: PointerEvent) {
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();
    active.points = [...active.points, point(e)];
    livePath = pathFor(active.points);
  }

  function up(e: PointerEvent) {
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();
    const current = active;
    active = null;
    livePath = '';
    if (current.points.length < 2) return;
    const target = current.targetRect;
    const points = target
      ? current.points.map(p => ({ x: (p.x + (svgEl?.getBoundingClientRect().left ?? 0) - target.left) / Math.max(target.width, 1), y: (p.y + (svgEl?.getBoundingClientRect().top ?? 0) - target.top) / Math.max(target.height, 1) }))
      : current.points.map(p => ({ x: p.x / width, y: p.y / height }));
    const stroke: StrokeElement = {
      id: crypto.randomUUID(), path: pathFor(current.points), points, color: current.color, width: current.width,
      targetMessageId: current.targetId, coordSpace: target ? 'normalized-message-bubble-v1' : 'normalized-chat-v1',
      containerWidth: target?.width ?? width, containerHeight: target?.height ?? height,
      createdAt: Date.now()
    };
    onStrokeCommitted?.(stroke);
  }

  onMount(() => {
    measure();
    const observer = containerEl && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (containerEl) observer?.observe(containerEl);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  });
</script>

<svg bind:this={svgEl} class="absolute inset-0 z-40 w-full h-full touch-none" style:pointer-events={isActive ? 'auto' : 'none'} onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={() => { active = null; livePath = ''; }} aria-hidden="true">
  {#each strokes as stroke}
    {@const target = stroke.targetMessageId ? document.getElementById(`msg-${stroke.targetMessageId}`) : null}
    {@const targetRect = target?.getBoundingClientRect()}
    {@const svgRect = svgEl?.getBoundingClientRect()}
    {@const rendered = targetRect && svgRect ? (stroke.points ?? []).map((p: any) => ({ x: targetRect.left - svgRect.left + (p.x ?? 0) * targetRect.width, y: targetRect.top - svgRect.top + (p.y ?? 0) * targetRect.height })) : (stroke.points ?? []).map((p: any) => ({ x: (p.x ?? 0) * width, y: (p.y ?? 0) * height }))}
    <path d={pathFor(rendered)} fill="none" stroke={stroke.color} stroke-width={stroke.width} stroke-linecap="round" stroke-linejoin="round" />
  {/each}
  {#if livePath}<path d={livePath} fill="none" stroke="#1d4ed8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />{/if}
</svg>

<style>svg { overflow: visible; }</style>ისმგ
