<script lang="ts">
  import { ChevronLeft, Trash2, Edit3, Bookmark, Microscope, FlaskConical, Ruler, FileText } from 'lucide-svelte';
  import { fade } from 'svelte/transition';

  function triggerNotification(title: string, options: any) {
    console.log(`Notification: ${title}`, options);
  }

  let { onback } = $props<{ onback?: () => void }>();

  let activeTab = $state<'annotations' | 'bookmarks' | 'saved'>('annotations');

  let annotations = $state([
    {
      id: '1',
      subject: 'UCE Biology',
      topic: 'Photosynthesis',
      chapter: 'Chapter 4',
      date: '2 days ago',
      content: 'Photosynthesis is the process by which green plants convert light energy into chemical energy. The process occurs in the chloroplast, which contains the green pigment chlorophyll. Chlorophyll absorbs mainly red and blue wavelengths of light and uses this energy to combine carbon dioxide and water to produce glucose and oxygen.',
      highlights: ['chloroplast', 'chlorophyll'],
      note: 'Remember: chloroplast (organelle) contains chlorophyll (pigment). UNEB always asks for the specific organelle name — never just say "the cell"!'
    },
    {
      id: '2',
      subject: 'UCE Chemistry',
      topic: 'Electrolysis',
      chapter: 'Chapter 7',
      date: '4 days ago',
      content: 'During electrolysis, the cathode (negative electrode) attracts positive ions called cations. In dilute sulphuric...',
      highlights: ['cathode'],
      note: ''
    }
  ]);

  let bkList = $state([
    { icon: Microscope, title: 'UCE Biology — Photosynthesis', meta: 'Chapter 4 · Page 3 of 6 · Bookmarked 2 days ago' },
    { icon: FlaskConical, title: 'UCE Chemistry — Electrolysis', meta: 'Chapter 7 · Page 1 of 5 · Bookmarked 4 days ago' },
    { icon: Ruler, title: 'UCE Mathematics — Quadratic Equations', meta: 'Chapter 3 · Page 2 of 4 · Bookmarked 1 week ago' },
    { icon: FileText, title: 'UCE Biology Paper 2 — 2024', meta: 'Question 2 · Bookmarked 5 days ago' }
  ]);

  let sqList = $state([
    { subject: 'UCE BIOLOGY · 2022', question: 'During photosynthesis, which organelle is responsible for trapping light energy...', meta: 'Saved from Daily Question · 3 days ago' },
    { subject: 'UCE CHEMISTRY · 2023', question: 'During the electrolysis of dilute sulphuric acid, what is produced at the cathode?', meta: 'Saved from Exam · 1 week ago' },
    { subject: 'UCE PHYSICS · 2023', question: 'A current of 2 A flows through a resistor of 4 Ω. What is the power dissipated?', meta: 'Saved from Daily Question · 2 weeks ago' }
  ]);

  const deleteAnn = (index: number) => {
    annotations.splice(index, 1);
    annotations = annotations;
    triggerNotification('Deleted', { body: 'Annotation removed.', type: 'info'});
  };

  const deleteBk = (index: number) => {
    bkList.splice(index, 1);
    bkList = bkList;
    triggerNotification('Deleted', { body: 'Bookmark removed.', type: 'info'});
  };

  const deleteSq = (index: number) => {
    sqList.splice(index, 1);
    sqList = sqList;
    triggerNotification('Deleted', { body: 'Saved question removed.', type: 'info'});
  };

  const renderHighlight = (text: string, highlights: string[]) => {
    let result = text;
    highlights.forEach(h => {
      const parts = text.split(new RegExp(`(${h})`, 'gi'));
      result = parts.map((part) => 
        part.toLowerCase() === h.toLowerCase() ? `<span class="bg-accent/20 px-1 rounded-sm">${part}</span>` : part
      ).join('');
    });
    return result;
  };
</script>

