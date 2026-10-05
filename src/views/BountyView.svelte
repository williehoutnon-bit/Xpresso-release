<script lang="ts">
  import { ChevronLeft, Flame, ChevronRight, X, Image as ImageIcon, Video, Send, CheckCircle2 } from 'lucide-svelte';
  import { fade, slide, scale } from 'svelte/transition';

  let { onback, onnavigate } = $props<{
    onback?: () => void;
    onnavigate?: (view: string) => void;
  }>();

  const bounties = [
    { id: 1, title: 'Solve the Integration Puzzle', desc: 'Find the exact area under the curve for this complex function before Friday.', prize: 'Shs 50,000', subject: 'Maths', author: 'Mr. Kato', authorInitials: 'MK' },
    { id: 2, title: 'Physics Pendulum Challenge', desc: 'Design a pendulum mechanism that lasts exactly 60 seconds. Must include video proof.', prize: 'Shs 20,000', subject: 'Physics', author: 'STEM Club', authorInitials: 'SC' },
    { id: 3, title: 'Chemistry Titration Balancer', desc: 'Write a balanced equation for the unknown titration sample given in class yesterday.', prize: 'Shs 10,000', subject: 'Chemistry', author: 'Ms. Alice', authorInitials: 'MA' }
  ];

  let selectedBounty = $state<any>(null);
  let showSuccess = $state(false);

  const submitAnswer = () => {
    selectedBounty = null;
    showSuccess = true;
  };

  const closeSuccess = () => {
    showSuccess = false;
  };
</script>

