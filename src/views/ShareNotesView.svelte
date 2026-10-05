<script lang="ts">
  import { ChevronLeft, Share2, Mic, Image as ImageIcon, Video, Send, Globe } from 'lucide-svelte';

  let { onback } = $props<{ onback?: () => void }>();
  let reach = $state('Class');
</script>

<div class="h-full bg-cream flex flex-col overflow-hidden relative">
  <header class="px-4 py-4 flex items-center justify-between bg-theme-card/80 backdrop-blur-md border-b border-black/5 z-30 sticky top-0 shrink-0">
    <button onclick={() => onback?.()} class="p-2 -ml-2 text-sage bg-transparent cursor-pointer border-none hover:text-ink transition-colors">
      <ChevronLeft size={24} />
    </button>
    <div class="flex flex-col items-center">
      <h2 class="text-sm font-bold text-ink uppercase tracking-widest flex items-center gap-1.5"><Share2 size={16} /> Share Notes</h2>
      <p class="text-[9px] text-sage font-bold uppercase tracking-widest">Share knowledge</p>
    </div>
    <div class="w-8"></div>
  </header>

  <div class="flex-1 overflow-y-auto w-full p-4 md:p-8">
    <div class="max-w-xl mx-auto space-y-6 pb-32">
      <div class="bg-theme-card p-6 rounded-[20px] border border-sage/10 shadow-sm relative overflow-hidden">
         <div class="space-y-6 relative z-10">
            <div>
               <label class="text-[10px] font-bold text-sage uppercase tracking-widest mb-2 block">Note Title</label>
               <input type="text" placeholder="e.g., Summary of Cell Biology" class="w-full bg-paper p-3 rounded-[20px] border border-sage/20 text-sm focus:outline-none focus:border-olive shadow-inner" />
            </div>

            <div>
               <label class="text-[10px] font-bold text-sage uppercase tracking-widest mb-2 block">Content</label>
               <textarea rows="5" placeholder="Type your notes here, or attach below..." class="w-full bg-paper p-3 rounded-[20px] border border-sage/20 text-sm focus:outline-none focus:border-olive shadow-inner resize-none"></textarea>
            </div>

            <div>
               <label class="text-[10px] font-bold text-sage uppercase tracking-widest mb-2 block">Upload Media (Optional)</label>
               <div class="grid grid-cols-3 gap-2">
                  <button class="py-4 bg-paper bg-transparent cursor-pointer border border-dashed border-sage/30 rounded-[20px] flex flex-col items-center justify-center gap-2 hover:bg-sage/5 transition-colors text-sage hover:text-olive">
                     <Mic size={20} />
                     <span class="text-[9px] font-bold uppercase tracking-widest">Audio</span>
                  </button>
                  <button class="py-4 bg-paper bg-transparent cursor-pointer border border-dashed border-sage/30 rounded-[20px] flex flex-col items-center justify-center gap-2 hover:bg-sage/5 transition-colors text-sage hover:text-olive">
                     <ImageIcon size={20} />
                     <span class="text-[9px] font-bold uppercase tracking-widest">Image</span>
                  </button>
                  <button class="py-4 bg-paper bg-transparent cursor-pointer border border-dashed border-sage/30 rounded-[20px] flex flex-col items-center justify-center gap-2 hover:bg-sage/5 transition-colors text-sage hover:text-olive">
                     <Video size={20} />
                     <span class="text-[9px] font-bold uppercase tracking-widest">Video</span>
                  </button>
               </div>
            </div>

            <div>
               <label class="text-[10px] font-bold text-sage uppercase tracking-widest mb-2 block">Share Reach</label>
               <div class="grid grid-cols-2 gap-2">
                  <button onclick={() => reach = 'Class'} class="cursor-pointer py-3 rounded-[20px] text-xs font-bold uppercase tracking-widest border transition-colors {reach === 'Class' ? 'bg-olive text-white border-olive shadow-md' : 'bg-paper text-sage border-sage/20 hover:border-olive'}">Class</button>
                  <button onclick={() => reach = 'School'} class="cursor-pointer py-3 rounded-[20px] text-xs font-bold uppercase tracking-widest border transition-colors {reach === 'School' ? 'bg-olive text-white border-olive shadow-md' : 'bg-paper text-sage border-sage/20 hover:border-olive'}">School</button>
                  <button onclick={() => reach = 'District'} class="cursor-pointer py-3 rounded-[20px] text-xs font-bold uppercase tracking-widest border transition-colors {reach === 'District' ? 'bg-olive text-white border-olive shadow-md' : 'bg-paper text-sage border-sage/20 hover:border-olive'}">District</button>
                  <button onclick={() => reach = 'National'} class="cursor-pointer py-3 rounded-[20px] text-xs font-bold uppercase tracking-widest border transition-colors flex items-center justify-center gap-1.5 {reach === 'National' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-paper text-sage border-sage/20 hover:border-indigo-400'}">
                    National {#if reach === 'National'}<Globe size={14} />{/if}
                  </button>
               </div>
            </div>

            <button onclick={() => onback?.()} class="w-full py-4 border-none cursor-pointer bg-olive text-white rounded-[20px] font-bold shadow-md uppercase tracking-widest text-xs hover:bg-ink transition-colors flex items-center justify-center gap-2 mt-4">
               <Send size={16} /> Share Now
            </button>
         </div>
      </div>
    </div>
  </div>
</div>
