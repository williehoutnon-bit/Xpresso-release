<script lang="ts">
  import { ChevronLeft, Pin } from 'lucide-svelte';

  let { onback } = $props<{ onback?: () => void }>();

  const newsItems = [
    {
      title: "Registration for UNEB 2026 Exams Opens",
      content: "The registration for the 2026 Uganda National Examinations Board (UNEB) exams for UCE and UACE candidates is now officially open. All students are advised to clear their school dues to finalize their registration before the deadline on July 31st.",
      pinned: true,
      important: true
    },
    {
      title: "Introducing New Competence-Based Learning Modules",
      content: "We have just updated the curriculum modules for Biology and Physics to align with the new competence-based curriculum. Check out the new interactive notes section.",
      pinned: false,
      important: false
    },
    {
      title: "National Science Fair Winners Announced",
      content: "Congratulations to Gayaza High School for winning the grand prize at this year's National Science Fair. Their project on renewable energy solutions stood out among 150 participants.",
      pinned: false,
      important: false
    },
    {
      title: "Upcoming App Maintenance",
      content: "Please be informed that the app will undergo scheduled maintenance this Sunday from 2:00 AM to 5:00 AM EAT. During this time, access to mock exams will be temporarily suspended.",
      pinned: false,
      important: true
    }
  ];
</script>

<div class="h-full bg-cream flex flex-col overflow-y-auto pb-24">
  <header class="px-4 py-4 flex items-center justify-between sticky top-0 bg-paper/80 backdrop-blur-md z-10 border-b border-black/5">
    <button onclick={() => onback?.()} class="p-2 -ml-2 text-sage bg-theme-card border border-sage/10 cursor-pointer hover:text-olive transition-colors flex items-center justify-center w-10 h-10 rounded-[20px] shadow-sm">
      <ChevronLeft size={20} />
    </button>
    <h2 class="text-sm font-bold text-ink uppercase tracking-widest">News & Updates</h2>
    <div class="w-10"></div>
  </header>

  <div class="p-6 space-y-4">
    {#each newsItems as item, index}
      <div class="bg-theme-card p-5 rounded-[20px] border border-sage/10 shadow-sm relative overflow-hidden group">
        {#if item.pinned}
          <div class="absolute top-0 right-0 bg-accent text-white text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-bl-xl shadow-sm z-10 flex items-center gap-1">
            <Pin size={10} /> Pinned
          </div>
        {/if}
        
        {#if item.important}
          <div class="absolute -left-1 -top-1 w-3 h-3 bg-accent rounded-full border-2 border-white shadow-sm"></div>
        {/if}

        <h3 class="font-bold text-ink text-sm mb-2 pr-12">{item.title}</h3>
        <p class="text-sm text-sage leading-relaxed break-words whitespace-pre-line">{item.content}</p>
      </div>
    {/each}
  </div>
</div>
