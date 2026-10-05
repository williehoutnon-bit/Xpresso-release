<script lang="ts">
  import { ChevronLeft, Play, Search, Film } from 'lucide-svelte';
  import { triggerNotification } from '../services/notificationService';

  let { onback } = $props<{ onback?: () => void }>();

  const MOCK_VIDEOS = [
    { id: 'v1', title: 'Cell Organelles Explained', category: 'Biology', duration: '12:45', author: 'Dr. S. Okello' },
    { id: 'v2', title: 'Quadratic Equations Made Easy', category: 'Maths', duration: '18:20', author: 'Mr. B. Mugisha' },
    { id: 'v3', title: 'Intro to Electrolysis', category: 'Chemistry', duration: '15:10', author: 'Dr. C. Atim' },
    { id: 'v4', title: "Newton's Laws of Motion", category: 'Physics', duration: '22:05', author: 'Ms. Nabirye' },
  ];

  const playFeatured = () => {
    triggerNotification('Video Playing', { body: 'Starting the Organic Chemistry masterclass...', type: 'info'});
  };

  const playVideo = (title: string) => {
    triggerNotification('Video Playing', { body: `Starting ${title}...`, type: 'info'});
  };
</script>

<div class="h-full bg-cream flex flex-col overflow-y-auto pb-24">
  <header class="px-4 py-4 flex items-center justify-between sticky top-0 bg-paper/80 backdrop-blur-md z-10 border-b border-black/5">
    <button onclick={() => onback?.()} class="p-2 -ml-2 text-sage bg-transparent cursor-pointer border-none hover:text-accent transition-colors flex items-center justify-center w-10 h-10 bg-theme-card rounded-[20px] shadow-sm border border-sage/10">
      <ChevronLeft size={20} />
    </button>
    <h2 class="text-sm font-bold text-ink uppercase tracking-widest">Video Library</h2>
    <div class="w-10"></div>
  </header>

  <div class="p-4 bg-paper/30 backdrop-blur-md">
    <div class="relative">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-sage" size={16} />
      <input 
        type="text" 
        placeholder="Search lectures..." 
        class="w-full bg-cream border border-sage/10 rounded-[20px] py-3 pl-10 pr-4 text-[11px] font-bold uppercase tracking-widest placeholder:text-sage focus:ring-1 focus:ring-accent outline-none"
      />
    </div>
  </div>

  <div class="p-6 pt-4 space-y-6">
    <div class="bg-accent text-white p-6 rounded-[20px] shadow-sm relative overflow-hidden flex flex-col justify-between" style="min-height: 180px">
       <div class="relative z-10">
         <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-2 text-white/80">
           <Film size={14} /> Featured Masterclass
         </div>
         <h3 class="text-2xl font-bold leading-tight mb-2">Organic Chemistry: Alkanes</h3>
         <p class="text-xs text-white/90">A complete deep dive into hydrocarbons.</p>
       </div>
       <button 
         onclick={playFeatured}
         class="relative z-10 w-12 h-12 bg-theme-card border-none cursor-pointer text-accent rounded-full flex items-center justify-center hover:scale-105 transition-transform mt-4 self-end shadow-md">
         <Play size={20} class="ml-1" fill="currentColor" />
       </button>
       <div class="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 bg-theme-card/20 rounded-full blur-2xl"></div>
    </div>

    <div>
       <h3 class="text-[10px] font-bold text-sage uppercase tracking-widest mb-4">Recommended Videos</h3>
       <div class="grid grid-cols-1 gap-4">
         {#each MOCK_VIDEOS as video (video.id)}
         <!-- svelte-ignore a11y_click_events_have_key_events -->
         <!-- svelte-ignore a11y_no_static_element_interactions -->
         <div class="bg-paper p-4 rounded-[20px] border border-sage/10 flex items-center gap-4 hover:border-accent transition-colors cursor-pointer group shadow-sm" onclick={() => playVideo(video.title)}>
            <div class="w-20 h-20 bg-cream rounded-[20px] flex items-center justify-center text-accent relative shrink-0">
              <Play size={24} fill="currentColor" class="opacity-80 group-hover:opacity-100 transition-opacity" />
              <div class="absolute bottom-1 right-1 bg-ink/70 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm backdrop-blur-sm">
                {video.duration}
              </div>
            </div>
            <div class="flex-1 min-w-0">
               <div class="text-[9px] font-bold text-accent uppercase tracking-widest mb-1">{video.category}</div>
               <h4 class="font-bold text-ink text-sm leading-tight mb-1 truncate">{video.title}</h4>
               <p class="text-[10px] text-sage font-medium">{video.author}</p>
            </div>
         </div>
         {/each}
       </div>
    </div>
  </div>
</div>
