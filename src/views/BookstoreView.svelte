<script lang="ts">
  import { ChevronLeft, ShoppingBag, Search, Tag, Share2, ExternalLink, CreditCard, CheckCircle2, ChevronRight } from 'lucide-svelte';
  import { fade } from 'svelte/transition';
  import { MOCK_TEXTBOOKS, type Textbook } from '../types';

  function triggerNotification(title: string, options: any) {
    console.log(`Notification: ${title}`, options);
  }

  let { onback, onnavigate, onviewfeeds, onviewideas } = $props<{
    onback?: () => void;
    onnavigate?: (view: string) => void;
    onviewfeeds?: () => void;
    onviewideas?: () => void;
  }>();

  let selectedBook = $state<Textbook | null>(null);
  let readingBook = $state<Textbook | null>(null);
  let currentChapterIndex = $state(0);
  let purchasedBooks = $state<string[]>([]);
  let sharesLeft = $state<Record<string, number>>({
    'b3': 3,
  });

  let showShareModal = $state(false);
  let showPublisherModal = $state(false);

  const handleBuy = (bookId: string) => {
    purchasedBooks = [...purchasedBooks, bookId];
    selectedBook = null;
    sharesLeft[bookId] = 3;
    triggerNotification('Purchase Successful!', { body: 'The book has been added to your notes.', type: 'info' });
  };

  const executeShare = (bookId: string) => {
    showShareModal = false;
    const left = sharesLeft[bookId] !== undefined ? sharesLeft[bookId] : 3;
    if (left > 0) {
      sharesLeft[bookId] = left - 1;
      triggerNotification('Shared!', { body: `You have ${left - 1} shares remaining for this textbook.`, type: 'info' });
    } else {
      triggerNotification('Limit Reached', { body: 'You have reached the sharing limit for this textbook.', type: 'warning' });
    }
  };

  const submitApplication = () => {
     showPublisherModal = false;
     triggerNotification('Application Sent', { body: 'We will review your application and get back to you.', type: 'success' });
  }

  const openBook = (book: Textbook) => {
    readingBook = book;
    currentChapterIndex = 0;
  };

  const MOCK_CHAPTERS = [
    {
      title: "Chapter 1: Foundations",
      content: "This chapter introduces the fundamental concepts of the subject. A solid foundation is crucial for grasping more complex ideas down the line. We will explore the basic terminology, historical context, and primary methodologies used in this field."
    },
    {
      title: "Chapter 2: Methods and Applications",
      content: "Building on the foundations, this chapter delves into practical applications. Theories are only as good as their usefulness in the real world. We examine various case studies and provide step-by-step examples of problem-solving techniques."
    },
    {
      title: "Chapter 3: Advanced Topics",
      content: "Here we push the boundaries of what you've learned. Advanced topics require rigorous critical thinking and a synthesis of earlier theories. Be prepared to challenge your assumptions and tackle deeply complex scenarios."
    },
    {
      title: "Chapter 4: Future Horizons",
      content: "The final chapter looks ahead. What are the emerging trends and unsolved problems? Research is an ongoing journey. We highlight potential areas for future study and the impact of upcoming technologies."
    }
  ];

  let touchStart: number | null = null;
  let touchEnd: number | null = null;

  const onTouchStart = (e: TouchEvent) => {
    touchEnd = null;
    touchStart = e.targetTouches[0].clientX;
  }

  const onTouchMove = (e: TouchEvent) => {
    touchEnd = e.targetTouches[0].clientX;
  }

  const onTouchEndEvent = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe && currentChapterIndex < MOCK_CHAPTERS.length - 1) {
       currentChapterIndex += 1;
    } else if (isRightSwipe && currentChapterIndex > 0) {
       currentChapterIndex -= 1;
    }
  }
</script>

