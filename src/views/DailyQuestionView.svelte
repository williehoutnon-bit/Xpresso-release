<script lang="ts">
  import { X, CheckCircle2, XCircle, Info } from 'lucide-svelte';
  import { fade, slide } from 'svelte/transition';
  import { MOCK_EXAM_UCE_BIO, type Question } from '../types';

  function triggerNotification(title: string, options: any) {
    console.log(`Notification: ${title}`, options);
  }

  let { onexit } = $props<{ onexit?: () => void }>();

  // Ensure that MOCK_EXAM_UCE_BIO and its questions array exist, fallback if not
  let question = $state<Question>(MOCK_EXAM_UCE_BIO?.questions[0] || {
    id: 'q1',
    text: 'During photosynthesis, which organelle traps light energy, and what role does chlorophyll play?',
    options: [
      'Mitochondria; it produces ATP',
      'Chloroplast; it absorbs light energy',
      'Nucleus; it stores DNA',
      'Ribosome; it synthesizes proteins'
    ],
    correctIndex: 1,
    explanation: 'Chloroplasts contain chlorophyll, which is the pigment responsible for capturing light energy used in the process of photosynthesis.',
    broadTopic: 'Photosynthesis',
    notesSnippet: 'Chloroplasts are the site of photosynthesis.'
  });

  let selectedOption = $state<number | null>(null);
  let isAnswered = $state(false);
  let showFollowup = $state(false);

  const selectOption = (idx: number) => {
    if (isAnswered) return;
    selectedOption = idx;
    isAnswered = true;
    
    setTimeout(() => {
      console.log('Database updated: daily question score saved locally to rxdb');
      if (idx === question.correctIndex) {
         triggerNotification('Streak Extended!', { body: 'You answered the daily question correctly. Points added to leaderboard.', type: 'success' });
      } else {
         triggerNotification('Daily Question Completed', { body: 'Check explanation below. Streak maintained.', type: 'info' });
      }
    }, 500);
  };

  const loadFollowup = () => {
    if (question.followup) {
      question = question.followup;
      selectedOption = null;
      isAnswered = false;
      showFollowup = false;
    }
  };
</script>

<div class="h-full flex flex-col bg-paper relative">
  <header class="p-6 pb-2 relative z-10 flex items-center justify-between">
    <button 
      onclick={() => onexit?.()}
      class="w-8 h-8 rounded-full bg-theme-card border-none cursor-pointer flex items-center justify-center text-sage shadow-sm border border-black/5"
    >
      <X size={16} />
    </button>
    <div class="text-[10px] font-bold tracking-widest uppercase text-accent">Today's Question</div>
  </header>

  <div class="flex-1 overflow-y-auto p-6 flex flex-col">
    <div class="bg-theme-card rounded-[20px] p-6 shadow-sm border border-sage/10 mb-6">
      <h2 class="text-lg font-medium text-ink leading-relaxed mb-6">
        {question.text}
      </h2>

      <div class="space-y-3">
        {#each question.options as option, idx}
          <button 
            onclick={() => selectOption(idx)}
            disabled={isAnswered}
            class="w-full text-left p-4 cursor-pointer disabled:cursor-default rounded-[20px] border transition-all {
               isAnswered
                ? (idx === question.correctIndex 
                    ? 'border-accent bg-accent/10 text-accent font-bold'
                    : (selectedOption === idx ? 'border-coral bg-coral/5 text-coral' : 'border-sage/20 text-ink/40'))
                : (selectedOption === idx 
                    ? 'border-olive bg-olive/5 text-olive' 
                    : 'border-sage/20 hover:border-olive/50 text-ink bg-transparent')
            }"
          >
            <div class="flex items-start gap-3">
              <div 
                class="w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 {
                  isAnswered
                    ? (idx === question.correctIndex
                        ? 'border-accent text-accent'
                        : (selectedOption === idx ? 'border-coral text-coral' : 'border-sage/20 text-ink/40'))
                    : (selectedOption === idx
                        ? 'border-olive text-olive'
                        : 'border-sage/30 text-sage')
                }"
              >
                {String.fromCharCode(65 + idx)}
              </div>
              <span class="font-medium text-sm pt-0.5">{option}</span>
              {#if isAnswered && idx === question.correctIndex}
                <CheckCircle2 class="ml-auto text-accent shrink-0" size={20} />
              {/if}
              {#if isAnswered && selectedOption === idx && idx !== question.correctIndex}
                <XCircle class="ml-auto text-coral shrink-0" size={20} />
              {/if}
            </div>
          </button>
        {/each}
      </div>
    </div>

    {#if isAnswered}
      <div transition:slide|local class="space-y-4">
        <div class="bg-blue/5 rounded-[20px] p-6 border border-blue/10">
          <h3 class="flex items-center gap-2 text-blue font-bold text-sm uppercase tracking-widest mb-3">
            <Info size={16} />
            Explanation
          </h3>
          <p class="text-sm font-medium text-ink leading-relaxed mb-4">
            {question.explanation}
          </p>
          {#if selectedOption !== question.correctIndex && selectedOption !== null && question.optionExplanations}
            <div class="p-4 bg-theme-card/60 rounded-[20px] border border-coral/20 mt-4">
              <span class="text-xs font-bold text-coral uppercase tracking-widest block mb-1">Why your answer was incorrect:</span>
              <p class="text-sm text-ink/80 leading-relaxed">{question.optionExplanations[selectedOption]}</p>
            </div>
          {/if}
          {#if selectedOption === question.correctIndex && selectedOption !== null && question.optionExplanations}
            <div class="p-4 bg-theme-card/60 rounded-[20px] border border-accent/20 mt-4">
              <span class="text-xs font-bold text-accent uppercase tracking-widest block mb-1">Why this is correct:</span>
              <p class="text-sm text-ink/80 leading-relaxed">{question.optionExplanations[selectedOption]}</p>
            </div>
          {/if}
        </div>
        
        {#if question.followup}
          <div class="bg-olive/5 rounded-[20px] p-6 border border-olive/10">
            <h3 class="flex items-center gap-2 text-olive font-bold text-sm uppercase tracking-widest mb-2">
              Follow-up Question
            </h3>
            <p class="text-sm font-medium text-ink leading-relaxed mb-4">
              You've completed this question. Want to test your knowledge with a related follow-up question?
            </p>
            <button
              onclick={loadFollowup}
              class="w-full py-3 bg-theme-card cursor-pointer border border-olive/20 text-olive rounded-[20px] font-bold uppercase tracking-widest text-xs hover:bg-olive/10 transition-colors"
            >
              Test Yourself
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
