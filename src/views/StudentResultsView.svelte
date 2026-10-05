<script lang="ts">
  import { ChevronLeft, MessageSquare } from 'lucide-svelte';

  let { onback } = $props<{ onback?: () => void }>();

  const questions = [
    { 
      q: 'Describe the process of photosynthesis.', 
      a: 'Photosynthesis is when plants use sunlight, water, and carbon dioxide to create oxygen and energy in the form of sugar. It happens in the chloroplasts.',
      mark: 'correct',
      comment: 'Excellent answer. Very clear.'
    },
    { 
      q: 'What is the role of chlorophyll?', 
      a: 'Chlorophyll is what gives plants their green color. I am not sure about its exact role but it helps with light.',
      mark: 'half',
      comment: 'Almost there! It primarily absorbs light energy to drive the photosynthetic reaction.'
    },
    {
      q: 'Name the organelle where respiration occurs.',
      a: 'Nucleus',
      mark: 'wrong',
      comment: 'Incorrect. Respiration occurs in the mitochondria.'
    }
  ];

  const getMarkClass = (mark: string) => {
    if (mark === 'correct') return 'bg-olive/10 text-olive';
    if (mark === 'wrong') return 'bg-red-50 text-red-600';
    if (mark === 'half') return 'bg-orange-50 text-orange-600';
    return 'bg-sage/10 text-sage';
  };

  const getMarkLabel = (mark: string) => {
    if (mark === 'correct') return 'Full Marks';
    if (mark === 'wrong') return 'Incorrect';
    if (mark === 'half') return 'Partial Credit';
    return 'Unmarked';
  };
</script>

<div class="h-full bg-cream flex flex-col overflow-y-auto pb-24 relative">
  <header class="px-4 py-4 flex items-center justify-between sticky top-0 bg-paper/80 backdrop-blur-md z-10 border-b border-black/5">
    <button onclick={() => onback?.()} class="p-2 -ml-2 text-sage bg-transparent cursor-pointer border-none hover:text-olive transition-colors flex items-center justify-center w-10 h-10 bg-theme-card rounded-[20px] shadow-sm border border-sage/10">
      <ChevronLeft size={20} />
    </button>
    <h2 class="text-sm font-bold text-ink uppercase tracking-widest">Exam Results</h2>
    <div class="w-10"></div>
  </header>

  <div class="px-6 py-6 pb-24 w-full text-left">
    <div class="text-center mb-8">
      <div class="w-20 h-20 bg-olive rounded-full text-white mx-auto flex items-center justify-center text-3xl font-bold shadow-lg mb-4">
        75<span class="text-sm">%</span>
      </div>
      <h3 class="font-bold text-ink text-lg uppercase tracking-tight">UCE Biology Paper 2</h3>
      <p class="text-xs text-sage font-medium mt-1">Marked by Dr. Simon Okello</p>
    </div>

    <div class="space-y-6">
      {#each questions as q, index}
      <div class="bg-theme-card p-5 rounded-[20px] border border-sage/10 shadow-sm">
        <div class="flex items-center justify-between mb-4 pb-4 border-b border-sage/10">
           <span class="font-bold text-ink text-sm">Question {index + 1}</span>
           <div class="{getMarkClass(q.mark)} px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest">
             {getMarkLabel(q.mark)}
           </div>
        </div>
        
        <p class="text-sm font-medium text-ink mb-4">{q.q}</p>
        
        <div class="bg-cream p-4 rounded-[20px] mb-4 border border-sage/10">
          <span class="text-[9px] text-sage font-bold uppercase tracking-widest block mb-2">Your Answer</span>
          <p class="text-xs text-ink whitespace-pre-wrap">{q.a}</p>
        </div>

        {#if q.comment}
        <div class="flex gap-3 bg-blue-50/50 p-4 rounded-[20px] border border-blue-100/50 relative">
           <div class="absolute -top-1 -left-1 w-3 h-3 bg-accent rounded-full border-2 border-white"></div>
           <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex flex-shrink-0 items-center justify-center">
             <MessageSquare size={14} />
           </div>
           <div>
             <span class="text-[9px] text-blue-600 font-bold uppercase tracking-widest block mb-1">Teacher's Feedback</span>
             <p class="text-xs text-ink/80 font-medium leading-relaxed">{q.comment}</p>
           </div>
        </div>
        {/if}
      </div>
      {/each}
    </div>
  </div>
</div>