<div class="h-full bg-cream flex flex-col overflow-hidden relative">
  <header class="px-4 py-4 flex items-center justify-between bg-theme-card/80 backdrop-blur-md border-b border-black/5 z-30 sticky top-0 shrink-0">
    <button onclick={() => onback?.()} class="p-2 -ml-2 text-sage bg-transparent border-none hover:text-ink transition-colors cursor-pointer">
      <ChevronLeft size={24} />
    </button>
    <div class="flex flex-col items-center">
      <h2 class="text-sm font-bold text-ink uppercase tracking-widest flex items-center gap-1.5"><Flame size={16} class="text-orange-500" /> Bounty Challenges</h2>
      <p class="text-[9px] text-sage font-bold uppercase tracking-widest">Earn rewards for learning</p>
    </div>
    <div class="w-8"></div>
  </header>

  <div class="flex-1 overflow-y-auto w-full p-4 md:p-8">
    <div class="max-w-xl mx-auto space-y-6 pb-32">
      {#each bounties as bounty (bounty.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div 
           onclick={() => selectedBounty = bounty}
           class="bg-theme-card p-5 rounded-[20px] border border-sage/10 shadow-sm cursor-pointer hover:shadow-md transition-all hover:-translate-y-1 relative overflow-hidden group"
        >
           <div class="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-orange-400 to-red-500 opacity-10 rounded-bl-full transition-transform group-hover:scale-110"></div>
           
           <div class="flex justify-between items-start mb-4 relative z-10">
              <span class="bg-yellow-100 text-yellow-800 text-[10px] font-bold px-3 py-1.5 rounded-[20px] uppercase tracking-widest border border-yellow-200">Prize: {bounty.prize}</span>
              <span class="text-[9px] font-bold text-sage uppercase tracking-widest bg-sage/10 px-2 py-1 rounded">{bounty.subject}</span>
           </div>
           
           <h3 class="font-bold text-ink text-lg mb-2 relative z-10">{bounty.title}</h3>
           <p class="text-sm text-sage mb-4 relative z-10 line-clamp-2">{bounty.desc}</p>
           
           <div class="flex items-center justify-between pt-4 border-t border-sage/10 relative z-10">
              <div class="flex items-center gap-2">
                 <div class="w-6 h-6 rounded-full bg-olive text-white flex items-center justify-center text-[9px] font-bold">{bounty.authorInitials}</div>
                 <span class="text-[10px] uppercase font-bold text-ink/70">By {bounty.author}</span>
              </div>
              <span class="text-[10px] uppercase font-bold text-orange-500 flex items-center gap-1">Solve <ChevronRight size={12} /></span>
           </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Submission Modal -->
  {#if selectedBounty}
    <div transition:fade|local class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 pb-10">
       <!-- svelte-ignore a11y_click_events_have_key_events -->
       <!-- svelte-ignore a11y_no_static_element_interactions -->
       <div class="absolute inset-0 bg-ink/60 backdrop-blur-sm" onclick={() => selectedBounty = null}></div>
       <div transition:slide|local class="bg-theme-card rounded-[20px] w-full max-w-md shadow-2xl relative flex flex-col max-h-[85vh]">
          <header class="p-6 border-b border-black/5 flex justify-between items-center bg-paper shrink-0 rounded-t-2xl">
             <div>
                <h3 class="font-bold text-ink text-sm">Submit Answer</h3>
                <p class="text-[9px] text-sage font-bold uppercase tracking-widest mt-1">{selectedBounty.title}</p>
             </div>
             <button onclick={() => selectedBounty = null} class="text-sage bg-transparent border-none cursor-pointer hover:text-ink"><X size={20} /></button>
          </header>
          <div class="p-6 overflow-y-auto space-y-4 bg-cream/50">
             <div class="bg-yellow-50 text-yellow-800 p-4 rounded-[20px] border border-yellow-200 text-xs shadow-sm mb-4">
                <strong>Goal:</strong> {selectedBounty.desc}
             </div>
             <div>
                <label class="text-[10px] font-bold text-sage uppercase tracking-widest mb-2 block">Your Answer / Text</label>
                <textarea rows="4" class="w-full bg-theme-card p-3 rounded-[20px] border border-sage/20 text-sm focus:outline-none focus:border-olive shadow-sm resize-none"></textarea>
             </div>
             <div>
                <label class="text-[10px] font-bold text-sage uppercase tracking-widest mb-2 block">Attachments</label>
                <div class="flex gap-2">
                   <button class="flex-1 py-3 bg-theme-card border cursor-pointer border-dashed border-sage/30 rounded-[20px] flex flex-col items-center justify-center gap-1 hover:bg-sage/5 transition-colors text-sage hover:text-olive">
                      <ImageIcon size={20} />
                      <span class="text-[9px] font-bold uppercase tracking-widest">Image</span>
                   </button>
                   <button class="flex-1 py-3 bg-theme-card border cursor-pointer border-dashed border-sage/30 rounded-[20px] flex flex-col items-center justify-center gap-1 hover:bg-sage/5 transition-colors text-sage hover:text-olive">
                      <Video size={20} />
                      <span class="text-[9px] font-bold uppercase tracking-widest">Video</span>
                   </button>
                </div>
             </div>
          </div>
          <footer class="p-6 border-t border-black/5 bg-paper shrink-0 rounded-b-2xl">
             <button onclick={submitAnswer} class="w-full py-4 bg-olive text-white border-none cursor-pointer rounded-[20px] font-bold shadow-sm uppercase tracking-widest text-xs hover:bg-ink transition-colors flex items-center justify-center gap-2">
                <Send size={16} /> Submit for Review
             </button>
          </footer>
       </div>
    </div>
  {/if}

  <!-- Success Lightbox -->
  {#if showSuccess}
    <div transition:fade|local class="fixed inset-0 z-[60] flex items-center justify-center p-4">
       <div class="absolute inset-0 bg-ink/80 backdrop-blur-sm shadow-2xl"></div>
       <div transition:scale|local class="bg-theme-card rounded-[20px] p-8 max-w-sm w-full text-center relative z-10 shadow-2xl border border-white/20">
          <div class="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
             <CheckCircle2 size={40} />
          </div>
          <h3 class="text-xl font-bold text-ink mb-2">Submitted!</h3>
          <p class="text-sm text-sage leading-relaxed mb-6">Your answer has been submitted. Please wait for the bounty offerer to review and release the money from the holding account.</p>
          <button onclick={closeSuccess} class="w-full py-3 bg-olive text-white border-none cursor-pointer rounded-[20px] font-bold uppercase tracking-widest text-xs shadow-md">Got it</button>
       </div>
    </div>
  {/if}
</div>
