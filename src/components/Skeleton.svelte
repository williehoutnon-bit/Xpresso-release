<script lang="ts">
  type SkeletonVariant = 'text' | 'circular' | 'avatar' | 'rectangular' | 'card' | 'conversation' | 'deckle' | 'list' | 'leaderboard' | 'notification' | 'stat' | 'profile';

  interface Props {
    variant?: SkeletonVariant;
    width?: string;
    height?: string;
    class?: string;
    count?: number;
    animate?: 'shimmer' | 'pulse' | 'none';
    seed?: string;
  }

  let {
    variant = 'text',
    width = '',
    height = '',
    class: customClass = '',
    count = 1,
    animate = 'shimmer',
    seed = 'xpresso-skel'
  }: Props = $props();

  function getTornClipPath(seedString: string): string {
    let hash = 0;
    for (let i = 0; i < seedString.length; i++) {
      hash = ((hash << 5) - hash) + seedString.charCodeAt(i);
      hash |= 0;
    }
    const rand = () => {
      hash = (hash * 9301 + 49297) % 233280;
      return hash / 233280;
    };

    const bottomPoints: string[] = ['100% 100%'];
    const steps = 60;
    const p1 = rand() * Math.PI * 2;
    const p2 = rand() * Math.PI * 2;
    const f1 = 25 + rand() * 10;
    const f2 = 50 + rand() * 15;

    for (let i = steps - 1; i >= 1; i--) {
      const t = i / steps;
      const x = t * 100;
      const wave = Math.sin(t * f1 * Math.PI + p1) * 0.5 + Math.sin(t * f2 * Math.PI + p2) * 0.3;
      const fluctuate = Math.max(0.4, Math.min(2.8, 1.6 + wave));
      bottomPoints.push(`${x.toFixed(1)}% calc(100% - ${fluctuate.toFixed(2)}px)`);
    }
    bottomPoints.push('0% 100%');
    return `polygon(0% 0px, 100% 0px, ${bottomPoints.join(', ')})`;
  }

  // Realistic randomized widths for multi-line text
  const textWidths = ['w-full', 'w-11/12', 'w-4/5', 'w-5/6', 'w-3/4', 'w-2/3', 'w-1/2'];
</script>

