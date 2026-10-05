<script lang="ts">
  import { BookOpen, Image as ImageIcon, ClipboardList, Settings } from 'lucide-svelte';

  let { currentView, onnavigate } = $props<{
    currentView: string;
    onnavigate: (view: string) => void;
  }>();

  const isStudyActive = $derived(['dashboard'].includes(currentView));
  const isMomentsActive = $derived(['feeds', 'school_feeds'].includes(currentView));
  const isProjectsActive = $derived(['tasks', 'bounty', 'portfolio'].includes(currentView));
  const isProfileActive = $derived(['profile', 'public_profile', 'social'].includes(currentView));
</script>

<div class="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200/90 flex justify-around items-center py-2.5 px-4 shadow-[0_-2px_12px_rgba(0,0,0,0.03)] w-full rounded-t-[20px] select-none">
  <!-- Slot 1: STUDY -->
  <button 
    onclick={() => onnavigate('dashboard')}
    class="flex flex-col items-center gap-1 py-1 px-3 border-none bg-transparent cursor-pointer transition-colors {isStudyActive ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}"
    id="bottom-nav-study"
    title="Study"
  >
    <BookOpen size={22} strokeWidth={isStudyActive ? 2.2 : 1.8} />
    <span class="text-[10px] font-bold uppercase tracking-wider {isStudyActive ? 'text-blue-600' : 'text-slate-500'}">STUDY</span>
  </button>

  <!-- Slot 2: MOMENTS -->
  <button 
    onclick={() => onnavigate('feeds')}
    class="flex flex-col items-center gap-1 py-1 px-3 border-none bg-transparent cursor-pointer transition-colors {isMomentsActive ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}"
    id="bottom-nav-moments"
    title="Moments"
  >
    <ImageIcon size={22} strokeWidth={isMomentsActive ? 2.2 : 1.8} />
    <span class="text-[10px] font-bold uppercase tracking-wider {isMomentsActive ? 'text-blue-600' : 'text-slate-500'}">MOMENTS</span>
  </button>

  <!-- Slot 3: PROJECTS -->
  <button 
    onclick={() => onnavigate('tasks')}
    class="flex flex-col items-center gap-1 py-1 px-3 border-none bg-transparent cursor-pointer transition-colors {isProjectsActive ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}"
    id="bottom-nav-projects"
    title="Projects"
  >
    <ClipboardList size={22} strokeWidth={isProjectsActive ? 2.2 : 1.8} />
    <span class="text-[10px] font-bold uppercase tracking-wider {isProjectsActive ? 'text-blue-600' : 'text-slate-500'}">PROJECTS</span>
  </button>

  <!-- Slot 4: SETTINGS -->
  <button 
    onclick={() => onnavigate('profile')}
    class="flex flex-col items-center gap-1 py-1 px-3 border-none bg-transparent cursor-pointer transition-colors {isProfileActive ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}"
    id="bottom-nav-settings"
    title="Settings"
  >
    <Settings size={22} strokeWidth={isProfileActive ? 2.2 : 1.8} />
    <span class="text-[10px] font-bold uppercase tracking-wider {isProfileActive ? 'text-blue-600' : 'text-slate-500'}">SETTINGS</span>
  </button>
</div>
