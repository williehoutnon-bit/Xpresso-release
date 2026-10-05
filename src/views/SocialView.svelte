<script lang="ts">
  import { Search, School, Globe, UserPlus, BookOpen, ChevronDown, CheckCircle2, MessageSquare, Lock } from 'lucide-svelte';
  import { MOCK_SCHOOLS, MOCK_INDEPENDENT_CLASSES, type School as SchoolType } from '../types';
  import { triggerNotification } from '../services/notificationService';
  import { friendshipService, type Comrade } from '../services/friendshipService';
  import { onMount, onDestroy, untrack } from 'svelte';
  import { authService } from '../services/authService';
  import UserProfileLightbox from '../components/UserProfileLightbox.svelte';
  import Skeleton from '../components/Skeleton.svelte';

  let { role = 'student', onopenchat } = $props<{ role?: string, onopenchat?: (id: string, name: string) => void }>();

  let expandedSchool = $state<string | null>(null);
  let requestedClasses = $state<Set<string>>(new Set());
  
  let recommendedComrades = $state<Comrade[]>([]);
  let currentComrades = $state<Comrade[]>([]);
  let invitedComrades = $state<Set<string>>(new Set());
  let subscriptions: any[] = [];

  let isProfileLightboxOpen = $state(false);
  let profileData = $state<any>(null);

  $effect(() => {
    const data = profileData;
    if (data) {
      const pId = data.userId;
      if (pId) {
        untrack(() => {
          // Update currentComrades if present
          currentComrades = currentComrades.map(c => {
            if (c.userId === pId || (c as any).id === pId) {
              return {
                ...c,
                name: data.fullName || data.name || c.name,
                avatarUrl: data.avatarUrl || c.avatarUrl,
                school: data.school || c.school,
                role: data.role || c.role
              };
            }
            return c;
          });

          // Update recommendedComrades if present
          recommendedComrades = recommendedComrades.map(c => {
            if (c.userId === pId || (c as any).id === pId) {
              return {
                ...c,
                name: data.fullName || data.name || c.name,
                avatarUrl: data.avatarUrl || c.avatarUrl,
                school: data.school || c.school,
                role: data.role || c.role
              };
            }
            return c;
          });
        });
      }
    }
  });

  let isSchoolProfileOpen = $state(false);
  let schoolProfileData = $state<any>(null);
  let schoolStudents = $state<any[]>([]);
  let isLoadingSchoolStudents = $state(false);
  let isClassProfileOpen = $state(false);
  let classProfileData = $state<any>(null);
  let currentTab = $state<'comrades' | 'schools' | 'classes'>('comrades');

  let currentTime = $state(Date.now());
  $effect(() => {
    const interval = setInterval(() => {
      currentTime = Date.now();
    }, 15000);
    return () => clearInterval(interval);
  });

  let isLoadingData = $state(true);
  let allSchools = $state<any[]>([]);
  let selectedRegion = $state<string>('All');
  let selectedDistrict = $state<string>('All');

  let regions = $derived(() => {
    const rSet = new Set(['All']);
    allSchools.forEach(s => {
      if (s.region) rSet.add(s.region);
    });
    return Array.from(rSet).sort((a,b) => a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b));
  });

  let districts = $derived(() => {
    const dSet = new Set(['All']);
    allSchools.filter(s => selectedRegion === 'All' || s.region === selectedRegion).forEach(s => {
      if (s.district) dSet.add(s.district);
    });
    return Array.from(dSet).sort((a,b) => a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b));
  });

  let groupedSchools = $derived(() => {
    const groups: Record<string, Record<string, any[]>> = {};
    const filtered = allSchools.filter(school => {
      const matchRegion = selectedRegion === 'All' || school.region === selectedRegion;
      const matchDistrict = selectedDistrict === 'All' || school.district === selectedDistrict;
      return matchRegion && matchDistrict;
    });

    filtered.forEach(school => {
      const region = school.region || 'CENTRAL REGION'; 
      const district = school.district || 'Other';
      if (!groups[region]) groups[region] = {};
      if (!groups[region][district]) groups[region][district] = [];
      groups[region][district].push(school);
    });
    return groups;
  });

  let searchQuery = $state('');
  let isSearching = $state(false);
  let searchResults = $state<{
    users: Comrade[],
    schools: any[],
    independentClasses: any[]
  }>({
    users: [],
    schools: [],
    independentClasses: []
  });

  let searchTimeout: any;
  const handleSearchInput = (e: Event) => {
    const query = (e.target as HTMLInputElement).value;
    searchQuery = query;
    clearTimeout(searchTimeout);
    
    if (query.trim().length < 2) {
      isSearching = false;
      return;
    }

    isSearching = true;
    searchResults = { users: [], schools: [], independentClasses: [] }; // Clear stale results immediately
    searchTimeout = setTimeout(async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        const currentUserId = currentUser?.id || currentUser?.$id || '';

        // 1. Search Users and Schools in parallel
        const [userResults, schoolResults] = await Promise.all([
          friendshipService.searchUsers(query),
          friendshipService.searchSchools(query)
        ]);

        // 2. Search Independent Classes from Mock Data
        const classResults = MOCK_INDEPENDENT_CLASSES.filter(c => 
          c.name.toLowerCase().includes(query.toLowerCase()) || 
          c.teacherName.toLowerCase().includes(query.toLowerCase())
        );

        const filteredUserResults = userResults.filter(u => u.userId !== currentUserId);
        
        // Optimistically set search results with 'None' status first to show them immediately
        searchResults = {
          users: filteredUserResults,
          schools: schoolResults,
          independentClasses: classResults
        };

        // 3. Batch check friendship statuses for all found users
        if (currentUserId && filteredUserResults.length > 0) {
            const userIds = filteredUserResults.map(u => u.userId);
            const statuses = await friendshipService.getBatchFriendshipStatuses(currentUserId, userIds);
            
            const newInvited = new Set<string>();
            const newFriends: Comrade[] = [];

            // Update local state and search results with correct statuses
            Object.entries(statuses).forEach(([uid, status]) => {
                if (status === 'Pending') {
                    newInvited.add(uid);
                } else if (status === 'Accepted') {
                    const user = filteredUserResults.find(u => u.userId === uid);
                    if (user && !currentComrades.find(c => c.userId === uid)) {
                        newFriends.push(user);
                    }
                }
            });

            if (newInvited.size > 0) {
                invitedComrades = new Set([...invitedComrades, ...newInvited]);
            }
            if (newFriends.length > 0) {
                currentComrades = [...currentComrades, ...newFriends];
            }
            
            // Trigger a re-render/logic update for buttons in search results
            // (invitedComrades and currentComrades are reactive and used in the template)
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        isSearching = false;
      }
    }, 200);
  };
  
  const openProfileLightbox = (e: Event, contactOrComrade: any) => {
     e.stopPropagation();
     
     let resolvedUserId = contactOrComrade.userId || contactOrComrade.user_id || contactOrComrade.$id;

     profileData = {
         userId: resolvedUserId,
         name: contactOrComrade.name || contactOrComrade.fullName,
         avatarUrl: contactOrComrade.avatarUrl,
         avatar: contactOrComrade.avatar,
         role: contactOrComrade.position || contactOrComrade.role || 'Student',
         school: contactOrComrade.school || '',
         bio: contactOrComrade.bio,
         points: contactOrComrade.points,
         studentClass: contactOrComrade.studentClass,
         preferredSubjects: contactOrComrade.preferredSubjects,
         subjectCombination: contactOrComrade.subjectCombination,
         age: contactOrComrade.age,
         house: contactOrComrade.house,
         clubs: contactOrComrade.clubs
     };
     isProfileLightboxOpen = true;
  };

  const fetchSchoolStudents = async (schoolName: string) => {
    isLoadingSchoolStudents = true;
    try {
      const students = await friendshipService.getStudentsBySchool(schoolName);
      schoolStudents = students;
    } catch (err) {
      console.error('Failed to fetch school students:', err);
    } finally {
      isLoadingSchoolStudents = false;
    }
  };

  const openSchoolProfile = (school: any) => {
    schoolProfileData = school;
    isSchoolProfileOpen = true;
    fetchSchoolStudents(school.name);
  };

  const openClassProfile = (cls: any) => {
    classProfileData = cls;
    isClassProfileOpen = true;
  };

  let schoolClassesMap = $state<Record<string, any[]>>({});
  const toggleSchool = async (schoolId: string) => {
    if (expandedSchool === schoolId) {
       expandedSchool = null;
    } else {
       expandedSchool = schoolId;
       if (!schoolClassesMap[schoolId]) {
          const classes = await friendshipService.getClassesBySchool(schoolId);
          schoolClassesMap[schoolId] = classes;
       }
    }
  };

  onMount(async () => {
    try {
        const user = await authService.getCurrentUser ? await authService.getCurrentUser() : null;
        let userId = user?.id || user?.$id;
        
        if (userId) {
             const friendsTask = friendshipService.getCurrentFriends(userId);
             const suggestionsTask = friendshipService.getSuggestedComrades(userId);
             const pendingTask = friendshipService.getPendingRequestsIds(userId);
             
             const [friends, suggestions, pendingIds] = await Promise.all([friendsTask, suggestionsTask, pendingTask]);
             
             console.log('[DEBUG] loaded comrades:', friends);
             
             currentComrades = friends;
             recommendedComrades = suggestions;
             invitedComrades = new Set(pendingIds);
             
             if (currentComrades.length === 0 && recommendedComrades.length === 0) {
                 loadFallbackComrades(userId);
             }

             // Setup RxDB subscription for instant local updates
             try {
                const { dbService } = await import('../services/dbService');
                const db = await dbService.getRawDB();
                const friendshipSub = db.friendships.find({
                    selector: {
                        $or: [{ userId: userId }, { friendId: userId }]
                    }
                }).$.subscribe(async () => {
                   // When friendships change locally, refresh the comrades list
                   // Use a small timeout to avoid double-processing during bulk updates
                   setTimeout(async () => {
                      const [friends, pendingIds] = await Promise.all([
                        friendshipService.getCurrentFriends(userId),
                        friendshipService.getPendingRequestsIds(userId)
                      ]);
                      currentComrades = friends;
                      invitedComrades = new Set(pendingIds);
                   }, 100);
                });
                subscriptions.push(friendshipSub);
             } catch (rxErr) {
                console.warn('Failed to setup RxDB friendship subscription:', rxErr);
             }
        } else {
             loadFallbackComrades();
        }

        // Fetch real schools for Discover view
        const schools = await friendshipService.getAllSchools();
        allSchools = schools;

        // Fetch staff
        const staff = await friendshipService.getSchoolStaff();
        schoolStaff = staff;

        // Periodic polling for presence status of visible users
        const presencePollInterval = setInterval(async () => {
             const vIds = Array.from(visibleUserIds);
             if (vIds.length === 0) return;
             try {
                // We batch fetch up to 50 at a time to keep it extremely fast
                const { supabaseAdmin } = await import('../services/supabaseService');
                const { data } = await supabaseAdmin.from('presence').select('user_id, last_seen_at').in('user_id', vIds.slice(0, 50));
                
                if (data && data.length > 0) {
                    const presenceMap = new Map();
                    data.forEach((p: any) => presenceMap.set(p.user_id, p));

                    const updateList = (list: any[]) => list.map(user => {
                       const pres = presenceMap.get(user.userId);
                       if (pres) {
                          const doc = { ...user, last_seen_at: pres.last_seen_at };
                          return { ...user, isOnline: authService.computeIsOnline(doc), lastSeenAt: pres.last_seen_at };
                       }
                       return user;
                    });

                    currentComrades = updateList(currentComrades);
                    recommendedComrades = updateList(recommendedComrades);
                    searchResults.users = updateList(searchResults.users);
                }
             } catch (e) {
                // Ignore silent poll errors
             }
        }, 15000);
        subscriptions.push({ unsubscribe: () => clearInterval(presencePollInterval) });

        // Setup real-time listener for presence table (Online Status)
        try {
          const { supabase } = await import('../services/supabaseService');
          const presenceChannel = supabase
            .channel('public-presence-changes')
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'presence' },
              (payload) => {
                const rec = (payload.new || payload.old) as any;
                if (!rec) return;

                const targetUserId = rec.user_id;
                if (!targetUserId || !visibleUserIds.has(targetUserId)) return;

                const lastSeenVal = rec.last_seen_at || null;
                const tempDoc = { last_seen_at: lastSeenVal };
                const newStatus = authService.computeIsOnline(tempDoc);

                // Update in recommended
                if (recommendedComrades.some(c => c.userId === targetUserId)) {
                  recommendedComrades = recommendedComrades.map(c => 
                    c.userId === targetUserId ? { ...c, isOnline: newStatus, lastSeenAt: lastSeenVal } : c
                  );
                }

                // Update in current comrades
                if (currentComrades.some(c => c.userId === targetUserId)) {
                  currentComrades = currentComrades.map(c => 
                    c.userId === targetUserId ? { ...c, isOnline: newStatus, lastSeenAt: lastSeenVal } : c
                  );
                }

                // Update in search results
                if (searchResults.users.some(u => u.userId === targetUserId)) {
                  searchResults.users = searchResults.users.map(u => 
                    u.userId === targetUserId ? { ...u, isOnline: newStatus, lastSeenAt: lastSeenVal } : u
                  );
                }
              }
            )
            .subscribe();

          subscriptions.push({ unsubscribe: () => supabase.removeChannel(presenceChannel) });
        } catch (realtimeErr) {
          console.warn('[SocialView] Realtime presence subscription failed, falling back to polling:', realtimeErr);
        }

        // Setup Supabase real-time listener for friendship changes (accept, decline, request)
        if (userId) {
          const { supabase } = await import('../services/supabaseService');
          const friendChannel = supabase
            .channel(`friendships_social_${userId}`)
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'friendships' },
              async (payload: any) => {
                const data = payload.new || payload.old;
                if (!data) return;
                const isDelete = payload.eventType === 'DELETE';
                const fId = data.id;
                const fUserId = data.user_id || data.userId;
                const fFriendId = data.friend_id || data.friendId;
                const fStatus = data.status || data.Status;
                const fCreatedAt = data.created_at || data.$createdAt;
                
                if (userId && (fUserId === userId || fFriendId === userId)) {
                  try {
                    if (isDelete) {
                      // Remove from local RxDB
                      const { dbService } = await import('../services/dbService');
                      dbService.deleteLocalFriendship(fId).catch(() => {});

                      // Remove from pending/invited
                      const targetId = fUserId === userId ? fFriendId : fUserId;
                      const tempInvited = new Set(invitedComrades);
                      tempInvited.delete(targetId);
                      invitedComrades = tempInvited;
                      
                      currentComrades = currentComrades.filter(c => c.userId !== targetId);
                    } else {
                      // Sync to local RxDB
                      const { dbService } = await import('../services/dbService');
                      dbService.upsertFriendship({
                          id: fId,
                          userId: fUserId,
                          friendId: fFriendId,
                          status: fStatus,
                          createdAt: fCreatedAt
                      }).catch(() => {});

                      // Create or Update
                      const targetId = fUserId === userId ? fFriendId : fUserId;
                      if (fStatus === 'Pending' || fStatus === 'pending') {
                        if (fUserId === userId) {
                          const tempInvited = new Set(invitedComrades);
                          tempInvited.add(targetId);
                          invitedComrades = tempInvited;
                        }
                      } else if (fStatus === 'Accepted' || fStatus === 'accepted') {
                        const tempInvited = new Set(invitedComrades);
                        tempInvited.delete(targetId);
                        invitedComrades = tempInvited;
                        
                        // Add to currentComrades if not already there
                        if (!currentComrades.some(c => c.userId === targetId)) {
                          try {
                            const { dbService } = await import('../services/dbService');
                            const targetProfile = await dbService.getProfile(targetId);
                            if (targetProfile) {
                              currentComrades = [...currentComrades, {
                                userId: targetId,
                                name: targetProfile.fullName || targetProfile.name || 'Unknown User',
                                school: targetProfile.school || 'Unknown School',
                                points: targetProfile.points || 0,
                                avatarUrl: targetProfile.avatarUrl,
                                bio: targetProfile.bio,
                                role: targetProfile.role,
                                studentClass: targetProfile.studentClass,
                                preferredSubjects: targetProfile.preferredSubjects,
                                subjectCombination: targetProfile.subjectCombination,
                                age: targetProfile.age,
                                house: targetProfile.house,
                                clubs: targetProfile.clubs,
                                isOnline: authService.computeIsOnline(targetProfile),
                                lastSeenAt: targetProfile.lastSeenAt || null
                              }];
                            }
                          } catch (e) {
                            currentComrades = [...currentComrades, {
                              userId: targetId,
                              name: data.fullName || 'Unknown User',
                              school: data.school || 'Unknown School',
                              points: 0
                            }];
                          }
                        }
                      }
                    }
                  } catch (optimisticErr) {
                    console.warn('Non-blocking real-time optimistic update error:', optimisticErr);
                  }

                  // Force a background fetch for exact correctness to run in parallel
                  try {
                    const [friends, pendingIds] = await Promise.all([
                      friendshipService.getCurrentFriends(userId),
                      friendshipService.getPendingRequestsIds(userId)
                    ]);
                    currentComrades = friends;
                    invitedComrades = new Set(pendingIds);
                  } catch (err) {
                    console.error('Failed to update friendships in SocialView real-time background sync:', err);
                  }
                }
              }
            )
            .subscribe();
          subscriptions.push({ unsubscribe: () => supabase.removeChannel(friendChannel) });
        }
    } catch (e) {
        console.error('Error fetching comrades/schools:', e);
        loadFallbackComrades();
    } finally {
        isLoadingData = false;
    }

    // Optimization: Keep a map of visible user IDs for faster lookups in real-time listeners
  });

  $effect(() => {
      const ids = new Set<string>();
      recommendedComrades.forEach(c => ids.add(c.userId));
      currentComrades.forEach(c => ids.add(c.userId));
      searchResults.users.forEach(u => ids.add(u.userId));
      visibleUserIds = ids;
  });

  let visibleUserIds = $state(new Set<string>());

  onDestroy(() => {
    subscriptions.forEach(s => {
      try {
        if (typeof s === 'function') s();
        else if (s && typeof s.unsubscribe === 'function') s.unsubscribe();
      } catch (e) {}
    });
  });

  async function loadFallbackComrades(uid?: string) {
       const user = await authService.getCurrentUser ? await authService.getCurrentUser() : null;
       const cleanUid = uid || user?.id || user?.$id || 'no-user';
       const sugg = await friendshipService.getSuggestedComrades(cleanUid);
       currentComrades = [];
       recommendedComrades = sugg || [];
  }

  const handleRequestJoin = (classId: string, event: Event) => {
    event.stopPropagation();
    const newSet = new Set(requestedClasses);
    newSet.add(classId);
    requestedClasses = newSet;
    triggerNotification('Request Sent', { body: 'Your request to join the class has been sent to the instructor.', type: 'success' });
  };

  const viewAllInstitutions = () => {
    triggerNotification('Full Directory', { body: 'Loading full registry of institutions...', type: 'info'});
  };

  let schoolStaff = $state<any[]>([]);

  const handleComradeAction = async (user_id: string, name: string, isComrade: boolean) => {
    if (isComrade) {
       triggerNotification('Opening Chat', { body: `Opening chat with ${name}...`, type: 'info'});
       if (onopenchat) onopenchat(`user_${user_id}`, name);
       return;
    }
    
    // Add to invited styling immediately
    const tempSet = new Set(invitedComrades);
    tempSet.add(user_id);
    invitedComrades = tempSet;
    
    // For friend request
    let currentUserId = '';
    try {
        const u = authService.getCurrentUser ? await authService.getCurrentUser() : null;
        if (u) currentUserId = u.id || u.$id;
    } catch {}
    
    if (currentUserId) {
        triggerNotification('Sending Request', { body: `Sending comrade request to ${name}...`, type: 'info' });
        const success = await friendshipService.sendFriendRequest(currentUserId, user_id);
        if (success) {
           triggerNotification('Request Sent', { body: `Comrade request sent to ${name}.`, type: 'success' });
        } else {
           triggerNotification('Error', { body: `Failed to send request to ${name}.`, type: 'error' });
           // Revert optimisic ui update
           const revSet = new Set(invitedComrades);
           revSet.delete(user_id);
           invitedComrades = revSet;
        }
    } else {
        triggerNotification('Comrade Request Sent', { body: `Request sent to ${name}.`, type: 'success'});
    }
  };

  const handleUnfriend = async (user_to_unfriend: any) => {
    const friendId = user_to_unfriend.userId || user_to_unfriend.id;
    if (!friendId) return;

    let currentUserId = '';
    try {
        const u = authService.getCurrentUser ? await authService.getCurrentUser() : null;
        if (u) currentUserId = u.id || u.$id;
    } catch {}

    // Optimistic update
    const originalComrades = [...currentComrades];
    currentComrades = currentComrades.filter(c => c.userId !== friendId);

    if (currentUserId) {
        triggerNotification('Unfriending', { body: `Removing ${user_to_unfriend.name} from comrades...`, type: 'info' });
        const success = await friendshipService.unfriendUser(currentUserId, friendId);
        if (success) {
            triggerNotification('Comrade Removed', { body: `${user_to_unfriend.name} is no longer your comrade.`, type: 'success' });
            // Refresh suggestions in the background
            friendshipService.getSuggestedComrades(currentUserId).then(freshSuggestions => {
                recommendedComrades = freshSuggestions;
            });
        } else {
            triggerNotification('Error', { body: `Failed to remove ${user_to_unfriend.name} from comrades.`, type: 'error' });
            // Revert on failure
            currentComrades = originalComrades;
        }
    } else {
        triggerNotification('Comrade Removed', { body: `${user_to_unfriend.name} is no longer your comrade.`, type: 'success' });
    }
  };
