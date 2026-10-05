<script lang="ts">
  import { ChevronLeft, Calendar, Plus, Trash2, Edit3, Save, X, Clock } from 'lucide-svelte';
  import { triggerNotification } from '../services/notificationService';

  let { role, onback } = $props<{ role: 'student' | 'teacher' | 'administrator' | 'parent'; onback?: () => void }>();

  interface TimetableEntry {
    id: string;
    day: string;
    startTime: string;
    endTime: string;
    subject: string;
    room?: string;
    teacherName?: string;
  }

  interface Timetable {
    id: string;
    name: string;
    isClassTimetable: boolean;
    entries: TimetableEntry[];
  }

  let timetables = $state<Timetable[]>([
    {
      id: 'tt1',
      name: 'S.4 Main Timetable',
      isClassTimetable: true,
      entries: [
        { id: '1', day: 'Monday', startTime: '08:00', endTime: '09:30', subject: 'Mathematics', room: 'Room 4A', teacherName: 'Mr. Kato' },
        { id: '2', day: 'Monday', startTime: '09:30', endTime: '11:00', subject: 'Physics', room: 'Lab 2', teacherName: 'Ms. Nabirye' }
      ]
    }
  ]);

  const classTimetables = $derived(timetables.filter(t => t.isClassTimetable));
  const personalTimetables = $derived(timetables.filter(t => !t.isClassTimetable));
  const hasPersonalTimetable = $derived(personalTimetables.length > 0);

  let editingTimetable = $state<Timetable | null>(null);

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const canEditClass = $derived(role === 'teacher' || role === 'administrator');

  let editingTimetableName = $state('');
  
  $effect(() => {
    if (editingTimetable) {
      editingTimetableName = editingTimetable.name;
    }
  });

  const handleCreateClass = () => {
    editingTimetableName = 'New Class Timetable';
    editingTimetable = {
      id: `tt${Date.now()}`,
      name: 'New Class Timetable',
      isClassTimetable: true,
      entries: []
    };
  };

  const handleCreatePersonal = () => {
    editingTimetableName = 'My Personal Timetable';
    editingTimetable = {
      id: `tt${Date.now()}`,
      name: 'My Personal Timetable',
      isClassTimetable: false,
      entries: []
    };
  };

  const handleEdit = (tt: Timetable) => {
    editingTimetable = JSON.parse(JSON.stringify(tt)); // Deep copy
    if (editingTimetable) editingTimetableName = editingTimetable.name;
  };

  const handleDelete = (id: string) => {
    timetables = timetables.filter(t => t.id !== id);
    triggerNotification('Timetable Deleted', { body: 'The timetable has been removed.', type: 'info' });
  };

  const handleSave = () => {
    if (editingTimetable) {
      editingTimetable.name = editingTimetableName;
      const existingIdx = timetables.findIndex(t => t.id === editingTimetable!.id);
      if (existingIdx >= 0) {
        let newTts = [...timetables];
        newTts[existingIdx] = editingTimetable;
        timetables = newTts;
      } else {
        timetables = [...timetables, editingTimetable];
      }
      editingTimetable = null;
      triggerNotification('Timetable Saved', { body: 'Changes applied successfully.', type: 'success' });
    }
  };

  const getSortedDayEntries = (timetable: Timetable, day: string) => {
    return timetable.entries.filter(e => e.day === day).sort((a,b) => a.startTime.localeCompare(b.startTime));
  };

  const getEditingDayEntries = (day: string) => {
    return editingTimetable?.entries.filter(e => e.day === day) || [];
  };

  const handleAddClass = (day: string) => {
    if (editingTimetable) {
      editingTimetable.entries.push({ 
        id: Date.now().toString(), 
        day, 
        startTime: '08:00', 
        endTime: '09:00', 
        subject: '' 
      });
    }
  };

  const handleRemoveClass = (id: string) => {
    if (editingTimetable) {
      editingTimetable.entries = editingTimetable.entries.filter(ex => ex.id !== id);
    }
  };
</script>

