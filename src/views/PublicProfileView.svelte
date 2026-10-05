<script lang="ts">
  import { ChevronLeft, Trophy, Star } from 'lucide-svelte';

  let { onback } = $props<{ onback?: () => void }>();
</script>

<div class="h-full bg-cream flex flex-col font-sans text-ink relative">
  <header class="h-14 flex items-center px-4 border-b border-black/5 bg-paper sticky top-0 z-20 shrink-0">
    <button onclick={() => onback?.()} class="p-2 -ml-2 text-sage bg-transparent border-none cursor-pointer hover:text-ink transition-colors">
      <ChevronLeft size={24} />
    </button>
    <h1 class="font-bold text-sm tracking-widest uppercase ml-2">Student Profile</h1>
  </header>

  <div class="flex-1 overflow-y-auto">
    <div class="bg-olive pb-8 pt-6 px-6 relative overflow-hidden">
      <div class="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-theme-card/5 rounded-full blur-3xl"></div>
      
      <div class="flex flex-col items-center relative z-10 text-center">
        <div class="w-24 h-24 rounded-full bg-theme-card p-1 mb-4 shadow-sm">
          <img 
            src="https://api.dicebear.com/7.x/notionists/svg?seed=Brian" 
            alt="Profile avatar" 
            class="w-full h-full rounded-full object-cover bg-cream"
            referrerpolicy="no-referrer"
          />
        </div>
        <h2 class="text-xl font-bold text-white mb-1">Brian Mugisha</h2>
        <p class="text-white/80 text-xs font-bold uppercase tracking-widest mb-4">S.4 • Gayaza High School</p>
        
        <div class="flex gap-4">
            <div class="bg-black/20 backdrop-blur-sm px-4 py-2 rounded-[20px] text-center">
                <div class="text-xl font-bold text-white">147</div>
                <div class="text-[10px] uppercase tracking-widest text-white/60">Points</div>
            </div>
            <div class="bg-black/20 backdrop-blur-sm px-4 py-2 rounded-[20px] text-center">
                <div class="text-xl font-bold text-white">#1</div>
                <div class="text-[10px] uppercase tracking-widest text-white/60">School Rank</div>
            </div>
        </div>
      </div>
    </div>

    <div class="p-4 sm:p-6 space-y-6">
        <section>
           <h3 class="text-[10px] font-bold text-sage uppercase tracking-[0.2em] mb-4 pl-2">About</h3>
           <div class="bg-paper p-5 rounded-[20px] border border-sage/10 text-sm text-ink/80 leading-relaxed shadow-sm">
               I am passionate about Physics and Mathematics. Always eager to learn new things and help others understand complex concepts. Aiming for an A in UCE! 🚀
           </div>
        </section>

        <section>
           <h3 class="text-[10px] font-bold text-sage uppercase tracking-[0.2em] mb-4 pl-2">Top Subjects</h3>
           <div class="grid grid-cols-2 gap-3 sm:gap-4 text-xs">
               <div class="bg-accent/10 border border-accent/20 p-4 rounded-[20px] flex flex-col items-center justify-center text-center">
                   <span class="text-2xl mb-1">⚡</span>
                   <span class="font-bold text-ink mb-1">Physics</span>
                   <span class="text-accent font-bold">Level 12</span>
               </div>
               <div class="bg-blue-500/10 border border-blue-500/20 p-4 rounded-[20px] flex flex-col items-center justify-center text-center">
                   <span class="text-2xl mb-1">📐</span>
                   <span class="font-bold text-ink mb-1">Mathematics</span>
                   <span class="text-blue-500 font-bold">Level 10</span>
               </div>
           </div>
        </section>

        <section>
           <h3 class="text-[10px] font-bold text-sage uppercase tracking-[0.2em] mb-4 pl-2">Recent Activity</h3>
           <div class="space-y-3">
               <div class="bg-paper p-4 rounded-[20px] border border-sage/10 flex items-start gap-4">
                   <div class="w-10 h-10 rounded-full bg-olive/10 text-olive flex items-center justify-center shrink-0">
                       <Trophy size={18} />
                   </div>
                   <div>
                       <p class="text-sm font-bold text-ink">Topped the Weekly Leaderboard</p>
                       <p class="text-xs text-sage mt-1">2 days ago</p>
                   </div>
               </div>
               <div class="bg-paper p-4 rounded-[20px] border border-sage/10 flex items-start gap-4">
                   <div class="w-10 h-10 rounded-full bg-accent/10 text-accent flex items-center justify-center shrink-0">
                       <Star size={18} />
                   </div>
                   <div>
                       <p class="text-sm font-bold text-ink">Answered a Physics Question</p>
                       <p class="text-xs text-sage mt-1">4 days ago</p>
                   </div>
               </div>
           </div>
        </section>
    </div>
  </div>
</div>
