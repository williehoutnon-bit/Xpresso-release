<script lang="ts">
  import { ChevronLeft, Bell, Star, Trophy, CheckCircle2, UserPlus, X, Check } from 'lucide-svelte';
  import { friendshipService } from '../services/friendshipService';
  import { authService } from '../services/authService';
  import Skeleton from '../components/Skeleton.svelte';
  import { onMount, onDestroy } from 'svelte';

  let { onback } = $props<{
    onback?: () => void;
  }>();

  let isLoading = $state(true);
  let connectionRequests = $state<any[]>([]);
  let subscriptions: any[] = [];

  let mockNotifications = $state([
    { id: 1, title: "New Assignment", desc: "Mr. Kato added a new biology assignment.", time: "10 mins ago", unread: true, icon: CheckCircle2, color: "text-blue-500" },
    { id: 2, title: "Exam Reminder", desc: "Library revision starts tomorrow at 4 PM.", time: "2 hrs ago", unread: true, icon: Bell, color: "text-orange-500" }
  ]);

  function dismissAllGeneral() {
    mockNotifications = [];
  }

  function dismissOne(id: number) {
    mockNotifications = mockNotifications.filter(n => n.id !== id);
  }

  async function loadRequests() {
    // Check cache first for even faster feel if already loaded once
    if (connectionRequests.length > 0 && !isLoading) {
       // Optional: background refresh
    }
    
    try {
      const user = await authService.getCurrentUser();
      if (user) {
        const fresh = await friendshipService.getIncomingRequests(user.$id);
        connectionRequests = fresh;
      }
    } catch (e) {
      console.error('Error loading requests:', e);
    } finally {
      isLoading = false;
    }
  }

  async function handleAccept(requestId: string) {
    const originalRequests = [...connectionRequests];
    // Optimistic update
    connectionRequests = connectionRequests.filter(r => r.requestId !== requestId);
    
    const success = await friendshipService.acceptFriendRequest(requestId);
    if (!success) {
      // Revert on failure
      connectionRequests = originalRequests;
      console.error('Failed to accept request');
    }
  }

  async function handleDecline(requestId: string) {
    const originalRequests = [...connectionRequests];
    // Optimistic update
    connectionRequests = connectionRequests.filter(r => r.requestId !== requestId);

    const success = await friendshipService.declineFriendRequest(requestId);
    if (!success) {
      // Revert on failure
      connectionRequests = originalRequests;
      console.error('Failed to decline request');
    }
  }

  onMount(async () => {
    await loadRequests();

    // Subscribe to new friendship requests
    const user = await authService.getCurrentUser();
    if (user) {
      const { supabase } = await import('../services/supabaseService');
      const friendChannel = supabase
        .channel(`friendships_notify_${user.$id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'friendships' },
          (payload: any) => {
            const data = payload.new || payload.old;
            if (!data) return;
            const isDelete = payload.eventType === 'DELETE';
            const fId = data.friend_id || data.friendId;
            const uId = data.user_id || data.userId;
            const statusVal = data.status || data.Status;
            const reqId = data.id || data.$id;
            
            // Only react if the relevant user is involved
            if (user && (fId === user.$id || uId === user.$id)) {
              if (isDelete || statusVal === 'Accepted' || statusVal === 'accepted') {
                connectionRequests = connectionRequests.filter(r => r.requestId !== reqId);
              } else if ((statusVal === 'Pending' || statusVal === 'pending') && fId === user.$id) {
                // New incoming request, refresh to get full profile details
                loadRequests();
              }
            }
          }
        )
        .subscribe();
      subscriptions.push({ unsubscribe: () => supabase.removeChannel(friendChannel) });
    }
  });

  onDestroy(() => {
    subscriptions.forEach(s => {
      try {
        if (typeof s === 'function') s();
        else if (s && typeof s.unsubscribe === 'function') s.unsubscribe();
      } catch (e) {
        console.warn('Silent cleanup error:', e);
      }
    });
  });
</script>

<div class="h-full bg-cream flex flex-col">
  <header class="px-6 py-4 flex items-center gap-4 bg-paper border-b border-black/5">
    <button onclick={() => onback?.()} class="p-2 -ml-2 text-sage bg-transparent border-none cursor-pointer hover:text-olive transition-colors">
      <ChevronLeft size={24} />
    </button>
    <h2 class="text-sm font-bold text-ink uppercase tracking-widest">Notifications</h2>
  </header>

  <div class="p-6 flex-1 overflow-y-auto space-y-6">
    <!-- Connection Requests Section -->
    <section>
      <h3 class="text-[10px] font-bold text-sage uppercase tracking-[0.2em] mb-4 px-2">Comrade Requests</h3>
      
      {#if isLoading}
        <Skeleton variant="notification" count={2} />
      {:else if connectionRequests.length === 0}
        <div class="bg-theme-card/40 border border-dashed border-sage/20 rounded-[24px] p-8 text-center">
          <div class="w-12 h-12 bg-sage/5 rounded-full flex items-center justify-center mx-auto mb-3">
            <UserPlus size={20} class="text-sage/40" />
          </div>
          <p class="text-xs text-sage font-medium">No pending requests at the moment</p>
        </div>
      {:else}
        <div class="grid gap-3">
          {#each connectionRequests as req}
            <div class="bg-theme-card p-4 rounded-[24px] border border-black/5 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-full overflow-hidden bg-cream shrink-0 border border-sage/10">
                  <img src={req.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.name}`} alt={req.name} class="w-full h-full object-cover" />
                </div>
                <div class="flex-1 min-w-0">
                  <h4 class="font-bold text-ink text-sm truncate">{req.name}</h4>
                  <p class="text-[10px] text-sage font-medium truncate uppercase tracking-wider">{req.school}</p>
                </div>
              </div>
              
              <div class="flex gap-2 pt-1">
                <button 
                  onclick={() => handleAccept(req.requestId)}
                  class="flex-1 py-2.5 bg-olive text-white rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 border-none cursor-pointer hover:bg-olive/90 transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-olive/10"
                >
                  <Check size={14} /> Accept
                </button>
                <button 
                  onclick={() => handleDecline(req.requestId)}
                  class="flex-1 py-2.5 bg-cream text-sage rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 border border-sage/10 cursor-pointer hover:bg-sage/5 transition-all active:scale-95"
                >
                  <X size={14} /> Decline
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <!-- General Notifications Section -->
    <section>
      <div class="flex items-center justify-between mb-4 px-2">
         <h3 class="text-[10px] font-bold text-sage uppercase tracking-[0.2em]">General</h3>
         {#if mockNotifications.length > 0}
            <button onclick={dismissAllGeneral} class="text-[9px] font-bold text-sage uppercase tracking-widest hover:text-ink transition-colors bg-transparent border-none cursor-pointer">Dismiss All</button>
         {/if}
      </div>
      
      <div class="space-y-3">
        {#if mockNotifications.length === 0}
           <div class="bg-theme-card/20 border border-dashed border-sage/10 rounded-[24px] p-8 text-center">
              <p class="text-[10px] text-sage font-bold uppercase tracking-widest">Workspace is quiet</p>
           </div>
        {:else}
          {#each mockNotifications as n (n.id)}
            <div class="flex items-start gap-4 p-4 rounded-[24px] group transition-all {n.unread ? 'bg-theme-card shadow-sm border border-black/5' : 'bg-transparent'}">
              <div class="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center shrink-0 {n.color}">
                <n.icon size={18} />
              </div>
              <div class="flex-1">
                <div class="flex items-center justify-between">
                  <h3 class="font-bold text-ink text-sm">{n.title}</h3>
                  <div class="flex items-center gap-2">
                     <span class="text-[9px] text-sage font-bold uppercase">{n.time}</span>
                     <button onclick={() => dismissOne(n.id)} class="text-sage opacity-0 group-hover:opacity-100 hover:text-ink transition-all bg-transparent border-none cursor-pointer">
                        <X size={12} />
                     </button>
                  </div>
                </div>
                <p class="text-xs text-sage mt-1 leading-relaxed">{n.desc}</p>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </section>
  </div>
</div>
