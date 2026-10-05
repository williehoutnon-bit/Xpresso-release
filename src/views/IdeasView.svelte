<script lang="ts">
  import { ChevronLeft, Play, Clock, ImagePlus, Plus, Target, Flame, TrendingUp, Users, CheckCircle2, Hammer, Heart, MessageCircle, MessagesSquare } from 'lucide-svelte';

  let { onback } = $props<{ onback?: () => void }>();

  let selectedProject = $state<ProjectIdea | null>(null);

  const handleBack = () => {
    if (selectedProject) {
      selectedProject = null;
    } else {
      onback?.();
    }
  };

  interface ProjectResult {
    id: number;
    author: string;
    timeAgo: string;
    text: string;
    image?: string;
    likes: number;
  }

  interface ProjectIdea {
    id: number;
    title: string;
    subject: string;
    description: string;
    accepted: number;
    image?: string;
    trending?: boolean;
    results: ProjectResult[];
  }

  const ideas: ProjectIdea[] = [
    { 
      id: 1, 
      title: 'Building a Simple Water Filter', 
      subject: 'Chemistry / DIT', 
      description: 'Learn how to purify water using basic locally available materials like sand, charcoal, and gravel. This project explores the physical and chemical properties of filtration, perfect for rural problem-solving.',
      accepted: 142, 
      image: 'https://images.unsplash.com/photo-1541888078972-01962aa3bdf1?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
      trending: true,
      results: [
        { id: 101, author: 'Brian Mugisha', timeAgo: '2h ago', text: 'Just finished my prototype! Found that crushing the charcoal finer improved the clarity of the output water significantly.', image: 'https://images.unsplash.com/photo-1584472282946-e8f615e4a86b?ixlib=rb-1.2.1&auto=format&fit=crop&w=600&q=80', likes: 24 },
        { id: 102, author: 'Sarah N.', timeAgo: '5h ago', text: 'Can anyone recommend where to get clean fine sand? My first attempt had muddy results.', likes: 5 }
      ]
    },
    { 
      id: 2, 
      title: 'Urban Farming: Vertical Gardens', 
      subject: 'Agriculture', 
      description: 'Design and construct a space-saving vertical garden using recycled plastic bottles. A perfect project to demonstrate sustainable farming within limited urban spaces.',
      accepted: 89,
      image: 'https://images.unsplash.com/photo-1530836369250-bc4114587625?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
      results: [
        { id: 201, author: 'Alex O.', timeAgo: '1d ago', text: 'Planted some spinach and tomatoes. Stringing the bottles together was tricky but worth it!', image: 'https://images.unsplash.com/photo-1591857177580-dc52b2ce5bdf?ixlib=rb-1.2.1&auto=format&fit=crop&w=600&q=80', likes: 41 }
      ]
    },
    { 
      id: 3, 
      title: 'Basic Electronics: Intruder Alarm', 
      subject: 'Physics', 
      description: 'Build a very simple trip-wire intruder alarm to protect your room using a buzzer, a battery cell, and an improvised switch.',
      accepted: 215,
      trending: true,
      results: []
    },
    { 
      id: 4, 
      title: 'Creating Local Biogas Digesters', 
      subject: 'Biology', 
      description: 'Demonstrate anaerobic digestion by capturing methane from composting food waste in a sealed container.',
      accepted: 56,
      results: []
    }
  ];

  let sortedIdeas = $derived(
    [...ideas].sort((a, b) => {
      if (a.trending && !b.trending) return -1;
      if (!a.trending && b.trending) return 1;
      return b.accepted - a.accepted;
    })
  );
</script>

