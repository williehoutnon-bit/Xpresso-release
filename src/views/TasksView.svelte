<script lang="ts">
  import { ChevronLeft, Clock, ChevronRight, BookOpen } from 'lucide-svelte';

  let { onback } = $props<{ onback?: () => void }>();

  let activeTab = $state('questions');
  let selectedTask = $state<any>(null);

  const tabs = [
    { id: 'questions', label: 'Questions' },
    { id: 'group', label: 'Group Work' }
  ];

  const tasks = [
    { id: 1, title: 'Describe the process of photosynthesis', subject: 'Biology', teacher: 'Mr. Kato', type: 'Question', due: 'Today, 8 PM', status: 'pending', category: 'questions', description: 'Write a comprehensive essay describing the light-dependent and light-independent stages of photosynthesis. Include relevant chemical equations.' },
    { id: 2, title: 'Solve quadratic equations worksheet', subject: 'Mathematics', teacher: 'Ms. Nabirye', type: 'Assignment', due: 'Tomorrow', status: 'pending', category: 'questions', description: 'Complete the 15 equations provided in the handout using the quadratic formula focusing on showing your working clearly.' },
    { id: 3, title: 'History of East Africa Essay', subject: 'History', teacher: 'Mr. Okello', type: 'Essay', due: '2 Days', status: 'done', category: 'questions' },
    { id: 4, title: 'Science Fair Project Draft', subject: 'Physics', teacher: 'Dr. Musa', type: 'Project', due: 'Next Week', status: 'pending', category: 'group' },
    { id: 5, title: 'Group 4: Ecosystems Presentation', subject: 'Biology', teacher: 'Mr. Kato', type: 'Presentation', due: 'Friday', status: 'pending', category: 'group' }
  ];

  const currentTasks = $derived(tasks.filter(t => t.category === activeTab));

  const getBadgeClass = (type: string) => {
    if (type === 'Question') return 'bg-accent/10 text-accent';
    if (type === 'Project' || type === 'Presentation') return 'bg-purple-100 text-purple-600';
    return 'bg-olive/10 text-olive';
  };
</script>

<div class="h-full bg-cream flex flex-col overflow-y-auto pb-24 relative">
  <header class="px-4 py-4 flex items-center justify-between sticky top-0 bg-theme-card/60 backdrop-blur-xl z-20 border-b border-black/5 shadow-sm">
    <button onclick={() => selectedTask ? selectedTask = null : onback?.()} class="p-2 -ml-2 text-sage bg-transparent cursor-pointer hover:text-olive transition-colors flex items-center justify-center w-10 h-10 bg-theme-card/80 rounded-[20px] shadow-sm border border-white/50">
      <ChevronLeft size={20} />
    </button>
    <h2 class="text-sm font-bold text-ink uppercase tracking-widest">{selectedTask ? 'Task Details' : 'My Tasks'}</h2>
    <div class="w-10"></div>
  </header>

  {#if !selectedTask}
  <div class="px-5 py-4">
    <div class="flex p-1 bg-sage/10 rounded-[20px] mb-6 shadow-inner backdrop-blur-sm">
      {#each tabs as tab}
      <button 
        onclick={() => activeTab = tab.id}
        class="flex-1 py-3 text-xs bg-transparent border-none cursor-pointer font-bold uppercase tracking-widest rounded-[20px] transition-all {activeTab === tab.id ? 'bg-theme-card text-ink shadow-[0_2px_8px_rgba(0,0,0,0.08)]' : 'text-sage hover:text-ink'}"
      >
        {tab.label}
      </button>
      {/each}
    </div>

    <div class="space-y-4">
      {#each currentTasks as task (task.id)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div 
        onclick={() => selectedTask = task}
        class="bg-theme-card/60 backdrop-blur-xl p-5 rounded-[20px] border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-all cursor-pointer group"
      >
        <div class="flex justify-between items-start mb-2">
          <span class="text-[10px] px-2.5 py-1 rounded-[20px] font-bold uppercase tracking-widest {getBadgeClass(task.type)}">
            {task.type}
          </span>
          <span class="text-[10px] text-sage font-bold uppercase tracking-widest flex items-center gap-1">
            <Clock size={12} /> {task.due}
          </span>
        </div>
        <h3 class="font-bold text-ink text-sm leading-tight mb-2 group-hover:text-olive transition-colors">{task.title}</h3>
        <p class="text-xs text-sage mb-4">{task.subject} · {task.teacher}</p>
        <div class="flex items-center justify-between border-t border-black/5 pt-3">
           <span class="text-[11px] font-bold {task.status === 'done' ? 'text-olive' : 'text-accent'}">
              {task.status === 'done' ? 'Completed' : 'Pending'}
           </span>
           <ChevronRight size={16} class="text-sage group-hover:text-olive transition-colors" />
        </div>
      </div>
      {/each}
    </div>
  </div>
  {:else}
  <div class="px-5 py-6">
    <div class="bg-theme-card rounded-[20px] p-6 shadow-sm border border-black/5 flex flex-col items-center text-center">
      <div class="w-16 h-16 rounded-full bg-olive/10 text-olive flex items-center justify-center mb-4">
        <BookOpen size={28} />
      </div>
      <h2 class="text-xl font-bold text-ink mb-2 leading-tight">{selectedTask.title}</h2>
      <p class="text-xs text-sage font-bold uppercase tracking-widest mb-6">{selectedTask.subject} &bull; By {selectedTask.teacher}</p>
      
      <div class="w-full bg-sage/5 rounded-[20px] p-4 text-left mb-6">
        <h4 class="text-xs font-bold text-ink uppercase tracking-widest mb-2 border-b border-sage/10 pb-2">Description</h4>
        <p class="text-sm text-ink/80 leading-relaxed">{selectedTask.description || 'Please complete this task according to the instructions given in class. Review all related materials before attempting.'}</p>
      </div>
      
      <div class="grid grid-cols-2 gap-4 w-full mb-8">
         <div class="bg-paper p-4 rounded-[20px] border border-sage/10 text-center">
            <div class="text-[10px] text-sage font-bold uppercase tracking-widest mb-1">Status</div>
            <div class="text-sm font-bold {selectedTask.status === 'done' ? 'text-olive' : 'text-accent'}">{selectedTask.status === 'done' ? 'Completed' : 'Pending Action'}</div>
         </div>
         <div class="bg-paper p-4 rounded-[20px] border border-sage/10 text-center">
            <div class="text-[10px] text-sage font-bold uppercase tracking-widest mb-1">Due Date</div>
            <div class="text-sm font-bold text-ink flex items-center justify-center gap-1"><Clock size={14} class="text-sage"/> {selectedTask.due}</div>
         </div>
      </div>
      
      <button class="w-full bg-olive border-none cursor-pointer text-white py-4 rounded-[20px] font-bold uppercase tracking-widest text-xs hover:bg-ink transition-colors shadow-lg active:scale-95 shadow-olive/20">
        {selectedTask.status === 'done' ? 'Review Submission' : 'Start Task Now'}
      </button>
    </div>
  </div>
  {/if}
</div>
