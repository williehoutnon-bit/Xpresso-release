<script lang="ts">
  import { ChevronLeft } from 'lucide-svelte';

  let { onback } = $props<{ onback?: () => void }>();

  const subjects = [
    { name: 'Biology', score: 68 },
    { name: 'Mathematics', score: 52 },
    { name: 'History', score: 75 },
    { name: 'Physics', score: 45 },
    { name: 'Chemistry', score: 24 },
    { name: 'Geography', score: 82 },
  ];
</script>

<div class="h-full bg-cream flex flex-col overflow-y-auto pb-24 relative">
  <header class="px-4 py-4 flex items-center justify-between sticky top-0 bg-theme-card/60 backdrop-blur-xl z-20 border-b border-black/5 shadow-sm">
    <button onclick={() => onback?.()} class="p-2 -ml-2 text-sage bg-theme-card/80 border border-white/50 cursor-pointer hover:text-olive transition-colors flex items-center justify-center w-10 h-10 rounded-[20px] shadow-sm">
      <ChevronLeft size={20} />
    </button>
    <h2 class="text-sm font-bold text-ink uppercase tracking-widest">My Progress</h2>
    <div class="w-10"></div>
  </header>

  <div class="px-5 py-6">
    <div class="bg-theme-card/60 backdrop-blur-xl rounded-[20px] border border-white/60 p-5 shadow-[0_4px_24px_rgba(0,0,0,0.04)] mb-6 text-center">
      <div class="text-4xl font-black text-olive mb-2">64%</div>
      <div class="text-[10px] text-sage font-bold uppercase tracking-widest">Overall Term Average</div>
    </div>

    <div class="space-y-4">
      {#each subjects as sub (sub.name)}
        <div class="bg-theme-card/60 backdrop-blur-xl p-5 rounded-[20px] border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
           <div class="flex justify-between items-center mb-3">
             <div class="font-bold text-ink text-sm">{sub.name}</div>
             <div class="font-black {sub.score >= 50 ? 'text-olive' : 'text-accent'}">{sub.score}%</div>
           </div>
           <div class="h-2 w-full bg-sage/10 rounded-full overflow-hidden">
             <div class="h-full rounded-full transition-all duration-1000 {sub.score >= 50 ? 'bg-olive' : 'bg-accent'}" style="width: {sub.score}%"></div>
           </div>
        </div>
      {/each}
    </div>
  </div>
</div>
