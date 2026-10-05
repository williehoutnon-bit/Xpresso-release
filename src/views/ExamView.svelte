<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { 
    ChevronLeft, ChevronRight, Clock, ChevronDown, ChevronUp,
    Camera, Info, CheckCircle2, 
    XCircle, SkipForward, BookOpen,
    X, Bookmark, Share2, Award, ClipboardCheck, Zap, GraduationCap
  } from 'lucide-svelte';
  import type { Exam, Question } from '../types';

  function triggerNotification(title: string, options: any) {
    console.log(`Notification: ${title}`, options);
  }

  let { 
    exam, 
    initialMode, 
    onexit, 
    onviewrules 
  } = $props<{
    exam: Exam;
    initialMode?: 'classroom' | 'practice';
    onexit?: () => void;
    onviewrules?: () => void;
  }>();

  type ExamMode = 'classroom' | 'practice';
  type ExamState = 'setup' | 'ongoing' | 'finished' | 'corrections';

  let examState = $state<ExamState>(initialMode ? 'ongoing' : 'setup');
  let mode = $state<ExamMode>(initialMode || 'classroom');
  let answers = $state<Record<string, number>>({});
  let timeLeft = $state((exam?.durationMinutes || 60) * 60);
  let showExplanationPanel = $state(false);
  let activePanelQuestion = $state<Question | null>(null);
  let score = $state(0);
  let bookmarks = $state<Set<string>>(new Set());
  let captured = $state<Record<string, boolean>>({});

  // Scroll logic
  let scrollContainer = $state<HTMLElement | null>(null);
  let showScrollDown = $state(true);
  let showScrollTop = $state(false);

  const isFirstInSection = (index: number) => {
    if (!exam?.questions) return false;
    const curr = exam.questions[index];
    if (!curr.section) return false;
    if (index === 0) return true;
    const prev = exam.questions[index - 1];
    return curr.section !== prev.section;
  };

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

  let timer: number | null = null;

  $effect(() => {
    if (examState === 'ongoing') {
      timer = window.setInterval(() => {
        timeLeft = Math.max(0, timeLeft - 1);
      }, 1000);
    } else if (timer) {
      clearInterval(timer);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  });

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const shouldShowResult = (qid: string) => {
    const isAnswered = answers[qid] !== undefined;
    return (mode === 'practice' && isAnswered) || examState === 'corrections';
  };

  const startExam = (selectedMode: ExamMode) => {
    mode = selectedMode;
    examState = 'ongoing';
    setTimeout(() => {
      showScrollDown = true;
      showScrollTop = false;
    }, 100);
  };

  const handleSelect = (qid: string, idx: number) => {
    if (examState === 'corrections') return;
    if (mode === 'practice' && answers[qid] !== undefined) return;
    
    answers[qid] = idx;
    answers = answers;
  };

  const getStyle = (question: Question, idx: number) => {
    const selected = answers[question.id] === idx;
    const isCorrect = idx === question.correctIndex;

    if (shouldShowResult(question.id)) {
      if (isCorrect) return "bg-accent/10 border-accent text-accent font-bold";
      if (selected && !isCorrect) return "bg-coral/10 border-coral text-coral font-bold";
      return "bg-theme-card border-sage/10 text-sage opacity-60";
    }
    
    if (selected) return "bg-cream border-olive text-olive font-bold";
    return "border-sage/20 hover:border-olive/40 bg-paper shadow-sm";
  };

  const toggleBookmark = (qid: string) => {
    const newSet = new Set(bookmarks);
    if (newSet.has(qid)) {
      newSet.delete(qid);
    } else {
      newSet.add(qid);
    }
    bookmarks = newSet;
  };

  const toggleCapture = (qid: string) => {
    captured[qid] = !captured[qid];
    captured = captured;
  };

  const calculateScore = () => {
    let s = 0;
    exam?.questions?.forEach(q => {
      if (answers[q.id] === q.correctIndex) s++;
    });
    score = s;
  };

  const handleSubmit = () => {
    calculateScore();
    examState = 'finished';
    setTimeout(() => {
      triggerNotification('Score Saved', { body: 'Your score has been updated.', type: 'success' });
    }, 500);
  };

  const openExplanationPanel = (q: Question) => {
    activePanelQuestion = q;
    showExplanationPanel = true;
  };
</script>

<div class="h-full">
  {#if examState === 'setup'}
    <div class="h-full bg-cream p-8 flex flex-col items-center justify-center text-center">
      <div class="max-w-xs w-full bg-paper p-8 rounded-[20px] border border-sage/10 transform transition-transform">
        <div class="w-16 h-16 bg-olive/10 text-olive rounded-[20px] flex items-center justify-center mx-auto mb-6">
          <ClipboardCheck size={32} />
        </div>
        <h2 class="text-xl font-bold mb-2">{exam?.title}</h2>
        <p class="text-sage text-xs font-bold uppercase tracking-widest mb-8">How would you like to sit this exam?</p>
        
        <div class="space-y-4">
          <button 
            onclick={() => startExam('classroom')}
            class="w-full bg-transparent cursor-pointer p-5 rounded-[20px] border-2 border-sage/10 hover:border-olive transition-all group flex items-start gap-4 text-left"
          >
            <div class="w-10 shrink-0 h-10 rounded-full bg-cream flex items-center justify-center border border-sage/10 group-hover:bg-olive group-hover:text-white transition-colors">
               <GraduationCap size={20} />
            </div>
            <div>
              <div class="font-bold text-ink text-sm">Classroom Mode</div>
              <p class="text-[10px] text-sage mt-1">Submit whole exam first, then see corrections.</p>
            </div>
          </button>
  
          <button 
            onclick={() => startExam('practice')}
            class="w-full bg-transparent cursor-pointer p-5 rounded-[20px] border-2 border-sage/10 hover:border-olive transition-all group flex items-start gap-4 text-left"
          >
            <div class="w-10 shrink-0 h-10 rounded-full bg-cream flex items-center justify-center border border-sage/10 group-hover:bg-accent group-hover:text-white transition-colors">
               <Zap size={20} />
            </div>
            <div>
              <div class="font-bold text-ink text-sm">Practice Mode</div>
              <p class="text-[10px] text-sage mt-1">Receive corrections one question at a time.</p>
            </div>
          </button>
        </div>
  
        <button onclick={() => onexit?.()} class="mt-8 text-sage bg-transparent border-none cursor-pointer text-[10px] font-bold uppercase tracking-widest hover:text-olive">
          Maybe later
        </button>
      </div>
    </div>
  {:else if examState === 'finished'}
    <div class="h-full bg-cream p-8 flex flex-col items-center justify-center text-center">
      <div class="max-w-xs w-full bg-paper p-8 rounded-[20px] border border-sage/10 transform transition-transform">
        <div class="w-20 h-20 bg-accent text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
          <Award size={40} />
        </div>
        <h2 class="text-2xl font-bold mb-1">Results Submitted</h2>
        <p class="text-sage text-xs font-bold uppercase tracking-widest mb-6">{exam?.title}</p>
        
        <div class="bg-cream rounded-[20px] p-6 mb-8 border border-sage/10">
           <div class="text-4xl font-bold text-olive">{Math.round((score / (exam?.questions?.length || 1)) * 100)}%</div>
           <p class="text-[10px] text-sage font-bold uppercase tracking-[0.2em] mt-2">Final Score: {score}/{exam?.questions?.length || 0}</p>
        </div>
  
        <div class="space-y-3">
          <button 
            onclick={() => examState = 'corrections'}
            class="w-full py-4 bg-olive cursor-pointer border-none text-white rounded-[20px] font-bold uppercase tracking-widest text-xs shadow-sm"
          >
            See Corrections Now
          </button>
          <button 
            onclick={() => onexit?.()}
            class="w-full py-4 bg-paper cursor-pointer border border-sage/10 text-ink rounded-[20px] font-bold uppercase tracking-widest text-xs"
          >
            Remind Me Later
          </button>
        </div>
      </div>
    </div>
  {:else}
    <div class="h-full bg-cream flex flex-col relative text-ink">
      <!-- Header -->
      <header class="h-14 flex items-center justify-between px-4 border-b border-black/5 bg-paper sticky top-0 z-20 shadow-sm shrink-0">
        <button onclick={() => onexit?.()} class="p-2 -ml-2 bg-transparent border-none cursor-pointer text-sage hover:text-olive transition-colors">
          <ChevronLeft size={24} />
        </button>
        
        <div class="flex items-center gap-2 bg-cream px-3 py-1 rounded-full border border-sage/10">
          <Clock size={14} class={timeLeft < 300 ? 'text-accent animate-pulse' : 'text-sage'} />
          <span class="text-xs font-mono font-bold {timeLeft < 300 ? 'text-accent' : 'text-olive'}">
            {formatTime(timeLeft)}
          </span>
        </div>
  
        <div class="text-[10px] uppercase font-bold text-sage tracking-widest flex items-center gap-2">
           <span class="hidden sm:inline">{Object.keys(answers).length} / {exam?.questions?.length || 0} Answered</span>
           {#if mode === 'classroom' && examState === 'ongoing'}
             <button 
               onclick={handleSubmit}
               class="px-4 py-1.5 bg-accent cursor-pointer border-none text-white rounded-[20px] font-bold uppercase tracking-widest text-[9px] shadow-sm ml-2"
             >
               Submit
             </button>
           {/if}
        </div>
      </header>
  
      <!-- Progress Bar -->
      <div class="h-1 w-full bg-sage/10 shrink-0">
        <div 
          class="h-full bg-olive transition-all"
          style="width: {(Object.keys(answers).length / (exam?.questions?.length || 1)) * 100}%"
        ></div>
      </div>
  
      <!-- Floating Scroll Helpers -->
      <div class="fixed top-[64px] left-1/2 -translate-x-1/2 flex justify-center z-30 pointer-events-none transition-opacity duration-300 {showScrollDown ? 'opacity-100' : 'opacity-0'}">
         <div class="flex flex-col items-center gap-1 animate-bounce">
            <div class="w-6 h-6 bg-theme-card/90 backdrop-blur-xl border border-black/5 shadow-sm rounded-full flex items-center justify-center text-sage">
               <ChevronDown size={14} />
            </div>
         </div>
      </div>

      <div class="fixed bottom-24 right-6 flex justify-center z-30 transition-opacity duration-300 {showScrollTop ? 'opacity-100' : 'opacity-0'}">
         <button onclick={scrollToTop} class="w-10 h-10 bg-orange-300 hover:bg-orange-400 transition-colors cursor-pointer border-none text-white rounded-full flex items-center justify-center shadow-lg border border-white/50 active:scale-95">
            <ChevronUp size={20} />
         </button>
      </div>

      <!-- Question Content: Vertically Scrolling -->
      <div class="flex-1 overflow-y-auto w-full relative" onscroll={handleScroll} bind:this={scrollContainer}>

        <div class="max-w-3xl mx-auto p-4 md:p-8 space-y-12 pb-32 pt-2 text-left">
          
          {#if exam?.rulesAndGuidelines}
            <div class="bg-paper p-6 md:p-8 rounded-[20px] shadow-sm border border-red-500/20 max-w-sm mx-auto text-center" id="exam-rules">
               <div class="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Info size={24} />
               </div>
               <h3 class="text-sm font-bold text-red-500 uppercase tracking-widest mb-2">Rules & Guidelines</h3>
               <p class="text-xs text-ink/80 leading-relaxed mb-4">{exam.rulesAndGuidelines}</p>
               <button onclick={() => onviewrules?.()} class="text-[10px] text-red-500 bg-transparent border-none cursor-pointer font-bold uppercase tracking-widest hover:underline">Read All Rules</button>
            </div>
          {/if}

          {#each exam?.questions || [] as question, index (question.id)}
            
            {#if isFirstInSection(index) && question.section}
              <div class="bg-paper p-6 md:p-8 rounded-[20px] shadow-sm border border-sage/10 relative text-center mb-12 mt-12 first:mt-4">
                 <h2 class="text-xl md:text-2xl font-bold text-ink">{question.section}</h2>
                 <p class="text-[10px] font-bold text-sage mt-2 uppercase tracking-[0.2em]">({question.section.toUpperCase()} {question.section === 'Section A' ? '60' : '40'} marks)</p>
              </div>
            {/if}

            <div 
              class="bg-theme-card p-6 md:p-8 rounded-[20px] shadow-sm border border-black/5 relative mb-12"
              id="question-{index}"
            >
              <!-- Sticky page number simulation -->
              {#if question.pageNumber}
                <div class="hidden md:flex absolute -left-16 top-0 h-full flex-col items-center">
                  <div class="sticky top-20 flex flex-col items-center">
                     <div class="w-10 h-10 rounded-[20px] bg-sage/10 text-sage flex items-center justify-center text-xs font-bold font-mono">P.{question.pageNumber}</div>
                  </div>
                </div>
              {/if}

              <div class="mb-6 flex items-center justify-between border-b border-sage/10 pb-4">
                <span class="text-[10px] font-bold uppercase tracking-widest text-olive bg-olive/10 px-3 py-1.5 rounded-[20px] border border-olive/20">
                  {#if question.section}{question.section} · {/if}Q{question.questionNumber || (index + 1)}
                </span>
                <div class="flex gap-2">
                  <button 
                    onclick={() => toggleBookmark(question.id)} 
                    class="hover:text-olive transition-colors bg-transparent border-none cursor-pointer {bookmarks.has(question.id) ? 'text-olive' : 'text-sage'}"
                  >
                    <Bookmark size={18} fill={bookmarks.has(question.id) ? 'currentColor' : 'none'} />
                  </button>
                </div>
              </div>
        
              <h3 class="text-xl md:text-2xl font-bold text-ink leading-snug mb-6 ">
                {question.text}
              </h3>
        
              {#if question.illustration}
                <div class="mb-8 rounded-[20px] overflow-hidden border border-accent/20 bg-accent/5 shadow-sm">
                  <img 
                    src={question.illustration} 
                    alt="Question illustration" 
                    referrerpolicy="no-referrer"
                    class="w-full h-auto object-cover max-h-60"
                  />
                </div>
              {/if}
        
              {#if question.requiresDrawing}
                <button
                  onclick={() => toggleCapture(question.id)}
                  class="w-full mb-8 flex items-center cursor-pointer justify-center gap-3 py-6 border-2 border-dashed rounded-[20px] transition-colors group {captured[question.id] ? 'border-olive text-olive bg-olive/10' : 'border-accent/30 text-accent hover:bg-theme-card'}"
                >
                  <Camera size={24} class={captured[question.id] ? '' : 'group-hover:scale-110 transition-transform'} />
                  <span class="font-bold text-sm uppercase tracking-widest">{captured[question.id] ? 'Answer Captured' : 'Capture Answer'}</span>
                </button>
              {/if}
        
              <div class="space-y-3">
                {#each question.options as opt, oIdx}
                  <button
                    onclick={() => handleSelect(question.id, oIdx)}
                    disabled={shouldShowResult(question.id)}
                    class="w-full flex items-center justify-between p-4 cursor-pointer disabled:cursor-default rounded-[20px] border-2 transition-all text-left {getStyle(question, oIdx)}"
                  >
                    <div class="flex items-center gap-4">
                      <div class="w-8 h-8 rounded-full flex shrink-0 items-center justify-center font-bold text-sm border {
                        shouldShowResult(question.id) 
                          ? (oIdx === question.correctIndex ? 'bg-accent border-accent text-white' : (answers[question.id] === oIdx ? 'bg-coral border-coral text-white' : 'bg-cream border-sage/10 text-sage opacity-60'))
                          : (answers[question.id] === oIdx ? 'bg-olive border-olive text-white' : 'bg-cream border-sage/10 text-sage')
                      }">
                        {String.fromCharCode(65 + oIdx)}
                      </div>
                      <span class="font-medium text-sm leading-snug">{opt}</span>
                    </div>
                    {#if shouldShowResult(question.id) && oIdx === question.correctIndex}
                      <CheckCircle2 size={18} class="text-accent shrink-0" />
                    {:else if shouldShowResult(question.id) && answers[question.id] === oIdx && oIdx !== question.correctIndex}
                      <XCircle size={18} class="text-coral shrink-0" />
                    {/if}
                  </button>
                {/each}
              </div>
        
              {#if shouldShowResult(question.id)}
                <div class="mt-8 space-y-4">
                  <div class="p-5 bg-paper rounded-[20px] border border-sage/10 transition-all">
                    <div class="flex items-center gap-2 mb-3">
                      <Info size={16} class="text-olive" />
                      <span class="font-bold text-ink text-xs uppercase tracking-widest">Worked Explanation</span>
                    </div>
                    <p class="text-sm text-ink/70 leading-relaxed mb-4">
                      {question.explanation}
                    </p>
                    {#if answers[question.id] !== question.correctIndex && answers[question.id] !== undefined && question.optionExplanations}
                      <div class="p-4 bg-coral/5 rounded-[20px] border border-coral/20 mt-4 mb-4">
                        <span class="text-xs font-bold text-coral uppercase tracking-widest block mb-1">Why your answer was incorrect:</span>
                        <p class="text-sm text-ink/80 leading-relaxed">{question.optionExplanations[answers[question.id]]}</p>
                      </div>
                    {/if}
                    {#if answers[question.id] === question.correctIndex && answers[question.id] !== undefined && question.optionExplanations}
                      <div class="p-4 bg-accent/5 rounded-[20px] border border-accent/20 mt-4 mb-4">
                        <span class="text-xs font-bold text-accent uppercase tracking-widest block mb-1">Why this is correct:</span>
                        <p class="text-sm text-ink/80 leading-relaxed">{question.optionExplanations[answers[question.id]]}</p>
                      </div>
                    {/if}
                    <button 
                      onclick={() => openExplanationPanel(question)}
                      class="text-[10px] font-bold text-olive bg-transparent border-none cursor-pointer uppercase tracking-widest hover:underline flex items-center gap-1"
                    >
                      Depth: {question.broadTopic} <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              {/if}
            </div>
          {/each}
          
          {#if mode === 'classroom' && examState === 'ongoing'}
            <div class="py-12 flex justify-center border-t border-black/5 mt-8">
               <button 
                 onclick={handleSubmit}
                 class="px-8 py-4 bg-accent border-none cursor-pointer text-white rounded-[20px] font-bold uppercase tracking-widest text-xs shadow-md hover:bg-ink hover:scale-105 transition-all"
               >
                 Submit Entire Exam
               </button>
            </div>
          {/if}
          {#if examState === 'corrections'}
            <div class="py-12 flex justify-center border-t border-black/5 mt-8">
               <button 
                 onclick={() => onexit?.()}
                 class="px-8 py-4 bg-olive border-none cursor-pointer text-white rounded-[20px] font-bold uppercase tracking-widest text-xs shadow-md hover:bg-ink hover:scale-105 transition-all"
               >
                 Finish Review
               </button>
            </div>
          {/if}
        </div>
      </div>
  
      <!-- Side Panel (Notes) -->
      {#if showExplanationPanel}
        <div class="fixed z-[60]">
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div 
            onclick={() => showExplanationPanel = false}
            class="fixed inset-0 bg-ink/40 backdrop-blur-sm"
          ></div>
          <div 
            class="fixed inset-y-0 right-0 w-[85%] max-w-md bg-cream shadow-2xl flex flex-col border-l border-black/5 transition-transform"
          >
            <header class="h-14 flex items-center justify-between px-4 border-b border-black/5 bg-paper shrink-0">
              {#if activePanelQuestion}
                <span class="font-bold text-ink text-xs uppercase tracking-widest truncate max-w-[200px]">{activePanelQuestion.broadTopic}</span>
              {/if}
              <button onclick={() => showExplanationPanel = false} class="p-2 ml-auto cursor-pointer bg-transparent border-none">
                <X size={20} class="text-sage" />
              </button>
            </header>
            <div class="flex-1 overflow-y-auto p-6 prose prose-slate">
              <div class="bg-sage/10 p-4 rounded-[20px] mb-6 text-[10px] text-olive font-bold uppercase tracking-wider flex gap-3">
                 <BookOpen size={16} class="shrink-0" />
                 <div>Study Note Snippet: This topic often accounts for 15% of Paper marks.</div>
              </div>
              {#if activePanelQuestion}
                <div class="text-sm text-ink/80 leading-relaxed">
                  {activePanelQuestion.notesSnippet}
                </div>
              {/if}
            </div>
            <footer class="p-6 border-t border-black/5 bg-paper shrink-0">
              <button 
                onclick={() => showExplanationPanel = false}
                class="w-full py-4 bg-olive text-white cursor-pointer border-none rounded-[20px] font-bold shadow-sm uppercase tracking-widest text-xs"
              >
                Return to Questions
              </button>
            </footer>
          </div>
        </div>
      {/if}

    </div>
  {/if}
</div>
