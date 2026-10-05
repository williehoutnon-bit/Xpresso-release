<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { fade, slide, scale } from 'svelte/transition';
  import { ChevronLeft, ChevronDown, ChevronUp, Lightbulb, CheckCircle2, Bookmark, Share2, PlayCircle, Search, ShoppingBag, BookOpen, Edit3, X, List, MessageSquare, Mic, Image as ImageIcon, Video } from 'lucide-svelte';
  import { SUBJECT_CATALOGUE, type Subject } from '../types';
  import { dbService } from '../services/dbService';

  function triggerNotification(title: string, options: any) {
    console.log(`Notification: ${title}`, options);
  }

  let { onback, onopenbookstore } = $props<{
    onback?: () => void;
    onopenbookstore?: () => void;
  }>();

  let windowWidth = $state(typeof window !== 'undefined' ? window.innerWidth : 1024);

  type LibraryState = 'library' | 'catalogue' | 'note';

  let viewState = $state<LibraryState>('library');
  let selectedSubject = $state<Subject | null>(null);

  let currentTopicIndex = $state(0);
  let visibleSectionIndex = $state(0);
  let bookmarkedSections = $state<number[]>([2]);

  let selection = $state<{ text: string, x: number, y: number, range: Range | null } | null>(null);
  let showAnnotateModal = $state(false);
  let annotationText = $state('');
  let activeColor = $state('Yellow');

  let viewingNote = $state<{ text: string, note: string } | null>(null);
  let annotationsLoaded = $state(false);

  let showSearchFallback = $state(false);
  let showChaptersDrawer = $state(false);
  let showBookmarksModal = $state(false);
  let showShareModal = $state(false);
  let showVideoModal = $state(false);
  let activeVideoTitle = $state('');

  let showScrollDown = $state(true);
  let showScrollTop = $state(false);

  let contentRef = $state<HTMLElement | null>(null);

  const bioTopics = [
    "Cell Structure & Organization",
    "Nutrition & Digestion",
    "Transport in Plants",
    "Respiration & Gas Exchange",
    "Sensitivity in Living Things"
  ];

  const MOCK_TOPIC_CONTENT = [
    {
      title: "Cell Structure & Organization",
      content: "The cell is the basic structural and functional unit of all living organisms. All processes of life take place within cells.",
      quote: "The cell theory states that all living things are made of cells, and new cells are produced from existing cells.",
      points: [
        { name: "Nucleus", desc: "Contains genetic material (DNA) and controls cell activities." },
        { name: "Mitochondria", desc: "Primary site of aerobic respiration and ATP production." }
      ]
    },
    {
      title: "Nutrition & Digestion",
      content: "Nutrition is the process by which living organisms obtain food. Human digestion involves breaking down large insoluble molecules into small soluble ones.",
      quote: "Enzymes act as biological catalysts to speed up the rate of digestion without being used up.",
      points: [
        { name: "Stomach", desc: "Where protein digestion begins, facilitated by pepsin and hydrochloric acid." },
        { name: "Small Intestine", desc: "Main site for the absorption of nutrients into the bloodstream." }
      ]
    },
    {
      title: "Transport in Plants",
      content: "Plants need a transport system to move water, minerals, and manufactured food to all parts of the plant.",
      quote: "Transpiration stream is driven by water loss from the leaves, pulling water up the xylem.",
      points: [
        { name: "Xylem", desc: "Transports water and dissolved minerals upwards from the roots." },
        { name: "Phloem", desc: "Transports synthesized food (sucrose and amino acids) from leaves to rest of the plant." }
      ]
    },
    {
      title: "Respiration & Gas Exchange",
      content: "Respiration releases energy from food. Gas exchange is the process of taking in oxygen and releasing carbon dioxide.",
      quote: "Aerobic respiration provides much more energy per glucose molecule than anaerobic respiration.",
      points: [
        { name: "Alveoli", desc: "Air sacs in lungs adapted for efficient gas exchange with a large surface area." },
        { name: "Diaphragm", desc: "Muscle that controls ventilation by changing the volume of the thorax." }
      ]
    },
    {
      title: "Sensitivity in Living Things",
      content: "Sensitivity is the ability to detect and respond to changes in the environment (stimuli).",
      quote: "Reflex actions are rapid, automatic responses to stimuli that protect the body from harm.",
      points: [
        { name: "Sensory Neurone", desc: "Carries impulses from receptors to the central nervous system." },
        { name: "Motor Neurone", desc: "Carries impulses from the CNS to effectors (muscles or glands)." }
      ]
    }
  ];

  const handleSubjectSelect = (subject: Subject) => {
    selectedSubject = subject;
    viewState = 'catalogue';
  };

  const setCurrentTopic = (index: number) => {
    currentTopicIndex = index;
    viewState = 'note';
  };

  const handleSelection = () => {
    setTimeout(() => {
      const sel = window.getSelection();
      if (sel && sel.toString().trim() !== '' && contentRef?.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        selection = {
          text: sel.toString(),
          x: rect.left + rect.width / 2,
          y: rect.top - 10,
          range: range.cloneRange()
        };
      } else if (!showAnnotateModal && !viewingNote) {
        selection = null;
      }
    }, 100);
  };

  const onResize = () => { windowWidth = window.innerWidth; };

  let observer: IntersectionObserver | null = null;

  const setupIntersectionObserver = () => {
    if (observer) {
      observer.disconnect();
    }
    observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const idStr = entry.target.id;
          const index = parseInt(idStr.replace('topic-', ''), 10);
          if (!isNaN(index)) {
            visibleSectionIndex = index;
          }
        }
      });
    }, { root: contentRef, threshold: 0.1, rootMargin: '-10% 0px -50% 0px' });
    
    tick().then(() => {
      document.querySelectorAll('.topic-section').forEach(el => {
        observer?.observe(el);
      });
    });
  };

  $effect(() => {
    if (viewState === 'note') {
      setupIntersectionObserver();
    }
  });

  onMount(() => {
    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('touchend', handleSelection);
    document.addEventListener('selectionchange', handleSelection);
    window.addEventListener('resize', onResize);
    if (viewState === 'note') {
      setupIntersectionObserver();
    }
  });

  onDestroy(() => {
    if (observer) observer.disconnect();
    document.removeEventListener('mouseup', handleSelection);
    document.removeEventListener('touchend', handleSelection);
    document.removeEventListener('selectionchange', handleSelection);
    window.removeEventListener('resize', onResize);
  });

  $effect(() => {
    if (viewState === 'note' && !annotationsLoaded && contentRef) {
      tick().then(loadAnnotations);
    }
  });

  const loadAnnotations = async () => {
    if (!contentRef) return;
    try {
      const annos = await dbService.getAnnotations();
      annos.forEach(anno => {
         applyHighlightToText(anno.text, anno.color, anno.note, anno._id);
      });
      annotationsLoaded = true;
    } catch (e) {
      console.error(e);
    }
  };

  const applyHighlightToText = (text: string, colorName: string, note?: string, id?: string) => {
    if (!contentRef || !text) return;
    const walk = document.createTreeWalker(contentRef, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walk.nextNode())) {
      const idx = node.nodeValue?.indexOf(text);
      if (idx !== undefined && idx !== -1) {
         const range = document.createRange();
         range.setStart(node, idx);
         range.setEnd(node, idx + text.length);
         applyHighlightNode(range, text, colorName, note, id, false);
         return; 
      }
    }
  };

  const applyHighlightNode = (range: Range, text: string, colorName: string, note?: string, savedId?: string, saveToDb = true) => {
    const colors: Record<string, string> = {
      'Yellow': '#fef08a',
      'Green': '#bbf7d0',
      'Blue': '#bfdbfe',
      'Pink': '#fbcfe8',
    };
    
    try {
      const span = document.createElement('mark');
      span.style.backgroundColor = colors[colorName] || colors['Yellow'];
      span.className = `rounded cursor-pointer transition-opacity hover:opacity-80 relative inline-flex items-center ${note ? 'pr-6' : ''}`;
      
      const annotationId = savedId || `anno-${Date.now()}`;
      span.id = annotationId;
      
      if (note) {
         span.setAttribute('data-note', note);
         const indicator = document.createElement('span');
         indicator.className = 'absolute right-0.5 top-1/2 -translate-y-1/2 bg-accent text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold shadow-sm';
         indicator.innerHTML = 'N';
         span.appendChild(indicator);
      }

      span.onclick = (e) => {
        e.stopPropagation();
        if (note) {
          viewingNote = { text: text, note };
        } else {
           triggerNotification('Highlight', { body: 'This text is highlighted. No note attached.', type: 'info' });
        }
      };

      range.surroundContents(span);

      if (saveToDb) {
         dbService.saveAnnotation({
            text,
            color: colorName,
            note
         }).catch(console.error);
      }
      
    } catch (e) {
      console.error(e);
      if (saveToDb) triggerNotification('Highlighting Error', { body: 'Cannot highlight across multiple paragraphs.', type: 'error'});
    }
  };

  const applyHighlight = (colorName: string, note?: string) => {
    if (!selection?.range) return;
    applyHighlightNode(selection.range, selection.text, colorName, note, undefined, true);
  };

  const handleColorSelect = (color: string) => {
    activeColor = color;
    applyHighlight(color);
    triggerNotification('Text Highlighted', { body: `Text highlighted with ${color}.`, type: 'success'});
    selection = null;
    window.getSelection()?.removeAllRanges();
  };

  const saveAnnotation = () => {
    applyHighlight(activeColor, annotationText);
    triggerNotification('Annotation Saved', { body: 'Your annotation has been saved for offline access.', type: 'success'});
    showAnnotateModal = false;
    annotationText = '';
    selection = null;
    window.getSelection()?.removeAllRanges();
  };

  const closeAnnotate = () => {
    showAnnotateModal = false;
    selection = null;
  };

  const toggleBookmark = (index: number) => {
    if (bookmarkedSections.includes(index)) {
      bookmarkedSections = bookmarkedSections.filter(i => i !== index);
    } else {
      bookmarkedSections = [...bookmarkedSections, index];
    }
  };

  const setCurrentTopicFromDrawer = (i: number) => {
    currentTopicIndex = i;
    showChaptersDrawer = false;
    tick().then(() => {
      const el = document.getElementById(`topic-${i}`);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    });
  };

  const setCurrentTopicFromBookmarks = (i: number) => {
    currentTopicIndex = i;
    showBookmarksModal = false;
    tick().then(() => {
      const el = document.getElementById(`topic-${i}`);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    });
  };

  const startVideo = (title: string) => {
    activeVideoTitle = title;
    showVideoModal = true;
  };

  const handleScroll = (e: Event) => {
    const target = e.target as HTMLElement;
    showScrollDown = target.scrollTop < 100;
    showScrollTop = target.scrollTop > 300;
  };

  const scrollToTop = () => {
    if (contentRef) {
       contentRef.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const continueSearch = () => {
    showSearchFallback = false;
    triggerNotification('Searching', { body: 'Searching expanded sources...', type: 'info' });
  };
  
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      showSearchFallback = true;
    }
  }
