<script lang="ts">
  import { ChevronLeft, Info, AlertCircle, CheckCircle2 } from 'lucide-svelte';
  import type { Exam } from '../types';

  let { exam, onback } = $props<{ exam?: Exam; onback?: () => void }>();
</script>

<div class="h-full bg-theme-paper flex flex-col pt-10 px-6 pb-24 overflow-y-auto relative font-sans">
  <button onclick={() => onback?.()} class="absolute top-8 left-6 p-2 text-slate-400 hover:text-[#1C2033] transition-colors rounded-full bg-theme-card shadow-sm border border-black/5 z-10 cursor-pointer">
    <ChevronLeft size={20} />
  </button>
  <div class="mt-10 mb-8 px-2 flex flex-col items-center text-center">
    <div class="w-16 h-16 bg-red-100 text-red-600 rounded-[20px] flex items-center justify-center mb-6 shadow-sm border border-red-200">
      <Info size={32} />
    </div>
    <h2 class="text-3xl font-extrabold text-[#1C2033] mb-2 tracking-tight">Exam Rules</h2>
    <p class="text-slate-500 text-sm font-medium">{exam?.title || 'General Guidelines'}</p>
  </div>

  <div class="max-w-xl mx-auto w-full space-y-6">
    <div class="bg-theme-card p-6 rounded-[20px] shadow-sm border border-black/5">
      <h3 class="text-lg font-extrabold text-[#1C2033] mb-4">Specific Guidelines</h3>
      <p class="text-sm text-slate-600 leading-relaxed mb-6">
        {exam?.rulesAndGuidelines || 'Please read all rules carefully before beginning your examination session.'}
      </p>

      <h3 class="text-lg font-extrabold text-[#1C2033] mb-4">Standard Examination Rules</h3>
      <ul class="space-y-4 text-sm text-slate-600 list-none p-0 m-0">
        <li class="flex gap-4">
           <div class="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-red-50 flex items-center justify-center text-red-500">
             <AlertCircle size={14} />
           </div>
           <span>Candidates must answer all questions in Section A and two questions in Section B.</span>
        </li>
        <li class="flex gap-4">
           <div class="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-red-50 flex items-center justify-center text-red-500">
             <AlertCircle size={14} />
           </div>
           <span>Do not use correction fluid. Unnecessary alterations will lead to loss of marks.</span>
        </li>
        <li class="flex gap-4">
           <div class="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-red-50 flex items-center justify-center text-red-500">
             <AlertCircle size={14} />
           </div>
           <span>Mobile phones and any electronic devices are strictly prohibited.</span>
        </li>
        <li class="flex gap-4">
           <div class="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
             <CheckCircle2 size={14} />
           </div>
           <span>Ensure your answers are recorded cleanly. For Section A, select only one correct option.</span>
        </li>
        <li class="flex gap-4">
           <div class="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-red-50 flex items-center justify-center text-red-500">
             <AlertCircle size={14} />
           </div>
           <span>Cheating or attempted cheating will lead to immediate cancellation of your exam.</span>
        </li>
        <li class="flex gap-4">
           <div class="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
             <CheckCircle2 size={14} />
           </div>
           <span>Candidates must not leave the exam hall within the first 30 minutes of the examination.</span>
        </li>
        <li class="flex gap-4">
           <div class="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
             <CheckCircle2 size={14} />
           </div>
           <span>Calculators are allowed only where explicitly stated on the paper.</span>
        </li>
      </ul>
    </div>

    <button onclick={() => onback?.()} class="w-full py-4 bg-[#1C2033] border-none text-white rounded-[20px] shadow-md shadow-[#1C2033]/20 font-extrabold uppercase tracking-[0.1em] text-xs hover:opacity-90 flex items-center justify-center cursor-pointer transition-all active:scale-95">
      Return to Exam
    </button>
  </div>
</div>
