<script lang="ts">
  import { Play, Pause, RefreshCw, Check, CheckCheck, Clock, X } from 'lucide-svelte';
  import { audioPlaybackService } from '../services/audioPlaybackService.svelte';

  interface Props {
    messageId: string;
    url: string;
    duration: number; // in seconds
    waveform: string | number[]; // comma-separated or json array
    isMe: boolean;
    transparent?: boolean;
    status?: string;
  }

  let { messageId, url, duration, waveform, isMe, transparent = true, status = 'sent' }: Props = $props();

  interface WavePoint {
    x: number;
    y: number;
  }

  // Generate a highly realistic, organic hand-drawn wavy soundwave based on raw input or procedural noise, matching the image.
  function generateContinuousWavyPath(rawWaveform: any, seedId: string, pointsCount = 300): WavePoint[] {
    let seed = 0;
    if (seedId) {
      for (let charIdx = 0; charIdx < seedId.length; charIdx++) {
        seed = (seed << 5) - seed + seedId.charCodeAt(charIdx);
        seed |= 0;
      }
    }
    
    // Deterministic random numbers
    function random() {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    // Process original waveform if available
    let raw: number[] = [];
    if (Array.isArray(rawWaveform)) {
      raw = rawWaveform;
    } else if (typeof rawWaveform === 'string' && rawWaveform.length > 0) {
      try {
        if (rawWaveform.startsWith('[')) {
          raw = JSON.parse(rawWaveform);
        } else {
          raw = rawWaveform.split(',').map(Number);
        }
      } catch (_) {}
    }

    const POINTS_COUNT = pointsCount;
    const points: WavePoint[] = [];
    const yCenter = 16;
    
    for (let i = 0; i < POINTS_COUNT; i++) {
      const pct = i / POINTS_COUNT;
      let baseVal = 0.5;
      
      if (raw && raw.length > 0) {
        const rawIndex = Math.min(raw.length - 1, Math.floor(pct * raw.length));
        baseVal = (raw[rawIndex] || 15) / 100;
      } else {
        // Procedural natural sound wave envelope
        const envelope = Math.sin(pct * Math.PI);
        const wave1 = Math.abs(Math.sin(pct * Math.PI * 3.5 + (seed % 5)));
        const wave2 = Math.abs(Math.cos(pct * Math.PI * 1.8));
        baseVal = (wave1 * 0.65 + wave2 * 0.35) * envelope + 0.12;
      }

      // Smooth flowing wave instead of high-frequency sharp zigzag hatching
      const cycles = (15 + (seed % 5)) * 0.4;
      const angle = pct * Math.PI * 2 * cycles;
      
      // High resolution sine carrier
      let wave = Math.sin(angle);
      
      // Overlay secondary harmonics for highly organic, ink-scribbled hand characteristics
      wave += 0.3 * Math.sin(angle * 1.8 + 1.2);
      wave += 0.15 * Math.sin(angle * 3.5);
      
      // Minor micro-deviations mimicking ballpoint friction and tremor
      const microJitter = (random() - 0.5) * 0.15;
      wave += microJitter;
      
      // Normalize wave range back to [-1, 1]
      const normalizedWave = wave * 0.7;
      
      // Amplitude: safe maximum that fits within the height of 32px
      const maxAmplitude = 14.5;
      const amplitude = (1.0 + baseVal * maxAmplitude) * 1.3;
      
      const handOffset = (random() - 0.5) * 0.6;
      
      const x = pct * 160 + (random() - 0.5) * 0.4;
      const y = yCenter + normalizedWave * amplitude + handOffset;
      
      points.push({
        x: Math.min(160, Math.max(0, x)),
        y: Math.min(31, Math.max(1, y))
      });
    }
    return points;
  }

  // State for fluid, continuous 60fps playhead interpolation during active playback
  // Disregard actual waveform length or duration for point count, keeping it constant at 300 points
  let wavePoints: WavePoint[] = $derived.by(() => {
    return generateContinuousWavyPath(waveform, messageId, 300);
  });

  // Calculate the full single path representing the soundwave structure
  let fullPath = $derived.by(() => {
    const total = wavePoints.length;
    if (total === 0) return '';
    let d = `M ${wavePoints[0].x.toFixed(1)} ${wavePoints[0].y.toFixed(1)}`;
    for (let i = 1; i < total; i++) {
      d += ` L ${wavePoints[i].x.toFixed(1)} ${wavePoints[i].y.toFixed(1)}`;
    }
    return d;
  });

  // Normalize waveform to a fixed length of 35 bars
  function normalizeWaveform(rawWaveform: any, seedId: string): number[] {
    let raw: number[] = [];
    if (Array.isArray(rawWaveform)) {
      raw = rawWaveform;
    } else if (typeof rawWaveform === 'string' && rawWaveform.length > 0) {
      try {
        if (rawWaveform.startsWith('[')) {
          raw = JSON.parse(rawWaveform);
        } else {
          raw = rawWaveform.split(',').map(Number);
        }
      } catch (e) {
        // fallback
      }
    }

    if (!raw || raw.length === 0) {
      const seed = seedId.charCodeAt(0) || 12;
      raw = [];
      for (let j = 0; j < 35; j++) {
        const val = Math.abs(Math.sin(j * 0.45 + seed)) * 80 + 10;
        raw.push(Math.round(val));
      }
    }

    // Always normalize to exactly 35 bars
    const TARGET_BARS = 35;
    const normalized: number[] = [];
    for (let i = 0; i < TARGET_BARS; i++) {
      const rawIndex = Math.floor((i / TARGET_BARS) * raw.length);
      normalized.push(raw[rawIndex] || 15);
    }
    return normalized;
  }

  let bars: number[] = $derived(normalizeWaveform(waveform, messageId));

  // Access the singleton global audio state
  let isCurrent = $derived(audioPlaybackService.state.currentMessageId === messageId);
  let isPlaying = $derived(isCurrent && audioPlaybackService.state.isPlaying);
  let isBuffering = $derived(isCurrent && audioPlaybackService.state.isBuffering);
  let isError = $derived(audioPlaybackService.state.errorMessageId === messageId);
  let errorMsg = $derived(isError ? audioPlaybackService.state.errorMessage : null);
  let currentTime = $derived(isCurrent ? audioPlaybackService.state.currentTime : 0);
  let activeDuration = $derived.by(() => {
    let rawDur = isCurrent && audioPlaybackService.state.duration > 0 ? audioPlaybackService.state.duration : duration;
    if (rawDur === Infinity || isNaN(rawDur) || !isFinite(rawDur) || rawDur <= 0) {
      rawDur = duration > 0 ? duration : 1;
    }
    return rawDur;
  });

  let progressPercent = $derived.by(() => {
    const currentT = isNaN(currentTime) || !isFinite(currentTime) ? 0 : currentTime;
    // The progress is computed by dividing the playback animation time by the actual audio duration (activeDuration)
    // so that the animation duration matches the audio playback duration exactly.
    const percent = (currentT / activeDuration) * 100;
    return isNaN(percent) || !isFinite(percent) ? 0 : Math.max(0, Math.min(100, percent));
  });

  // Format time (e.g. 0:14)
  function formatTime(secs: number): string {
    if (isNaN(secs) || secs === Infinity) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  // Played status tracking
  let isPlayed = $state(false);

  $effect(() => {
    const played = localStorage.getItem('played-audio-messages');
    if (played) {
      try {
        const playedMessages = JSON.parse(played);
        isPlayed = Array.isArray(playedMessages) && playedMessages.includes(messageId);
      } catch (e) {
        localStorage.removeItem('played-audio-messages');
      }
    }
  });

  // Handle Play / Pause click
  async function handlePlayToggle() {
    if (!isPlayed) {
      isPlayed = true;
      const played = localStorage.getItem('played-audio-messages');
      let playedMessages: string[] = [];
      try {
        playedMessages = played ? JSON.parse(played) : [];
      } catch (e) {}
      if (Array.isArray(playedMessages)) {
        localStorage.setItem('played-audio-messages', JSON.stringify([...new Set([...playedMessages, messageId])]));
      }
    }
    await audioPlaybackService.play(messageId, url, `Voice Note (${formatTime(duration)})`, undefined, duration);
  }

  // Handle click on waveform to seek
  function handleWaveformClick(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    const targetTime = (percent / 100) * activeDuration;
    
    if (isCurrent) {
      audioPlaybackService.seek(targetTime);
    } else {
      // If not active, play first, then seek
      audioPlaybackService.play(messageId, url, `Voice Note (${formatTime(duration)})`, targetTime, duration);
    }
  }

  // Toggle playback speed (1x -> 1.5x -> 2x -> 1x)
  function cycleSpeed() {
    let currentSpeed = audioPlaybackService.state.playbackRate;
    let nextSpeed = 1.0;
    if (currentSpeed === 1.0) nextSpeed = 1.5;
    else if (currentSpeed === 1.5) nextSpeed = 2.0;
    else nextSpeed = 1.0;

    audioPlaybackService.setSpeed(nextSpeed);
  }

  // Trigger prefetch on mount for quick response
  $effect(() => {
    // Prefetch for rapid native offline playing
    audioPlaybackService.prefetch(messageId, url).catch(() => {});
  });
</script>

<div 
  class={transparent 
    ? 'flex items-center gap-3 max-w-full bg-transparent border-none shadow-none p-0' 
    : `flex items-center gap-3 p-3.5 max-w-full transition-all border ${
        isMe 
          ? (isPlayed ? 'bg-[#fefbc8] text-slate-800 border-[#e2d099] rounded-[4px] rounded-br-[14px] rounded-tl-[14px] shadow-[3px_3px_0px_rgba(139,92,26,0.12)]' : 'bg-[#eab308] text-stone-900 border-[#ca8a04] rounded-[4px] rounded-br-[14px] rounded-tl-[14px] shadow-[3px_3px_0px_rgba(139,92,26,0.2)]')
          : (isPlayed ? 'bg-theme-card text-slate-800 border-stone-300 rounded-[14px] rounded-bl-[4px] rounded-tr-[14px] shadow-[3px_3px_0px_rgba(0,0,0,0.06)]' : 'bg-slate-600 text-white border-slate-700 rounded-[14px] rounded-bl-[4px] rounded-tr-[14px] shadow-[3px_3px_0px_rgba(0,0,0,0.15)]')
      }`}
  style="width: 100%;"
  id={`audio-player-${messageId}`}
>
  <!-- Play/Pause Button Area -->
  <button 
    onclick={handlePlayToggle}
    class={`w-10 h-10 rounded-full flex items-center justify-center border-none cursor-pointer text-white shadow-sm active:scale-95 hover:scale-105 transition-all ${
      isError 
        ? 'bg-red-500 hover:bg-red-600' 
        : isMe 
          ? 'bg-[#2563eb] hover:bg-[#1d4ed8]' 
          : 'bg-[#475569] hover:bg-[#334155]'
    }`}
    title={isError ? 'Retry playback' : isPlaying ? 'Pause' : 'Play'}
  >
    {#if isError}
      <RefreshCw size={16} class="text-white ml-0" />
    {:else if isBuffering}
      <RefreshCw size={16} class="animate-spin text-white" />
    {:else if isPlaying}
      <Pause size={16} fill="currentColor" class="text-white ml-0" />
    {:else}
      <Play size={16} fill="currentColor" class="text-white ml-0.5" />
    {/if}
  </button>

  <!-- Soundwave representation & Progress tracker -->
  <div class="flex-1 flex flex-col min-w-0">
    <!-- Interactive Track -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div 
      class="h-7 w-full flex items-center cursor-pointer group/wave relative py-0.5 select-none"
      onclick={handleWaveformClick}
    >
      <div class="w-full h-full relative">
        <!-- Inactive Wave (Always visible in background) -->
        <svg class="w-full h-full block absolute inset-0" viewBox="0 0 160 32" preserveAspectRatio="none">
          <path 
            d={fullPath} 
            fill="none" 
            stroke={isMe ? (isPlayed ? 'rgba(37, 99, 235, 0.25)' : 'rgba(37, 99, 235, 0.8)') : (isPlayed ? 'rgba(74, 85, 104, 0.25)' : 'rgba(74, 85, 104, 0.8)')} 
            stroke-width="1.35" 
            stroke-linecap="round" 
            stroke-linejoin="round"
          />
        </svg>

        <!-- Active Wave (Overlay with clip-path matching duration exactly) -->
        <svg 
          class="w-full h-full block absolute inset-0 transition-[clip-path] duration-100 ease-linear" 
          viewBox="0 0 160 32" 
          preserveAspectRatio="none"
          style="clip-path: inset(0 {100 - progressPercent}% 0 0);"
        >
          <path 
            d={fullPath} 
            fill="none" 
            stroke={isMe ? '#2563eb' : '#4a5568'} 
            stroke-width="1.35" 
            stroke-linecap="round" 
            stroke-linejoin="round"
          />
        </svg>
      </div>
    </div>

    <!-- Timing bar -->
    <div class={`flex items-center justify-between text-[10px] font-bold tracking-wider uppercase mt-1 select-none font-sans ${isMe ? 'text-[#2563eb]/80' : 'text-slate-500/80'}`}>
      <span>{formatTime(currentTime)}</span>
      
      <!-- PWA Sync Status Emblem -->
      {#if isMe && !transparent}
        <div class="flex items-center" title={status}>
          {#if status === 'pending'}
            <Clock size={10} class="opacity-70" />
          {:else if status === 'sent'}
            <Check size={10} />
          {:else if status === 'delivered'}
            <CheckCheck size={10} />
          {:else if status === 'read'}
            <CheckCheck size={10} class="text-orange-500" />
          {:else if status === 'error'}
            <X size={10} class="text-red-500" />
          {:else}
            <Check size={10} />
          {/if}
        </div>
      {/if}

      <span>{formatTime(duration)}</span>
    </div>
  </div>

  <!-- Speed control controller badge -->
  {#if isCurrent}
    <button 
      onclick={cycleSpeed}
      class={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-tight cursor-pointer border hover:scale-105 select-none ${
        isMe 
          ? 'bg-blue-50 border-blue-150 text-[#2563eb]' 
          : 'bg-slate-100 border-slate-200 text-slate-700'
      }`}
      title="Tap to change playback speed"
    >
      {audioPlaybackService.state.playbackRate}x
    </button>
  {/if}
</div>
