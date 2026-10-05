<script lang="ts">
  import { ChevronLeft, Upload, CheckCircle2, ShieldAlert } from 'lucide-svelte';

  let { onback, onsubmit } = $props<{ onback?: () => void, onsubmit?: () => void }>();

  let qualificationsUploaded = $state(false);
  let idUploaded = $state(false);
</script>

<div class="h-full bg-cream flex flex-col p-6 overflow-y-auto">
  <header class="flex items-center mb-8">
    <button onclick={() => onback?.()} class="p-2 -ml-2 text-sage bg-transparent cursor-pointer border-none hover:text-olive transition-colors">
      <ChevronLeft size={24} />
    </button>
    <h2 class="text-sm font-bold text-ink ml-1 uppercase tracking-widest">Teacher Verification</h2>
  </header>

  <div class="flex-1 space-y-6">
    <div class="bg-theme-card p-6 rounded-[20px] border border-sage/10 shadow-sm">
      <div class="w-12 h-12 bg-accent/10 text-accent rounded-full flex items-center justify-center mb-4">
        <ShieldAlert size={24} />
      </div>
      <h3 class="text-lg font-bold text-ink mb-2">Verify Your Account</h3>
      <p class="text-xs text-sage mb-6 leading-relaxed">
        To create independent classes or publish materials, we need to verify your credentials. If your headteacher uses <span class="font-bold">ex</span>up&uarr;, they can also approve you directly.
      </p>

      <div class="space-y-4">
        <div class="border border-sage/20 rounded-[20px] p-4 flex items-center justify-between">
          <div>
            <h4 class="text-xs font-bold text-ink mb-1">Academic Qualifications</h4>
            <p class="text-[10px] text-sage">PDF or Image of your degree/certificate</p>
          </div>
          <button 
            onclick={() => qualificationsUploaded = true}
            class="p-3 border-none cursor-pointer rounded-[20px] flex items-center justify-center transition-colors {qualificationsUploaded ? 'bg-olive text-white' : 'bg-cream text-olive hover:bg-olive hover:text-white'}"
          >
            {#if qualificationsUploaded}<CheckCircle2 size={18} />{:else}<Upload size={18} />{/if}
          </button>
        </div>

        <div class="border border-sage/20 rounded-[20px] p-4 flex items-center justify-between">
          <div>
            <h4 class="text-xs font-bold text-ink mb-1">National ID or Passport</h4>
            <p class="text-[10px] text-sage">A clear photo of your ID (front & back)</p>
          </div>
          <button 
            onclick={() => idUploaded = true}
            class="p-3 border-none cursor-pointer rounded-[20px] flex items-center justify-center transition-colors {idUploaded ? 'bg-olive text-white' : 'bg-cream text-olive hover:bg-olive hover:text-white'}"
          >
            {#if idUploaded}<CheckCircle2 size={18} />{:else}<Upload size={18} />{/if}
          </button>
        </div>
      </div>
    </div>

    <button 
      onclick={() => onsubmit?.()}
      disabled={!qualificationsUploaded || !idUploaded}
      class="w-full py-4 text-white border-none cursor-pointer rounded-[20px] font-bold uppercase tracking-widest text-xs flex items-center justify-center transition-all {(!qualificationsUploaded || !idUploaded) ? 'bg-sage border border-sage/20 opacity-50 cursor-not-allowed' : 'bg-olive shadow-md hover:opacity-90'}"
    >
      Submit for Review
    </button>
  </div>
</div>
