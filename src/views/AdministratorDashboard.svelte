<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { 
    Newspaper, Users, Lock, Unlock, Clock, BarChart, Settings, LogOut, ChevronRight, Ban, GraduationCap, X, Mail, Phone, Calendar, BookOpen, Sun, UserPlus, MessageSquare 
  } from 'lucide-svelte';

  function triggerNotification(title: string, options: any) {
    console.log(`Notification: ${title}`, options);
  }

  let { userName = 'Administrator', onlogout, onviewnews, onviewtimetable, onviewfeeds, onviewideas, onviewforum, onviewconnections } = $props<{
    userName?: string;
    onlogout?: () => void;
    onviewnews?: () => void;
    onviewtimetable?: () => void;
    onviewfeeds?: () => void;
    onviewideas?: () => void;
    onviewforum?: () => void;
    onviewconnections?: () => void;
    onnavigate?: (target: string) => void;
  }>();

  let isStickyBanner = true;

  let students = $state([
    { id: '1', name: 'John Doe', isBlocked: false, points: 1250 },
    { id: '2', name: 'Jane Smith', isBlocked: false, points: 980 },
    { id: '3', name: 'Alim Kato', isBlocked: true, points: 450 },
    { id: '4', name: 'Sarah Nkiro', isBlocked: false, points: 2100 },
  ]);

  let teachers = $state([
    { id: 't1', name: 'Mr. Musoke', classesCount: 4, timeOnline: '12h 30m', isBlocked: false },
    { id: 't2', name: 'Mrs. Lwanga', classesCount: 3, timeOnline: '8h 15m', isBlocked: false },
    { id: 't3', name: 'Dr. Opio', classesCount: 5, timeOnline: '24h 10m', isBlocked: false },
  ]);

  let reassignTeacherId = $state<string | null>(null);

  const toggleBlockStudent = (id: string) => {
    const studentIndex = students.findIndex(s => s.id === id);
    if (studentIndex > -1) {
      students[studentIndex].isBlocked = !students[studentIndex].isBlocked;
    }
  };

  const handleBlockTeacher = (id: string) => {
    const teacher = teachers.find(t => t.id === id);
    if (!teacher) return;
    if (!teacher.isBlocked) {
      reassignTeacherId = id;
    } else {
      teacher.isBlocked = false;
    }
  };

  const confirmBlockAndReassign = () => {
    if (reassignTeacherId) {
      const teacherIndex = teachers.findIndex(t => t.id === reassignTeacherId);
      if (teacherIndex > -1) {
        teachers[teacherIndex].classesCount = 0;
        teachers[teacherIndex].isBlocked = true;
      }
      reassignTeacherId = null;
      triggerNotification('Teacher Reassigned', { body: 'A new teacher has been assigned and an invite has been sent.', type: 'success'});
    }
  };

  const handleBilling = () => triggerNotification('Billing Portal', { body: 'Opening billing portal in a new window...', type: 'info'});
  const handleRotateCode = () => triggerNotification('Code Rotated', { body: 'The school access code has been rotated. Previous code is no longer valid.', type: 'success'});
  const viewAllStudents = () => triggerNotification('Student Roster', { body: 'Loading full student index...', type: 'info'});
  const viewAllTeachers = () => triggerNotification('Teacher Roster', { body: 'Loading full teacher index...', type: 'info'});
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
        <span class="text-[9px] uppercase font-bold text-accent tracking-widest ml-1 bg-accent/20 px-1.5 py-0.5 rounded-full">Admin</span>
      </div>
      <div class="flex items-center gap-4">
        <button onclick={() => onviewnews?.()} class="border-none bg-transparent cursor-pointer p-0">
          <Newspaper size={22} class="text-white/60 hover:text-white transition-colors" />
        </button>
        <button onclick={() => onviewforum?.()} class="border-none bg-transparent cursor-pointer p-0">
          <MessageSquare size={22} class="text-white/60 hover:text-white transition-colors" />
        </button>
        <button onclick={() => onviewconnections?.()} class="relative border-none bg-transparent cursor-pointer p-0">
          <UserPlus size={22} class="text-white/60 hover:text-white transition-colors" />
        </button>
        <button onclick={() => onlogout?.()} class="w-8 h-8 rounded-full bg-theme-card text-ink flex items-center justify-center font-bold text-xs uppercase shadow-sm ml-1 transition-transform hover:scale-105 border-none cursor-pointer p-0">
          SO
        </button>
      </div>
    </header>

    <div class="px-5 mt-0 space-y-6 {isStickyBanner ? 'sticky top-2 z-30' : ''}">
      <div class="px-0 -mt-8 relative z-20">
        <div class="bg-gradient-to-tr from-[#3b2d71] to-[#7b5bc7] rounded-[20px] p-6 text-white shadow-lg relative overflow-hidden h-[140px] flex flex-col justify-center">
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
    </div>
  </div>

  <div class="px-5 mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10 w-full max-w-7xl mx-auto">
    <div class="space-y-6 lg:col-span-2">
    
    <!-- Messaging Mock Data Seeding (New) -->
    <section class="bg-theme-card p-6 rounded-[20px] border border-black/10 shadow-sm">
      <div class="flex items-center gap-3 mb-4">
        <MessageSquare class="text-olive" size={24} />
        <h3 class="font-bold text-ink text-sm uppercase tracking-widest">Messaging Module Test</h3>
      </div>
      <p class="text-xs text-sage mb-4 font-medium leading-relaxed">Ensure all Appwrite collections are properly configured for production use.</p>
      <button 
        onclick={async () => {
           triggerNotification('System Info', { body: 'Synchronized with Appwrite cloud network.', type: 'info'});
        }}
        class="w-full sm:w-auto px-6 py-3 bg-olive text-white rounded-[20px] text-xs font-bold hover:bg-olive/90 transition-all shadow-md shadow-olive/20 border-none cursor-pointer"
      >
        Check System Status
      </button>
    </section>

    <!-- Subscription Info -->
    <section class="bg-gradient-to-r from-accent to-accent/80 text-white p-6 rounded-[20px] shadow-md relative overflow-hidden">
      <div class="absolute top-0 right-0 w-32 h-32 bg-theme-card/10 rounded-full blur-2xl"></div>
      <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p class="text-[10px] uppercase font-bold tracking-widest text-white/70 mb-1">Current Plan</p>
          <h2 class="text-3xl font-extrabold tracking-tight">Standard Private</h2>
          <p class="text-sm text-white/90 mt-1">Up to 800 students • B2B Billing</p>
        </div>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="bg-black/20 p-4 rounded-[20px] border border-white/10 text-center min-w-[140px] cursor-pointer hover:bg-black/30 transition-colors" onclick={handleBilling}>
          <p class="text-[10px] uppercase font-bold tracking-widest text-white/70 mb-1">Time Remaining</p>
          <div class="text-2xl font-bold font-mono">42 <span class="text-sm font-sans tracking-normal">Days</span></div>
        </div>
      </div>
    </section>

    <!-- Stats Summary -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-theme-card p-4 rounded-[20px] border border-black/10 shadow-sm flex flex-col items-center text-center">
        <Users size={24} class="text-olive mb-2" />
        <span class="text-2xl font-bold text-ink">{students.length}</span>
        <span class="text-[10px] uppercase tracking-widest text-sage font-bold">Active Students</span>
      </div>
      <div class="bg-theme-card p-4 rounded-[20px] border border-black/10 shadow-sm flex flex-col items-center text-center">
        <GraduationCap size={24} class="text-accent mb-2" />
        <span class="text-2xl font-bold text-ink">{teachers.length}</span>
        <span class="text-[10px] uppercase tracking-widest text-sage font-bold">Active Teachers</span>
      </div>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div 
        onclick={() => onviewtimetable?.()}
        class="col-span-2 lg:col-span-4 bg-theme-card hover:bg-olive/5 cursor-pointer transition-colors p-4 rounded-[20px] border border-black/10 shadow-sm flex flex-col items-center text-center group"
      >
        <Calendar size={28} class="text-olive mb-2 group-hover:scale-110 transition-transform" />
        <span class="text-lg font-bold text-ink">Manage Timetables</span>
        <span class="text-[10px] uppercase tracking-widest text-sage font-bold mt-1">Configure classes and assignments</span>
      </div>
      <div class="col-span-2 lg:col-span-4 bg-theme-card p-4 rounded-[20px] border border-black/10 shadow-sm flex items-center justify-between px-6">
         <div>
            <span class="block text-2xl font-bold text-ink">GAYAZA-2024</span>
            <span class="text-[10px] uppercase tracking-widest text-sage font-bold">School Access Code</span>
         </div>
         <button 
           onclick={handleRotateCode}
           class="bg-accent/10 border-none cursor-pointer text-accent px-4 py-2 rounded-[20px] text-xs font-bold uppercase tracking-widest hover:bg-accent hover:text-white transition-colors">
           Rotate Code
         </button>
      </div>
    </div>

    </div>
    <div class="space-y-6">

      <button onclick={() => onviewfeeds?.()} class="w-full bg-theme-card p-5 rounded-[20px] border border-black/10 shadow-sm text-left group cursor-pointer">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-bold text-ink text-sm group-hover:text-olive">School Feed</h3>
          <ChevronRight size={16} class="text-sage" />
        </div>
        <p class="text-xs text-sage">Post and review announcements.</p>
      </button>

      <button onclick={() => onviewideas?.()} class="w-full text-left border-none bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[20px] p-5 text-white flex justify-between items-center shadow-md cursor-pointer hover:shadow-lg transition-all relative overflow-hidden">
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

      <!-- Students List -->
      <section class="bg-theme-card rounded-[20px] border border-black/10 shadow-sm p-6">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-sm font-bold text-ink uppercase tracking-widest">Student Roster</h3>
          <span class="text-xs text-sage bg-sage/10 px-2 py-1 rounded-md font-bold">{students.length} Total</span>
        </div>
        <div class="space-y-3">
          {#each students as student}
            <div class="flex items-center justify-between p-3 rounded-[20px] border transition-all {student.isBlocked ? 'border-accent/30 bg-accent/5' : 'border-sage/10 hover:border-olive/30'}">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-[20px] flex flex-col items-center justify-center text-white {student.isBlocked ? 'bg-accent/40' : 'bg-olive/80'}">
                   <span class="text-xs font-bold uppercase">{student.name.charAt(0)}</span>
                </div>
                <div>
                  <p class="text-sm font-bold {student.isBlocked ? 'text-ink/50 line-through' : 'text-ink'}">{student.name}</p>
                  <p class="text-[10px] font-bold text-sage uppercase tracking-widest">{student.points.toLocaleString()} Points</p>
                </div>
              </div>
              <button 
                onclick={() => toggleBlockStudent(student.id)}
                class="p-2 rounded-[20px] transition-colors border-none cursor-pointer {student.isBlocked ? 'bg-accent/10 text-accent hover:bg-accent/20' : 'bg-sage/10 text-sage hover:bg-accent hover:text-white'}"
                title={student.isBlocked ? 'Unblock Student' : 'Lock Student (Prevent code sharing)'}
              >
                {#if student.isBlocked}
                  <Lock size={18} />
                {:else}
                  <Unlock size={18} />
                {/if}
              </button>
            </div>
          {/each}
        </div>
        <button 
          onclick={viewAllStudents}
          class="w-full mt-4 py-3 text-xs font-bold text-accent uppercase tracking-widest bg-accent/5 hover:bg-accent/10 rounded-[20px] transition-colors border-none cursor-pointer">
          View All Students
        </button>
      </section>

      <!-- Teachers List -->
      <section class="bg-theme-card rounded-[20px] border border-black/10 shadow-sm p-6">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-sm font-bold text-ink uppercase tracking-widest">Teacher Roster</h3>
          <span class="text-xs text-sage bg-sage/10 px-2 py-1 rounded-md font-bold">{teachers.length} Active</span>
        </div>
        <div class="space-y-3">
          {#each teachers as teacher}
            <div class="flex items-center justify-between p-3 rounded-[20px] border transition-all {teacher.isBlocked ? 'border-accent/30 bg-accent/5' : 'border-sage/10 hover:border-olive/30'}">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-[20px] flex flex-col items-center justify-center text-white {teacher.isBlocked ? 'bg-accent/40' : 'bg-ink'}">
                   <span class="text-xs font-bold uppercase">{teacher.name.charAt(0)}</span>
                </div>
                <div>
                  <p class="text-sm font-bold {teacher.isBlocked ? 'text-ink/50 line-through' : 'text-ink'}">{teacher.name}</p>
                  <p class="text-[10px] font-bold text-sage uppercase tracking-widest">{teacher.classesCount} Classes</p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <div class="text-right hidden sm:block">
                   <p class="text-[10px] font-bold text-sage uppercase tracking-widest mb-1">Time Online</p>
                   <p class="text-xs font-bold text-ink font-mono">{teacher.timeOnline}</p>
                </div>
                <button 
                  onclick={() => handleBlockTeacher(teacher.id)}
                  class="p-2 border-none cursor-pointer rounded-[20px] transition-colors {teacher.isBlocked ? 'bg-accent/10 text-accent hover:bg-accent/20' : 'bg-sage/10 text-sage hover:bg-accent hover:text-white'}"
                  title={teacher.isBlocked ? 'Unblock Teacher' : 'Lock Teacher (Prevent code sharing)'}
                >
                  {#if teacher.isBlocked}
                    <Lock size={18} />
                  {:else}
                    <Unlock size={18} />
                  {/if}
                </button>
              </div>
            </div>
          {/each}
        </div>
        <button 
          onclick={viewAllTeachers}
          class="w-full border-none cursor-pointer mt-4 py-3 text-xs font-bold text-accent uppercase tracking-widest bg-accent/5 hover:bg-accent/10 rounded-[20px] transition-colors">
          View All Teachers
        </button>
      </section>
    </div>
  </div>

  <!-- Modals -->
  {#if !!reassignTeacherId}
    <div class="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm" onclick={() => reassignTeacherId = null} aria-hidden="true"></div>
    <div class="fixed inset-0 z-50 flex items-center justify-center p-6 text-left">
      <div class="bg-paper p-6 rounded-[20px] shadow-xl w-full max-w-md">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-xl font-bold text-ink">Reassign Classrooms</h3>
          <button onclick={() => reassignTeacherId = null} class="p-2 border-none bg-transparent cursor-pointer text-sage hover:text-ink transition-colors rounded-full hover:bg-black/5">
            <X size={20} />
          </button>
        </div>
        <p class="text-sm text-sage mb-6">Before you block {teachers.find(t => t.id === reassignTeacherId)?.name}, you must reassign their {teachers.find(t => t.id === reassignTeacherId)?.classesCount} classes to another teacher.</p>
        
        <div class="space-y-4 mb-6">
           <div>
             <label for="exup-code" class="text-[10px] font-bold uppercase tracking-widest text-ink block mb-2">Assign Exup↑ Code</label>
             <input id="exup-code" type="text" placeholder="EXUP-XXXX" class="w-full bg-cream border border-sage/20 rounded-[20px] py-3 px-4 text-xs font-mono outline-none focus:ring-1 focus:ring-accent" />
           </div>
           <div class="relative border-t border-sage/10 pt-4">
              <span class="absolute -top-3 left-1/2 -translate-x-1/2 bg-paper px-2 text-[10px] uppercase font-bold text-sage tracking-widest">OR INVITE</span>
              <div class="grid grid-cols-2 gap-3 mt-2">
                <button class="flex bg-transparent cursor-pointer items-center justify-center gap-2 py-3 border border-sage/20 rounded-[20px] text-xs font-bold text-ink hover:bg-accent hover:text-white transition-colors hover:border-accent">
                  <Phone size={14} /> SMS
                </button>
                <button class="flex bg-transparent cursor-pointer items-center justify-center gap-2 py-3 border border-sage/20 rounded-[20px] text-xs font-bold text-ink hover:bg-accent hover:text-white transition-colors hover:border-accent">
                  <Mail size={14} /> Email
                </button>
              </div>
           </div>
        </div>

        <div class="flex gap-3">
          <button onclick={() => reassignTeacherId = null} class="flex-1 border-none cursor-pointer py-3 bg-sage/10 text-ink font-bold uppercase tracking-widest text-[10px] rounded-[20px] hover:bg-sage/20 transition-colors">Cancel</button>
          <button onclick={confirmBlockAndReassign} class="flex-1 py-3 border-none cursor-pointer bg-accent text-white font-bold uppercase tracking-widest text-[10px] rounded-[20px] hover:bg-ink transition-colors">Block & Reassign</button>
        </div>
      </div>
    </div>
  {/if}
</div>
