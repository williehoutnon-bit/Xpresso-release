<script lang="ts">
  import { X, MessageSquare, UserPlus, Zap, Edit2, Save, Undo2, Loader2 } from 'lucide-svelte';
  import { fade, fly } from 'svelte/transition';
  import { authService } from '../services/authService';

  let { 
      isOpen = $bindable(false), 
      user = $bindable(null),
      isComrade = false,
      isInvited = false,
      onClose = () => {},
      onMessage = () => {},
      onInvite = () => {},
      onUnfriend = () => {}
  } = $props<{ 
      isOpen: boolean, 
      user: any,
      isComrade?: boolean,
      isInvited?: boolean,
      onClose?: () => void,
      onMessage?: (user: any) => void,
      onInvite?: (user: any) => void,
      onUnfriend?: (user: any) => void
  }>();

  let confirmUnfriend = $state(false);
  let loggedInUser = $state<any>(null);
  let isEditing = $state(false);
  let isSaving = $state(false);

  let editForm = $state({
      name: '',
      school: '',
      role: 'student',
      bio: '',
      studentClass: '',
      age: '',
      house: '',
      preferredSubjects: '',
      subjectCombination: '',
      clubs: '',
      avatarUrl: ''
  });

  const handleClose = () => {
      confirmUnfriend = false;
      isEditing = false;
      isOpen = false;
      onClose();
  };

  let lastFetchedUserId = '';
  $effect(() => {
    if (isOpen) {
      authService.getCurrentUser().then(u => {
        loggedInUser = u;
      }).catch(err => console.error(err));

      if (user) {
        const targetUserId = user.userId || user.user_id || user.id || user.$id;
        if (targetUserId && targetUserId !== lastFetchedUserId) {
          lastFetchedUserId = targetUserId;
          authService.getProfile(targetUserId, true).then(p => {
            if (p) {
              user = {
                ...user,
                name: p.fullName || p.name || user.name || '',
                fullName: p.fullName || p.name || user.fullName || '',
                avatarUrl: p.avatarUrl || user.avatarUrl || '',
                avatar: p.avatarUrl || user.avatarUrl || user.avatar || '',
                role: p.role || user.role || 'student',
                school: p.school || user.school || '',
                bio: p.bio || user.bio || '',
                studentClass: p.studentClass || user.studentClass || '',
                age: p.age ? String(p.age) : (user.age ? String(user.age) : ''),
                house: p.house || user.house || '',
                preferredSubjects: p.preferredSubjects || user.preferredSubjects || '',
                subjectCombination: p.subjectCombination || user.subjectCombination || '',
                clubs: p.clubs || user.clubs || '',
                points: p.points !== undefined ? p.points : user.points
              };
            }
          }).catch(err => {
             console.error('Failed to load fresh profile info in Lightbox:', err);
             lastFetchedUserId = ''; // Reset on error so we can retry
          });
        }
      }
    } else {
      isEditing = false;
      lastFetchedUserId = ''; // Reset when closed
    }
  });

  let isOwnProfile = $derived(
    loggedInUser && user && 
    (user.userId === (loggedInUser.id || loggedInUser.$id) || 
     user.user_id === (loggedInUser.id || loggedInUser.$id) || 
     (user.$id && user.$id === (loggedInUser.id || loggedInUser.$id)))
  );

  const startEditing = () => {
      editForm = {
          name: user.name || user.fullName || '',
          school: user.school || '',
          role: user.role || 'student',
          bio: user.bio || '',
          studentClass: user.studentClass || '',
          age: user.age ? String(user.age) : '',
          house: user.house || '',
          preferredSubjects: user.preferredSubjects || '',
          subjectCombination: user.subjectCombination || '',
          clubs: user.clubs || '',
          avatarUrl: user.avatarUrl || user.avatar || ''
      };
      isEditing = true;
  };

  const handleSave = async () => {
      isSaving = true;
      try {
          const viewedUserId = user.userId || user.user_id || user.$id;
          const numericAge = editForm.age ? parseInt(editForm.age, 10) : undefined;
          
          const updated = await authService.updateProfile(viewedUserId, {
              fullName: editForm.name,
              school: editForm.school,
              role: editForm.role,
              bio: editForm.bio,
              studentClass: editForm.studentClass,
              age: numericAge,
              house: editForm.house,
              preferredSubjects: editForm.preferredSubjects,
              subjectCombination: editForm.subjectCombination,
              clubs: editForm.clubs,
              avatarUrl: editForm.avatarUrl || `https://api.dicebear.com/7.x/notionists/svg?seed=${editForm.name}`
          });

          // Update user prop locally - because of $bindable, it propagates to parent immediately if bound
          user.name = editForm.name;
          user.fullName = editForm.name;
          user.school = editForm.school;
          user.role = editForm.role;
          user.bio = editForm.bio;
          user.studentClass = editForm.studentClass;
          user.age = editForm.age;
          user.house = editForm.house;
          user.preferredSubjects = editForm.preferredSubjects;
          user.subjectCombination = editForm.subjectCombination;
          user.clubs = editForm.clubs;
          user.avatarUrl = updated.avatarUrl;
          user.avatar = updated.avatarUrl;

          isEditing = false;
      } catch (err) {
          console.error("Failed to save profile:", err);
      } finally {
          isSaving = false;
      }
  };
