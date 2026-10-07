<script lang="ts">
  import { ChevronLeft, ChevronDown, User, Mail, Lock, School, GraduationCap, ArrowRight, ArrowUp, BookOpen, Users, MessageCircle, Loader2, Eye, EyeOff, Check, Search, X } from 'lucide-svelte';
  import { authService } from '../services/authService';
  import { wakitService } from '../services/wakitService';
  import { fade, scale } from 'svelte/transition';

  const COUNTRIES_WITH_FLAGS = [
    { name: "Afghanistan", flag: "🇦🇫" },
    { name: "Albania", flag: "🇦🇱" },
    { name: "Algeria", flag: "🇩🇿" },
    { name: "Andorra", flag: "🇦🇩" },
    { name: "Angola", flag: "🇦🇴" },
    { name: "Antigua and Barbuda", flag: "🇦🇬" },
    { name: "Argentina", flag: "🇦🇷" },
    { name: "Armenia", flag: "🇦🇲" },
    { name: "Australia", flag: "🇦🇺" },
    { name: "Austria", flag: "🇦🇹" },
    { name: "Azerbaijan", flag: "🇦🇿" },
    { name: "Bahamas", flag: "🇧🇸" },
    { name: "Bahrain", flag: "🇧🇭" },
    { name: "Bangladesh", flag: "🇧🇩" },
    { name: "Barbados", flag: "🇧🇧" },
    { name: "Belarus", flag: "🇧🇾" },
    { name: "Belgium", flag: "🇧🇪" },
    { name: "Belize", flag: "🇧🇿" },
    { name: "Benin", flag: "🇧🇯" },
    { name: "Bhutan", flag: "🇧🇹" },
    { name: "Bolivia", flag: "🇧🇴" },
    { name: "Bosnia and Herzegovina", flag: "🇧🇦" },
    { name: "Botswana", flag: "🇧🇼" },
    { name: "Brazil", flag: "🇧🇷" },
    { name: "Brunei", flag: "🇧🇳" },
    { name: "Bulgaria", flag: "🇧🇬" },
    { name: "Burkina Faso", flag: "🇧🇫" },
    { name: "Burundi", flag: "🇧🇮" },
    { name: "Cabo Verde", flag: "🇨🇻" },
    { name: "Cambodia", flag: "🇰🇭" },
    { name: "Cameroon", flag: "🇨🇲" },
    { name: "Canada", flag: "🇨🇦" },
    { name: "Central African Republic", flag: "🇨🇫" },
    { name: "Chad", flag: "🇹🇩" },
    { name: "Chile", flag: "🇨🇱" },
    { name: "China", flag: "🇨🇳" },
    { name: "Colombia", flag: "🇨🇴" },
    { name: "Comoros", flag: "🇰🇲" },
    { name: "Congo (Congo-Brazzaville)", flag: "🇨🇬" },
    { name: "Costa Rica", flag: "🇨🇷" },
    { name: "Croatia", flag: "🇭🇷" },
    { name: "Cuba", flag: "🇨🇺" },
    { name: "Cyprus", flag: "🇨🇾" },
    { name: "Czechia (Czech Republic)", flag: "🇨🇿" },
    { name: "Democratic Republic of the Congo", flag: "🇨🇩" },
    { name: "Denmark", flag: "🇩🇰" },
    { name: "Djibouti", flag: "🇩🇯" },
    { name: "Dominica", flag: "🇩🇲" },
    { name: "Dominican Republic", flag: "🇩🇴" },
    { name: "Ecuador", flag: "🇪🇨" },
    { name: "Egypt", flag: "🇪🇬" },
    { name: "El Salvador", flag: "🇸🇻" },
    { name: "Equatorial Guinea", flag: "🇬🇶" },
    { name: "Eritrea", flag: "🇪🇷" },
    { name: "Estonia", flag: "🇪🇪" },
    { name: "Eswatini (fmr. 'Swaziland')", flag: "🇸🇿" },
    { name: "Ethiopia", flag: "🇪🇹" },
    { name: "Fiji", flag: "🇫🇯" },
    { name: "Finland", flag: "🇫🇮" },
    { name: "France", flag: "🇫🇷" },
    { name: "Gabon", flag: "🇬🇦" },
    { name: "Gambia", flag: "🇬🇲" },
    { name: "Georgia", flag: "🇬🇪" },
    { name: "Germany", flag: "🇩🇪" },
    { name: "Ghana", flag: "🇬🇭" },
    { name: "Greece", flag: "🇬🇷" },
    { name: "Grenada", flag: "🇬🇩" },
    { name: "Guatemala", flag: "🇬🇹" },
    { name: "Guinea", flag: "🇬🇳" },
    { name: "Guinea-Bissau", flag: "🇬🇼" },
    { name: "Guyana", flag: "🇬🇾" },
    { name: "Haiti", flag: "🇭🇹" },
    { name: "Holy See", flag: "🇻🇦" },
    { name: "Honduras", flag: "🇭🇳" },
    { name: "Hungary", flag: "🇭🇺" },
    { name: "Iceland", flag: "🇮🇸" },
    { name: "India", flag: "🇮🇳" },
    { name: "Indonesia", flag: "🇮🇩" },
    { name: "Iran", flag: "🇮🇷" },
    { name: "Iraq", flag: "🇮🇶" },
    { name: "Ireland", flag: "🇮🇪" },
    { name: "Israel", flag: "🇮🇱" },
    { name: "Italy", flag: "🇮🇹" },
    { name: "Jamaica", flag: "🇯🇲" },
    { name: "Japan", flag: "🇯🇵" },
    { name: "Jordan", flag: "🇯🇴" },
    { name: "Kazakhstan", flag: "🇰🇿" },
    { name: "Kenya", flag: "🇰🇪" },
    { name: "Kiribati", flag: "🇰🇮" },
    { name: "Kuwait", flag: "🇰🇼" },
    { name: "Kyrgyzstan", flag: "🇰🇬" },
    { name: "Laos", flag: "🇱🇦" },
    { name: "Latvia", flag: "🇱🇻" },
    { name: "Lebanon", flag: "🇱🇧" },
    { name: "Lesotho", flag: "🇱🇸" },
    { name: "Liberia", flag: "🇱🇷" },
    { name: "Libya", flag: "🇱🇾" },
    { name: "Liechtenstein", flag: "🇱🇮" },
    { name: "Lithuania", flag: "🇱🇹" },
    { name: "Luxembourg", flag: "🇱🇺" },
    { name: "Madagascar", flag: "🇲🇬" },
    { name: "Malawi", flag: "🇲🇼" },
    { name: "Malaysia", flag: "🇲🇾" },
    { name: "Maldives", flag: "🇲🇻" },
    { name: "Mali", flag: "🇲🇱" },
    { name: "Malta", flag: "🇲🇹" },
    { name: "Marshall Islands", flag: "🇲🇭" },
    { name: "Mauritania", flag: "🇲🇷" },
    { name: "Mauritius", flag: "🇲🇺" },
    { name: "Mexico", flag: "🇲🇽" },
    { name: "Micronesia", flag: "🇫🇲" },
    { name: "Moldova", flag: "🇲🇩" },
    { name: "Monaco", flag: "🇲🇨" },
    { name: "Mongolia", flag: "🇲🇳" },
    { name: "Montenegro", flag: "🇲🇪" },
    { name: "Morocco", flag: "🇲🇦" },
    { name: "Mozambique", flag: "🇲🇿" },
    { name: "Myanmar (formerly Burma)", flag: "🇲🇲" },
    { name: "Namibia", flag: "🇳🇦" },
    { name: "Nauru", flag: "🇳🇷" },
    { name: "Nepal", flag: "🇳🇵" },
    { name: "Netherlands", flag: "🇳🇱" },
    { name: "New Zealand", flag: "🇳🇿" },
    { name: "Nicaragua", flag: "🇳🇮" },
    { name: "Niger", flag: "🇳🇪" },
    { name: "Nigeria", flag: "🇳🇬" },
    { name: "North Korea", flag: "🇰🇵" },
    { name: "North Macedonia", flag: "🇲🇰" },
    { name: "Norway", flag: "🇳🇴" },
    { name: "Oman", flag: "🇴🇲" },
    { name: "Pakistan", flag: "🇵🇰" },
    { name: "Palau", flag: "🇵🇼" },
    { name: "Palestine State", flag: "🇵🇸" },
    { name: "Panama", flag: "🇵🇦" },
    { name: "Papua New Guinea", flag: "🇵🇬" },
    { name: "Paraguay", flag: "🇵🇾" },
    { name: "Peru", flag: "🇵🇪" },
    { name: "Philippines", flag: "🇵🇭" },
    { name: "Poland", flag: "🇵🇱" },
    { name: "Portugal", flag: "🇵🇹" },
    { name: "Qatar", flag: "🇶🇦" },
    { name: "Romania", flag: "🇷🇴" },
    { name: "Russia", flag: "🇷🇺" },
    { name: "Rwanda", flag: "🇷🇼" },
    { name: "Saint Kitts and Nevis", flag: "🇰🇳" },
    { name: "Saint Lucia", flag: "🇱🇨" },
    { name: "Saint Vincent and the Grenadines", flag: "🇻🇨" },
    { name: "Samoa", flag: "🇼🇸" },
    { name: "San Marino", flag: "🇸🇲" },
    { name: "Sao Tome and Principe", flag: "🇸🇹" },
    { name: "Saudi Arabia", flag: "🇸🇦" },
    { name: "Senegal", flag: "🇸🇳" },
    { name: "Serbia", flag: "🇷🇸" },
    { name: "Seychelles", flag: "🇸🇨" },
    { name: "Sierra Leone", flag: "🇸🇱" },
    { name: "Singapore", flag: "🇸🇬" },
    { name: "Slovakia", flag: "🇸🇰" },
    { name: "Slovenia", flag: "🇸🇮" },
    { name: "Solomon Islands", flag: "🇸🇧" },
    { name: "Somalia", flag: "🇸🇴" },
    { name: "South Africa", flag: "🇿🇦" },
    { name: "South Korea", flag: "🇰🇷" },
    { name: "South Sudan", flag: "🇸🇸" },
    { name: "Spain", flag: "🇪🇸" },
    { name: "Sri Lanka", flag: "🇱🇰" },
    { name: "Sudan", flag: "🇸🇩" },
    { name: "Suriname", flag: "🇸🇷" },
    { name: "Sweden", flag: "🇸🇪" },
    { name: "Switzerland", flag: "🇨🇭" },
    { name: "Syria", flag: "🇸🇾" },
    { name: "Tajikistan", flag: "🇹🇯" },
    { name: "Tanzania", flag: "🇹🇿" },
    { name: "Thailand", flag: "🇹🇭" },
    { name: "Timor-Leste", flag: "🇹🇱" },
    { name: "Togo", flag: "🇹🇬" },
    { name: "Tonga", flag: "🇹🇴" },
    { name: "Trinidad and Tobago", flag: "🇹🇹" },
    { name: "Tunisia", flag: "🇹🇳" },
    { name: "Turkey", flag: "🇹🇷" },
    { name: "Turkmenistan", flag: "🇹🇲" },
    { name: "Tuvalu", flag: "🇹🇻" },
    { name: "Uganda", flag: "🇺🇬" },
    { name: "Ukraine", flag: "🇺🇦" },
    { name: "United Arab Emirates", flag: "🇦🇪" },
    { name: "United Kingdom", flag: "🇬🇧" },
    { name: "United States of America", flag: "🇺🇸" },
    { name: "Uruguay", flag: "🇺🇾" },
    { name: "Uzbekistan", flag: "🇺🇿" },
    { name: "Vanuatu", flag: "🇻🇺" },
    { name: "Venezuela", flag: "🇻🇪" },
    { name: "Vietnam", flag: "🇻🇳" },
    { name: "Yemen", flag: "🇾🇪" },
    { name: "Zambia", flag: "🇿🇲" },
    { name: "Zimbabwe", flag: "🇿🇼" }
  ].sort((a, b) => {
    if (a.name === "Uganda") return -1;
    if (b.name === "Uganda") return 1;
    return a.name.localeCompare(b.name);
  });

  const CLASS_LEVELS = {
    'Uganda': [
      { id: 'P1', label: 'P1', group: 'Primary' },
      { id: 'P2', label: 'P2', group: 'Primary' },
      { id: 'P3', label: 'P3', group: 'Primary' },
      { id: 'P4', label: 'P4', group: 'Primary' },
      { id: 'P5', label: 'P5', group: 'Primary' },
      { id: 'P6', label: 'P6', group: 'Primary' },
      { id: 'P7', label: 'P7', group: 'Primary' },
      { id: 'S1', label: 'S1', group: 'O-Level' },
      { id: 'S2', label: 'S2', group: 'O-Level' },
      { id: 'S3', label: 'S3', group: 'O-Level' },
      { id: 'S4', label: 'S4', group: 'O-Level' },
      { id: 'S5', label: 'S5', group: 'A-Level' },
      { id: 'S6', label: 'S6', group: 'A-Level' }
    ],
    'Default': [
      { id: 'G1', label: 'G1', group: 'Primary' },
      { id: 'G2', label: 'G2', group: 'Primary' },
      { id: 'G3', label: 'G3', group: 'Primary' },
      { id: 'G4', label: 'G4', group: 'Primary' },
      { id: 'G5', label: 'G5', group: 'Primary' },
      { id: 'G6', label: 'G6', group: 'Primary' },
      { id: 'G7', label: 'G7', group: 'Primary' },
      { id: 'G8', label: 'G8', group: 'Secondary' },
      { id: 'F1', label: 'F1', group: 'Secondary' },
      { id: 'F2', label: 'F2', group: 'Secondary' },
      { id: 'F3', label: 'F3', group: 'Secondary' },
      { id: 'F4', label: 'F4', group: 'Secondary' },
      { id: 'F5', label: 'F5', group: 'Secondary' },
      { id: 'F6', label: 'F6', group: 'Secondary' },
      { id: 'UNI', label: 'Undergraduate', group: 'Higher' },
      { id: 'OTHER', label: 'Other', group: 'Other' }
    ]
  };

  let { initialRole = 'student', isFreeTry = false, onback, onsuccess } = $props<{
    initialRole?: string;
    isFreeTry?: boolean;
    onback?: () => void;
    onsuccess?: (role: string) => void;
  }>();

  let step = $state(1);
  let role = $state(initialRole && initialRole !== 'guest' && initialRole !== 'landing' ? initialRole : 'student');
  
  // Auth inputs
  let surname = $state('');
  let middleName = $state('');
  let lastName = $state('');
  let email = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let showPassword = $state(false);
  let showConfirmPassword = $state(false);
  
  // Student specific IDs
  let studentNIN = $state('');
  let studentLIN = $state('');
  let parentNIN = $state('');
  
  // New fields
  let country = $state('Uganda');
  let district = $state('');
  let age = $state('');
  let studentClass = $state('');
  let schoolName = $state('');
  let countrySelectorOpen = $state(false);
  let classSelectorOpen = $state(false);
  let countrySearch = $state('');
  
  const filteredCountries = $derived(
    countrySearch 
      ? COUNTRIES_WITH_FLAGS.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase())) 
      : COUNTRIES_WITH_FLAGS
  );

  const selectedCountryObj = $derived(
    COUNTRIES_WITH_FLAGS.find(c => c.name === country) || { name: 'Uganda', flag: '🇺🇬' }
  );

  const availableClasses = $derived(
    CLASS_LEVELS[country as keyof typeof CLASS_LEVELS] || CLASS_LEVELS['Default']
  );

  const formattedClass = $derived(
    studentClass || 'Select Class'
  );
  let parentContact = $state('');
  let whatsappContact = $state('');
  let generatedExupCode = $state('');

  let loading = $state(false);
  let whatsappLoading = $state(false);
  let error = $state('');

  async function handleWhatsAppSignup() {
    whatsappLoading = true;
    error = '';
    
    try {
      const url = wakitService.getWhatsAppLoginUrl();
      window.open(url, '_blank');
      error = 'WhatsApp verification started. Please complete it in WhatsApp.';
    } catch (err: any) {
      error = 'WhatsApp signup failed: ' + err.message;
    } finally {
      whatsappLoading = false;
    }
  }

  let accessCode = $state('');
  let accessMode = $state<'individual' | 'school-code' | 'school-pay'>('individual');
  let selectedTier = $state<string>('monthly');
  let showMobileMoneyOptions = $state(false);

  async function handleSignup() {
    const isStudent = role === 'student';
    // Clean phone number (strip spaces, dashes, etc)
    const phoneNum = whatsappContact.trim().replace(/[\s\-()]/g, '');
    
    if (!surname || !lastName || !password || !confirmPassword || !age || !schoolName || !district || !country || (isStudent && !studentClass) || !phoneNum) {
      if (!phoneNum) {
        error = 'Phone Number is mandatory. Please provide a valid WhatsApp number to continue.';
      } else {
        error = 'Please fill in all required fields (Names, Age, School, District and Country).';
      }
      return;
    }

    if (password !== confirmPassword) {
      error = 'Passwords do not match';
      return;
    }

    loading = true;
    error = '';

    try {
      // Pass the extra profile data to the signup service
      const user = await authService.signup(email.trim(), password, { surname: surname.trim(), middleName: middleName.trim(), lastName: lastName.trim() }, role, {
        studentNIN: studentNIN.trim(),
        studentLIN: studentLIN.trim(),
        parentNIN: parentNIN.trim(),
        age: age.toString(),
        studentClass,
        country,
        district: district.trim(),
        school: schoolName.trim(),
        parentContact: parentContact.trim(),
        whatsappContact: phoneNum
      });
      generatedExupCode = (user as any).prefs?.exupCode || '';
      
      // Automatic email verification request ONLY IF real email provided
      if (email) {
        try {
          await authService.requestEmailVerification();
        } catch (verifErr) {
          console.warn('Could not send verification email automatically:', verifErr);
        }
      }

      handleStep2();
    } catch (err: any) {
      if (err.message && (err.message.includes('timed out') || err.message.includes('Failed to fetch') || err.message.includes('network'))) {
         error = 'Signup timed out or failed to connect. Please check your connection.';
      } else {
         error = err.message || 'Signup failed. Please try again.';
      }
      console.error(err);
    } finally {
      loading = false;
    }
  }

  const retailTiers = [
    { id: 'daily', name: 'Daily Pass', price: '500', value: 'Impulse buy' },
    { id: 'weekly', name: 'Weekly Pass', price: '2,500', value: 'Pocket money cycles' },
    { id: 'monthly', name: 'Monthly Pass', price: '8,000', value: 'Revision focus' },
    { id: 'termly', name: 'Termly Pass', price: '28,000', value: 'Includes Holiday Cover' },
  ];

  const schoolTiers = [
    { id: 'small', name: 'Community/Small', price: '450,000', range: '< 300 students' },
    { id: 'standard', name: 'Standard Private', price: '950,000', range: '300 - 800 students' },
    { id: 'elite', name: 'Elite / Large', price: '1,800,000', range: '800 - 1,500+ students' },
  ];

  function handleStep2() {
    if (isFreeTry || role === 'parent') {
      step = 4;
    } else if (role === 'teacher') {
      accessMode = 'school-code';
      step = 3;
    } else if (role === 'administrator') {
      accessMode = 'school-pay';
      step = 3;
    } else {
      accessMode = 'individual';
      step = 3;
    }
  }
