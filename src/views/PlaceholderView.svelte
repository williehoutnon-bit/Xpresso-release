<script lang="ts">
  let { viewName = '', onback } = $props<{
    viewName?: string;
    onback?: () => void;
  }>();
</script>

<div class="h-full flex flex-col items-center justify-center p-8 text-center bg-cream relative">
  <div class="mb-4 text-ink font-bold text-xl uppercase tracking-widest">
    {viewName}
  </div>
  <div class="text-sage mb-8">
    This view is currently being converted to Svelte.
  </div>
  <button onclick={() => onback?.()} class="px-6 py-3 bg-olive text-white cursor-pointer border-none rounded-[20px] font-bold uppercase tracking-widest text-xs hover:bg-olive/90 transition-colors">
    Go Back
  </button>
</div>
