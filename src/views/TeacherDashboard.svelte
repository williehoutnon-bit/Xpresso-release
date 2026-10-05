<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { 
    Newspaper, Plus, Users, BarChart3, ChevronRight, CheckCircle2, 
    Clock, Bell, MessageSquare, LogOut, X, BookOpen, Layers, ShieldCheck, ShieldAlert,
    ToggleLeft, ToggleRight, Camera, Image as ImageIcon, Send, Globe, Bookmark, Calendar, Zap, ClipboardCheck, Sun, UserPlus, ChevronDown, Check
  } from 'lucide-svelte';

  // Make sure we have a fake notification service so we don't break
  function triggerNotification(title: string, options: any) {
    console.log(`Notification: ${title}`, options);
  }

  let { userName = 'Educator', verificationStatus = 'unverified', onlogout, onverify, onstartclass, onviewnews, onviewfeeds, onviewbookmarks, onviewtimetable, onviewmarking, onviewforum, onviewconnections, onviewideas } = $props<{
    userName?: string;
    verificationStatus?: 'unverified' | 'pending' | 'verified';
    onlogout?: () => void;
    onverify?: () => void;
    onstartclass?: () => void;
    onviewnews?: () => void;
    onviewfeeds?: () => void;
    onviewbookmarks?: () => void;
    onviewtimetable?: () => void;
    onviewmarking?: () => void;
    onviewforum?: () => void;
    onviewconnections?: () => void;
    onviewideas?: () => void;
    onnavigate?: (target: string) => void;
  }>();

  let hasNewResults = $state(true);

  const notifications = [
    "Sarah Nakato submitted Bio P2",
    "Senior 4 Alpha class starting in 10m",
    "New join request from James",
    "Platform maintenance scheduled"
  ];
  let currentNotificationIndex = $state(0);
  let currentNotification = $derived(notifications[currentNotificationIndex]);

  let intervalId: any;
  onMount(() => {
    intervalId = setInterval(() => {
      currentNotificationIndex = (currentNotificationIndex + 1) % notifications.length;
    }, 4000);
  });
  onDestroy(() => {
    if (intervalId) clearInterval(intervalId);
  });

  import { messagingService } from '../services/messagingService';
  import { authService } from '../services/authService';
  import { dbService } from '../services/dbService';
  import { friendshipService } from '../services/friendshipService';

  let activePanel = $state<'dashboard' | 'classes' | 'insights' | 'exams' | 'join_requests' | 'student_profile'>('dashboard');
  let isStickyBanner = true;
  let showAddModal = $state(false);
  let modalType = $state<'student' | 'class' | 'none'>('none');
  let isScanning = $state(false);
  let scanResult = $state<string | null>(null);
  let unreadCount = $state(0);
  let subscriptions: any[] = [];
  let studentRegistry = $state<any[]>([]);

  let currentTime = $state(Date.now());
  $effect(() => {
    const interval = setInterval(() => {
      currentTime = Date.now();
    }, 15000);
    return () => clearInterval(interval);
  });

  let examBuilderMode = $state<'scan' | 'manual'>('manual');
  let examTarget = $state<'class' | 'broadcast'>('class');
  let includeAnswer = $state(false);
  let isSimulatedExam = $state(false);

  let joinRequests = $state<any[]>([]);

  const handleJoinRequest = (id: string, accept: boolean) => {
    const request = joinRequests.find(r => r.id === id);
    joinRequests = joinRequests.filter(r => r.id !== id);
    if (accept && request) {
      triggerNotification('Request Accepted', { body: `${request.name} has been notified and added to your class.`, type: 'success' });
    }
  };

  const handleScan = () => {
    isScanning = true;
    scanResult = null;
    setTimeout(() => {
      isScanning = false;
      scanResult = "Q1: Explain the function of Mitochondria.\nQ2: What is photosynthesis?\nQ3: Name three parts of a plant cell.";
    }, 2500);
  };

  const openModal = (type: 'student' | 'class') => {
    modalType = type;
    showAddModal = true;
  };

  let refreshTimer: any = null;
  async function refreshUnreadCount(user: any) {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
       const convos = (await messagingService.getConversations()) || [];
       unreadCount = convos.reduce((acc, c) => {
          if (c.lastMessage && (c.lastMessage.senderId ?? c.lastMessage.sender_id) !== user.$id && c.lastMessage.status !== 'read') {
            return acc + 1;
          }
          return acc;
       }, 0);
       refreshTimer = null;
    }, 200);
  }

  onMount(async () => {
    intervalId = setInterval(() => {
      currentNotificationIndex = (currentNotificationIndex + 1) % notifications.length;
    }, 4000);

    const user = await authService.getCurrentUser();
    if (user) {
      // 0. Initial load
      refreshUnreadCount(user);

      // Load mock list but using real users if possible
      const leader = await friendshipService.getLeaderboard(5);
      if (leader && leader.length > 0) {
         studentRegistry = leader.map(u => ({ ...u, examScore: Math.floor(Math.random() * 30) + 65 }));
         /* Add a few as requests */
         const possibleReqs = await friendshipService.getLeaderboard(3, 'Foreign School');
         joinRequests = possibleReqs.map((u, i) => ({
             id: u.userId,
             name: u.name,
             subject: ['A-Level Chemistry', 'Senior 4 Alpha', 'Senior 6 Gamma'][i] || 'New Class'
         }));
      }

      const messages$ = await dbService.getMessagesStream$();
      const sub = messages$.subscribe(async () => {
         refreshUnreadCount(user);
      });
      subscriptions.push(sub);
    }
  });
  onDestroy(() => {
    if (intervalId) clearInterval(intervalId);
    subscriptions.forEach(s => s.unsubscribe());
  });
