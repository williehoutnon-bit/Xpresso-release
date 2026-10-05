<script lang="ts">
  import { ChevronLeft, GraduationCap, CheckCircle2, Zap, Users } from 'lucide-svelte';

  let { onback } = $props<{
    onback?: () => void;
  }>();
</script>

<div class="h-full flex flex-col bg-cream overflow-hidden">
  <div class="bg-accent text-white p-6 pt-12 shrink-0 rounded-b-3xl shadow-md z-10 relative">
    <button 
      onclick={() => onback?.()}
      class="absolute top-6 left-6 p-2 bg-theme-card/20 hover:bg-theme-card/30 rounded-full backdrop-blur-sm transition-colors cursor-pointer border-none"
    >
      <ChevronLeft size={20} />
    </button>
    <div class="flex flex-col items-center mt-4">
      <div class="w-16 h-16 bg-theme-card rounded-[20px] flex items-center justify-center text-ink mb-4 shadow-sm">
        <!-- Simplified ExupLogo -->
        <div class="w-8 h-8 bg-ink rounded-[20px] flex items-center justify-center text-white"><span class="text-[10px] font-bold">ex</span></div>
      </div>
      <h2 class="text-3xl font-bold font-sans">About <span class="font-bold">ex</span>up↑</h2>
      <p class="text-white/90 text-sm mt-1">Exam Excellence Network</p>
    </div>
  </div>

  <div class="flex-1 overflow-y-auto p-6 space-y-8 pb-12">
    <section>
      <h3 class="text-lg font-bold text-ink mb-4 flex items-center gap-2">
        <Zap class="text-accent" size={20} /> Study and Exam Companion
      </h3>
      <p class="text-sage text-sm leading-relaxed">
        <span class="font-bold">ex</span>up↑ is an educational study and exam preparation companion designed to help you prepare for final exams where you can find past papers and solutions. The power of the app is not in helping you memorise answers, but helping you understand concepts for real-life application and easily applying solutions to other questions. The platform features well-illustrated answers which enable visual understanding.
      </p>
    </section>

    <section>
      <h3 class="text-lg font-bold text-ink mb-4 flex items-center gap-2">
        <GraduationCap class="text-accent" size={20} /> For Teachers
      </h3>
      <p class="text-sage text-sm leading-relaxed">
        <span class="font-bold">ex</span>up↑ helps educators do what they can't do with conventional social media apps which are designed around social networking. Our features are designed to simulate a classroom environment. The teacher can give exams, mark them, etc., just the same way they would in class. It is great for holiday study, allowing students and schools to have interactions and networks they couldn't have in conventional social networking apps.
      </p>
    </section>

    <section>
      <h3 class="text-lg font-bold text-ink mb-4 flex items-center gap-2">
        <Users class="text-accent" size={20} /> For Parents
      </h3>
      <p class="text-sage text-sm leading-relaxed mb-6">
        Help your children study effectively. <span class="font-bold">ex</span>up↑ allows parents to monitor their children's weak points and improvements over time, ensuring they stay on track for exam success.
      </p>
    </section>

    <section>
      <h3 class="text-lg font-bold text-ink mb-4 flex items-center gap-2">
        <Users class="text-accent" size={20} /> Pricing Models
      </h3>
      <div class="grid grid-cols-2 gap-4">
        <div class="bg-theme-card p-4 rounded-[20px] shadow-sm border border-black/5 flex flex-col">
          <div class="text-[10px] font-bold text-sage uppercase tracking-wider mb-1">Daily Pass</div>
          <div class="text-xl font-bold text-ink mb-2">500 UGX</div>
          <p class="text-[10px] text-sage leading-relaxed mt-auto">24-hour access to all study materials.</p>
        </div>
        <div class="bg-theme-card p-4 rounded-[20px] shadow-sm border border-black/5 flex flex-col">
          <div class="text-[10px] font-bold text-sage uppercase tracking-wider mb-1">Weekly</div>
          <div class="text-xl font-bold text-ink mb-2">2,500 UGX</div>
          <p class="text-[10px] text-sage leading-relaxed mt-auto">7 days of unlimited access and premium features.</p>
        </div>
        <div class="bg-olive p-4 rounded-[20px] shadow-sm border border-black/5 flex flex-col col-span-2 text-white relative overflow-hidden">
          <div class="absolute top-0 right-0 w-24 h-24 bg-theme-card/5 rounded-full blur-xl transform translate-x-1/2 -translate-y-1/2"></div>
          <div class="text-[10px] font-bold text-white/70 uppercase tracking-wider mb-1">Monthly (Best Value)</div>
          <div class="text-2xl font-bold mb-2">6,500 UGX</div>
          <p class="text-xs text-white/90 leading-relaxed mt-auto">Full 30 days of unimpeded learning, forum access, and networking.</p>
        </div>
      </div>
    </section>
  </div>
</div>
