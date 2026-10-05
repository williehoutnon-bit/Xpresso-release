# App Context: exup

You are an expert full-stack developer and UI/UX designer. Your task is to build a comprehensive, mobile-first web application named "exup" using the technology stack and highly detailed wireframe specifications provided below.

## Technology Stack
- **Framework**: Vue.js (Vue 3 with Composition API and `<script setup>`)
- **Tooling**: Vite, VS Code with the Vue - Official (Volar) extension.
- **Styling**: Tailwind CSS for responsive, mobile-first utility-class styling. 
- **Database (Offline-First/Sync)**: 
  - **PouchDB** (Client-side offline database via IndexedDB).
  - **CouchDB** (Remote server database for sync). PouchDB MUST be configured to continuously sync with the remote CouchDB backend to provide an offline-first, cross-device experience.
- **Icons**: `lucide-vue-next` for standardized vector icons.
- **Animations**: native Vue `<Transition>` and `@vueuse/motion` (or `motion/vue`) for smooth fade-ins and layout adjustments.

## Global Design Guidelines & Theme
Define these CSS variables in your Tailwind base layers:
- `primary`/`olive`: `#6B705C` (Warm sophisticated olive green)
- `accent`: `#ea580c` or similar warning/attention color for notifications/raised hands.
- `sage`/`paper`: Soft muted backgrounds (e.g., `#E3E3E3` or `#F4F4F4`), off-white containers.
- `ink`: Rich deep black/brown for text (e.g., `#1A1A1A`).
- **Glass-morphism**: Use `bg-white/10 backdrop-blur-md` heavily for floating panels, cards, and bottom navigation bars. Border should be `border border-white/20`.
- **Border Radius**: Heavy use of rounded corners (`rounded-2xl`, `rounded-3xl`, `rounded-full` for buttons).
- **Typography**: Clean Sans-Serif (like Inter or Roboto). Use tight tracking (`tracking-widest`) and uppercase for small labels and subheadings (`text-[10px] font-bold uppercase tracking-widest`).

---

## Detailed Text-Wireframes and Logic Guidelines

### 1. Landing View
**Purpose**: The entry point for unauthenticated users. High impact, clear choices.
**UI Wireframe & Layout (Mobile First)**:
- **Background**: Full screen `bg-olive` with a blurred large `bg-accent/20` circle (400x400) placed absolute top-right for a soft gradient effect.
- **Center Logo Area**: Exup logo centered vertically and horizontally. Underneath, a short catchphrase.
- **Bottom Action Area**: Floating glass-morphism container pinned to the bottom (or vertically centered if desktop).
  - **"Sign Up" Button**: A large flex button with a `UserPlus` icon. Background `bg-white/10`. Hover creates a lighter background. Logic: Routes user directly to the Signup View.
  - **"Sign In" Button**: A large flex button with a `LogIn` icon. Logic: Routes user directly to the Login View.
  - No intermediate "Who are you?" pages before these routing actions.

### 2. Authentication Flow

#### 2.1 Login View
**UI Wireframe**: 
- **Background**: Olive green, similar ambient blur effects.
- **Container**: White box (or glass-morphism box) centered in the screen.
- **Header**: "Welcome Back" with subtitle "Pick up where you left off".
- **Role Toggle (Flex Row)**: Two pill buttons side-by-side: "Student" and "Teacher". Selecting one updates the local reactive state `role`. Indicates which portal to route to after logging in.
- **Form Fields**: 
  - Email Input: Left icon `Mail`, placeholder "your@email.com".
  - Password Input: Left icon `Lock`, right icon `Eye/EyeOff` to toggle visibility.
- **Submit Button**: Large solid button.
- **Logic**: Submits credentials to CouchDB/auth endpoint. On success, writes session to PouchDB and routes to `/student-dashboard` or `/teacher-dashboard` based on the selected toggle.

#### 2.2 Signup View
**UI Wireframe**:
- **Background**: Olive green.
- **Progress Bar**: Thin bars at the top of the container showing step progress. `Step 1` -> `Step 2`.
- **Step 1: Role Selection**:
  - Title: "Choose your role" / Subtitle: "How will you be using exup?"
  - Two large rectangular cards side-by-side (or stacked on mobile): "Student" (Access papers) vs "Teacher" (Manage classes).
  - Logic: Clicking a card sets the reactive `role` state and advances to Step 2.
- **Step 2: The Basics**:
  - Title: "The basics" / Subtitle: "Fill in your details to get started."
  - Form Fields: Full Name, Email, Password. 
  - Submit Button: "Complete Registration" (if student/free) or "Choose Access" (if teacher).
- **Teacher Specific step (Optional Step 3)**: If Teacher, prompt for school access code or payment. 
- **Logic**: Saves user document in PouchDB/CouchDB with `type: 'user'`, `role: {{role}}`. Routes to respective dashboard.

---

### 3. Student Dashboard
**Purpose**: Central hub for a student to view exams, notes, and messages.
**UI Wireframe**:
- **Header Section**: Greeting "Hi, {Name}", an avatar image (top right).
- **Navigation (Sticky Bottom Bar vs Sidebar)**: 
  - On Mobile: Fixed bottom bar (`fixed bottom-0 w-full`). Icons: Home, Catalogue, Notes, Messages, Profile.
  - On Desktop: Left Sidebar.
