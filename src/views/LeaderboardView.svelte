<script lang="ts">
  import { ChevronLeft, Trophy, Flame, CheckCircle2, MessageSquare, Book, Edit3, Building2, User } from 'lucide-svelte';
  import { authService } from '../services/authService';
  import { friendshipService } from '../services/friendshipService';
  import Skeleton from '../components/Skeleton.svelte';
  import { onMount } from 'svelte';

  function triggerNotification(title: string, options: any) {
    console.log(`Notification: ${title}`, options);
  }

  let { onback, onviewprofile } = $props<{
    onback?: () => void;
    onviewprofile?: () => void;
  }>();

  let activeTab = $state('my_school');

  const tabs = [
    { id: 'my_school', label: 'My School' },
    { id: 'national', label: 'National' },
    { id: 'this_week', label: 'This Week' },
    { id: 'all_time', label: 'All Time' },
  ];

  let userPoints = $state(0);
  let userLastName = $state('You');
  let currentUserId = $state('');
  let userSchool = $state('');

  // We will load the top 10 for each tab
  let leaderboardData = $state<any[]>([]);
  let isLoading = $state(true);

  async function loadData() {
    isLoading = true;
    let students = [];
    if (activeTab === 'my_school' && userSchool) {
        students = await friendshipService.getLeaderboard(20, userSchool);
    } else {
        students = await friendshipService.getLeaderboard(20);
    }
    
    leaderboardData = students.map((s, index) => ({
       userId: s.userId,
       n: s.name,
       p: s.points,
       isMe: s.userId === currentUserId,
       rank: index + 1
    }));
    isLoading = false;
  }

  onMount(async () => {
    try {
      const u = await authService.getCurrentUser();
      if (u) {
        currentUserId = u.$id;
        const p = await authService.getProfile(u.$id);
        userLastName = p?.lastName || p?.surname || p?.fullName || u.prefs?.lastName || 'You';
        userSchool = p?.school || '';
        if (p?.points !== undefined) {
          userPoints = p.points;
        } else if (u.prefs?.points !== undefined) {
          userPoints = u.prefs.points;
        }
      }
      await loadData();
    } catch (e) {
      console.warn('LeaderboardView: Failed to load real user points', e);
      isLoading = false;
    }
  });

  $effect(() => {
     let _t = activeTab; // trigger reload on tab switch
     loadData();
  });

  const topThree = $derived(leaderboardData.slice(0, 3));
  const remainingList = $derived(leaderboardData.slice(3));

  const handleShowAll = () => {
    triggerNotification('Full Leaderboard', { body: 'Loading full registry of students...', type: 'info'});
  };
</script>

