<script lang="ts">
  import { ChevronLeft, Filter, Image as ImageIcon, Send, X, Clock, BookOpen } from 'lucide-svelte';
  import { onMount, onDestroy } from 'svelte';
  import { triggerNotification } from '../services/notificationService';

  let { role = 'student', onback } = $props<{ role?: string; onback?: () => void }>();

  let showSettings = $state(false);
  let newPost = $state('');
  let timeLeft = $state(300);
  let showTimeUp = $state(false);

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  let followedSchools = $state(['Gayaza High', 'Kings College', 'St. Marys']);

  const toggleFollow = (school: string) => {
    if (followedSchools.includes(school)) {
      followedSchools = followedSchools.filter(s => s !== school);
    } else {
      followedSchools = [...followedSchools, school];
    }
  };

  let timer: any = null;

  onMount(() => {
    const saved = localStorage.getItem('school_feed_timer');
    if (saved !== null) {
      timeLeft = parseInt(saved, 10);
    }
    if (role === 'student') startTimer();
  });

  onDestroy(() => {
    if (timer) clearInterval(timer);
  });

  const startTimer = () => {
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      if (timeLeft <= 0 && !showTimeUp) {
        showTimeUp = true;
        triggerNotification("Time's up!", {
          body: "You've used up your 5 minutes of feed browsing for today. Spend more time studying to earn more feed time!"
        });
        if (timer) clearInterval(timer);
        return;
      }
      if (timeLeft > 0) {
        timeLeft = Math.max(0, timeLeft - 1);
        localStorage.setItem('school_feed_timer', timeLeft.toString());
      }
    }, 1000);
  };
</script>

