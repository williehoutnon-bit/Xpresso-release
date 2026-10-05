<script lang="ts">
  import { ChevronLeft, ChevronRight, ClipboardCheck } from 'lucide-svelte';

  let { studentName = '', onback, onselectmarkingexam } = $props<{
    studentName?: string;
    onback?: () => void;
    onselectmarkingexam?: (item: any) => void;
  }>();

  const items = [
    { id: 1, title: 'UCE Biology Paper 2 - Section A', type: 'Exam', submittedAt: '2h ago', questionCount: 4 },
    { id: 2, title: 'What is photosynthesis?', type: 'Daily Question', submittedAt: '1d ago', questionCount: 1 },
  ];
</script>

<div class="h-full bg-cream flex flex-col overflow-y-auto pb-24 relative">
  <header class="px-4 py-4 flex items-center justify-between sticky top-0 bg-paper/80 backdrop-blur-md z-10 border-b border-black/5">
    <button onclick={() => onback?.()} class="p-2 -ml-2 text-sage bg-theme-card border-sage/10 border cursor-pointer hover:text-olive transition-colors flex items-center justify-center w-10 h-10 rounded-[20px] shadow-sm">
      <ChevronLeft size={20} />
    </button>
    <h2 class="text-sm font-bold text-ink uppercase tracking-widest">{studentName}'s Work</h2>
    <div class="w-10"></div>
  </header>

  <div class="px-6 py-4 space-y-4">
    {#each items as item (item.id)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div onclick={() => onselectmarkingexam?.(item)} class="bg-theme-card p-5 rounded-[20px] border border-sage/10 shadow-sm cursor-pointer hover:border-olive transition-colors group">
        <div class="flex items-start justify-between mb-3">
          <div>
            <h3 class="font-bold text-ink text-sm leading-tight">{item.title}</h3>
            <p class="text-[10px] text-sage font-bold uppercase tracking-widest mt-1">{item.type} · Submitted {item.submittedAt}</p>
          </div>
          <div class="p-2 bg-accent/10 text-accent rounded-[20px]">
            <ClipboardCheck size={16} />
          </div>
        </div>
        <div class="pt-3 border-t border-sage/10 flex items-center justify-between">
           <span class="text-[11px] font-medium text-sage">{item.questionCount} Questions</span>
           <span class="text-[11px] font-bold text-olive flex items-center gap-1 group-hover:gap-2 transition-all">Start Marking <ChevronRight size={12} /></span>
        </div>
      </div>
    {/each}
  </div>
</div>