{#if readingBook}
  <div class="h-full bg-cream flex flex-col relative text-ink">
     <header class="h-14 flex items-center justify-between px-4 border-b border-black/5 bg-paper sticky top-0 z-20 shadow-sm">
       <div class="flex items-center">
         <button onclick={() => readingBook = null} class="p-2 -ml-2 text-sage hover:text-olive transition-colors cursor-pointer border-none bg-transparent">
           <ChevronLeft size={24} />
         </button>
       </div>

       <div class="text-[10px] uppercase font-bold text-olive tracking-widest hidden sm:block truncate mx-4">{readingBook.title}</div>
       <button onclick={() => showShareModal = true} class="p-2 text-sage hover:text-ink cursor-pointer border-none bg-transparent"><Share2 size={18} /></button>
     </header>

     <div 
       role="region"
       aria-label="Book page reader"
       class="flex-1 overflow-y-auto overflow-x-hidden p-6 pb-24"
       ontouchstart={onTouchStart}
       ontouchmove={onTouchMove}
       ontouchend={onTouchEndEvent}
     >
       <div class="relative min-h-[400px]">
         {#key currentChapterIndex}
           <div transition:fade|local={{ duration: 200 }} class="absolute inset-x-0">
             <div class="mb-6">
                <span class="bg-olive text-white text-[9px] font-bold px-2 py-1 rounded-md uppercase tracking-widest">{readingBook.author}</span>
                <h2 class="text-3xl font-bold text-ink mt-3 leading-tight font-serif">{MOCK_CHAPTERS[currentChapterIndex].title}</h2>
             </div>
     
             <div class="prose prose-slate leading-relaxed text-ink/80 text-lg font-serif">
                <p class="mb-6 first-letter:text-5xl first-letter:font-bold first-letter:text-olive first-letter:mr-3 first-letter:float-left">
                  {MOCK_CHAPTERS[currentChapterIndex].content}
                </p>
                <p class="mb-6">
                   Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                </p>
                <p class="mb-6">
                   Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
                </p>
             </div>
             
             <div class="mt-12 flex justify-between items-center border-t border-sage/10 pt-6">
               {#if currentChapterIndex > 0}
                 <button onclick={() => currentChapterIndex--} class="text-sage text-sm font-bold flex items-center gap-1 hover:text-ink cursor-pointer border-none bg-transparent">
                   <ChevronLeft size={16} /> Prev Page
                 </button>
               {:else}
                 <div></div>
               {/if}
               
               {#if currentChapterIndex < MOCK_CHAPTERS.length - 1}
                 <button onclick={() => currentChapterIndex++} class="text-olive text-sm font-bold flex items-center gap-1 hover:text-ink cursor-pointer border-none bg-transparent">
                   Next Page <ChevronLeft size={16} class="rotate-180" />
                 </button>
               {:else}
                 <div></div>
               {/if}
             </div>
           </div>
         {/key}
       </div>
     </div>

     {#if showShareModal}
        <div transition:fade|local={{ duration: 200 }} class="fixed inset-0 z-[60]">
           <!-- svelte-ignore a11y_click_events_have_key_events -->
           <!-- svelte-ignore a11y_no_static_element_interactions -->
           <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" onclick={() => showShareModal = false}></div>
           <div class="fixed bottom-0 left-0 right-0 sm:max-w-md sm:mx-auto bg-paper shadow-2xl flex flex-col rounded-t-3xl sm:rounded-[20px] overflow-hidden pb-8 sm:pb-0 sm:mb-8 transition-transform duration-300">
              <div class="h-14 border-b border-sage/10 flex items-center justify-between px-6 bg-cream shadow-sm relative z-10">
                 <h3 class="font-bold text-ink uppercase tracking-widest text-xs flex items-center gap-2"><Share2 size={16}/> Share Book</h3>
                 <button onclick={() => showShareModal = false} class="text-sage hover:text-ink cursor-pointer border-none bg-transparent">Close</button>
              </div>
              <div class="p-6 space-y-4">
                 <div class="bg-cream border border-sage/10 p-4 rounded-[20px] flex items-center gap-4">
                    <div class="w-12 h-12 bg-olive/10 text-olive flex items-center justify-center rounded-[20px] text-2xl">
                       {readingBook.coverIcon}
                    </div>
                    <div class="flex-1 min-w-0">
                        <h4 class="font-bold text-ink text-sm truncate">{readingBook.title}</h4>
                        <p class="text-xs text-sage uppercase tracking-widest mt-1">Shares Left: {sharesLeft[readingBook.id] !== undefined ? sharesLeft[readingBook.id] : 3}</p>
                    </div>
                 </div>
                 
                 <p class="text-[10px] font-bold uppercase tracking-[0.2em] text-sage mb-2 px-1 pt-4">Share via...</p>
                 <div class="grid grid-cols-2 gap-4">
                     {#each ['Class Group', 'WhatsApp', 'Email', 'Copy Link'] as method}
                       <button onclick={() => executeShare(readingBook!.id)} class="bg-cream border cursor-pointer border-sage/10 hover:border-olive/30 py-3 rounded-[20px] text-xs font-bold uppercase tracking-wide text-ink transition-colors flex items-center justify-center">
                           {method}
                       </button>
                     {/each}
                 </div>
              </div>
           </div>
        </div>
      {/if}
  </div>
{:else}
  <div class="h-full bg-cream flex flex-col overflow-hidden">
    <header class="h-14 bg-paper border-b border-black/5 flex items-center px-4 sticky top-0 z-10 shadow-sm">
      <button onclick={() => onback?.()} class="p-2 -ml-2 text-sage hover:text-olive border-none bg-transparent cursor-pointer">
        <ChevronLeft size={24} />
      </button>
      <h2 class="text-sm font-bold text-ink ml-2 uppercase tracking-[0.2em]">Digital Library</h2>
    </header>

    <div class="p-4 bg-paper/30 backdrop-blur-md">
      <div class="relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-sage" size={16} />
        <input 
          type="text" 
          placeholder="Search by title, author, or publisher..." 
          class="w-full bg-cream border border-sage/10 rounded-[20px] py-3 pl-10 pr-4 text-[11px] font-bold uppercase tracking-widest placeholder:text-sage"
        />
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-8 pb-24">
      <div class="mb-8 pt-0">
        <div class="flex items-center gap-2 mb-4">
          <Share2 size={16} class="text-sage" />
          <h3 class="text-[10px] font-bold uppercase tracking-widest text-sage">Shared with you</h3>
        </div>
        <div class="flex overflow-x-auto gap-4 snap-x snap-mandatory scrollbar-hide pb-4 -mx-6 px-6">
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div onclick={() => onnavigate?.('shared_notes')} class="w-64 shrink-0 snap-center bg-gradient-to-br from-indigo-50 to-blue-50 border border-blue-100 rounded-[20px] p-5 shadow-sm cursor-pointer hover:shadow-md transition-all">
            <div class="flex justify-between items-start mb-3">
              <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">SM</div>
              <span class="text-[9px] font-bold text-blue-500 uppercase tracking-widest bg-theme-card/60 px-2 py-1 rounded-md">Topic 1</span>
            </div>
            <h4 class="font-bold text-ink mb-1">Cell Structure Guide</h4>
            <p class="text-xs text-sage line-clamp-2 mb-3">A quick summary of mitochondria vs chloroplasts with clear diagrams.</p>
            <div class="flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest text-blue-600">
               View Notes <ChevronRight size={12} />
            </div>
          </div>
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div onclick={() => onnavigate?.('shared_notes')} class="w-64 shrink-0 snap-center bg-gradient-to-br from-emerald-50 to-teal-50 border border-teal-100 rounded-[20px] p-5 shadow-sm cursor-pointer hover:shadow-md transition-all">
            <div class="flex justify-between items-start mb-3">
              <div class="w-10 h-10 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center font-bold">AK</div>
              <span class="text-[9px] font-bold text-teal-500 uppercase tracking-widest bg-theme-card/60 px-2 py-1 rounded-md">Q&A</span>
            </div>
            <h4 class="font-bold text-ink mb-1">Enzymes Past Papers</h4>
            <p class="text-xs text-sage line-clamp-2 mb-3">Voice notes explaining how to answer tricky essay questions on enzymes.</p>
            <div class="flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest text-teal-600">
               View Notes <ChevronRight size={12} />
            </div>
          </div>
        </div>
      </div>

      <section>
        <h3 class="text-[10px] font-bold text-sage uppercase tracking-[0.2em] mb-4">Independent Publishers</h3>
        <div class="grid grid-cols-1 gap-4">
          {#each MOCK_TEXTBOOKS as book (book.id)}
            <div class="bg-paper border border-sage/10 p-5 rounded-[20px] flex items-center gap-5 relative overflow-hidden transition-transform hover:-translate-y-0.5">
               <div class="w-16 h-20 shrink-0 rounded-[20px] bg-cream border border-sage/10 flex items-center justify-center text-3xl shadow-sm">
                  {book.coverIcon}
               </div>
               <div class="flex-1 min-w-0">
                  <h4 class="font-bold text-sm text-ink truncate">{book.title}</h4>
                  <p class="text-[10px] text-sage font-medium mt-1">{book.author} · {book.publisher}</p>
                  <div class="flex items-center gap-3 mt-3">
                     {#if book.price === 0}
                       <span class="text-[9px] font-bold text-olive uppercase tracking-[0.15em] bg-olive/10 px-2 py-0.5 rounded-full">Free Edition</span>
                     {:else if purchasedBooks.includes(book.id)}
                       <span class="text-[9px] font-bold text-olive uppercase tracking-[0.15em] flex items-center gap-1">
                          <CheckCircle2 size={10} /> Owned
                       </span>
                     {:else}
                       <span class="text-[9px] font-bold text-accent uppercase tracking-[0.15em]">UGX {book.price.toLocaleString()}</span>
                     {/if}
                  </div>
               </div>
               <div class="flex flex-col gap-2 shrink-0">
                  {#if purchasedBooks.includes(book.id) || book.price === 0}
                    <button 
                      onclick={() => executeShare(book.id)}
                      disabled={sharesLeft[book.id] === 0}
                      class="p-2 rounded-[20px] border border-sage/10 bg-transparent cursor-pointer text-sage hover:text-olive hover:bg-sage/5 transition-all flex flex-col items-center disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                       <Share2 size={16} />
                       {#if sharesLeft[book.id] !== undefined}
                         <span class="text-[7px] font-bold mt-0.5">{sharesLeft[book.id]}</span>
                       {/if}
                    </button>
                    <button onclick={() => openBook(book)} class="p-2 bg-transparent cursor-pointer rounded-[20px] border border-sage/10 text-sage hover:text-olive hover:bg-sage/5 transition-all">
                       <ExternalLink size={16} />
                    </button>
                  {:else}
                    <button 
                      onclick={() => selectedBook = book}
                      class="w-10 h-10 bg-accent border-none cursor-pointer text-white rounded-[20px] flex items-center justify-center shadow-sm active:scale-90 transition-all"
                    >
                       <ShoppingBag size={20} />
                    </button>
                  {/if}
               </div>
            </div>
          {/each}
        </div>
      </section>

      <section class="bg-ink text-white p-6 rounded-[20px] shadow-sm relative overflow-hidden">
         <div class="relative z-10">
            <h3 class="text-lg mb-2">Publish Your Own?</h3>
            <p class="text-[10px] text-white/60 leading-relaxed mb-6">Are you a teacher with great study material? Join our independent publisher network.</p>
            <button onclick={() => showPublisherModal = true} class="text-[10px] font-bold uppercase tracking-[0.2em] py-3 px-6 bg-olive border-none cursor-pointer text-white rounded-[20px] active:scale-95 transition-transform hover:bg-olive/80">Learn More</button>
         </div>
         <div class="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 bg-theme-card/5 rounded-full blur-3xl"></div>
      </section>
    </div>

    {#if selectedBook}
      <div transition:fade|local={{ duration: 200 }} class="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="absolute inset-0 bg-ink/40 backdrop-blur-sm z-30" onclick={() => selectedBook = null}></div>
        <div class="relative w-full max-w-lg bg-cream rounded-[40px] sm:rounded-[20px] shadow-2xl z-40 p-8 pt-10 sm:mb-10 transition-transform duration-300">
          <div class="flex items-start gap-6 mb-8">
             <div class="w-24 h-32 rounded-[20px] shrink-0 bg-paper border border-sage/10 flex items-center justify-center text-5xl shadow-sm">
                {selectedBook.coverIcon}
             </div>
             <div class="flex-1">
                <h3 class="text-xl font-bold text-ink mb-1">{selectedBook.title}</h3>
                <p class="text-sage text-xs font-medium">{selectedBook.author}</p>
                <div class="mt-4 flex items-center gap-2">
                   <Tag size={14} class="text-accent" />
                   <span class="text-lg font-bold text-accent">UGX {selectedBook.price.toLocaleString()}</span>
                </div>
             </div>
          </div>

          <div class="space-y-4 mb-10">
            <div class="p-4 bg-paper rounded-[20px] border border-sage/10">
               <h4 class="text-[10px] font-bold uppercase tracking-widest text-sage mb-2">Inside this book</h4>
               <p class="text-xs text-ink/70 leading-relaxed">Complete curriculum coverage for Senior 4, including past UNEB questions and worked solutions for every chapter.</p>
            </div>
            <div class="p-4 bg-olive/5 rounded-[20px] border border-olive/10 flex items-center gap-3">
               <CreditCard size={20} class="text-olive" />
               <div class="text-[10px] font-bold text-olive uppercase tracking-wider">Mobile Money Accepted</div>
            </div>
          </div>

          <button 
            onclick={() => handleBuy(selectedBook!.id)}
            class="w-full py-4 bg-accent border-none cursor-pointer text-white rounded-[20px] font-bold uppercase tracking-widest text-xs shadow-sm active:scale-95 transition-all"
          >
            Complete Purchase
          </button>
        </div>
      </div>
    {/if}
    
    {#if showPublisherModal}
      <div transition:fade|local={{ duration: 200 }} class="fixed inset-0 z-[60]">
         <!-- svelte-ignore a11y_click_events_have_key_events -->
         <!-- svelte-ignore a11y_no_static_element_interactions -->
         <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" onclick={() => showPublisherModal = false}></div>
         <div class="fixed bottom-0 left-0 right-0 sm:max-w-md sm:mx-auto bg-paper shadow-2xl flex flex-col rounded-t-3xl sm:rounded-[20px] overflow-hidden pb-8 sm:pb-0 sm:mb-8 transition-transform duration-300">
            <div class="h-14 border-b border-sage/10 flex items-center justify-between px-6 bg-cream shadow-sm relative z-10">
               <h3 class="font-bold text-ink uppercase tracking-widest text-xs">Publisher Network</h3>
               <button onclick={() => showPublisherModal = false} class="text-sage border-none bg-transparent cursor-pointer hover:text-ink">Close</button>
            </div>
            <div class="p-6 space-y-4 relative z-10">
               <p class="text-sm text-ink/70 mb-4 leading-relaxed">
                 Join our independent publisher network and monetize your study materials. Fill out the application form below.
               </p>
               <input type="text" placeholder="Full Name" class="w-full bg-cream border border-sage/10 rounded-[20px] py-3 px-4 text-sm focus:outline-none focus:border-olive/30 transition-colors" />
               <input type="email" placeholder="Email Address" class="w-full bg-cream border border-sage/10 rounded-[20px] py-3 px-4 text-sm focus:outline-none focus:border-olive/30 transition-colors" />
               <textarea placeholder="Tell us about the materials you want to publish..." rows="4" class="w-full bg-cream border border-sage/10 rounded-[20px] py-3 px-4 text-sm focus:outline-none focus:border-olive/30 transition-colors resize-none"></textarea>
               <button onclick={submitApplication} class="w-full cursor-pointer border-none bg-olive text-white py-3.5 rounded-[20px] font-bold tracking-widest uppercase text-xs hover:bg-ink transition-colors shadow-md mt-2">
                   Submit Application
               </button>
            </div>
         </div>
      </div>
    {/if}
  </div>
{/if}
