<script lang="ts">
  import { ChevronLeft, Mail, Lock, ArrowRight, ArrowUp, BookOpen, Loader2, Eye, EyeOff, MessageCircle } from 'lucide-svelte';
  import { authService } from '../services/authService';
  import { wakitService } from '../services/wakitService';

  let { initialRole = 'student', onback, onsuccess, onswitchtosignup } = $props<{
    initialRole?: string;
    onback?: () => void;
    onsuccess?: (role: string) => void;
    onswitchtosignup?: () => void;
  }>();

  let role = $state(initialRole && initialRole !== 'guest' && initialRole !== 'landing' ? initialRole : 'student');
  let identifier = $state(''); // Email or Phone
  let password = $state('');
  let showPassword = $state(false);
  let loading = $state(false);
  let whatsappLoading = $state(false);
  let error = $state('');
  let forgotPasswordMode = $state(false);
  let recoveryEmailSent = $state(false);
  let keepMeSignedIn = $state(true);

  async function handleLogin() {
    if (!identifier || !password) {
      error = 'Please enter both email/phone and password';
      return;
    }

    loading = true;
    error = '';

    let loginId = identifier;
    try {
      console.log('LoginView: Attempting login for', identifier);
      
      // If it looks like a phone number (digits only or starts with +), we might need to handle it differently
      // For now, we'll try to use it as is. In a real Appwrite setup, you might map phone -> email or use Phone ID.
      
      // Simple heuristic: if it contains @ it's an email, otherwise assume phone and maybe format it
      if (!identifier.includes('@') && /^\+?\d+$/.test(identifier)) {
        // It's likely a phone number. In a real system we'd look up the account.
        // For this demo/implementation, we'll pass it to authService.
      }

      const loginPromise = authService.login(loginId, password);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Login timed out. Please check your connection.')), 15000)
      );

      await Promise.race([loginPromise, timeoutPromise]);
      console.log('LoginView: Login successful');
      onsuccess?.(role);
    } catch (err: any) {
      console.error('LoginView: Login error', err);
      // Fallback for network issues or timeouts
      if (err.message && (err.message.includes('timed out') || err.message.includes('Failed to fetch') || err.message.includes('network'))) {
         error = 'Login timed out or failed to connect. Please check your connection.';
      } else {
         error = err.message || 'Login failed. Please check your credentials.';
      }
    } finally {
      loading = false;
    }
  }

  async function handleWhatsAppLogin() {
    whatsappLoading = true;
    error = '';
    
    try {
      // 1. Get the direct login URL
      const url = wakitService.getWhatsAppLoginUrl();
      
      // 2. Open WhatsApp
      window.open(url, '_blank');
      
      // 3. Show a state that we are waiting for verification
      error = 'Please complete verification in WhatsApp and return here.';
      
      // Note: In a real implementation with Wakit.ai, their SDK handles the redirect/callback.
      // We would use window.otpless(user) or similar callbacks.
      
    } catch (err: any) {
      error = 'WhatsApp login failed: ' + err.message;
    } finally {
      whatsappLoading = false;
    }
  }

  async function handleRecoverPassword() {
    if (!identifier || !identifier.includes('@')) {
      error = 'Please enter your email address to recover your password';
      return;
    }

    loading = true;
    error = '';

    try {
      await authService.requestPasswordRecovery(identifier);
      recoveryEmailSent = true;
    } catch (err: any) {
      error = err.message || 'Could not send recovery email. Please try again.';
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex-1 w-full bg-theme-paper flex flex-col pt-10 px-8 pb-8 overflow-y-auto relative font-sans overflow-hidden spark-container">
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

  <button onclick={() => forgotPasswordMode ? forgotPasswordMode = false : onback?.()} class="absolute top-8 left-6 p-2 text-slate-400 hover:text-[#1C2033] transition-colors rounded-full bg-theme-card shadow-sm border border-black/5 z-20">
    <ChevronLeft size={20} />
  </button>
  
  <div class="flex flex-col items-center justify-center mb-8 mt-6">
     <div class="w-16 h-16 bg-theme-card rounded-[20px] flex flex-col items-center justify-center shadow-sm relative border border-black/5 mb-4">
       <ArrowUp class="text-black mb-[-4px]" size={18} strokeWidth={3} />
       <BookOpen class="text-[#FF5B14]" size={28} strokeWidth={2.5} />
     </div>
     <h2 class="text-sm font-extrabold text-[#1C2033] tracking-[0.1em] uppercase">
       {forgotPasswordMode ? 'Recover Password' : 'Login securely'}
     </h2>
  </div>

  <div class="flex-1 max-w-sm mx-auto w-full z-10 space-y-6">
    
    {#if !forgotPasswordMode}
      <!-- Role Tabs -->
      <div class="bg-theme-card p-1.5 rounded-[20px] shadow-sm border border-black/5 flex overflow-x-auto no-scrollbar snap-x">
         <button 
           onclick={() => role = 'student'}
           class="flex-1 min-w-[70px] py-2.5 text-[10px] font-extrabold uppercase tracking-widest rounded-[20px] transition-all shrink-0 snap-start {role === 'student' ? 'bg-[#FF5B14] text-white shadow-sm' : 'bg-transparent text-slate-400 hover:text-[#1C2033]'}"
         >
           Student
         </button>
         <button 
           onclick={() => role = 'teacher'}
           class="flex-1 min-w-[70px] py-2.5 text-[10px] font-extrabold uppercase tracking-widest rounded-[20px] transition-all shrink-0 snap-start {role === 'teacher' ? 'bg-[#FF5B14] text-white shadow-sm' : 'bg-transparent text-slate-400 hover:text-[#1C2033]'}"
         >
           Teacher
         </button>
         <button 
           onclick={() => role = 'parent'}
           class="flex-1 min-w-[70px] py-2.5 text-[10px] font-extrabold uppercase tracking-widest rounded-[20px] transition-all shrink-0 snap-start {role === 'parent' ? 'bg-[#FF5B14] text-white shadow-sm' : 'bg-transparent text-slate-400 hover:text-[#1C2033]'}"
         >
           Parent
         </button>
         <button 
           onclick={() => role = 'administrator'}
           class="flex-1 min-w-[70px] py-2.5 text-[10px] font-extrabold uppercase tracking-widest rounded-[20px] transition-all shrink-0 snap-start {role === 'administrator' ? 'bg-[#FF5B14] text-white shadow-sm' : 'bg-transparent text-slate-400 hover:text-[#1C2033]'}"
         >
           Admin
         </button>
      </div>
    {/if}

    <div class="space-y-4">
      {#if error}
        <div class="bg-red-50 border border-red-100 text-red-600 text-[10px] font-bold uppercase tracking-widest p-4 rounded-[20px] text-center">
          {error}
        </div>
      {/if}

      {#if recoveryEmailSent}
        <div class="bg-green-50 border border-green-100 text-green-600 text-[10px] font-bold uppercase tracking-widest p-6 rounded-[24px] text-center space-y-4">
          <p>Recovery link sent!</p>
          <p class="text-slate-500 font-medium normal-case">Please check your inbox for instructions to reset your password.</p>
          <button 
            type="button"
            onclick={() => { recoveryEmailSent = false; forgotPasswordMode = false; }}
            class="text-[#1C2033] font-bold underline cursor-pointer border-none bg-transparent"
          >
            Back to Login
          </button>
        </div>
      {:else}
        <div class="relative">
          <div class="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-400 pointer-events-none">
            <Mail size={16} />
            <span class="text-slate-300">|</span>
            <MessageCircle size={16} />
          </div>
          <label for="identifier" class="sr-only">Email or Phone Number</label>
          <input 
            id="identifier"
            type="text" 
            bind:value={identifier}
            placeholder="Email or Phone Number" 
            class="w-full bg-theme-card border border-black/5 rounded-[20px] py-4 pl-16 pr-4 text-sm text-[#1C2033] focus:ring-1 focus:ring-[#FF5B14] focus:border-[#FF5B14] outline-none transition-all shadow-sm placeholder:text-slate-400 font-bold"
          />
        </div>

        {#if !forgotPasswordMode}
          <div class="relative">
            <label for="login-password" class="sr-only">Password</label>
            <Lock class="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
            <input 
              id="login-password"
              type={showPassword ? "text" : "password"} 
              bind:value={password}
              placeholder="Password" 
              class="w-full bg-theme-card border border-black/5 rounded-[20px] py-4 pl-12 pr-12 text-sm text-[#1C2033] focus:ring-1 focus:ring-[#FF5B14] focus:border-[#FF5B14] outline-none transition-all shadow-sm placeholder:text-slate-400 font-bold"
            />
            <button 
              type="button"
              onclick={() => showPassword = !showPassword}
              class="absolute right-4 top-1/2 -translate-y-1/2 border-none bg-transparent text-slate-400 hover:text-[#FF5B14] cursor-pointer"
            >
              {#if showPassword}
                <EyeOff size={18} />
              {:else}
                <Eye size={18} />
              {/if}
            </button>
          </div>
          
          <div class="flex justify-between items-center px-2">
            <label class="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                bind:checked={keepMeSignedIn}
                class="w-4 h-4 text-[#FF5B14] rounded outline-none border-black/10 focus:ring-[#FF5B14] accent-[#FF5B14]" 
              />
              <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Keep me signed in</span>
            </label>
            <button 
              type="button"
              onclick={() => forgotPasswordMode = true}
              class="bg-transparent border-none text-[10px] font-bold text-[#FF5B14] uppercase tracking-widest hover:underline cursor-pointer"
            >
              Forgot Password?
            </button>
          </div>

          <button 
            onclick={handleLogin}
            disabled={loading}
            class="w-full mt-8 py-4 bg-[#1C2033] text-white rounded-[20px] font-extrabold uppercase tracking-[0.1em] text-xs shadow-md shadow-[#1C2033]/20 flex items-center justify-between px-6 hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
          >
            <span class="flex-1 text-center pl-6">{loading ? 'Signing In...' : 'Sign In'}</span>
            {#if loading}
              <Loader2 size={18} class="animate-spin" />
            {:else}
              <ArrowRight size={18} class="text-white" />
            {/if}
          </button>

          <div class="flex items-center gap-4 py-2">
            <div class="flex-1 h-px bg-black/5"></div>
            <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">OR</span>
            <div class="flex-1 h-px bg-black/5"></div>
          </div>

          <button 
            onclick={handleWhatsAppLogin}
            disabled={whatsappLoading}
            class="w-full py-4 bg-[#25D366] text-white rounded-[20px] font-extrabold uppercase tracking-[0.1em] text-xs shadow-md shadow-[#25D366]/20 flex items-center justify-center gap-3 hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
          >
            {#if whatsappLoading}
                <Loader2 size={18} class="animate-spin" />
            {:else}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .006 5.408 0 12.045c0 2.121.554 4.191 1.602 6.005L0 24l6.149-1.613a11.817 11.817 0 005.897 1.568h.005c6.631 0 12.046-5.408 12.052-12.046a11.817 11.817 0 00-3.691-8.52"/>
                </svg>
                WhatsApp Direct Login
            {/if}
          </button>
        {:else}
          <button 
            onclick={handleRecoverPassword}
            disabled={loading}
            class="w-full mt-8 py-4 bg-[#FF5B14] text-white rounded-[20px] font-extrabold uppercase tracking-[0.1em] text-xs shadow-md shadow-[#FF5B14]/20 flex items-center justify-center px-6 hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
          >
            {#if loading}
              <Loader2 size={18} class="animate-spin mr-3" />
              Sending...
            {:else}
              Send Recovery Email
            {/if}
          </button>
        {/if}
      {/if}
    </div>

    <div class="mt-8 text-center pb-6">
       {#if !forgotPasswordMode}
         <button 
           onclick={() => forgotPasswordMode = true}
           class="text-[10px] font-bold text-[#FF5B14] uppercase tracking-widest hover:opacity-80 transition-opacity block w-full mb-8 cursor-pointer border-none bg-transparent"
         >
           Forgot Password?
         </button>
       {:else}
         <button 
           onclick={() => forgotPasswordMode = false}
           class="text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:opacity-80 transition-opacity block w-full mb-8 cursor-pointer border-none bg-transparent"
         >
           Back to Login
         </button>
       {/if}
       
       <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-4">Don't have an account?</p>
       <button 
        onclick={() => onswitchtosignup?.()}
        class="text-[11px] font-extrabold text-[#1C2033] uppercase tracking-[0.2em] hover:text-[#FF5B14] transition-colors cursor-pointer border-none bg-transparent"
       >
         Create a New Account
       </button>
    </div>
  </div>
</div>

<style>
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

  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
</style>
