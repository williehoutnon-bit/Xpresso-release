<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Newspaper, Bell, Trophy, BookOpen, Clock, ChevronRight, MessageSquare, Flame, PlayCircle, FileText, LayoutGrid, Bookmark, Hourglass, Microscope, Sigma, Beaker, AlertTriangle, Calendar, LogOut, Sun, Sparkles, UserPlus, Plus, Share2, Briefcase, Check, CheckCheck, Download, Settings } from 'lucide-svelte';
  import { jsPDF } from 'jspdf';
  import { formatMathAsPlainText } from '../math/mathSerialization';
  
  import schemaSql from '../../supabase_schema.sql?raw';

  let isFabOpen = $state(false);
  function toggleFab() {
    isFabOpen = !isFabOpen;
  }
  
  const downloadSqlAsFile = () => {
    const blob = new Blob([schemaSql], { type: 'application/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'supabase_schema.sql';
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const downloadSqlAsPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(schemaSql, 190);
    let y = 10;
    for (let i = 0; i < lines.length; i++) {
      if (y > 280) {
         doc.addPage();
         y = 10;
      }
      doc.text(lines[i], 10, y);
      y += 4;
    }
    doc.save('supabase_schema_script.pdf');
  };

  let { isGuest = false, userName = 'Learner', userClass = '', onnavigate, onviewnews, onviewbookmarks, onviewmessages, onviewnotifications, onviewprofile, onviewtimetable, onviewcatalogue, onviewnotes, onviewvideos, onviewdailyquestion, onviewideas, onviewprogress, onviewclasses, onjoinclass, onviewfeeds, onviewleaderboard, onviewpublicprofile, onviewforum, onopenChat, onsignup } = $props<{
    isGuest?: boolean;
    userName?: string;
    userClass?: string;
    onnavigate?: (target: string) => void;
    onviewnews?: () => void;
    onviewbookmarks?: () => void;
    onviewmessages?: () => void;
    onviewnotifications?: () => void;
    onviewprofile?: () => void;
    onviewtimetable?: () => void;
    onviewcatalogue?: () => void;
    onviewnotes?: () => void;
    onviewvideos?: () => void;
    onviewdailyquestion?: () => void;
    onviewideas?: () => void;
    onviewprogress?: () => void;
    onviewclasses?: () => void;
    onjoinclass?: () => void;
    onviewfeeds?: () => void;
    onviewleaderboard?: () => void;
    onviewpublicprofile?: () => void;
    onviewforum?: () => void;
    onopenChat?: (id: string, name: string) => void;
    onsignup?: () => void;
    onlogout?: () => void;
  }>();

  import { seedService } from '../services/seedService';
  import { messagingService } from '../services/messagingService';
  import { authService } from '../services/authService';
  import { dbService } from '../services/dbService';
  import { friendshipService } from '../services/friendshipService';

  const notifications = [
    "Mr. Kato added a new assignment",
    "Library revision tomorrow 4 PM",
    "Your mock exam results are ready",
    "New syllabus notes available"
  ];
  let currentNotificationIndex = $state(0);
  let currentNotification = $derived(notifications[currentNotificationIndex]);

  let conversations = $state<any[]>([]);
  let currentUserId = $state('');
  let leaderboardUsers = $state<any[]>([]);
  let subscriptions: any[] = [];
  let pendingRequestsCount = $state(0);
  let unreadMessagesCount = $state(0);

  // Banner Slideshow Logic
  const slides = $derived([
    { type: 'greeting', title: 'Good Day,', subtitle: userName, level: userClass },
    { type: 'exam', title: 'UACE exams in', subtitle: '188 days' },
    { type: 'advert', title: 'New Curriculum', subtitle: 'Project Ideas added!' }
  ]);
  let currentSlide = $state(0);
  let isChangingSlide = $state(false);
  const isStickyBanner = true; 

  let intervalId: any;
  let slideInterval: any;

  async function loadPendingCount() {
    if (currentUserId) {
        const requests = await friendshipService.getIncomingRequests(currentUserId);
        pendingRequestsCount = requests.length;
    }
  }

  onMount(async () => {
    // Background seeding if no conversations found locally
    try {
      const user = await authService.getCurrentUser();
      if (user) {
        currentUserId = user.$id;
        const profile = await authService.getProfile(user.$id);
        const schoolFilter = profile ? profile.school : undefined;
        leaderboardUsers = await friendshipService.getLeaderboard(3, schoolFilter);
        
        // 0. Load local data immediately
        refreshConversations();
        loadPendingCount();

        // 1. Observe messages to update previews
        const messages$ = await dbService.getMessagesStream$();
        const sub1 = messages$.subscribe(() => {
           refreshConversations();
        });
        subscriptions.push(sub1);

        // 2. Subscribe to friendship changes
        const { supabase } = await import('../services/supabaseService');
        const sub2Channel = supabase
          .channel(`friendships_dashboard_${currentUserId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'friendships' },
            (payload: any) => {
              const data = payload.new || payload.old;
              if (data && (data.friendId === currentUserId || data.userId === currentUserId || data.friend_id === currentUserId || data.user_id === currentUserId)) {
                loadPendingCount();
              }
            }
          )
          .subscribe();
        subscriptions.push({ unsubscribe: () => supabase.removeChannel(sub2Channel) });
      }
      
      const convos = (await messagingService.getConversations()) || [];
    } catch (e) {
      console.warn('Silent loading failed:', e);
    }

    intervalId = setInterval(() => {
      currentNotificationIndex = (currentNotificationIndex + 1) % notifications.length;
    }, 4000);
    
    slideInterval = setInterval(() => {
      isChangingSlide = true;
      setTimeout(() => {
        currentSlide = (currentSlide + 1) % slides.length;
        isChangingSlide = false;
      }, 500);
    }, 6000);
  });

  onDestroy(() => {
    if (intervalId) clearInterval(intervalId);
    if (slideInterval) clearInterval(slideInterval);
    subscriptions.forEach(s => {
      if (typeof s === 'function') s();
      else if (s && typeof s.unsubscribe === 'function') s.unsubscribe();
    });
  });

  let refreshTimer: any = null;
  async function refreshConversations() {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
       const res = await messagingService.getConversations();
       conversations = (res || []).slice(0, 3);
       
       if (currentUserId && res) {
         let count = 0;
         for (const convo of res) {
           const unread = await dbService.getUnreadCount(convo.id, currentUserId);
           count += unread;
         }
         unreadMessagesCount = count;
       }
       refreshTimer = null;
    }, 200);
  }

</script>

<div class="flex flex-col pb-24 relative">
  {#if isGuest}
    <div class="bg-accent/10 border-b border-accent/20 px-6 py-2 flex items-center justify-between">
      <span class="text-[9px] font-bold text-accent uppercase tracking-widest">Guest Preview Mode</span>
      <button onclick={() => onsignup?.()} class="text-[9px] font-bold text-accent underline uppercase tracking-widest bg-transparent border-none cursor-pointer">Sign up for full access</button>
    </div>
  {/if}

  <div class="sticky top-0 z-30 pt-0 pb-2 -mx-5 px-5 bg-gradient-to-b from-[#fdfbf7] via-[#fdfbf7]/90 to-transparent">
    <!-- Dark Header -->
    <header class="bg-[#242424] text-[#f8f8f8] px-5 pt-6 pb-12 flex items-center justify-between rounded-b-xl shadow-md z-10 relative mx-[-20px] px-[20px]">
      <div class="flex items-center gap-2 relative">
        <div class="relative">
          <BookOpen class="text-accent" size={24} strokeWidth={2.5} />
        </div>
        <span class="font-bold text-xl tracking-tighter">Xpresso</span>
      </div>
      <div class="flex items-center gap-2">
        <button onclick={downloadSqlAsFile} aria-label="Download SQL File" title="Download SQL File" class="flex items-center gap-1 bg-theme-card/10 hover:bg-theme-card/20 text-white border border-white/20 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase transition-colors cursor-pointer">
          <Download size={14} /> SQL
        </button>
        <button onclick={downloadSqlAsPdf} aria-label="Download SQL PDF" title="Download SQL as PDF" class="flex items-center gap-1 bg-theme-card/10 hover:bg-theme-card/20 text-white border border-white/20 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase transition-colors cursor-pointer">
          <Download size={14} /> PDF
        </button>
      </div>
    </header>

  <!-- Slideshow Sticky Banner -->
  <div class="px-5 mt-0 {isStickyBanner ? 'sticky top-2 z-30' : ''}">
    <div class="px-0 -mt-8 relative z-20">
      <div class="bg-gradient-to-tr from-[#3b2d71] to-[#7b5bc7] rounded-[20px] p-6 text-white shadow-lg relative overflow-hidden h-[140px] flex flex-col justify-center border border-white/10">
        <!-- Decorative shapes for the banner -->
        <div class="absolute right-4 top-4 w-10 h-10 bg-yellow-400 rounded-full shadow-[0_0_20px_rgba(250,204,21,0.5)]"></div>
        <div class="absolute bottom-0 right-0 w-[60%] h-[60%] opacity-20 pointer-events-none text-white overflow-hidden">
           <!-- Mountain shapes using SVG -->
           <svg viewBox="0 0 100 50" preserveAspectRatio="none" class="w-full h-full object-fill fill-current">
             <polygon points="0,50 30,20 50,40 80,10 100,50" />
           </svg>
        </div>
        
        <div class="relative z-10 transition-opacity duration-500 min-h-[60px] {isChangingSlide ? 'opacity-0' : 'opacity-100'}">
           {#if slides[currentSlide].type === 'exam'}
             <h3 class="text-sm font-bold opacity-90 tracking-wide mb-1">{slides[currentSlide].title}</h3>
             <div class="flex items-center gap-2">
               <Hourglass size={24} strokeWidth={2} />
               <span class="text-3xl font-bold tracking-tight">{slides[currentSlide].subtitle}</span>
             </div>
           {:else if slides[currentSlide].type === 'greeting'}
             <h3 class="text-sm font-bold opacity-90 tracking-wide mb-1">{slides[currentSlide].title}</h3>
             <div class="flex items-center gap-2 relative">
               <Sun size={24} strokeWidth={2} class="text-yellow-400 drop-shadow-sm absolute -left-2 -top-10 animate-pulse" />
               <span class="text-3xl font-bold tracking-tighter">{slides[currentSlide].subtitle}</span>
             </div>
           {:else if slides[currentSlide].type === 'advert'}
             <h3 class="text-sm font-bold opacity-90 tracking-wide mb-1 text-yellow-300 uppercase">{slides[currentSlide].title}</h3>
             <div class="flex items-center gap-2">
               <Sparkles size={20} strokeWidth={2.5} class="text-blue-300" />
               <span class="text-xl font-bold tracking-tight">{slides[currentSlide].subtitle}</span>
             </div>
           {/if}
        </div>
      </div>
    </div>
  </div> <!-- end sticky top section -->

  <div class="px-5 space-y-6 mt-4">
    <!-- Live Notifications Banner (Orange) -->
    <div>
      <button onclick={() => onviewtimetable?.()} class="w-full bg-[#f97316] rounded-[20px] px-5 py-3.5 flex items-center gap-3 text-white border-transparent shadow-md relative cursor-pointer hover:bg-orange-600 transition-colors text-left overflow-hidden">
        <Bell size={16} class="shrink-0" />
        <div class="flex-1 overflow-hidden relative h-5">
          <div class="absolute inset-0 flex items-center animate-slide-up-loop text-xs font-bold uppercase tracking-widest truncate">
            {currentNotification}
          </div>
        </div>
      </button>
    </div>
  </div>

  <div class="px-5 mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
    <!-- Center/Left Column -->
    <div class="space-y-6 lg:col-span-2">
      
      <!-- Streak & Score Card -->
      <div class="bg-theme-card rounded-[20px] p-5 border border-black/10 shadow-sm relative">
        <div class="grid grid-cols-3 gap-4 mb-4">
          <div class="text-center border-r border-black/5">
            <div class="flex items-center justify-center gap-1 mb-0.5">
              <span class="text-xl font-bold text-ink leading-none">14</span>
              <span class="text-lg">🔥</span>
            </div>
            <div class="text-[9px] text-sage font-bold uppercase tracking-widest">day streak</div>
          </div>
          <div class="text-center border-r border-black/5">
            <div class="text-xl font-bold text-ink mb-0.5 leading-none">47</div>
            <div class="text-[9px] text-sage font-bold uppercase tracking-widest">Qs this week</div>
          </div>
          <div class="text-center">
            <div class="text-xl font-bold text-ink mb-0.5 leading-none">7th</div>
            <div class="text-[9px] text-sage font-bold uppercase tracking-widest">School rank</div>
          </div>
        </div>
          <!-- Week Progress -->
          <div class="flex justify-between items-center gap-1.5 mb-2 mt-4">
            <div class="h-2 w-full bg-[#ff6d3b] rounded-full"></div>
            <div class="h-2 w-full bg-[#ff6d3b] rounded-full"></div>
            <div class="h-2 w-full bg-[#ff6d3b] rounded-full"></div>
            <div class="h-2 w-full bg-[#ff6d3b] rounded-full"></div>
            <div class="h-2 w-full bg-[#ff6d3b] rounded-full"></div>
            <div class="h-2 w-full bg-black/10 rounded-full"></div>
            <div class="h-2 w-full bg-black/10 rounded-full"></div>
          </div>
          <div class="flex justify-between items-center text-[9px] text-sage px-1 font-bold">
            <span>Mon</span>
            <span>Sun</span>
          </div>
        </div>

        <!-- Learning Library Section -->
        <section>
          <div class="grid grid-cols-4 gap-3 md:gap-6">
            <button class="flex flex-col items-center gap-2 group cursor-pointer border-none bg-transparent" onclick={() => onviewcatalogue?.()}>
              <div class="w-16 h-16 rounded-[20px] bg-theme-card border border-black/10 shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform group-hover:shadow-md">
                <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
                  <BookOpen size={20} />
                </div>
              </div>
              <span class="text-[9px] font-bold uppercase tracking-widest text-ink">Exams</span>
            </button>
            <button class="flex flex-col items-center gap-2 group cursor-pointer border-none bg-transparent" onclick={() => onviewnotes?.()}>
              <div class="w-16 h-16 rounded-[20px] bg-theme-card border border-black/10 shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform group-hover:shadow-md">
                <div class="w-10 h-10 rounded-full bg-[#fff5eb] flex items-center justify-center text-[#ff8b3d]">
                  <FileText size={20} />
                </div>
              </div>
              <span class="text-[9px] font-bold uppercase tracking-widest text-ink">Notes</span>
            </button>
            <button class="flex flex-col items-center gap-2 group cursor-pointer border-none bg-transparent" onclick={() => onviewvideos?.()}>
              <div class="w-16 h-16 rounded-[20px] bg-theme-card border border-black/10 shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform group-hover:shadow-md">
                <div class="w-10 h-10 rounded-full bg-[#f0f4ff] flex items-center justify-center text-[#4a6cf7]">
                  <PlayCircle size={20} />
                </div>
              </div>
              <span class="text-[9px] font-bold uppercase tracking-widest text-ink">Videos</span>
            </button>
            <button class="flex flex-col items-center gap-2 group cursor-pointer border-none bg-transparent" onclick={() => onviewtimetable?.()}>
              <div class="w-16 h-16 rounded-[20px] bg-theme-card border border-black/10 shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform group-hover:shadow-md">
                <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
                  <Calendar size={20} />
                </div>
              </div>
              <span class="text-[9px] font-bold uppercase tracking-widest text-ink">Timetable</span>
            </button>
          </div>
        </section>
        <!-- Today's Question Card -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-bold text-sage text-[10px] uppercase tracking-widest">Today's Question</h3>
            <span class="text-[10px] text-sage">Not done yet</span>
          </div>
          <button 
            onclick={() => onviewdailyquestion?.()}
            class="w-full border-l-[4px] border-l-[#ff8b3d] bg-theme-card rounded-[20px] p-5 text-left shadow-sm border border-black/10 relative overflow-hidden group hover:shadow-md transition-all cursor-pointer"
          >
            <div class="text-[10px] font-bold text-[#ff8b3d] uppercase tracking-widest mb-3">
              UCE BIOLOGY · 2022
            </div>
            <p class="font-medium text-ink mb-4 text-sm leading-relaxed">
              During photosynthesis, which organelle traps light energy, and what role does chlorophyll play?
            </p>
            <div class="text-sm font-bold text-[#ff8b3d] flex items-center gap-1">
              Answer now <span class="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </button>
        </div>

        <!-- Bounty Questions Slideshow -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-bold text-sage text-[10px] uppercase tracking-widest">Bounty Challenges</h3>
            <span class="text-[10px] text-sage font-bold flex items-center gap-1">Swipe <span class="text-[12px]">→</span></span>
          </div>
          <div class="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 -mx-4 px-4 scrollbar-hide border-none">
             <button 
               onclick={() => onnavigate?.('bounty')}
               class="w-[85vw] sm:w-80 shrink-0 snap-center bg-gradient-to-br from-purple-800 to-indigo-900 rounded-[20px] p-5 text-white shadow-lg relative overflow-hidden text-left border-none cursor-pointer"
             >
               <div class="absolute inset-0 bg-theme-card/5" style="clip-path: polygon(0 0, 100% 0, 100% 60%, 0 100%);"></div>
               <div class="relative z-10 flex justify-between items-start mb-4">
                  <span class="bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-widest">Prize: Shs 50,000</span>
                  <Flame size={18} class="text-yellow-400" />
               </div>
               <h4 class="font-bold text-base mb-2 relative z-10">Solve the Integration Puzzle</h4>
               <p class="text-xs text-white/70 relative z-10 line-clamp-2 mb-4">Find the exact area under the curve for this complex function before Friday.</p>
               <div class="flex items-center justify-between relative z-10 pt-4 border-t border-white/10">
                  <span class="text-[10px] uppercase tracking-widest font-bold opacity-80">By Mr. Kato</span>
                  <div class="bg-theme-card text-indigo-900 text-[10px] px-3 py-1.5 font-bold uppercase tracking-widest rounded-[20px]">View</div>
               </div>
             </button>
             <button 
               onclick={() => onnavigate?.('bounty')}
               class="w-[85vw] sm:w-80 shrink-0 snap-center bg-gradient-to-br from-emerald-800 to-teal-900 rounded-[20px] p-5 text-white shadow-lg relative overflow-hidden text-left border-none cursor-pointer"
             >
               <div class="absolute inset-0 bg-theme-card/5" style="clip-path: polygon(0 0, 100% 0, 100% 60%, 0 100%);"></div>
               <div class="relative z-10 flex justify-between items-start mb-4">
                  <span class="bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-widest">Prize: Shs 20,000</span>
                  <Flame size={18} class="text-yellow-400" />
               </div>
               <h4 class="font-bold text-base mb-2 relative z-10">Physics Pendulum Challenge</h4>
               <p class="text-xs text-white/70 relative z-10 line-clamp-2 mb-4">Design a pendulum mechanism that lasts exactly 60 seconds.</p>
               <div class="flex items-center justify-between relative z-10 pt-4 border-t border-white/10">
                  <span class="text-[10px] uppercase tracking-widest font-bold opacity-80">By STEM Club</span>
                  <div class="bg-theme-card text-teal-900 text-[10px] px-3 py-1.5 font-bold uppercase tracking-widest rounded-[20px]">View</div>
               </div>
             </button>
          </div>
        </div>

        <!-- Project Ideas Card (NEW) -->
        <button onclick={() => onviewideas?.()} class="w-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[20px] p-5 text-white flex justify-between items-center shadow-md cursor-pointer border-none hover:shadow-lg transition-all relative overflow-hidden">
           <div class="absolute inset-0 bg-theme-card/10" style="clip-path: polygon(60% 0%, 100% 0, 100% 100%, 80% 100%);"></div>
           <div class="relative z-10 text-left">
             <h3 class="font-bold text-lg tracking-tight flex items-center gap-2">
               Project Ideas 
               <span class="bg-theme-card/20 backdrop-blur-md text-white text-[9px] px-2.5 py-1 rounded-full uppercase tracking-widest border border-white/30 hidden sm:inline-block">New Curriculum</span>
             </h3>
             <p class="text-xs text-blue-100 mt-1 opacity-90">Explore ideas for your DIT subjects</p>
           </div>
           <div class="w-10 h-10 rounded-full bg-theme-card/20 backdrop-blur-md flex items-center justify-center relative z-10 border border-white/30 shrink-0 mx-2">
             <ChevronRight size={20} class="text-white" />
           </div>
        </button>

        <!-- Progress Overview -->
        <div class="bg-theme-card p-5 rounded-[20px] border border-black/10 shadow-sm">
          <div class="flex justify-between items-center mb-5">
            <h3 class="font-bold text-sage text-[10px] uppercase tracking-widest">My Progress</h3>
            <button onclick={() => onviewprogress?.()} class="text-[10px] bg-transparent border-none text-olive font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer">All <span>→</span></button>
          </div>
          <div class="space-y-5 mb-5">
            <!-- Biology Progress -->
            <div class="flex flex-col gap-2.5">
              <div class="flex justify-between items-center text-sm font-medium">
                <div class="flex items-center gap-2 text-ink">
                  <Microscope size={16} class="text-sage" /> Biology
                </div>
                <div class="text-olive font-bold">68%</div>
              </div>
              <div class="h-2 w-full bg-black/5 rounded-full overflow-hidden">
                <div class="h-full bg-gradient-to-r from-olive to-green-500 rounded-full" style="width: 68%;"></div>
              </div>
            </div>
            <!-- Maths Progress -->
            <div class="flex flex-col gap-2.5">
              <div class="flex justify-between items-center text-sm font-medium">
                <div class="flex items-center gap-2 text-ink">
                  <Sigma size={16} class="text-sage" /> Mathematics
                </div>
                <div class="text-olive font-bold">52%</div>
              </div>
              <div class="h-2 w-full bg-black/5 rounded-full overflow-hidden">
                <div class="h-full bg-gradient-to-r from-olive to-green-500 rounded-full" style="width: 52%;"></div>
              </div>
            </div>
            <!-- Chemistry Progress -->
            <div class="flex flex-col gap-2.5">
              <div class="flex justify-between items-center text-sm font-medium">
                <div class="flex items-center gap-2 text-ink">
                  <Beaker size={16} class="text-sage" /> Chemistry
                </div>
                <div class="text-[#ff6d3b] font-bold">24%</div>
              </div>
              <div class="h-2 w-full bg-black/5 rounded-full overflow-hidden">
                <div class="h-full bg-gradient-to-r from-[#ff8b3d] to-[#ff6d3b] rounded-full" style="width: 24%;"></div>
              </div>
            </div>
          </div>
          
          <button class="w-full text-left bg-[#fff5eb] border border-[#ff8b3d]/20 rounded-[20px] p-4 cursor-pointer hover:bg-[#fff0e0] transition-colors">
            <div class="flex items-center gap-2 text-[#ff8b3d] font-bold text-xs mb-2">
              <AlertTriangle size={14} /> Weak area: Chemistry (24%)
            </div>
            <div class="text-[#ff6d3b] font-bold text-xs flex items-center gap-1">
              Watch Electrolysis video <span>→</span>
            </div>
          </button>
        </div>
        
        <!-- Classroom Activity -->
        <div class="bg-theme-card p-5 rounded-[20px] border border-black/10 shadow-sm">
          <div class="flex justify-between items-center mb-5">
            <h3 class="font-bold text-sage text-[10px] uppercase tracking-widest">Classroom Activity</h3>
            <button onclick={() => onviewclasses?.()} class="bg-transparent border-none text-[10px] text-accent hover:text-olive transition-colors font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer">View All <span>→</span></button>
          </div>
          <div class="space-y-4">
            <button onclick={() => onjoinclass?.()} class="w-full text-left bg-transparent border-none flex items-center gap-4 cursor-pointer group">
              <div class="w-12 h-12 rounded-[20px] bg-[#f0f4ff] flex items-center justify-center shrink-0 text-xl text-[#4a6cf7] group-hover:scale-105 transition-transform">
                <BookOpen size={20} />
              </div>
              <div class="flex-1">
                <div class="flex justify-between items-start mb-0.5">
                  <h4 class="font-medium text-ink text-sm group-hover:text-[#4a6cf7] transition-colors">S.4 Biology — Mr. Kato</h4>
                  <span class="text-[9px] bg-[#4a6cf7]/10 text-[#4a6cf7] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-widest">Active</span>
                </div>
                <p class="text-xs text-sage font-medium">New question set · 12 students</p>
              </div>
            </button>
            
            <div class="h-px bg-black/5 w-full my-4"></div>

            <button class="w-full text-left bg-transparent border-none flex items-center gap-4 group cursor-pointer">
              <div class="w-12 h-12 rounded-[20px] bg-slate-100 flex items-center justify-center shrink-0 text-xl text-slate-500 group-hover:scale-105 transition-transform">
                <LayoutGrid size={20} />
              </div>
              <div class="flex-1">
                <div class="flex justify-between items-start mb-0.5">
                  <h4 class="font-medium text-ink text-sm">S.4 Mathematics — Ms. Nabirye</h4>
                  <span class="text-[9px] bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-widest">Pending</span>
                </div>
                <p class="text-xs text-sage font-medium">Due tomorrow · Quadratic equations</p>
              </div>
            </button>
          </div>
        </div>

      </div>

      <!-- Right Column / Sidebar -->
      <div class="space-y-6">
        <!-- School Feeds Card -->
        <button onclick={() => onviewfeeds?.()} class="w-full bg-theme-card p-5 rounded-[20px] border border-black/10 shadow-sm text-left group hover:shadow-md transition-all cursor-pointer">
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-bold text-ink text-sm group-hover:text-olive transition-colors">School Feed</h3>
            <div class="w-8 h-8 rounded-full bg-sage/10 flex items-center justify-center text-sage group-hover:bg-olive/10 group-hover:text-olive transition-colors">
              <ChevronRight size={16} />
            </div>
          </div>
          <p class="text-xs text-sage font-medium">See the latest updates from your school administrators.</p>
        </button>
        
        <!-- School Leaderboard -->
        {#if leaderboardUsers && leaderboardUsers.length > 0}
        <div class="bg-theme-card p-5 rounded-[20px] border border-black/10 shadow-sm">
          <div class="flex justify-between items-center mb-5">
            <h3 class="font-bold text-sage text-[10px] uppercase tracking-widest">School Leaderboard</h3>
            <button onclick={() => onviewleaderboard?.()} class="bg-transparent border-none text-[10px] text-olive font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer">Full <span>→</span></button>
          </div>
          <div class="space-y-1 text-sm">
            {#each leaderboardUsers.slice(0, 3) as lUser, i}
              <div class="flex items-center gap-3 w-full py-3 border-b border-black/5 {lUser.userId === currentUserId ? 'bg-olive/10 rounded-[20px] px-3 -mx-3 mt-3' : ''}">
                <div class="w-6 text-center text-sm font-bold {i === 0 ? 'text-[#ff8b3d]' : 'text-sage'}">{i + 1}</div>
                <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm font-bold {lUser.userId === currentUserId ? 'bg-olive text-white' : 'bg-theme-card border border-white/50 text-sage'}">{lUser.name ? lUser.name.charAt(0).toUpperCase() : '?'}</div>
                <button class="bg-transparent border-none p-0 flex-1 font-medium text-ink text-left text-sm cursor-pointer hover:text-olive truncate transition-colors" onclick={() => onviewpublicprofile?.()}>{lUser.name}{lUser.userId === currentUserId ? ' (You)' : ''}</button>
                <div class="font-bold text-olive text-sm">{lUser.points} <span class="text-[9px] font-bold text-sage uppercase">pts</span></div>
              </div>
            {/each}
          </div>
        </div>
        {/if}

        <!-- Forum Recent Questions -->
        <div class="bg-theme-card p-5 rounded-[20px] border border-black/10 shadow-sm">
          <div class="flex justify-between items-center mb-5">
            <h3 class="font-bold text-sage text-[10px] uppercase tracking-widest">Recent Forum</h3>
            <button onclick={() => onviewforum?.()} class="bg-transparent border-none p-0 text-[10px] text-olive font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer">All <span>→</span></button>
          </div>
          <div class="space-y-4">
            <button class="w-full text-left bg-transparent border-none p-0 cursor-pointer group">
              <h4 class="font-medium text-ink text-sm mb-1 leading-tight group-hover:text-olive transition-colors">How do you find the turning point of a quadratic?</h4>
              <p class="text-[10px] font-bold uppercase tracking-widest text-[#4a6cf7]">Maths · <span class="text-sage">4 answers</span></p>
            </button>
            <div class="h-px bg-black/5 w-full"></div>
            <button class="w-full text-left bg-transparent border-none p-0 cursor-pointer group">
              <h4 class="font-medium text-ink text-sm mb-1 leading-tight group-hover:text-olive transition-colors">What's the difference between osmosis and diffusion?</h4>
              <p class="text-[10px] font-bold uppercase tracking-widest text-green-600">Biology · <span class="text-sage">7 answers</span></p>
            </button>
          </div>
        </div>

        <!-- Latest Messages -->
        {#if conversations.length > 0}
        <div class="bg-theme-card p-5 rounded-[20px] border border-black/10 shadow-sm">
          <div class="flex justify-between items-center mb-5">
            <h3 class="font-bold text-sage text-[10px] uppercase tracking-widest">Inbox</h3>
            <button onclick={() => onviewmessages?.()} class="bg-transparent border-none p-0 text-[10px] text-olive font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer">All <span>→</span></button>
          </div>
          <div class="space-y-3">
              {#each conversations as convo (convo.id)}
                <button onclick={() => onopenChat?.(convo.id, convo.name || 'Learner')} class="w-full text-left p-3 rounded-[20px] bg-theme-card/40 border border-white/60 shadow-sm flex items-start gap-3 cursor-pointer hover:bg-theme-card hover:shadow-md transition-all relative group">
                  {#if convo.lastMessage && (convo.lastMessage.senderId ?? convo.lastMessage.sender_id) !== currentUserId && convo.lastMessage.status !== 'read'}
                     <div class="absolute -top-1 -left-1 w-3 h-3 bg-accent rounded-full border-2 border-[#fdfbf7] z-10"></div>
                  {/if}
                  <div class="w-8 h-8 rounded-full bg-olive/10 flex items-center justify-center shrink-0 border border-black/5 font-bold text-ink text-xs shadow-sm">
                    {convo.name ? convo.name[0] : '?'}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-center mb-0.5">
                      <h4 class="font-bold text-ink text-xs truncate group-hover:text-olive transition-colors">{convo.name || 'Anonymous'}</h4>
                      {#if convo.lastMessage}
                        <span class="text-[8px] text-sage font-bold uppercase tracking-widest shrink-0">{new Date(convo.lastMessage.createdAt ?? convo.lastMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {/if}
                    </div>
                    <div class="flex items-center gap-1">
                      {#if (convo.lastMessage?.senderId ?? convo.lastMessage?.sender_id) === currentUserId}
                         <div class="flex shrink-0">
                            {#if convo.lastMessage.status === 'read'}
                               <CheckCheck size={10} class="text-sky-500" />
                            {:else}
                               <Check size={10} class="text-sage" />
                            {/if}
                         </div>
                      {/if}
                      <p class="text-[10px] text-sage font-medium truncate flex-1">
                        {#if convo.lastMessage?.type === 'audio' || convo.lastMessage?.type === 'f:audio' || convo.lastMessage?.attachments?.some(a => a.type === 'audio')}
                          🎤 Voice note
                        {:else if convo.lastMessage?.type === 'video' || convo.lastMessage?.type === 'f:video' || convo.lastMessage?.attachments?.some(a => a.type === 'video')}
                          🎥 Video
                        {:else if convo.lastMessage?.type === 'image' || convo.lastMessage?.type === 'f:image' || convo.lastMessage?.attachments?.some(a => a.type === 'image')}
                          📷 Image
                        {:else if convo.lastMessage?.type === 'math_canvas' || convo.lastMessage?.type === 'f:math_canvas'}
                          📐 Math Canvas
                        {:else}
                          {formatMathAsPlainText(convo.lastMessage?.mathMeta?.nodes || convo.lastMessage?.math_meta || convo.lastMessage?.content) || 'No messages yet'}
                        {/if}
                      </p>
                    </div>
                  </div>
                </button>
              {/each}
          </div>
        </div>
        {/if}

      </div>
    </div>
  </div>

  {#if isFabOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onclick={() => isFabOpen = false}></div>
    <div class="fixed bottom-[160px] right-6 z-50 bg-theme-card rounded-[24px] p-3 shadow-xl border border-black/5 flex flex-col gap-1 w-64 pb-16">
      <!-- Menu Items -->
      <button onclick={() => { isFabOpen = false; onnavigate?.('share_notes'); }} class="flex items-center gap-3 p-2 w-full text-left bg-transparent border-none cursor-pointer rounded-[16px] hover:bg-black/5 transition-colors">
        <div class="w-10 h-10 rounded-full bg-sage/10 flex items-center justify-center shrink-0 text-ink">
          <Share2 size={18} />
        </div>
        <span class="font-bold text-sm text-ink">Share Notes</span>
      </button>

      <button onclick={() => { isFabOpen = false; onnavigate?.('portfolio'); }} class="flex items-center gap-3 p-2 w-full text-left bg-transparent border-none cursor-pointer rounded-[16px] hover:bg-black/5 transition-colors">
        <div class="w-10 h-10 rounded-full bg-[#ff8b3d]/10 flex items-center justify-center shrink-0 text-[#ff8b3d]">
          <Briefcase size={18} />
        </div>
        <span class="font-bold text-sm text-ink">Portfolio & Logbook</span>
      </button>
      
      <div class="h-px bg-black/5 w-full my-1"></div>

      <button onclick={() => { isFabOpen = false; onviewprofile?.(); }} class="flex items-center gap-3 p-2 w-full text-left bg-transparent border-none cursor-pointer rounded-[16px] hover:bg-black/5 transition-colors">
        <div class="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center shrink-0 text-ink">
          <Settings size={18} />
        </div>
        <span class="font-bold text-sm text-ink">Settings</span>
      </button>

      <button onclick={() => { isFabOpen = false; onviewnotifications?.(); }} class="flex items-center gap-3 p-2 w-full text-left bg-transparent border-none cursor-pointer rounded-[16px] hover:bg-black/5 transition-colors relative">
        <div class="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center shrink-0 text-ink relative">
          <Bell size={18} />
          {#if pendingRequestsCount > 0}
            <div class="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-orange-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white px-1">
              {pendingRequestsCount}
            </div>
          {/if}
        </div>
        <span class="font-bold text-sm text-ink">Alerts</span>
      </button>

      <button onclick={() => { isFabOpen = false; onviewmessages?.(); }} class="flex items-center gap-3 p-2 w-full text-left bg-transparent border-none cursor-pointer rounded-[16px] hover:bg-black/5 transition-colors relative">
        <div class="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center shrink-0 text-ink relative">
          <MessageSquare size={18} />
          {#if unreadMessagesCount > 0}
            <div class="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-orange-500 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white px-1">
              {unreadMessagesCount}
            </div>
          {/if}
        </div>
        <span class="font-bold text-sm text-ink">Messages</span>
      </button>

      <button onclick={() => { isFabOpen = false; onnavigate?.('portfolio'); }} class="flex items-center gap-3 p-2 w-full text-left bg-transparent border-none cursor-pointer rounded-[16px] hover:bg-black/5 transition-colors">
        <div class="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center shrink-0 text-ink">
          <UserPlus size={18} />
        </div>
        <span class="font-bold text-sm text-ink">Colleagues</span>
      </button>

      <button onclick={() => { isFabOpen = false; onviewbookmarks?.(); }} class="flex items-center gap-3 p-2 w-full text-left bg-transparent border-none cursor-pointer rounded-[16px] hover:bg-black/5 transition-colors">
        <div class="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center shrink-0 text-ink">
          <Bookmark size={18} />
        </div>
        <span class="font-bold text-sm text-ink">Bookmarks</span>
      </button>

      <button onclick={() => { isFabOpen = false; onviewnews?.(); }} class="flex items-center gap-3 p-2 w-full text-left bg-transparent border-none cursor-pointer rounded-[16px] hover:bg-black/5 transition-colors">
        <div class="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center shrink-0 text-ink">
          <Newspaper size={18} />
        </div>
        <span class="font-bold text-sm text-ink">News</span>
      </button>
    </div>
  {/if}

  <button 
    onclick={toggleFab}
    class="fixed bottom-[90px] right-6 z-50 w-14 h-14 rounded-full bg-[#111928] text-white flex items-center justify-center shadow-[0_8px_30px_rgba(0,0,0,0.12)] border-[3px] border-white hover:scale-105 transition-transform cursor-pointer"
  >
    <Plus size={24} class="transition-transform duration-300 {isFabOpen ? 'rotate-45' : ''}" />
  </button>
</div>
