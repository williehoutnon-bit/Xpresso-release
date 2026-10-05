<script lang="ts">
  import { ChevronLeft, Users, ChevronRight } from 'lucide-svelte';

  let { onback, onopenclass } = $props<{ onback?: () => void, onopenclass?: () => void }>();

  const classes = [
    { id: 1, subject: 'UCE Biology', teacher: 'Mr. Kato', level: 'S.4', icon: '🧬', students: 45 },
    { id: 2, subject: 'UCE Physics', teacher: 'Ms. Namaganda', level: 'S.4', icon: '⚡', students: 42 },
    { id: 3, subject: 'UCE Mathematics', teacher: 'Mr. Ochieng', level: 'S.4', icon: '📐', students: 50 },
    { id: 4, subject: 'UCE Chemistry', teacher: 'Dr. Akello', level: 'S.4', icon: '🧪', students: 38 },
  ];
</script>

<div class="h-full bg-cream flex flex-col overflow-y-auto pb-24">
  <header class="px-4 py-4 flex items-center justify-between sticky top-0 bg-paper/80 backdrop-blur-md z-10 border-b border-black/5">
    <button onclick={() => onback?.()} class="p-2 -ml-2 text-sage bg-transparent cursor-pointer border-none hover:text-olive transition-colors flex items-center justify-center w-10 h-10 bg-theme-card rounded-[20px] shadow-sm border border-sage/10">
      <ChevronLeft size={20} />
    </button>
    <h2 class="text-sm font-bold text-ink uppercase tracking-widest">My Classes</h2>
    <div class="w-10"></div>
  </header>

  <div class="p-6 space-y-4 w-full">
    {#each classes as cls (cls.id)}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div onclick={() => onopenclass?.()} class="bg-theme-card p-5 rounded-[20px] border border-sage/10 shadow-sm cursor-pointer hover:border-olive transition-colors group">
      <div class="flex items-start justify-between mb-3 text-left">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-[20px] bg-olive/10 flex items-center justify-center text-xl shrink-0 group-hover:bg-olive/20 transition-colors">
            {cls.icon}
          </div>
          <div>
            <h3 class="font-bold text-ink text-sm">{cls.subject}</h3>
            <p class="text-xs text-sage">{cls.teacher}</p>
          </div>
        </div>
        <span class="text-[10px] font-bold uppercase tracking-widest bg-sage/10 px-2 py-1 rounded-[20px] text-sage">
          {cls.level}
        </span>
      </div>
      
      <div class="flex items-center justify-between text-[11px] text-sage pt-3 border-t border-sage/10">
        <span class="flex items-center gap-1"><Users size={12} /> {cls.students} students</span>
        <span class="flex items-center gap-1 text-olive font-bold">Open Class <ChevronRight size={12} /></span>
      </div>
    </div>
    {/each}
  </div>
</div>