<div class="flex flex-col h-full bg-cream">
  <header class="px-6 py-4 bg-theme-card border-b border-sage/10 flex items-center justify-between sticky top-0 z-20 shadow-sm">
    <div class="flex items-center gap-3">
      <button onclick={() => onback?.()} class="p-2 -ml-2 text-sage cursor-pointer bg-transparent border-none hover:text-ink transition-colors rounded-[20px]">
        <ChevronLeft size={24} />
      </button>
      <h1 class="text-xl font-bold text-ink">School Network</h1>
    </div>
    <div class="flex items-center gap-3">
      {#if role === 'student'}
      <div class="flex items-center gap-2 px-3 py-1.5 rounded-full border {timeLeft < 60 ? 'bg-accent/10 border-accent/30 text-accent' : 'bg-olive/10 border-olive/30 text-olive'}">
        <Clock size={14} />
        <span class="text-xs font-bold font-mono">{formatTime(timeLeft)}</span>
      </div>
      {/if}
      <button onclick={() => showSettings = true} class="p-2 border-none cursor-pointer text-sage hover:text-ink transition-colors rounded-[20px] bg-sage/5">
        <Filter size={20} />
      </button>
    </div>
  </header>

  <div class="flex-1 overflow-y-auto w-full p-4 md:p-6 space-y-6 pb-24 max-w-3xl mx-auto {showTimeUp ? 'pointer-events-none blur-sm select-none' : ''}">
    <div class="bg-theme-card p-4 rounded-[20px] border border-sage/10 shadow-sm flex flex-col gap-3">
      <textarea 
        placeholder="What's happening at your school?" 
        class="w-full bg-transparent border-none resize-none text-sm font-medium text-ink outline-none placeholder:text-sage min-h-[60px]"
        bind:value={newPost}
      ></textarea>
      <div class="flex items-center justify-between border-t border-sage/10 pt-3">
        <button class="text-sage bg-transparent border-none cursor-pointer hover:text-olive transition-colors p-2 rounded-[20px] bg-sage/5">
          <ImageIcon size={18} />
        </button>
        <button class="bg-olive cursor-pointer text-white px-4 py-2 border-none rounded-[20px] text-xs font-bold uppercase tracking-widest hover:bg-olive/90 transition-colors flex items-center gap-2">
          Post <Send size={14} />
        </button>
      </div>
    </div>

    <div class="space-y-4">
      {#each [1,2,3] as i}
      <div class="bg-theme-card p-4 rounded-[20px] border border-sage/10 shadow-sm">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-full bg-sage/10 flex items-center justify-center">
            <span class="text-sm font-bold uppercase text-sage">GH</span>
          </div>
          <div>
            <p class="text-sm font-bold text-ink">Gayaza High Drama Club</p>
            <p class="text-[10px] font-bold text-sage uppercase tracking-widest">2 hours ago</p>
          </div>
        </div>
        <p class="text-sm text-ink mb-4">
          Join us this Friday for the grand performance of Romeo & Juliet! Tickets are available at the main hall entrance. We look forward to seeing you there!
        </p>
        {#if i === 1}
        <div class="w-full h-48 bg-sage/10 rounded-[20px] mb-4 flex items-center justify-center text-sage">
          <ImageIcon size={32} />
        </div>
        {/if}
        <div class="flex items-center gap-4 border-t border-sage/10 pt-3">
          <button class="text-xs bg-transparent border-none cursor-pointer font-bold text-sage hover:text-olive transition-colors">Like (24)</button>
          <button class="text-xs bg-transparent border-none cursor-pointer font-bold text-sage hover:text-olive transition-colors">Comment (5)</button>
        </div>
      </div>
      {/each}
    </div>
  </div>

  {#if showSettings}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div 
  class="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex justify-end" 
  onclick={(e) => { if(e.target === e.currentTarget) showSettings = false; }}
  aria-hidden="true"
>
    <div class="w-full max-w-sm h-full bg-cream shadow-2xl flex flex-col transform transition-transform text-left">
      <div class="p-6 border-b border-sage/10 flex items-center justify-between bg-theme-card">
        <h2 class="text-lg font-bold text-ink">Feed Filters</h2>
        <button onclick={() => showSettings = false} class="p-2 border-none bg-transparent cursor-pointer text-sage hover:text-ink rounded-full bg-sage/5">
          <X size={20} />
        </button>
      </div>
      <div class="p-6 flex-1 overflow-y-auto">
        <h3 class="text-[10px] font-bold text-sage uppercase tracking-widest mb-4">Follow Institutions</h3>
        <div class="space-y-3">
          {#each ['Gayaza High', 'Kings College', 'St. Marys', 'Namilyango College', 'Mt. St. Marys Namagunga'] as school}
          <div class="flex items-center justify-between bg-theme-card p-3 rounded-[20px] border border-sage/10">
            <span class="text-sm font-bold text-ink">{school}</span>
            <button 
              onclick={() => toggleFollow(school)}
              class="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 cursor-pointer border-none rounded-[20px] transition-colors {followedSchools.includes(school) ? 'bg-olive/10 text-olive' : 'bg-sage/10 text-sage hover:bg-olive/10 hover:text-olive'}"
            >
              {followedSchools.includes(school) ? 'Following' : 'Follow'}
            </button>
          </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
  {/if}

  {#if showTimeUp}
  <div class="fixed inset-0 bg-ink/60 backdrop-blur-md z-[100] flex items-center justify-center p-6 text-center">
    <div class="bg-theme-card p-8 rounded-[20px] max-w-sm w-full text-center shadow-2xl">
      <div class="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
        <BookOpen size={40} class="text-accent" />
      </div>
      <h2 class="text-2xl font-extrabold text-ink mb-3">Time's Up!</h2>
      <p class="text-sm text-sage mb-8 leading-relaxed">
        You've used up your 5 minutes of feed browsing for today. 
        <br/><strong class="text-ink">Spend more time studying to earn more feed time!</strong>
      </p>
      <button 
        onclick={() => onback?.()}
        class="w-full bg-olive border-none cursor-pointer text-white py-4 rounded-[20px] font-bold uppercase tracking-widest text-xs hover:bg-olive/90 transition-colors shadow-sm"
      >
        Return to Dashboard
      </button>
    </div>
  </div>
  {/if}
</div>