</script>

{#if viewState === 'library'}
  <div class="h-full bg-cream flex flex-col overflow-hidden">
     <header class="h-14 flex items-center px-4 border-b border-black/5 bg-paper sticky top-0 z-10 shadow-sm">
       <button onclick={() => onback?.()} class="p-2 -ml-2 border-none bg-transparent cursor-pointer text-sage hover:text-olive transition-colors">
         <ChevronLeft size={24} />
       </button>
       <h2 class="text-sm font-bold text-ink ml-2 uppercase tracking-widest">Digital Library</h2>
     </header>

     <div class="p-4 space-y-4">
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-sage" size={16} />
          <input 
            type="text" 
            placeholder="Search notes, topics..." 
            class="w-full bg-cream border border-sage/10 rounded-[20px] py-3 pl-10 pr-4 text-[11px] font-bold uppercase tracking-widest focus:outline-none focus:border-olive/30"
          />
        </div>

        <button 
          onclick={() => onopenbookstore?.()}
          class="w-full bg-olive border-none cursor-pointer text-white p-4 rounded-[20px] flex items-center justify-between shadow-sm active:scale-95 transition-all"
        >
          <div class="flex items-center gap-3">
            <ShoppingBag size={20} />
            <div class="text-left">
              <div class="text-xs font-bold uppercase tracking-wider">Buy Textbooks</div>
              <div class="text-[9px] opacity-70 uppercase tracking-widest">Independent Publishers</div>
            </div>
          </div>
          <ChevronLeft size={16} class="rotate-180" />
        </button>
     </div>

     <div class="flex-1 overflow-y-auto p-6 pt-2 space-y-6">
        <h3 class="text-[10px] font-bold text-sage uppercase tracking-[0.2em]">My Study Resources</h3>
        <div class="space-y-3">
           <!-- svelte-ignore a11y_click_events_have_key_events -->
           <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="bg-paper border border-sage/10 p-4 rounded-[20px] flex items-center gap-4 shadow-sm hover:border-olive transition-all cursor-pointer" onclick={() => handleSubjectSelect(SUBJECT_CATALOGUE.find(s => s.id === 'bio') || SUBJECT_CATALOGUE[0])}>
            <div class="w-12 h-12 bg-cream rounded-[20px] flex items-center justify-center text-2xl border border-sage/5">🧬</div>
            <div class="flex-1">
              <h4 class="font-bold text-ink text-sm">Modern Biology</h4>
              <p class="text-[9px] text-sage font-bold mt-1 uppercase tracking-widest">MK Publishers</p>
            </div>
            <button class="text-olive p-2 rounded-[20px] bg-olive/5 border-none cursor-pointer"><BookOpen size={16} /></button>
          </div>
           <!-- svelte-ignore a11y_click_events_have_key_events -->
           <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="bg-paper border border-sage/10 p-4 rounded-[20px] flex items-center gap-4 shadow-sm hover:border-olive transition-all cursor-pointer" onclick={() => handleSubjectSelect(SUBJECT_CATALOGUE.find(s => s.id === 'phys') || SUBJECT_CATALOGUE[1])}>
            <div class="w-12 h-12 bg-cream rounded-[20px] flex items-center justify-center text-2xl border border-sage/5">⚡</div>
            <div class="flex-1">
              <h4 class="font-bold text-ink text-sm">Advanced Physics</h4>
              <p class="text-[9px] text-sage font-bold mt-1 uppercase tracking-widest">Fontana Books</p>
            </div>
            <button class="text-olive p-2 rounded-[20px] bg-olive/5 border-none cursor-pointer"><BookOpen size={16} /></button>
          </div>
        </div>

        <h3 class="text-[10px] font-bold text-sage uppercase tracking-[0.2em] mt-8">Academic Catalogues</h3>
        <div class="grid grid-cols-2 gap-4">
          {#each SUBJECT_CATALOGUE as subject (subject.id)}
           <button 
            onclick={() => handleSubjectSelect(subject)}
            class="bg-paper cursor-pointer border border-sage/10 p-5 rounded-[20px] flex flex-col gap-4 active:scale-95 transition-all text-left"
           >
              <div class="w-12 h-12 rounded-[20px] flex items-center justify-center text-2xl {subject.color}">
                  {subject.icon}
              </div>
              <div>
                  <h4 class="font-bold text-ink text-xs uppercase tracking-tight">{subject.name}</h4>
                  <p class="text-[9px] text-sage font-bold mt-1">{subject.topics} Topics</p>
              </div>
           </button>
          {/each}
        </div>
     </div>
  </div>

{:else if viewState === 'catalogue'}
  <div class="h-full bg-cream flex flex-col overflow-hidden">
     <header class="h-14 flex items-center px-4 border-b border-black/5 bg-paper sticky top-0 z-10 shadow-sm">
       <button onclick={() => viewState = 'library'} class="p-2 -ml-2 bg-transparent border-none cursor-pointer text-sage hover:text-olive transition-colors">
         <ChevronLeft size={24} />
       </button>
       <h2 class="text-sm font-bold text-ink ml-2 uppercase tracking-widest">{selectedSubject?.name} Catalogue</h2>
     </header>

     <div class="flex-1 overflow-y-auto p-6 space-y-4">
       {#each bioTopics as topic, i (i)}
        <button 
          onclick={() => setCurrentTopic(i)}
          class="w-full bg-paper cursor-pointer p-5 rounded-[20px] border border-sage/5 flex items-center gap-4 shadow-sm hover:border-olive transition-all text-left"
        >
          <div class="w-10 h-10 rounded-full bg-cream border border-sage/10 flex items-center justify-center text-olive font-bold text-xs">
             {i + 1}
          </div>
          <div class="flex-1">
             <h4 class="text-xs font-bold text-ink uppercase tracking-wide leading-tight">{topic}</h4>
             <div class="flex gap-2 mt-2">
                <span class="text-[8px] bg-accent/10 text-accent px-2 py-0.5 rounded-full font-bold uppercase">Note</span>
                <span class="text-[8px] bg-olive/10 text-olive px-2 py-0.5 rounded-full font-bold uppercase">Video</span>
             </div>
          </div>
          <ChevronLeft size={16} class="text-sage rotate-180" />
        </button>
       {/each}
     </div>
  </div>

{:else}
  <div class="h-full bg-cream flex flex-col relative text-ink">
    <!-- Combined Sticky Header -->
    <header class="flex flex-col bg-theme-card border-b border-black/5 sticky top-0 z-40 shadow-sm shrink-0">
      <!-- Top Row: Back, Search, Share -->
      <div class="h-14 flex items-center justify-between px-4">
        <button onclick={() => viewState = 'catalogue'} class="p-2 -ml-2 bg-transparent border-none cursor-pointer text-sage hover:text-olive transition-colors">
          <ChevronLeft size={24} />
        </button>

        <div class="flex-1 max-w-sm mx-4">
          <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-sage" size={14} />
            <input 
               type="text"
               placeholder="Search in {selectedSubject?.name}..."
               class="w-full bg-cream rounded-full py-1.5 pl-9 pr-4 text-xs focus:outline-none border border-black/5 focus:border-olive/30 transition-colors placeholder:text-sage"
               onkeydown={handleKeydown}
            />
          </div>
        </div>
        <button onclick={() => showShareModal = true} class="p-2 bg-transparent border-none cursor-pointer text-sage hover:text-ink"><Share2 size={18} /></button>
      </div>

      <!-- Main Subject Title -->
      <div class="py-2 bg-slate-50 border-y border-black/5 text-center">
        <span class="text-ink font-bold uppercase tracking-widest text-xs">UCE {selectedSubject?.name}</span>
      </div>

      <!-- Action Row: Bookmarks & Chapters -->
      <div class="py-3 px-4 flex justify-between items-center bg-theme-card/90 backdrop-blur-md">
        <div class="flex gap-1 items-center bg-paper border border-sage/20 rounded-[20px] overflow-hidden shadow-sm">
           <button 
             onclick={() => showBookmarksModal = true}
             class="px-3 py-1.5 bg-transparent border-none cursor-pointer transition-colors hover:bg-black/5 {bookmarkedSections.length > 0 ? 'text-orange-500' : 'text-sage hover:text-ink'}"
           >
             <Bookmark size={14} />
           </button>
           <div class="w-[1px] h-4 bg-sage/20"></div>
           <button 
             onclick={() => toggleBookmark(visibleSectionIndex)}
             class="px-3 py-1.5 bg-transparent border-none cursor-pointer transition-colors hover:bg-black/5"
           >
             <Bookmark size={14} class={bookmarkedSections.includes(visibleSectionIndex) ? 'text-accent' : 'text-sage'} fill={bookmarkedSections.includes(visibleSectionIndex) ? 'currentColor' : 'none'} />
           </button>
        </div>
        <button 
          onclick={() => showChaptersDrawer = true}
          class="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold uppercase tracking-widest text-sage hover:text-ink transition-colors px-3 py-1.5 border border-sage/20 rounded-[20px] hover:bg-black/5 bg-paper shadow-sm"
        >
          <List size={14} /> Chapters
        </button>
      </div>
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
       <button onclick={scrollToTop} class="w-10 h-10 cursor-pointer bg-orange-400 hover:bg-orange-500 transition-colors text-white rounded-full flex items-center justify-center shadow-lg border border-black/10 shadow-orange-400/20 active:scale-95 border-none">
          <ChevronUp size={20} />
       </button>
    </div>

    <div 
      class="flex-1 overflow-y-auto overflow-x-hidden p-6 pb-32 relative" 
      bind:this={contentRef}
      onscroll={handleScroll}
    >
        <div class="space-y-16">
          {#each MOCK_TOPIC_CONTENT as topic, index (index)}
            <div id={`topic-${index}`} class="topic-section mt-12">
              <h2 class="text-2xl font-bold text-ink mb-6 leading-tight">{topic.title}</h2>
              
              <div class="bg-paper p-6 rounded-[20px] border border-sage/10 mb-8 relative">
                 <h4 class="text-xs font-bold text-olive uppercase tracking-[0.2em] mb-4">Core Concepts</h4>
                 <div class="prose prose-slate leading-relaxed text-ink/80 text-sm">
                    <p class="mb-4 selection:bg-accent/30 selection:text-ink">
                      {topic.content}
                    </p>
                    <div class="bg-cream/50 p-4 rounded-[20px] border-l-4 border-olive mb-4 selection:bg-accent/30 selection:text-ink italic">
                      "{topic.quote}"
                    </div>
                    <p class="font-bold mb-2">Key Highlights:</p>
                    <ul class="space-y-4">
                       {#each topic.points as pt, i (i)}
                         <li class="flex gap-4">
                            <div class="w-10 h-10 rounded-[20px] bg-olive/10 flex items-center justify-center shrink-0"><CheckCircle2 class="text-olive" size={18}/></div>
                            <div>
                               <span class="font-bold text-ink block underline decoration-olive/30 decoration-2">{pt.name}</span>
                               <span class="text-xs text-sage selection:bg-accent/30 selection:text-ink">{pt.desc}</span>
                            </div>
                         </li>
                       {/each}
                    </ul>
                 </div>
              </div>
              
              <section class="space-y-4">
                 <h4 class="text-[10px] font-bold text-sage uppercase tracking-widest mb-4">Video Illustrations</h4>
                 <!-- svelte-ignore a11y_click_events_have_key_events -->
                 <!-- svelte-ignore a11y_no_static_element_interactions -->
                 <div 
                   onclick={() => startVideo(topic.title)}
                   class="bg-ink rounded-[20px] p-5 text-white flex items-center justify-between shadow-sm cursor-pointer hover:bg-black transition-colors group"
                 >
                    <div class="flex items-center gap-4">
                       <div class="w-12 h-12 rounded-[20px] bg-theme-card/10 flex items-center justify-center border border-white/5 transition-transform group-hover:scale-110">
                          <PlayCircle size={28} class="text-accent" />
                       </div>
                       <div>
                          <h5 class="text-sm font-bold leading-tight">{topic.title} Concept</h5>
                          <p class="text-[9px] text-white/50 uppercase tracking-widest mt-1">4 min · HD</p>
                       </div>
                    </div>
                    <ChevronLeft size={20} class="text-white/20 rotate-180" />
                 </div>
              </section>
            </div>
          {/each}
        </div>
    </div>

    {#if selection && !showAnnotateModal}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div 
        transition:fade={{duration: 200}}
        style="position: fixed; top: {Math.max(70, selection.y - 60)}px; left: {Math.max(10, Math.min(windowWidth - 180, selection.x - 90))}px; transform: translate(0, 0);"
        class="z-50 bg-ink shadow-lg shadow-black/20 rounded-[20px] border border-white/10 flex overflow-hidden items-center"
      >
         <button onmousedown={(e) => { e.preventDefault(); showAnnotateModal = true; }} class="p-3 text-white border-none cursor-pointer bg-transparent hover:bg-theme-card/10 transition-colors flex items-center justify-center">
           <Edit3 size={18} />
         </button>
         <div class="w-[1px] h-6 bg-theme-card/10 mx-1"></div>
         <div class="flex p-2 items-center gap-2">
           <div class="w-6 h-6 rounded-full bg-yellow-400 cursor-pointer {activeColor === 'Yellow' ? 'ring-2 ring-white ring-offset-1 ring-offset-ink' : ''}" onmousedown={(e) => { e.preventDefault(); handleColorSelect('Yellow'); }}></div>
           <div class="w-6 h-6 rounded-full bg-green-400 cursor-pointer {activeColor === 'Green' ? 'ring-2 ring-white ring-offset-1 ring-offset-ink' : ''}" onmousedown={(e) => { e.preventDefault(); handleColorSelect('Green'); }}></div>
           <div class="w-6 h-6 rounded-full bg-blue-400 cursor-pointer {activeColor === 'Blue' ? 'ring-2 ring-white ring-offset-1 ring-offset-ink' : ''}" onmousedown={(e) => { e.preventDefault(); handleColorSelect('Blue'); }}></div>
           <div class="w-6 h-6 rounded-full bg-pink-400 cursor-pointer {activeColor === 'Pink' ? 'ring-2 ring-white ring-offset-1 ring-offset-ink' : ''}" onmousedown={(e) => { e.preventDefault(); handleColorSelect('Pink'); }}></div>
         </div>
      </div>
    {/if}

    {#if viewingNote}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div transition:fade={{duration: 200}} class="fixed inset-0 z-[60] bg-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 pb-10" onclick={() => viewingNote = null}>
         <div onclick={(e) => e.stopPropagation()} class="bg-paper rounded-[20px] w-full max-w-md shadow-2xl overflow-hidden transition-transform animate-slideUp">
            <div class="p-4 border-b border-sage/10 flex justify-between items-center bg-cream">
              <div class="flex items-center gap-2 text-ink font-bold">
                <Bookmark size={18} class="text-accent" />
                <span>My Note</span>
              </div>
              <button onclick={() => viewingNote = null} class="p-1 rounded-full cursor-pointer bg-transparent border-none hover:bg-black/5 text-sage transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div class="p-4 space-y-4">
               <div>
                 <h4 class="text-[10px] uppercase font-bold text-olive tracking-widest mb-1">Highlighted Text</h4>
                 <div class="text-xs text-sage italic bg-sage/5 p-3 rounded-[20px] border-l-2 border-sage line-clamp-3">
                   "{viewingNote.text}"
                 </div>
               </div>
               
               <div>
                 <h4 class="text-[10px] uppercase font-bold text-accent tracking-widest mb-1">My Notes</h4>
                 <div class="text-sm font-medium text-ink bg-cream p-4 rounded-[20px] shadow-inner whitespace-pre-wrap">{viewingNote.note}</div>
               </div>
            </div>
            
            <div class="p-4 bg-cream border-t border-sage/10 flex justify-end">
               <button onclick={() => viewingNote = null} class="px-6 py-2 rounded-[20px] cursor-pointer text-xs font-bold uppercase tracking-widest text-ink hover:bg-sage/10 transition-colors shadow-sm bg-theme-card border border-sage/10">
                 Close
               </button>
            </div>
         </div>
      </div>
    {/if}

    {#if showAnnotateModal}
      <div transition:fade={{duration: 200}} class="fixed inset-0 z-[60] bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4">
         <div class="bg-paper rounded-[20px] w-full max-w-md shadow-2xl overflow-hidden animate-slideUp">
            <div class="p-4 border-b border-sage/10 flex justify-between items-center bg-cream">
              <div class="flex items-center gap-2 text-ink font-bold">
                <Edit3 size={18} class="text-accent" />
                <span>New Annotation</span>
              </div>
              <button onclick={closeAnnotate} class="p-1 rounded-full bg-transparent border-none cursor-pointer hover:bg-black/5 text-sage transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div class="p-4">
               <div class="text-xs text-sage italic bg-sage/5 p-3 rounded-[20px] border-l-2 border-sage mb-4 line-clamp-3">
                 "{selection?.text}"
               </div>
               
               <!-- svelte-ignore a11y_no_static_element_interactions -->
               <div class="flex items-center gap-2 mb-4">
                 <span class="text-[10px] font-bold text-sage mr-2 uppercase tracking-widest">Highlight Color:</span>
                 <div class="w-6 h-6 rounded-full bg-yellow-200 cursor-pointer {activeColor === 'Yellow' ? 'ring-2 ring-ink ring-offset-1 ring-offset-paper' : ''}" onmousedown={(e) => { e.preventDefault(); activeColor = 'Yellow'; }}></div>
                 <div class="w-6 h-6 rounded-full bg-green-200 cursor-pointer {activeColor === 'Green' ? 'ring-2 ring-ink ring-offset-1 ring-offset-paper' : ''}" onmousedown={(e) => { e.preventDefault(); activeColor = 'Green'; }}></div>
                 <div class="w-6 h-6 rounded-full bg-blue-200 cursor-pointer {activeColor === 'Blue' ? 'ring-2 ring-ink ring-offset-1 ring-offset-paper' : ''}" onmousedown={(e) => { e.preventDefault(); activeColor = 'Blue'; }}></div>
                 <div class="w-6 h-6 rounded-full bg-pink-200 cursor-pointer {activeColor === 'Pink' ? 'ring-2 ring-ink ring-offset-1 ring-offset-paper' : ''}" onmousedown={(e) => { e.preventDefault(); activeColor = 'Pink'; }}></div>
               </div>

               <!-- svelte-ignore a11y_autofocus -->
               <textarea 
                 class="w-full h-32 bg-cream border border-sage/10 rounded-[20px] p-3 text-sm focus:outline-none focus:ring-1 focus:ring-accent resize-none shadow-inner"
                 placeholder="Type your notes or tags here..."
                 bind:value={annotationText}
                 autofocus
               ></textarea>
            </div>
            
            <div class="p-4 bg-cream border-t border-sage/10 flex justify-end gap-3">
               <button onclick={closeAnnotate} class="px-4 py-2 border-none bg-transparent cursor-pointer rounded-[20px] text-xs font-bold uppercase tracking-widest text-ink hover:bg-sage/10 transition-colors">
                 Cancel
               </button>
               <button onclick={saveAnnotation} class="px-6 py-2 border-none cursor-pointer rounded-[20px] text-xs font-bold uppercase tracking-widest text-white bg-accent hover:bg-ink transition-colors shadow-md">
                 Save
               </button>
            </div>
         </div>
      </div>
    {/if}
    
    {#if showSearchFallback}
      <div transition:fade={{duration: 200}} class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
         <div class="bg-paper p-6 rounded-[20px] max-w-sm w-full shadow-2xl animate-scaleIn">
            <div class="flex justify-between items-center mb-4">
               <h3 class="font-bold text-ink">Search Beyond Section</h3>
               <button onclick={() => showSearchFallback = false} class="text-sage bg-transparent border-none cursor-pointer hover:text-ink"><X size={20}/></button>
            </div>
            <p class="text-sm text-ink/70 mb-6 leading-relaxed">
              We couldn't find your search term in the current section. Would you like to expand your search?
            </p>
            <div class="space-y-4 mb-6 bg-cream p-4 rounded-[20px] border border-sage/10">
               <label class="flex items-center justify-between cursor-pointer group">
                  <span class="text-sm font-medium group-hover:text-olive transition-colors">Search my library</span>
                  <input type="checkbox" class="w-4 h-4 accent-olive cursor-pointer" checked />
               </label>
               <label class="flex items-center justify-between cursor-pointer group">
                  <span class="text-sm font-medium group-hover:text-olive transition-colors">Search other books</span>
                  <input type="checkbox" class="w-4 h-4 accent-olive cursor-pointer" />
               </label>
            </div>
            <button onclick={continueSearch} class="w-full bg-olive border-none cursor-pointer text-white py-3.5 rounded-[20px] font-bold tracking-widest uppercase text-xs hover:bg-ink transition-colors shadow-md">
               Continue Search
            </button>
         </div>
      </div>
    {/if}

    {#if showChaptersDrawer}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div transition:fade={{duration: 200}} class="fixed inset-0 z-[60]">
         <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" onclick={() => showChaptersDrawer = false}></div>
         <div class="fixed bottom-0 left-0 right-0 max-h-[85vh] h-full sm:h-auto bg-paper shadow-2xl flex flex-col rounded-t-3xl overflow-hidden animate-slideUpDrawer">
            <div class="h-14 border-b border-sage/10 flex items-center justify-between px-6 bg-cream shadow-sm relative z-10">
               <h3 class="font-bold text-ink uppercase tracking-widest text-xs flex items-center gap-2"><List size={16}/> Chapters</h3>
               <button onclick={() => showChaptersDrawer = false} class="text-sage border-none bg-transparent cursor-pointer hover:text-ink"><X size={20}/></button>
            </div>
            <div class="flex-1 overflow-y-auto p-4 space-y-2 bg-cream">
               {#each MOCK_TOPIC_CONTENT as topic, i (i)}
                <button
                  onclick={() => setCurrentTopicFromDrawer(i)}
                  class="w-full cursor-pointer text-left p-4 rounded-[20px] transition-all border {i === currentTopicIndex ? 'bg-olive border-olive text-white shadow-lg shadow-olive/20' : 'bg-paper border-sage/10 hover:border-sage/30 text-ink shadow-sm'}"
                >
                   <h4 class="font-bold text-sm mb-1 leading-snug {i === currentTopicIndex ? 'text-white' : 'text-ink'}">{topic.title}</h4>
                   <p class="text-xs uppercase tracking-widest font-bold {i === currentTopicIndex ? 'text-white/60' : 'text-sage'}">Section {i + 1}</p>
                </button>
               {/each}
            </div>
         </div>
      </div>
    {/if}
    
    {#if showBookmarksModal}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div transition:fade={{duration: 200}} class="fixed inset-0 z-[60]">
         <div class="fixed inset-0 bg-black/40 backdrop-blur-sm" onclick={() => showBookmarksModal = false}></div>
         <div class="fixed bottom-0 left-0 right-0 max-h-[85vh] h-full sm:h-auto bg-paper shadow-2xl flex flex-col rounded-t-3xl overflow-hidden animate-slideUpDrawer">
            <div class="h-14 border-b border-sage/10 flex items-center justify-between px-6 bg-cream shadow-sm relative z-10">
               <h3 class="font-bold text-ink uppercase tracking-widest text-xs flex items-center gap-2"><Bookmark size={16}/> Bookmarks</h3>
               <button onclick={() => showBookmarksModal = false} class="text-sage bg-transparent border-none cursor-pointer hover:text-ink"><X size={20}/></button>
            </div>
            <div class="flex-1 overflow-y-auto p-4 space-y-2 bg-cream">
                {#if bookmarkedSections.length === 0}
                  <div class="text-center text-sage text-sm py-10">No bookmarks yet.</div>
                {/if}
               {#each bookmarkedSections as index (index)}
                <button
                  onclick={() => setCurrentTopicFromBookmarks(index)}
                  class="w-full text-left p-4 cursor-pointer rounded-[20px] transition-all border bg-paper border-sage/10 hover:border-sage/30 text-ink shadow-sm"
                >
                   <h4 class="font-bold text-sm mb-1 leading-snug">{MOCK_TOPIC_CONTENT[index].title}</h4>
                   <p class="text-xs uppercase tracking-widest font-bold text-sage">Section {index + 1}</p>
                </button>
               {/each}
            </div>
         </div>
      </div>
    {/if}
    
    {#if showVideoModal}
      <div transition:fade={{duration: 200}} class="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 backdrop-blur-md">
         <button onclick={() => showVideoModal = false} class="absolute top-6 right-6 cursor-pointer border-none text-white/50 hover:text-white bg-theme-card/10 p-2 rounded-full backdrop-blur-sm z-10">
            <X size={24}/>
         </button>
         <div class="w-full max-w-2xl aspect-video bg-black rounded-[20px] overflow-hidden shadow-2xl relative border border-white/10 animate-scaleIn">
            <div class="absolute inset-0 flex items-center justify-center">
               <div class="text-center">
                 <div class="w-16 h-16 bg-theme-card/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/20">
                   <PlayCircle size={32} class="text-accent" />
                 </div>
                 <h3 class="text-white font-bold mb-2">{activeVideoTitle}</h3>
                 <p class="text-white/50 text-xs">(Simulated Video Player)</p>
               </div>
            </div>
         </div>
      </div>
    {/if}
  </div>
{/if}

<style>
.animate-slideUpDrawer {
  animation: slideUpDrawer 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes slideUpDrawer {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.animate-slideUp {
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.animate-scaleIn {
  animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes scaleIn {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>