</script>

<div class="flex flex-col pb-24 relative bg-theme-paper flex-1">
  <div class="sticky top-0 z-30 pt-0 pb-2 -mx-5 px-5 bg-gradient-to-b from-[#fdfbf7] via-[#fdfbf7]/90 to-transparent">
    <!-- Dark Header -->
    <header class="bg-[#242424] text-[#f8f8f8] px-5 pt-6 pb-12 flex items-center justify-between rounded-b-xl shadow-md z-10 relative mx-[-20px] px-[20px]">
      <div class="flex items-center gap-2 relative">
        <div class="relative">
          <BookOpen class="text-accent" size={24} strokeWidth={2.5} />
        </div>
        <span class="font-bold text-xl tracking-tighter">Xpresso</span>
        <span class="text-[9px] uppercase font-bold text-accent tracking-widest ml-1 bg-accent/20 px-1.5 py-0.5 rounded-full">Educator</span>
      </div>
      <div class="flex items-center gap-4">
        <button onclick={() => onviewnews?.()} class="border-none bg-transparent cursor-pointer p-0">
          <Newspaper size={22} class="text-white/60 hover:text-white transition-colors" />
        </button>
        <button onclick={() => onviewforum?.()} class="relative border-none bg-transparent cursor-pointer p-0">
          <MessageSquare size={22} class="text-white/60 hover:text-white transition-colors" />
          {#if unreadCount > 0}
            <div class="absolute -top-1 -right-1 w-4 h-4 bg-accent rounded-full border-2 border-[#242424] flex items-center justify-center text-[8px] font-bold text-white">{unreadCount}</div>
          {/if}
        </button>
        <button onclick={() => onviewconnections?.()} class="relative border-none bg-transparent cursor-pointer p-0">
          <UserPlus size={22} class="text-white/60 hover:text-white transition-colors" />
          {#if joinRequests.length > 0}
            <div class="absolute -top-0.5 -right-0.5 w-2 h-2 bg-orange-500 rounded-full border border-[#242424]"></div>
          {/if}
        </button>
        <button onclick={() => onviewmarking?.()} class="relative border-none bg-transparent cursor-pointer p-0">
          <ClipboardCheck size={22} class="text-white/60 hover:text-white transition-colors" />
          {#if hasNewResults}
            <div class="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full border-2 border-white animate-pulse"></div>
          {/if}
        </button>
        <button onclick={() => onlogout?.()} class="w-8 h-8 rounded-full bg-theme-card text-ink flex items-center justify-center font-bold text-xs uppercase shadow-sm ml-1 transition-transform hover:scale-105 border-none cursor-pointer p-0">
          SO
        </button>
      </div>
    </header>

    <div class="px-5 mt-0 space-y-6 {isStickyBanner ? 'sticky top-2 z-30' : ''}">
      <div class="px-0 -mt-8 relative z-20">
        <div class="bg-gradient-to-tr from-[#3b2d71] to-[#7b5bc7] rounded-[20px] p-6 text-white shadow-lg relative overflow-hidden h-[140px] flex flex-col justify-center border border-white/10">
          <div class="absolute right-4 top-4 w-10 h-10 bg-yellow-400 rounded-full shadow-[0_0_20px_rgba(250,204,21,0.5)]"></div>
          <div class="absolute bottom-0 right-0 w-[60%] h-[60%] opacity-20 pointer-events-none text-white overflow-hidden">
             <svg viewBox="0 0 100 50" preserveAspectRatio="none" class="w-full h-full object-fill fill-current">
               <polygon points="0,50 30,20 50,40 80,10 100,50" />
             </svg>
          </div>
          
          <div class="relative z-10 min-h-[60px]">
             <h3 class="text-sm font-bold opacity-90 tracking-wide mb-1">Good Afternoon,</h3>
             <div class="flex items-center gap-2 relative">
               <Sun size={24} strokeWidth={2} class="text-yellow-400 drop-shadow-sm absolute -left-2 -top-10 animate-pulse" />
               <span class="text-3xl font-bold tracking-tighter">{userName}</span>
             </div>
          </div>
        </div>
      </div>

      <div class="px-5 -mt-2">
        <div class="w-full bg-[#f97316] rounded-[20px] px-5 py-3.5 flex items-center gap-3 text-white shadow-md relative overflow-hidden">
          <Bell size={16} class="shrink-0" />
          <div class="flex-1 overflow-hidden relative h-5">
            <div class="absolute inset-0 flex items-center animate-slide-up-loop text-xs font-bold uppercase tracking-widest truncate">
              {currentNotification}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  {#if activePanel === 'dashboard'}
    <div class="px-5 mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10 w-full max-w-7xl mx-auto">
      <div class="space-y-6 lg:col-span-2">

    <!-- Stats Summary -->
    <div class="grid grid-cols-2 gap-4">
      <button onclick={() => activePanel = 'classes'} class="bg-theme-card p-4 rounded-[20px] border border-black/10 shadow-sm text-left hover:shadow-md transition-all group cursor-pointer">
        <div class="mb-2"><Users size={18} class="text-olive group-hover:scale-110 transition-transform" /></div>
        <div class="text-xl font-bold text-ink leading-none mb-1">124</div>
        <div class="text-[9px] text-sage font-bold uppercase tracking-widest">Total Learners</div>
      </button>
      <button onclick={() => activePanel = 'classes'} class="bg-theme-card p-4 rounded-[20px] border border-black/10 shadow-sm text-left hover:shadow-md transition-all group cursor-pointer">
        <div class="mb-2"><Layers size={18} class="text-accent group-hover:scale-110 transition-transform" /></div>
        <div class="text-xl font-bold text-ink leading-none mb-1">6</div>
        <div class="text-[9px] text-sage font-bold uppercase tracking-widest">Active Classes</div>
      </button>
    </div>

    <div>
      <button 
        onclick={() => activePanel = 'join_requests'}
        class="w-full bg-accent/10 p-5 rounded-[20px] border border-accent/20 flex items-center justify-between group hover:border-accent transition-all shadow-sm text-left cursor-pointer"
      >
        <div class="flex items-center gap-4">
          <div class="w-10 h-10 rounded-[20px] bg-theme-card text-accent flex items-center justify-center relative shadow-sm border border-accent/10">
            <Bell size={20} />
            {#if joinRequests.length > 0}
              <div class="absolute -top-1 -right-1 w-4 h-4 bg-accent rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold text-white">{joinRequests.length}</div>
            {/if}
          </div>
          <div>
            <div class="font-bold text-ink text-sm">Join Requests</div>
            <div class="text-[10px] text-sage font-bold uppercase tracking-widest mt-0.5">{joinRequests.length} pending approvals</div>
          </div>
        </div>
        <ChevronRight size={20} class="text-accent group-hover:text-red-500 transition-colors" />
      </button>
    </div>

    <div>
      <!-- Simplified SchoolFeedCard -->
      <button onclick={() => onviewfeeds?.()} class="w-full bg-theme-card p-5 rounded-[20px] border border-black/10 shadow-sm text-left group cursor-pointer">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-bold text-ink text-sm">School Feed</h3>
          <ChevronRight size={16} class="text-sage" />
        </div>
        <p class="text-xs text-sage">Post announcements to your school.</p>
      </button>
    </div>
    </div>

    <div class="flex flex-col gap-4">
      <!-- Project Ideas Card (NEW) -->
      <button onclick={() => onviewideas?.()} class="text-left w-full border-none bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[20px] p-5 text-white flex justify-between items-center shadow-md cursor-pointer hover:shadow-lg transition-all relative overflow-hidden">
         <div class="absolute inset-0 bg-theme-card/10" style="clip-path: polygon(60% 0%, 100% 0, 100% 100%, 80% 100%);"></div>
         <div class="relative z-10">
           <h3 class="font-bold text-lg tracking-tight flex items-center gap-2">
             Project Ideas
             <span class="bg-theme-card/20 backdrop-blur-md text-white text-[9px] px-2.5 py-1 rounded-full uppercase tracking-widest border border-white/30 hidden sm:inline-block">New Curriculum</span>
           </h3>
           <p class="text-xs text-blue-100 mt-1 opacity-90">Manage or suggest DIT project ideas</p>
         </div>
         <div class="w-10 h-10 shrink-0 rounded-full bg-theme-card/20 backdrop-blur-md flex items-center justify-center relative z-10 border border-white/30">
           <ChevronRight size={20} class="text-white" />
         </div>
      </button>

      <button 
        onclick={() => activePanel = 'classes'}
        class="bg-theme-card p-6 rounded-[20px] border border-black/10 flex items-center justify-between group hover:shadow-md transition-all shadow-sm cursor-pointer"
      >
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-[20px] bg-olive/10 text-olive flex items-center justify-center">
            <Users size={24} />
          </div>
          <div class="text-left">
            <div class="font-bold text-ink text-sm">Management</div>
            <div class="text-[10px] text-sage font-bold uppercase tracking-widest mt-1">Manage classes & students</div>
          </div>
        </div>
        <ChevronRight size={20} class="text-sage group-hover:text-olive transition-colors" />
      </button>

      <button 
        onclick={() => activePanel = 'insights'}
        class="bg-theme-card p-6 rounded-[20px] border border-black/10 flex items-center justify-between group hover:shadow-md transition-all shadow-sm cursor-pointer"
      >
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-[20px] bg-accent/10 text-accent flex items-center justify-center">
            <BarChart3 size={24} />
          </div>
          <div class="text-left">
            <div class="font-bold text-ink text-sm">Live Tracking</div>
            <div class="text-[10px] text-sage font-bold uppercase tracking-widest mt-1">Monitor real-time performance</div>
          </div>
        </div>
        <ChevronRight size={20} class="text-sage group-hover:text-accent transition-colors" />
      </button>

      <button 
        onclick={() => activePanel = 'exams'}
        class="bg-theme-card p-6 rounded-[20px] border border-black/10 flex items-center justify-between group hover:shadow-md transition-all shadow-sm cursor-pointer"
      >
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-[20px] bg-ink/10 text-ink flex items-center justify-center">
            <BookOpen size={24} />
          </div>
          <div class="text-left">
            <div class="font-bold text-ink text-sm">Exams</div>
            <div class="text-[10px] text-sage font-bold uppercase tracking-widest mt-1">Create and manage exams</div>
          </div>
        </div>
        <ChevronRight size={20} class="text-sage group-hover:text-ink transition-colors" />
      </button>

      <button 
        onclick={() => onviewtimetable?.()}
        class="bg-theme-card p-6 rounded-[20px] border border-black/10 flex items-center justify-between group hover:shadow-md transition-all shadow-sm cursor-pointer"
      >
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-[20px] bg-accent/10 border border-accent/20 text-accent flex items-center justify-center">
            <Calendar size={24} />
          </div>
          <div class="text-left">
            <div class="font-bold text-ink text-sm">Timetables</div>
            <div class="text-[10px] text-sage font-bold uppercase tracking-widest mt-1">Manage school schedule</div>
          </div>
        </div>
        <ChevronRight size={20} class="text-sage group-hover:text-accent transition-colors" />
      </button>
    </div>
    </div>
  {:else}
    <div class="flex flex-col flex-1 h-full z-30 bg-cream">
       <!-- Panel Header -->
       <div class="px-6 py-4 border-b border-black/5 bg-paper flex items-center gap-4 sticky top-0 z-10 shadow-sm">
         <button onclick={() => activePanel = 'dashboard'} class="p-2 -ml-2 border-none bg-transparent text-sage hover:text-black rounded-[20px] transition-colors cursor-pointer">
           <ChevronRight size={20} class="rotate-180" />
         </button>
         <h3 class="text-sm font-bold text-ink uppercase tracking-widest">
           {activePanel === 'classes' ? 'Management' : activePanel === 'insights' ? 'Live Tracking' : activePanel === 'exams' ? 'Exams' : activePanel === 'join_requests' ? 'Join Requests' : 'Student Profile'}
         </h3>
       </div>
       
       <div class="flex-1 overflow-y-auto p-6 space-y-8">
         {#if activePanel === 'classes' || activePanel === 'join_requests'}
            <!-- Classes / Join requests view logic combined for simplicity in migration -->
            {#if activePanel === 'join_requests' || activePanel === 'classes'}
              <section class="space-y-4 mb-6">
                <div class="flex items-center justify-between mb-2">
                   <h3 class="text-[10px] font-bold uppercase tracking-[0.2em] text-sage">Join Requests</h3>
                   <span class="text-[9px] bg-accent/10 text-accent px-2 py-0.5 rounded-full font-bold">{joinRequests.length} Pending</span>
                </div>
                <div class="bg-paper p-4 rounded-[20px] border border-sage/10 shadow-sm space-y-3">
                   {#if joinRequests.length === 0}
                     <p class="text-[10px] text-sage uppercase tracking-widest text-center py-2">No pending requests</p>
                   {/if}
                   {#each joinRequests as req}
                     <div class="flex items-center justify-between">
                        <div>
                          <p class="font-bold text-sm text-ink leading-none">{req.name}</p>
                          <p class="text-[10px] text-sage font-medium uppercase tracking-widest mt-1">Requested: {req.subject}</p>
                        </div>
                        <div class="flex gap-2">
                           <button onclick={() => handleJoinRequest(req.id, false)} class="p-2 border border-sage/20 rounded-[20px] bg-transparent text-sage hover:bg-sage/10 transition-colors cursor-pointer"><X size={14}/></button>
                           <button onclick={() => handleJoinRequest(req.id, true)} class="p-2 bg-olive text-white rounded-[20px] shadow-sm active:scale-95 border-none transition-transform cursor-pointer"><CheckCircle2 size={14} /></button>
                        </div>
                     </div>
                   {/each}
                </div>
              </section>
            {/if}

            {#if activePanel === 'classes'}
              <section class="space-y-4">
                <div class="flex items-center justify-between mb-2">
                   <h3 class="text-[10px] font-bold uppercase tracking-[0.2em] text-sage">Class Groups</h3>
                   <div class="flex items-center gap-3">
                     <button 
                       onclick={() => onstartclass?.()}
                       class="text-[9px] text-accent border-none font-extrabold flex items-center gap-1 uppercase tracking-widest bg-accent/10 px-2 py-1 rounded-full animate-pulse cursor-pointer"
                     >
                       <Zap size={10} fill="currentColor" /> Start Live
                     </button>
                     {#if verificationStatus === 'verified'}
                       <button 
                        onclick={() => openModal('class')}
                        class="text-[9px] text-olive border-none bg-transparent font-extrabold flex items-center gap-1 uppercase tracking-widest cursor-pointer"
                       >
                         <Plus size={12} /> New Group
                       </button>
                     {/if}
                   </div>
                </div>
                
                <button class="w-full bg-paper p-4 rounded-[20px] border border-sage/10 flex items-center justify-between group cursor-pointer hover:border-olive shadow-sm transition-all text-left">
                  <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-[20px] flex items-center justify-center bg-cream text-olive">
                      <Users size={24} />
                    </div>
                    <div>
                      <div class="font-bold text-ink text-sm leading-tight ">Senior 4 Alpha</div>
                      <div class="text-[10px] text-sage font-bold uppercase tracking-wider">42 students · Biology</div>
                    </div>
                  </div>
                  <ChevronRight size={18} class="text-sage" />
                </button>

                <button class="w-full bg-paper p-4 rounded-[20px] border border-sage/10 flex items-center justify-between group cursor-pointer hover:border-olive shadow-sm transition-all text-left">
                  <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-[20px] flex items-center justify-center bg-cream text-olive">
                      <Users size={24} />
                    </div>
                    <div>
                      <div class="font-bold text-ink text-sm leading-tight ">Senior 6 Gamma</div>
                      <div class="text-[10px] text-sage font-bold uppercase tracking-wider">18 students · Physics</div>
                    </div>
                  </div>
                  <ChevronRight size={18} class="text-sage" />
                </button>
                
                {#if verificationStatus !== 'verified'}
                  <div class="bg-cream/50 border border-dashed border-sage/30 rounded-[20px] p-4 text-center">
                    <ShieldAlert size={16} class="mx-auto mb-2 text-sage" />
                    <p class="text-[9px] font-bold text-sage uppercase tracking-widest leading-relaxed">
                      Verify account to create new class groups
                    </p>
                  </div>
                {/if}
              </section>
              
              <section class="space-y-4 mt-8">
                <div class="flex items-center justify-between">
                  <h3 class="text-[10px] font-bold uppercase tracking-[0.2em] text-sage">Student Registry</h3>
                  <button 
                    onclick={() => openModal('student')}
                    class="text-[9px] text-olive font-extrabold flex items-center bg-olive/10 border-none gap-1 uppercase tracking-widest px-2 py-1 rounded-full cursor-pointer"
                  >
                    <Plus size={12} /> Add Student
                  </button>
                </div>
                <div class="bg-paper rounded-[20px] border border-sage/10 overflow-hidden divide-y divide-black/5">
                  {#each studentRegistry as student}
                  <div class="p-4 flex items-center justify-between hover:bg-cream transition-colors cursor-pointer group">
                    <div class="flex items-center gap-4">
                      <div class="relative">
                        <div class="w-10 h-10 rounded-full bg-cream flex items-center justify-center font-bold text-xs uppercase text-olive border border-sage/10 group-hover:bg-olive group-hover:text-white transition-all overflow-hidden">
                           {#if student.avatarUrl}
                             <img src={student.avatarUrl} alt="" class="w-full h-full object-cover">
                           {:else}
                             {student.name.charAt(0)}
                           {/if}
                        </div>
                        <div class="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-paper shadow-sm {authService.computeIsOnline(student, currentTime) ? 'bg-accent' : 'bg-sage/40'}"></div>
                      </div>
                      <div>
                        <div class="font-bold text-ink text-xs uppercase tracking-tight">{student.name}</div>
                        <div class="text-[9px] text-sage font-medium truncate max-w-[120px]">{student.school}</div>
                      </div>
                    </div>
                    <div class="text-right">
                      <div class="text-[10px] font-bold text-accent">{student.examScore}%</div>
                      <div class="w-14 h-1 bg-cream rounded-full mt-1 overflow-hidden">
                        <div class="h-full bg-accent" style="width: {student.examScore}%;"></div>
                      </div>
                    </div>
                  </div>
                  {/each}
                  {#if studentRegistry.length === 0}
                    <div class="p-6 text-center text-xs font-bold text-sage uppercase tracking-widest">No active students</div>
                  {/if}
                </div>
              </section>
            {/if}
         {:else if activePanel === 'insights'}
            <section class="space-y-6">
              <div class="flex items-center justify-between">
                 <h3 class="text-[10px] font-bold uppercase tracking-[0.2em] text-sage">Real-time Performance</h3>
                 <span class="flex items-center gap-1 text-[9px] font-bold text-accent animate-pulse uppercase tracking-widest bg-accent/10 px-2 py-1 rounded-full">
                    <Zap size={10} fill="currentColor" /> Live Session
                 </span>
              </div>

              <div class="bg-paper p-6 rounded-[20px] border border-sage/10 ">
                <div class="flex items-center justify-between mb-6">
                  <h4 class="font-bold text-xs uppercase tracking-tight text-ink ">Common Struggles</h4>
                  <div class="p-2 bg-cream rounded-[20px] text-sage cursor-pointer hover:text-olive hover:bg-sage/10 transition-all"><BarChart3 size={16} /></div>
                </div>
                
                <div class="space-y-6">
                  <div>
                    <div class="flex justify-between text-[10px] font-bold text-ink mb-2">
                      <span class="uppercase tracking-widest">Osmosis Flow</span>
                      <span class="text-sage">12 Students</span>
                    </div>
                    <div class="h-1.5 bg-cream rounded-full overflow-hidden">
                      <div class="h-full bg-accent transition-all duration-1000" style="width: {(12 / 20) * 100}%"></div>
                    </div>
                  </div>
                  <div>
                    <div class="flex justify-between text-[10px] font-bold text-ink mb-2">
                      <span class="uppercase tracking-widest">Enzyme Temp</span>
                      <span class="text-sage">8 Students</span>
                    </div>
                    <div class="h-1.5 bg-cream rounded-full overflow-hidden">
                      <div class="h-full bg-orange-400 transition-all duration-1000" style="width: {(8 / 20) * 100}%"></div>
                    </div>
                  </div>
                </div>

                <button class="w-full mt-10 py-4 bg-cream text-olive font-bold text-[10px] uppercase tracking-[0.2em] rounded-[20px] hover:bg-olive hover:text-white transition-all shadow-sm cursor-pointer border-none">
                  Generate Remedial Session
                </button>
              </div>
            </section>
         {:else if activePanel === 'exams'}
            <section class="space-y-6">
              <div class="flex items-center justify-between">
                 <h3 class="text-[10px] font-bold uppercase tracking-[0.2em] text-sage">Exams</h3>
              </div>
              
              <div class="flex gap-2">
                <button 
                  onclick={() => examBuilderMode = 'manual'}
                  class="flex-1 py-3 rounded-[20px] text-[10px] font-bold uppercase tracking-widest transition-colors cursor-pointer border-none {examBuilderMode === 'manual' ? 'bg-olive text-white shadow-md' : 'bg-cream text-sage hover:bg-sage/10'}"
                >
                  Manual Entry
                </button>
                <button 
                  onclick={() => examBuilderMode = 'scan'}
                  class="flex-1 py-3 rounded-[20px] text-[10px] font-bold uppercase tracking-widest transition-colors cursor-pointer border-none {examBuilderMode === 'scan' ? 'bg-olive text-white shadow-md' : 'bg-cream text-sage hover:bg-sage/10'}"
                >
                  AI Scan
                </button>
              </div>

              {#if examBuilderMode === 'scan'}
                <div class="bg-paper p-6 rounded-[20px] border border-sage/10 shadow-sm">
                  <div class="text-center mb-6">
                    <div class="w-16 h-16 bg-cream rounded-full flex items-center justify-center text-olive mx-auto mb-4 border border-sage/10">
                      <Camera size={24} />
                    </div>
                    <h4 class="font-bold text-ink mb-1">Scan Paper to Digital Exam</h4>
                    <p class="text-xs text-sage">Take a photo of a past paper or handwritten notes. Our AI will convert it to a digital format.</p>
                  </div>

                  {#if isScanning}
                    <div class="flex flex-col items-center justify-center py-8">
                      <div class="w-8 h-8 border-4 border-olive/20 border-t-olive rounded-full animate-spin mb-4" ></div>
                      <p class="text-xs font-bold text-olive uppercase tracking-widest animate-pulse">Running OCR...</p>
                    </div>
                  {:else if scanResult}
                    <div class="space-y-4">
                      <div class="bg-cream p-4 rounded-[20px] border border-sage/20">
                        <pre class="text-xs text-ink/80 whitespace-pre-wrap font-sans">{scanResult}</pre>
                      </div>
                      <div class="flex gap-3">
                        <button onclick={() => scanResult = null} class="flex-1 py-3 bg-cream text-sage border-none rounded-[20px] text-[10px] font-bold uppercase tracking-widest hover:text-ink transition-colors cursor-pointer">Retake</button>
                        <button class="flex-1 py-3 bg-olive text-white border-none rounded-[20px] text-[10px] font-bold uppercase tracking-widest cursor-pointer">Publish</button>
                      </div>
                    </div>
                  {:else}
                    <button 
                      onclick={handleScan}
                      class="w-full py-4 bg-olive text-white rounded-[20px] font-bold text-[10px] uppercase tracking-[0.2em] shadow-sm active:scale-95 transition-all border-none cursor-pointer"
                    >
                      Start Scan
                    </button>
                  {/if}
                </div>
              {:else}
                <div class="bg-paper p-6 rounded-[20px] border border-sage/10 shadow-sm space-y-6">
                  <!-- Examination Settings -->
                  <div class="space-y-4 border-b border-sage/10 pb-6">
                    <div class="flex items-center justify-between">
                      <div>
                        <h4 class="font-bold text-sm text-ink mb-1">Simulated Examination</h4>
                        <p class="text-[10px] text-sage">Enable to set a timed, strict classroom environment.</p>
                      </div>
                      <button 
                        onclick={() => isSimulatedExam = !isSimulatedExam}
                        class="text-2xl transition-colors bg-transparent border-none p-0 cursor-pointer {isSimulatedExam ? 'text-olive' : 'text-sage/30'}"
                      >
                        {#if isSimulatedExam}
                          <ToggleRight fill="currentColor" />
                        {:else}
                          <ToggleLeft />
                        {/if}
                      </button>
                    </div>

                    {#if isSimulatedExam}
                      <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-1.5">
                          <label class="text-[9px] font-bold text-sage uppercase tracking-widest">Duration (Mins)</label>
                          <input type="number" placeholder="45" class="w-full p-3 bg-cream border border-sage/10 rounded-[20px] text-xs font-bold" />
                        </div>
                        <div class="space-y-1.5">
                          <label class="text-[9px] font-bold text-sage uppercase tracking-widest">Exam Title</label>
                          <input type="text" placeholder="Mid Term Biology" class="w-full p-3 bg-cream border border-sage/10 rounded-[20px] text-xs font-bold" />
                        </div>
                      </div>
                    {/if}
                  </div>

                  <!-- Question Area -->
                  <div class="space-y-4">
                    <div class="space-y-1.5">
                      <label class="text-[9px] font-bold text-sage uppercase tracking-widest flex items-center justify-between">
                        {isSimulatedExam ? 'Question 1' : 'Ask a Question'}
                        {#if isSimulatedExam}
                          <span class="text-olive">+ Add Another</span>
                        {/if}
                      </label>
                      <textarea 
                        placeholder="Type your question here..." 
                        class="w-full h-24 p-4 bg-cream border border-sage/10 rounded-[20px] text-xs font-medium resize-none focus:outline-none focus:border-olive/30 transition-colors"
                      ></textarea>
                    </div>
                  </div>

                  <!-- Publish Settings -->
                  <div class="bg-cream p-5 rounded-[20px] space-y-4 border border-sage/10">
                     <div class="space-y-3">
                        <button 
                          type="button"
                          onclick={() => examTarget = 'class'}
                          class="w-full flex items-center justify-between p-4 rounded-[20px] transition-all {examTarget === 'class' ? 'bg-[#FF5B14] text-white shadow-lg shadow-[#FF5B14]/20' : 'bg-theme-card border border-black/5 text-ink hover:bg-slate-50'} border-none cursor-pointer"
                        >
                          <div class="flex items-center gap-3">
                            <Users size={18} class={examTarget === 'class' ? 'text-white' : 'text-sage'} />
                            <span class="text-sm font-bold uppercase tracking-wide">Assign to Class Group</span>
                          </div>
                          {#if examTarget === 'class'}
                            <div class="w-6 h-6 rounded-full bg-theme-card flex items-center justify-center text-[#FF5B14]" in:scale>
                              <Check size={14} strokeWidth={3} />
                            </div>
                          {/if}
                        </button>

                        {#if examTarget === 'class'}
                          <div class="pl-0 pr-0 relative">
                            <button 
                              type="button"
                              class="w-full p-4 bg-theme-card border border-sage/20 rounded-[20px] text-xs font-bold text-olive flex items-center justify-between cursor-pointer border-solid"
                            >
                               <span>Senior 4 Alpha</span>
                               <ChevronDown size={14} />
                            </button>
                          </div>
                        {/if}
                        
                        <button 
                          type="button"
                          onclick={() => examTarget = 'broadcast'}
                          class="w-full flex items-center justify-between p-4 rounded-[20px] transition-all {examTarget === 'broadcast' ? 'bg-[#FF5B14] text-white shadow-lg shadow-[#FF5B14]/20' : 'bg-theme-card border border-black/5 text-ink hover:bg-slate-50'} border-none cursor-pointer"
                        >
                          <div class="flex items-center gap-3">
                            <Globe size={18} class={examTarget === 'broadcast' ? 'text-white' : 'text-sage'} />
                            <span class="text-sm font-bold uppercase tracking-wide">Broadcast Globally</span>
                          </div>
                          {#if examTarget === 'broadcast'}
                            <div class="w-6 h-6 rounded-full bg-theme-card flex items-center justify-center text-[#FF5B14]" in:scale>
                              <Check size={14} strokeWidth={3} />
                            </div>
                          {/if}
                        </button>
                     </div>
                     
                     <button class="w-full py-4 bg-olive text-white border-none cursor-pointer rounded-[20px] font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:opacity-90 shadow-sm mt-4">
                        {#if examTarget === 'broadcast'}
                          <Send size={16} /> Publish Broadcast
                        {:else}
                          <BookOpen size={16} /> Assign to Class
                        {/if}
                     </button>
                  </div>
                </div>
              {/if}
            </section>
         {/if}
       </div>
    </div>
  {/if}

  <!-- Modals -->
  {#if showAddModal}
    <div class="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm" onclick={() => showAddModal = false} aria-hidden="true"></div>
    <div class="fixed bottom-0 left-0 right-0 bg-paper rounded-t-[40px] shadow-2xl z-50 p-8 transition-transform transform translate-y-0 text-left">
      <div class="flex items-center justify-between mb-8">
         <h3 class="text-xl font-bold text-ink">
           {modalType === 'student' ? 'Add New Learner' : 'Create Class Group'}
         </h3>
         <button onclick={() => showAddModal = false} class="p-2 text-sage bg-cream rounded-full border-none cursor-pointer hover:bg-sage/10 transition-colors"><X size={20} /></button>
      </div>

      <div class="space-y-5">
         {#if modalType === 'student'}
           <div class="space-y-1.5">
              <label class="text-[10px] font-bold text-sage uppercase tracking-widest ml-1">Full Name</label>
              <input type="text" placeholder="e.g. Sarah Nakato" class="w-full p-4 bg-cream border border-sage/10 rounded-[20px] text-xs font-bold " />
           </div>
           <div class="space-y-1.5">
              <label class="text-[10px] font-bold text-sage uppercase tracking-widest ml-1">Assign to Class</label>
              <button 
                type="button" 
                class="w-full p-4 bg-cream border border-sage/10 rounded-[20px] text-xs font-bold text-olive flex items-center justify-between cursor-pointer"
              >
                 <span>Senior 4 Alpha</span>
                 <ChevronDown size={14} />
              </button>
           </div>
           <button class="w-full py-4 bg-olive text-white rounded-[20px] border-none cursor-pointer font-bold mt-4 shadow-sm" onclick={() => showAddModal = false}>Confirm Registration</button>
         {:else}
           <div class="space-y-1.5">
              <label class="text-[10px] font-bold text-sage uppercase tracking-widest ml-1">Group Name</label>
              <input type="text" placeholder="e.g. Senior 4 Beta" class="w-full p-4 bg-cream border border-sage/10 rounded-[20px] text-xs font-bold " />
           </div>
           <div class="space-y-1.5">
              <label class="text-[10px] font-bold text-sage uppercase tracking-widest ml-1">Primary Subject</label>
              <button 
                type="button" 
                class="w-full p-4 bg-cream border border-sage/10 rounded-[20px] text-xs font-bold text-olive flex items-center justify-between cursor-pointer"
              >
                 <span>Biology</span>
                 <ChevronDown size={14} />
              </button>
           </div>
           <button class="w-full py-4 bg-accent text-white rounded-[20px] font-bold border-none cursor-pointer mt-4 shadow-sm" onclick={() => showAddModal = false}>Create Group</button>
         {/if}
      </div>
    </div>
  {/if}
</div>
