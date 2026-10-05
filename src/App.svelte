<script lang="ts">
  import { onDestroy } from 'svelte';
import LandingView from './views/LandingView.svelte';
  import LoginView from './views/LoginView.svelte';
  import SignupView from './views/SignupView.svelte';
  import AboutView from './views/AboutView.svelte';
  import StudentDashboard from './views/StudentDashboard.svelte';
  import TeacherDashboard from './views/TeacherDashboard.svelte';
  import AdministratorDashboard from './views/AdministratorDashboard.svelte';
  import ParentDashboard from './views/ParentDashboard.svelte';
  import PublicProfileView from './views/PublicProfileView.svelte';
  import RulesView from './views/RulesView.svelte';
  import SchoolFeeds from './views/SchoolFeeds.svelte';
  import ShareNotesView from './views/ShareNotesView.svelte';
  import SharedNotesView from './views/SharedNotesView.svelte';
  import SocialView from './views/SocialView.svelte';
  import StudentResultsView from './views/StudentResultsView.svelte';
  import SubscribedClassesView from './views/SubscribedClassesView.svelte';
  import TasksView from './views/TasksView.svelte';
  import TeacherVerification from './views/TeacherVerification.svelte';
  import TimetableView from './views/TimetableView.svelte';
  import VideosView from './views/VideosView.svelte';
  import VirtualClassroomView from './views/VirtualClassroomView.svelte';
  import PlaceholderView from './views/PlaceholderView.svelte';
  import PortfolioView from './views/PortfolioView.svelte';
  import ProfileView from './views/ProfileView.svelte';
  import ProgressView from './views/ProgressView.svelte';
  import BottomNav from './components/BottomNav.svelte';
  import ForumView from './views/ForumView.svelte';
  import InboxView from './views/InboxView.svelte';
  import ChatWindow from './views/ChatWindow.svelte';
  import BookmarksView from './views/BookmarksView.svelte';
  import NewsView from './views/NewsView.svelte';
  import IdeasView from './views/IdeasView.svelte';
  import LeaderboardView from './views/LeaderboardView.svelte';
  import MarkingView from './views/MarkingView.svelte';
  import ExamCatalogue from './views/ExamCatalogue.svelte';
  import ExamView from './views/ExamView.svelte';
  import NotificationsView from './views/NotificationsView.svelte';
  import { ArrowUp, BookOpen, Mail } from 'lucide-svelte';
  
  import { authService } from './services/authService';
  import { messagingService } from './services/messagingService';
  import { dbService } from './services/dbService';
  
  let currentView = $state('landing');
  let authRole = $state('');
  let userName = $state('Learner');
  let userClass = $state('');
  let isEmailVerified = $state(false);
  let selectedContact = $state('');
  let selectedConversationId = $state('');
  let selectedExam = $state<any>(null);
  let isInitializing = $state(true);
  
  // PWA Back Button Support
  let showExitDialog = $state(false);
  let currentHistView = 'landing';

  function getBackView(view: string) {
    if (['chat'].includes(view)) return 'messages';
    if (['exam'].includes(view)) return 'catalogue';
    if (['login', 'signup', 'about', 'verify_email_pending'].includes(view)) return 'landing';
    if (['landing', 'messages'].includes(view)) return null;
    return 'messages';
  }

  function handleBack() {
    const parent = getBackView(currentView);
    if (parent) {
      currentView = parent;
    } else if (window.history.length > 1) {
      window.history.back();
    }
  }

  $effect(() => {
    if (currentView !== currentHistView) {
      currentHistView = currentView;
      try {
        window.history.pushState({ view: currentView }, '');
      } catch (e) {
        console.warn('History API blocked (likely in iframe preview):', e);
      }
    }
  });

  $effect(() => {
    // Initial dummy state mapping for base load
    try {
      window.history.replaceState({ view: currentView }, '');
    } catch (e) {
      console.warn('History API blocked (likely in iframe preview):', e);
    }
    
    const handlePopState = (e: PopStateEvent) => {
      const targetView = e.state?.view;
      const parentView = getBackView(currentHistView);
      const isRoot = currentHistView === 'dashboard' || currentHistView === 'landing';
      const isPWA = window.matchMedia('(display-mode: standalone)').matches;

      // Prevent PWA Exit at Root
      if (!targetView && isRoot && isPWA) {
        try {
          window.history.pushState({ view: currentHistView }, '');
        } catch (e) {}
        showExitDialog = true;
        return;
      }

      if (targetView) {
        currentHistView = targetView;
        currentView = targetView;
      } else if (parentView) {
        currentHistView = parentView;
        currentView = parentView;
        try {
          window.history.replaceState({ view: parentView }, '');
        } catch (e) {}
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  });

  function handleExitPWA() {
    showExitDialog = false;
    try {
      window.close();
    } catch (e) {}
  }

  let appSubscriptions: any[] = [];
  onDestroy(() => {
    appSubscriptions.forEach(sub => {
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    });
  });

  // Check session on mount
  $effect(() => {
    import('./services/backgroundSyncService').then(({ startBackgroundSyncService }) => {
      startBackgroundSyncService();
    }).catch(err => console.error('App: Failed to start background sync service:', err));

    async function checkSession() {
      console.log('App: Initializing session check...');
      try {
        // Simple timeout to prevent hanging on initial load if Appwrite is non-responsive
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('timeout'), 30000));
        const userPromise = authService.getCurrentUser();
        
        const result = await Promise.race([userPromise, timeoutPromise]);
        
        if (result === 'timeout') {
          console.warn('App: Session check timed out.');
        } else if (result) {
          const user = result as any;
          console.log('App: User found, role:', user.prefs?.role);
          authRole = user.prefs?.role || 'student';
          userName = user.prefs?.lastName || user.name || 'Learner';
          userClass = user.prefs?.studentClass || '';
          isEmailVerified = user.emailVerification;

          // Real-time RxDB Profile subscription for current user
          try {
            const db = await dbService.getRawDB();
            if (db && db.profiles) {
               // Load initial profile data immediately
               const initialProfile = await dbService.getProfile(user.$id, false);
               if (initialProfile) {
                 userName = initialProfile.lastName || initialProfile.surname || initialProfile.fullName || user.prefs?.lastName || user.name || 'Learner';
                 userClass = initialProfile.studentClass || user.prefs?.studentClass || '';
               }
               
               const profileDoc$ = db.profiles.findOne(user.$id).$;
               const sub = profileDoc$.subscribe((p: any) => {
                  if (p) {
                    const data = p.toJSON();
                    console.log('App: Real-time Profile updated:', data);
                    userName = data.lastName || data.surname || data.fullName || user.prefs?.lastName || user.name || 'Learner';
                    userClass = data.studentClass || user.prefs?.studentClass || '';
                  }
               });
               appSubscriptions.push(sub);
            }
          } catch (rxErr) {
            console.error('App: Failed to subscribe to real-time profile:', rxErr);
          }
          
          if (!isEmailVerified && currentView !== 'signup') {
            currentView = 'verify_email_pending';
          } else {
            currentView = 'messages';
          }

          // PRELOAD MESSAGES: Background task
          messagingService.preloadAllMessages().catch((err: any) => {
             if (err?.message?.toLowerCase().includes('fetch') || err?.toString?.().toLowerCase().includes('fetch')) {
               console.warn('App: Background message preload pending network');
             } else {
               console.error('App: Background message preload failed', err);
             }
          });
        } else {
          console.log('App: No user session found.');
        }
      } catch (err) {
        console.error('App: Initialization error:', err);
      } finally {
        console.log('App: Initialization complete.');
        isInitializing = false;
      }
    }
    checkSession();
  });

  let verificationTimer: number | null = null;
  $effect(() => {
    if (currentView === 'verify_email_pending' && !isEmailVerified) {
      verificationTimer = window.setInterval(async () => {
        try {
          const user = await authService.getCurrentUser();
          if (user && user.emailVerification) {
            isEmailVerified = true;
            currentView = 'messages';
            if (verificationTimer) clearInterval(verificationTimer);
          }
        } catch (e) {
          console.warn('App: Verification poll failed', e);
        }
      }, 5000);
    } else {
      if (verificationTimer) {
        clearInterval(verificationTimer);
        verificationTimer = null;
      }
    }
  });

  let forumTimer = $state(300);
  
  $effect(() => {
    if (currentView === 'forum' && forumTimer > 0) {
      const interval = window.setInterval(() => {
        forumTimer -= 1;
        if (forumTimer <= 0) {
          currentView = 'messages';
        }
      }, 1000);
      return () => clearInterval(interval);
    } else if (currentView !== 'forum') {
      forumTimer = 300;
    }
  });

  const showBottomNav = $derived(
    authRole !== '' && 
    !['landing', 'login', 'signup', 'about', 'virtual_classroom', 'chat'].includes(currentView)
  );


  async function handleStart(role: string) {
    authRole = role;
    currentView = isEmailVerified ? 'messages' : 'verify_email_pending';
    
    // Ensure real-time listeners and message preload starts immediately on successful login/start
    try {
        await messagingService.preloadAllMessages();
    } catch (e: any) {
        if (e?.message?.toLowerCase().includes('fetch') || e?.toString?.().toLowerCase().includes('fetch')) {
           console.warn('App: handleStart message preload pending network');
        } else {
           console.error('App: handleStart message preload failed', e);
        }
    }
  }

  function handleLogin(role?: string) {
    if (role) authRole = role;
    currentView = 'login';
  }

  function handleSignUp(role?: string) {
    if (role) authRole = role;
    currentView = 'signup';
  }

  // Global Online Presence
  // Global Online Presence Ticker
  let presenceInterval: any;
  $effect(() => {
    // Immediate trigger on authRole change
    if (authRole && authRole !== '') {
      authService.getCurrentUser().then(user => {
        if (user && user.$id && !user.$id.startsWith('mock')) {
          authService.setOnlineStatus(user.$id, true);
        }
      });
    }

    // Set up continuous heartbeat interval every 20 seconds for maximum reliability
    if (presenceInterval) clearInterval(presenceInterval);
    presenceInterval = window.setInterval(async () => {
      try {
        const user = await authService.getCurrentUser();
        if (user && user.$id && !user.$id.startsWith('mock')) {
          authService.setOnlineStatus(user.$id, true);
        }
      } catch (err) {
        console.error('Presence heartbeat error:', err);
      }
    }, 20000);

    return () => {
      if (presenceInterval) {
        clearInterval(presenceInterval);
        presenceInterval = null;
      }
    };
  });

  function handleLogout() {
    authService.logout();
    if (presenceInterval) clearInterval(presenceInterval);
    authRole = '';
    currentView = 'landing';
  }

  function handleNavigate(target: string) {
    currentView = target;
  }
