<script lang="ts">
  import { ChevronLeft, ChevronDown, ChevronUp, X, Minus, Check, MessageSquarePlus, MessageSquare, Mic, Image as ImageIcon, Video } from 'lucide-svelte';

  function triggerNotification(title: string, options: any) {
    console.log(`Notification: ${title}`, options);
  }

  let { studentName = '', examTitle = '', onback, ondonemarking } = $props<{
    studentName?: string;
    examTitle?: string;
    onback?: () => void;
    ondonemarking?: () => void;
  }>();

  let questions = $state([
    { 
      id: 1, 
      q: 'Describe the process of photosynthesis.', 
      a: 'Photosynthesis is when plants use sunlight, water, and carbon dioxide to create oxygen and energy in the form of sugar. It happens in the chloroplasts.',
      mark: null as string | null,
      comment: ''
    },
    { 
      id: 2, 
      q: 'What is the role of chlorophyll?', 
      a: 'Chlorophyll is what gives plants their green color. I am not sure about its exact role but it helps with light.',
      mark: 'half',
      comment: 'Almost there! It primarily absorbs light energy to drive the photosynthetic reaction.'
    }
  ]);

  let activeCommentBox = $state<number | null>(null);
  let tempComment = $state('');

  const mark = (index: number, type: string) => {
    questions[index].mark = type;
  };

  const openCommentBox = (index: number) => {
    activeCommentBox = index;
    tempComment = questions[index].comment || '';
  };

  const saveComment = (index: number) => {
    if (tempComment.trim()) {
      questions[index].comment = tempComment;
    }
    activeCommentBox = null;
    tempComment = '';
  };

  // Scroll logic
  let scrollContainer = $state<HTMLElement | null>(null);
  let showScrollDown = $state(true);
  let showScrollTop = $state(false);

  const handleScroll = (e: Event) => {
    const target = e.target as HTMLElement;
    const scrollTop = target.scrollTop;
    
    if (scrollTop > 50) {
      showScrollDown = false;
    } else {
      showScrollDown = true;
    }
    
    if (scrollTop > 500) {
      showScrollTop = true;
    } else {
      showScrollTop = false;
    }
  };

  const scrollToTop = () => {
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const finishMarking = () => {
    triggerNotification('Marking Saved', { body: 'Results have been sent to the student and leaderboard updated.', type: 'success'});
    ondonemarking?.();
  };
</script>

<div class="h-full bg-cream flex flex-col overflow-hidden relative">
  <header class="px-4 py-4 flex items-center justify-between bg-paper border-b border-black/5 z-40 sticky top-0 shrink-0">
    <button onclick={() => onback?.()} class="p-2 -ml-2 text-sage bg-theme-card border border-sage/10 cursor-pointer hover:text-olive transition-colors flex items-center justify-center w-10 h-10 rounded-[20px] shadow-sm">
      <ChevronLeft size={20} />
    </button>
    <div class="text-center">
      <h2 class="text-sm font-bold text-ink uppercase tracking-widest">Marking</h2>
      <p class="text-[9px] text-sage font-bold uppercase tracking-widest">{studentName} · {questions.length} Questions</p>
    </div>
    <button onclick={finishMarking} class="px-3 py-1.5 bg-olive border-none cursor-pointer text-white text-[10px] font-bold uppercase tracking-widest rounded-[20px] shadow-sm">
      Done
    </button>
  </header>

  <!-- Floating Scroll Helpers -->
  <div class="fixed top-24 left-1/2 -translate-x-1/2 flex justify-center z-30 pointer-events-none transition-opacity duration-300 {showScrollDown ? 'opacity-100' : 'opacity-0'}">
     <div class="flex flex-col items-center gap-2 animate-bounce">
        <span class="text-[9px] font-bold uppercase tracking-[0.2em] text-sage/80 bg-theme-card/40 px-2 py-1 rounded-full backdrop-blur-sm shadow-sm border border-white/50">Scroll</span>
        <div class="w-8 h-8 bg-theme-card/80 backdrop-blur-xl border border-white/60 shadow-lg rounded-full flex items-center justify-center text-sage">
           <ChevronDown size={16} />
        </div>
     </div>
  </div>

  <div class="fixed bottom-28 right-6 flex justify-center z-30 transition-opacity duration-300 {showScrollTop ? 'opacity-100' : 'opacity-0'}">
     <button onclick={scrollToTop} class="w-10 h-10 bg-orange-400 hover:bg-orange-500 cursor-pointer border-none transition-colors text-white rounded-full flex items-center justify-center shadow-lg border border-black/10 shadow-orange-400/20 active:scale-95">
        <ChevronUp size={20} />
     </button>
  </div>

  <div class="flex-1 overflow-y-auto w-full p-4 md:p-8 pb-32" onscroll={handleScroll} bind:this={scrollContainer}>
    <div class="max-w-3xl mx-auto space-y-12">
      {#each questions as question, index (question.id)}
        <div class="relative">
          <div class="flex items-center gap-4 mb-4 border-b border-sage/10 pb-4">
            <span class="text-[10px] bg-sage/10 text-sage px-3 py-1.5 rounded-[20px] font-bold uppercase tracking-widest">Question {index + 1}</span>
          </div>

          <!-- Question -->
          <div class="bg-theme-card p-5 rounded-[20px] border border-sage/10 shadow-sm mb-6">
            <p class="text-sm font-medium text-ink leading-relaxed">
              {question.q}
            </p>
          </div>

          <!-- Student Answer -->
          <div class="bg-theme-card p-5 rounded-[20px] border border-sage/10 shadow-sm mb-6 relative">
            <span class="text-[10px] bg-accent/10 text-accent px-2 py-1 rounded-md font-bold uppercase tracking-widest mb-3 inline-block">Student's Answer</span>
            <p class="text-sm text-ink leading-relaxed whitespace-pre-wrap">
              {question.a}
            </p>

            <!-- Grading actions -->
            <div class="flex items-center gap-2 mt-6 pt-4 border-t border-sage/10">
              <button onclick={() => mark(index, 'wrong')} class="flex-1 py-3 border-none cursor-pointer rounded-[20px] font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all {question.mark === 'wrong' ? 'bg-red-500 text-white shadow-md' : 'bg-red-50 text-red-500 hover:bg-red-100'}">
                <X size={14} /> Wrong
              </button>
              <button onclick={() => mark(index, 'half')} class="flex-1 py-3 border-none cursor-pointer rounded-[20px] font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all {question.mark === 'half' ? 'bg-orange-400 text-white shadow-md' : 'bg-orange-50 text-orange-500 hover:bg-orange-100'}">
                <Minus size={14} /> Half
              </button>
              <button onclick={() => mark(index, 'correct')} class="flex-1 py-3 border-none cursor-pointer rounded-[20px] font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all {question.mark === 'correct' ? 'bg-olive text-white shadow-md' : 'bg-olive/10 text-olive hover:bg-olive/20'}">
                <Check size={14} /> Correct
              </button>
            </div>
          </div>

          <!-- Add Comment Button -->
          <div>
            {#if activeCommentBox !== index && !question.comment}
              <button onclick={() => openCommentBox(index)} class="w-full py-4 bg-sage/5 border border-dashed cursor-pointer border-sage/30 rounded-[20px] text-sage font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-sage/10 transition-colors">
                <MessageSquarePlus size={16} /> Add Feedback
              </button>

            {:else if question.comment && activeCommentBox !== index}
               <div class="bg-blue-50 p-4 rounded-[20px] border border-blue-100 flex items-start gap-3">
                <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-500 flex items-center justify-center shrink-0">
                   <MessageSquare size={14} />
                </div>
                <div class="flex-1">
                   <p class="text-sm font-medium text-ink">{question.comment}</p>
                   <button onclick={() => openCommentBox(index)} class="text-[10px] bg-transparent border-none cursor-pointer text-blue-500 font-bold uppercase mt-2 hover:underline">Edit</button>
                </div>
              </div>

            {:else if activeCommentBox === index}
               <div class="bg-theme-card p-4 rounded-[20px] border border-sage/20 shadow-lg animate-fade-in-up">
                 <textarea bind:value={tempComment} placeholder="Type feedback..." class="w-full h-20 p-3 bg-cream border border-sage/10 rounded-[20px] text-sm focus:outline-none focus:border-olive mb-3 resize-none"></textarea>
                 
                 <div class="flex justify-between items-center">
                   <div class="flex gap-2">
                     <button class="w-8 h-8 bg-transparent border-none rounded-full bg-sage/10 text-sage flex items-center justify-center hover:bg-olive/10 hover:text-olive transition-colors cursor-pointer relative" title="Voice note">
                       <Mic size={14} />
                     </button>
                     <button class="w-8 h-8 bg-transparent border-none rounded-full bg-sage/10 text-sage flex items-center justify-center hover:bg-olive/10 hover:text-olive transition-colors relative cursor-pointer" title="Attach picture">
                       <ImageIcon size={14} />
                     </button>
                     <button class="w-8 h-8 bg-transparent border-none rounded-full bg-sage/10 text-sage flex items-center justify-center hover:bg-olive/10 hover:text-olive transition-colors relative cursor-pointer" title="Attach video">
                       <Video size={14} />
                     </button>
                   </div>
                   <div class="flex gap-2">
                     <button onclick={() => activeCommentBox = null} class="px-4 bg-transparent border-none cursor-pointer py-2 text-xs font-bold text-sage">Cancel</button>
                     <button onclick={() => saveComment(index)} class="px-4 py-2 bg-olive border-none cursor-pointer text-white rounded-[20px] text-xs font-bold shadow-sm">Save</button>
                   </div>
                 </div>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>
