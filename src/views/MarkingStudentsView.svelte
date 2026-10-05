<script lang="ts">
  import { ChevronLeft, ChevronRight, Clock } from 'lucide-svelte';
  import { friendshipService } from '../services/friendshipService';
  import { onMount } from 'svelte';

  let { onback, onselectstudent } = $props<{
    onback?: () => void;
    onselectstudent?: (name: string) => void;
  }>();

  let activeTab = $state('answered');
  const tabs = [
    { id: 'answered', label: 'Answered' },
    { id: 'pending', label: 'Pending' }
  ];

  let students = $state<any[]>([]);

  onMount(async () => {
     try {
       const leader = await friendshipService.getLeaderboard(5);
       if (leader && leader.length > 0) {
          students = leader.map((u, i) => ({
             id: u.userId,
             name: u.name,
             status: i < 3 ? 'answered' : 'pending'
          }));
       } else {
          students = [
            { id: 1, name: 'Student One', status: 'answered' },
            { id: 2, name: 'Student Two', status: 'answered' },
            { id: 3, name: 'Student Three', status: 'pending' },
          ];
       }
     } catch (e) {
       console.error('Failed to load students for marking view');
     }
  });

  let currentStudents = $derived(students.filter(s => s.status === activeTab));
</script>

<div class="h-full bg-cream flex flex-col overflow-y-auto pb-24 relative">
  <header class="px-4 py-4 flex items-center justify-between sticky top-0 bg-paper/80 backdrop-blur-md z-10 border-b border-black/5">
    <button onclick={() => onback?.()} class="p-2 -ml-2 text-sage bg-theme-card border border-sage/10 cursor-pointer hover:text-olive transition-colors flex items-center justify-center w-10 h-10 rounded-[20px] shadow-sm">
      <ChevronLeft size={20} />
    </button>
    <h2 class="text-sm font-bold text-ink uppercase tracking-widest">Marking Hub</h2>
    <div class="w-10"></div>
  </header>

  <div class="px-6 py-4">
    <div class="flex p-1 bg-sage/5 rounded-[20px] mb-6">
      {#each tabs as tab (tab.id)}
        <button 
          onclick={() => activeTab = tab.id}
          class="flex-1 py-3 bg-transparent border-none cursor-pointer text-xs font-bold uppercase tracking-widest rounded-[20px] transition-all {activeTab === tab.id ? 'bg-theme-card text-ink shadow-[0_2px_8px_rgba(0,0,0,0.04)]' : 'text-sage hover:text-ink'}"
        >
          {tab.label}
        </button>
      {/each}
    </div>

    <div class="space-y-3">
      {#each currentStudents as student (student.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div 
          onclick={() => student.status === 'answered' ? onselectstudent?.(student.name) : null}
          class="bg-theme-card p-4 rounded-[20px] border border-sage/10 flex items-center justify-between shadow-sm transition-colors {student.status === 'answered' ? 'cursor-pointer hover:border-olive group' : 'opacity-75'}"
        >
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-[20px] bg-cream flex items-center justify-center text-lg font-bold text-olive border border-sage/10">
              {student.name.charAt(0)}
            </div>
            <div>
              <h3 class="font-bold text-ink text-sm">{student.name}</h3>
              <p class="text-[10px] font-bold uppercase tracking-widest mt-1 {student.status === 'answered' ? 'text-accent' : 'text-sage'}">
                {student.status === 'answered' ? '1 New Submission' : 'Pending Submission'}
              </p>
            </div>
          </div>
          {#if student.status === 'answered'}
            <ChevronRight size={20} class="text-sage group-hover:text-olive" />
          {:else}
            <Clock size={16} class="text-sage/50" />
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>
