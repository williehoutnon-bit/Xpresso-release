<script lang="ts">
  import { BookOpen, Image as ImageIcon, ClipboardList, Settings } from 'lucide-svelte';

  let { currentView, onnavigate } = $props<{
    currentView: string;
    onnavigate: (view: string) => void;
  }>();

  const isStudyActive = $derived(['dashboard'].includes(currentView));
  const isMomentsActive = $derived(['feeds', 'school_feeds'].includes(currentView));
  const isProjectsActive = $derived(['tasks', 'bounty', 'portfolio'].includes(currentView));
  const isSettingsActive = $derived(['profile', 'public_profile', 'social'].includes(currentView));
</script>

<div class="fixed bottom-2 left-3 right-3 z-40 bg-white border border-[#DDE5EC]/80 flex justify-around items-center py-2 px-2 rounded-[32px] shadow-[0_6px_24px_rgba(32,41,54,0.08)] select-none">
  <!-- Slot 1: STUDY -->
  <button 
    onclick={() => onnavigate('dashboard')}
    class="flex flex-col items-center gap-1 py-1 px-3 border-none bg-transparent cursor-pointer transition-transform active:scale-95 group"
    id="bottom-nav-study"
    title="Study"
  >
    <div class="transition-colors {isStudyActive ? 'text-[#E58A3A]' : 'text-[#46698A] group-hover:text-[#202936]'}">
      <BookOpen size={22} strokeWidth={isStudyActive ? 2.3 : 1.9} />
    </div>
    <span class="text-[9.5px] font-bold uppercase tracking-wider {isStudyActive ? 'text-[#E58A3A]' : 'text-[#202936]'}">
      STUDY
    </span>
  </button>

  <!-- Slot 2: MOMENTS -->
  <button 
    onclick={() => onnavigate('feeds')}
    class="flex flex-col items-center gap-1 py-1 px-3 border-none bg-transparent cursor-pointer transition-transform active:scale-95 group"
    id="bottom-nav-moments"
    title="Moments"
  >
    <div class="transition-colors {isMomentsActive ? 'text-[#E58A3A]' : 'text-[#46698A] group-hover:text-[#202936]'}">
      <ImageIcon size={22} strokeWidth={isMomentsActive ? 2.3 : 1.9} />
    </div>
    <span class="text-[9.5px] font-bold uppercase tracking-wider {isMomentsActive ? 'text-[#E58A3A]' : 'text-[#202936]'}">
      MOMENTS
    </span>
  </button>

  <!-- Slot 3: PROJECTS -->
  <button 
    onclick={() => onnavigate('tasks')}
    class="flex flex-col items-center gap-1 py-1 px-3 border-none bg-transparent cursor-pointer transition-transform active:scale-95 group"
    id="bottom-nav-projects"
    title="Projects"
  >
    <div class="transition-colors {isProjectsActive ? 'text-[#E58A3A]' : 'text-[#46698A] group-hover:text-[#202936]'}">
      <ClipboardList size={22} strokeWidth={isProjectsActive ? 2.3 : 1.9} />
    </div>
    <span class="text-[9.5px] font-bold uppercase tracking-wider {isProjectsActive ? 'text-[#E58A3A]' : 'text-[#202936]'}">
      PROJECTS
    </span>
  </button>

  <!-- Slot 4: SETTINGS -->
  <button 
    onclick={() => onnavigate('profile')}
    class="flex flex-col items-center gap-1 py-1 px-3 border-none bg-transparent cursor-pointer transition-transform active:scale-95 group"
    id="bottom-nav-settings"
    title="Settings"
  >
    <div class="transition-colors {isSettingsActive ? 'text-[#E58A3A]' : 'text-[#46698A] group-hover:text-[#202936]'}">
      <Settings size={22} strokeWidth={isSettingsActive ? 2.3 : 1.9} />
    </div>
    <span class="text-[9.5px] font-bold uppercase tracking-wider {isSettingsActive ? 'text-[#E58A3A]' : 'text-[#202936]'}">
      SETTINGS
    </span>
  </button>
</div>