</script>

<div class="flex-1 w-full bg-theme-paper flex flex-col font-sans overflow-hidden">
  <div class="flex-shrink-0 px-6 pt-6 pb-2">
    <header class="flex items-center justify-between mb-4">
      <div class="flex items-center">
        <button onclick={() => onback?.()} class="p-2 -ml-2 text-slate-400 hover:text-[#202936] bg-theme-card rounded-full shadow-sm border border-black/5 transition-colors cursor-pointer">
          <ChevronLeft size={20} />
        </button>
      </div>
      <!-- ExupLogo simplified -->
      <div class="flex flex-col items-center justify-center">
         <div class="w-10 h-10 bg-theme-card rounded-[20px] flex flex-col items-center justify-center shadow-sm relative border border-black/5">
           <ArrowUp class="text-black mb-[-2px]" size={12} strokeWidth={3} />
           <BookOpen class="text-[#E58A3A]" size={20} strokeWidth={2.5} />
         </div>
      </div>
    </header>

    <div class="max-w-sm mx-auto w-full">
      <div class="flex gap-2 mb-4">
        <div class="h-1.5 flex-1 rounded-full text-transparent {step >= 1 ? 'bg-[#E58A3A]' : 'bg-black/5'}"></div>
        <div class="h-1.5 flex-1 rounded-full text-transparent {step >= 2 ? 'bg-[#E58A3A]' : 'bg-black/5'}"></div>
        {#if !isFreeTry}
          <div class="h-1.5 flex-1 rounded-full text-transparent {step >= 3 ? 'bg-[#E58A3A]' : 'bg-black/5'}"></div>
        {/if}
      </div>
      <h3 class="text-2xl font-extrabold text-[#202936] mb-1 tracking-tight">
        {step === 1 ? "Choose your role" : step === 2 ? "The basics" : step === 3 ? "Access & Payment" : "Welcome!"}
      </h3>
      <p class="text-slate-500 text-xs font-medium">
        {#if step === 1}
          How will you be using Xpresso?
        {:else if step === 2}
          Fill in your details to get started.
        {:else if step === 3}
          Choose the best plan for your revision goals.
        {:else}
          You are all set.
        {/if}
      </p>
    </div>
  </div>

  <div class="flex-1 overflow-y-auto px-6 pb-12 scroll-smooth">
    <div class="max-w-sm mx-auto w-full pt-2">
      {#if step === 1}
      <div class="space-y-4">
        <button 
          onclick={() => role = 'student'}
          class="w-full p-5 rounded-[20px] transition-all flex items-center gap-4 bg-theme-card cursor-pointer {role === 'student' ? 'border-2 border-[#E58A3A] shadow-sm' : 'border-2 border-transparent shadow shadow-black/5'}"
        >
          <div class="w-12 h-12 rounded-[20px] flex items-center justify-center {role === 'student' ? 'bg-[#E58A3A] text-white' : 'bg-slate-100 text-slate-400'}">
            <GraduationCap size={24} />
          </div>
          <div class="text-left font-extrabold text-[#202936]">I am a Student</div>
        </button>
        <button 
          onclick={() => role = 'teacher'}
          class="w-full p-5 rounded-[20px] transition-all flex items-center gap-4 bg-theme-card cursor-pointer {role === 'teacher' ? 'border-2 border-[#202936] shadow-sm' : 'border-2 border-transparent shadow shadow-black/5'}"
        >
          <div class="w-12 h-12 rounded-[20px] flex items-center justify-center {role === 'teacher' ? 'bg-[#202936] text-white' : 'bg-slate-100 text-slate-400'}">
            <School size={24} />
          </div>
          <div class="text-left font-extrabold text-[#202936]">I am a Teacher</div>
        </button>
        <button 
          onclick={() => role = 'administrator'}
          class="w-full p-5 rounded-[20px] transition-all flex items-center gap-4 bg-theme-card cursor-pointer {role === 'administrator' ? 'border-2 border-[#202936] shadow-sm' : 'border-2 border-transparent shadow shadow-black/5'}"
        >
          <div class="w-12 h-12 rounded-[20px] flex items-center justify-center {role === 'administrator' ? 'bg-[#202936] text-white' : 'bg-slate-100 text-slate-400'}">
            <User size={24} />
          </div>
          <div class="text-left font-extrabold text-[#202936]">School Administrator</div>
        </button>
        <button 
          onclick={() => role = 'parent'}
          class="w-full p-5 rounded-[20px] transition-all flex items-center gap-4 bg-theme-card cursor-pointer {role === 'parent' ? 'border-2 border-[#202936] shadow-sm' : 'border-2 border-transparent shadow shadow-black/5'}"
        >
          <div class="w-12 h-12 rounded-[20px] flex items-center justify-center {role === 'parent' ? 'bg-[#202936] text-white' : 'bg-slate-100 text-slate-400'}">
            <Users size={24} />
          </div>
          <div class="text-left font-extrabold text-[#202936]">I am a Parent</div>
        </button>

        <button 
          onclick={() => step = 2}
          class="w-full mt-10 py-4 bg-[#E58A3A] text-white rounded-[20px] shadow-sm font-extrabold uppercase tracking-[0.1em] text-xs flex items-center justify-between px-6 hover:shadow-md transition-all active:scale-95 cursor-pointer border-none"
        >
          <span class="flex-1 text-center pl-6">Step Two</span>
          <ArrowRight size={18} />
        </button>
      </div>
    {:else if step === 2}
      <div class="space-y-6">
        <button 
          onclick={handleWhatsAppSignup}
          disabled={whatsappLoading}
          class="w-full py-4 bg-[#25D366] text-white rounded-[20px] font-extrabold uppercase tracking-[0.1em] text-xs shadow-md shadow-[#25D366]/20 flex items-center justify-center gap-3 hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
        >
          {#if whatsappLoading}
              <Loader2 size={18} class="animate-spin" />
          {:else}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .006 5.408 0 12.045c0 2.121.554 4.191 1.602 6.005L0 24l6.149-1.613a11.817 11.817 0 005.897 1.568h.005c6.631 0 12.046-5.408 12.052-12.046a11.817 11.817 0 00-3.691-8.52"/>
              </svg>
              Quick Setup with WhatsApp
          {/if}
        </button>

        <div class="flex items-center gap-4 py-2">
          <div class="flex-1 h-px bg-black/5"></div>
          <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">OR USE EMAIL</span>
          <div class="flex-1 h-px bg-black/5"></div>
        </div>

        <div class="space-y-4">
          {#if error}
            <div class="bg-red-50 border border-red-100 text-red-600 text-[10px] font-bold uppercase tracking-widest p-4 rounded-[20px] text-center">
              {error}
            </div>
          {/if}

          <div class="grid grid-cols-1 gap-4">
            <div class="space-y-1.5">
              <label for="surname" class="text-[9px] font-extrabold text-[#E58A3A] uppercase tracking-widest ml-1">Surname</label>
              <div class="relative">
                <User class="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                <input 
                  id="surname"
                  type="text" 
                  bind:value={surname}
                  placeholder="Family Name" 
                  class="w-full bg-theme-card border border-black/5 rounded-[20px] py-4 pl-12 pr-4 text-sm focus:ring-1 focus:ring-[#E58A3A] focus:border-[#E58A3A] outline-none transition-all shadow-sm font-bold text-[#202936]"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <label for="middleName" class="text-[9px] font-extrabold text-[#E58A3A] uppercase tracking-widest ml-1">Middle Name (Optional)</label>
                <div class="relative">
                  <User class="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                  <input 
                    id="middleName"
                    type="text" 
                    bind:value={middleName}
                    placeholder="Middle" 
                    class="w-full bg-theme-card border border-black/5 rounded-[20px] py-4 pl-12 pr-4 text-sm focus:ring-1 focus:ring-[#E58A3A] focus:border-[#E58A3A] outline-none transition-all shadow-sm font-bold text-[#202936]"
                  />
                </div>
              </div>
              <div class="space-y-1.5">
                <label for="lastName" class="text-[9px] font-extrabold text-[#E58A3A] uppercase tracking-widest ml-1">Last Name</label>
                <div class="relative">
                  <User class="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                  <input 
                    id="lastName"
                    type="text" 
                    bind:value={lastName}
                    placeholder="Given Name" 
                    class="w-full bg-theme-card border border-black/5 rounded-[20px] py-4 pl-12 pr-4 text-sm focus:ring-1 focus:ring-[#E58A3A] focus:border-[#E58A3A] outline-none transition-all shadow-sm font-bold text-[#202936]"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div class="space-y-1.5">
            <label for="phone" class="text-[9px] font-extrabold text-[#E58A3A] uppercase tracking-widest ml-1">Phone Number</label>
            <div class="relative">
              <MessageCircle class="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
              <input 
                id="phone"
                type="tel" 
                bind:value={whatsappContact}
                placeholder="e.g. 256700000000" 
                class="w-full bg-theme-card border border-black/5 rounded-[20px] py-4 pl-12 pr-4 text-sm focus:ring-1 focus:ring-[#E58A3A] focus:border-[#E58A3A] outline-none transition-all shadow-sm font-bold text-[#202936]"
              />
            </div>
          </div>

          <div class="space-y-1.5">
            <label for="signup-email" class="text-[9px] font-extrabold text-[#E58A3A] uppercase tracking-widest ml-1">Email Address (Optional)</label>
            <div class="relative">
              <Mail class="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
              <input 
                id="signup-email"
                type="email" 
                bind:value={email}
                placeholder="Email Address (Optional)" 
                class="w-full bg-theme-card border border-black/5 rounded-[20px] py-4 pl-12 pr-4 text-sm focus:ring-1 focus:ring-[#E58A3A] focus:border-[#E58A3A] outline-none transition-all shadow-sm font-bold text-[#202936]"
              />
            </div>
          </div>
          <div class="relative">
            <Lock class="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type={showPassword ? "text" : "password"} 
              bind:value={password}
              placeholder="Password" 
              class="w-full bg-theme-card border border-black/5 rounded-[20px] py-4 pl-12 pr-12 text-sm focus:ring-1 focus:ring-[#E58A3A] focus:border-[#E58A3A] outline-none transition-all shadow-sm font-bold text-[#202936]"
            />
            <button 
              type="button"
              onclick={() => showPassword = !showPassword}
              class="absolute right-4 top-1/2 -translate-y-1/2 border-none bg-transparent text-slate-400 hover:text-[#E58A3A] cursor-pointer"
            >
              {#if showPassword}
                <EyeOff size={18} />
              {:else}
                <Eye size={18} />
              {/if}
            </button>
          </div>

          <div class="relative">
            <Lock class="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type={showConfirmPassword ? "text" : "password"} 
              bind:value={confirmPassword}
              placeholder="Confirm Password" 
              class="w-full bg-theme-card border border-black/5 rounded-[20px] py-4 pl-12 pr-12 text-sm focus:ring-1 focus:ring-[#E58A3A] focus:border-[#E58A3A] outline-none transition-all shadow-sm font-bold text-[#202936]"
            />
            <button 
              type="button"
              onclick={() => showConfirmPassword = !showConfirmPassword}
              class="absolute right-4 top-1/2 -translate-y-1/2 border-none bg-transparent text-slate-400 hover:text-[#E58A3A] cursor-pointer"
            >
              {#if showConfirmPassword}
                <EyeOff size={18} />
              {:else}
                <Eye size={18} />
              {/if}
            </button>
          </div>

          {#if role === 'student'}
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <label for="studentNIN" class="text-[9px] font-bold text-[#E58A3A] uppercase tracking-widest ml-1">Student NIN</label>
                <input 
                  id="studentNIN"
                  type="text" 
                  bind:value={studentNIN}
                  placeholder="Optional" 
                  class="w-full bg-theme-card border border-black/5 rounded-[20px] py-4 px-4 text-xs focus:ring-1 focus:ring-[#E58A3A] focus:border-[#E58A3A] outline-none transition-all shadow-sm font-bold text-[#202936]"
                />
              </div>
              <div class="space-y-1.5">
                <label for="studentLIN" class="text-[9px] font-bold text-[#E58A3A] uppercase tracking-widest ml-1">Student LIN</label>
                <input 
                  id="studentLIN"
                  type="text" 
                  bind:value={studentLIN}
                  placeholder="Optional" 
                  class="w-full bg-theme-card border border-black/5 rounded-[20px] py-4 px-4 text-xs focus:ring-1 focus:ring-[#E58A3A] focus:border-[#E58A3A] outline-none transition-all shadow-sm font-bold text-[#202936]"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <label for="age" class="text-[9px] font-bold text-[#E58A3A] uppercase tracking-widest ml-1">Age</label>
                <input 
                  id="age"
                  type="number" 
                  bind:value={age}
                  placeholder="e.g. 16" 
                  class="w-full bg-theme-card border border-black/5 rounded-[20px] py-4 px-4 text-sm focus:ring-1 focus:ring-[#E58A3A] focus:border-[#E58A3A] outline-none transition-all shadow-sm font-bold text-[#202936]"
                />
              </div>
              <div class="space-y-1.5">
                <label for="country-btn" class="text-[9px] font-bold text-[#E58A3A] uppercase tracking-widest ml-1">Country</label>
                <button 
                  id="country-btn"
                  type="button"
                  onclick={() => countrySelectorOpen = true}
                  class="w-full bg-theme-card border border-black/5 rounded-[20px] py-4 pl-4 pr-10 text-sm focus:ring-1 focus:ring-[#E58A3A] focus:border-[#E58A3A] outline-none transition-all shadow-sm font-bold text-[#202936] flex items-center justify-between text-left cursor-pointer"
                >
                  <span class="flex items-center gap-2">
                    <span class="text-lg leading-none">{selectedCountryObj.flag}</span>
                    {country}
                  </span>
                  <ChevronDown size={16} class="text-slate-400" />
                </button>
              </div>
            </div>

            <div class="space-y-1.5">
              <label for="class-btn" class="text-[9px] font-bold text-[#E58A3A] uppercase tracking-widest ml-1">Class/Level</label>
              <button 
                id="class-btn"
                type="button"
                onclick={() => classSelectorOpen = true}
                class="w-full bg-theme-card border border-black/5 rounded-[20px] py-4 pl-4 pr-10 text-sm focus:ring-1 focus:ring-[#E58A3A] focus:border-[#E58A3A] outline-none transition-all shadow-sm font-bold text-[#202936] flex items-center justify-between text-left cursor-pointer"
              >
                <span class={!studentClass ? 'text-slate-400' : ''}>
                  {formattedClass}
                </span>
                <ChevronDown size={16} class="text-slate-400" />
              </button>
            </div>

            <div class="space-y-4">
              <div class="space-y-1.5">
                <label for="schoolName" class="text-[9px] font-bold text-[#E58A3A] uppercase tracking-widest ml-1">Current School</label>
                <input 
                  id="schoolName"
                  type="text" 
                  bind:value={schoolName}
                  placeholder="e.g. Gayaza High School" 
                  class="w-full bg-theme-card border border-black/5 rounded-[20px] py-4 px-4 text-sm focus:ring-1 focus:ring-[#E58A3A] focus:border-[#E58A3A] outline-none transition-all shadow-sm font-bold text-[#202936]"
                />
              </div>
              
              <div class="space-y-1.5">
                <label for="district" class="text-[9px] font-bold text-[#E58A3A] uppercase tracking-widest ml-1">District</label>
                <input 
                  id="district"
                  type="text" 
                  bind:value={district}
                  placeholder="e.g. Wakiso" 
                  class="w-full bg-theme-card border border-black/5 rounded-[20px] py-4 px-4 text-sm focus:ring-1 focus:ring-[#E58A3A] focus:border-[#E58A3A] outline-none transition-all shadow-sm font-bold text-[#202936]"
                />
              </div>

              <div class="space-y-4">
                <div class="space-y-1.5">
                  <label for="parentContact" class="text-[9px] font-bold text-[#E58A3A] uppercase tracking-widest ml-1">Parent/Guardian Contact (Optional)</label>
                  <input 
                    id="parentContact"
                    type="tel" 
                    bind:value={parentContact}
                    placeholder="256 7xx xxx xxx" 
                    class="w-full bg-theme-card border border-black/5 rounded-[20px] py-4 px-4 text-sm focus:ring-1 focus:ring-[#E58A3A] focus:border-[#E58A3A] outline-none transition-all shadow-sm font-bold text-[#202936]"
                  />
                </div>
              </div>
            </div>

            <div class="p-4 bg-orange-50/50 rounded-[24px] border border-[#E58A3A]/10">
              <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 text-center">Parent Details (Optional)</p>
              <div class="space-y-1.5">
                <label for="parentNIN" class="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Parent NIN (Optional)</label>
                <input 
                  id="parentNIN"
                  type="text" 
                  bind:value={parentNIN}
                  placeholder="NIN Number" 
                  class="w-full bg-theme-card border border-black/5 rounded-[16px] py-3 px-3 text-xs focus:ring-1 focus:ring-[#E58A3A] focus:border-[#E58A3A] outline-none transition-all shadow-sm font-bold text-[#202936]"
                />
              </div>
            </div>
          {/if}
        </div>

        <button 
          onclick={handleSignup}
          disabled={loading}
          class="w-full mt-6 py-4 bg-[#E58A3A] text-white rounded-[20px] shadow-sm font-extrabold uppercase tracking-[0.1em] text-xs flex items-center justify-between px-6 hover:shadow-md transition-all active:scale-95 cursor-pointer border-none disabled:opacity-50"
        >
          <span class="flex-1 text-center pl-6">
            {#if loading}
              Creating Account...
            {:else}
              {isFreeTry || role === 'parent' ? 'Complete Registration' : 'Choose Access'}
            {/if}
          </span>
          {#if loading}
            <Loader2 size={18} class="animate-spin" />
          {:else}
            <ArrowRight size={18} />
          {/if}
        </button>
      </div>
    {:else if step === 3}
      <div class="space-y-6">
        <div class="flex flex-col gap-2 bg-theme-card shadow-sm p-1.5 rounded-[20px] border border-black/5">
          {#if role === 'student'}
            <button 
              onclick={() => accessMode = 'individual'}
              class="w-full py-3 px-2 rounded-[20px] text-[10px] font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer {accessMode === 'individual' ? 'bg-[#E58A3A] text-white shadow-sm' : 'bg-transparent text-slate-400 hover:text-[#202936] border-none'}"
            >
              Individual Pass
            </button>
            <button 
              onclick={() => accessMode = 'school-code'}
              class="w-full py-3 px-2 rounded-[20px] text-[10px] font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer {accessMode === 'school-code' ? 'bg-[#E58A3A] text-white shadow-sm' : 'bg-transparent text-slate-400 hover:text-[#202936] border-none'}"
            >
              School Code
            </button>
          {:else if role === 'administrator'}
            <button 
              onclick={() => accessMode = 'school-pay'}
              class="w-full py-3 px-2 rounded-[20px] text-[10px] font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer {accessMode === 'school-pay' ? 'bg-[#E58A3A] text-white shadow-sm' : 'bg-transparent text-slate-400 hover:text-[#202936] border-none'}"
            >
              B2B Billing
            </button>
          {/if}
        </div>

        <div class="space-y-4">
          {#if accessMode === 'school-code'}
            <div class="p-6 bg-theme-card border border-black/5 rounded-[20px] shadow-sm">
              <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Activation Code</p>
              <input 
                type="text" 
                bind:value={accessCode}
                oninput={(e) => accessCode = e.currentTarget.value.toUpperCase()}
                placeholder="E.G. GAYAZA-2024" 
                class="w-full bg-slate-50 border border-black/5 rounded-[20px] py-4 px-4 text-center font-mono font-bold text-xl text-[#E58A3A] focus:ring-1 focus:ring-[#E58A3A] focus:border-[#E58A3A] outline-none transition-all uppercase"
              />
              <p class="text-[10px] text-slate-500 mt-4 text-center leading-relaxed">Enter the code provided by your school administrator.</p>
            </div>
          {:else if accessMode === 'individual'}
            <div class="space-y-3">
              {#each retailTiers as tier}
                <button 
                  onclick={() => selectedTier = tier.id}
                  class="w-full p-4 rounded-[20px] border-2 flex items-center justify-between transition-all bg-theme-card cursor-pointer {selectedTier === tier.id ? 'border-[#E58A3A] shadow-sm' : 'border-transparent shadow-sm shadow-black/5'}"
                >
                  <div class="text-left">
                    <div class="text-xs font-extrabold text-[#202936] uppercase tracking-wide">{tier.name}</div>
                    <div class="text-[10px] text-slate-400 font-medium mt-0.5">{tier.value}</div>
                  </div>
                  <div class="text-right">
                    <div class="text-sm font-extrabold text-[#E58A3A]">UGX {tier.price}</div>
                    {#if tier.id === 'termly'}
                      <div class="text-[8px] font-bold text-green-500 uppercase mt-0.5">Best Value</div>
                    {/if}
                  </div>
                </button>
              {/each}
            </div>
          {:else}
            <div class="space-y-3">
              <p class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-center mb-2">School Bulk Licensing</p>
              {#each schoolTiers as tier}
                <button 
                  onclick={() => selectedTier = tier.id}
                  class="w-full p-4 rounded-[20px] border-2 flex items-center justify-between transition-all bg-theme-card cursor-pointer {selectedTier === tier.id ? 'border-[#E58A3A] shadow-sm' : 'border-transparent shadow-sm shadow-black/5'}"
                >
                  <div class="text-left">
                    <div class="text-xs font-extrabold text-[#202936] uppercase tracking-wide">{tier.name}</div>
                    <div class="text-[10px] text-slate-400 font-medium mt-0.5">{tier.range}</div>
                  </div>
                  <div class="text-right">
                    <div class="text-sm font-extrabold text-[#E58A3A]">UGX {tier.price}</div>
                    <div class="text-[8px] font-bold text-slate-400 uppercase mt-0.5">Per Term</div>
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        </div>

        {#if accessMode !== 'school-code'}
          <div class="p-5 bg-theme-card border border-black/5 rounded-[20px] shadow-sm">
            <p class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-4">
              {showMobileMoneyOptions ? 'Select Mobile Money Provider' : 'Select Payment Method'}
            </p>
            {#if !showMobileMoneyOptions}
              <button onclick={() => showMobileMoneyOptions = true} class="w-full flex items-center justify-center p-4 rounded-[16px] border border-black/5 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                <span class="text-[11px] font-extrabold text-[#202936] uppercase tracking-wider">Mobile Money</span>
              </button>
            {:else}
              <div class="grid grid-cols-2 gap-3">
                <button class="flex flex-col items-center justify-center p-4 rounded-[16px] border-2 border-[#FFCC00]/30 bg-[#FFCC00]/10 hover:bg-[#FFCC00] hover:text-white transition-colors text-[#CC9900] shadow-sm cursor-pointer border-solid">
                  <span class="text-[10px] font-extrabold uppercase tracking-wider">MTN MoMo</span>
                </button>
                <button class="flex flex-col items-center justify-center p-4 rounded-[16px] border-2 border-red-500/30 bg-red-500/10 hover:bg-red-500 hover:text-white transition-colors text-red-600 shadow-sm cursor-pointer border-solid">
                  <span class="text-[10px] font-extrabold uppercase tracking-wider">Airtel Money</span>
                </button>
              </div>
            {/if}
          </div>
        {/if}

        <button 
          onclick={() => step = 4}
          class="w-full mt-6 py-4 bg-[#202936] text-white rounded-[20px] shadow-md shadow-[#202936]/20 font-extrabold uppercase tracking-[0.1em] text-xs hover:opacity-90 flex items-center justify-between px-6 transition-all active:scale-95 cursor-pointer border-none"
        >
          <span class="flex-1 text-center pl-6">{accessMode === 'school-code' ? 'Activate with Code' : 'Complete Registration'}</span>
          <ArrowRight size={18} />
        </button>
      </div>
    {:else}
      <div class="space-y-6 text-center mt-12">
        <div class="w-24 h-24 bg-orange-100 rounded-[28px] flex items-center justify-center mx-auto text-[#E58A3A] mb-6 shadow-sm">
          <GraduationCap size={48} />
        </div>
        <h3 class="text-3xl font-extrabold text-[#202936]">Welcome {lastName}, to Xpresso</h3>
        <p class="text-sm text-slate-500 max-w-[240px] mx-auto leading-relaxed">Here is your unique Xpresso Code. Share it to connect with others.</p>
        <div class="p-6 bg-theme-card border-2 border-[#E58A3A]/30 border-dashed rounded-[24px] mx-auto font-mono text-2xl text-[#E58A3A] font-extrabold tracking-widest shadow-sm">
          {generatedExupCode || 'Generating...'}
        </div>
        <button 
          onclick={() => onsuccess?.(role)}
          class="w-full mt-10 py-4 bg-[#E58A3A] text-white rounded-[20px] shadow-sm font-extrabold uppercase tracking-[0.1em] text-xs hover:shadow-md transition-all active:scale-95 cursor-pointer border-none"
        >
          Enter Dashboard
        </button>
      </div>
    {/if}
  </div>

  <!-- Country Selector Lightbox -->
  {#if countrySelectorOpen}
    <div 
      class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6"
      transition:fade={{ duration: 200 }}
    >
      <div 
        class="absolute inset-0 bg-[#202936]/40 backdrop-blur-sm" 
        onclick={() => countrySelectorOpen = false}
        aria-hidden="true"
      ></div>
      <div 
        class="bg-theme-card w-full max-w-sm rounded-[32px] overflow-hidden flex flex-col shadow-2xl relative max-h-[70vh]"
        transition:scale={{ duration: 300, start: 0.95, opacity: 0 }}
      >
        <div class="p-5 border-b border-black/5 flex items-center justify-between bg-theme-card sticky top-0 z-10">
          <h4 class="text-sm font-extrabold text-[#202936] uppercase tracking-widest">Select Country</h4>
          <button onclick={() => countrySelectorOpen = false} class="p-2 text-slate-400 hover:text-black transition-colors border-none bg-transparent cursor-pointer">
            <X size={20} />
          </button>
        </div>
        
        <div class="p-4 border-b border-black/5 bg-slate-50/50">
          <div class="relative">
            <Search class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              bind:value={countrySearch}
              placeholder="Search country..."
              class="w-full bg-theme-card border border-black/5 rounded-full py-3 pl-10 pr-4 text-xs font-bold outline-none focus:ring-1 focus:ring-[#E58A3A] transition-all"
            />
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-2">
          {#each filteredCountries as c}
            <button 
              onclick={() => { country = c.name; countrySelectorOpen = false; countrySearch = ''; if(country !== 'Uganda') studentClass = ''; }}
              class="w-full p-4 rounded-[20px] flex items-center justify-between transition-all group hover:bg-slate-50 cursor-pointer border-none bg-transparent"
            >
              <div class="flex items-center gap-3">
                <span class="text-2xl leading-none">{c.flag}</span>
                <span class="text-sm font-bold text-[#202936]">{c.name}</span>
              </div>
              {#if country === c.name}
                <div class="w-6 h-6 rounded-full bg-[#E58A3A] flex items-center justify-center text-white" in:scale>
                  <Check size={14} strokeWidth={3} />
                </div>
              {:else}
                <div class="w-6 h-6 rounded-full border-2 border-black/5 group-hover:border-[#E58A3A]/20 transition-colors"></div>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  <!-- Class Selector Lightbox -->
  {#if classSelectorOpen}
    <div 
      class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6"
      transition:fade={{ duration: 200 }}
    >
      <div 
        class="absolute inset-0 bg-[#202936]/40 backdrop-blur-sm" 
        onclick={() => classSelectorOpen = false}
        aria-hidden="true"
      ></div>
      <div 
        class="bg-theme-card w-full max-w-sm rounded-[32px] overflow-hidden flex flex-col shadow-2xl relative max-h-[70vh]"
        transition:scale={{ duration: 300, start: 0.95, opacity: 0 }}
      >
        <div class="p-5 border-b border-black/5 flex items-center justify-between bg-theme-card sticky top-0 z-10">
          <div>
            <h4 class="text-sm font-extrabold text-[#202936] uppercase tracking-widest">Select Class</h4>
            <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{country}</p>
          </div>
          <button onclick={() => classSelectorOpen = false} class="p-2 text-slate-400 hover:text-black transition-colors border-none bg-transparent cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-4">
          <div class="grid grid-cols-3 gap-3">
            {#each availableClasses as cls}
              <button 
                onclick={() => { studentClass = cls.id; classSelectorOpen = false; }}
                class="p-4 rounded-[24px] flex flex-col items-center justify-center gap-2 transition-all relative border-none cursor-pointer {studentClass === cls.id ? 'bg-[#E58A3A] text-white shadow-lg shadow-[#E58A3A]/20 scale-95' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}"
              >
                <GraduationCap size={18} class={studentClass === cls.id ? 'text-white' : 'text-slate-300'} />
                <span class="text-xs font-extrabold tracking-widest">{cls.label}</span>
                
                {#if studentClass === cls.id}
                  <div class="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#202936] flex items-center justify-center shadow-md animate-in zoom-in" in:scale>
                    <Check size={12} strokeWidth={4} class="text-white" />
                  </div>
                {/if}
              </button>
            {/each}
          </div>
        </div>
        
        <div class="p-5 bg-slate-50/50 border-t border-black/5">
           <p class="text-[9px] text-slate-500 font-bold uppercase text-center tracking-widest">Selection is mandatory for students</p>
        </div>
      </div>
    </div>
  {/if}
</div>
</div>