<div class="h-full bg-cream flex flex-col overflow-y-auto pb-24">
  <header class="px-4 py-4 flex items-center justify-between sticky top-0 bg-paper/80 backdrop-blur-md z-10 border-b border-black/5">
    <button onclick={() => onback?.()} class="p-2 -ml-2 text-sage bg-theme-card border-sage/10 cursor-pointer hover:text-olive transition-colors flex items-center justify-center w-10 h-10 rounded-[20px] shadow-sm border border-sage/10">
      <ChevronLeft size={20} />
    </button>
    <h2 class="text-sm font-bold text-ink uppercase tracking-widest">Leaderboard</h2>
    <div class="w-10"></div>
  </header>

  <div class="p-6">
    <div class="flex gap-2 overflow-x-auto no-scrollbar mb-6 pb-2">
      {#each tabs as tab (tab.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <button 
          onclick={() => activeTab = tab.id}
          class="whitespace-nowrap px-5 py-2.5 rounded-full border-none cursor-pointer text-xs font-bold transition-all border {activeTab === tab.id ? 'bg-olive text-white border-olive shadow-sm' : 'bg-theme-card text-sage border-sage/20 hover:border-sage'}"
        >
          {tab.label}
        </button>
      {/each}
    </div>

    <div class="flex justify-between items-center mb-6">
      <h3 class="font-bold text-ink text-sm flex items-center gap-1.5"><Building2 size={16} class="text-sage" /> St. Mary's College</h3>
      <span class="text-xs text-sage font-bold uppercase tracking-widest">87 students</span>
    </div>

    {#if isLoading}
      <div class="py-2">
        <Skeleton variant="leaderboard" count={5} />
      </div>
    {:else if topThree.length >= 3}
    <div class="flex justify-center items-end gap-6 mb-8 pt-6">
       <!-- Rank 2 -->
       <div class="flex flex-col items-center">
         <div class="relative mb-2">
            <div class="w-6 h-6 rounded-full bg-paper absolute -top-4 left-1/2 -translate-x-1/2 flex items-center justify-center font-bold text-sage z-10 shadow-sm border border-sage/20">
              2
            </div>
            <div class="w-14 h-14 rounded-full bg-theme-card flex items-center justify-center text-xl font-bold text-ink border-2 border-sage/20 overflow-hidden {topThree[1].isMe ? 'border-olive' : ''}">
              <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${topThree[1].n}&backgroundColor=fdfbf7`} alt="User" class="w-full h-full object-cover" referrerpolicy="no-referrer" />
            </div>
         </div>
         <!-- svelte-ignore a11y_click_events_have_key_events -->
         <!-- svelte-ignore a11y_no_static_element_interactions -->
         <div class="text-xs text-[10px] uppercase font-bold text-ink mb-1 cursor-pointer hover:underline" onclick={() => onviewprofile?.()}>{topThree[1].n}{topThree[1].isMe ? ' (You)' : ''}</div>
         <div class="text-olive font-bold text-xs">{topThree[1].p} pts</div>
       </div>

       <!-- Rank 1 -->
       <div class="flex flex-col items-center mb-4">
         <div class="relative mb-2">
            <div class="w-8 h-8 rounded-full bg-accent absolute -top-5 left-1/2 -translate-x-1/2 flex items-center justify-center text-sm font-bold text-white z-[10] shadow-sm border border-accent/20">
              <Trophy size={14} />
            </div>
            <div class="w-16 h-16 rounded-full bg-olive/10 flex items-center justify-center text-2xl font-bold text-olive border-2 border-olive overflow-hidden {topThree[0].isMe ? 'ring-2 ring-olive/50' : ''}">
              <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${topThree[0].n}&backgroundColor=e8f3e8`} alt="User" class="w-full h-full object-cover" referrerpolicy="no-referrer" />
            </div>
         </div>
         <!-- svelte-ignore a11y_click_events_have_key_events -->
         <!-- svelte-ignore a11y_no_static_element_interactions -->
         <div class="text-sm font-bold text-ink mb-1 uppercase tracking-wider cursor-pointer hover:underline" onclick={() => onviewprofile?.()}>{topThree[0].n}{topThree[0].isMe ? ' (You)' : ''}</div>
         <div class="text-olive font-bold text-sm">{topThree[0].p} pts</div>
       </div>

       <!-- Rank 3 -->
       <div class="flex flex-col items-center">
         <div class="relative mb-2">
            <div class="w-6 h-6 rounded-full bg-paper absolute -top-4 left-1/2 -translate-x-1/2 flex items-center justify-center text-[10px] font-bold text-sage z-10 shadow-sm border border-sage/20">
              3
            </div>
            <div class="w-14 h-14 rounded-full bg-theme-card flex items-center justify-center text-xl font-bold text-ink border-2 border-sage/20 overflow-hidden {topThree[2].isMe ? 'border-olive' : ''}">
              <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${topThree[2].n}&backgroundColor=fdfbf7`} alt="User" class="w-full h-full object-cover" referrerpolicy="no-referrer" />
            </div>
         </div>
         <!-- svelte-ignore a11y_click_events_have_key_events -->
         <!-- svelte-ignore a11y_no_static_element_interactions -->
         <div class="text-xs text-[10px] uppercase font-bold text-ink mb-1 cursor-pointer hover:underline" onclick={() => onviewprofile?.()}>{topThree[2].n}{topThree[2].isMe ? ' (You)' : ''}</div>
         <div class="text-olive font-bold text-xs">{topThree[2].p} pts</div>
       </div>
    </div>
    {/if}

    <!-- List -->
    {#if !isLoading && remainingList.length > 0}
    <div class="space-y-0 text-sm mb-6 bg-paper rounded-[20px] p-4 shadow-sm border border-sage/10">
      {#each remainingList as item, index}
        <div class="flex items-center gap-3 w-full py-4 {index !== remainingList.length - 1 && !item.isMe ? 'border-b border-sage/10' : ''} {item.isMe ? 'bg-olive/5 rounded-[20px] px-3 -mx-3 mt-4 mb-4 border border-olive/20' : ''}">
          <div class="w-6 text-center text-sm font-bold {item.isMe ? 'text-olive' : 'text-sage'}">{item.rank}</div>
          <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold {item.isMe ? 'bg-olive text-white text-lg' : 'bg-cream border border-sage/10 text-olive'}">{item.n ? item.n.charAt(0) : '?'}</div>
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="flex-1 font-bold text-ink text-sm cursor-pointer hover:underline {item.isMe ? 'uppercase tracking-wide' : ''}" onclick={() => onviewprofile?.()}>{item.n}{item.isMe ? ' (You)' : ''}</div>
          <div class="font-bold text-olive text-sm">{item.p} pts</div>
        </div>
      {/each}
    </div>
    {/if}

    <button 
       onclick={handleShowAll}
       class="w-full py-4 bg-paper border border-sage/20 rounded-full cursor-pointer text-ink font-bold text-[10px] uppercase tracking-widest shadow-sm hover:bg-sage/10 hover:border-olive/30 transition-colors mb-10"
    >
       Show all 87 students
    </button>

    <div class="mb-4 bg-paper p-5 rounded-[20px] border border-sage/10">
       <h4 class="font-bold text-[10px] uppercase tracking-widest text-ink mb-4">How to earn points</h4>
       <div class="space-y-4 text-sm text-sage">
          <div class="flex justify-between items-center">
             <span class="flex items-center gap-3 text-xs font-medium"><CheckCircle2 size={16} class="text-olive" /> Correct daily question</span>
             <span class="font-bold text-olive">+10 pts</span>
          </div>
          <div class="flex justify-between items-center">
             <span class="flex items-center gap-3 text-xs font-medium"><Edit3 size={16} class="text-olive" /> Complete an exam</span>
             <span class="font-bold text-olive">+20 pts</span>
          </div>
          <div class="flex justify-between items-center">
             <span class="flex items-center gap-3 text-xs font-medium"><MessageSquare size={16} class="text-olive" /> Answer a forum question</span>
             <span class="font-bold text-olive">+5 pts</span>
          </div>
          <div class="flex justify-between items-center">
             <span class="flex items-center gap-3 text-xs font-medium"><Flame size={16} class="text-accent" /> Maintain 7-day streak</span>
             <span class="font-bold text-olive">+15 pts</span>
          </div>
          <div class="flex justify-between items-center">
             <span class="flex items-center gap-3 text-xs font-medium"><Book size={16} class="text-olive" /> Complete a notes chapter</span>
             <span class="font-bold text-olive">+8 pts</span>
          </div>
       </div>
    </div>

  </div>
</div>