</script>

<div class="flex flex-col h-full bg-cream text-ink">
  <header class="px-6 pt-6 pb-2 bg-paper border-b border-black/5 sticky top-0 z-[20] shadow-sm relative overflow-hidden">
    <div class="absolute top-0 right-0 w-32 h-full bg-accent/5 -skew-x-12 transform translate-x-16"></div>
    <div class="flex items-center justify-between mb-4 relative z-10">
      <h2 class="text-xl font-bold text-ink">Discover <span class="text-accent">Connect</span></h2>
      <div class="flex items-center gap-1 bg-cream/50 p-1 rounded-full border border-sage/5">
        <button 
          onclick={() => currentTab = 'comrades'}
          class="px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all {currentTab === 'comrades' ? 'bg-olive text-white shadow-sm' : 'text-sage hover:text-ink'}"
        >
          Comrades
        </button>
        <button 
          onclick={() => { currentTab = 'schools'; searchQuery = ''; }}
          class="px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all {currentTab === 'schools' ? 'bg-olive text-white shadow-sm' : 'text-sage hover:text-ink'}"
        >
          Schools
        </button>
        <button 
          onclick={() => { currentTab = 'classes'; searchQuery = ''; }}
          class="px-4 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all {currentTab === 'classes' ? 'bg-olive text-white shadow-sm' : 'text-sage hover:text-ink'}"
        >
          Classes
        </button>
      </div>
    </div>

    <div class="relative z-10 space-y-4 pb-2">
      <div class="relative">
        <div class="absolute left-4 top-1/2 -translate-y-1/2 {isSearching ? 'animate-spin' : 'text-sage'}">
          {#if isSearching}
            <div class="w-4 h-4 border-2 border-olive border-t-transparent rounded-full"></div>
          {:else}
            <Search size={16} />
          {/if}
        </div>
        <input 
          type="text" 
          value={searchQuery}
          oninput={handleSearchInput}
          placeholder={currentTab === 'comrades' ? "Find students..." : currentTab === 'schools' ? "Find schools..." : "Find classes..."} 
          class="w-full bg-cream border border-sage/10 rounded-[24px] py-3.5 pl-12 pr-4 text-[11px] focus:ring-2 focus:ring-olive/20 transition-all font-bold uppercase tracking-widest placeholder:text-sage shadow-inner"
        />
      </div>

      {#if currentTab === 'schools'}
      <div class="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
        <div class="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {#each regions() as region}
            <button 
              onclick={() => { selectedRegion = region; selectedDistrict = 'All'; }}
              class="whitespace-nowrap px-4 py-2 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all border {selectedRegion === region ? 'bg-olive text-white border-olive shadow-md' : 'bg-paper text-sage border-sage/10 hover:border-sage'}"
            >
              {region}
            </button>
          {/each}
        </div>
        
        {#if districts().length > 1}
          <div class="flex items-center gap-2">
            <label for="district-select" class="text-[8px] font-bold text-sage uppercase tracking-widest shrink-0">District:</label>
            <div class="flex-1 relative">
                <select 
                  id="district-select"
                  bind:value={selectedDistrict}
                  class="w-full bg-paper border border-sage/10 rounded-full px-4 py-2 text-[10px] font-bold text-ink uppercase tracking-widest focus:ring-1 focus:ring-olive/30 appearance-none bg-transparent relative z-10"
                >
                  {#each districts() as district}
                    <option value={district}>{district}</option>
                  {/each}
                </select>
                <div class="absolute right-3 top-1/2 -translate-y-1/2 text-sage pointer-events-none">
                  <ChevronDown size={14} />
                </div>
            </div>
          </div>
        {/if}
      </div>
      {/if}
    </div>
  </header>

  <div class="flex-1 overflow-y-auto w-full p-6 space-y-8 pb-32">
    {#if searchQuery.trim().length >= 2}
      <!-- Search Results View (Unified for transparency) -->
      <div class="space-y-6">
        <h3 class="text-xs font-bold uppercase tracking-widest text-accent">Search Results</h3>
        
        {#if searchResults.users.length === 0 && searchResults.schools.length === 0 && searchResults.independentClasses.length === 0 && !isSearching}
          <div class="bg-paper p-8 rounded-[20px] border border-sage/10 text-center">
            <p class="text-sage text-sm italic">No matches found. Try a different keyword.</p>
          </div>
        {/if}

        {#if searchResults.schools.length > 0 && (currentTab === 'schools' || currentTab === 'comrades')}
        <section>
          <h4 class="text-[10px] font-bold text-sage uppercase tracking-widest mb-3 px-1">Schools</h4>
          <div class="space-y-3">
            {#each searchResults.schools as school}
            <div class="bg-paper rounded-[20px] border border-sage/10 overflow-hidden shadow-sm transition-all">
              <div class="flex items-center">
                <button 
                  onclick={() => toggleSchool(school.$id || school.name)}
                  class="flex-1 p-4 flex items-center justify-between cursor-pointer hover:bg-cream/50 transition-colors border-none bg-transparent text-left"
                >
                  <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-full overflow-hidden bg-cream text-sage flex items-center justify-center border border-sage/5">
                      {#if school.logoUrl}
                        <img src={school.logoUrl} alt={school.name} class="w-full h-full object-cover" />
                      {:else}
                        <School size={20} />
                      {/if}
                    </div>
                    <div>
                      <div class="font-bold text-ink text-sm leading-tight">{school.name}</div>
                      <div class="text-[9px] text-sage font-bold uppercase tracking-widest mt-0.5">
                        {school.studentsCount || school.students || 0} Total · {school.region || school.district || ''}
                      </div>
                    </div>
                  </div>
                  <ChevronDown size={16} class="text-olive transition-transform duration-300 {expandedSchool === (school.$id || school.name) ? 'rotate-180' : ''}" />
                </button>
                <button 
                  onclick={() => openSchoolProfile(school)}
                  class="p-4 text-[9px] font-bold uppercase tracking-widest text-olive border-none bg-transparent hover:underline cursor-pointer"
                >
                  Profile
                </button>
              </div>
              {#if expandedSchool === (school.$id || school.name)}
              <div class="border-t border-sage/10 bg-cream/30 p-4 space-y-2">
                {#if !schoolClassesMap[school.$id || school.name]}
                  <div class="animate-pulse text-[10px] text-sage text-center py-2">Loading classes...</div>
                {:else if schoolClassesMap[school.$id || school.name].length === 0}
                  <div class="text-[10px] text-sage text-center py-2">No specific classes listed yet.</div>
                {:else}
                  {#each schoolClassesMap[school.$id || school.name] as cls}
                    <div class="flex items-center justify-between p-2 bg-paper rounded-xl border border-sage/5">
                      <button 
                        onclick={() => openClassProfile(cls)}
                        class="text-xs font-bold text-ink border-none bg-transparent cursor-pointer hover:text-olive hover:underline"
                      >
                        {cls.name}
                      </button>
                      <button onclick={(e) => handleRequestJoin(cls.$id || cls.id, e)} class="text-[9px] font-bold uppercase tracking-widest text-olive border-none bg-transparent cursor-pointer hover:underline">Join</button>
                    </div>
                  {/each}
                {/if}
              </div>
              {/if}
            </div>
            {/each}
          </div>
        </section>
        {/if}

        {#if searchResults.users.length > 0 && (currentTab === 'comrades' || currentTab === 'schools')}
        <section>
          <h4 class="text-[10px] font-bold text-sage uppercase tracking-widest mb-3 px-1">Students</h4>
          <div class="grid grid-cols-2 gap-3">
            {#each searchResults.users as user (user.userId)}
            <div class="bg-paper p-4 rounded-[20px] border border-sage/10 flex flex-col items-center text-center shadow-sm">
              <div onclick={(e) => openProfileLightbox(e, user)} class="w-14 h-14 rounded-full overflow-hidden mb-3 cursor-pointer border border-sage/10 relative">
                <img src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} alt={user.name} class="w-full h-full object-cover" />
                {#if authService.computeIsOnline(user, currentTime)}
                   <div class="absolute bottom-0 right-0 w-3 h-3 bg-accent border-2 border-paper rounded-full"></div>
                {/if}
              </div>
              <div class="font-bold text-ink text-xs mb-1 truncate w-full">{user.name}</div>
              <div class="text-[8px] text-sage font-bold uppercase tracking-widest truncate w-full mb-3">{user.school || 'Academic Institution'}</div>
              
              {#if currentComrades.some(c => c.userId === user.userId)}
                <button 
                  onclick={() => handleComradeAction(user.userId, user.name, true)}
                  class="w-full py-2 rounded-full text-[8px] font-bold uppercase tracking-widest transition-all bg-olive/10 text-olive border-none hover:bg-olive hover:text-white cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <MessageSquare size={10} /> Message
                </button>
              {:else}
                <button 
                  onclick={() => handleComradeAction(user.userId, user.name, false)}
                  disabled={invitedComrades.has(user.userId)}
                  class="w-full py-2 rounded-full text-[8px] font-bold uppercase tracking-widest transition-all {invitedComrades.has(user.userId) ? 'bg-olive/10 text-olive border-none' : 'bg-cream text-olive border border-sage/10 shadow-sm hover:bg-olive hover:text-white cursor-pointer flex items-center justify-center gap-1.5'}"
                >
                  {#if invitedComrades.has(user.userId)}
                    <CheckCircle2 size={10} /> Pending
                  {:else}
                    <UserPlus size={10} /> Connect
                  {/if}
                </button>
              {/if}
            </div>
            {/each}
          </div>
        </section>
        {/if}

        {#if searchResults.independentClasses.length > 0 && (currentTab === 'classes' || currentTab === 'comrades')}
        <section>
          <h4 class="text-[10px] font-bold text-sage uppercase tracking-widest mb-3 px-1">Classes</h4>
          <div class="space-y-3">
            {#each searchResults.independentClasses as cls}
            <div class="bg-paper p-4 rounded-[20px] border border-sage/10 flex items-center justify-between">
              <div>
                <div class="font-bold text-ink text-sm leading-tight">{cls.name}</div>
                <div class="text-[10px] text-sage font-bold uppercase tracking-widest mt-1">By {cls.teacherName}</div>
              </div>
              <button 
                onclick={(e) => handleRequestJoin(cls.id, e)}
                disabled={requestedClasses.has(cls.id)}
                class="px-4 py-2 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all {requestedClasses.has(cls.id) ? 'bg-sage/10 text-sage border-none' : 'bg-olive text-white border-none shadow-sm hover:bg-olive/90 cursor-pointer'}"
              >
                Join
              </button>
            </div>
            {/each}
          </div>
        </section>
        {/if}
      </div>
    {:else}
      <!-- Tabbed Views -->
      {#if isLoadingData}
        <div class="space-y-8">
           {#if currentTab === 'comrades'}
             <section class="space-y-4">
               <Skeleton variant="text" width="w-36" height="1rem" />
               <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                 {#each Array(4) as _}
                   <div class="bg-theme-card/80 border border-theme-border/50 p-5 rounded-[20px] flex flex-col items-center gap-3">
                     <Skeleton variant="circular" width="w-16" height="h-16" />
                     <Skeleton variant="text" width="w-20" height="0.75rem" />
                     <Skeleton variant="text" width="w-24" height="0.5rem" />
                     <Skeleton variant="rectangular" height="2.5rem" class="rounded-full mt-2" />
                   </div>
                 {/each}
               </div>
             </section>
             <section class="space-y-4">
               <Skeleton variant="text" width="w-36" height="1rem" />
               <Skeleton variant="list" count={4} />
             </section>
           {:else if currentTab === 'schools'}
              <section class="space-y-4">
                <div class="flex justify-between items-center">
                  <Skeleton variant="text" width="w-40" height="1rem" />
                  <Skeleton variant="text" width="w-16" height="0.75rem" />
                </div>
                <Skeleton variant="card" count={3} />
              </section>
           {:else if currentTab === 'classes'}
              <section class="space-y-4">
                <Skeleton variant="text" width="w-40" height="1rem" />
                <Skeleton variant="card" count={3} />
              </section>
           {/if}
        </div>
      {:else if currentTab === 'comrades'}
        <div class="space-y-8 animate-in fade-in duration-500">
          {#if !['parent'].includes(role || '')}
          <section>
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-xs font-bold uppercase tracking-widest text-accent">Recommended Comrades</h3>
            </div>
            <div class="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide">
              {#each recommendedComrades as comp (comp.userId)}
              <div class="bg-paper p-5 rounded-[20px] border border-sage/10 min-w-[150px] flex flex-col items-center text-center shadow-sm">
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div onclick={(e) => openProfileLightbox(e, comp)} class="w-16 h-16 rounded-full overflow-hidden bg-cream flex items-center justify-center font-bold text-lg text-sage mb-4 border border-sage/10 relative cursor-pointer hover:border-olive transition-colors">
                  <img src={comp.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comp.name}`} alt={comp.name} class="w-full h-full object-cover bg-cream" />
                  <div class="absolute bottom-1 right-1 w-4 h-4 {authService.computeIsOnline(comp, currentTime) ? 'bg-accent' : 'bg-sage/40'} border-2 border-paper rounded-full z-10"></div>
                </div>
                <div class="font-bold text-ink text-sm mb-1 cursor-pointer hover:underline" onclick={(e) => openProfileLightbox(e, comp)}>{comp.name}</div>
                <div class="text-[9px] text-sage font-bold uppercase tracking-widest mb-5">{comp.school}</div>
                <button 
                  onclick={() => handleComradeAction(comp.userId, comp.name, false)}
                  disabled={invitedComrades.has(comp.userId)}
                  class="w-full border-none cursor-pointer flex items-center justify-center gap-1.5 py-3 rounded-[20px] text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm {invitedComrades.has(comp.userId) ? 'bg-olive/10 text-olive' : 'bg-cream text-olive hover:bg-olive hover:text-white'}"
                >
                  {#if invitedComrades.has(comp.userId)}
                     <CheckCircle2 size={12} /> Pending
                  {:else}
                     <UserPlus size={12} /> Connect
                  {/if}
                </button>
              </div>
              {/each}
            </div>
          </section>
           <section>
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-xs font-bold uppercase tracking-widest text-accent">My Comrades</h3>
            </div>
            <div class="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide">
              {#each currentComrades as comp (comp.userId)}
              <div class="bg-paper p-5 rounded-[20px] border border-sage/10 min-w-[150px] flex flex-col items-center text-center shadow-sm">
                <div onclick={(e) => openProfileLightbox(e, comp)} class="w-16 h-16 rounded-full overflow-hidden bg-cream flex items-center justify-center font-bold text-lg text-sage mb-4 border border-sage/10 relative cursor-pointer hover:border-olive transition-colors">
                  <img src={comp.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comp.name}`} alt={comp.name} class="w-full h-full object-cover bg-cream" />
                  <div class="absolute bottom-1 right-1 w-4 h-4 {authService.computeIsOnline(comp, currentTime) ? 'bg-orange-500' : 'bg-sage/40'} border-2 border-paper rounded-full z-10"></div>
                </div>
                <div class="font-bold text-ink text-sm mb-1 cursor-pointer hover:underline" onclick={(e) => openProfileLightbox(e, comp)}>{comp.name}</div>
                <div class="text-[9px] text-sage font-bold uppercase tracking-widest mb-5">{comp.school}</div>
                <button 
                  onclick={() => handleComradeAction(comp.userId, comp.name, true)}
                  class="w-full border-none cursor-pointer flex items-center justify-center gap-1.5 py-3 rounded-[20px] text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm bg-olive/10 text-olive hover:bg-olive hover:text-white"
                >
                  <MessageSquare size={12} /> Message
                </button>
              </div>
              {/each}
              {#if currentComrades.length === 0}
                <div class="flex flex-col items-center justify-center p-8 w-full bg-paper/50 rounded-[20px] border border-dashed border-sage/20">
                  <p class="text-sage text-[10px] font-bold uppercase tracking-widest opacity-60">No comrades connected yet</p>
                </div>
              {/if}
            </div>
          </section>
          {/if}

          {#if ['parent', 'student'].includes(role || '')}
          <section>
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-xs font-bold uppercase tracking-widest text-accent">Teachers & Administrators</h3>
            </div>
            <div class="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 scrollbar-hide">
              {#each schoolStaff as staff (staff.name)}
              <div class="bg-paper p-5 rounded-[20px] border border-sage/10 min-w-[150px] flex flex-col items-center text-center shadow-sm">
                <div onclick={(e) => openProfileLightbox(e, staff)} class="w-16 h-16 rounded-full overflow-hidden bg-cream flex items-center justify-center font-bold text-lg text-sage mb-4 border border-sage/10 relative cursor-pointer hover:border-olive transition-colors">
                  <img src={staff.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${staff.name}`} alt={staff.name} class="w-full h-full object-cover bg-cream" />
                  <div class="absolute bottom-1 right-1 w-4 h-4 {authService.computeIsOnline(staff, currentTime) ? 'bg-orange-500' : 'bg-sage/40'} border-2 border-paper rounded-full z-10"></div>
                </div>>
                <div class="font-bold text-ink text-sm mb-1 cursor-pointer hover:underline" onclick={(e) => openProfileLightbox(e, staff)}>{staff.name}</div>
                <div class="text-[10px] text-sage font-bold uppercase tracking-widest mb-1">{staff.position}</div>
                <div class="text-[9px] text-sage font-bold uppercase tracking-widest mb-5 truncate w-full px-2">{staff.school}</div>
                <button 
                  onclick={() => handleComradeAction(staff.userId, staff.name, false)}
                  disabled={invitedComrades.has(staff.userId)}
                  class="cursor-pointer border-none w-full flex items-center justify-center gap-1.5 py-3 rounded-[20px] text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm {invitedComrades.has(staff.userId) ? 'bg-olive/10 text-olive' : 'bg-cream text-olive hover:bg-olive hover:text-white'}"
                >
                  {#if invitedComrades.has(staff.userId)}
                     <CheckCircle2 size={12} /> Pending
                  {:else}
                     <UserPlus size={12} /> Connect
                  {/if}
                </button>
              </div>
              {/each}
            </div>
          </section>
          {/if}
        </div>
      {:else if currentTab === 'schools'}
        <section class="animate-in fade-in duration-500">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-xs font-bold uppercase tracking-widest text-accent flex items-center gap-2">
              <Globe size={18} />
              Educational Institutions
            </h3>
            <span onclick={viewAllInstitutions} class="text-[9px] font-bold text-olive uppercase tracking-wider underline cursor-pointer">Registry</span>
          </div>
          <div class="space-y-6">
            {#each Object.entries(groupedSchools()) as [region, districts]}
            <div class="bg-paper/30 p-2 rounded-[32px] border border-sage/5">
              <h4 class="text-[11px] font-bold text-ink uppercase tracking-widest mb-4 px-4 py-2 bg-cream/50 rounded-full inline-flex items-center gap-2">
                <Globe size={14} class="text-olive" /> {region}
              </h4>
              <div class="space-y-6">
                {#each Object.entries(districts) as [district, schools]}
                <div class="px-2">
                  <h5 class="text-[9px] font-bold text-sage uppercase tracking-widest mb-3 px-3 flex items-center gap-2">
                    <span class="w-1.5 h-1.5 rounded-full bg-olive/30"></span> {district} DISTRICT
                  </h5>
                  <div class="grid gap-3">
                    {#each schools as school (school.$id || school.name)}
                    <div class="bg-paper rounded-[24px] border border-sage/10 overflow-hidden shadow-sm hover:shadow-md transition-all">
                      <div class="w-full flex items-center justify-between transition-colors">
                        <div 
                          onclick={() => toggleSchool(school.$id || school.name)}
                          class="flex-1 p-4 flex items-center justify-between cursor-pointer hover:bg-cream/50 transition-colors"
                        >
                          <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-[20px] bg-cream text-sage flex items-center justify-center border border-sage/5 overflow-hidden">
                              {#if school.logoUrl}
                                <img src={school.logoUrl} alt={school.name} class="w-full h-full object-cover" />
                              {:else}
                                <School size={24} />
                              {/if}
                            </div>
                            <div>
                              <div class="font-bold text-ink text-sm leading-tight">{school.name}</div>
                              <div class="text-[10px] text-sage font-bold uppercase tracking-widest mt-0.5">
                                {school.studentsCount || 0} Members · <span class="text-olive font-black">{school.onlineCount || 0}</span> Online
                              </div>
                            </div>
                          </div>
                          <ChevronDown size={20} class="text-olive transition-transform duration-300 {expandedSchool === (school.$id || school.name) ? 'rotate-180' : ''}" />
                        </div>
                        <div class="pr-5">
                          <button 
                            onclick={(e) => { e.stopPropagation(); openSchoolProfile(school); }}
                            class="px-4 py-2 bg-cream text-olive rounded-full border border-olive/10 text-[9px] font-bold uppercase tracking-widest hover:bg-olive hover:text-white transition-all cursor-pointer shadow-sm"
                          >
                            Profile
                          </button>
                        </div>
                      </div>
                      
                      {#if expandedSchool === (school.$id || school.name)}
                      <div class="border-t border-sage/10 bg-cream/30 p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
                        <div class="flex items-center justify-between">
                          <h4 class="text-[10px] font-bold text-sage uppercase tracking-widest mb-1 px-1">Institutional Classes</h4>
                          <span class="text-[8px] bg-paper px-2 py-0.5 rounded-full border border-sage/10 text-sage uppercase font-bold tracking-widest">Live</span>
                        </div>
                        {#if !schoolClassesMap[school.$id || school.name]}
                           <div class="animate-pulse text-[10px] text-sage text-center py-4 uppercase font-bold tracking-widest">Syncing Records...</div>
                        {:else if schoolClassesMap[school.$id || school.name].length === 0}
                           <div class="text-[10px] text-sage text-center py-4 italic">No active classes registered this term.</div>
                        {:else}
                          <div class="grid gap-2">
                            {#each schoolClassesMap[school.$id || school.name] as cls}
                            <div class="bg-paper border border-sage/10 rounded-[18px] p-3 flex items-center justify-between shadow-sm hover:border-olive transition-colors">
                              <div onclick={() => openClassProfile(cls)} class="flex items-center gap-3 cursor-pointer">
                                <div class="w-8 h-8 rounded-lg bg-cream flex items-center justify-center text-sage">
                                  <BookOpen size={16} />
                                </div>
                                <div class="flex flex-col">
                                  <div class="font-bold text-xs text-ink">{cls.name}</div>
                                  <div class="text-[9px] text-sage font-bold uppercase tracking-widest">{cls.teacherName}</div>
                                </div>
                              </div>
                              <button 
                                onclick={(e) => handleRequestJoin(cls.$id || cls.id, e)}
                                disabled={requestedClasses.has(cls.$id || cls.id)}
                                class="cursor-pointer border-none px-4 py-1.5 rounded-full text-[8px] font-bold uppercase tracking-widest transition-all {requestedClasses.has(cls.$id || cls.id) ? 'bg-olive/10 text-olive' : 'bg-olive text-white shadow-md hover:bg-olive/90'}"
                              >
                                {requestedClasses.has(cls.$id || cls.id) ? 'Awaiting' : 'Join'}
                              </button>
                            </div>
                            {/each}
                          </div>
                        {/if}
                      </div>
                      {/if}
                    </div>
                    {/each}
                  </div>
                </div>
                {/each}
              </div>
            </div>
            {/each}
          </div>
        </section>
      {:else if currentTab === 'classes'}
        <section class="animate-in fade-in duration-500">
          <div class="flex items-center justify-between mb-6">
             <h3 class="text-xs font-bold uppercase tracking-widest text-accent flex items-center gap-2">
               <BookOpen size={18} />
               Independent Learning
             </h3>
             <span class="text-[8px] font-bold text-sage uppercase tracking-widest">Open Enrollment</span>
          </div>
          <div class="grid gap-4">
             {#each MOCK_INDEPENDENT_CLASSES as cls (cls.id)}
             <div class="bg-paper p-5 rounded-[24px] border border-sage/10 shadow-sm relative overflow-hidden group hover:border-olive transition-all">
                <div class="absolute top-0 right-0 w-24 h-full bg-olive/5 -skew-x-12 transform translate-x-12 transition-transform group-hover:translate-x-8"></div>
                <div class="flex items-center justify-between relative z-10">
                   <div class="flex-1">
                     <div class="font-bold text-ink text-base mb-1">{cls.name}</div>
                     <div class="flex items-center gap-2">
                       <span class="text-[10px] text-sage font-bold uppercase tracking-widest">Primary Instructor: {cls.teacherName}</span>
                       <span class="w-1 h-1 rounded-full bg-sage/30"></span>
                       <span class="text-[10px] text-olive font-bold uppercase tracking-widest">Verified</span>
                     </div>
                   </div>
                   <div class="text-right">
                     <div class="text-sm font-black text-olive">{cls.fee === 0 ? 'FREE' : `UGX ${cls.fee.toLocaleString()}`}</div>
                   </div>
                </div>
                <div class="mt-4 flex items-center gap-3 relative z-10">
                  <button 
                     onclick={(e) => handleRequestJoin(cls.id, e)}
                     disabled={requestedClasses.has(cls.id)}
                     class="flex-1 cursor-pointer border-none py-3 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all shadow-md {requestedClasses.has(cls.id) ? 'bg-sage/10 text-sage' : 'bg-olive text-white hover:bg-olive/90 ring-4 ring-olive/5'}"
                   >
                     {requestedClasses.has(cls.id) ? 'Enrolled' : (cls.fee === 0 ? 'Start Learning' : 'Complete Enrollment')}
                  </button>
                  <button class="p-3 rounded-full bg-cream text-olive hover:bg-olive/10 transition-colors shadow-sm">
                    <MessageSquare size={16} />
                  </button>
                </div>
             </div>
             {/each}
          </div>
        </section>
      {/if}
    {/if}
  </div>
</div>

<UserProfileLightbox 
     bind:isOpen={isProfileLightboxOpen} 
     bind:user={profileData} 
     isComrade={profileData ? currentComrades.some(c => c.userId === profileData.userId) : false}
     isInvited={profileData ? invitedComrades.has(profileData.userId) : false}
     onMessage={(u) => { 
        triggerNotification('Messaging', { body: `Starting message with ${u.name}...`, type: 'info' });
        if (onopenchat) onopenchat(`user_${u.userId}`, u.name);
     }}
     onInvite={(u) => { handleComradeAction(u.userId, u.name, false) }}
     onUnfriend={handleUnfriend}
/>

<!-- School Profile Lightbox -->
{#if isSchoolProfileOpen && schoolProfileData}
<div class="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onclick={() => isSchoolProfileOpen = false}>
  <div class="bg-paper w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200" onclick={(e) => e.stopPropagation()}>
      <div class="h-24 bg-gradient-to-r from-olive/20 to-accent/20 relative">
          <button onclick={() => isSchoolProfileOpen = false} class="absolute top-4 right-4 bg-paper/80 p-2 rounded-full border-none cursor-pointer hover:bg-paper transition-colors">
              <Lock size={16} class="text-sage rotate-45" /> <!-- using lock as simple close x -->
          </button>
      </div>
      <div class="px-8 pb-8 -mt-10 flex flex-col items-center text-center">
          <div class="w-20 h-20 rounded-[24px] bg-paper p-1 shadow-lg mb-4">
              <div class="w-full h-full rounded-[20px] bg-cream border border-sage/10 flex items-center justify-center overflow-hidden">
                  {#if schoolProfileData.logoUrl}
                      <img src={schoolProfileData.logoUrl} alt={schoolProfileData.name} class="w-full h-full object-cover" />
                  {:else}
                      <School size={32} class="text-sage" />
                  {/if}
              </div>
          </div>
          <h3 class="text-xl font-bold text-ink mb-1">{schoolProfileData.name}</h3>
          <p class="text-[10px] text-sage font-bold uppercase tracking-[0.2em] mb-4">{schoolProfileData.district || ''} · {schoolProfileData.studentsCount || 0} Students</p>
          
          {#if schoolProfileData.motto}
              <p class="text-xs italic text-sage bg-olive/5 py-3 px-6 rounded-2xl mb-6">"{schoolProfileData.motto}"</p>
          {/if}

          <div class="w-full grid grid-cols-2 gap-3 mb-8">
              <div class="bg-cream p-3 rounded-2xl border border-sage/5">
                  <div class="text-[9px] font-bold text-sage uppercase tracking-widest mb-1">Online Now</div>
                  <div class="text-sm font-bold text-olive">{schoolProfileData.onlineCount || 0}</div>
              </div>
              <div class="bg-cream p-3 rounded-2xl border border-sage/5">
                  <div class="text-[9px] font-bold text-sage uppercase tracking-widest mb-1">Status</div>
                  <div class="text-sm font-bold text-ink">Verified</div>
              </div>
          </div>

          <button 
              onclick={() => { isSchoolProfileOpen = false; toggleSchool(schoolProfileData.$id || schoolProfileData.name); }}
              class="w-full bg-olive text-white border-none py-4 rounded-[20px] font-bold text-xs uppercase tracking-widest shadow-lg hover:shadow-olive/20 transition-all cursor-pointer mb-6"
          >
              View Class Registry
          </button>

          <div class="w-full text-left">
              <h4 class="text-[10px] font-bold text-sage uppercase tracking-widest mb-4 px-1">Top Active Students</h4>
              {#if isLoadingSchoolStudents}
                  <div class="flex gap-2 animate-pulse">
                      {#each Array(3) as _}
                          <div class="w-10 h-10 rounded-full bg-cream border border-sage/10"></div>
                      {/each}
                  </div>
              {:else if schoolStudents.length === 0}
                  <div class="text-[10px] text-sage italic px-1">No registered students found for this school.</div>
              {:else}
                  <div class="flex -space-x-3 overflow-hidden mb-4">
                      {#each schoolStudents.slice(0, 5) as student}
                          <div onclick={(e) => openProfileLightbox(e, { ...student, name: student.fullName })} class="w-10 h-10 rounded-full bg-paper border-2 border-paper ring-1 ring-sage/10 overflow-hidden cursor-pointer hover:z-10 transition-transform hover:scale-110">
                              <img src={student.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${student.fullName}`} alt={student.fullName} class="w-full h-full object-cover" />
                          </div>
                      {/each}
                      {#if schoolStudents.length > 5}
                          <div class="w-10 h-10 rounded-full bg-olive/10 text-olive flex items-center justify-center text-[9px] font-bold border-2 border-paper ring-1 ring-sage/10">
                              +{schoolStudents.length - 5}
                          </div>
                      {/if}
                  </div>
                  <div class="space-y-2">
                       {#each schoolStudents.slice(0, 3) as student}
                         <div class="flex items-center justify-between p-2 rounded-xl bg-cream/50 border border-sage/5">
                            <div class="flex items-center gap-2">
                               <div class="w-2 h-2 rounded-full {authService.computeIsOnline(student, currentTime) ? 'bg-accent' : 'bg-sage/40'}"></div>
                               <span class="text-[10px] font-bold text-ink">{student.fullName}</span>
                            </div>
                            <span class="text-[8px] text-sage font-bold uppercase">{student.studentClass || 'Student'}</span>
                         </div>
                       {/each}
                  </div>
              {/if}
          </div>
      </div>
  </div>
</div>
{/if}

<!-- Class Profile Lightbox -->
{#if isClassProfileOpen && classProfileData}
<div class="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onclick={() => isClassProfileOpen = false}>
  <div class="bg-paper w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200" onclick={(e) => e.stopPropagation()}>
      <div class="bg-olive/10 p-6 flex items-center justify-between">
          <h3 class="font-bold text-ink text-lg">Class Profile</h3>
          <button onclick={() => isClassProfileOpen = false} class="bg-paper/80 p-2 rounded-full border-none cursor-pointer">
              <Search size={16} class="text-sage rotate-45" /> 
          </button>
      </div>
      <div class="p-8">
          <div class="flex items-center gap-4 mb-8">
              <div class="w-16 h-16 rounded-2xl bg-olive flex items-center justify-center shrink-0">
                  <BookOpen size={28} class="text-white" />
              </div>
              <div>
                  <h4 class="text-xl font-bold text-ink leading-tight">{classProfileData.name}</h4>
                  <p class="text-[10px] text-sage font-bold uppercase tracking-widest mt-1">Instructor Managed</p>
              </div>
          </div>

          <div class="space-y-4 mb-8">
              <div class="flex items-center justify-between p-4 bg-cream rounded-2xl border border-sage/5">
                  <div>
                      <div class="text-[9px] font-bold text-sage uppercase tracking-widest">Instructor</div>
                      <div class="text-sm font-bold text-ink">{classProfileData.teacherName}</div>
                  </div>
                  <div class="w-8 h-8 rounded-full bg-paper flex items-center justify-center border border-sage/10">
                      <MessageSquare size={14} class="text-olive" />
                  </div>
              </div>

              <div class="flex items-center justify-between p-4 bg-cream rounded-2xl border border-sage/5">
                  <div>
                      <div class="text-[9px] font-bold text-sage uppercase tracking-widest">Inscribed Students</div>
                      <div class="text-sm font-bold text-ink">{classProfileData.studentsCount || 0} members</div>
                  </div>
                  <div class="w-8 h-8 rounded-full bg-paper flex items-center justify-center border border-sage/10">
                      <UserPlus size={14} class="text-olive" />
                  </div>
              </div>

              <div class="flex items-center justify-between p-4 bg-cream rounded-2xl border border-sage/5">
                  <div>
                      <div class="text-[9px] font-bold text-sage uppercase tracking-widest">Last Activity</div>
                      <div class="text-sm font-bold text-ink">{classProfileData.$createdAt ? new Date(classProfileData.$createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}</div>
                  </div>
                  <div class="w-8 h-8 rounded-full bg-paper flex items-center justify-center border border-sage/10">
                      <Globe size={14} class="text-olive" />
                  </div>
              </div>
          </div>

          <button 
              onclick={(e) => { isClassProfileOpen = false; handleRequestJoin(classProfileData.$id || classProfileData.id, e); }}
              disabled={requestedClasses.has(classProfileData.$id || classProfileData.id)}
              class="w-full py-4 rounded-[20px] font-bold text-xs uppercase tracking-widest transition-all {requestedClasses.has(classProfileData.$id || classProfileData.id) ? 'bg-olive/10 text-olive border border-olive/20' : 'bg-olive text-white border-none shadow-lg hover:shadow-olive/20 cursor-pointer'}"
          >
              {requestedClasses.has(classProfileData.$id || classProfileData.id) ? 'Already Applied' : 'Request to Join Class'}
          </button>
      </div>
  </div>
</div>
{/if}
