<script lang="ts">
  import { ChevronLeft, Search, Filter, BookOpen, Clock, Calendar, GraduationCap } from 'lucide-svelte';
  import { MOCK_EXAMS, type Exam } from '../types';

  let { onback, onselectexam } = $props<{
    onback?: () => void;
    onselectexam?: (exam: Exam) => void;
  }>();
</script>

<div class="h-full bg-cream flex flex-col overflow-hidden">
  <header class="px-6 py-4 flex items-center gap-4 bg-paper border-b border-black/5 sticky top-0 z-10 shadow-sm">
    <button onclick={() => onback?.()} class="p-2 -ml-2 text-sage bg-transparent border-none cursor-pointer hover:text-olive transition-colors">
      <ChevronLeft size={24} />
    </button>
    <h2 class="text-sm font-bold text-ink uppercase tracking-widest">Exam Catalogue</h2>
  </header>

  <div class="p-4 bg-paper/50 backdrop-blur-md border-b border-black/5">
    <div class="relative">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-sage" size={16} />
      <input 
        type="text" 
        placeholder="Search UNEB, IGCSE, KCSE..." 
        class="w-full bg-cream border border-sage/10 rounded-[20px] py-3 pl-10 pr-4 text-[11px] font-bold uppercase tracking-widest placeholder:text-sage focus:ring-1 focus:ring-olive transition-all"
      />
    </div>
  </div>

  <div class="flex-1 overflow-y-auto px-6 py-6 space-y-8 pb-24">
    <!-- Featured Boards -->
    <section>
      <h3 class="text-[10px] font-bold text-sage uppercase tracking-[0.2em] mb-4">Top Examination Boards</h3>
      <div class="flex gap-3 overflow-x-auto no-scrollbar -mx-2 px-2">
        {#each ['UNEB', 'CIE', 'KNEC', 'JAMB'] as board}
          <button class="bg-paper cursor-pointer border border-sage/10 px-4 py-3 rounded-[20px] min-w-[100px] flex flex-col items-center gap-2 hover:border-olive transition-all">
            <div class="w-8 h-8 rounded-full bg-olive/10 flex items-center justify-center text-olive font-bold text-[10px]">
              {board[0]}
            </div>
            <span class="text-[10px] font-extrabold text-ink">{board}</span>
          </button>
        {/each}
      </div>
    </section>

    <!-- Papers List -->
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-[10px] font-bold text-sage uppercase tracking-[0.2em]">Latest Past Papers</h3>
        <button class="p-2 text-sage bg-transparent cursor-pointer border-none hover:text-olive">
          <Filter size={16} />
        </button>
      </div>

      {#each MOCK_EXAMS as exam (exam.id)}
        <button
          onclick={() => onselectexam?.(exam)}
          class="w-full bg-paper cursor-pointer border border-sage/10 rounded-[20px] p-5 text-left hover:shadow-sm transition-all"
        >
          <div class="flex justify-between items-start mb-4">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="bg-olive/10 text-olive text-[8px] font-bold px-2 py-0.5 rounded-full border border-olive/5 uppercase tracking-widest">
                  {exam.board}
                </span>
                <span class="text-[10px] text-sage font-bold">{exam.year}</span>
              </div>
              <h4 class="text-lg font-bold text-ink">{exam.subject} {exam.title}</h4>
            </div>
            <div class="w-10 h-10 rounded-[20px] bg-cream flex items-center justify-center text-olive border border-sage/10">
              <BookOpen size={20} />
            </div>
          </div>

          <div class="flex items-center gap-4 pt-4 border-t border-black/5">
            <div class="flex items-center gap-1.5 text-sage">
              <Clock size={12} />
              <span class="text-[9px] font-bold uppercase tracking-widest">{exam.durationMinutes} Mins</span>
            </div>
            <div class="flex items-center gap-1.5 text-sage">
              <GraduationCap size={12} />
              <span class="text-[9px] font-bold uppercase tracking-widest">{exam?.questions?.length || 10} Questions</span>
            </div>
            <span class="ml-auto text-accent text-[9px] font-bold uppercase tracking-[0.1em] border-b border-accent/20">Sit for Exam →</span>
          </div>
        </button>
      {/each}
    </section>
  </div>
</div>
