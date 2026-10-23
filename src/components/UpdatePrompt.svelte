<script lang="ts">
  import { nativeUpdateState, startNativeUpdate, dismissNativeUpdate } from '../services/nativeUpdateService';

  const s = $derived($nativeUpdateState);
  const visible = $derived(s.phase !== 'idle' && !s.dismissed);
  const sizeLabel = $derived(
    s.offer?.size ? ` (${(s.offer.size / 1048576).toFixed(1)} MB)` : ''
  );
  const busy = $derived(s.phase === 'downloading' || s.phase === 'installing');
</script>

{#if visible}
  <div
    class="fixed inset-x-0 top-0 z-[9990] px-3 pointer-events-none"
    style="padding-top: max(0.5rem, env(safe-area-inset-top));"
  >
    <div
      class="pointer-events-auto mx-auto max-w-md rounded-2xl bg-white border border-gray-200 shadow-xl p-4 flex flex-col gap-3"
      role="status"
      aria-live="polite"
    >
      <div class="flex flex-col gap-1">
        <p class="text-[#202936] text-sm font-extrabold">
          {#if s.phase === 'manual'}Install the latest Xpresso
          {:else if s.phase === 'error'}Update failed
          {:else}Update available{/if}
        </p>

        {#if s.phase === 'available'}
          <p class="text-[#4B5563] text-sm">
            Version {s.offer?.version}{sizeLabel} has new features that need an app update. Your data is kept.
          </p>
        {/if}
        {#if s.message}
          <p class="text-[#4B5563] text-sm">{s.message}</p>
        {/if}

        {#if s.phase === 'downloading'}
          <div class="mt-1 h-2 w-full rounded-full bg-[#DDE5EC] overflow-hidden" aria-hidden="true">
            <div class="h-full bg-[#0050D8] transition-all duration-150" style="width: {s.progress}%"></div>
          </div>
          <p class="text-[#4B5563] text-xs">Downloading… {s.progress}%</p>
        {/if}
      </div>

      {#if !busy}
        <div class="flex gap-2">
          {#if s.phase !== 'manual'}
            <button
              class="flex-1 py-2.5 rounded-xl bg-[#0050D8] text-white text-sm font-bold active:scale-95 transition-transform"
              onclick={startNativeUpdate}
            >
              {#if s.phase === 'needs-permission'}Open settings
              {:else if s.phase === 'error'}Try again
              {:else}Update now{/if}
            </button>
          {/if}
          <button
            class="flex-1 py-2.5 rounded-xl bg-[#DDE5EC] text-[#202936] text-sm font-bold active:scale-95 transition-transform"
            onclick={dismissNativeUpdate}
          >Later</button>
        </div>
      {/if}
    </div>
  </div>
{/if}
