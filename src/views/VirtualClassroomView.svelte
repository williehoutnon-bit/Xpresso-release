<script lang="ts">
  import { 
    Mic, MicOff, Users as UsersIcon, 
    Hand, X, PhoneOff, Sparkles, Send, Image as ImageIcon, Volume2, Type, Monitor
  } from 'lucide-svelte';
  import { triggerNotification } from '../services/notificationService';
  import { authService } from '../services/authService';
  import { friendshipService } from '../services/friendshipService';
  import { onMount } from 'svelte';

  let { 
    role = 'student', 
    className = 'Live Session', 
    onleave 
  } = $props<{ 
    role?: 'teacher' | 'student'; 
    className?: string; 
    onleave?: () => void;
  }>();

  let currentUserName = $state('You');
  let currentUserAvatar = $state('');

  let micOn = $state(true);
  const initialActiveTab = 'chat';
  let activeTab = $state<'chat' | 'participants'>(initialActiveTab);
  const initialBoardMode = role === 'teacher' ? 'text' : 'audio';
  let boardMode = $state<'audio' | 'image' | 'text'>(initialBoardMode);
  let handRaised = $state(false);

  let chatMessage = $state('');
  let studentChatMessage = $state('');

  let sharedImage = $state<string | null>(null);
  let showClassList = $state(false);

  let participants = $state<any[]>([]);

  onMount(async () => {
    try {
      const u = await authService.getCurrentUser();
      let friends: any[] = [];
      const leader = await friendshipService.getLeaderboard(7);
      friends = leader || [];
      
      const generatedParticipants = [];
      if (role === 'teacher') {
         generatedParticipants.push({ id: '1', name: 'You (Host)', avatar: '', role: 'Host', micOn: true, handRaised: false });
         friends.forEach((f, idx) => {
             generatedParticipants.push({
                 id: String(idx + 2),
                 name: f.name,
                 avatar: f.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${f.name}`,
                 role: 'Student',
                 micOn: false,
                 handRaised: Math.random() > 0.7
             });
         });
      } else {
         generatedParticipants.push({ id: '1', name: 'Dr. Simon Okello (Host)', avatar: 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?auto=format&fit=crop&q=80&w=150&h=150', role: 'Host', micOn: true, handRaised: false });
         generatedParticipants.push({ id: '2', name: 'You', avatar: '', role: 'Student', micOn: true, handRaised: false });
         friends.slice(0, 6).forEach((f, idx) => {
             generatedParticipants.push({
                 id: String(idx + 3),
                 name: f.name,
                 avatar: f.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${f.name}`,
                 role: 'Student',
                 micOn: false,
                 handRaised: Math.random() > 0.7
             });
         });
      }
      participants = generatedParticipants;

      if (u) {
        const p = await authService.getProfile(u.$id);
        const fullName = p?.fullName || u.prefs?.lastName || u.name || 'You';
        const avatarUrl = p?.avatarUrl || u.prefs?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${fullName}`;
        currentUserName = fullName;
        currentUserAvatar = avatarUrl;
        
        if (role === 'teacher') {
          participants = participants.map(part => {
             if (part.id === '1') {
                return { ...part, name: `${fullName} (You)`, avatar: avatarUrl };
             }
             return part;
          });
        } else {
          participants = participants.map(part => {
             if (part.id === '2') {
                return { ...part, name: `${fullName} (You)`, avatar: avatarUrl };
             }
             return part;
          });
        }
      }
    } catch (err) {
      console.error('VirtualClassroomView profile load error:', err);
    }
  });

  let selectedStudent = $state<string | null>(null);

  const selectedStudentObj = $derived(participants.find(p => p.id === selectedStudent));

  const mockSubmissions = [
    { id: 'sub1', type: 'text', prompt: 'Q1: What is the primary function of the ribosome?', answer: 'The ribosome is a cellular particle made of RNA and protein that serves as the site for protein synthesis in the cell.', time: '10:05 AM', status: 'graded', points: '5/5' },
    { id: 'sub2', type: 'image', prompt: 'Q2: Upload a diagram of an animal cell labeling the Mitochondria.', answer: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&q=80&w=400', time: '10:15 AM', status: 'pending' },
    { id: 'sub3', type: 'text', prompt: 'Q3: Explain the process of osmosis.', answer: 'Osmosis is the net movement of water molecules from a region of higher water potential to a region of lower water potential, through a partially permeable membrane.', time: '10:25 AM', status: 'pending' },
  ];

  let messages = $state<{sender: string, text: string, type: 'user' | 'system', time: string}[]>([
    { sender: 'System', text: 'Audio session started.', type: 'system', time: '10:00 AM' },
  ]);

  const toggleHand = () => {
    handRaised = !handRaised;
    if (role === 'student') {
      participants = participants.map(p => 
        p.id === '2' ? { ...p, handRaised: handRaised } : p
      );
    }
  };

  const toggleStudentMic = (id: string) => {
    participants = participants.map(p => p.id === id ? { ...p, micOn: !p.micOn, handRaised: false } : p);
  };

  const lowerStudentHand = (id: string) => {
    participants = participants.map(p => p.id === id ? { ...p, handRaised: false } : p);
  };

  const selectStudent = (id: string) => {
    selectedStudent = id;
    showClassList = false;
  };

  const handleShareImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          sharedImage = event.target?.result as string;
          boardMode = 'image';
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const toggleImageMode = () => {
    if (boardMode === 'image') boardMode = 'audio';
    else { 
      boardMode = 'image'; 
      if (!sharedImage) handleShareImage(); 
    }
  };

  const openImage = () => {
    boardMode = 'image'; 
    if (!sharedImage) handleShareImage(); 
  }

  const handleToggleMic = async () => {
    if (!micOn) {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        micOn = true;
      } catch (err) {
        console.error("Microphone access denied or error:", err);
      }
    } else {
      micOn = false;
    }
  };

  const sendMessage = () => {
    if (chatMessage.trim()) {
      messages = [...messages, { 
        sender: currentUserName ? `${currentUserName} (You)` : (role === 'teacher' ? 'Dr. Simon (You)' : 'Sarah N. (You)'), 
        text: chatMessage, 
        type: 'user', 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      }];
      chatMessage = '';
    }
  };

  const sendStudentMessage = () => {
    if (studentChatMessage.trim()) {
      messages = [...messages, { 
        sender: currentUserName ? `${currentUserName} (You)` : (role === 'teacher' ? 'Dr. Simon (You)' : 'Sarah N. (You)'), 
        text: studentChatMessage, 
        type: 'user', 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      }];
      studentChatMessage = '';
    }
  };

  const sortedParticipants = $derived([...participants].sort((a, b) => {
    if (a.role === 'Host' && b.role !== 'Host') return -1;
    if (a.role !== 'Host' && b.role === 'Host') return 1;
    if (a.handRaised && !b.handRaised) return -1;
    if (!a.handRaised && b.handRaised) return 1;
    return a.name.localeCompare(b.name);
  }));
</script>

<div class="h-screen w-full flex flex-col bg-[#0F1115] text-paper overflow-hidden font-sans">
  <header class="px-4 py-3 bg-black/40 flex items-center justify-between z-20 backdrop-blur-md shrink-0 border-b border-white/10">
    <div class="flex flex-col">
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-accent animate-pulse" ></span>
        <h2 class="text-sm font-bold text-white m-0">{className}</h2>
      </div>
      <span class="text-[10px] text-white/50 uppercase tracking-widest font-bold">
        00:45:12 • Biology Post-Mock Review
      </span>
    </div>
    
    <div class="flex items-center gap-3">
      <div class="px-3 py-1 bg-theme-card/10 rounded-full text-[10px] text-white font-bold uppercase tracking-widest flex items-center gap-1">
        <UsersIcon size={12} /> {participants.length}
      </div>
    </div>
  </header>

  <div class="flex-1 relative flex flex-col md:flex-row overflow-hidden min-h-0">
    <!-- Main Stage (Board/Audio) -->
    <div class="flex-[2] relative bg-black flex items-center justify-center p-4 md:p-8 overflow-hidden min-h-[45vh] md:min-h-0">
      
      {#if role === 'teacher' && !showClassList && participants.some(p => p.handRaised)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="absolute top-4 right-4 z-50 bg-accent text-white px-4 py-3 rounded-[20px] shadow-2xl flex items-center gap-3 cursor-pointer" onclick={() => showClassList = true}>
        <div class="bg-theme-card/20 p-2 rounded-full animate-pulse">
          <Hand size={18} />
        </div>
        <div>
          <p class="text-xs font-bold m-0">{participants.filter(p => p.handRaised).length} student(s) raised hand</p>
          <p class="text-[10px] text-white/80 m-0">Tap to view class attendees</p>
        </div>
      </div>
      {/if}

      {#if boardMode === 'image' && sharedImage}
      <div class="w-full h-full bg-olive/10 rounded-[20px] border border-white/10 relative overflow-hidden flex flex-col items-center justify-center p-4">
         <img 
           src={sharedImage} 
           alt="Board"
           class="w-full h-full object-contain drop-shadow-2xl"
           referrerpolicy="no-referrer"
         />
         <div class="absolute bottom-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-[20px] text-xs font-bold border border-white/20 text-white flex items-center gap-2">
           <ImageIcon size={14} class="text-olive" /> Shared Image
         </div>
       </div>
       {:else if boardMode === 'text'}
       <div class="w-full h-full bg-olive/10 rounded-[20px] border border-white/10 relative overflow-hidden flex flex-col p-4 md:p-8 pb-24 md:pb-32">
          <div class="absolute top-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-[20px] text-[10px] md:text-xs font-bold border border-white/20 text-white md:flex items-center gap-2 z-10 hidden">
            <Type size={14} class="text-olive" /> Whiteboard History
          </div>
          
          <div class="flex-1 overflow-y-auto space-y-4 md:space-y-6 flex flex-col justify-end pb-4 min-h-0">
            {#each messages as msg, idx (idx)}
            <div class="{msg.type === 'system' ? 'text-center' : ''}">
              {#if msg.type === 'system'}
              <span class="text-[10px] md:text-xs font-bold uppercase tracking-widest text-olive/80 bg-olive/10 px-3 py-1 rounded-full">
                {msg.text}
              </span>
              {:else}
              <div class="flex flex-col">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-[10px] md:text-xs font-bold text-white/50">{msg.sender}</span>
                  <span class="text-[8px] md:text-[10px] text-white/30">{msg.time}</span>
                </div>
                <span class="text-lg md:text-2xl lg:text-3xl text-white font-bold leading-relaxed">{msg.text}</span>
              </div>
              {/if}
            </div>
            {/each}
          </div>

          {#if role === 'teacher'}
          <div class="mt-4 flex items-center gap-2 bg-black/40 border border-white/10 rounded-[20px] p-2 z-10 w-full max-w-3xl mx-auto shadow-xl shrink-0">
            <input 
              type="text" 
              bind:value={chatMessage}
              onkeyup={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type on board..." 
              class="flex-1 bg-transparent border-none text-sm text-white px-4 py-2 outline-none"
            />
            <button 
              onclick={sendMessage}
              class="p-3 bg-olive border-none cursor-pointer rounded-[20px] text-white hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <Type size={16} /> <span class="hidden md:inline text-xs font-bold">Write</span>
            </button>
          </div>
          {/if}
       </div>
       {:else}
      <div class="w-full max-w-md bg-theme-card/5 border border-white/10 rounded-[20px] p-8 flex flex-col items-center text-center">
         <div class="w-32 h-32 rounded-full border-4 border-olive/30 relative flex items-center justify-center mb-6">
            <div class="absolute inset-0 rounded-full border border-olive/50 animate-ping" style="animation-duration: 3s;"></div>
            <div class="absolute inset-2 rounded-full border border-olive/40 animate-ping" style="animation-duration: 2s;"></div>
            <div class="absolute inset-4 rounded-full border border-olive/60 bg-olive flex items-center justify-center z-10 text-white shadow-xl shadow-olive/20">
               <Volume2 size={40} />
            </div>
         </div>
         <h3 class="text-xl font-bold text-white mb-2 tracking-wide text-balance m-0">
            Audio Room Active
         </h3>
         <p class="text-sm text-white/50 mb-8 max-w-[250px] m-0 mt-2">
            {role === 'teacher' ? 'You are broadcasting audio to the class.' : 'Listen carefully. Raise your hand to speak.'}
         </p>
         
         {#if role === 'teacher'}
         <div class="flex gap-4">
           <button 
            onclick={openImage}
            class="px-6 py-3 cursor-pointer bg-theme-card/10 hover:bg-theme-card/20 transition-colors rounded-[20px] text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2 border border-white/10"
           >
              <ImageIcon size={16} /> Share Image
           </button>
           <button 
            onclick={() => boardMode = 'text'}
            class="px-6 py-3 cursor-pointer bg-theme-card/10 hover:bg-theme-card/20 transition-colors rounded-[20px] text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2 border border-white/10"
           >
              <Type size={16} /> Open Whiteboard
           </button>
         </div>
         {/if}
      </div>
      {/if}
    </div>

    <!-- Participant Sidebar (Split-view on desktop, stacked on mobile) -->
    <div class="w-full md:w-80 h-1/2 md:h-full bg-[#111319] border-t md:border-t-0 md:border-l border-white/10 flex flex-col shrink-0">
         <div class="flex border-b border-white/10 shrink-0">
           <button 
             onclick={() => activeTab = 'chat'}
             class="flex-1 py-3 text-[10px] border-none cursor-pointer bg-transparent font-bold uppercase tracking-widest transition-colors {activeTab === 'chat' ? 'text-[#E58A3A] bg-theme-card/5 border-b-2 border-[#E58A3A]' : 'text-white/50 hover:bg-theme-card/5'}"
           >
             Chat
           </button>
           <button 
             onclick={() => activeTab = 'participants'}
             class="flex-1 py-3 text-[10px] border-none cursor-pointer bg-transparent font-bold uppercase tracking-widest transition-colors {activeTab === 'participants' ? 'text-[#E58A3A] bg-theme-card/5 border-b-2 border-[#E58A3A]' : 'text-white/50 hover:bg-theme-card/5'}"
           >
             People ({participants.length})
           </button>
         </div>

         {#if activeTab === 'chat'}
           <div class="flex-1 overflow-y-auto p-4 space-y-4">
              {#each messages as msg, idx (idx)}
              <div class="{msg.type === 'system' ? 'text-center' : ''}">
                {#if msg.type === 'system'}
                <span class="text-[9px] font-bold uppercase tracking-widest text-accent/80 bg-accent/10 px-2 py-1 rounded-full">
                  {msg.text}
                </span>
                {:else}
                <div class="flex flex-col {msg.sender.includes('(You)') ? 'items-end' : 'items-start'}">
                  <div class="flex items-baseline gap-2 mb-1">
                    <span class="text-[10px] font-bold text-white/70">{msg.sender}</span>
                    <span class="text-[8px] text-white/40">{msg.time}</span>
                  </div>
                  <div class="p-3 rounded-[20px] text-xs max-w-[85%] {msg.sender.includes('(You)') ? 'bg-olive text-white rounded-tr-sm' : 'bg-theme-card/10 text-white rounded-tl-sm'}">
                    {msg.text}
                  </div>
                </div>
                {/if}
              </div>
              {/each}
           </div>
           <div class="p-4 border-t border-white/10 bg-black/20 shrink-0">
             <div class="flex items-center gap-2 bg-theme-card/5 border border-white/10 rounded-full p-1 pr-2">
               <input 
                 type="text" 
                 bind:value={studentChatMessage}
                 onkeyup={(e) => e.key === 'Enter' && sendStudentMessage()}
                 placeholder="Send message..." 
                 class="flex-1 bg-transparent border-none text-xs text-white px-3 py-2 outline-none"
               />
               <button 
                 onclick={sendStudentMessage}
                 class="p-2 border-none cursor-pointer bg-[#E58A3A] rounded-full text-white hover:opacity-90 transition-opacity"
               >
                 <Send size={14} />
               </button>
             </div>
           </div>
         {:else}
           <!-- Participant Pane list showing Raised Hands and All Students -->
           <div class="flex-1 overflow-y-auto flex flex-col divide-y divide-white/5 min-h-0">
             
             <!-- Raised Hands Pane (MUST appear ABOVE the general All Students list) -->
             <div class="flex flex-col shrink-0 col-span-1">
                <div class="px-4 py-2.5 bg-accent/10 border-b border-accent/15 flex items-center justify-between">
                   <span class="text-[10px] font-extrabold text-accent flex items-center gap-1.5 uppercase tracking-wider">
                      <Hand class="w-3.5 h-3.5 shrink-0 animate-bounce" /> Raised Hands (🚨)
                   </span>
                   <span class="text-[9px] px-1.5 py-0.5 bg-accent/25 text-white font-bold rounded-full">
                      {participants.filter(p => p.handRaised).length}
                   </span>
                </div>
                
                <div class="p-2 space-y-1.5">
                   {#if participants.filter(p => p.handRaised).length === 0}
                      <p class="text-center text-[10px] text-white/30 py-3 font-medium">No students flagging for help</p>
                   {:else}
                      {#each participants.filter(p => p.handRaised) as p (p.id)}
                         <div class="flex items-center justify-between p-2 bg-theme-card/5 rounded-xl border border-white/5 hover:bg-theme-card/10 transition-colors">
                            <!-- svelte-ignore a11y_click_events_have_key_events -->
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <div 
                              class="flex items-center gap-2.5 min-w-0 cursor-pointer"
                              onclick={() => { if (role === 'teacher') selectStudent(p.id); }}
                            >
                               <img src={p.avatar} alt={p.name} class="w-7 h-7 rounded-full object-cover shadow border border-white/10" />
                               <span class="text-xs font-bold text-white truncate max-w-[100px]">{p.name}</span>
                            </div>
                            
                            <div class="flex items-center gap-1">
                               {#if role === 'teacher'}
                                  <button 
                                     onclick={() => toggleStudentMic(p.id)}
                                     class="px-2 py-1 bg-accent hover:bg-orange-600 transition-colors border-none cursor-pointer text-[8px] font-extrabold uppercase tracking-widest text-white rounded-[6px]"
                                  >
                                     Give Mic
                                  </button>
                                  <button 
                                     onclick={() => lowerStudentHand(p.id)}
                                     class="p-1 px-1.5 bg-theme-card/10 hover:bg-theme-card/20 transition-colors border-none cursor-pointer rounded text-white flex items-center justify-center"
                                  >
                                     <X size={10} />
                                  </button>
                               {:else}
                                  <Hand size={12} class="text-accent animate-pulse" />
                               {/if}
                            </div>
                         </div>
                      {/each}
                   {/if}
                </div>
             </div>

             <!-- All Students Pane (Falls below Raised Hands) -->
             <div class="flex-1 flex flex-col min-h-0 bg-black/10">
                <div class="px-4 py-2.5 bg-theme-card/5 flex items-center justify-between border-b border-white/5 shrink-0">
                   <span class="text-[10px] font-bold text-white/50 uppercase tracking-widest">
                      All Students
                   </span>
                   <span class="text-[9px] px-1.5 py-0.5 bg-theme-card/10 text-white/50 font-bold rounded-full">
                      {participants.filter(p => p.role !== 'Host').length}
                   </span>
                </div>
                
                <div class="flex-1 overflow-y-auto p-2 space-y-1">
                   {#each sortedParticipants.filter(p => p.role !== 'Host') as p (p.id)}
                      <!-- svelte-ignore a11y_click_events_have_key_events -->
                      <!-- svelte-ignore a11y_no_static_element_interactions -->
                      <div 
                         class="flex items-center justify-between p-2.5 transition-colors rounded-xl hover:bg-theme-card/5 cursor-pointer group"
                         onclick={() => { if (role === 'teacher') selectStudent(p.id); }}
                      >
                         <div class="flex items-center gap-2.5 min-w-0">
                            <img src={p.avatar} alt={p.name} class="w-8 h-8 rounded-full object-cover border border-white/10" />
                            <div class="min-w-0">
                               <p class="text-xs font-bold text-white/90 group-hover:text-white transition-colors truncate m-0">{p.name}</p>
                               <p class="text-[8px] uppercase tracking-widest text-white/40 m-0 mt-0.5">{p.role}</p>
                            </div>
                         </div>
                         <div class="flex items-center gap-2">
                            {#if p.handRaised}
                               <Hand size={12} class="text-accent animate-bounce" />
                            {/if}
                            {#if p.micOn}
                               <Mic size={12} class="text-white/40" />
                            {:else}
                               <MicOff size={11} class="text-accent" />
                            {/if}
                         </div>
                      </div>
                   {/each}
                </div>
             </div>

           </div>
         {/if}
    </div>
  </div>

  <!-- Teacher class list Full Drawer -->
  {#if role === 'teacher' && showClassList}
  <div class="fixed inset-0 z-50 bg-black/95 flex flex-col backdrop-blur-xl">
    <div class="p-4 md:p-6 border-b border-white/10 flex items-center justify-between">
      <h2 class="text-xl md:text-2xl font-bold text-white flex items-center gap-3 m-0">
        <UsersIcon size={24} class="text-olive" /> Class Attendees
      </h2>
      <button 
        onclick={() => showClassList = false} 
        class="w-12 h-12 bg-theme-card/5 border-none cursor-pointer flex items-center justify-center rounded-full text-white hover:bg-theme-card/20 transition-colors"
      >
        <X size={24} />
      </button>
    </div>
    
    <div class="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
       <div class="flex-1 border-t md:border-t-0 md:border-r border-white/10 flex flex-col min-h-0 bg-black/20 p-4 md:p-8 order-2 md:order-1">
          <div class="p-4 border-b border-white/10 bg-theme-card/5 rounded-t-2xl flex items-center justify-between shrink-0">
             <h3 class="text-xs font-bold text-white uppercase tracking-widest m-0">
                Students ({participants.filter(p => p.role !== 'Host').length})
             </h3>
          </div>
          <div class="flex-1 overflow-y-auto p-4 space-y-2 bg-theme-card/5 rounded-b-2xl border-x border-b border-white/5">
             {#each sortedParticipants.filter(p => p.role !== 'Host') as p (p.id)}
             <!-- svelte-ignore a11y_click_events_have_key_events -->
             <!-- svelte-ignore a11y_no_static_element_interactions -->
             <div 
               class="flex items-center justify-between p-3 transition-colors rounded-[20px] group/participant cursor-pointer hover:bg-theme-card/10"
               onclick={() => selectStudent(p.id)}
             >
               <div class="flex items-center gap-3">
                 <img src={p.avatar} alt={p.name} class="w-10 h-10 rounded-full object-cover border-2 border-transparent" />
                 <div>
                   <p class="text-sm font-bold text-white/90 m-0">{p.name}</p>
                 </div>
               </div>
               <div class="flex items-center gap-2">
                  {#if p.micOn}
                  <Mic size={16} class="text-white/50" />
                  {:else}
                  <MicOff size={16} class="text-accent" />
                  {/if}
               </div>
             </div>
             {/each}
          </div>
       </div>
       
       <div class="flex-1 flex flex-col min-h-0 bg-black/40 p-4 md:p-8 order-1 md:order-2">
          <div class="p-4 border-b border-white/10 bg-theme-card/5 rounded-t-2xl shrink-0">
             <h3 class="text-xs font-bold text-white flex items-center gap-2 uppercase tracking-widest m-0">
                <Hand size={14} class="text-accent" /> Raised Hands
             </h3>
          </div>
          <div class="flex-1 overflow-y-auto p-4 space-y-2 bg-theme-card/5 rounded-b-2xl border-x border-b border-white/5">
             {#if participants.filter(p => p.handRaised).length === 0}
             <div class="h-full flex items-center justify-center text-xs text-white/30 font-medium">No hands raised</div>
             {:else}
                {#each participants.filter(p => p.handRaised) as p (p.id)}
                <div class="flex flex-col gap-3 bg-theme-card/5 p-4 rounded-[20px] border border-white/5 relative">
                   <div class="flex items-center gap-3 text-sm text-white/90 font-medium">
                     <img src={p.avatar} alt={p.name} class="w-10 h-10 rounded-full object-cover" />
                     <span>{p.name}</span>
                   </div>
                   <div class="flex items-center gap-2 w-full mt-2">
                     <button 
                       onclick={() => toggleStudentMic(p.id)}
                       class="flex-1 py-2 border-none cursor-pointer text-[10px] font-bold uppercase tracking-widest bg-olive text-white rounded hover:opacity-90 transition-opacity"
                     >
                       Give Mic
                     </button>
                     <button 
                       onclick={() => lowerStudentHand(p.id)}
                       class="flex-1 py-2 border-none cursor-pointer text-[10px] font-bold uppercase tracking-widest bg-theme-card/10 text-white rounded hover:bg-theme-card/20 transition-opacity"
                     >
                       Dismiss
                     </button>
                   </div>
                </div>
                {/each}
             {/if}
          </div>
       </div>
    </div>
  </div>
  {/if}

  <!-- Selected student Submissions full modal -->
  {#if selectedStudent}
  <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8">
    <div class="bg-ink border border-white/10 rounded-[20px] w-full max-w-2xl max-h-full overflow-hidden flex flex-col shadow-2xl">
      <div class="p-6 border-b border-white/10 flex items-center justify-between bg-black/40 shrink-0">
         <div class="flex items-center gap-4">
            <img src={selectedStudentObj?.avatar} alt={selectedStudentObj?.name || 'Student Avatar'} class="w-12 h-12 rounded-full" />
            <div>
               <h2 class="text-lg font-bold text-white mb-1 m-0">{selectedStudentObj?.name}</h2>
               <p class="text-[10px] text-white/50 uppercase tracking-widest m-0">Student Submissions</p>
            </div>
         </div>
         <button 
           onclick={() => selectedStudent = null}
           class="w-10 h-10 border-none cursor-pointer rounded-full bg-theme-card/5 flex items-center justify-center text-white/50 hover:text-white hover:bg-theme-card/10 transition-colors"
         >
           <X size={20} />
         </button>
      </div>

      <div class="flex-1 overflow-y-auto p-6 space-y-6">
         {#each mockSubmissions as sub (sub.id)}
         <div class="bg-theme-card/5 border border-white/10 rounded-[20px] p-5 relative">
            <span class="absolute top-4 right-4 text-[10px] text-white/30 font-mono">{sub.time}</span>
            <h3 class="text-sm font-bold text-white mb-4 pr-16">{sub.prompt}</h3>
            
            <div class="bg-black/30 rounded-[20px] p-4 border border-white/5 mb-4">
              {#if sub.type === 'text'}
              <p class="text-sm text-sage leading-relaxed m-0">{sub.answer}</p>
              {:else}
              <img src={sub.answer} alt="Student submission" class="max-w-full rounded-[20px] border border-white/10 max-h-60 object-contain mx-auto block" />
              {/if}
            </div>

            <div class="flex items-center justify-between">
               <span class="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border {sub.status === 'graded' ? 'bg-olive/10 text-olive border-olive/20' : 'bg-accent/10 text-accent border-accent/20'}">
                  {sub.status === 'graded' ? `Graded: ${sub.points}` : 'Pending Review'}
               </span>
               
               {#if sub.status === 'pending'}
               <button 
                 onclick={() => triggerNotification('Grading Component', { body: 'Opening grading rubric for this submission...', type: 'info'})}
                 class="text-xs font-bold border-none cursor-pointer text-white bg-theme-card/10 px-4 py-2 rounded-[20px] hover:bg-theme-card/20 transition-colors">
                  Grade Submission
               </button>
               {/if}
            </div>
         </div>
         {/each}
         
         <div class="pt-4 border-t border-white/10 flex justify-end">
            <button 
              onclick={() => selectedStudent = null}
              class="px-6 border-none cursor-pointer py-3 rounded-[20px] bg-olive text-white font-bold hover:bg-olive/90 transition-colors"
            >
               Done
            </button>
         </div>
      </div>
    </div>
  </div>
  {/if}

  <div class="absolute bottom-4 left-2 right-2 md:bottom-6 md:left-1/2 md:right-auto md:-translate-x-1/2 px-4 py-3 bg-paper/20 backdrop-blur-3xl border border-white/10 rounded-[20px] md:rounded-full flex items-center justify-between md:justify-center gap-2 md:gap-4 shadow-2xl z-20 overflow-x-auto">
    <button 
      onclick={handleToggleMic}
      class="shrink-0 w-10 h-10 border-none cursor-pointer md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all {micOn ? 'bg-theme-card/20 text-white hover:bg-theme-card/30' : 'bg-accent/20 text-accent border border-accent/30'}"
    >
      {#if micOn}<Mic size={18} class="md:w-5 md:h-5" />{:else}<MicOff size={18} class="md:w-5 md:h-5" />{/if}
    </button>

    <div class="shrink-0 w-px h-6 md:h-8 bg-theme-card/10 mx-1 md:mx-2"></div>

    {#if role === 'teacher'}
      <button 
        onclick={toggleImageMode}
        class="shrink-0 w-10 h-10 cursor-pointer border-none md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all {boardMode === 'image' ? 'bg-olive text-white shadow-lg shadow-olive/20' : 'bg-theme-card/10 md:bg-theme-card/20 text-white hover:bg-theme-card/30'}"
        title="Toggle board image"
      >
        <ImageIcon size={18} class="md:w-5 md:h-5" />
      </button>
      <button 
        onclick={() => boardMode = boardMode === 'text' ? 'audio' : 'text'}
        class="shrink-0 w-10 h-10 cursor-pointer border-none md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all {boardMode === 'text' ? 'bg-olive text-white shadow-lg shadow-olive/20' : 'bg-theme-card/10 md:bg-theme-card/20 text-white hover:bg-theme-card/30'}"
        title="Toggle whiteboard text mode"
      >
        <Type size={18} class="md:w-5 md:h-5" />
      </button>
      <button 
        onclick={() => triggerNotification('Screen Share Requested', { body: 'Initializing virtual classroom screen sharing...', type: 'info' })}
        class="shrink-0 w-10 h-10 cursor-pointer border-none md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all bg-theme-card/10 md:bg-theme-card/20 text-white hover:bg-theme-card/30"
        title="Share Screen"
      >
        <Monitor size={18} class="md:w-5 md:h-5" />
      </button>
      <button 
        onclick={() => showClassList = !showClassList}
        class="shrink-0 w-10 h-10 cursor-pointer border-none md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all {showClassList ? 'bg-olive text-white shadow-lg shadow-olive/20' : 'bg-theme-card/10 md:bg-theme-card/20 text-white hover:bg-theme-card/30'}"
        title="Manage students and submissions"
      >
        <UsersIcon size={18} class="md:w-5 md:h-5" />
      </button>
      
      <div class="shrink-0 w-px h-6 md:h-8 bg-theme-card/10 mx-1 md:mx-2"></div>
    {:else}
      <button 
        onclick={toggleHand}
        class="shrink-0 w-10 h-10 border-none cursor-pointer md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all relative {handRaised ? 'bg-accent/20 text-accent border border-accent/30' : 'bg-theme-card/10 md:bg-theme-card/20 text-white hover:bg-theme-card/30'}"
      >
        <Hand size={18} class="md:w-5 md:h-5" />
        {#if handRaised}
        <span class="absolute -top-1 -right-1 flex h-3 w-3"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span><span class="relative inline-flex rounded-full h-3 w-3 bg-accent border-solid border-2 border-ink"></span></span>
        {/if}
      </button>
    {/if}

    <button class="shrink-0 w-10 h-10 md:w-12 md:h-12 border-none cursor-pointer rounded-full bg-theme-card/10 md:bg-theme-card/20 text-white flex items-center justify-center hover:bg-theme-card/30 transition-all">
      <Sparkles size={18} class="md:w-5 md:h-5" />
    </button>

    <div class="shrink-0 w-px h-6 md:h-8 bg-theme-card/10 mx-1 md:mx-2"></div>

    <button 
      onclick={() => onleave?.()}
      class="shrink-0 w-12 h-10 md:w-16 md:h-12 border-none cursor-pointer rounded-full bg-accent text-white flex items-center justify-center hover:bg-red-600 transition-all font-bold shadow-lg"
    >
      <PhoneOff size={18} class="md:w-5 md:h-5" />
    </button>
  </div>
</div>