<div class="h-full bg-theme-paper flex flex-col overflow-y-auto pb-24 relative">
  <header class="px-5 py-4 flex items-center justify-between sticky top-0 bg-theme-paper/95 z-20 border-b border-black/5 shadow-sm">
    <button onclick={handleBack} class="p-2 -ml-2 text-sage bg-theme-card border-none cursor-pointer hover:text-olive transition-colors flex items-center justify-center w-10 h-10 rounded-[20px] shadow-sm border border-black/5">
      <ChevronLeft size={20} />
    </button>
    <div class="text-center">
      <h2 class="text-sm font-bold text-ink uppercase tracking-widest">{selectedProject ? 'Project Details' : 'Project Ideas'}</h2>
      <p class="text-[9px] text-accent font-bold uppercase tracking-widest">{selectedProject ? selectedProject.subject : 'Collaborate & Build'}</p>
    </div>
    <div class="w-10"></div>
  </header>

  {#if !selectedProject}
    <div class="px-5 py-6 max-w-5xl mx-auto w-full space-y-8">
      
      <!-- Post Project Idea Section -->
      <section class="bg-theme-card p-5 rounded-[20px] border border-black/10 shadow-sm">
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 rounded-full shrink-0 bg-accent/10 border border-accent/20 flex items-center justify-center text-accent font-bold">
            <Plus size={20}/>
          </div>
          <div class="flex-1 space-y-3">
             <h3 class="text-xs font-bold text-ink uppercase tracking-widest">Pitch a Project Idea</h3>
             <textarea placeholder="Describe your project idea... What are you building?" class="w-full bg-theme-paper border border-black/5 rounded-[20px] p-3 text-sm focus:outline-none focus:border-accent/30 min-h-[80px] resize-none"></textarea>
             <div class="flex justify-between items-center">
               <button class="text-sage bg-transparent border-none cursor-pointer hover:text-accent transition-colors"><ImagePlus size={18} /></button>
               <button class="bg-accent border-none cursor-pointer text-white px-4 py-2 rounded-[20px] text-[10px] font-bold uppercase tracking-widest shadow-sm hover:bg-ink transition-colors">Post Idea</button>
             </div>
          </div>
        </div>
      </section>

      <!-- Project Challenges Card -->
      <section class="bg-gradient-to-r from-orange-500 to-red-500 rounded-[20px] p-6 text-white shadow-md relative overflow-hidden group cursor-pointer hover:shadow-lg transition-shadow">
        <div class="absolute right-0 top-0 opacity-20 pointer-events-none transition-transform group-hover:scale-110">
          <Target size={120} class="-mt-4 -mr-4" />
        </div>
        <div class="relative z-10 w-3/4">
          <div class="flex items-center gap-2 mb-2">
            <Flame size={18} class="text-yellow-300" />
            <span class="text-[10px] font-bold uppercase tracking-widest text-yellow-300">Monthly Challenge</span>
          </div>
          <h3 class="font-bold text-xl leading-tight mb-2">Sustainable Agriculture Hack</h3>
          <p class="text-xs text-white/90 mb-4 leading-relaxed">Design a smart irrigation system using basic electronics. Top 3 projects win a mentorship session.</p>
          <button class="bg-theme-card border-none cursor-pointer text-orange-600 px-4 py-2 rounded-[20px] text-[10px] font-bold uppercase tracking-widest shadow-sm hover:bg-orange-50 transition-colors">Join Challenge</button>
        </div>
      </section>

      <!-- Suggested Projects -->
      <section>
        <div class="flex items-center justify-center mb-4 text-center">
          <h3 class="text-sm font-bold text-ink uppercase tracking-widest flex items-center gap-2">
            <TrendingUp size={18} class="text-sage" /> Suggested Projects
          </h3>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          {#each sortedIdeas as idea (idea.id)}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div 
              onclick={() => selectedProject = idea}
              class="flex flex-col bg-theme-card p-4 rounded-[20px] border border-black/10 shadow-sm cursor-pointer hover:shadow-md transition-all group relative overflow-hidden"
            >
              <div class="flex gap-4">
                <div class="w-20 h-20 bg-slate-100 rounded-[20px] overflow-hidden shrink-0 relative flex items-center justify-center text-slate-400 group-hover:shadow-[0_0_0_2px_rgba(79,70,229,0.3)] transition-shadow">
                   {#if idea.image}
                     <img src={idea.image} alt="Project representation" class="w-full h-full object-cover" />
                   {:else}
                     <Hammer size={24} />
                   {/if}
                </div>
                <div class="flex-1 flex flex-col justify-center">
                   <div class="flex items-center gap-2 mb-1">
                     <span class="text-[9px] text-accent font-bold uppercase tracking-widest bg-accent/10 px-2 py-0.5 rounded-full w-max">{idea.subject}</span>
                     {#if idea.trending}
                       <span class="text-[9px] text-orange-500 font-bold uppercase tracking-widest bg-orange-100 px-2 py-0.5 rounded-full w-max flex items-center gap-1"><Flame size={10} /> Trending</span>
                     {/if}
                   </div>
                   <h4 class="font-bold text-ink text-sm leading-tight mb-2 group-hover:text-accent transition-colors pr-2">{idea.title}</h4>
                   <div class="flex items-center gap-3 text-[10px] text-sage font-bold uppercase tracking-widest">
                     <span class="flex items-center gap-1"><Users size={12} /> {idea.accepted} accepted</span>
                   </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      </section>
    </div>

  <!-- Details View -->
  {:else}
    <div class="px-5 py-6 max-w-4xl mx-auto w-full space-y-6">
      <!-- Header / Video Cover -->
      <div class="w-full aspect-video bg-black rounded-[20px] overflow-hidden relative shadow-md flex items-center justify-center group cursor-pointer">
        {#if selectedProject.image}
          <img src={selectedProject.image} alt="Project detail" class="w-full h-full object-cover opacity-60" />
        {/if}
        <div class="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div class="w-16 h-16 bg-theme-card/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/50 group-hover:scale-110 transition-transform">
            <Play size={32} fill="white" class="ml-1 text-white" />
          </div>
          <span class="text-white text-xs font-bold uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full">Watch Explanation</span>
        </div>
      </div>

      <!-- Project Info -->
      <div class="bg-theme-card p-6 rounded-[20px] border border-black/10 shadow-sm relative">
        <span class="text-[9px] text-accent font-bold uppercase tracking-widest bg-accent/10 px-2.5 py-1 rounded-full mb-3 inline-block">{selectedProject.subject}</span>
        <h1 class="text-2xl font-black text-ink leading-tight mb-3">{selectedProject.title}</h1>
        <p class="text-sm text-sage leading-relaxed mb-6">{selectedProject.description}</p>
        
        <div class="flex items-center justify-between border-t border-black/5 pt-4">
          <div class="flex items-center gap-4">
            <div class="flex -space-x-3">
              <div class="w-8 h-8 rounded-full border-2 border-white bg-olive text-white flex items-center justify-center text-[10px] font-bold z-30">A</div>
              <div class="w-8 h-8 rounded-full border-2 border-white bg-accent text-white flex items-center justify-center text-[10px] font-bold z-20">J</div>
              <div class="w-8 h-8 rounded-full border-2 border-white bg-orange-500 text-white flex items-center justify-center text-[10px] font-bold z-[10]">M</div>
            </div>
            <span class="text-xs font-bold text-ink">{selectedProject.accepted} people accepted this</span>
          </div>
          
          <button class="bg-accent border-none cursor-pointer text-white px-6 py-3 rounded-[20px] text-xs font-bold uppercase tracking-widest shadow-sm hover:bg-ink hover:-translate-y-0.5 transition-all active:translate-y-0 flex items-center gap-2">
            <CheckCircle2 size={16} /> Accept Project
          </button>
        </div>
      </div>

      <!-- Results / Activity Feed -->
      <div>
        <h3 class="text-sm font-bold text-ink uppercase tracking-widest mb-4 flex items-center gap-2">
          <MessagesSquare size={18} class="text-sage" /> Activity & Results
        </h3>
        
        <div class="space-y-4">
          {#each selectedProject.results as result (result.id)}
            <div class="bg-theme-card p-5 rounded-[20px] border border-black/10 shadow-sm">
              <div class="flex items-center gap-3 mb-3">
                <div class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">{result.author[0]}</div>
                <div>
                  <p class="text-xs font-bold text-ink">{result.author}</p>
                  <p class="text-[9px] text-sage font-bold uppercase tracking-widest">{result.timeAgo} · Posted an update</p>
                </div>
              </div>
              <p class="text-sm text-ink mb-3 leading-relaxed">{result.text}</p>
              {#if result.image}
                <div class="w-full h-48 bg-slate-100 rounded-[20px] overflow-hidden border border-black/5 mb-3">
                  <img src={result.image} alt="User result" class="w-full h-full object-cover" />
                </div>
              {/if}
              <div class="flex items-center gap-4 border-t border-black/5 pt-3">
                <button class="flex items-center bg-transparent border-none cursor-pointer gap-1 text-[10px] font-bold uppercase tracking-widest text-sage hover:text-accent transition-colors">
                  <Heart size={14} /> {result.likes} Likes
                </button>
                <button class="flex items-center bg-transparent border-none cursor-pointer gap-1 text-[10px] font-bold uppercase tracking-widest text-sage hover:text-accent transition-colors">
                  <MessageCircle size={14} /> Reply
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>