<div class="h-full bg-cream flex flex-col relative text-ink overflow-hidden">
  <header class="h-14 flex items-center justify-between px-4 border-b border-black/5 bg-paper sticky top-0 z-20 shadow-sm shrink-0">
    <div class="flex items-center gap-2">
      <button onclick={() => onback?.()} class="p-2 -ml-2 text-sage bg-transparent border-none cursor-pointer hover:text-olive transition-colors">
        <ChevronLeft size={24} />
      </button>
      <div class="flex items-center gap-2 font-bold text-ink text-sm">
        <Calendar size={18} class="text-olive" />
        Timetables
      </div>
    </div>
    <div class="flex items-center gap-2">
       {#if !hasPersonalTimetable && !editingTimetable}
       <button onclick={handleCreatePersonal} class="px-3 py-1.5 cursor-pointer border-none bg-olive text-white font-bold uppercase tracking-widest text-[10px] rounded-[20px] hover:bg-ink transition-colors flex items-center gap-1 shadow-sm">
          <Plus size={14} /> Personal TT
       </button>
       {/if}
       {#if canEditClass && !editingTimetable}
       <button onclick={handleCreateClass} class="p-2 text-olive bg-transparent border-none cursor-pointer hover:bg-olive/10 rounded-full transition-colors">
         <Plus size={20} />
       </button>
       {/if}
    </div>
  </header>

  <div class="flex-1 overflow-y-auto w-full max-w-4xl mx-auto p-4 md:p-6 pb-24">
    {#if editingTimetable}
    <div class="bg-paper border border-sage/10 rounded-[20px] shadow-sm overflow-hidden mb-8">
       <div class="p-5 border-b border-sage/10 bg-cream/30 flex justify-between items-center flex-wrap gap-4">
          <input 
            type="text" 
            bind:value={editingTimetableName}
            class="bg-theme-card border text-ink border-sage/20 rounded-[20px] px-4 py-2 font-bold text-lg outline-none focus:ring-1 focus:ring-accent flex-1 min-w-[200px]"
            placeholder="Timetable Name"
          />
          <div class="flex gap-2 shrink-0">
            <button onclick={() => editingTimetable = null} class="px-4 py-2 text-xs cursor-pointer font-bold rounded-[20px] text-sage hover:bg-sage/10 bg-transparent border border-transparent transition-colors">Cancel</button>
            <button onclick={handleSave} class="px-5 py-2 border-none cursor-pointer text-xs font-bold uppercase tracking-widest text-white bg-accent hover:bg-ink rounded-[20px] shadow-sm transition-colors flex items-center gap-1"><Save size={14} /> Save</button>
          </div>
       </div>
       
       <div class="p-5">
         {#each daysOfWeek as day}
         <div class="mb-6">
             <div class="flex items-center justify-between mb-3">
               <h4 class="text-xs font-bold text-olive uppercase tracking-[0.2em]">{day}</h4>
               <button 
                 onclick={() => handleAddClass(day)}
                 class="text-[10px] font-bold cursor-pointer border-none uppercase tracking-widest text-accent bg-accent/10 px-3 py-1 rounded-full hover:bg-accent hover:text-white transition-colors"
               >
                 + Add Entry
               </button>
             </div>
             
             <div class="space-y-3">
               {#if getEditingDayEntries(day).length === 0}
                 <div class="text-[10px] italic text-sage text-center p-3 border border-sage/10 border-dashed rounded-[20px]">No schedule</div>
               {:else}
                 {#each getEditingDayEntries(day) as entry (entry.id)}
                 <div class="grid grid-cols-12 gap-2 bg-cream/20 p-3 rounded-[20px] border border-sage/10 relative pr-10 hover:border-olive transition-colors">
                    <div class="col-span-12 md:col-span-3 flex items-center gap-1">
                       <input type="time" bind:value={entry.startTime} class="w-full bg-theme-card border border-sage/20 rounded-[20px] px-2 py-1.5 text-xs font-bold outline-none" />
                       <span class="text-sage text-[10px]">to</span>
                       <input type="time" bind:value={entry.endTime} class="w-full bg-theme-card border border-sage/20 rounded-[20px] px-2 py-1.5 text-xs font-bold outline-none" />
                    </div>
                    <div class="col-span-12 md:col-span-4">
                       <input type="text" placeholder="Activity / Subject" bind:value={entry.subject} class="w-full bg-theme-card border border-sage/20 rounded-[20px] px-3 py-1.5 text-xs font-bold outline-none" />
                    </div>
                    <div class="col-span-6 md:col-span-2">
                       <input type="text" placeholder="Location" bind:value={entry.room} class="w-full bg-theme-card border border-sage/20 rounded-[20px] px-3 py-1.5 text-xs outline-none" />
                    </div>
                    <div class="col-span-6 md:col-span-3">
                       <input type="text" placeholder="Details/Teacher" bind:value={entry.teacherName} class="w-full bg-theme-card border border-sage/20 rounded-[20px] px-3 py-1.5 text-xs outline-none" />
                    </div>
                    
                    <button 
                      onclick={() => handleRemoveClass(entry.id)}
                      class="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-transparent border-none cursor-pointer text-sage hover:bg-red-500/10 hover:text-red-500 rounded-[20px] transition-colors"
                    >
                      <X size={16} />
                    </button>
                 </div>
                 {/each}
               {/if}
             </div>
         </div>
         {/each}
       </div>
    </div>
    {:else}
      {#if timetables.length === 0}
      <div class="flex flex-col items-center justify-center p-12 text-center">
         <div class="w-20 h-20 bg-sage/10 rounded-full flex items-center justify-center text-sage mb-6">
           <Calendar size={40} />
         </div>
         <h3 class="text-xl font-bold text-ink mb-2">No Timetables Found</h3>
         <p class="text-sm text-sage mb-6">Create a personal timetable or wait for a class timetable.</p>
      </div>
      {/if}

      {#each classTimetables as tt (tt.id)}
      <div class="bg-paper border border-sage/10 rounded-[20px] overflow-hidden shadow-sm mb-8">
         <div class="p-5 border-b border-sage/10 flex items-center justify-between bg-cream/30">
            <div class="flex items-center gap-2">
               <h2 class="text-lg font-bold text-ink">{tt.name}</h2>
               <span class="text-[9px] bg-slate-200 text-slate-600 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-widest">Class</span>
            </div>
            {#if canEditClass}
            <div class="flex items-center gap-2">
              <button onclick={() => handleEdit(tt)} class="p-2 cursor-pointer text-sage hover:text-accent transition-colors bg-theme-card rounded-[20px] shadow-sm border border-sage/10 hover:border-accent/30"><Edit3 size={16} /></button>
              <button onclick={() => handleDelete(tt.id)} class="p-2 cursor-pointer text-sage hover:text-red-500 transition-colors bg-theme-card rounded-[20px] shadow-sm border border-sage/10 hover:border-red-500/30"><Trash2 size={16} /></button>
            </div>
            {/if}
         </div>
         
         <div class="p-5 space-y-8">
           {#each daysOfWeek as day}
              {#if getSortedDayEntries(tt, day).length > 0}
                 <h4 class="text-xs font-bold text-olive uppercase tracking-[0.2em] mb-4 border-b border-sage/10 pb-2 flex items-center justify-between">
                   <span>{day}</span>
                   <span class="text-[9px] text-sage">{getSortedDayEntries(tt, day).length} Classes</span>
                 </h4>
                 <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {#each getSortedDayEntries(tt, day) as entry (entry.id)}
                    <div class="relative p-4 rounded-[20px] border border-sage/10 bg-cream/20 hover:border-accent hover:bg-theme-card transition-all group">
                       <div class="absolute top-0 right-0 w-1 h-full bg-accent rounded-r-xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
                       <div class="flex items-center gap-1.5 text-xs font-bold text-ink mb-2">
                          <Clock size={12} class="text-sage" />
                          {entry.startTime} - {entry.endTime}
                       </div>
                       <div class="font-bold text-ink text-sm truncate">{entry.subject}</div>
                       <div class="flex gap-4 mt-2">
                         {#if entry.room}<div class="text-[10px] uppercase font-bold text-sage tracking-widest">Room: {entry.room}</div>{/if}
                         {#if entry.teacherName}<div class="text-[10px] uppercase font-bold text-sage tracking-widest truncate">Teacher: {entry.teacherName}</div>{/if}
                       </div>
                    </div>
                    {/each}
                 </div>
              {/if}
           {/each}
         </div>
      </div>
      {/each}

      <!-- Personal Timetable -->
      {#each personalTimetables as tt (tt.id)}
      <div class="bg-paper border border-olive/30 rounded-[20px] overflow-hidden shadow-sm mb-8">
         <div class="p-5 border-b border-olive/20 flex items-center justify-between bg-olive/5">
            <div class="flex items-center gap-2">
               <h2 class="text-lg font-bold text-ink">{tt.name}</h2>
               <span class="text-[9px] bg-olive text-white px-2.5 py-0.5 rounded-full font-bold uppercase tracking-widest">Personal</span>
            </div>
            <div class="flex items-center gap-2">
              <button onclick={() => handleEdit(tt)} class="p-2 cursor-pointer text-sage hover:text-accent transition-colors bg-theme-card rounded-[20px] shadow-sm border border-olive/20 hover:border-accent/30"><Edit3 size={16} /></button>
              <button onclick={() => handleDelete(tt.id)} class="p-2 cursor-pointer text-sage hover:text-red-500 transition-colors bg-theme-card rounded-[20px] shadow-sm border border-olive/20 hover:border-red-500/30"><Trash2 size={16} /></button>
            </div>
         </div>
         
         <div class="p-5 space-y-8">
           {#each daysOfWeek as day}
              {#if getSortedDayEntries(tt, day).length > 0}
                 <h4 class="text-xs font-bold text-olive uppercase tracking-[0.2em] mb-4 border-b border-sage/10 pb-2 flex items-center justify-between">
                   <span>{day}</span>
                   <span class="text-[9px] text-sage">{getSortedDayEntries(tt, day).length} Activities</span>
                 </h4>
                 <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {#each getSortedDayEntries(tt, day) as entry (entry.id)}
                    <div class="relative p-4 rounded-[20px] border border-olive/20 bg-theme-card hover:border-accent transition-all group">
                       <div class="absolute top-0 right-0 w-1 h-full bg-olive rounded-r-xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
                       <div class="flex items-center gap-1.5 text-xs font-bold text-ink mb-2">
                          <Clock size={12} class="text-sage" />
                          {entry.startTime} - {entry.endTime}
                       </div>
                       <div class="font-bold text-ink text-sm truncate">{entry.subject}</div>
                       <div class="flex gap-4 mt-2">
                         {#if entry.room}<div class="text-[10px] uppercase font-bold text-sage tracking-widest truncate">Loc: {entry.room}</div>{/if}
                         {#if entry.teacherName}<div class="text-[10px] uppercase font-bold text-sage tracking-widest truncate">Note: {entry.teacherName}</div>{/if}
                       </div>
                    </div>
                    {/each}
                 </div>
              {/if}
           {/each}
         </div>
      </div>
      {/each}

    {/if}

  </div>
</div>