- **Home Tab Content**:
  - **Stats Row**: Small horizontally scrollable cards ("Exams done: 12", "Avg Score: 85%").
  - **Upcoming Schedule**: List of upcoming virtual classes. Click -> Routes to `/class/:id`.
  - **Recent Activity**: List items (e.g., "New note added in Math").
- **Exams Catalogue Tab**:
  - Toggle Tabs: "Available" vs "Completed".
  - Cards representing exams: Subject, Title, Duration, Start Button.
- **Data Logic (PouchDB)**: 
  - Create a Vue watcher/subscription that listens to `pouch.changes({live: true})` for `type: 'exam'` and `type: 'activity'` documents.
  - Render lists using Vue reactive references (`ref()`), updated automatically when PouchDB syncs.

---

### 4. Teacher Dashboard
**Purpose**: Allowing teachers to view classes, verify account, and see virtual classes.
**UI Wireframe**:
- **Header**: "Teacher Portal", profile image.
- **Verification Alert (Conditional)**: If `user.isVerified === false`, show a banner: "Your account is pending verification. Some features are restricted."
- **Content Panels**:
  - **Classes Managed**: Grid of cards showing Class Name, Number of Students.
  - **Create Class Button**: Floating action button (FAB) or prominent card in the grid to create a new class.
- **Logic**: Queries PouchDB with a Mango query or view for `type: 'class'` where `teacherId === currentUser.id`.

---

### 5. Virtual Classroom View
**Purpose**: Real-time collaborative environment. Highly optimized for mobile.
**UI Wireframe & Layout**:
- **Wrapper**: `h-screen w-full flex flex-col bg-[#0F1115]` (very dark background for focus).
- **Top Bar**: Class Title, Subject, Duration timer, "Live" indicator.
- **Main Content Area (Flexible)**:
  - Takes up remaining vertical space. 
  - Contains the **Blackboard**.
    - If `boardMode === 'image'`: Shows a centered `<img>` tag with the shared notes.
    - If `boardMode === 'text'`: Shows a vertical message feed (like chat) where only the teacher can write notes. Messages are styled as large bold text on dark backgrounds to look like a digital blackboard.
- **Participant Pane & Layout Management (CRITICAL DESKTOP vs MOBILE)**:
  - Desktop layout: Split view. Blackboard on left (`flex-2`), panes on the right (`flex-1 flex-col`).
  - Mobile layout: Stacked or drawer-based. 
    - **Raised Hands Pane**: MUST appear **ABOVE** the general "All Students" list.
      - *Component*: A container with title "Raised Hands (🚨)". List of students who flagged for help. Clicking a student can give them the floor.
    - **All Students Pane**: Falls below Raised Hands. Shows Name, Avatar, Mic Status icon.
- **Floating Bottom Control Bar**:
  - Centered horizontally, absolute positioned near bottom (`bottom-4 md:bottom-6`).
  - Pill shape (`rounded-full`), glass effect (`bg-white/20 backdrop-blur-3xl`).
  - **Action Buttons**: 
    - Mic Toggle (`Mic` / `MicOff`).
    - *Teacher Only*: Board Mode Toggle (`ImageIcon` vs `TypeIcon`). Share Screen button.
    - *Student Only*: Raise Hand Toggle (`Hand` icon). Active state glows orange (`bg-accent/20 color-accent border-accent`).
    - End Call (`PhoneOff`, red background).
  - Overflow handled gracefully on small screens (`overflow-x-auto no-scrollbar`).
- **Data Logic (PouchDB + WebRTC)**:
  - **Board State**: Teacher pushing text to the Board Mode creates a PouchDB document `type: 'board_event', classId: 123`. PouchDB live syncs this to CouchDB, CouchDB pushes to students' PouchDB, updating their Vue reactive state immediately.
  - **Hand Raise**: Student toggles hand -> updates `participant` document in PouchDB `handRaised: true`. Teacher's UI updates via live PouchDB sync.

## PouchDB / CouchDB Implementation Guidelines
- Setup a composable e.g. `useDatabase()`.
- Instantiate the local db: `const localDb = new PouchDB('exup_user_db');`
- Define the remote db: `const remoteDb = new PouchDB('http://admin:password@localhost:5984/exup_db');`
- Initiate sync: 
  ```javascript
  localDb.sync(remoteDb, {
    live: true,
    retry: true
  }).on('change', function (info) {
    // emit globally or update Pinia store so Vue UI updates
  }).on('error', function (err) {
    console.error('DB Sync Error', err);
  });
  ```
- Use PouchDB `find` plugin to query documents effectively (e.g., `localDb.find({selector: {type: 'exam'}})`), which feels closer to NoSQL document querying.

## Build and Output Instructions
1. Scaffold `.vue` single file components referencing this documentation. 
2. Build the router to handle paths correctly.
3. Incorporate Tailwind heavily for the layout specifications mentioned (e.g. `flex-1`, `border-t`, `md:border-t-0`, `order-2 md:order-1` for controlling Raised Hands positioning on mobile vs desktop).
4. Do NOT use fake hardcoded states without connecting them to Vue `ref()` or `reactive()` so they can be smoothly transitioned to PouchDB data later.

Follow this prompt exactly to recreate the described high-quality application.