<div class="h-full bg-cream flex flex-col overflow-y-auto pb-10">
  <header class="px-4 py-4 flex items-center justify-between sticky top-0 bg-paper/80 backdrop-blur-md z-10 border-b border-black/5">
    <button onclick={() => onback?.()} class="p-2 -ml-2 text-sage hover:text-olive transition-colors flex items-center justify-center w-10 h-10 bg-theme-card rounded-[20px] shadow-sm border border-sage/10 cursor-pointer">
      <ChevronLeft size={20} />
    </button>
    <h2 class="text-sm font-bold text-ink uppercase tracking-widest">Bookmarks & Notes</h2>
    <div class="w-10"></div>
  </header>

  <div class="p-6">
    <div class="flex gap-2 overflow-x-auto no-scrollbar mb-6 pb-2">
      {#each ['annotations', 'bookmarks', 'saved'] as tab}
        <button 
          onclick={() => activeTab = tab as any}
          class="whitespace-nowrap px-5 py-2.5 rounded-full text-xs font-bold transition-all border cursor-pointer border-none {activeTab === tab ? 'bg-olive text-white border-olive shadow-sm' : 'bg-theme-card text-sage border-sage/20 hover:border-sage'}"
        >
          {tab === 'saved' ? 'Saved Questions' : tab.charAt(0).toUpperCase() + tab.slice(1)}
        </button>
      {/each}
    </div>

    <div class="relative min-h-[400px]">
      {#if activeTab === 'annotations'}
        <div transition:fade|local={{ duration: 200 }} class="absolute inset-x-0 space-y-6">
          <p class="text-sm text-sage leading-relaxed mb-4">
            Sections you have highlighted and annotated while reading notes or papers.
          </p>

          {#each annotations as ann, index (ann.id)}
            <div class="bg-theme-card p-5 rounded-[20px] border border-sage/10 shadow-sm space-y-4">
              <div class="flex items-start justify-between">
                <div>
                  <h3 class="text-sm font-bold text-olive">{ann.subject} — {ann.topic}</h3>
                  <p class="text-xs text-sage mt-1">{ann.chapter} · Annotated {ann.date}</p>
                </div>
                <button 
                  onclick={() => deleteAnn(index)}
                  class="text-[10px] text-accent border border-accent rounded-full px-3 py-1 font-bold hover:bg-accent hover:text-white transition-colors bg-transparent cursor-pointer">
                  Delete
                </button>
              </div>

              <div class="text-sm text-ink leading-relaxed">
                {@html renderHighlight(ann.content, ann.highlights)}
              </div>

              {#if ann.note}
                <div class="bg-accent/5 p-4 rounded-[20px] border-l-4 border-accent">
                  <div class="flex items-center gap-2 mb-2">
                    <Edit3 size={14} class="text-accent" />
                    <span class="text-[10px] font-bold text-accent uppercase tracking-widest">My Note</span>
                  </div>
                  <p class="text-sm text-ink/90 leading-relaxed">
                    {ann.note}
                  </p>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {:else if activeTab === 'bookmarks'}
        <div transition:fade|local={{ duration: 200 }} class="absolute inset-x-0 space-y-0 text-sm bg-paper rounded-[20px] shadow-sm border border-sage/10 mb-6">
          {#each bkList as bk, index}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div 
              role="button"
              tabindex="0"
              onkeydown={(e) => { if(e.key === 'Enter' || e.key === ' ') triggerNotification('Loading Bookmark', { body: `Opening ${bk.title}...`, type: 'info'}) }} 
              onclick={() => triggerNotification('Loading Bookmark', { body: `Opening ${bk.title}...`, type: 'info'})} 
              class="w-full text-left bg-transparent border-none flex items-center justify-between p-4 border-b border-sage/10 hover:bg-sage/5 transition-colors cursor-pointer last:border-b-0 last:rounded-b-2xl"
            >
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-[20px] bg-theme-card border border-sage/10 flex items-center justify-center shrink-0 text-olive">
                  <bk.icon size={24} />
                </div>
                <div>
                  <h4 class="font-bold text-ink mb-1">{bk.title}</h4>
                  <p class="text-xs text-sage font-bold uppercase tracking-widest">{bk.meta}</p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button onclick={(e) => { e.stopPropagation(); deleteBk(index); }} class="text-[10px] text-accent border border-accent rounded-full px-3 py-1 font-bold hover:bg-accent hover:text-white transition-colors bg-transparent cursor-pointer">
                  Delete
                </button>
                <ChevronLeft size={16} class="text-sage rotate-180" />
              </div>
            </div>
          {/each}
        </div>
      {:else if activeTab === 'saved'}
        <div transition:fade|local={{ duration: 200 }} class="absolute inset-x-0 space-y-0 text-sm bg-paper rounded-[20px] shadow-sm border border-sage/10 mb-6">
          {#each sqList as sq, index}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div 
              role="button"
              tabindex="0"
              onkeydown={(e) => { if(e.key === 'Enter' || e.key === ' ') triggerNotification('Question Opened', { body: 'Opening question...', type: 'info'}) }} 
              onclick={() => triggerNotification('Question Opened', { body: 'Opening question...', type: 'info'})} 
              class="w-full text-left bg-transparent border-none p-4 border-b border-sage/10 hover:bg-sage/5 transition-colors cursor-pointer last:border-b-0 last:rounded-b-2xl"
            >
              <div class="flex items-start gap-4">
                <div class="mt-1">
                  <Bookmark size={20} class="text-accent" fill="currentColor" />
                </div>
                <div class="flex-1">
                  <div class="flex items-center justify-between mb-2">
                    <div class="text-[10px] font-bold text-olive tracking-widest uppercase">{sq.subject}</div>
                    <button onclick={(e) => { e.stopPropagation(); deleteSq(index); }} class="text-[10px] text-accent border border-accent rounded-full px-3 py-1 font-bold hover:bg-accent hover:text-white transition-colors bg-transparent cursor-pointer">
                      Delete
                    </button>
                  </div>
                  <h4 class="font-medium text-ink mb-2 leading-relaxed">{sq.question}</h4>
                  <p class="text-[10px] uppercase font-bold tracking-widest text-sage mt-2">{sq.meta}</p>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
