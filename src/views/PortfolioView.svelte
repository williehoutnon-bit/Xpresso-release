<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { ChevronLeft, ChevronDown, Share2, Sparkles, Mic, Image as ImageIcon, Briefcase, Download, ChevronRight, Video, Trash2, Plus, Trophy, Check } from 'lucide-svelte';
  import { jsPDF } from 'jspdf';

  let { onback, onnavigate } = $props<{
    onback?: () => void;
    onnavigate?: (page: string) => void;
  }>();

  let activeTab = $state('logbook');
  let competenceOpen = $state(false);

  // Logs
  let newLogText = $state('');
  let newLogCompetence = $state('');

  let logEntries = $state([
     { id: 1, date: 'May 5, 2026', text: 'Struggled a bit with the pendulum physics experiment, but eventually got the harmonic motion calculation right after asking Mr. Kato.', competence: 'Proficient' },
     { id: 2, date: 'May 3, 2026', text: 'Successfully titrated the unknown acid sample. It turned light pink at exactly 15ml!', competence: 'Outstanding' }
  ]);

  const getCompetenceEmoji = (comp: string) => {
     if (comp === 'Basic') return '🤔';
     if (comp === 'Competent') return '👍';
     if (comp === 'Proficient') return '⚡';
     if (comp === 'Outstanding') return '🌟';
     return '✔️';
  };

  const addLog = () => {
     if (!newLogText) return;
     logEntries = [{
        id: Date.now(),
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        text: newLogText,
        competence: newLogCompetence || 'Competent'
      }, ...logEntries];
     newLogText = '';
     newLogCompetence = '';
  };

  const deleteLog = (id: number) => {
     logEntries = logEntries.filter(l => l.id !== id);
  };

  // Portfolio
  let portfolioItems = $state([
     { id: 1, title: 'Titration Analysis Report', subject: 'Chemistry', desc: 'A comprehensive log of all titration experiments done this term with photo evidence and balanced equations.', competence: 'Outstanding', image: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&q=80&w=400' },
     { id: 2, title: 'Pendulum Experiment Video', subject: 'Physics', desc: 'Video evidence of my pendulum experiment demonstrating simple harmonic motion.', competence: 'Competent', image: '' }
  ]);

  const deletePortfolio = (id: number) => {
     portfolioItems = portfolioItems.filter(p => p.id !== id);
  };

  const exportPortfolioPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Background accent block in Olive
      doc.setFillColor(107, 112, 92); 
      doc.rect(0, 0, 210, 35, 'F');

      // Title & Header info
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('EXUP STUDY ASSISTANT', 15, 18);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('PORTFOLIO & MY LEARNING JOURNEY REPORT', 15, 26);

      const generatedAt = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      doc.text(`Generated: ${generatedAt}`, 130, 26);

      // Main Content Header
      doc.setTextColor(26, 26, 26); 
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('SHOWCASE GALLERY PROJECTS', 15, 50);

      doc.setDrawColor(107, 112, 92);
      doc.setLineWidth(0.4);
      doc.line(15, 52, 195, 52);

      let y = 60;
      portfolioItems.forEach((item, index) => {
        if (y > 240) {
          doc.addPage();
          y = 25;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(`${index + 1}. ${item.title} (${item.subject})`, 15, y);

        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setFillColor(244, 244, 244);
        doc.text(`Competence Grade: ${item.competence}`, 15, y + 5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        const splitText = doc.splitTextToSize(item.desc, 180);
        doc.text(splitText, 15, y + 10);

        y += 18 + (splitText.length * 5);
      });

      // Reflection Logs
      y += 5;
      if (y > 230) {
        doc.addPage();
        y = 25;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('REFLECTIVE PAST LOGS', 15, y);
      doc.line(15, y + 2, 195, y + 2);
      y += 10;

      if (logEntries.length === 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('No logs recorded yet.', 15, y);
      } else {
        logEntries.forEach((log) => {
          if (y > 240) {
            doc.addPage();
            y = 25;
          }

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.text(log.date, 15, y);

          doc.setFont('helvetica', 'italic');
          doc.setFontSize(9);
          doc.text(`Competence Grade: ${log.competence}`, 140, y);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          const splitLog = doc.splitTextToSize(log.text, 180);
          doc.text(splitLog, 15, y + 5);

          y += 12 + (splitLog.length * 5);
        });
      }

      // Add Footer with metadata
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(140, 140, 140);
        doc.text(`Page ${i} of ${pageCount} | Exup Portfolio & Logbook`, 15, 285);
      }

      doc.save('exup_portfolio_report.pdf');
    } catch (err: any) {
      console.error('PDF generation error', err);
    }
  };
</script>

<div class="h-full bg-cream flex flex-col overflow-hidden relative">
  <header class="px-4 py-4 flex items-center justify-between bg-theme-card/80 backdrop-blur-md border-b border-black/5 z-30 sticky top-0 shrink-0">
    <button onclick={() => onback?.()} class="p-2 -ml-2 text-sage bg-transparent border-none cursor-pointer hover:text-ink transition-colors">
      <ChevronLeft size={24} />
    </button>
    <div class="flex flex-col items-center">
      <h2 class="text-sm font-bold text-ink uppercase tracking-widest">Portfolio & Logbook</h2>
      <p class="text-[9px] text-sage font-bold uppercase tracking-widest">My Learning Journey</p>
    </div>
    <button class="text-sage bg-transparent border-none cursor-pointer hover:text-ink"><Share2 size={20} /></button>
  </header>

  <!-- Tabs Container -->
  <div class="px-4 pt-4 shrink-0 bg-theme-card border-b border-black/5">
     <div class="flex max-w-sm mx-auto bg-paper p-1 rounded-[20px] border border-sage/20 mb-4">
        <button onclick={() => activeTab = 'logbook'} class="flex-1 py-2 text-[10px] bg-transparent border-none cursor-pointer font-bold uppercase tracking-widest rounded-[20px] transition-all {activeTab === 'logbook' ? 'bg-theme-card shadow-sm text-ink' : 'text-sage hover:text-ink'}">Logbook</button>
        <button onclick={() => activeTab = 'portfolio'} class="flex-1 py-2 text-[10px] bg-transparent border-none cursor-pointer font-bold uppercase tracking-widest rounded-[20px] transition-all {activeTab === 'portfolio' ? 'bg-theme-card shadow-sm text-ink' : 'text-sage hover:text-ink'}">Portfolio</button>
     </div>
  </div>

  <div class="flex-1 overflow-y-auto w-full">
    <div class="max-w-3xl mx-auto p-4 md:p-8 space-y-8 pb-32">
      <!-- Logbook Tab -->
      {#if activeTab === 'logbook'}
        <div class="space-y-8 animate-fade-in">
           <!-- Logbook Check-in -->
           <section class="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-[20px] border border-indigo-100 shadow-sm relative overflow-hidden">
              <div class="absolute inset-0 bg-theme-card/40" style="clip-path: polygon(70% 0, 100% 0, 100% 100%, 30% 100%); pointer-events: none;"></div>
              <div class="relative z-10 w-full">
                 <h3 class="text-sm font-bold text-indigo-900 mb-2 flex items-center gap-2"><Sparkles size={16} /> Daily Check-in</h3>
                 <p class="text-xs text-indigo-800/80 mb-4">Reflect on your "Aha!" moments or project challenges today.</p>
                 <div class="space-y-3">
                    <textarea bind:value={newLogText} placeholder="Write, or use voice to text..." class="w-full bg-theme-card/80 p-3 rounded-[20px] text-sm border border-indigo-100 focus:ring-2 focus:ring-indigo-400 focus:outline-none resize-none h-20 shadow-inner"></textarea>
                    
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div class="flex items-center gap-2 relative">
                           <div class="relative">
                             <button 
                               type="button"
                               onclick={() => competenceOpen = !competenceOpen}
                               class="bg-theme-card/80 px-4 py-2 rounded-[20px] text-xs font-bold text-indigo-900 border border-indigo-100 shadow-sm cursor-pointer flex items-center gap-2 hover:bg-theme-card transition-all overflow-hidden"
                             >
                                <span class="truncate">{newLogCompetence ? getCompetenceEmoji(newLogCompetence) + ' ' + newLogCompetence : 'Competence'}</span>
                                <ChevronDown size={14} class="text-indigo-400 shrink-0" />
                             </button>

                             {#if competenceOpen}
                               <div 
                                 class="absolute left-0 bottom-full mb-2 w-48 bg-theme-card rounded-[24px] shadow-2xl border border-black/5 z-[60] overflow-hidden p-1.5"
                                 transition:fade={{ duration: 150 }}
                               >
                                 {#each ['Basic', 'Competent', 'Proficient', 'Outstanding'] as comp}
                                   <button 
                                     onclick={() => { newLogCompetence = comp; competenceOpen = false; }}
                                     class="w-full p-3 rounded-[18px] flex items-center justify-between transition-all group {newLogCompetence === comp ? 'bg-[#E58A3A] text-white shadow-sm' : 'hover:bg-slate-50 text-indigo-900'} border-none cursor-pointer"
                                   >
                                     <div class="flex items-center gap-2">
                                       <span class="text-base">{getCompetenceEmoji(comp)}</span>
                                       <span class="text-xs font-bold">{comp}</span>
                                     </div>
                                     {#if newLogCompetence === comp}
                                       <div class="w-5 h-5 rounded-full bg-theme-card flex items-center justify-center text-[#E58A3A]" in:scale>
                                         <Check size={12} strokeWidth={3} />
                                       </div>
                                     {/if}
                                   </button>
                                 {/each}
                               </div>
                             {/if}
                           </div>
                           <button type="button" class="w-8 h-8 shrink-0 rounded-full cursor-pointer border-none bg-theme-card text-indigo-500 shadow-sm flex items-center justify-center hover:bg-indigo-50"><Mic size={14} /></button>
                           <button type="button" class="w-8 h-8 shrink-0 rounded-full cursor-pointer border-none bg-theme-card text-indigo-500 shadow-sm flex items-center justify-center hover:bg-indigo-50"><ImageIcon size={14} /></button>
                        </div>
                       <button onclick={addLog} class="bg-indigo-600 text-white cursor-pointer border-none text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-[20px] shadow-md hover:bg-indigo-700 w-full sm:w-auto">Save Entry</button>
                    </div>
                 </div>
              </div>
           </section>

           <div class="flex items-center gap-4 py-2">
              <div class="h-[1px] bg-sage/20 flex-1"></div>
              <span class="text-[9px] uppercase tracking-widest text-sage font-bold">Past Entries</span>
              <div class="h-[1px] bg-sage/20 flex-1"></div>
           </div>

           <!-- Logbook Entries List -->
           <div class="space-y-4">
              {#each logEntries as log (log.id)}
                 <div class="bg-theme-card p-5 rounded-[20px] border border-sage/10 shadow-sm">
                    <div class="flex justify-between items-start mb-3">
                       <span class="text-[9px] uppercase tracking-widest text-sage font-bold">{log.date}</span>
                       <button onclick={() => deleteLog(log.id)} class="text-red-400 border-none cursor-pointer hover:text-red-600 p-1 bg-red-50 rounded-[20px]"><Trash2 size={14} /></button>
                    </div>
                    <p class="text-sm text-ink leading-relaxed mb-3">{log.text}</p>
                    <div class="flex gap-2">
                       <span class="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded border border-indigo-100 flex items-center gap-1">{getCompetenceEmoji(log.competence)} {log.competence}</span>
                    </div>
                 </div>
              {/each}
              {#if logEntries.length === 0}
                 <div class="text-center py-8 text-sage text-sm font-medium">No logbook entries yet. Start writing!</div>
              {/if}
           </div>

           <!-- Featured Portfolio -->
           <section class="mt-8">
              <div class="flex items-center justify-between mb-4">
                 <h3 class="text-[10px] font-bold text-sage uppercase tracking-widest flex items-center gap-2"><Trophy size={14} class="text-yellow-500" /> Featured Portfolio</h3>
              </div>
              <div class="bg-gradient-to-br from-olive/10 to-sage/10 border border-olive/20 rounded-[20px] p-5 relative overflow-hidden flex flex-col sm:flex-row gap-4 items-center">
                 <div class="w-16 h-16 shrink-0 rounded-full flex items-center justify-center bg-theme-card shadow-sm border border-olive/20 text-olive text-2xl">
                   🏆
                 </div>
                 <div class="text-center sm:text-left flex-1 min-w-0">
                    <h4 class="font-bold text-ink mb-1 truncate">National Science Fair Entry</h4>
                    <p class="text-[11px] text-sage line-clamp-2">"A prototype water filtration system using local materials." Graded as Outstanding by panel.</p>
                 </div>
                 <button class="shrink-0 bg-theme-card border cursor-pointer border-olive/20 text-olive text-[10px] font-bold uppercase tracking-[0.1em] px-4 py-2 rounded-[20px] shadow-sm hover:bg-olive hover:text-white transition-colors">
                    View Project
                 </button>
              </div>
           </section>
        </div>

      <!-- Portfolio Tab -->
      {:else}
        <div class="space-y-8 animate-fade-in">
           <!-- Add Portfolio Card -->
           <section class="bg-paper p-6 rounded-[20px] border-2 border-dashed border-sage/30 text-center hover:bg-sage/5 transition-colors cursor-pointer flex flex-col items-center justify-center gap-3">
              <div class="w-12 h-12 bg-cream rounded-full border border-sage/20 flex items-center justify-center text-sage">
                 <Plus size={24} />
              </div>
              <div>
                 <h4 class="font-bold text-ink text-sm">Add New Project</h4>
                 <p class="text-[10px] text-sage font-medium uppercase tracking-widest mt-1">Video, Document, or PDF</p>
              </div>
           </section>

           <div class="flex items-center justify-between">
              <h3 class="text-[10px] font-bold text-sage uppercase tracking-widest flex items-center gap-2"><Briefcase size={14} /> Showcase Gallery</h3>
              <button onclick={exportPortfolioPDF} class="bg-olive/10 border-none cursor-pointer text-olive text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-[20px] flex items-center gap-1.5 hover:bg-olive hover:text-white transition-colors">
                <Download size={12} /> Export PDF
              </button>
           </div>
           
           <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              {#each portfolioItems as item (item.id)}
                 <div class="bg-theme-card border border-sage/10 rounded-[20px] overflow-hidden shadow-sm group relative">
                    <div class="absolute top-2 right-2 z-10">
                      <button onclick={() => deletePortfolio(item.id)} class="w-8 h-8 bg-black/50 border-none cursor-pointer backdrop-blur-sm text-white rounded-[20px] flex items-center justify-center hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                    </div>
                    <div class="h-32 bg-slate-100 relative overflow-hidden flex items-center justify-center">
                       {#if item.image}
                         <img src={item.image} class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="Project" />
                       {:else}
                         <div class="w-12 h-12 rounded-full bg-theme-card shadow-sm flex items-center justify-center text-red-500 z-10"><Video size={24} /></div>
                       {/if}
                       <div class="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md text-white text-[9px] px-2 py-1 rounded font-bold uppercase tracking-widest">{item.subject}</div>
                    </div>
                    <div class="p-4">
                       <h4 class="font-bold text-sm text-ink mb-1">{item.title}</h4>
                       <p class="text-xs text-sage line-clamp-2 mb-3">{item.desc}</p>
                       <div class="flex items-center justify-between">
                          <span class="text-[9px] font-bold text-olive uppercase tracking-widest bg-olive/10 px-2 py-1 rounded text-center">{item.competence}</span>
                          <button class="text-ink bg-transparent border-none cursor-pointer hover:text-olive">View <ChevronRight size={14} class="inline" /></button>
                       </div>
                    </div>
                 </div>
              {/each}
           </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
.animate-fade-in {
  animation: fadeIn 0.3s ease;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
