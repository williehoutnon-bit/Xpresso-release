<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { MessageSquare, Heart, Share2, Plus, Search, Trophy, Star, CheckCircle2, X, ChevronLeft } from 'lucide-svelte';
  import { MOCK_SUBJECT_LEADERS } from '../types';
  import { friendshipService } from '../services/friendshipService';

  function triggerNotification(title: string, options: any) {
    console.log(`Notification: ${title}`, options);
  }

  let { onviewprofile, onback, timeLeft } = $props<{
    onviewprofile?: () => void;
    onback?: () => void;
    timeLeft?: number;
  }>();

  const formattedTime = $derived(timeLeft !== undefined ? `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}` : null);

  let currentSlide = $state(0);
  let activeCategory = $state('All');
  let viewingPost = $state<any>(null);

  const categories = ['All', 'Biology', 'Maths', 'Chemistry', 'Physics', 'Geography'];

  let sumTimer: number | null = null;
  let dummyPosts = $state<any[]>([]);

  onMount(async () => {
    sumTimer = window.setInterval(() => {
      currentSlide = (currentSlide + 1) % MOCK_SUBJECT_LEADERS.length;
    }, 4000);

    try {
       const leader = await friendshipService.getLeaderboard(5);
       const u1 = leader[0]?.name || 'Student A';
       const u2 = leader[1]?.name || 'Student B';
       const u3 = leader[2]?.name || 'Student C';
       const u4 = leader[3]?.name || 'Student D';

       dummyPosts = [
          {
            id: 1,
            authorInitial: u1.charAt(0),
            authorColor: 'bg-olive/10 text-olive',
            authorName: u1,
            badge: 'UCE Maths',
            category: 'Maths',
            title: 'How do you find the turning point of a quadratic equation?',
            snippet: 'I can solve them but I always forget which method to use for the turning point. Is it completing the square every time?',
            answers: 2,
            likes: 7,
            time: '2 hrs ago',
            answered: false,
            dummyReplies: [
              { teacher: true, name: 'Mr. Kato', time: '1 hr ago', initial: 'T', text: 'You can use completing the square, but the quickest way is using x = -b/2a. Once you find x, substitute it back into the equation to find y. Both methods are valid for UCE!' },
              { teacher: false, name: u2, time: '30 mins ago', initial: u2.charAt(0), text: 'Thank you Mr. Kato! I used to struggle with this too.' }
            ]
          },
          {
            id: 2,
            authorInitial: u3.charAt(0),
            authorColor: 'bg-accent/10 text-accent',
            authorName: u3,
            badge: 'UCE Biology',
            category: 'Biology',
            title: 'What is the difference between osmosis and diffusion?',
            snippet: 'I keep mixing them up in exams. Can someone give me a simple way to remember the difference?',
            answers: 2,
            likes: 14,
            time: '5 hrs ago',
            answered: true,
            dummyReplies: [
              { teacher: true, name: 'Mrs. Nakazi', time: '2 hrs ago', initial: 'N', text: 'In simple terms: Osmosis is specifically the movement of water molecules through a partially permeable membrane. Diffusion is the movement of any particles (gas or liquid).' },
              { teacher: false, name: u1, time: '1 hr ago', initial: u1.charAt(0), text: 'Also osmosis NEEDS a partially permeable membrane, diffusion does not necessarily need one.' }
            ]
          },
          {
            id: 3,
            authorInitial: u4.charAt(0),
            authorColor: 'bg-sage/10 text-sage',
            authorName: u4,
            badge: 'UCE Chemistry',
            category: 'Chemistry',
            title: 'In electrolysis, why is hydrogen produced at the cathode not oxygen?',
            snippet: 'I got this wrong in our last test. Mr. Kato said I confused the electrodes. Please help!',
            answers: 1,
            likes: 5,
            time: '1 day ago',
            answered: false,
            dummyReplies: [
              { teacher: false, name: u2, time: '12 hrs ago', initial: u2.charAt(0), text: 'Remember PANIC: Positive is Anode, Negative Is Cathode. Hydrogen ions (H+) are positive so they are attracted to the negative cathode.' }
            ]
          }
       ];
    } catch (e) {
       console.error('Failed to load mock post owners', e);
    }
  });

  onDestroy(() => {
    if (sumTimer) clearInterval(sumTimer);
  });

  const handleNewPost = () => {
    triggerNotification('New Post', { body: 'Opening question composer...', type: 'info' });
  };

  const handleViewProfile = () => {
    viewingPost = null;
    onviewprofile?.();
  };

  let filteredPosts = $derived(
    activeCategory === 'All' ? dummyPosts : dummyPosts.filter(p => p.category === activeCategory)
  );
