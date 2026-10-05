<script lang="ts">
  import { onMount, tick, onDestroy, untrack } from 'svelte';
  import { fade } from 'svelte/transition';
  import { ChevronLeft, Search, Flame, ClipboardList, Trophy, BookOpen, MessageSquare, X, Check, CheckCheck, Trash2, Download } from 'lucide-svelte';
  import { jsPDF } from 'jspdf';
  import UnreadBadge from '../components/UnreadBadge.svelte';
  import Skeleton from '../components/Skeleton.svelte';

  import { messagingService } from '../services/messagingService';
  import { authService } from '../services/authService';
  import { dbService } from '../services/dbService';
  import { quickSeedService } from '../services/quickSeedService';
  import { friendshipService } from '../services/friendshipService';
  import { formatMathAsPlainText, mathNodesToPlainText } from '../math/mathSerialization';
  import UserProfileLightbox from '../components/UserProfileLightbox.svelte';

  function triggerNotification(title: string, options: any) {
    console.log(`Notification: ${title}`, options);
  }

  function getStringHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function seedRandom(seedNum: number) {
    let currentSeed = seedNum;
    return function() {
      const x = Math.sin(currentSeed++) * 10000;
      return x - Math.floor(x);
    };
  }

  function getTornClipPath(seedString: string): string {
    if (!seedString) seedString = 'default-deckle';
    const hash = getStringHash(seedString);
    const random = seedRandom(hash);
    
    const bottomPoints: string[] = [];
    const steps = 140 + Math.round(random() * 30);

    const p1 = random() * Math.PI * 2;
    const p2 = random() * Math.PI * 2;
    const p3 = random() * Math.PI * 2;
    const f1 = 35 + random() * 10;
    const f2 = 70 + random() * 15;
    const f3 = 120 + random() * 20;
    
    // Sharp bottom-right corner
    bottomPoints.push('100% 100%');

    // High frequency micro-torn paper contour across bottom
    for (let i = steps - 1; i >= 1; i--) {
      const t = i / steps;
      const x = t * 100;
      const wave = Math.sin(t * f1 * Math.PI + p1) * 0.6 
                 + Math.sin(t * f2 * Math.PI + p2) * 0.4 
                 + Math.sin(t * f3 * Math.PI + p3) * 0.25 
                 + (random() - 0.5) * 0.35;
      const fluctuateBottom = Math.max(0.4, Math.min(3.2, 1.8 + wave));
      bottomPoints.push(`${x.toFixed(1)}% calc(100% - ${fluctuateBottom.toFixed(2)}px)`);
    }
    
    // Sharp bottom-left corner
    bottomPoints.push('0% 100%');

    return `polygon(0% 0px, 100% 0px, ${bottomPoints.join(', ')})`;
  }

  let { onback, onopenchat } = $props<{
    onback?: () => void;
    onopenchat?: (id: string, name: string) => void;
  }>();

  let conversations = $state<any[]>([]);
  let myComrades = $state<any[]>([]);
  let isLoading = $state(true);

  let currentTime = $state(Date.now());
  $effect(() => {
    const interval = setInterval(() => {
      currentTime = Date.now();
    }, 15000);
    return () => clearInterval(interval);
  });
  let currentUserId = $state('');
  let subscriptions: any[] = [];

  let incomingRequests = $state<any[]>([]);

  onMount(async () => {
    try {
      const user = await authService.getCurrentUser();
      if (user) {
        currentUserId = user.$id;
        
        // Load pending requests
        import('../services/friendshipService').then(m => {
            m.friendshipService.getIncomingRequests(currentUserId).then(reqs => {
                incomingRequests = reqs;
            });
            m.friendshipService.getCurrentFriends(currentUserId).then(comps => {
                myComrades = comps;
            });
        });

        // 0. Load local data immediately before attaching observers
        refreshConversations(false, true);
        isLoading = false;

        // 1. Observe changes that should trigger a UI refresh
        // We combine these into one debounced refresh to avoid multiple calls
        const convo$ = await dbService.getMyConversations$(currentUserId);
        const messages$ = await dbService.getMessagesStream$();
        const participants$ = await dbService.getParticipantsStream$();
        const db = await dbService.getRawDB();
        const profiles$ = db.profiles.find().$;

        const onDataChange = () => {
           // Use a longer debounce for database changes to aggregate multiple events (e.g. bulk sync)
           refreshConversations(false);
        };

        const sub1 = convo$.subscribe(onDataChange);
        const sub2 = messages$.subscribe(onDataChange);
        const sub3 = participants$.subscribe(onDataChange);
        const sub4 = profiles$.subscribe(onDataChange);

        subscriptions.push(sub1, sub2, sub3, sub4);

        // Subscribe to friendships changes for real-time status updates (Accept/Reject/Decline)
        try {
          const { APPWRITE_CONFIG, client } = await import('../services/appwriteService');
          if (APPWRITE_CONFIG.databaseId && APPWRITE_CONFIG.collections.friendships) {
            const friendSub = client.subscribe(
              `databases.${APPWRITE_CONFIG.databaseId}.collections.${APPWRITE_CONFIG.collections.friendships}.documents`,
              async (response: any) => {
                const data = response.payload;
                const fId = data.friend_id || data.friendId;
                const uId = data.user_id || data.userId;
                if (currentUserId && (uId === currentUserId || fId === currentUserId)) {
                  // If the active profile lightbox is open and its userId matches, update states
                  if (isProfileLightboxOpen && profileData) {
                    const pUserId = profileData.userId;
                    if (pUserId) {
                      setTimeout(async () => {
                        try {
                          const { friendshipService: fSvc } = await import('../services/friendshipService');
                          const status = await fSvc.getFriendshipStatus(currentUserId, pUserId);
                          if (isProfileLightboxOpen && profileData && profileData.userId === pUserId) {
                            isComrade = (status === 'Accepted');
                            isInvited = (status === 'Pending');
                          }
                        } catch (e) {}
                      }, 500);
                    }
                  }

                  // Reload the list of incoming requests and my comrades
                  try {
                    const { friendshipService: fSvc } = await import('../services/friendshipService');
                    const [reqs, comps] = await Promise.all([
                      fSvc.getIncomingRequests(currentUserId),
                      fSvc.getCurrentFriends(currentUserId)
                    ]);
                    incomingRequests = reqs;
                    myComrades = comps;
                  } catch (err) {
                    console.error('Failed to update friendships in InboxView real-time:', err);
                  }
                }
              }
            );
            subscriptions.push(friendSub);
          }
        } catch (subErr) {
          console.warn('Real-time friendship subscription failed in InboxView:', subErr);
        }
      } else {
        isLoading = false;
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
      isLoading = false;
    }
  });

  let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
  let fetchCounter = 0;
  
  onDestroy(() => {
    // NEW: cancel any pending debounced refresh
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
      refreshTimeout = null;
    }
    subscriptions.forEach(s => {
      try {
        if (typeof s === 'function') s();
        else if (s?.unsubscribe) s.unsubscribe();
      } catch (e) {
        // Silent
      }
    });
  });

  // Simplified debounce - no resolver array needed
  function refreshConversations(forceSync = false, immediate = false) {
    const fetchNow = async () => {
      const myId = ++fetchCounter;
      try {
        // Use forceSync sparingly, e.g. on manual pull-to-refresh
        const res = await messagingService.getConversations(forceSync);
        if (myId === fetchCounter) {
          conversations = res ?? [];
        }
      } catch (err) {
        if (myId === fetchCounter) {
          console.error('Error refreshing conversations:', err);
        }
      }
    };

    if (immediate) {
      fetchNow();
    } else {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(fetchNow, 300); // Optimized debounce to 300ms for snappier feedback
    }
  }

  let activeTab = $state<string>('messages');

  const handleAcceptRequest = async (req: any) => {
      const { friendshipService } = await import('../services/friendshipService');
      
      // Optimistic update
      const originalRequests = [...incomingRequests];
      incomingRequests = incomingRequests.filter(r => r.requestId !== req.requestId);
      
      const ok = await friendshipService.acceptFriendRequest(req.requestId);
      if (ok) {
          triggerNotification('Accepted', { body: `You are now connected with ${req.name}.`, type: 'success' });
          // Refresh comrades
          friendshipService.getCurrentFriends(currentUserId).then(comps => {
              myComrades = comps;
          });
      } else {
          triggerNotification('Error', { body: 'Failed to accept request.', type: 'error' });
          // Revert if failed
          incomingRequests = originalRequests;
      }
  };

  const handleDeclineRequest = async (req: any) => {
      const { friendshipService } = await import('../services/friendshipService');
      
      // Optimistic update
      const originalRequests = [...incomingRequests];
      incomingRequests = incomingRequests.filter(r => r.requestId !== req.requestId);

      const ok = await friendshipService.declineFriendRequest(req.requestId);
      if (ok) {
          triggerNotification('Declined', { body: `Request from ${req.name} declined.`, type: 'info' });
      } else {
          triggerNotification('Error', { body: 'Failed to decline request.', type: 'error' });
          // Revert if failed
          incomingRequests = originalRequests;
      }
  };
  let showNewMessageModal = $state(false);
  let modalSearchQuery = $state('');
  let isSearching = $state(false);
  let searchQuery = $state('');
  let searchInput = $state<HTMLInputElement | null>(null);

  let filteredConversations = $derived(
    searchQuery
      ? conversations.filter(c => 
          c.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
          getLastMessageContent(c).toLowerCase().includes(searchQuery.toLowerCase())
        )
      : conversations
  );

  let filteredContacts = $derived(
    modalSearchQuery
      ? myComrades.filter(contact => contact.name.toLowerCase().includes(modalSearchQuery.toLowerCase()))
      : myComrades
  );

  $effect(() => {
    if (isSearching && searchInput) {
      tick().then(() => {
        searchInput?.focus();
      });
    }
  });

  let tabs = [
    { id: 'messages', label: 'MESSAGES' },
    { id: 'notifications', label: 'NOTIFICATIONS' },
    { id: 'connect', label: 'CONNECT' },
  ];



  const triggerAction = (title: string, body: string, type: 'info' | 'success' | 'warning' | 'error') => {
    triggerNotification(title, { body, type });
  };

  const startChat = (contact: any) => {
    showNewMessageModal = false;
    onopenchat?.(`user_${contact.userId}`, contact.name);
  };

  let isSeeding = $state(false);
  async function handleSeedMedia() {
    isSeeding = true;
    try {
      const res = await quickSeedService.seedMediaFromMoses();
      if (res.success) {
        triggerAction('Success', 'Media messages seeded from Moses!', 'success');
        await refreshConversations(); // Force refresh to show new unread count
      } else {
        triggerAction('Error', 'Failed to seed media', 'error');
      }
    } finally {
      isSeeding = false;
    }
  }

  let swipingConvoId = $state<string | null>(null);
  let startX = $state(0);
  let swipeDistance = $state(0);

  let isProfileLightboxOpen = $state(false);
  let profileData = $state<any>(null);

  $effect(() => {
    const data = profileData;
    if (data) {
      const pId = data.userId;
      if (pId) {
        untrack(() => {
          conversations = conversations.map(c => {
            if (c.partnerId === pId) {
              return {
                ...c,
                name: data.fullName || data.name || c.name,
                avatarUrl: data.avatarUrl || c.avatarUrl
              };
            }
            return c;
          });

          myComrades = myComrades.map(c => {
            if (c.userId === pId || c.id === pId) {
              return {
                ...c,
                name: data.fullName || data.name || c.name,
                avatarUrl: data.avatarUrl || c.avatarUrl
              };
            }
            return c;
          });

          incomingRequests = incomingRequests.map(r => {
            if (r.senderId === pId || r.userId === pId) {
              return {
                ...r,
                name: data.fullName || data.name || r.name,
                avatarUrl: data.avatarUrl || r.avatarUrl
              };
            }
            return r;
          });
        });
      }
    }
  });
  let isComrade = $state(false);
  let isInvited = $state(false);
  
  let fetchingProfileId = $state<string | null>(null);

  const openProfileLightbox = async (e: Event, contactOrConvo: any) => {
     e.stopPropagation();
     const userId = contactOrConvo.userId || (contactOrConvo.id && contactOrConvo.id.replace('convo_', ''));
     
     // Set initial optimistic data
     profileData = {
         id: contactOrConvo.id,
         userId,
         name: contactOrConvo.name,
         avatarUrl: contactOrConvo.avatarUrl,
         avatar: contactOrConvo.avatar,
         role: contactOrConvo.role || contactOrConvo.position || 'Student',
         school: contactOrConvo.school || '',
         points: contactOrConvo.points,
         bio: contactOrConvo.bio,
         studentClass: contactOrConvo.studentClass,
         preferredSubjects: contactOrConvo.preferredSubjects,
         subjectCombination: contactOrConvo.subjectCombination,
         age: contactOrConvo.age,
         house: contactOrConvo.house,
         clubs: contactOrConvo.clubs
     };
     isComrade = false;
     isInvited = false;
     isProfileLightboxOpen = true;
     
     if (userId && currentUserId) {
        import('../services/friendshipService').then(async m => {
             const status = await m.friendshipService.getFriendshipStatus(currentUserId, userId);
             isComrade = (status === 'Accepted');
             isInvited = (status === 'Pending');
        });
     }

     if (userId && (!profileData.bio || !profileData.studentClass)) {
        fetchingProfileId = userId;
        try {
            const profile = await dbService.getProfile(userId);
            if (profile && isProfileLightboxOpen && fetchingProfileId === userId) {
                 profileData = {
                     ...profileData,
                     avatarUrl: profile.avatarUrl || profileData.avatarUrl,
                     bio: profile.bio || profileData.bio,
                     points: profile.points || profileData.points,
                     school: profile.school || profileData.school,
                     role: profile.role || profileData.role,
                     studentClass: profile.studentClass || profileData.studentClass,
                     preferredSubjects: profile.preferredSubjects || profileData.preferredSubjects,
                     subjectCombination: profile.subjectCombination || profileData.subjectCombination,
                     age: profile.age || profileData.age,
                     house: profile.house || profileData.house,
                     clubs: profile.clubs || profileData.clubs
                 };
            }
        } catch (err) {
            console.error('Failed to load profile details for lightbox', err);
        } finally {
            if (fetchingProfileId === userId) fetchingProfileId = null;
        }
     }
  };

  const handleTouchStart = (e: TouchEvent, id: string) => {
    swipingConvoId = id;
    startX = e.touches[0].clientX;
    swipeDistance = 0;
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!swipingConvoId) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX;
    if (diff < 0) {
      swipeDistance = Math.min(Math.abs(diff), 120);
    }
  };

  const handleTouchEnd = async () => {
    if (swipingConvoId && swipeDistance > 70) { 
       const idToDrop = swipingConvoId;
       swipingConvoId = null;
       swipeDistance = 0;
       
       // Optimistic UI update: remove immediately from local state
       conversations = conversations.filter(c => c.id !== idToDrop);
       
       // Perform the actual deletion in the background
       messagingService.deleteConversation(idToDrop).then(() => {
          triggerAction('Deleted', 'Conversation removed', 'info');
       }).catch(err => {
          console.error('Failed to delete conversation:', err);
          // Optional: restore if it was critical, but usually we just sync again
          refreshConversations();
       });
    } else {
       swipingConvoId = null;
       swipeDistance = 0;
    }
  };
  function getLastMessageContent(convo: any) {
    const m = convo.lastMessage;
    if (!m) return 'No messages yet';
    
    // Check if AST nodes exist on mathMeta or math_meta (parsed or string)
    let meta = m.mathMeta || m.math_meta;
    if (typeof meta === 'string') {
      try {
        meta = JSON.parse(meta);
      } catch {}
    }

    if (meta?.nodes && Array.isArray(meta.nodes) && meta.nodes.length > 0) {
      const plain = mathNodesToPlainText(meta.nodes);
      if (plain && plain.trim().length > 0) return plain.trim();
    }

    if (m.type === 'audio' || m.type === 'f:audio' || m.attachments?.some((a: any) => a.type === 'audio')) {
      return '🎤 Voice note';
    }

    if (m.type === 'video' || m.type === 'f:video' || m.attachments?.some((a: any) => a.type === 'video')) {
      return '🎥 Video';
    }

    if (m.type === 'image' || m.type === 'f:image' || m.attachments?.some((a: any) => a.type === 'image')) {
      const caption = formatMathAsPlainText(m.content);
      return caption && caption !== 'Image' && caption !== '[Image message]' ? `📷 ${caption}` : '📷 Image';
    }

    if (m.type === 'math_canvas' || m.type === 'f:math_canvas') {
      return `📐 ${meta?.subject || 'Math Canvas'}`;
    }

    const plain = formatMathAsPlainText(m.content);
    if (plain && plain.trim().length > 0) return plain.trim();

    // If message is a pure stroke/annotation without text
    const strokes = m.strokes || meta?.strokes || meta?.annotation_strokes;
    if (Array.isArray(strokes) && strokes.length > 0) {
      return '✏️ Ink drawing';
    }

    return 'No messages yet';
  }

  function downloadArchitecturePDF() {
    const doc = new jsPDF();
    
    doc.setProperties({
      title: 'PEPAchat Math Input Engine Architecture Report',
      subject: 'Selection Highlighting, Caret Repositioning, and Clipboard Integration',
      author: 'PEPAchat Senior R&D Team',
    });

    const pageHeight = 297;
    const pageWidth = 210;
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;
    let pageCount = 1;
    let y = 15;

    const checkY = (neededHeight: number) => {
      if (y + neededHeight > pageHeight - 20) {
        doc.addPage();
        pageCount++;
        drawPageDecoration(pageCount);
        y = 22;
      }
    };

    const drawPageDecoration = (pageNum: number) => {
      doc.setDrawColor(200, 210, 225);
      doc.setLineWidth(0.5);
      doc.line(margin, 12, pageWidth - margin, 12);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 115, 130);
      doc.text("PEPACHAT MATHEMATICS ENGINE ARCHITECTURE SPECS", margin, 9);
      doc.text(`Page ${pageNum}`, pageWidth - margin, 9, { align: 'right' });

      doc.setDrawColor(220, 225, 235);
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
      doc.text("TECHNICAL SPECIFICATION - SENIOR DEVELOPER PORTAL EXPORT", margin, pageHeight - 8);
      doc.text("CONFIDENTIAL pepachat DEVELOPMENT DOCUMENT", pageWidth - margin, pageHeight - 8, { align: 'right' });
    };

    const drawSectionHeader = (title: string) => {
      checkY(20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(0, 39, 77);
      doc.text(title, margin, y);
      y += 3;
      
      doc.setDrawColor(0, 39, 77);
      doc.setLineWidth(0.4);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
    };

    const drawCodeBlock = (codeLines: string[]) => {
      doc.setFont("courier", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(30, 40, 50);
      
      codeLines.forEach((rawLine) => {
        const splitLines = doc.splitTextToSize(rawLine, contentWidth - 4);
        splitLines.forEach((line: string) => {
          checkY(3.5);
          doc.setDrawColor(180, 200, 220);
          doc.setLineWidth(0.5);
          doc.line(margin - 2, y - 1.5, margin - 2, y + 2);
          
          doc.text(line, margin, y);
          y += 3.2;
        });
      });
      y += 4;
    };

    const addText = (text: string, font = "helvetica", style = "normal", size = 9, spacing = 4.5) => {
      doc.setFont(font, style);
      doc.setFontSize(size);
      doc.setTextColor(60, 60, 60);
      const splitText = doc.splitTextToSize(text, contentWidth);
      splitText.forEach((line: string) => {
        checkY(spacing);
        doc.text(line, margin, y);
        y += spacing;
      });
      y += 1.5;
    };

    // --- COVER TITLE ---
    doc.setFillColor(0, 39, 77);
    doc.rect(0, 0, pageWidth, 75, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text("MATH ENGINE WYSIWYG ARCHITECTURE", margin, 25);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Selection Highlighting, Caret Repositioning, and Clipboard Integration", margin, 35);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(190, 210, 230);
    doc.text("A comprehensive engineering review of the interactive mathematics editor built on", margin, 46);
    doc.text("the dual-layer text parsing and event interception pipeline.", margin, 51);
    
    doc.setFont("helvetica", "italic");
    doc.text("Target System: pepachat Interactive Math Communication Core", margin, 59);
    doc.setFont("helvetica", "normal");
    doc.text("Blueprint Generated On: " + new Date().toLocaleString(), margin, 65);

    y = 86;

    // --- SECTION 1 ---
    drawSectionHeader("1. SYSTEM DESIGN & THE DUAL-LAYER HYBRID MODEL");
    
    addText("Developing robust, high-fidelity math entry editors inside browsers is traditionally bottlenecked by standard textareas' inability to render structured, nested formulas. The pepachat system overcomes this using a custom Dual-Layer Paradigm:", "helvetica", "normal", 9);
    addText("1. Underlying Input: An invisible, focusable <textarea> captures all physical keyboard actions, touch events, typing autocompletes, and OS clipboard selections. This maintains native mobile virtual keyboard accessibility.", "helvetica", "normal", 9);
    addText("2. Overlay Renderer: A completely customized visual layout constructed inside Svelte. It recursively parses the backing textarea values into a mathematical Abstract Syntax Tree (AST), outputting rich, responsive mathematical symbols.", "helvetica", "normal", 9);
    
    // --- SECTION 2 ---
    drawSectionHeader("2. SELECTION & SEAMLESS HIGHLIGHTING MECHANISM");
    
    addText("When highlighting text, the visual math components must match the precise range of selection inside the hidden textarea. The compiler maintains character fidelity by enriching every glyph inside the AST with an 'originalIndices' array.", "helvetica", "normal", 9);
    addText("During structural rendering, Svelte maps each glyph index back to the underlying linear input. If the mapped character index is enclosed by the transparent textarea's active 'selectionStart' and 'selectionEnd' range, Svelte dynamically outputs a high-contrast background highlight class.", "helvetica", "normal", 9);

    const highlighSnippet = [
      "// Highlighting implementation mapping linear textarea indices to AST nodes",
      "{#each part.text.split('') as char, i}",
      "  {@const idx = part.originalIndices && part.originalIndices[i] !== undefined ? part.originalIndices[i] : -1}",
      "  {@const isSelected = selectionStart !== selectionEnd && idx >= selectionStart && idx < selectionEnd}",
      "  <span ",
      "    class=\"inline-block relative pointer-events-auto transition-colors duration-75\"",
      "    class:bg-blue-500={isSelected} class:bg-opacity-30={isSelected}",
      "    style=\"cursor: text; user-select: none;\"",
      "  >",
      "    {char}",
      "  </span>",
      "{/each}"
    ];
    drawCodeBlock(highlighSnippet);

    // --- SECTION 3 ---
    drawSectionHeader("3. SPATIAL CARET REPOSITIONING ENGINE (TAP-TO-REPOSITION)");
    
    addText("Moving the caret on click requires translating 2D display click coordinates back to a 1D offset inside the hidden text input. A custom spatial resolver performs this transition smoothly on pointerdown:", "helvetica", "normal", 9);
    addText("1. When the user taps the math area, client coordinates (e.clientX, e.clientY) are compiled.", "helvetica", "normal", 9);
    addText("2. The 'collectCursorCandidates' routine walks the custom DOM elements, capturing precise bounding coordinates for left/right boundaries of every single visual character or fraction block.", "helvetica", "normal", 9);
    addText("3. The 'resolveSpatialTap' solver maps the tap against candidate clusters. By applying a weighted Euclidean distance metric (where vertical distance is weighted heavily), the closest character coordinate is extracted.", "helvetica", "normal", 9);
    addText("4. The backing transparent <textarea> is updated with this resolved index, immediately repositioning the virtual input caret.", "helvetica", "normal", 9);

    const solverSnippet = [
      "// Spatial resolving snippet (mathPointerResolver.ts)",
      "export function resolveSpatialTap(tapX: number, tapY: number, rootEl: HTMLElement, tree: MathNode[]) {",
      "  const candidates = collectCursorCandidates(rootEl);",
      "  if (candidates.length === 0) return null;",
      "  ",
      "  // weighted distance formula (vertical distance is weighted 4x to favor horizontal flow)",
      "  let best = candidates[0];",
      "  let bestDist = Infinity;",
      "  for (const cand of candidates) {",
      "    const dx = cand.x - tapX;",
      "    const dy = cand.y - tapY;",
      "    const dist = dx * dx + (dy * dy) * 4;",
      "    if (dist < bestDist) {",
      "      bestDist = dist;",
      "      best = cand;",
      "    }",
      "  }",
      "  return { tree, path: best.path };",
      "}"
    ];
    drawCodeBlock(solverSnippet);

    // --- SECTION 4 ---
    drawSectionHeader("4. SYSTEM CLIPBOARD HANDLING & FALLBACK PROXYING");
    
    addText("Executing copy, cut, and paste over structured mathematical systems requires robust AST serialization. The editor facilitates seamless native integrations even within sandboxed browser environments (e.g., iframes):", "helvetica", "normal", 9);
    addText("- Slicing: Upon triggered copy/cut events, the helper 'sliceTree' evaluates selected node IDs, pruning the tree down to the active visual selections.", "helvetica", "normal", 9);
    addText("- Serialization: Sliced math nodes are converted to standard linear strings using LaTeX representations (e.g. \\frac{numerator}{denominator}), allowing copy-pasting equations cleanly as standard text outside the application.", "helvetica", "normal", 9);
    addText("- Sandbox Proxy: Under restricted iframe environments where the 'navigator.clipboard' API is blocked, the engine implements an offscreen textarea fallback proxy, programmatically copying selection buffers via standard document execution.", "helvetica", "normal", 9);
    addText("- Deserialization: Upon pasting, linear math inputs are parsed back into recursive MathNode objects via 'deserializeTree' and injected exactly at the cursor container path.", "helvetica", "normal", 9);

    const clipboardSnippet = [
      "// System clipboard fallback copy and paste serialization",
      "function fallbackCopyTextToClipboard(text: string) {",
      "  const textArea = document.createElement('textarea');",
      "  textArea.value = text; textArea.style.position = 'fixed';",
      "  document.body.appendChild(textArea);",
      "  textArea.focus(); textArea.select();",
      "  document.execCommand('copy');",
      "  document.body.removeChild(textArea);",
      "}",
      "",
      "async function execPaste() {",
      "  const text = await navigator.clipboard.readText();",
      "  const parsed = deserializeTree(text);",
      "  if (parsed.length > 0) {",
      "    const container = getContainer(currentTree, currentCursorPath.containerPath);",
      "    const offset = currentCursorPath.offset;",
      "    const newContainer = [...container.slice(0, offset), ...parsed, ...container.slice(offset)];",
      "    currentTree = replaceContainer(currentTree, currentCursorPath.containerPath, newContainer);",
      "  }",
      "}"
    ];
    drawCodeBlock(clipboardSnippet);

    drawPageDecoration(pageCount);

    addText("Generated report successfully completed for senior developer portal review.", "helvetica", "italic", 9);

    doc.save("pepachat_Math_Input_Engine_Architecture_Report.pdf");
  }
</script>

<div class="h-full bg-[#fafafa] paper-canvas flex flex-col overflow-y-auto pb-24 relative unselectable">
  <!-- Top Navigation Tabs matching screenshot -->
  <div class="sticky top-0 z-30 bg-white border-b border-slate-200/90 shadow-sm flex items-stretch select-none">
    {#each tabs as tab, idx (tab.id)}
      {#if idx > 0}
        <div class="w-px bg-slate-200 my-2 self-stretch"></div>
      {/if}
      <button 
        onclick={() => activeTab = tab.id}
        class="flex-1 py-3.5 px-2 text-center relative border-none bg-transparent cursor-pointer transition-colors"
      >
        <span class="text-[13px] font-bold tracking-wider uppercase {activeTab === tab.id ? 'text-slate-800' : 'text-slate-400 hover:text-slate-600'}">
          {tab.label}
        </span>
        {#if activeTab === tab.id}
          <div class="absolute bottom-0 left-0 right-0 h-[3px] bg-blue-600"></div>
        {/if}
      </button>
    {/each}
  </div>

  <div class="p-4 relative">
    <!-- FAB for New Message matching the solid orange floating circle button of reference -->
    {#if activeTab === 'messages'}
      <button 
        onclick={() => showNewMessageModal = true}
        class="fixed bottom-[88px] right-6 w-14 h-14 bg-[#ff5b14] hover:bg-[#ea580c] text-white border-none cursor-pointer rounded-full flex items-center justify-center shadow-[0_4px_16px_rgba(255,91,20,0.35)] hover:scale-105 active:scale-95 transition-all z-30"
        title="Compose Message"
      >
        <MessageSquare size={24} strokeWidth={2.2} />
      </button>
    {/if}

    <!-- New Message Modal -->
    {#if showNewMessageModal}
      <div class="fixed inset-0 bg-[#0a1d33]/40 backdrop-blur-sm z-50 flex items-end justify-center sm:items-center">
        <div class="bg-theme-card border border-ink/10 w-full sm:w-[400px] rounded-t-3xl sm:rounded-[24px] shadow-xl overflow-hidden flex flex-col max-h-[80vh] sm:max-h-[600px] transform transition-transform">
          <header class="p-4 bg-theme-paper border-b border-ink/10 flex items-center justify-between sticky top-0">
            <h3 class="font-sans font-extrabold text-ink text-base uppercase tracking-widest">New Message</h3>
            <button onclick={() => showNewMessageModal = false} class="p-2 text-sage bg-transparent border-none cursor-pointer hover:text-ink">
              <X size={20} />
            </button>
          </header>
          <div class="p-4 border-b border-ink/10 bg-theme-card">
            <div class="relative">
              <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-sage" />
              <input type="text" bind:value={modalSearchQuery} placeholder="Search contacts..." class="w-full pl-9 pr-4 py-3 bg-theme-paper/60 rounded-[20px] text-sm outline-none focus:ring-1 focus:ring-ink border border-ink/10 font-sans" />
            </div>
          </div>
          <div class="flex-1 overflow-y-auto p-4 space-y-2">
            <h4 class="text-[10px] font-bold text-sage uppercase tracking-widest mb-2 px-1 font-sans">Contacts</h4>
            {#if filteredContacts.length === 0}
               <div class="text-center p-4 text-xs font-bold text-sage uppercase tracking-widest font-sans">No contacts found</div>
            {/if}
            {#each filteredContacts as contact (contact.userId)}
              <button 
                onclick={() => startChat(contact)} 
                class="w-full flex items-center gap-3 p-3 bg-theme-card rounded-[20px] border border-ink/10 cursor-pointer hover:border-ink/30 hover:bg-theme-paper/30 transition-colors text-left"
              >
                <div class="w-10 h-10 rounded-full overflow-hidden bg-theme-card text-olive flex items-center justify-center font-bold text-sm shrink-0 border border-ink/15 shadow-sm">
                  {#if contact.avatarUrl}
                    <img src={contact.avatarUrl} alt={contact.name} class="w-full h-full object-cover" />
                  {:else}
                    {contact.name[0]}
                  {/if}
                </div>
                <span class="font-sans font-bold text-ink text-base">{contact.name}</span>
              </button>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <div class="relative">
      {#if activeTab === 'messages'}
        <div in:fade|local={{ duration: 200 }} out:fade|local={{ duration: 200 }} class="space-y-4 relative w-full left-0 top-0 filter drop-shadow-[0_8px_16px_rgba(15,23,42,0.06)]">
          {#if isLoading}
            <Skeleton variant="deckle" count={4} />
          {:else if filteredConversations.length === 0}
            <div class="p-12 text-center text-sage font-sans font-bold text-base">
              {#if searchQuery}
                No conversations found for "{searchQuery}".
              {:else}
                No active conversations found.
              {/if}
            </div>
          {:else}
            {#each filteredConversations as convo (convo.id)}
              <div 
                class="relative transition-all duration-300 overflow-hidden rounded-none"
              >
                <!-- Delete indicator behind the item -->
                {#if swipingConvoId === convo.id && swipeDistance > 10}
                  <div class="absolute inset-y-0 right-0 bg-red-500/95 flex items-center justify-center text-white rounded-none shadow-inner" style="width: {swipeDistance}px;">
                    <Trash2 size={24} />
                  </div>
                {/if}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div 
                  onclick={() => onopenchat?.(convo.id, convo.name || 'Anonymous')} 
                  ontouchstart={(e) => handleTouchStart(e, convo.id)}
                  ontouchmove={handleTouchMove}
                  ontouchend={handleTouchEnd}
                  class="deckle-card flex items-center gap-4 p-4 pl-5 cursor-pointer relative"
                  style="clip-path: {getTornClipPath(convo.id)}; {swipingConvoId === convo.id ? `transform: translateX(-${swipeDistance}px);` : ''}"
                >
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div onclick={(e) => openProfileLightbox(e, convo)} class="w-12 h-12 rounded-full overflow-hidden bg-white text-slate-800 flex items-center justify-center shrink-0 font-bold text-lg relative border border-slate-200/80 shadow-sm">
                     <img src={convo.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${convo.name}`} alt={convo.name} class="w-full h-full object-cover" />
                     <div class={`absolute bottom-0 right-0 w-3.5 h-3.5 ${authService.computeIsOnline(convo, currentTime) ? 'bg-orange-500' : 'bg-gray-400'} rounded-full border-2 border-white`}></div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-center mb-1">
                      <span class="font-sans font-bold text-slate-800 text-[15px] hover:underline" onclick={(e) => openProfileLightbox(e, convo)}>{convo.name || 'Anonymous'}</span>
                      <span class="text-[13px] text-slate-400 font-medium tracking-tight">{convo.lastMessage ? new Date(convo.lastMessage.createdAt ?? convo.lastMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    </div>
                    <div class="flex items-center gap-1.5 overflow-hidden">
                       {#if convo.lastMessage}
                          {#if (convo.lastMessage.senderId ?? convo.lastMessage.sender_id) === currentUserId || (!currentUserId && (convo.lastMessage.senderId ?? convo.lastMessage.sender_id) === '6a037aac0000618c52aa')}
                             <div class="flex shrink-0 items-center text-slate-400">
                               {#if convo.lastMessage.status === 'pending'}
                                  <div class="w-2.5 h-2.5 rounded-full border border-slate-400 border-t-transparent animate-spin"></div>
                               {:else if convo.lastMessage.status === 'read'}
                                  <CheckCheck size={14} class="text-orange-500" />
                               {:else if convo.lastMessage.status === 'delivered'}
                                  <CheckCheck size={14} class="text-slate-400" />
                               {:else}
                                  <Check size={14} class="text-slate-400" />
                               {/if}
                             </div>
                             <span class="text-[13px] text-slate-500 font-sans shrink-0">You:</span>
                          {/if}
                          <p class="text-[13px] text-slate-500 truncate font-sans flex-1 leading-tight select-none">
                             {getLastMessageContent(convo)}
                          </p>
                       {:else}
                          <p class="text-[13px] text-slate-400 truncate font-sans flex-1 leading-tight select-none">
                             No messages yet
                          </p>
                       {/if}
                       
                       <!-- Unread indicator count -->
                       <UnreadBadge conversationId={convo.id} userId={currentUserId} lastReadAt={convo.lastReadAt} />
                    </div>
                  </div>
                </div>
              </div>
            {/each}
          {/if}
        </div>
        
      {:else if activeTab === 'notifications'}
        <div in:fade|local={{ duration: 200 }} out:fade|local={{ duration: 200 }} class="space-y-4 text-sm relative w-full left-0 top-0 filter drop-shadow-[0_8px_16px_rgba(15,23,42,0.06)]">
          <div class="deckle-card flex items-start gap-4 p-4 cursor-pointer" style="clip-path: {getTornClipPath('notify-1')};">
              <div class="pt-1"><Flame size={20} class="text-accent" /></div>
              <div class="flex-1">
                <h4 class="font-sans font-bold text-ink text-base">14-day streak!</h4>
                <p class="text-xs text-sage mt-1 font-sans leading-tight">You have studied 14 days in a row. Keep it up!</p>
                <p class="text-[10px] text-sage font-sans font-bold uppercase tracking-wider mt-2">Just now</p>
              </div>
          </div>
          <div class="deckle-card flex items-start gap-4 p-4 cursor-pointer" style="clip-path: {getTornClipPath('notify-2')};">
              <div class="pt-1"><ClipboardList size={20} class="text-olive" /></div>
              <div class="flex-1">
                <h4 class="font-sans font-bold text-ink text-base">New question from Mr. Kato</h4>
                <p class="text-xs text-sage mt-1 font-sans leading-tight">S.4 Biology — "Describe the role of chlorophyll..." — Due in 28 min</p>
                <p class="text-[10px] text-sage font-sans font-bold uppercase tracking-wider mt-2">2 hrs ago</p>
              </div>
          </div>
          <div class="deckle-card flex items-start gap-4 p-4 cursor-pointer" style="clip-path: {getTornClipPath('notify-3')};">
              <div class="pt-1"><Trophy size={20} class="text-olive" /></div>
              <div class="flex-1">
                <h4 class="font-sans font-bold text-ink text-base">You moved up to 7th on the leaderboard</h4>
                <p class="text-xs text-sage mt-1 font-sans leading-tight">St. Mary's College weekly ranking — keep answering!</p>
                <p class="text-[10px] text-sage font-sans font-bold uppercase tracking-wider mt-2">5 hrs ago</p>
              </div>
          </div>
          <div class="deckle-card flex items-start gap-4 p-4 cursor-pointer" style="clip-path: {getTornClipPath('notify-4')};">
              <div class="pt-1"><BookOpen size={20} class="text-olive" /></div>
              <div class="flex-1">
                <h4 class="font-sans font-bold text-ink text-base">New Biology video: Mitosis explained</h4>
                <p class="text-xs text-sage mt-1 font-sans leading-tight">A new animated lesson has been added to your subject.</p>
                <p class="text-[10px] text-sage font-sans font-bold uppercase tracking-wider mt-2">Yesterday</p>
              </div>
          </div>
          <div class="deckle-card flex items-start gap-4 p-4 cursor-pointer" style="clip-path: {getTornClipPath('notify-5')};">
              <div class="pt-1"><MessageSquare size={20} class="text-olive" /></div>
              <div class="flex-1">
                <h4 class="font-sans font-bold text-ink text-base">Grace answered your forum question</h4>
                <p class="text-xs text-sage mt-1 font-sans leading-tight">"The turning point is found by completing the square or using x = -b/2a..."</p>
                <p class="text-[10px] text-sage font-sans font-bold uppercase tracking-wider mt-2">2 days ago</p>
              </div>
          </div>
        </div>

      {:else if activeTab === 'connect'}
        <div in:fade|local={{ duration: 200 }} out:fade|local={{ duration: 200 }} class="space-y-6 relative w-full left-0 top-0 filter drop-shadow-[0_8px_16px_rgba(15,23,42,0.06)]">
           {#if incomingRequests.length > 0}
             <div>
               <h3 class="font-sans font-bold text-slate-500 text-xs uppercase tracking-widest mb-3 px-1">Connection Requests ({incomingRequests.length})</h3>
               <div class="space-y-4">
                 {#each incomingRequests as req, i}
                   <div class="deckle-card flex items-center justify-between p-4" style="clip-path: {getTornClipPath('invite-' + (req.id || i))};">
                      <!-- svelte-ignore a11y_click_events_have_key_events -->
                      <!-- svelte-ignore a11y_no_static_element_interactions -->
                      <div class="flex items-center gap-3 cursor-pointer" onclick={(e) => openProfileLightbox(e, req)}>
                         {#if req.avatarUrl}
                             <img src={req.avatarUrl} alt="Avatar" class="w-12 h-12 rounded-full object-cover shrink-0 border border-slate-200" />
                         {:else}
                             <div class="w-12 h-12 rounded-full bg-white text-slate-800 flex items-center justify-center shrink-0 font-bold text-lg border border-slate-200">
                               {req.name.charAt(0).toUpperCase()}
                             </div>
                         {/if}
                         <div>
                           <h4 class="font-sans font-bold text-slate-800 text-base">{req.name}</h4>
                           <p class="text-[10px] text-slate-400 font-sans font-bold uppercase tracking-wider mt-1">{req.school} {#if req.studentClass}· {req.studentClass}{/if}</p>
                         </div>
                      </div>
                      <div class="flex flex-col gap-2 shrink-0">
                         <button onclick={() => handleAcceptRequest(req)} class="bg-[#ff5b14] select-none cursor-pointer border-none font-sans font-bold text-[10px] uppercase tracking-widest px-4 py-2 rounded-full hover:bg-[#ea580c] shadow-md shadow-orange-500/25 text-white transition-all">Accept</button>
                         <button onclick={() => handleDeclineRequest(req)} class="bg-transparent border border-slate-300 select-none cursor-pointer text-slate-700 font-sans font-bold text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-full hover:bg-slate-100 transition-all">Decline</button>
                      </div>
                   </div>
                 {/each}
               </div>
             </div>
           {/if}

           <div>
              <h3 class="font-sans font-bold text-slate-500 text-xs uppercase tracking-widest mb-3 px-1">Connected Students ({myComrades.length})</h3>
              {#if myComrades.length === 0}
                <div class="deckle-card p-10 text-center" style="clip-path: {getTornClipPath('network-empty')};">
                   <p class="text-xs text-slate-400 font-sans font-bold">You don't have any connections yet.</p>
                </div>
              {:else}
                <div class="space-y-4 font-medium">
                    {#each myComrades as comrade}
                      <!-- svelte-ignore a11y_click_events_have_key_events -->
                      <!-- svelte-ignore a11y_no_static_element_interactions -->
                      <div onclick={() => onopenchat?.('user_' + comrade.userId, comrade.name)} class="deckle-card flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors" style="clip-path: {getTornClipPath('comrade-' + comrade.userId)};">
                         <div class="flex items-center gap-3">
                            {#if comrade.avatarUrl}
                               <img src={comrade.avatarUrl} alt={comrade.name} class="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-200" />
                            {:else}
                               <div class="w-10 h-10 rounded-full bg-white text-slate-800 flex items-center justify-center shrink-0 font-bold text-base border border-slate-200">
                                 {comrade.name[0]}
                               </div>
                            {/if}
                            <div>
                              <h4 class="font-sans font-bold text-slate-800 text-base">{comrade.name}</h4>
                              <p class="text-[10px] text-slate-400 uppercase tracking-wider font-sans font-bold mt-1">{comrade.school || 'Exup Peer'}</p>
                            </div>
                         </div>
                         <ChevronLeft size={16} class="text-slate-400 rotate-180" />
                      </div>
                    {/each}
                </div>
              {/if}
              
              <button onclick={() => triggerAction('Find Students', 'Opening Social Directory...', 'info')} class="w-full py-4 bg-white border border-slate-200 rounded-full text-slate-800 font-sans font-bold text-xs uppercase tracking-widest shadow-sm hover:bg-slate-50 hover:translate-y-[-1px] cursor-pointer transition-all flex items-center justify-center gap-2 mt-4 mb-6">
                 Find more students <span>→</span>
              </button>
           </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<UserProfileLightbox 
     bind:isOpen={isProfileLightboxOpen} 
     bind:user={profileData} 
     isComrade={isComrade}
     isInvited={isInvited}
     onMessage={(u) => { 
        triggerNotification('Messaging', { body: `Starting message with ${u.name}...`, type: 'info' }); 
        const rawId = u.userId || u.id || Math.random().toString();
        const formattedId = rawId.startsWith('user_') ? rawId : `user_${rawId}`;
        onopenchat?.(formattedId, u.name); 
     }}
     onInvite={async (u) => { 
        triggerNotification('Sending Request', { body: `Sending connection request to ${u.name}...`, type: 'info' });
        const { friendshipService } = await import('../services/friendshipService');
        const success = await friendshipService.sendFriendRequest(currentUserId, u.userId);
        if (success) {
            triggerNotification('Invite Sent', { body: `Connection request sent to ${u.name}!`, type: 'success' });
            isInvited = true;
        } else {
            triggerNotification('Error', { body: 'Failed to send request.', type: 'error' });
        }
     }}
     onUnfriend={async (u) => {
        triggerNotification('Unfriending', { body: `Removing ${u.name} from comrades...`, type: 'info' });
        const { friendshipService } = await import('../services/friendshipService');
        const success = await friendshipService.unfriendUser(currentUserId, u.userId);
        if (success) {
            triggerNotification('Comrade Removed', { body: `${u.name} is no longer your comrade.`, type: 'success' });
            isComrade = false;
            myComrades = myComrades.filter(c => c.userId !== u.userId);
        } else {
            triggerNotification('Error', { body: 'Failed to remove comrade.', type: 'error' });
        }
     }}
/>

<style>
  /* Custom Paper/Ink Organic/Handmade Styling */
  .paper-canvas {
    background-color: #fafafa;
  }
  
  .deckle-card {
    background-color: #ffffff;
    border-left: 2px dashed #cbd5e1; /* perforated dashed line on the left */
    border-right: 1px solid rgba(0, 0, 0, 0.03);
    border-radius: 0 !important;
    position: relative;
    /* Sharp corners with high-frequency torn bottom edge */
    clip-path: polygon(
      0% 0px, 100% 0px,
      100% 100%, 99.0% calc(100% - 1.8px), 98.0% calc(100% - 2.1px), 97.0% calc(100% - 2.6px), 96.0% calc(100% - 1.5px), 95.0% calc(100% - 1.0px), 94.0% calc(100% - 1.8px), 93.0% calc(100% - 1.7px), 92.0% calc(100% - 2.4px), 91.0% calc(100% - 2.5px), 90.0% calc(100% - 1.1px), 89.0% calc(100% - 1.3px), 88.0% calc(100% - 1.9px), 87.0% calc(100% - 1.8px), 86.0% calc(100% - 2.6px), 85.0% calc(100% - 2.1px), 84.0% calc(100% - 0.9px), 83.0% calc(100% - 1.5px), 82.0% calc(100% - 1.8px), 81.0% calc(100% - 2.0px), 80.0% calc(100% - 2.7px), 79.0% calc(100% - 1.7px), 78.0% calc(100% - 1.0px), 77.0% calc(100% - 1.7px), 76.0% calc(100% - 1.8px), 75.0% calc(100% - 2.2px), 74.0% calc(100% - 2.6px), 73.0% calc(100% - 1.3px), 72.0% calc(100% - 1.2px), 71.0% calc(100% - 1.8px), 70.0% calc(100% - 1.8px), 69.0% calc(100% - 2.5px), 68.0% calc(100% - 2.3px), 67.0% calc(100% - 1.0px), 66.0% calc(100% - 1.4px), 65.0% calc(100% - 1.8px), 64.0% calc(100% - 1.9px), 63.0% calc(100% - 2.6px), 62.0% calc(100% - 1.9px), 61.0% calc(100% - 0.9px), 60.0% calc(100% - 1.7px), 59.0% calc(100% - 1.8px), 58.0% calc(100% - 2.1px), 57.0% calc(100% - 2.6px), 56.0% calc(100% - 1.5px), 55.0% calc(100% - 1.0px), 54.0% calc(100% - 1.8px), 53.0% calc(100% - 1.7px), 52.0% calc(100% - 2.4px), 51.0% calc(100% - 2.5px), 50.0% calc(100% - 1.1px), 49.0% calc(100% - 1.3px), 48.0% calc(100% - 1.9px), 47.0% calc(100% - 1.8px), 46.0% calc(100% - 2.6px), 45.0% calc(100% - 2.1px), 44.0% calc(100% - 0.9px), 43.0% calc(100% - 1.5px), 42.0% calc(100% - 1.8px), 41.0% calc(100% - 2.0px), 40.0% calc(100% - 2.7px), 39.0% calc(100% - 1.7px), 38.0% calc(100% - 1.0px), 37.0% calc(100% - 1.7px), 36.0% calc(100% - 1.8px), 35.0% calc(100% - 2.2px), 34.0% calc(100% - 2.6px), 33.0% calc(100% - 1.3px), 32.0% calc(100% - 1.2px), 31.0% calc(100% - 1.8px), 30.0% calc(100% - 1.8px), 29.0% calc(100% - 2.5px), 28.0% calc(100% - 2.3px), 27.0% calc(100% - 1.0px), 26.0% calc(100% - 1.4px), 25.0% calc(100% - 1.8px), 24.0% calc(100% - 1.9px), 23.0% calc(100% - 2.6px), 22.0% calc(100% - 1.9px), 21.0% calc(100% - 0.9px), 20.0% calc(100% - 1.7px), 19.0% calc(100% - 1.8px), 18.0% calc(100% - 2.1px), 17.0% calc(100% - 2.6px), 16.0% calc(100% - 1.5px), 15.0% calc(100% - 1.0px), 14.0% calc(100% - 1.8px), 13.0% calc(100% - 1.7px), 12.0% calc(100% - 2.4px), 11.0% calc(100% - 2.5px), 10.0% calc(100% - 1.1px), 9.0% calc(100% - 1.3px), 8.0% calc(100% - 1.9px), 7.0% calc(100% - 1.8px), 6.0% calc(100% - 2.6px), 5.0% calc(100% - 2.1px), 4.0% calc(100% - 0.9px), 3.0% calc(100% - 1.5px), 2.0% calc(100% - 1.8px), 1.0% calc(100% - 2.0px), 0% 100%
    );
    filter: drop-shadow(0 2px 4px rgba(15, 23, 42, 0.03)) drop-shadow(0 8px 16px rgba(15, 23, 42, 0.06));
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }
  
  .deckle-card:hover {
    transform: translateY(-2px);
    filter: drop-shadow(0 3px 6px rgba(15, 23, 42, 0.04)) drop-shadow(0 12px 24px rgba(15, 23, 42, 0.08));
  }

  .unselectable {
    -webkit-touch-callout: none;
    user-select: none;
  }
</style>
