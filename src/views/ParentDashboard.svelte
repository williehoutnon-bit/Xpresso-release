<script lang="ts">
  import { 
    Newspaper, Activity, BarChart, ShieldAlert, BookOpen, Sun, ChevronRight, UserPlus 
  } from 'lucide-svelte';

  function triggerNotification(title: string, options: any) {
    console.log(`Notification: ${title}`, options);
  }

  let { userName = 'Parent', onlogout, onviewnews, onviewfeeds, onviewideas, onviewconnections } = $props<{
    userName?: string;
    onlogout?: () => void;
    onviewnews?: () => void;
    onviewfeeds?: () => void;
    onviewideas?: () => void;
    onviewconnections?: () => void;
    onnavigate?: (target: string) => void;
  }>();

  let isStickyBanner = true;
  const generatedCode = "PRNT-84XQ2";

  const handleCopy = () => triggerNotification('Copied', { body: 'Code copied to clipboard.', type: 'info'});
  const viewProgress = () => triggerNotification('Loading Report', { body: 'Fetching detailed progress report...', type: 'info'});
</script>

<div class="flex flex-col pb-24 relative bg-theme-paper flex-1">
  <div class="sticky top-0 z-30 pt-0 pb-2 -mx-5 px-5 bg-gradient-to-b from-[#fdfbf7] via-[#fdfbf7]/90 to-transparent">
    <!-- Dark Header -->
    <header class="bg-[#242424] text-[#f8f8f8] px-5 pt-6 pb-12 flex items-center justify-between rounded-b-xl shadow-md z-10 relative mx-[-20px] px-[20px]">
      <div class="flex items-center gap-2 relative">
        <div class="relative">
          <BookOpen class="text-accent" size={24} strokeWidth={2.5} />
        </div>
        <span class="font-bold text-xl tracking-tighter">Xpresso</span>
        <span class="text-[9px] uppercase font-bold text-accent tracking-widest ml-1 bg-accent/20 px-1.5 py-0.5 rounded-full">Parent</span>
      </div>
      <div class="flex items-center gap-4">
        <button onclick={() => onviewnews?.()} class="border-none bg-transparent cursor-pointer p-0">
          <Newspaper size={22} class="text-white/60 hover:text-white transition-colors" />
        </button>
        <button onclick={() => onviewconnections?.()} class="relative border-none bg-transparent cursor-pointer p-0">
          <UserPlus size={22} class="text-white/60 hover:text-white transition-colors" />
        </button>
        <button onclick={() => onlogout?.()} class="w-8 h-8 rounded-full border-none cursor-pointer bg-theme-card text-ink flex items-center justify-center font-bold text-xs uppercase shadow-sm ml-1 transition-transform hover:scale-105 p-0">
          P
        </button>
      </div>
    </header>

    <div class="px-5 mt-0 space-y-6 {isStickyBanner ? 'sticky top-2 z-30' : ''}">
      <div class="px-0 -mt-8 relative z-20">
        <div class="bg-gradient-to-tr from-[#3b2d71] to-[#7b5bc7] rounded-[20px] p-6 text-white shadow-lg relative overflow-hidden h-[140px] flex flex-col justify-center border border-white/10">
          <div class="absolute right-4 top-4 w-10 h-10 bg-yellow-400 rounded-full shadow-[0_0_20px_rgba(250,204,21,0.5)]"></div>
          <div class="absolute bottom-0 right-0 w-[60%] h-[60%] opacity-20 pointer-events-none text-white overflow-hidden">
             <svg viewBox="0 0 100 50" preserveAspectRatio="none" class="w-full h-full object-fill fill-current">
               <polygon points="0,50 30,20 50,40 80,10 100,50" />
             </svg>
          </div>
          
          <div class="relative z-10 min-h-[60px]">
             <h3 class="text-sm font-bold opacity-90 tracking-wide mb-1">Good Afternoon,</h3>
             <div class="flex items-center gap-2 relative">
               <Sun size={24} strokeWidth={2} class="text-yellow-400 drop-shadow-sm absolute -left-2 -top-10 animate-pulse" />
               <span class="text-3xl font-bold tracking-tighter">{userName}</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="px-5 mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10 w-full max-w-7xl mx-auto">
    <div class="space-y-6 lg:col-span-2">
      <div class="bg-theme-card p-6 rounded-[20px] border border-black/10 shadow-sm text-center">
        <h2 class="text-sm font-bold text-ink mb-1">Your Parent Subscription Code</h2>
        <p class="text-xs text-sage mb-4">Share this code with your children so they can link to your subscription.</p>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="inline-block bg-cream border-2 border-olive border-dashed rounded-[20px] px-6 py-3 cursor-pointer hover:bg-olive/5 transition-colors" onclick={handleCopy}>
          <span class="font-mono font-bold text-2xl text-olive tracking-widest">{generatedCode}</span>
        </div>
      </div>

      <section class="bg-theme-card p-6 rounded-[20px] border border-black/10 shadow-sm">
        <h3 class="text-sm font-bold text-ink uppercase tracking-widest mb-4 flex items-center gap-2">
          <Activity size={18} /> Linked Students
        </h3>
        <div class="space-y-3">
          <div class="bg-cream/50 p-4 rounded-[20px] border border-black/5 flex justify-between items-center">
            <div>
              <p class="font-bold text-ink text-sm">Joan Mirembe</p>
              <p class="text-[10px] text-sage font-bold uppercase">S4 · Connected</p>
            </div>
            <button 
              onclick={viewProgress}
              class="text-[10px] bg-accent border-none cursor-pointer text-white px-3 py-1.5 rounded-full font-bold uppercase tracking-widest hover:bg-accent/80 transition-colors shadow-sm">
              View Progress
            </button>
          </div>
        </div>
      </section>

      <section class="bg-theme-card p-6 rounded-[20px] border border-black/10 shadow-sm">
        <h3 class="text-sm font-bold text-ink uppercase tracking-widest mb-4 flex items-center gap-2">
          <BarChart size={18} /> Performance Insights
        </h3>
        <div class="bg-olive p-5 rounded-[20px] text-white shadow-sm">
          <p class="text-[10px] font-bold uppercase tracking-widest mb-2 text-white/70">Weak Points Identified</p>
          <p class="font-bold text-lg mb-1">Physics: Mechanics</p>
          <p class="text-xs text-white/80">Joan struggled with vector resolution in the recent mock exam.</p>
        </div>
      </section>
    </div>
    
    <div class="space-y-6">
      <button onclick={() => onviewfeeds?.()} class="w-full bg-theme-card border-none cursor-pointer p-5 rounded-[20px] border border-black/10 shadow-sm text-left group">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-bold text-ink text-sm group-hover:text-olive">School Feed</h3>
          <ChevronRight size={16} class="text-sage" />
        </div>
        <p class="text-xs text-sage">Review announcements.</p>
      </button>

      <!-- Project Ideas Card (NEW) -->
      <button onclick={() => onviewideas?.()} class="w-full text-left border-none bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[20px] p-5 text-white flex justify-between items-center shadow-md cursor-pointer hover:shadow-lg transition-all relative overflow-hidden">
         <div class="absolute inset-0 bg-theme-card/10" style="clip-path: polygon(60% 0%, 100% 0, 100% 100%, 80% 100%);"></div>
         <div class="relative z-10">
           <h3 class="font-bold text-lg tracking-tight flex items-center gap-2">
             Project Ideas
             <span class="bg-theme-card/20 backdrop-blur-md text-white text-[9px] px-2.5 py-1 rounded-full uppercase tracking-widest border border-white/30 hidden sm:inline-block">New Curriculum</span>
           </h3>
           <p class="text-xs text-blue-100 mt-1 opacity-90">Manage or suggest DIT project ideas</p>
         </div>
         <div class="w-10 h-10 rounded-full shrink-0 bg-theme-card/20 backdrop-blur-md flex items-center justify-center relative z-10 border border-white/30">
           <ChevronRight size={20} class="text-white" />
         </div>
      </button>
    </div>
  </div>
</div>