</script>

<div class="flex flex-col min-h-full bg-cream pb-8">
  <header class="py-4 border-b border-sage/10 sticky top-0 bg-paper z-20 shadow-sm mx-[-16px] px-[24px]">
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-3">
        {#if onback}
           <button onclick={onback} class="bg-transparent border border-sage/20 rounded-full w-8 h-8 flex items-center justify-center text-ink cursor-pointer hover:bg-sage/10 transition-colors p-0">
              <ChevronLeft size={18} />
           </button>
        {/if}
        <div>
          <h2 class="text-sm uppercase tracking-widest font-bold text-ink leading-tight">Forum & Insights</h2>
          {#if formattedTime}
            <div class="text-[10px] font-bold text-[#E58A3A] uppercase tracking-widest flex items-center gap-1 mt-0.5">
               <span class="w-1.5 h-1.5 rounded-full bg-[#E58A3A] animate-pulse"></span>
               Time Left: {formattedTime}
            </div>
          {/if}
        </div>
      </div>
      <button onclick={handleNewPost} class="p-2 bg-cream text-olive border-none cursor-pointer rounded-full border border-sage/10 transition-colors hover:bg-sage/10">
        <Plus size={20} />
      </button>
    </div>
    <div class="flex gap-2 overflow-x-auto no-scrollbar mb-4 pb-1">
      {#each categories as cat (cat)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <button 
          onclick={() => activeCategory = cat}
          class="whitespace-nowrap px-4 py-1.5 rounded-full border-none cursor-pointer text-[10px] font-bold uppercase tracking-widest transition-all border {activeCategory === cat ? 'bg-olive text-white border-olive shadow-sm' : 'bg-theme-card text-sage border-sage/20 hover:border-sage'}"
        >
          {cat}
        </button>
      {/each}
    </div>
    
    <div class="flex items-center gap-2">
       <div class="flex-1 relative">
         <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-sage" size={16} />
         <input 
          type="text" 
          placeholder="Search questions..." 
          class="w-full bg-cream border border-sage/10 rounded-full py-2.5 pl-10 pr-4 text-xs focus:ring-1 focus:ring-olive transition-all outline-none text-ink placeholder:text-sage font-medium" 
         />
       </div>
    </div>
  </header>

  <div class="p-4 space-y-4">
    
    <!-- Subject Leaders Slideshow Restored -->
    <section class="mb-4 mt-2">
       <div class="flex items-center justify-between mb-3 px-2">
          <div class="flex items-center gap-2">
            <Trophy size={16} class="text-accent" />
            <h3 class="text-[10px] font-bold text-olive uppercase tracking-[0.2em]">Subject Leaders</h3>
          </div>
          <div class="flex gap-1">
            {#each MOCK_SUBJECT_LEADERS as _, i}
              <div class="h-1 rounded-full transition-all duration-300 {i === currentSlide ? 'w-4 bg-olive' : 'w-1 bg-sage/30'}"></div>
            {/each}
          </div>
       </div>
       
       <div class="relative h-32 w-full overflow-hidden rounded-[20px]">
          {#key currentSlide}
            <div
              transition:fade|local={{ duration: 300 }}
              class="absolute inset-0 bg-paper text-ink p-6 shadow-sm flex items-center justify-between border border-accent/20"
            >
               <div class="relative z-10 text-left">
                  <div class="flex items-center gap-2 mb-2">
                     <Star size={14} class="text-accent" fill="currentColor" />
                     <span class="text-[9px] font-bold text-sage uppercase tracking-widest">{MOCK_SUBJECT_LEADERS[currentSlide].subject}</span>
                  </div>
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div 
                    class="text-lg font-bold mb-1 text-ink cursor-pointer hover:underline"
                    onclick={() => onviewprofile?.()}
                  >
                    {MOCK_SUBJECT_LEADERS[currentSlide].name}
                  </div>
                  <div class="text-xs font-bold uppercase tracking-wider text-accent">{MOCK_SUBJECT_LEADERS[currentSlide].points.toLocaleString()} Pts</div>
               </div>
               <div class="relative z-10 w-12 h-12 bg-accent/5 rounded-full flex items-center justify-center text-lg font-bold border border-accent/10 text-accent">
                  #{currentSlide + 1}
               </div>
               <div class="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-accent/5 rounded-full blur-2xl pointer-events-none"></div>
            </div>
          {/key}
       </div>
    </section>

    <!-- Posts -->
    {#each filteredPosts as post (post.id)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div onclick={() => viewingPost = post} class="p-5 bg-paper border border-sage/10 rounded-[20px] shadow-sm hover:border-olive/30 transition-all cursor-pointer relative overflow-hidden">
        {#if post.answered}
          <div class="absolute top-0 right-0 w-2 h-full bg-olive"></div>
        {/if}
        <div class="flex items-start gap-3 mb-3">
          <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-base shrink-0 {post.authorColor}">
            {post.authorInitial}
          </div>
          <div class="w-full text-left">
            <div class="flex items-center gap-2 flex-wrap mb-1">
              <span class="font-bold text-ink text-xs uppercase tracking-wider">{post.authorName}</span>
              <span class="text-[9px] bg-sage/10 text-sage px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">{post.badge}</span>
              {#if post.answered}
                <span class="text-[9px] bg-olive/10 text-olive px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border border-olive/20 uppercase tracking-widest">
                  <CheckCircle2 size={10} /> Answered
                </span>
              {/if}
            </div>
            <h3 class="font-bold text-ink text-sm leading-tight mb-2">{post.title}</h3>
            <p class="text-xs text-sage leading-relaxed line-clamp-3">
              {post.snippet}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-6 pt-3 border-t border-sage/10 ml-13">
           <div class="flex items-center gap-1.5 text-sage text-[10px] font-bold uppercase tracking-widest hover:text-olive">
             <MessageSquare size={14} /> {post.answers} answers
           </div>
           <div class="flex items-center gap-1 text-sage text-[10px] font-bold uppercase tracking-widest hover:text-accent">
             <Heart size={14} /> {post.likes}
           </div>
           <div class="text-[9px] font-bold uppercase tracking-widest text-sage ml-auto">
             {post.time}
           </div>
        </div>
      </div>
    {/each}

  </div>

  {#if viewingPost}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div 
      onclick={() => viewingPost = null}
      class="fixed inset-0 bg-black/40 z-[60] backdrop-blur-sm"
    ></div>
    <div class="fixed bottom-0 left-0 right-0 max-h-[90vh] h-full sm:h-[80vh] sm:max-w-2xl sm:mx-auto sm:mb-10 sm:rounded-b-3xl bg-paper shadow-2xl z-[70] flex flex-col rounded-t-3xl overflow-hidden transition-transform text-left">
      <div class="h-14 border-b border-sage/10 flex items-center justify-between px-6 bg-cream shadow-sm relative z-10 shrink-0">
        <h3 class="font-bold text-ink uppercase tracking-widest text-xs">Discussion Thread</h3>
        <button onclick={() => viewingPost = null} class="text-sage bg-transparent border-none cursor-pointer hover:text-ink"><X size={20}/></button>
      </div>
      <div class="flex-1 overflow-y-auto p-4 sm:p-6 bg-cream space-y-6">
        <!-- Original Post -->
        <div class="bg-theme-card p-5 rounded-[20px] border border-sage/10 shadow-sm relative">
          {#if viewingPost.answered}
            <div class="absolute top-0 right-0 w-2 h-full bg-olive rounded-r-2xl"></div>
          {/if}
          <div class="flex items-start gap-3 mb-4">
            <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-base shrink-0 {viewingPost.authorColor}">
              {viewingPost.authorInitial}
            </div>
            <div>
               <div class="flex items-center gap-2 flex-wrap mb-1">
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <span 
                    class="font-bold text-ink text-xs uppercase tracking-wider cursor-pointer hover:underline"
                    onclick={handleViewProfile}
                  >
                    {viewingPost.authorName}
                  </span>
                  <span class="text-[9px] bg-sage/10 text-sage px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">{viewingPost.badge}</span>
                  {#if viewingPost.answered}
                    <span class="text-[9px] bg-olive/10 text-olive px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border border-olive/20 uppercase tracking-widest">
                      <CheckCircle2 size={10} /> Answered
                    </span>
                  {/if}
               </div>
               <div class="text-[9px] font-bold uppercase tracking-widest text-sage">{viewingPost.time}</div>
            </div>
          </div>
          <h2 class="text-base font-bold text-ink mb-3 leading-tight">{viewingPost.title}</h2>
          <p class="text-sm text-ink/80 leading-relaxed mb-4">{viewingPost.snippet}</p>
          <div class="flex items-center gap-4 pt-3 border-t border-sage/10">
              <button class="flex items-center gap-1.5 text-sage bg-transparent border-none cursor-pointer text-xs font-bold uppercase tracking-widest hover:text-accent transition-colors">
                <Heart size={16} /> {viewingPost.likes}
              </button>
              <button class="flex items-center gap-1.5 text-sage bg-transparent border-none cursor-pointer text-xs font-bold uppercase tracking-widest hover:text-olive transition-colors">
                <Share2 size={16} /> Share
              </button>
          </div>
        </div>
        
        <!-- Dummy Replies -->
        <div class="space-y-4">
          <h4 class="text-[10px] uppercase font-bold text-sage tracking-widest pl-2">Answers ({viewingPost.answers})</h4>
          {#each viewingPost.dummyReplies as reply, index}
            <div class="p-4 rounded-[20px] shadow-sm relative {reply.teacher ? 'bg-paper border border-olive/20' : 'bg-theme-card border border-sage/10'}">
              {#if reply.teacher}
                <div class="absolute top-0 left-0 w-1 h-full bg-olive rounded-l-2xl"></div>
              {/if}
              <div class="flex items-start gap-3 mb-2">
                <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 {reply.teacher ? 'bg-olive text-white' : 'bg-sage/20 text-sage'}">
                    {reply.initial}
                </div>
                <div>
                    <div class="flex items-center gap-2">
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <span 
                          class="font-bold text-ink text-xs uppercase tracking-wider cursor-pointer hover:underline"
                          onclick={handleViewProfile}
                        >
                          {reply.name} {reply.teacher ? '(Teacher)' : ''}
                        </span>
                        {#if reply.teacher}
                          <CheckCircle2 size={12} class="text-olive" />
                        {/if}
                    </div>
                    <div class="text-[9px] font-bold uppercase tracking-widest text-sage">{reply.time}</div>
                </div>
              </div>
              <p class="text-sm text-ink/80 leading-relaxed pl-11">
                  {reply.text}
              </p>
              {#if reply.teacher}
                <div class="flex justify-end gap-3 px-2 mt-2">
                    <button class="text-[9px] bg-transparent border-none cursor-pointer font-bold text-olive uppercase tracking-widest hover:underline">Helpful (12)</button>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
      
      <!-- Reply Input Area -->
      <div class="bg-paper border-t border-sage/10 p-4 shrink-0 flex gap-2">
          <div class="w-8 h-8 rounded-full bg-olive text-white border-2 border-white flex items-center justify-center text-xs font-bold shrink-0">
             Y
          </div>
          <input 
             type="text" 
             placeholder="Write an answer..." 
             class="flex-1 bg-cream border border-sage/20 rounded-full px-4 text-xs focus:outline-none focus:border-olive/50 focus:ring-1 focus:ring-olive/50 transition-all font-medium"
          />
          <button class="w-8 h-8 rounded-full bg-olive text-white border-none cursor-pointer flex items-center justify-center shrink-0 hover:bg-olive/90 transition-colors shadow-sm">
              <Plus size={16} />
          </button>
      </div>
    </div>
  {/if}
</div>