<div class="skeleton-root {customClass}" role="status" aria-busy="true" aria-label="Loading...">
  {#if variant === 'text'}
    <div class="flex flex-col gap-2.5 w-full">
      {#each Array(count) as _, i}
        <div 
          class="skeleton-shimmer h-3 {width ? width : (count > 1 && i === count - 1 ? 'w-2/3' : (width || 'w-full'))} rounded-md bg-ink/5 {animate === 'pulse' ? 'animate-pulse' : ''}"
          style="{height ? `height: ${height};` : ''}"
        ></div>
      {/each}
    </div>

  {:else if variant === 'circular' || variant === 'avatar'}
    <div 
      class="skeleton-shimmer shrink-0 rounded-full bg-ink/5 {width || 'w-10'} {height || 'h-10'} {animate === 'pulse' ? 'animate-pulse' : ''}"
      style="{width && !width.startsWith('w-') ? `width: ${width};` : ''} {height && !height.startsWith('h-') ? `height: ${height};` : ''}"
    ></div>

  {:else if variant === 'rectangular'}
    <div class="flex flex-col gap-3 w-full">
      {#each Array(count) as _}
        <div 
          class="skeleton-shimmer rounded-2xl bg-ink/5 {width || 'w-full'} {height || 'h-24'} {animate === 'pulse' ? 'animate-pulse' : ''}"
          style="{width && !width.startsWith('w-') ? `width: ${width};` : ''} {height && !height.startsWith('h-') ? `height: ${height};` : ''}"
        ></div>
      {/each}
    </div>

  {:else if variant === 'card'}
    <div class="space-y-4 w-full">
      {#each Array(count) as _}
        <div class="bg-theme-card/70 border border-theme-border/60 rounded-[24px] p-5 space-y-4 shadow-sm relative overflow-hidden">
          <div class="flex items-center gap-3">
            <div class="skeleton-shimmer w-11 h-11 rounded-full bg-ink/5 shrink-0"></div>
            <div class="space-y-2 flex-1">
              <div class="skeleton-shimmer h-3.5 w-32 bg-ink/5 rounded"></div>
              <div class="skeleton-shimmer h-2.5 w-20 bg-ink/5 rounded"></div>
            </div>
          </div>
          <div class="space-y-2 pt-1">
            <div class="skeleton-shimmer h-3 w-full bg-ink/5 rounded"></div>
            <div class="skeleton-shimmer h-3 w-5/6 bg-ink/5 rounded"></div>
            <div class="skeleton-shimmer h-3 w-2/3 bg-ink/5 rounded"></div>
          </div>
          <div class="flex gap-2 pt-2">
            <div class="skeleton-shimmer h-8 w-24 bg-ink/5 rounded-full"></div>
            <div class="skeleton-shimmer h-8 w-20 bg-ink/5 rounded-full"></div>
          </div>
        </div>
      {/each}
    </div>

  {:else if variant === 'conversation' || variant === 'deckle'}
    <div class="space-y-3.5 w-full">
      {#each Array(count) as _, i}
        <div 
          class="bg-white border-l-2 border-dashed border-slate-300 border-r border-black/5 py-3.5 px-4 flex items-center gap-3.5 relative overflow-hidden shadow-sm transition-all w-[90%] mx-auto"
          style="clip-path: {getTornClipPath(`${seed}-${i}`)};"
        >
          <div class="skeleton-shimmer w-12 h-12 rounded-full bg-ink/5 shrink-0"></div>
          <div class="flex-1 min-w-0 space-y-2">
            <div class="flex items-center justify-between gap-2">
              <div class="skeleton-shimmer h-3.5 {i % 2 === 0 ? 'w-28' : 'w-36'} bg-ink/5 rounded"></div>
              <div class="skeleton-shimmer h-2.5 w-12 bg-ink/5 rounded"></div>
            </div>
            <div class="skeleton-shimmer h-3 {i % 3 === 0 ? 'w-3/4' : 'w-1/2'} bg-ink/5 rounded"></div>
          </div>
        </div>
      {/each}
    </div>

  {:else if variant === 'list'}
    <div class="space-y-2.5 w-full bg-paper/60 border border-theme-border/40 rounded-[20px] p-3">
      {#each Array(count) as _, i}
        <div class="flex items-center gap-3.5 py-2.5 px-2 {i !== count - 1 ? 'border-b border-theme-border/30' : ''}">
          <div class="skeleton-shimmer w-9 h-9 rounded-full bg-ink/5 shrink-0"></div>
          <div class="flex-1 space-y-1.5 min-w-0">
            <div class="skeleton-shimmer h-3 {textWidths[i % textWidths.length]} bg-ink/5 rounded"></div>
            <div class="skeleton-shimmer h-2 w-1/3 bg-ink/5 rounded"></div>
          </div>
        </div>
      {/each}
    </div>

  {:else if variant === 'leaderboard'}
    <div class="space-y-6 w-full">
      <!-- Top 3 Podium Skeleton -->
      <div class="grid grid-cols-3 gap-3 items-end pt-4 pb-2 px-2">
        <!-- 2nd Place -->
        <div class="flex flex-col items-center gap-2">
          <div class="skeleton-shimmer w-14 h-14 rounded-full bg-ink/5"></div>
          <div class="skeleton-shimmer h-2.5 w-16 bg-ink/5 rounded"></div>
          <div class="skeleton-shimmer h-2 w-10 bg-ink/5 rounded"></div>
          <div class="skeleton-shimmer w-full h-20 bg-ink/5 rounded-t-xl"></div>
        </div>
        <!-- 1st Place -->
        <div class="flex flex-col items-center gap-2 -mt-4">
          <div class="skeleton-shimmer w-16 h-16 rounded-full bg-accent/10 border-2 border-accent/20"></div>
          <div class="skeleton-shimmer h-3 w-20 bg-ink/5 rounded"></div>
          <div class="skeleton-shimmer h-2 w-12 bg-ink/5 rounded"></div>
          <div class="skeleton-shimmer w-full h-28 bg-accent/10 rounded-t-xl"></div>
        </div>
        <!-- 3rd Place -->
        <div class="flex flex-col items-center gap-2">
          <div class="skeleton-shimmer w-14 h-14 rounded-full bg-ink/5"></div>
          <div class="skeleton-shimmer h-2.5 w-16 bg-ink/5 rounded"></div>
          <div class="skeleton-shimmer h-2 w-10 bg-ink/5 rounded"></div>
          <div class="skeleton-shimmer w-full h-16 bg-ink/5 rounded-t-xl"></div>
        </div>
      </div>

      <!-- Ranked List Skeletons -->
      <div class="space-y-2 bg-paper rounded-[20px] p-4 border border-theme-border/40 shadow-sm">
        {#each Array(count || 4) as _, idx}
          <div class="flex items-center gap-3 py-3 {idx !== (count || 4) - 1 ? 'border-b border-theme-border/30' : ''}">
            <div class="skeleton-shimmer w-5 h-4 bg-ink/5 rounded"></div>
            <div class="skeleton-shimmer w-9 h-9 rounded-full bg-ink/5 shrink-0"></div>
            <div class="flex-1 space-y-1.5">
              <div class="skeleton-shimmer h-3 w-32 bg-ink/5 rounded"></div>
              <div class="skeleton-shimmer h-2 w-20 bg-ink/5 rounded"></div>
            </div>
            <div class="skeleton-shimmer h-3 w-12 bg-ink/5 rounded"></div>
          </div>
        {/each}
      </div>
    </div>

  {:else if variant === 'notification'}
    <div class="space-y-3 w-full">
      {#each Array(count) as _}
        <div class="bg-theme-card/80 border border-theme-border/60 rounded-[24px] p-4 shadow-sm space-y-3">
          <div class="flex items-center gap-3">
            <div class="skeleton-shimmer w-12 h-12 rounded-full bg-ink/5 shrink-0"></div>
            <div class="flex-1 space-y-1.5 min-w-0">
              <div class="skeleton-shimmer h-3.5 w-28 bg-ink/5 rounded"></div>
              <div class="skeleton-shimmer h-2.5 w-36 bg-ink/5 rounded"></div>
            </div>
          </div>
          <div class="flex gap-2 pt-1">
            <div class="skeleton-shimmer h-8 flex-1 bg-ink/5 rounded-full"></div>
            <div class="skeleton-shimmer h-8 flex-1 bg-ink/5 rounded-full"></div>
          </div>
        </div>
      {/each}
    </div>

  {:else if variant === 'stat'}
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
      {#each Array(count || 3) as _}
        <div class="bg-theme-card/70 border border-theme-border/50 rounded-2xl p-4 space-y-2 shadow-sm">
          <div class="skeleton-shimmer w-8 h-8 rounded-lg bg-ink/5"></div>
          <div class="skeleton-shimmer h-6 w-16 bg-ink/5 rounded"></div>
          <div class="skeleton-shimmer h-2.5 w-24 bg-ink/5 rounded"></div>
        </div>
      {/each}
    </div>

  {:else if variant === 'profile'}
    <div class="space-y-6 w-full">
      <!-- Profile Header Skeleton -->
      <div class="bg-theme-card/80 border border-theme-border/60 rounded-[28px] p-6 text-center space-y-4 shadow-sm">
        <div class="skeleton-shimmer w-24 h-24 rounded-full bg-ink/5 mx-auto"></div>
        <div class="space-y-2 flex flex-col items-center">
          <div class="skeleton-shimmer h-5 w-40 bg-ink/5 rounded"></div>
          <div class="skeleton-shimmer h-3 w-28 bg-ink/5 rounded"></div>
        </div>
        <div class="flex justify-center gap-6 pt-2">
          <div class="space-y-1 text-center">
            <div class="skeleton-shimmer h-4 w-12 bg-ink/5 rounded mx-auto"></div>
            <div class="skeleton-shimmer h-2 w-14 bg-ink/5 rounded"></div>
          </div>
          <div class="space-y-1 text-center">
            <div class="skeleton-shimmer h-4 w-12 bg-ink/5 rounded mx-auto"></div>
            <div class="skeleton-shimmer h-2 w-14 bg-ink/5 rounded"></div>
          </div>
          <div class="space-y-1 text-center">
            <div class="skeleton-shimmer h-4 w-12 bg-ink/5 rounded mx-auto"></div>
            <div class="skeleton-shimmer h-2 w-14 bg-ink/5 rounded"></div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .skeleton-root {
    display: block;
    width: 100%;
  }

  .skeleton-shimmer {
    position: relative;
    overflow: hidden;
    background-color: rgba(14, 42, 71, 0.06);
  }

  .skeleton-shimmer::after {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    transform: translateX(-100%);
    background-image: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0) 0,
      rgba(255, 255, 255, 0.35) 20%,
      rgba(255, 255, 255, 0.6) 50%,
      rgba(255, 255, 255, 0.35) 80%,
      rgba(255, 255, 255, 0) 100%
    );
    animation: skeleton-shimmer-sweep 1.8s infinite ease-in-out;
    content: '';
  }

  @keyframes skeleton-shimmer-sweep {
    100% {
      transform: translateX(100%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton-shimmer::after {
      animation: none;
    }
  }
</style>
