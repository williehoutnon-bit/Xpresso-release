<script lang="ts">
  import { onMount } from 'svelte';
  import { ArrowUp, BookOpen, ArrowRight, Users, Star } from 'lucide-svelte';
  import PepaChatLogo from '../components/PepaChatLogo.svelte';

  let { onstart, onlogin, onsignup, ontryfree, onabout } = $props<{
    onstart?: (role: string) => void;
    onlogin?: (role?: string) => void;
    onsignup?: (role?: string) => void;
    ontryfree?: () => void;
    onabout?: () => void;
  }>();

  let detectedCountry = $state('Uganda');

  onMount(async () => {
    try {
      // Using ipwho.is which has friendly CORS for client-side usage
      const response = await fetch('https://ipwho.is/');
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      if (data.success && data.country) {
        detectedCountry = data.country;
      }
    } catch (error) {
      // Silently fallback to Uganda if blocked or fails
      detectedCountry = 'Uganda';
    }
  });

  </script>

<div class="flex-1 w-full flex flex-col items-center p-6 text-center bg-theme-paper overflow-hidden relative font-sans spark-container">
  
  <!-- Glass Grid Effect -->
  <div class="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none" style="mask-image: linear-gradient(to bottom, transparent 20%, black 100%);">
    <div class="grid grid-cols-4 sm:grid-cols-6 gap-6 p-4 h-full w-full items-end pb-12">
      {#each Array(36) as _, i}
        <div 
          class="glass-tile backdrop-blur-2xl border border-white/40 shadow-[0_8px_32px_-1px_rgba(0,0,0,0.08),inset_0_0_20px_rgba(255,255,255,0.3)] aspect-square"
          style:opacity="{0.4 + (Math.sin(i * 1.5) * 0.2)}"
          style:--float-delay="{i * 0.3}s"
          style:--rotation="{Math.sin(i) * 5}deg"
          style:transform="translateY({Math.cos(i) * 20}px)"
        ></div>
      {/each}
    </div>
  </div>
  
  <!-- Background Decorators -->
  <div class="absolute -top-16 -left-16 w-64 h-64 bg-slate-100 rounded-full blur-3xl opacity-50 pointer-events-none animate-float-slow"></div>
  <div class="absolute -bottom-20 -left-20 w-80 h-80 bg-orange-100 rounded-full blur-2xl opacity-60 pointer-events-none animate-float-delayed"></div>
  <div class="absolute -bottom-10 -right-10 w-64 h-64 bg-orange-50 rounded-full blur-2xl opacity-80 pointer-events-none animate-float"></div>

  <!-- Sparks -->
  {#each Array(35) as _, i}
    {@const depth = Math.random()}
    {@const startX = Math.random() * 100}
    {@const startY = Math.random() * 100}
    {@const color = i < 25 ? 'bg-orange-400' : 'bg-theme-card'}
    <div 
      class="absolute {color} rounded-full pointer-events-none spark-element"
      style:left="{startX}%"
      style:top="{startY}%"
      style:--delay="-{Math.random() * 20}s"
      style:--duration="{15 + Math.random() * 15}s"
      style:--tx1="{(Math.random() - 0.5) * 150}px"
      style:--ty1="{(Math.random() - 0.5) * 200}px"
      style:--tx2="{(Math.random() - 0.5) * 300}px"
      style:--ty2="{(Math.random() - 0.5) * -400}px"
      style:--base-scale="{0.5 + depth * 2}"
      style:--blur="{depth < 0.3 ? '0px' : (depth * 1.5) + 'px'}"
      style:--opacity="{0.15 + depth * 0.3}"
      style:width="4px"
      style:height="4px"
    ></div>
  {/each}

  <div class="flex-1 flex flex-col justify-center items-center w-full z-10 max-w-sm mx-auto pt-10">
    
    <!-- Logo Container -->
    <div class="mb-4 animate-fade-in-up">
      <div class="w-24 h-24 bg-theme-card rounded-[24px] flex flex-col items-center justify-center shadow-sm relative border border-black/5">
        <PepaChatLogo size={72} />
      </div>
    </div>

    <!-- App Title -->
    <div class="text-[3.5rem] font-extrabold tracking-tight mb-2 animate-fade-in-up leading-none lowercase" style="animation-delay: 0.1s">
      <span class="text-[#0B204C]">pepa</span><span class="text-[#2563EB]">chat</span>
    </div>

    <!-- Tagline -->
    <div class="mb-8 animate-fade-in-up flex flex-col items-center" style="animation-delay: 0.2s">
      <p class="text-[#1C2033] text-xs font-bold uppercase tracking-[0.2em] mb-4">Exam Excellence Network</p>
      <div class="h-[2px] w-8 bg-[#FF5B14] mb-6 rounded-full"></div>
      <p class="text-slate-500 text-[15px] max-w-[260px] leading-relaxed">
        Empowering students across {detectedCountry} to learn, practice and excel.
      </p>
    </div>

    <!-- Action Buttons -->
    <div class="w-full space-y-4 animate-fade-in-up" style="animation-delay: 0.3s">
      <button
        onclick={() => onlogin?.()}
        class="w-full flex items-center justify-between px-6 py-4 bg-theme-card text-[#1C2033] rounded-[20px] shadow-sm hover:shadow transition-all font-extrabold text-[13px] tracking-[0.1em] uppercase border border-black/5 cursor-pointer"
      >
        <span class="flex-1 text-center pl-6">Login</span>
        <ArrowRight size={18} class="text-slate-400" />
      </button>

      <button
        onclick={() => onsignup?.()}
        class="w-full flex items-center justify-between px-6 py-4 bg-[#FF5B14] text-white rounded-[20px] shadow-md shadow-orange-500/20 hover:shadow-lg transition-all font-extrabold text-[13px] tracking-[0.1em] uppercase cursor-pointer"
      >
        <span class="flex-1 text-center pl-6">Register</span>
        <ArrowRight size={18} class="text-white" />
      </button>
    </div>
    
  </div>

  <!-- Footer Area -->
  <div class="mt-auto mb-6 w-full z-10 flex flex-col items-center animate-fade-in-up" style="animation-delay: 0.4s">
     
     <div class="flex items-center justify-center gap-6 mb-4 mt-8">
        <div class="flex gap-1">
           <div class="w-1.5 h-1.5 rounded-full bg-[#FF5B14]"></div>
           <div class="w-1.5 h-1.5 rounded-full bg-[#FF5B14]"></div>
           <div class="w-1.5 h-1.5 rounded-full bg-[#FF5B14]"></div>
        </div>
        
        <div class="w-16 h-16 rounded-full bg-theme-card shadow-sm border border-black/5 flex items-center justify-center text-[#1C2033] relative">
           <Star class="absolute top-[14px] text-[#FF5B14]" size={14} strokeWidth={2.5} />
           <Users size={24} class="mt-2" />
        </div>

        <div class="flex gap-1">
           <div class="w-1.5 h-1.5 rounded-full bg-[#FF5B14]"></div>
           <div class="w-1.5 h-1.5 rounded-full bg-[#FF5B14]"></div>
           <div class="w-1.5 h-1.5 rounded-full bg-[#FF5B14]"></div>
        </div>
     </div>

     <p class="text-[#1C2033] font-bold text-sm tracking-wide mb-3">Connected by Goals</p>
     <div class="h-[2px] w-6 bg-[#FF5B14] mb-4 rounded-full"></div>

     <button 
       onclick={() => onabout?.()}
       class="text-[#FF5B14] font-bold text-sm flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer border-none bg-transparent"
     >
       About pepachat <ArrowUp size={16} />
     </button>
  </div>
</div>

<style>
  .animate-fade-in-up {
    animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    opacity: 0;
    transform: translateY(20px);
  }

  @keyframes fadeInUp {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-float {
    animation: blob-1 25s ease-in-out infinite alternate;
  }
  
  .animate-float-slow {
    animation: blob-2 35s ease-in-out infinite alternate;
  }
  
  .animate-float-delayed {
    animation: blob-3 30s ease-in-out infinite alternate;
    animation-delay: 2s;
  }

  @keyframes blob-1 {
    0% { transform: translate(0, 0) scale(1) rotate(0deg); }
    33% { transform: translate(40px, -50px) scale(1.1) rotate(5deg); }
    66% { transform: translate(-30px, 30px) scale(0.95) rotate(-5deg); }
    100% { transform: translate(20px, -20px) scale(1.05) rotate(2deg); }
  }

  @keyframes blob-2 {
    0% { transform: translate(0, 0) scale(1) rotate(0deg); }
    40% { transform: translate(-50px, -30px) scale(0.9) rotate(-8deg); }
    75% { transform: translate(40px, 50px) scale(1.15) rotate(10deg); }
    100% { transform: translate(-20px, -40px) scale(1) rotate(-3deg); }
  }

  @keyframes blob-3 {
    0% { transform: translate(0, 0) scale(1) rotate(0deg); }
    50% { transform: translate(60px, 40px) scale(1.05) rotate(12deg); }
    85% { transform: translate(-40px, -50px) scale(0.85) rotate(-10deg); }
    100% { transform: translate(10px, 10px) scale(1) rotate(5deg); }
  }

  .spark-container {
    container-type: size;
  }

  .spark-element {
    animation: spark var(--duration) linear var(--delay) infinite;
    filter: blur(var(--blur));
    transform: scale(var(--base-scale));
    opacity: 0;
  }

  @keyframes spark {
    0% {
      transform: translate(0, 0) scale(var(--base-scale));
      opacity: 0;
    }
    10% {
      opacity: var(--opacity);
    }
    50% {
      transform: translate(var(--tx1), var(--ty1)) scale(calc(var(--base-scale) * 1.3));
      opacity: calc(var(--opacity) * 0.6);
    }
    90% {
      opacity: var(--opacity);
    }
    100% {
      transform: translate(var(--tx2), var(--ty2)) scale(var(--base-scale));
      opacity: 0;
    }
  }

  .glass-tile {
    border-radius: 2rem;
    background-color: rgba(255, 255, 255, 0.1);
    animation: tile-float 8s ease-in-out infinite alternate;
    animation-delay: var(--float-delay);
  }

  @keyframes tile-float {
    0% { transform: translateY(0) rotate(0deg); }
    100% { transform: translateY(-15px) rotate(var(--rotation)); }
  }
</style>
