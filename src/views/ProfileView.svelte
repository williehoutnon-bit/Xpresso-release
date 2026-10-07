<script lang="ts">
  import { onMount } from 'svelte';
  import Skeleton from '../components/Skeleton.svelte';
  import { authService } from '../services/authService';
  import { mediaService } from '../services/mediaService';
  import { 
    ChevronLeft, LogOut, Settings, Bookmark, Trophy, MessageSquare, 
    School, Save, Flame, Edit2, Shield, Share2, Loader2, GraduationCap,
    Camera, ImageIcon, ImagePlus
  } from 'lucide-svelte';

  let { onback, onlogout, onviewbookmarks, onviewleaderboard, onviewmessages, onviewfeeds } = $props<{
    onback?: () => void;
    onlogout?: () => void;
    onnotes?: () => void;
    onviewbookmarks?: () => void;
    onviewleaderboard?: () => void;
    onviewmessages?: () => void;
    onviewfeeds?: () => void;
  }>();

  let user = $state<any>(null);
  let surname = $state('');
  let middleName = $state('');
  let lastName = $state('');
  let studentClass = $state('');
  let preferredSubjects = $state('');
  let subjectCombination = $state('');
  let age = $state('');
  let house = $state('');
  let clubs = $state('');
  let schoolInfo = $state('Not set');
  let district = $state('');
  let school = $state('');
  let bio = $state('');
  
  let isEditing = $state(false);
  let isLoading = $state(true);
  let twoFactorEnabled = $state(false);

  let fileInputRef: HTMLInputElement | undefined = $state(undefined);
  let isAvatarMenuOpen = $state(false);
  let uploadingAvatar = $state(false);

  const AVATAR_PRESETS = ['DevMoi', 'Willie', 'Leo', 'Mia', 'Sasha', 'Nate'];

  onMount(async () => {
    try {
      const result = await authService.getCurrentUser();
      if (result) {
        user = result;
        surname = user.prefs?.surname || '';
        middleName = user.prefs?.middle_name || user.prefs?.middleName || '';
        lastName = user.prefs?.last_name || user.prefs?.lastName || '';
        district = user.prefs?.district || '';
        school = user.prefs?.school || '';
        
        // Load extended profile data
        const profile = await authService.getProfile(user.id || user.$id, true);
        if (profile) {
            studentClass = profile.studentClass || '';
            preferredSubjects = profile.preferredSubjects || '';
            subjectCombination = profile.subjectCombination || '';
            age = profile.age || '';
            house = profile.house || '';
            clubs = profile.clubs || '';
            bio = profile.bio || '';
            user.avatarUrl = profile.avatarUrl || '';
        } else {
            studentClass = user.prefs?.grade_class || user.prefs?.studentClass || '';
            user.avatarUrl = user.prefs?.avatar_url || user.prefs?.avatarUrl || '';
        }
        
        schoolInfo = `${school}${district ? ' · ' + district : ''}`;
      }
    } catch (err) {
      console.error('ProfileView: Error fetching user', err);
    } finally {
      isLoading = false;
    }
  });

  async function handleSave() {
    try {
      isLoading = true;
      const fullName = `${surname.trim()} ${lastName.trim()}`.trim();
      const updated = await authService.updateProfile(user.id || user.$id, {
        fullName,
        school,
        bio,
        studentClass,
        age: age ? parseInt(age, 10) : undefined,
        house,
        preferredSubjects,
        subjectCombination,
        clubs,
        avatarUrl: user.avatarUrl || `https://api.dicebear.com/7.x/notionists/svg?seed=${surname}`
      });
      user.name = fullName;
      user.avatarUrl = updated.avatarUrl;
      schoolInfo = `${school}${district ? ' · ' + district : ''}`;
      isEditing = false;
    } catch (err) {
      console.error('Failed to update profile:', err);
    } finally {
      isLoading = false;
    }
  }

  async function handleFileUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      uploadingAvatar = true;
      const fileId = await mediaService.uploadFile(file);
      if (fileId) {
        const url = mediaService.getFileView(fileId);
        user.avatarUrl = url;
        // Optionally save immediately
        if(!isEditing) await handleSave();
      }
    } catch (err) {
      console.error("Avatar upload failed:", err);
      alert("Failed to upload image. " + (err as Error).message);
    } finally {
      uploadingAvatar = false;
      isAvatarMenuOpen = false;
      if (input) input.value = ''; // reset
    }
  }

  function handlePresetSelect(seed: string) {
    const url = seed === 'DevMoi' || seed === 'Nate' 
      ? `https://api.dicebear.com/7.x/notionists/svg?seed=${seed}` 
      : `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
    user.avatarUrl = url;
    isAvatarMenuOpen = false;
    if(!isEditing) handleSave();
  }
</script>

<div class="h-full bg-theme-paper flex flex-col overflow-y-auto pb-24 font-sans text-[#202936]">
  <!-- Header -->
  <header class="px-6 py-4 flex items-center justify-between sticky top-0 bg-theme-card/80 backdrop-blur-md z-20 border-b border-black/5 shadow-sm">
    <button onclick={() => onback?.()} class="p-2 -ml-2 text-slate-400 bg-theme-card border border-black/5 cursor-pointer hover:text-[#202936] transition-colors flex items-center justify-center w-10 h-10 rounded-full shadow-sm">
      <ChevronLeft size={20} />
    </button>
    <h2 class="text-sm font-extrabold text-[#202936] tracking-wider uppercase">Profile</h2>
    <button onclick={() => isEditing ? handleSave() : isEditing = true} class="p-2 -mr-2 bg-theme-card text-slate-400 border border-black/5 cursor-pointer hover:text-[#E58A3A] transition-colors flex items-center justify-center w-10 h-10 rounded-full shadow-sm">
      {#if isEditing}
        <Save size={20} class="text-[#E58A3A]" />
      {:else}
        <Edit2 size={20} />
      {/if}
    </button>
  </header>

  {#if isLoading}
    <div class="flex-1 p-6 space-y-6">
      <Skeleton variant="profile" />
      <Skeleton variant="rectangular" height="120px" count={2} />
    </div>
  {:else if !user}
    <div class="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div class="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4 border border-red-100">
        <LogOut size={24} />
      </div>
      <h3 class="text-lg font-bold text-[#202936] mb-2">Session Error</h3>
      <p class="text-sm text-slate-500 mb-6">We couldn't load your profile. Please check your Appwrite platforms configuration.</p>
      <button onclick={onback} class="px-6 py-3 bg-[#202936] text-white rounded-full font-bold shadow-sm hover:opacity-90 transition-colors">
        Go Back
      </button>
    </div>
  {:else}
    <div class="px-6 pt-8 pb-4">
      
      <!-- Avatar Section -->
      <div class="flex flex-col items-center relative mb-8">
        <div class="relative group">
          <div class="w-28 h-28 rounded-full border-4 border-white bg-slate-100 shadow-sm overflow-hidden relative flex items-center justify-center text-4xl font-extrabold text-slate-300">
            {#if uploadingAvatar}
              <Loader2 class="animate-spin text-[#E58A3A]" size={32} />
            {:else if user.avatarUrl || user.avatar || user.prefs?.avatarUrl}
              <img src={user.avatarUrl || user.avatar || user.prefs?.avatarUrl} alt={surname} class="w-full h-full object-cover" />
            {:else}
              <div class="w-full h-full bg-[#202936] text-white flex items-center justify-center font-bold">
                 {(lastName || surname || 'U').substring(0, 1).toUpperCase()}
              </div>
            {/if}
          </div>
          
          <button 
            onclick={() => isAvatarMenuOpen = !isAvatarMenuOpen}
            disabled={uploadingAvatar}
            class="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-[#E58A3A] border-4 border-white cursor-pointer flex items-center justify-center text-white shadow-sm hover:scale-105 transition-transform disabled:opacity-50"
          >
            <Camera size={16} />
          </button>
        </div>

        {#if isAvatarMenuOpen}
          <div class="absolute top-[120px] bg-theme-card border border-black/5 rounded-[20px] shadow-lg p-4 z-30 w-[280px] animate-in fade-in slide-in-from-top-2">
            <h4 class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3 text-center">Change Avatar</h4>
            
            <div class="grid grid-cols-3 gap-2 mb-4">
              {#each AVATAR_PRESETS as seed}
                {@const url = seed === 'DevMoi' || seed === 'Nate' 
                  ? `https://api.dicebear.com/7.x/notionists/svg?seed=${seed}` 
                  : `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`}
                <button
                  type="button"
                  onclick={() => handlePresetSelect(seed)}
                  class="aspect-square rounded-full overflow-hidden border-2 transition-all p-0.5 cursor-pointer hover:scale-105 {user.avatarUrl === url ? 'border-[#E58A3A] bg-orange-50' : 'border-transparent bg-slate-50 hover:bg-slate-100'}"
                >
                  <img src={url} alt={seed} class="w-full h-full object-cover rounded-full" />
                </button>
              {/each}
            </div>

            <div class="flex flex-col gap-2 relative">
              <input 
                type="file" 
                accept="image/*" 
                class="hidden" 
                bind:this={fileInputRef}
                onchange={handleFileUpload}
              />
              <button 
                onclick={() => fileInputRef?.click()}
                class="w-full flex items-center justify-center gap-2 py-3 bg-slate-50 hover:bg-slate-100 text-[#202936] rounded-[14px] text-xs font-bold transition-colors cursor-pointer border border-black/5"
              >
                <ImagePlus size={16} /> Upload Photo
              </button>
              <button 
                onclick={() => isAvatarMenuOpen = false}
                class="w-full flex items-center justify-center py-2 text-slate-400 hover:text-slate-600 rounded-[14px] text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
          <!-- Backdrop -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="fixed inset-0 z-20" onclick={() => isAvatarMenuOpen = false}></div>
        {/if}
      </div>

      {#if isEditing}
        <!-- Edit Profile Form -->
        <div class="w-full space-y-5 bg-theme-card p-6 rounded-[24px] border border-black/5 shadow-sm">
          <div class="text-center mb-4">
            <h4 class="text-lg font-extrabold text-[#202936]">Edit Information</h4>
            <p class="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-1">Update your display details</p>
          </div>
          
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <label class="text-[9px] font-extrabold text-[#E58A3A] uppercase tracking-widest ml-1">Surname</label>
                <input 
                  type="text" 
                  bind:value={surname}
                  placeholder="Surname"
                  class="w-full bg-theme-paper border border-black/5 rounded-[16px] py-3 px-4 text-sm text-[#202936] focus:ring-1 focus:ring-[#E58A3A] outline-none font-bold"
                />
              </div>
              <div class="space-y-1.5">
                <label class="text-[9px] font-extrabold text-[#E58A3A] uppercase tracking-widest ml-1">Given Name</label>
                <input 
                  type="text" 
                  bind:value={lastName}
                  placeholder="Last Name"
                  class="w-full bg-theme-paper border border-black/5 rounded-[16px] py-3 px-4 text-sm text-[#202936] focus:ring-1 focus:ring-[#E58A3A] outline-none font-bold"
                />
              </div>
            </div>

            <div class="space-y-1.5">
              <label class="text-[9px] font-extrabold text-[#E58A3A] uppercase tracking-widest ml-1">Short Bio</label>
              <textarea 
                bind:value={bio}
                placeholder="Tell people about yourself..."
                rows="2"
                class="w-full bg-theme-paper border border-black/5 rounded-[16px] py-3 px-4 text-sm text-[#202936] focus:ring-1 focus:ring-[#E58A3A] outline-none font-medium resize-none"
              ></textarea>
            </div>

            <div class="grid grid-cols-2 gap-4 border-t border-black/5 pt-4">
              <div class="space-y-1.5">
                <label class="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">School</label>
                <input 
                  type="text" 
                  bind:value={school}
                  placeholder="School name"
                  class="w-full bg-theme-paper border border-black/5 rounded-[16px] py-3 px-4 text-xs text-[#202936] focus:ring-1 focus:ring-[#E58A3A] outline-none font-medium"
                />
              </div>
              <div class="space-y-1.5">
                <label class="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">District</label>
                <input 
                  type="text" 
                  bind:value={district}
                  placeholder="District"
                  class="w-full bg-theme-paper border border-black/5 rounded-[16px] py-3 px-4 text-xs text-[#202936] focus:ring-1 focus:ring-[#E58A3A] outline-none font-medium"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4 border-t border-black/5 pt-4">
              <div class="space-y-1.5">
                <label class="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">Class/Level</label>
                <input 
                  type="text" 
                  bind:value={studentClass}
                  placeholder="e.g. S4"
                  class="w-full bg-theme-paper border border-black/5 rounded-[16px] py-3 px-4 text-xs text-[#202936] focus:ring-1 focus:ring-[#E58A3A] outline-none font-medium"
                />
              </div>
              <div class="space-y-1.5">
                <label class="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">Age</label>
                <input 
                  type="text" 
                  bind:value={age}
                  placeholder="Age"
                  class="w-full bg-theme-paper border border-black/5 rounded-[16px] py-3 px-4 text-xs text-[#202936] focus:ring-1 focus:ring-[#E58A3A] outline-none font-medium"
                />
              </div>
            </div>

            <div class="space-y-1.5 border-t border-black/5 pt-4">
              <label class="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">House (Optional)</label>
              <input 
                type="text" 
                bind:value={house}
                placeholder="e.g. Red House"
                class="w-full bg-theme-paper border border-black/5 rounded-[16px] py-3 px-4 text-xs text-[#202936] focus:ring-1 focus:ring-[#E58A3A] outline-none font-medium"
              />
            </div>

            <div class="grid grid-cols-2 gap-4 border-t border-black/5 pt-4">
              <div class="space-y-1.5">
                <label class="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">Combination</label>
                <input 
                  type="text" 
                  bind:value={subjectCombination}
                  placeholder="e.g. PCM/ICT"
                  class="w-full bg-theme-paper border border-black/5 rounded-[16px] py-3 px-4 text-xs text-[#202936] focus:ring-1 focus:ring-[#E58A3A] outline-none font-medium"
                />
              </div>
              <div class="space-y-1.5">
                <label class="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">Best Subjects</label>
                <input 
                  type="text" 
                  bind:value={preferredSubjects}
                  placeholder="e.g. Math, Physics"
                  class="w-full bg-theme-paper border border-black/5 rounded-[16px] py-3 px-4 text-xs text-[#202936] focus:ring-1 focus:ring-[#E58A3A] outline-none font-medium"
                />
              </div>
            </div>

            <div class="space-y-1.5 border-t border-black/5 pt-4">
              <label class="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest ml-1">Clubs & Societies</label>
              <input 
                type="text" 
                bind:value={clubs}
                placeholder="e.g. Debate club, Writers"
                class="w-full bg-theme-paper border border-black/5 rounded-[16px] py-3 px-4 text-xs text-[#202936] focus:ring-1 focus:ring-[#E58A3A] outline-none font-medium"
              />
            </div>
            
            <button 
              onclick={handleSave} 
              class="w-full mt-4 py-4 bg-[#E58A3A] text-white rounded-[16px] shadow-sm font-extrabold uppercase tracking-[0.1em] text-xs hover:shadow-md transition-all active:scale-95 cursor-pointer border-none"
            >
              Save Changes
            </button>
          </div>
        </div>
      {:else}
        <!-- View Profile Mode -->
        <div class="text-center">
          <h3 class="text-2xl font-extrabold text-[#202936] tracking-tight">{surname} {lastName}</h3>
          
          <div class="flex flex-wrap items-center justify-center gap-2 mt-3">
             <div class="text-[10px] text-[#202936] font-bold uppercase tracking-widest bg-theme-card px-4 py-2 rounded-full border border-black/5 flex items-center gap-2 shadow-sm">
               <School size={12} class="text-[#E58A3A]" /> {school || 'Independent'}
             </div>
             {#if studentClass}
               <div class="text-[10px] text-white font-bold uppercase tracking-widest bg-[#202936] px-3 py-2 rounded-full shadow-sm flex items-center gap-2">
                 <GraduationCap size={12} class="text-[#E58A3A]" /> {studentClass}
               </div>
             {/if}
          </div>
          
          {#if district}
            <p class="text-[10px] text-slate-400 font-extrabold uppercase tracking-[0.15em] mt-4 flex items-center justify-center gap-1">
               <span class="w-1 h-1 bg-[#E58A3A] rounded-full"></span> {district} Region
            </p>
          {/if}
          
          {#if bio}
            <div class="mt-6 mx-auto max-w-sm border-t border-black/5 pt-6">
              <p class="text-[13px] text-slate-600 font-medium italic leading-relaxed px-4">"{bio}"</p>
            </div>
          {/if}
        </div>

        {#if age || house || preferredSubjects || subjectCombination || clubs}
          <!-- Extra Student Info Card -->
          <div class="mt-8 bg-theme-card border border-black/5 rounded-[24px] overflow-hidden shadow-sm">
            <div class="bg-[#202936] py-3 px-5 border-b border-black/5">
              <h4 class="text-[10px] font-extrabold text-white uppercase tracking-widest flex items-center gap-2">
                <Bookmark size={12} class="text-[#E58A3A]" /> Student Profile
              </h4>
            </div>
            <div class="p-5 space-y-4">
              {#if age}
                <div class="flex justify-between items-center text-xs border-b border-black/5 pb-3">
                  <span class="text-slate-400 font-extrabold uppercase tracking-widest text-[9px]">Age</span>
                  <span class="text-[#202936] font-bold">{age} Years</span>
                </div>
              {/if}
              {#if house}
                <div class="flex justify-between items-center text-xs border-b border-black/5 pb-3">
                  <span class="text-slate-400 font-extrabold uppercase tracking-widest text-[9px]">House</span>
                  <span class="text-[#202936] font-bold truncate max-w-[150px]">{house}</span>
                </div>
              {/if}
              {#if subjectCombination}
                <div class="flex justify-between items-center text-xs border-b border-black/5 pb-3">
                  <span class="text-slate-400 font-extrabold uppercase tracking-widest text-[9px]">Combination</span>
                  <span class="text-[#202936] font-bold">{subjectCombination}</span>
                </div>
              {/if}
              {#if preferredSubjects}
                <div class="flex flex-col text-xs border-b border-black/5 pb-3 gap-1">
                  <span class="text-slate-400 font-extrabold uppercase tracking-widest text-[9px]">Favorite Subjects</span>
                  <span class="text-[#202936] font-bold">{preferredSubjects}</span>
                </div>
              {/if}
              {#if clubs}
                <div class="flex flex-col text-xs gap-1 pt-1">
                  <span class="text-slate-400 font-extrabold uppercase tracking-widest text-[9px]">Clubs & Societies</span>
                  <span class="text-[#202936] font-bold leading-snug">{clubs}</span>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      {/if}
      
      <!-- Stats Overview -->
      <div class="flex border border-black/5 rounded-[24px] bg-theme-card shadow-sm overflow-hidden mt-8 divide-x divide-black/5">
         <div class="flex-1 text-center py-5">
            <div class="text-2xl font-extrabold text-[#202936] flex items-center justify-center gap-1">14 <Flame size={20} class="text-[#E58A3A]" /></div>
            <div class="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest mt-2">Streak</div>
         </div>
         <div class="flex-1 text-center py-5">
            <div class="text-2xl font-extrabold text-[#202936]">47</div>
            <div class="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest mt-2">Qs Done</div>
         </div>
         <div class="flex-1 text-center py-5">
            <div class="text-2xl font-extrabold text-[#202936]">84</div>
            <div class="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest mt-2">Points</div>
         </div>
      </div>

      <!-- Settings & Navigation -->
      <div class="mt-8 space-y-3">
        <h4 class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-2 mb-2">Account Actions</h4>
        
        <button onclick={() => onviewbookmarks?.()} class="w-full bg-theme-card cursor-pointer flex items-center justify-between p-4 rounded-[20px] border border-black/5 hover:border-black/20 transition-all shadow-sm group border-b-2">
          <div class="flex items-center gap-4">
            <div class="w-8 h-8 rounded-[10px] bg-indigo-50 text-indigo-500 flex items-center justify-center"><Bookmark size={16} /></div>
            <span class="text-[11px] font-extrabold text-[#202936] uppercase tracking-wide">Bookmarks & Notes</span>
          </div>
          <ChevronLeft size={16} class="text-slate-400 rotate-180" />
        </button>
        
        <button onclick={() => onviewleaderboard?.()} class="w-full bg-theme-card cursor-pointer flex items-center justify-between p-4 rounded-[20px] border border-black/5 hover:border-black/20 transition-all shadow-sm group border-b-2">
          <div class="flex items-center gap-4">
            <div class="w-8 h-8 rounded-[10px] bg-yellow-50 text-yellow-500 flex items-center justify-center"><Trophy size={16} /></div>
            <span class="text-[11px] font-extrabold text-[#202936] uppercase tracking-wide">Global Leaderboard</span>
          </div>
          <ChevronLeft size={16} class="text-slate-400 rotate-180" />
        </button>
        
        <button onclick={() => onviewmessages?.()} class="w-full bg-theme-card cursor-pointer flex items-center justify-between p-4 rounded-[20px] border border-black/5 hover:border-black/20 transition-all shadow-sm group border-b-2">
          <div class="flex items-center gap-4">
            <div class="w-8 h-8 rounded-[10px] bg-blue-50 text-blue-500 flex items-center justify-center"><MessageSquare size={16} /></div>
            <span class="text-[11px] font-extrabold text-[#202936] uppercase tracking-wide">Inbox & Messages</span>
          </div>
          <ChevronLeft size={16} class="text-slate-400 rotate-180" />
        </button>
        
        <button onclick={() => onviewfeeds?.()} class="w-full flex items-center bg-theme-card cursor-pointer justify-between p-4 rounded-[20px] border border-black/5 hover:border-black/20 transition-all shadow-sm group border-b-2">
          <div class="flex items-center gap-4">
            <div class="w-8 h-8 rounded-[10px] bg-green-50 text-green-500 flex items-center justify-center"><School size={16} /></div>
            <span class="text-[11px] font-extrabold text-[#202936] uppercase tracking-wide">Community Hub</span>
          </div>
          <ChevronLeft size={16} class="text-slate-400 rotate-180" />
        </button>
      </div>

      <div class="flex items-center justify-between p-5 bg-theme-card rounded-[20px] border border-black/5 shadow-sm mt-4">
        <div class="flex items-center gap-4">
          <div class="text-slate-400"><Shield size={18} /></div>
          <span class="text-[11px] font-extrabold text-[#202936] uppercase tracking-wide">Two-Factor Auth</span>
        </div>
        <button 
          onclick={() => twoFactorEnabled = !twoFactorEnabled}
          aria-label="Toggle Two-Factor Authentication"
          class="w-10 h-6 rounded-full flex items-center p-1 border-none cursor-pointer transition-colors {twoFactorEnabled ? 'bg-[#E58A3A]' : 'bg-slate-200'}"
        >
          <div class="bg-theme-card w-4 h-4 rounded-full shadow-sm transform transition-transform {twoFactorEnabled ? 'translate-x-4' : 'translate-x-0'}"></div>
        </button>
      </div>
      
      <button 
        onclick={() => onlogout?.()}
        class="w-full mt-10 bg-theme-card flex cursor-pointer items-center justify-center gap-2 py-4 text-red-500 font-extrabold uppercase tracking-widest text-[10px] rounded-[20px] border border-red-100 hover:bg-red-50 transition-colors shadow-sm"
      >
        <LogOut size={16} />
        Log Out
      </button>

    </div>
  {/if}
</div>
