<script lang="ts">
  import { AlertTriangle, Share2, Trash2, X, Copy, Check } from 'lucide-svelte';
  import { CrashReporter, type CrashLogsResult } from '../services/crashReporterService';

  let {
    crashData,
    onclose
  }: {
    crashData: CrashLogsResult;
    onclose: () => void;
  } = $props();

  let copied = $state(false);

  const fullReport = $derived.by(() => {
    let out = '';
    if (crashData.uncaughtCrash && crashData.uncaughtCrash.trim().length > 0) {
      out += crashData.uncaughtCrash + '\n\n';
    }
    if (crashData.historicalExitReasons && crashData.historicalExitReasons.trim().length > 0) {
      out += crashData.historicalExitReasons;
    }
    return out.trim() || 'No detailed stack trace captured.';
  });

  async function handleShare() {
    try {
      await CrashReporter.shareCrashLog({ logText: fullReport });
    } catch {
      // Fallback to clipboard
      handleCopy();
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fullReport);
      copied = true;
      setTimeout(() => { copied = false; }, 2000);
    } catch {}
  }

  async function handleClear() {
    try {
      await CrashReporter.clearCrashLogs();
    } catch {}
    onclose();
  }
</script>

<div class="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-red-200 overflow-hidden">
    <!-- Header -->
    <div class="bg-red-50 p-4 border-b border-red-100 flex items-center justify-between">
      <div class="flex items-center gap-2.5">
        <div class="w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
          <AlertTriangle size={20} />
        </div>
        <div>
          <h3 class="text-sm font-bold text-red-950">Application Crash Detected</h3>
          <p class="text-[11px] text-red-700">Captured on previous session exit</p>
        </div>
      </div>
      <button 
        onclick={onclose} 
        class="w-8 h-8 rounded-full flex items-center justify-center text-red-400 hover:text-red-700 hover:bg-red-100/50 transition-colors"
      >
        <X size={18} />
      </button>
    </div>

    <!-- Body -->
    <div class="p-4 overflow-y-auto flex-1 font-mono text-[11px] bg-[#1e293b] text-emerald-400 select-all whitespace-pre-wrap leading-relaxed">
      {fullReport}
    </div>

    <!-- Footer actions -->
    <div class="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
      <button
        onclick={handleClear}
        class="px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
      >
        <Trash2 size={14} /> Clear Log
      </button>

      <div class="flex items-center gap-2">
        <button
          onclick={handleCopy}
          class="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
        >
          {#if copied}
            <Check size={14} class="text-emerald-600" /> Copied
          {:else}
            <Copy size={14} /> Copy
          {/if}
        </button>

        <button
          onclick={handleShare}
          class="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors"
        >
          <Share2 size={14} /> Share Crash Log
        </button>
      </div>
    </div>
  </div>
</div>