</script>

{#if isOpen && user}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div 
      class="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm"
      transition:fade={{ duration: 200 }}
      onclick={handleClose}
  >
      <div 
          class="bg-paper w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl relative border border-sage/10 text-center"
          transition:fly={{ y: 20, duration: 300, opacity: 0 }}
          onclick={(e) => e.stopPropagation()}
      >
          <!-- Close Button -->
          <button 
              onclick={handleClose} 
              class="absolute top-4 right-4 z-10 p-2 bg-black/10 hover:bg-black/20 text-ink rounded-full border-none cursor-pointer transition-colors backdrop-blur-md"
          >
              <X size={20} class="text-sage" />
          </button>

          <!-- Banner -->
          <div class="h-24 bg-sage/10 relative w-full"></div>

          <!-- Avatar & Body Container -->
          <div class="px-6 pb-6 pt-0 relative {isEditing ? '-mt-6 max-h-[75vh] overflow-y-auto w-full' : '-mt-12'} flex flex-col items-center">
              {#if isEditing}
                  <!-- Avatar Edit Header -->
                  <div class="w-20 h-20 rounded-full border-4 border-paper bg-cream shadow-md overflow-hidden relative flex items-center justify-center mb-3">
                      {#if editForm.avatarUrl}
                          <img src={editForm.avatarUrl} alt="Avatar" class="w-full h-full object-cover" />
                      {:else}
                          <div class="text-xs text-sage font-bold">No Image</div>
                      {/if}
                  </div>
                  
                  <!-- Preset Avatars -->
                  <div class="mb-4 w-full">
                      <span class="text-[9px] text-sage font-bold uppercase tracking-widest block mb-1.5 text-center">Select Avatar Preset</span>
                      <div class="flex gap-1.5 flex-wrap items-center justify-center">
                        {#each ['DevMoi', 'Willie', 'Leo', 'Mia', 'Sasha', 'Nate'] as seed}
                          {@const url = seed === 'DevMoi' || seed === 'Nate' 
                            ? `https://api.dicebear.com/7.x/notionists/svg?seed=${seed}` 
                            : `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`}
                          <button
                            type="button"
                            onclick={() => editForm.avatarUrl = url}
                            class="w-8 h-8 rounded-full overflow-hidden border transition-all p-0.5 cursor-pointer hover:scale-105 {editForm.avatarUrl === url ? 'border-olive ring-1 ring-olive/50' : 'border-transparent bg-cream/50'}"
                          >
                            <img src={url} alt={seed} class="w-full h-full object-cover rounded-full" />
                          </button>
                        {/each}
                      </div>
                      <div class="mt-2 text-left">
                          <span class="text-[8px] text-sage/70 font-bold uppercase tracking-wider block mb-0.5">Or Custom Avatar URL</span>
                          <input 
                            type="text" 
                            bind:value={editForm.avatarUrl} 
                            placeholder="https://..." 
                            class="w-full bg-cream/30 border border-sage/15 rounded-lg px-2 py-1 text-[10px] text-ink focus:outline-none focus:border-sage font-mono"
                          />
                      </div>
                  </div>

                  <!-- Editable Fields Form -->
                  <div class="w-full text-left space-y-3 mb-6">
                      <div class="space-y-0.5">
                          <span class="text-[9px] text-sage font-bold uppercase tracking-widest">Full Name</span>
                          <input type="text" bind:value={editForm.name} placeholder="Full Name" class="w-full bg-cream/30 border border-sage/15 rounded-xl px-3 py-1.5 text-xs text-ink focus:outline-none focus:border-sage font-bold" />
                      </div>
                      <div class="space-y-0.5">
                          <span class="text-[9px] text-sage font-bold uppercase tracking-widest">Bio Description</span>
                          <textarea bind:value={editForm.bio} rows="2" placeholder="Bio details..." class="w-full bg-cream/30 border border-sage/15 rounded-xl px-3 py-1.5 text-xs text-ink focus:outline-none focus:border-sage italic"></textarea>
                      </div>
                      <div class="grid grid-cols-2 gap-3">
                          <div class="space-y-0.5">
                              <span class="text-[9px] text-sage font-bold uppercase tracking-widest">School</span>
                              <input type="text" bind:value={editForm.school} placeholder="School name" class="w-full bg-cream/30 border border-sage/15 rounded-xl px-3 py-1.5 text-xs text-ink focus:outline-none" />
                          </div>
                          <div class="space-y-0.5">
                              <span class="text-[9px] text-sage font-bold uppercase tracking-widest">Class</span>
                              <input type="text" bind:value={editForm.studentClass} placeholder="e.g. Senior 4" class="w-full bg-cream/30 border border-sage/15 rounded-xl px-3 py-1.5 text-xs text-ink focus:outline-none" />
                          </div>
                      </div>
                      <div class="grid grid-cols-2 gap-3">
                          <div class="space-y-0.5">
                              <span class="text-[9px] text-sage font-bold uppercase tracking-widest">Age</span>
                              <input type="text" bind:value={editForm.age} placeholder="Age" class="w-full bg-cream/30 border border-sage/15 rounded-xl px-3 py-1.5 text-xs text-ink focus:outline-none" />
                          </div>
                          <div class="space-y-0.5">
                              <span class="text-[9px] text-sage font-bold uppercase tracking-widest">House</span>
                              <input type="text" bind:value={editForm.house} placeholder="House name" class="w-full bg-cream/30 border border-sage/15 rounded-xl px-3 py-1.5 text-xs text-ink focus:outline-none" />
                          </div>
                      </div>
                      <div class="space-y-1 pt-1.5 border-t border-sage/10">
                          <span class="text-[9px] text-sage font-bold uppercase tracking-widest block mb-0.5">Academics</span>
                          <div class="grid grid-cols-2 gap-3">
                              <input type="text" placeholder="Combination (PCM)" bind:value={editForm.subjectCombination} class="w-full bg-cream/30 border border-sage/15 rounded-xl px-2.5 py-1.5 text-xs text-ink focus:outline-none" />
                              <input type="text" placeholder="Preferred subjects" bind:value={editForm.preferredSubjects} class="w-full bg-cream/30 border border-sage/15 rounded-xl px-2.5 py-1.5 text-xs text-ink focus:outline-none" />
                          </div>
                      </div>
                      <div class="space-y-0.5">
                          <span class="text-[9px] text-sage font-bold uppercase tracking-widest font-medium">Clubs & Societies</span>
                          <input type="text" bind:value={editForm.clubs} placeholder="Chess Club, Debate..." class="w-full bg-cream/30 border border-sage/15 rounded-xl px-3 py-1.5 text-xs text-ink focus:outline-none" />
                      </div>
                  </div>

                  <!-- Form Action Buttons -->
                  <div class="w-full flex gap-3">
                      <button onclick={() => isEditing = false} disabled={isSaving} class="flex-grow bg-cream hover:bg-sage/10 text-sage border-none py-3 rounded-2xl cursor-pointer font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1 shadow-sm">
                          Cancel
                      </button>
                      <button onclick={handleSave} disabled={isSaving} class="flex-grow bg-olive hover:bg-olive/90 text-white border-none py-3 rounded-2xl cursor-pointer font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1 shadow-sm">
                          {#if isSaving}
                              <Loader2 size={12} class="animate-spin" /> Saving
                          {:else}
                              <Save size={12} /> Save Changes
                          {/if}
                      </button>
                  </div>
              {:else}
                  <!-- Original Profile View -->
                  <div class="w-24 h-24 rounded-full border-4 border-paper bg-cream shadow-md overflow-hidden relative flex items-center justify-center text-3xl font-bold text-sage mb-4">
                      {#if user.avatarUrl || user.avatar}
                          <img src={user.avatarUrl || user.avatar} alt={user.name} class="w-full h-full object-cover" />
                      {:else}
                          <!-- Fallback avatar when not provided -->
                          <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} alt={user.name} class="w-full h-full object-cover" />
                      {/if}
                  </div>

                  <!-- Info -->
                  <h2 class="text-xl font-bold text-ink mb-1 tracking-tight">{user.name || 'Unknown User'}</h2>
                  {#if user.school}
                     <p class="text-xs font-bold uppercase tracking-widest text-sage mb-1">{user.school}</p>
                  {/if}
                  {#if user.role}
                     <p class="text-[10px] uppercase font-bold text-olive/70 mb-2">{user.role}</p>
                  {/if}
                  {#if user.bio}
                     <p class="text-xs text-ink/70 mb-4 px-2 italic">{user.bio}</p>
                  {/if}

                  <!-- Stats / Points -->
                  {#if user.points !== undefined}
                  <div class="flex items-center gap-1.5 bg-accent/10 px-3 py-1.5 rounded-full text-accent font-bold text-xs mb-4 mt-2">
                     <Zap size={14} />
                     {user.points} Points
                  </div>
                  {/if}

                  <!-- Extended Info -->
                  {#if user.studentClass || user.age || user.house || user.clubs || user.preferredSubjects}
                  <div class="w-full text-left bg-cream/30 border border-sage/10 p-3 rounded-2xl mb-6 space-y-2.5">
                     {#if user.studentClass}
                       <div class="flex justify-between items-center text-xs">
                         <span class="text-sage font-bold uppercase tracking-widest text-[9px]">Class</span>
                         <span class="text-ink font-bold">{user.studentClass}</span>
                       </div>
                     {/if}
                     {#if user.age}
                       <div class="flex justify-between items-center text-xs">
                         <span class="text-sage font-bold uppercase tracking-widest text-[9px]">Age</span>
                         <span class="text-ink font-bold">{user.age} Years</span>
                       </div>
                     {/if}
                     {#if user.house}
                       <div class="flex justify-between items-center text-xs">
                         <span class="text-sage font-bold uppercase tracking-widest text-[9px]">House</span>
                         <span class="text-ink font-bold truncate max-w-[150px] text-right">{user.house}</span>
                       </div>
                     {/if}
                     {#if user.preferredSubjects || user.subjectCombination}
                       <div class="flex flex-col gap-1 pt-1 border-t border-sage/10 mt-1">
                         <span class="text-sage font-bold uppercase tracking-widest text-[9px]">Academics</span>
                         {#if user.subjectCombination}
                            <span class="text-ink font-bold text-xs">{user.subjectCombination} (A-Level)</span>
                         {/if}
                         {#if user.preferredSubjects}
                            <span class="text-ink/80 font-medium text-[10px] leading-tight">{user.preferredSubjects}</span>
                         {/if}
                       </div>
                     {/if}
                     {#if user.clubs}
                       <div class="flex flex-col gap-1 pt-1 border-t border-sage/10 mt-1">
                         <span class="text-sage font-bold uppercase tracking-widest text-[9px]">Clubs & Societies</span>
                         <span class="text-ink/80 font-medium text-[10px] leading-tight">{user.clubs}</span>
                       </div>
                     {/if}
                  </div>
                  {/if}

                  <!-- Actions -->
                  <div class="w-full flex gap-3">
                      {#if isOwnProfile}
                      <button 
                          onclick={startEditing}
                          class="w-full bg-olive hover:bg-olive hover:text-white text-white border-none py-3 rounded-2xl cursor-pointer font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm"
                      >
                          <Edit2 size={14} /> Edit My Profile
                      </button>
                      {:else}
                      <button 
                          onclick={() => { handleClose(); onMessage(user); }}
                          class="flex-1 bg-olive/10 hover:bg-olive text-olive hover:text-white border-none py-3 rounded-2xl cursor-pointer font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm"
                      >
                          <MessageSquare size={14} /> Message
                      </button>
                      {#if !isComrade}
                      <button 
                          onclick={() => { if (!isInvited) { onInvite(user); } }}
                          disabled={isInvited}
                          class="flex-1 border-none py-3 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm {isInvited ? 'bg-olive/10 text-olive cursor-not-allowed' : 'bg-cream hover:bg-olive hover:text-white text-olive cursor-pointer'}"
                      >
                          {#if isInvited}
                              <span>Pending</span>
                          {:else}
                              <UserPlus size={14} /> Connect
                          {/if}
                      </button>
                      {:else}
                      <button 
                          onclick={() => { 
                              if (!confirmUnfriend) {
                                  confirmUnfriend = true;
                              } else {
                                  handleClose(); 
                                  onUnfriend(user); 
                              }
                          }}
                          class="flex-1 {confirmUnfriend ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-red-50 hover:bg-red-100 text-red-500'} border border-red-500/10 py-3 rounded-2xl cursor-pointer font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm"
                      >
                          {confirmUnfriend ? 'Confirm?' : 'Unfriend'}
                      </button>
                      {/if}
                      {/if}
                  </div>
              {/if}
          </div>
      </div>
  </div>
{/if}