</script>

<div class="w-full lg:max-w-screen-xl md:max-w-screen-md sm:max-w-full mx-auto h-screen max-h-screen relative flex flex-col overflow-hidden bg-transparent md:shadow-2xl">
  {#if isInitializing}
    <div class="flex-1 flex flex-col items-center justify-center bg-cream">
       <div class="w-16 h-16 bg-white rounded-[20px] flex flex-col items-center justify-center shadow-sm border border-black/5 mb-6 animate-pulse">
         <ArrowUp class="text-black mb-[-4px]" size={18} strokeWidth={3} />
         <BookOpen class="text-[#FF5B14]" size={28} strokeWidth={2.5} />
       </div>
       <p class="text-[10px] font-extrabold text-[#1C2033] uppercase tracking-[0.2em] animate-pulse">Initializing engine...</p>
    </div>
  {:else}
    <main class="flex-1 flex flex-col {currentView === 'chat' ? 'overflow-hidden' : 'overflow-y-auto'} relative bg-cream">
    {#if currentView === 'landing'}
      <LandingView onstart={handleStart} onlogin={handleLogin} onsignup={handleSignUp} onabout={() => currentView = 'about'} />
    {:else if currentView === 'login'}
      <LoginView initialRole={authRole} onback={handleBack} onsuccess={handleStart} onswitchtosignup={() => currentView = 'signup'} />
    {:else if currentView === 'signup'}
      <SignupView initialRole={authRole} onback={handleBack} onsuccess={handleStart} />
    {:else if currentView === 'about'}
      <AboutView onback={handleBack} />
    {:else if currentView === 'dashboard'}
      {#if authRole === 'student'}
        <StudentDashboard 
          onnavigate={handleNavigate}
          onviewnews={() => currentView = 'news'}
          onviewbookmarks={() => currentView = 'bookmarks'}
          onviewmessages={() => currentView = 'messages'}
          onviewnotifications={() => currentView = 'notifications'}
          onviewprofile={() => currentView = 'profile'}
          onviewtimetable={() => currentView = 'timetable'}
          onviewcatalogue={() => currentView = 'catalogue'}
          onviewnotes={() => currentView = 'shared_notes'}
          onviewvideos={() => currentView = 'videos'}
          onviewdailyquestion={() => currentView = 'tasks'}
          onviewideas={() => currentView = 'ideas'}
          onviewprogress={() => currentView = 'progress'}
          onviewclasses={() => currentView = 'subscribed_classes'}
          onjoinclass={() => currentView = 'social'}
          onviewfeeds={() => currentView = 'feeds'}
          onviewleaderboard={() => currentView = 'leaderboard'}
          onviewpublicprofile={() => currentView = 'public_profile'}
          onviewforum={() => currentView = 'forum'}
          onopenChat={(id, name) => { selectedConversationId = id; selectedContact = name; currentView = 'chat'; }}
          onlogout={handleLogout} 
          userName={userName}
          userClass={userClass}
        />
      {:else if authRole === 'teacher'}
        <TeacherDashboard 
          onnavigate={handleNavigate}
          onverify={() => currentView = 'verification'}
          onstartclass={() => currentView = 'virtual_classroom'}
          onviewnews={() => currentView = 'news'}
          onviewfeeds={() => currentView = 'feeds'}
          onviewbookmarks={() => currentView = 'bookmarks'}
          onviewtimetable={() => currentView = 'timetable'}
          onviewmarking={() => currentView = 'marking'}
          onviewforum={() => currentView = 'forum'}
          onviewconnections={() => currentView = 'social'}
          onviewideas={() => currentView = 'ideas'}
          onlogout={handleLogout} 
          userName={userName}
        />
      {:else if authRole === 'administrator'}
        <AdministratorDashboard 
          onnavigate={handleNavigate}
          onviewnews={() => currentView = 'news'}
          onviewtimetable={() => currentView = 'timetable'}
          onviewfeeds={() => currentView = 'feeds'}
          onviewideas={() => currentView = 'ideas'}
          onviewforum={() => currentView = 'forum'}
          onviewconnections={() => currentView = 'social'}
          onlogout={handleLogout} 
          userName={userName}
        />
      {:else if authRole === 'parent'}
        <ParentDashboard 
          onnavigate={handleNavigate}
          onviewnews={() => currentView = 'news'}
          onviewfeeds={() => currentView = 'feeds'}
          onviewconnections={() => currentView = 'social'}
          onviewideas={() => currentView = 'ideas'}
          onlogout={handleLogout} 
          userName={userName}
        />
      {:else}
        <div class="p-8 text-center mt-20">
          <h1 class="text-2xl font-bold">In progress...</h1>
          <p class="mt-4">The {authRole} dashboard is currently being migrated to Svelte.</p>
          <button onclick={handleLogout} class="mt-8 px-6 py-2 bg-[#FF5B14] text-white border-none cursor-pointer rounded-[20px]">Logout</button>
        </div>
      {/if}
    {:else if currentView === 'verify_email_pending'}
      <div class="flex-1 flex flex-col items-center justify-center bg-cream p-8 text-center">
        <Mail class="text-[#FF5B14] mb-6" size={64} />
        <h2 class="text-2xl font-extrabold text-[#1C2033] mb-4">Verify your email</h2>
        <p class="text-slate-500 text-sm mb-8 leading-relaxed">
          We've sent a verification link to your email. Please check your inbox (and spam folder) and click the link to activate your account.
        </p>
        <div class="space-y-4 w-full max-w-xs">
          <button 
            onclick={() => window.location.reload()}
            class="w-full py-4 bg-[#FF5B14] text-white rounded-[20px] font-bold uppercase tracking-widest text-xs border-none cursor-pointer"
          >
            I've verified my email
          </button>
          <button 
            onclick={async () => {
              try {
                 await authService.requestEmailVerification();
                 alert('New verification email sent!');
              } catch (e) {
                 alert('Error sending email. Please try again later.');
              }
            }}
            class="w-full py-4 bg-white border border-black/5 text-[#1C2033] rounded-[20px] font-bold uppercase tracking-widest text-xs cursor-pointer"
          >
            Resend Email
          </button>
          <button 
            onclick={handleLogout}
            class="w-full py-4 bg-transparent text-slate-400 font-bold uppercase tracking-widest text-[10px] cursor-pointer border-none"
          >
            Logout
          </button>
        </div>
      </div>
    {:else if currentView === 'public_profile'}
      <PublicProfileView onback={handleBack} />
    {:else if currentView === 'rules'}
      <RulesView onback={handleBack} />
    {:else if currentView === 'feeds' || currentView === 'school_feeds'}
      <SchoolFeeds role={authRole} onback={handleBack} />
    {:else if currentView === 'forum'}
      <ForumView onviewprofile={() => currentView = 'profile'} onback={handleBack} timeLeft={forumTimer} />
    {:else if currentView === 'messages'}
      <InboxView onback={handleBack} onopenchat={(id, name) => { selectedConversationId = id; selectedContact = name; currentView = 'chat'; }} />
    {:else if currentView === 'chat'}
      <ChatWindow conversationId={selectedConversationId} contactName={selectedContact} onback={handleBack} />
    {:else if currentView === 'share_notes'}
      <ShareNotesView onback={handleBack} />
    {:else if currentView === 'shared_notes'}
      <SharedNotesView onback={handleBack} />
    {:else if currentView === 'social'}
      <SocialView role={authRole} onopenchat={(id, name) => { selectedConversationId = id; selectedContact = name; currentView = 'chat'; }} />
    {:else if currentView === 'results'}
      <StudentResultsView onback={handleBack} />
    {:else if currentView === 'subscribed_classes'}
      <SubscribedClassesView onback={handleBack} onopenclass={() => currentView = 'virtual_classroom'} />
    {:else if currentView === 'tasks' || currentView === 'bounty'}
      <TasksView onback={handleBack} />
    {:else if currentView === 'verification'}
      <TeacherVerification onback={handleBack} onsubmit={() => currentView = 'dashboard'} />
    {:else if currentView === 'timetable'}
      <TimetableView role={authRole as any} onback={handleBack} />
    {:else if currentView === 'videos'}
      <VideosView onback={handleBack} />
    {:else if currentView === 'virtual_classroom'}
      <VirtualClassroomView role={authRole as any} onleave={handleBack} />
    {:else if currentView === 'portfolio'}
      <PortfolioView onback={handleBack} />
    {:else if currentView === 'profile'}
      <ProfileView onback={handleBack} onlogout={handleLogout} />
    {:else if currentView === 'progress'}
      <ProgressView onback={handleBack} />
    {:else if currentView === 'bookmarks'}
      <BookmarksView onback={handleBack} />
    {:else if currentView === 'news'}
      <NewsView onback={handleBack} />
    {:else if currentView === 'notifications'}
      <NotificationsView onback={handleBack} />
    {:else if currentView === 'ideas'}
      <IdeasView onback={handleBack} />
    {:else if currentView === 'leaderboard'}
      <LeaderboardView onback={handleBack} />
    {:else if currentView === 'marking'}
      <MarkingView onback={handleBack} />
    {:else if currentView === 'catalogue'}
      <ExamCatalogue onback={handleBack} onselectexam={(exam) => { selectedExam = exam; currentView = 'exam'; }} />
    {:else if currentView === 'exam'}
      <ExamView exam={selectedExam} onexit={handleBack} />
    {:else}
      <PlaceholderView viewName={currentView} onback={handleBack} />
    {/if}
  </main>

  {#if showBottomNav}
    <BottomNav {currentView} onnavigate={handleNavigate} />
  {/if}

  {#if showExitDialog}
    <div class="fixed inset-0 bg-black/50 flex flex-col justify-end z-[100] animate-in fade-in">
      <div class="w-full bg-white rounded-t-[28px] p-8 space-y-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
        <p class="text-[#00274d] text-lg font-extrabold text-center">Exit Educore?</p>
        <div class="flex gap-4">
          <button class="flex-1 py-4 rounded-[20px] bg-[#e7efff] text-[#00274d] font-bold text-sm tracking-wide active:scale-95 transition-transform"
            onclick={() => showExitDialog = false}>Stay</button>
          <button class="flex-1 py-4 rounded-[20px] bg-[#FF5B14] text-white font-bold text-sm tracking-wide active:scale-95 transition-transform"
            onclick={handleExitPWA}>Exit</button>
        </div>
      </div>
    </div>
  {/if}
{/if}
</div>
