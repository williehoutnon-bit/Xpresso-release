<script lang="ts">
  import { ChevronLeft, Search, BookOpen, Mic, PlayCircle, Heart, MessageCircle, Bookmark } from 'lucide-svelte';

  let { onback } = $props<{ onback?: () => void }>();

  const notes = [
    {
      id: 1,
      author: 'Sarah Mukisa',
      authorInitials: 'SM',
      timeAgo: '2 hours ago',
      reach: 'School',
      subject: 'Biology',
      title: 'Cell Structure Guide',
      content: 'Hey guys, I made a quick summary table comparing mitochondria and chloroplasts for the upcoming mock exam. The main thing to remember is the folding of the inner membrane (cristae vs thylakoids).',
      hasAudio: false,
      likes: 24,
      comments: 5
    },
    {
      id: 2,
      author: 'Alex K',
      authorInitials: 'AK',
      timeAgo: 'Yesterday',
      reach: 'Class',
      subject: 'Chemistry',
      title: 'Enzymes Past Papers Q&A',
      content: 'Attached a voice note where I explain how to approach the tricky 10-mark essay questions on factors affecting enzyme activity.',
      hasAudio: true,
      likes: 45,
      comments: 12
    }
  ];
</script>

<div class="h-full bg-cream flex flex-col overflow-hidden relative">
  <header class="px-4 py-4 flex items-center justify-between bg-theme-card/80 backdrop-blur-md border-b border-black/5 z-30 sticky top-0 shrink-0">
    <button onclick={() => onback?.()} class="p-2 -ml-2 text-sage bg-transparent cursor-pointer border-none hover:text-ink transition-colors">
      <ChevronLeft size={24} />
    </button>
    <div class="flex flex-col items-center">
      <h2 class="text-sm font-bold text-ink uppercase tracking-widest flex items-center gap-1.5"><BookOpen size={16} class="text-blue-500" /> Shared Notes</h2>
      <p class="text-[9px] text-sage font-bold uppercase tracking-widest">Community Knowledge</p>
    </div>
    <button class="text-sage bg-transparent border-none cursor-pointer hover:text-ink p-2"><Search size={20} /></button>
  </header>

  <div class="flex-1 overflow-y-auto w-full p-4 md:p-8">
    <div class="max-w-2xl mx-auto space-y-6 pb-32">
       {#each notes as note (note.id)}
       <div class="bg-theme-card rounded-[20px] border border-sage/10 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
          <div class="p-5 border-b border-black/5 flex items-center justify-between bg-paper">
             <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-600 flex items-center justify-center font-bold text-sm border border-blue-200">
                   {note.authorInitials}
                </div>
                <div>
                   <h4 class="font-bold text-ink text-sm">{note.author}</h4>
                   <p class="text-[9px] font-bold uppercase tracking-widest text-sage flex items-center gap-1">{note.reach} • {note.timeAgo}</p>
                </div>
             </div>
             <span class="text-[9px] font-bold text-blue-500 uppercase tracking-widest bg-theme-card box-border px-2 py-1 rounded-md border border-blue-100">{note.subject}</span>
          </div>
          <div class="p-5">
             <h3 class="font-bold text-lg text-ink mb-2">{note.title}</h3>
             <p class="text-sm text-ink/80 leading-relaxed mb-4 whitespace-pre-line">{note.content}</p>
             
             {#if note.hasAudio}
             <div class="bg-indigo-50 rounded-[20px] p-4 flex items-center justify-between mb-4 border border-indigo-100 cursor-pointer hover:bg-indigo-100 transition-colors">
                <div class="flex items-center gap-3">
                   <div class="w-10 h-10 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center">
                      <PlayCircle size={20} />
                   </div>
                   <div>
                      <p class="font-bold text-xs text-indigo-900">Voice Note</p>
                      <p class="text-[9px] font-bold uppercase tracking-widest text-indigo-500">2:45</p>
                   </div>
                </div>
                <Mic size={20} class="text-indigo-400" />
             </div>
             {/if}

             <div class="flex items-center justify-between pt-4 border-t border-sage/10">
                <div class="flex items-center gap-4">
                   <button class="flex items-center gap-1 bg-transparent border-none cursor-pointer text-xs font-bold text-sage hover:text-red-500 transition-colors">
                      <Heart size={16} /> {note.likes}
                   </button>
                   <button class="flex items-center gap-1 bg-transparent border-none cursor-pointer text-xs font-bold text-sage hover:text-blue-500 transition-colors">
                      <MessageCircle size={16} /> {note.comments}
                   </button>
                </div>
                <button class="p-2 bg-transparent border-none cursor-pointer text-sage hover:text-ink"><Bookmark size={18} /></button>
             </div>
          </div>
       </div>
       {/each}
    </div>
  </div>
</div>
