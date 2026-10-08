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

<div class="fixed bottom-0 left-0 right-0 z-40 bg-[#F7F6F2] border-t border-[#DDE5EC]/90 flex items-stretch select-none py-1.5 px-2 rounded-none shadow-[0_-1px_3px_rgba(32,41,54,0.02)]">
  <!-- Slot 1: STUDY -->
  <button 
    onclick={() => onnavigate('dashboard')}
    class="flex-1 py-2 px-1 flex flex-col items-center justify-center relative border-none bg-transparent cursor-pointer transition-colors group"
    id="bottom-nav-study"
    title="Study"
  >
    <div class="transition-colors {isStudyActive ? 'text-[#E58A3A]' : 'text-[#46698A] group-hover:text-[#202936]'}">
      <BookOpen size={22} strokeWidth={isStudyActive ? 2.3 : 1.9} />
    </div>
    <span class="text-[9.5px] font-bold uppercase tracking-wider mt-0.5 {isStudyActive ? 'text-[#E58A3A]' : 'text-[#46698A] group-hover:text-[#202936]'}">
      STUDY
    </span>
    {#if isStudyActive}
      <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-[3px] bg-[#E58A3A] rounded-full"></div>
    {/if}
  </button>

  <!-- Slot 2: MOMENTS -->
  <button 
    onclick={() => onnavigate('feeds')}
    class="flex-1 py-2 px-1 flex flex-col items-center justify-center relative border-none bg-transparent cursor-pointer transition-colors group"
    id="bottom-nav-moments"
    title="Moments"
  >
    <div class="transition-colors {isMomentsActive ? 'text-[#E58A3A]' : 'text-[#46698A] group-hover:text-[#202936]'}">
      <ImageIcon size={22} strokeWidth={isMomentsActive ? 2.3 : 1.9} />
    </div>
    <span class="text-[9.5px] font-bold uppercase tracking-wider mt-0.5 {isMomentsActive ? 'text-[#E58A3A]' : 'text-[#46698A] group-hover:text-[#202936]'}">
      MOMENTS
    </span>
    {#if isMomentsActive}
      <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-[3px] bg-[#E58A3A] rounded-full"></div>
    {/if}
  </button>

  <!-- Slot 3: PROJECTS -->
  <button 
    onclick={() => onnavigate('tasks')}
    class="flex-1 py-2 px-1 flex flex-col items-center justify-center relative border-none bg-transparent cursor-pointer transition-colors group"
    id="bottom-nav-projects"
    title="Projects"
  >
    <div class="transition-colors {isProjectsActive ? 'text-[#E58A3A]' : 'text-[#46698A] group-hover:text-[#202936]'}">
      <ClipboardList size={22} strokeWidth={isProjectsActive ? 2.3 : 1.9} />
    </div>
    <span class="text-[9.5px] font-bold uppercase tracking-wider mt-0.5 {isProjectsActive ? 'text-[#E58A3A]' : 'text-[#46698A] group-hover:text-[#202936]'}">
      PROJECTS
    </span>
    {#if isProjectsActive}
      <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-[3px] bg-[#E58A3A] rounded-full"></div>
    {/if}
  </button>

  <!-- Slot 4: SETTINGS -->
  <button 
    onclick={() => onnavigate('profile')}
    class="flex-1 py-2 px-1 flex flex-col items-center justify-center relative border-none bg-transparent cursor-pointer transition-colors group"
    id="bottom-nav-settings"
    title="Settings"
  >
    <div class="transition-colors {isSettingsActive ? 'text-[#E58A3A]' : 'text-[#46698A] group-hover:text-[#202936]'}">
      <Settings size={22} strokeWidth={isSettingsActive ? 2.3 : 1.9} />
    </div>
    <span class="text-[9.5px] font-bold uppercase tracking-wider mt-0.5 {isSettingsActive ? 'text-[#E58A3A]' : 'text-[#46698A] group-hover:text-[#202936]'}">
      SETTINGS
    </span>
    {#if isSettingsActive}
      <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-[3px] bg-[#E58A3A] rounded-full"></div>
    {/if}
  </button>
</div>
