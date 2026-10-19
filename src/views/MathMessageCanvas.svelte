<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  function virtualKeyboardManual(node: HTMLElement) {
    node.setAttribute('virtualkeyboardpolicy', 'manual');
  }
  function lockNativeKeyboard(e: any) {
    if (e.target && typeof e.target.blur === 'function') {
      e.target.blur();
    }
  }
  onMount(() => {
    document.addEventListener('focusin', lockNativeKeyboard, true);
  });
  onDestroy(() => {
    document.removeEventListener('focusin', lockNativeKeyboard, true);
  });
  import { X, Send, BookOpen, Square, LineChart, MoreHorizontal, Settings, Calculator, Lock, Copy, Trash2, Radical, Type, CornerDownRight, Hexagon, Tag, MousePointer2, ChevronLeft, ChevronRight, Users, Pencil, Circle, Star, SlidersHorizontal, Sigma, Play, Mic, Hand, MoreVertical, MessageSquareQuote, FileDown, Image as ImageIcon, Eraser, Eye, EyeOff } from 'lucide-svelte';
  import { fly, fade, scale } from 'svelte/transition';
  import MathKeyboard from '../components/MathKeyboard.svelte';
  // @ts-ignore
  import AudioMessagePlayer from '../components/AudioMessagePlayer.svelte';
  import { authService } from '../services/authService';
  import { presenceService } from '../services/presenceService';
  import { downloadMathDocument, generateUUID } from '../services/mathStorage';
  import { supabase, supabaseDbService } from '../services/supabaseService';

  import type { MathDocument } from '../types/MathDocument';

  let { isOpen = $bindable(false), initialDoc = $bindable(null), mathMessage = null, onsend, onsendcanvas, unreadCount = 0 } = $props<{
    isOpen?: boolean;
    initialDoc?: MathDocument | null;
    mathMessage?: any | null;
    onsend: (message: string, image: string | null) => void;
    onsendcanvas?: (elements: any[], thumbnailData: string) => void;
    unreadCount?: number;
  }>();

  let elements = $state<any[]>([]);
  let showSentMessage = $state(false);
  let planeMidX = $state(0);
  let planeMidY = $state(0);
  let planeMidRot = $state(0);
  let planeEndX = $state(0);
  let planeEndY = $state(0);
  let planeEndRot = $state(0);
  let currentSessionId = $state<string | null>(null);
  let activePresences = $state<any[]>([]);
  let currentUserId = $state<string | null>(null);
  let myIsEditing = $state(false);
  
  // New UI mapping
  let activeTool = $state('pointer');
  let chatText = $state('');
  let showChatMenu = $state(false);
  let showLiveChat = $state(false);
  let chatTextareaRef = $state<HTMLTextAreaElement | null>(null);
  let liveChatKeyboardOpen = $state(false);
  let liveMessages = $state<any[]>([]);
  let liveMessagesContainerRef = $state<HTMLElement | null>(null);

  const scrollToBottom = () => {
     setTimeout(() => {
        if (liveMessagesContainerRef) {
           liveMessagesContainerRef.scrollTo({ top: liveMessagesContainerRef.scrollHeight, behavior: 'smooth' });
        }
     }, 50);
  };


  let showAnnotations = $state(true);
  let showToolbar = $state(true);
  
  // slideshow state
  let isNavigating = $state(false);

  let isLockedByOther = $derived(activePresences.some(p => p.userId !== currentUserId && p.isChalkHolder));

  let currentUserName = $state<string>('You');
  let liveMessagesUnsubscribe = $state<(() => void) | null>(null);

  // Ink colors: blue for current user, grey/slate for other
  function getInkClass(el: any, mode: 'text' | 'border' | 'stroke' | 'bg' | 'fill' = 'text'): string {
    const isMe = (el.authorId && el.authorId === currentUserId) || 
                 (el.createdBy && (el.createdBy === currentUserId || el.createdBy === currentUserName)) ||
                 (!el.authorId && !el.createdBy && mathMessage ? (mathMessage.senderId === currentUserId) : true);
                 
    if (isMe) {
      if (mode === 'text') return 'font-handwriting text-[#1d4ed8] font-bold';
      if (mode === 'border') return 'border-[#1d4ed8]';
      if (mode === 'bg') return 'bg-[#1d4ed8]/5';
      if (mode === 'stroke') return '#1d4ed8';
      if (mode === 'fill') return 'fill-[#1d4ed8]';
    } else {
      if (mode === 'text') return 'font-handwriting text-[#64748b] font-bold';
      if (mode === 'border') return 'border-[#64748b]';
      if (mode === 'bg') return 'bg-[#64748b]/5';
      if (mode === 'stroke') return '#64748b';
      if (mode === 'fill') return 'fill-[#64748b]';
    }
    return '';
  }

  async function subscribeToLiveMessages(docId: string) {
     if (liveMessagesUnsubscribe) {
        liveMessagesUnsubscribe();
        liveMessagesUnsubscribe = null;
     }

     if (!docId) return;

     // 1. Initial fetch of existing messages
     try {
        const { data, error } = await supabase
           .from('live_canvas_messages')
           .select('*')
           .eq('document_id', docId)
           .order('created_at', { ascending: true });

        if (!error && data) {
           liveMessages = data.map(m => ({
              id: m.id,
              text: m.text_content,
              senderId: m.sender_id,
              senderName: m.sender_name,
              message_type: m.message_type,
              attachments: typeof m.attachments === 'string' ? JSON.parse(m.attachments) : m.attachments,
              timestamp: new Date(m.created_at)
           }));
           scrollToBottom();
        }
     } catch (err) {
        console.error('Failed to pre-fetch live messages:', err);
     }

     // 2. Subscribe to real-time events filtered by document_id
     try {
        const channel = supabase
           .channel(`live_canvas_messages:${docId}:${Math.random().toString(36).substring(7)}`)
           .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'live_canvas_messages', filter: `document_id=eq.${docId}` },
              (payload) => {
                 if (payload.eventType === 'INSERT') {
                    const m = payload.new;
                    if (!liveMessages.some(existing => existing.id === m.id)) {
                       liveMessages = [...liveMessages, {
                          id: m.id,
                          text: m.text_content,
                          senderId: m.sender_id,
                          senderName: m.sender_name,
                          message_type: m.message_type,
                          attachments: typeof m.attachments === 'string' ? JSON.parse(m.attachments) : m.attachments,
                          timestamp: new Date(m.created_at)
                       }];
                    }
                 } else if (payload.eventType === 'DELETE') {
                    liveMessages = liveMessages.filter(existing => existing.id !== payload.old.id);
                 }
              }
           )
           .subscribe();

        liveMessagesUnsubscribe = () => {
           supabase.removeChannel(channel);
        };
     } catch (err) {
        console.error('Failed to construct realtimer channel:', err);
     }
  }

  $effect(() => {
     if (isOpen && currentSessionId) {
        subscribeToLiveMessages(currentSessionId);
     }
     return () => {
        if (liveMessagesUnsubscribe) {
           liveMessagesUnsubscribe();
           liveMessagesUnsubscribe = null;
        }
     };
  });

  $effect(() => {
    authService.getCurrentUser().then(u => {
      if (u) {
         currentUserId = u.$id || u.id;
         currentUserName = u.name || u.prefs?.fullName || u.email || 'You';
         supabaseDbService.getProfile(currentUserId).then(p => {
            if (p) {
               const fullName = (p.full_name || `${p.surname || ''} ${p.last_name || ''}`).trim();
               if (fullName) currentUserName = fullName;
            }
         }).catch(() => {});
      }
    });
  });

  async function loadVersion(index: number) {
      if (!initialDoc || !initialDoc.versionChainIds || !initialDoc.versionFileIds) return;
      isNavigating = true;
      try {
          const fileId = initialDoc.versionFileIds[index];
          const newDoc = await downloadMathDocument(fileId);
          newDoc.versionChainIds = initialDoc.versionChainIds;
          newDoc.versionFileIds = initialDoc.versionFileIds;
          newDoc.versionAuthorIds = initialDoc.versionAuthorIds;
          newDoc.versionAuthorNames = initialDoc.versionAuthorNames;
          newDoc.currentVersionIndex = index;
          initialDoc = newDoc;
          elements = JSON.parse(JSON.stringify(newDoc.elements || [])).filter((el: any) => el.type !== 'typing_layer' || (el.content && el.content.trim() !== ''));
          currentSessionId = newDoc.documentId;

          // Persist last seen
          if (mathMessage) {
             localStorage.setItem(`last_seen_${mathMessage.id}_${currentUserId}`, String(index));
          }
      } catch (err) {
          console.error('Failed to load version:', err);
      } finally {
          isNavigating = false;
      }
  }

  $effect(() => {
    if (initialDoc && initialDoc.versionChainIds && initialDoc.versionChainIds.length > 0) {
      currentSessionId = initialDoc.versionChainIds[0];
    } else if (initialDoc && initialDoc.documentId) {
      currentSessionId = initialDoc.documentId;
    } else {
      currentSessionId = 'temp_' + Date.now();
    }
  });

  $effect(() => {
    let cleanup: (() => void) | null = null;
    let effectSessionId = currentSessionId;
    if (isOpen && effectSessionId) {
       presenceService.subscribe(effectSessionId, (prs) => {
         activePresences = prs;
       }).then(fn => {
         cleanup = fn;
       });
    }
    return () => {
       if (cleanup) cleanup();
       if (effectSessionId) presenceService.removePresence(effectSessionId);
    };
  });

  let lastLoadedVersionKey = $state<string | null>(null);

  $effect(() => {
    const currentKey = initialDoc ? `${initialDoc.documentId}_${initialDoc.currentVersionIndex}` : null;
    if (currentKey !== lastLoadedVersionKey) {
       lastLoadedVersionKey = currentKey;
       if (initialDoc && initialDoc.elements) {
         elements = JSON.parse(JSON.stringify(initialDoc.elements)).filter((el: any) => el.type !== 'typing_layer' || (el.content && el.content.trim() !== ''));
       } else {
         elements = [];
       }
    }
  });

  $effect(() => {
    if (editingElementId && activeTextareaRef) {
      activeTextareaRef.focus();
    }
  });

  function generateThumbnail(canvasElements: any[]): string {
    if (typeof document === 'undefined') return '';
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // 1. Solid clean white background to reduce clutter
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 600, 360);

    const getInkColor = (el: any) => {
      const isMe = (el.authorId && el.authorId === currentUserId) || 
                   (el.createdBy && (el.createdBy === currentUserId || el.createdBy === currentUserName)) ||
                   (!el.authorId && !el.createdBy && mathMessage ? (mathMessage.senderId === currentUserId) : true);
      return isMe ? '#1d4ed8' : '#64748b';
    };

    // 4. Draw elements
    canvasElements.forEach(el => {
      ctx.save();
      // Translate to centroid to handle rotation
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      ctx.translate(cx, cy);
      if (el.rotation) {
        ctx.rotate((el.rotation * Math.PI) / 180);
      }
      ctx.translate(-el.width / 2, -el.height / 2);

      const inkColor = getInkColor(el);

      // Render based on type
      if (el.type === 'equation' || el.type === 'text' || el.type === 'typing_layer') {
        ctx.fillStyle = inkColor;
        // Using "Comic Sans MS" or fallback cursive/Georgia to represent handwriting mood in canvas export
        ctx.font = el.type === 'typing_layer' ? '15px sans-serif' : 'italic bold 26px "Comic Sans MS", "Chalkboard SE", "Georgia", cursive, serif';
        ctx.textAlign = el.type === 'typing_layer' ? 'left' : 'center';
        ctx.textBaseline = el.type === 'typing_layer' ? 'top' : 'middle';
        
        let txt = el.content || '';
        if (el.type === 'typing_layer') {
          const lines = txt.split('\n');
          let currentY = 5;
          lines.forEach(line => {
             if (currentY + 18 < el.height) {
                ctx.fillText(line, 5, currentY, el.width - 10);
                currentY += 18;
             }
          });
        } else {
          ctx.fillText(txt || 'x', el.width / 2, el.height / 2, el.width - 10);
        }
      } else if (el.type === 'rectangle') {
        ctx.strokeStyle = inkColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(4, 4, el.width - 8, el.height - 8);
      } else if (el.type === 'circle') {
        ctx.strokeStyle = inkColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        const rx = Math.max(0.1, el.width / 2 - 4);
        const ry = Math.max(0.1, el.height / 2 - 4);
        ctx.ellipse(el.width / 2, el.height / 2, rx, ry, 0, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (el.type === 'pie_chart') {
        const r = Math.min(el.width, el.height) / 2 - 4;
        const cx_el = el.width / 2;
        const cy_el = el.height / 2;
        
        ctx.strokeStyle = inkColor;
        ctx.lineWidth = 2;
        
        ctx.fillStyle = inkColor + '10';
        ctx.beginPath();
        ctx.moveTo(cx_el, cy_el);
        ctx.arc(cx_el, cy_el, r, 0, Math.PI * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = inkColor + '20';
        ctx.beginPath();
        ctx.moveTo(cx_el, cy_el);
        ctx.arc(cx_el, cy_el, r, Math.PI * 0.7, Math.PI * 1.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = inkColor + '35';
        ctx.beginPath();
        ctx.moveTo(cx_el, cy_el);
        ctx.arc(cx_el, cy_el, r, Math.PI * 1.5, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (el.type === 'table') {
        ctx.strokeStyle = inkColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, el.width - 4, el.height - 4);
        
        ctx.beginPath();
        ctx.moveTo(el.width / 2, 2);
        ctx.lineTo(el.width / 2, el.height - 2);
        ctx.moveTo(2, el.height / 2);
        ctx.lineTo(el.width - 2, el.height / 2);
        ctx.stroke();
      } else if (el.type === 'curve') {
        ctx.strokeStyle = inkColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(4, el.height - 4);
        ctx.bezierCurveTo(el.width / 3, el.height * 1.5, el.width * 2 / 3, -el.height * 0.5, el.width - 4, 4);
        ctx.stroke();
      } else {
        ctx.strokeStyle = inkColor + '80';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(2, 2, el.width - 4, el.height - 4);
      }

      ctx.restore();
    });

    return canvas.toDataURL('image/png');
  }

  let selectedElementId = $state<string | null>(null);
  let toolbarDrawerOpen = $state<'equation' | 'shapes' | 'graph' | 'more' | 'library' | null>(null);
  let propertiesLightboxOpen = $state<string | null>(null); // element id
  let editingElementId = $state<string | null>(null);
  let activeTextareaRef = $state<HTMLTextAreaElement | null>(null);

  const equationPages = [
    {
      title: 'Basic',
      tools: [
        { label: 'x', val: 'x' }, { label: 'y', val: 'y' }, { label: '=', val: '=' }, { label: '+', val: '+' }, { label: '-', val: '-' }, 
        { label: '×', val: '×' }, { label: '÷', val: '÷' }, { label: '()', val: '()' }, { label: 'x²', val: '²' }, { label: 'x³', val: '³' },
        { label: '√', val: '√' }, { label: 'a/b', val: '/' }, { label: '±', val: '±' }, { label: '<', val: '<' }, { label: '>', val: '>' }
      ]
    },
    {
      title: 'Algebra & Sets',
      tools: [
        { label: 'xⁿ', val: '^' }, { label: '∛', val: '∛' }, { label: '|x|', val: '||' }, { label: '≠', val: '≠' }, { label: '≤', val: '≤' }, 
        { label: '≥', val: '≥' }, { label: '≈', val: '≈' }, { label: '∈', val: '∈' }, { label: '∉', val: '∉' }, { label: '⊂', val: '⊂' }, 
        { label: '∪', val: '∪' }, { label: '∩', val: '∩' }, { label: '∅', val: '∅' }, { label: '∴', val: '∴' }, { label: '∵', val: '∵' }
      ]
    },
    {
      title: 'Trig & Geom',
      tools: [
        { label: 'sin', val: 'sin(' }, { label: 'cos', val: 'cos(' }, { label: 'tan', val: 'tan(' }, { label: 'θ', val: 'θ' }, { label: 'π', val: 'π' }, 
        { label: '°', val: '°' }, { label: '∠', val: '∠' }, { label: '△', val: '△' }, { label: '∥', val: '∥' }, { label: '⊥', val: '⊥' }, 
        { label: '≅', val: '≅' }, { label: '≡', val: '≡' }, { label: 'α', val: 'α' }, { label: 'β', val: 'β' }, { label: 'γ', val: 'γ' }
      ]
    },
    {
      title: 'Advanced',
      tools: [
        { label: '∫', val: '∫' }, { label: 'd/dx', val: 'd/dx' }, { label: 'lim', val: 'lim' }, { label: '∑', val: '∑' }, { label: '∏', val: '∏' }, 
        { label: 'eˣ', val: 'e' }, { label: 'ln', val: 'ln(' }, { label: 'log', val: 'log(' }, { label: '∞', val: '∞' }, { label: '!', val: '!' },
        { label: 'Δ', val: 'Δ' }, { label: '∇', val: '∇' }, { label: 'μ', val: 'μ' }, { label: 'σ', val: 'σ' }, { label: 'λ', val: 'λ' }
      ]
    }
  ];
  let currentEqPage = $state(0);

  const shapesTools = [
    { label: 'Line', symbol: '╱' }, { label: 'Arrow', symbol: '↗' }, { label: 'Rectangle', symbol: '▭' }, { label: 'Circle', symbol: '◯' },
    { label: 'Triangle', symbol: '△' }, { label: 'Right Angle', symbol: '∟' }, { label: 'Polygon', symbol: '⬡' }, { label: 'Arc', symbol: '◠' },
    { label: 'Text', symbol: 'T' }, { label: 'Label', symbol: '○' }, { label: 'Highlight', symbol: '🖍' }, { label: 'Eraser', symbol: '⌫' }
  ];

  let touchStartX = 0;
  let isSwiping = false;

  const onCanvasTouchStart = (e: TouchEvent) => {
    if (e.target === canvasEl && selectedElementId === null && transformMode === null) {
       touchStartX = e.touches[0].clientX;
       isSwiping = true;
    } else {
       isSwiping = false;
    }
  };

  const onCanvasTouchEnd = (e: TouchEvent) => {
    if (!isSwiping) return;
    isSwiping = false;
    
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchEndX - touchStartX;
    if (Math.abs(diff) > 50) { // threshold for swipe
       if (!initialDoc || !initialDoc.versionChainIds || initialDoc.currentVersionIndex === undefined) return;
       if (diff > 0) { // swipe right (previous)
          if (initialDoc.currentVersionIndex > 0) loadVersion(initialDoc.currentVersionIndex - 1);
       } else { // swipe left (next)
          if (initialDoc.currentVersionIndex < initialDoc.versionChainIds.length - 1) loadVersion(initialDoc.currentVersionIndex + 1);
       }
    }
  };

  // Dragging logic
  let transformMode = $state<'move' | 'scale' | 'rotate' | null>(null);
  let transformHandle = $state<string | null>(null);
  let dragStart = { x: 0, y: 0 };
  let originalPos = { x: 0, y: 0 };
  let originalSize = { width: 0, height: 0 };
  let originalRot = 0;
  let canvasEl: HTMLDivElement;

  const onElementPointerDown = (e: PointerEvent, id: string) => {
    e.stopPropagation();
    if (activeTool === 'eraser') {
      elements = elements.filter(el => el.id !== id);
      if (selectedElementId === id) selectedElementId = null;
      myIsEditing = true;
      return;
    }
    selectedElementId = id;
    const el = elements.find(el => el.id === id);
    if (el) {
      transformMode = 'move';
      dragStart = { x: e.clientX, y: e.clientY };
      originalPos = { x: el.x, y: el.y };
    }
  };

  const SNAP_GRID = 5;

  const onCanvasPointerMove = (e: PointerEvent) => {
    if (currentSessionId && isOpen) {
       const rect = canvasEl?.getBoundingClientRect();
       if (rect) {
          const px = e.clientX - rect.left;
          const py = e.clientY - rect.top;
          presenceService.updateCursor(currentSessionId, px, py, myIsEditing);
       }
    }

    if (transformMode && selectedElementId) {
      const elSelected = elements.find(el => el.id === selectedElementId);
      if (elSelected) {
        if (transformMode === 'move') {
          const dx = e.clientX - dragStart.x;
          const dy = e.clientY - dragStart.y;
          elSelected.x = Math.round((originalPos.x + dx) / SNAP_GRID) * SNAP_GRID;
          elSelected.y = Math.round((originalPos.y + dy) / SNAP_GRID) * SNAP_GRID;
        } else if (transformMode === 'scale') {
          const dx = e.clientX - dragStart.x;
          const dy = e.clientY - dragStart.y;
          let delta = 0;
          if (transformHandle === 'se') delta = Math.max(dx, dy);
          else if (transformHandle === 'nw') delta = Math.max(-dx, -dy);
          else if (transformHandle === 'ne') delta = Math.max(dx, -dy);
          else if (transformHandle === 'sw') delta = Math.max(-dx, dy);

          const aspect = originalSize.width / originalSize.height;
          let newWidth = Math.max(SNAP_GRID, Math.round((originalSize.width + delta) / SNAP_GRID) * SNAP_GRID);
          let newHeight = newWidth / aspect;

          if (transformHandle === 'nw') {
              elSelected.x = Math.round((originalPos.x + (originalSize.width - newWidth)) / SNAP_GRID) * SNAP_GRID;
              elSelected.y = Math.round((originalPos.y + (originalSize.height - newHeight)) / SNAP_GRID) * SNAP_GRID;
          } else if (transformHandle === 'ne') {
              elSelected.y = Math.round((originalPos.y + (originalSize.height - newHeight)) / SNAP_GRID) * SNAP_GRID;
          } else if (transformHandle === 'sw') {
              elSelected.x = Math.round((originalPos.x + (originalSize.width - newWidth)) / SNAP_GRID) * SNAP_GRID;
          }

          elSelected.width = newWidth;
          elSelected.height = newHeight;
        } else if (transformMode === 'rotate') {
           const centerX = originalPos.x;
           const centerY = originalPos.y;
           const startAngle = parseFloat(transformHandle!);
           const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
           let angleDiff = currentAngle - startAngle;
           elSelected.rotation = Math.round((originalRot + angleDiff) / 15) * 15;
        }
        elements = [...elements]; // trigger reactivity
      }
    }
  };

  const pruneEmptyTypingLayers = () => {
    const originalLen = elements.length;
    elements = elements.filter(el => el.type !== 'typing_layer' || (el.content && el.content.trim() !== ''));
    if (elements.length !== originalLen) {
      myIsEditing = true;
    }
  };

  const onCanvasPointerUp = () => {
    transformMode = null;
    transformHandle = null;
  };

  const onCanvasClick = (e: MouseEvent) => {
    if (e.target === canvasEl) {
      const activeEl = elements.find(item => item.id === editingElementId);
      if (activeEl && activeEl.type === 'typing_layer' && (!activeEl.content || !activeEl.content.trim())) {
         elements = elements.filter(item => item.id !== activeEl.id);
         myIsEditing = true;
      }
      selectedElementId = null;
      propertiesLightboxOpen = null;
      editingElementId = null;
    }
    toolbarDrawerOpen = null;
    pruneEmptyTypingLayers();
  };

  const onCanvasDoubleClick = (e: MouseEvent) => {
    // Only if clicking on canvas bg directly
    if (e.target === canvasEl) {
      pruneEmptyTypingLayers();
      const rect = canvasEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const snappedX = Math.round(x / SNAP_GRID) * SNAP_GRID;
      const snappedY = Math.round(y / SNAP_GRID) * SNAP_GRID;
      
      const newEl = {
        id: 'typing_' + Date.now(),
        type: 'typing_layer',
        content: '',
        x: snappedX,
        y: snappedY,
        width: 120,
        height: 40,
        rotation: 0,
        authorId: currentUserId,
        createdBy: currentUserName
      };
      elements.push(newEl);
      elements = [...elements];
      selectedElementId = newEl.id;
      editingElementId = newEl.id;
    }
  };

  const toggleDrawer = (drawer: 'equation' | 'shapes' | 'graph' | 'more' | 'library') => {
    if (toolbarDrawerOpen === drawer) toolbarDrawerOpen = null;
    else toolbarDrawerOpen = drawer;
  };

  const startDraggingScale = (e: PointerEvent, corner: string) => {
    myIsEditing = true;
    e.stopPropagation();
    const el = elements.find(el => el.id === selectedElementId);
    if (el) {
      transformMode = 'scale';
      transformHandle = corner;
      dragStart = { x: e.clientX, y: e.clientY };
      originalSize = { width: el.width, height: el.height };
      originalPos = { x: el.x, y: el.y }; 
    }
  };

  const startRotating = (e: PointerEvent) => {
    myIsEditing = true;
    e.stopPropagation();
    const el = elements.find(el => el.id === selectedElementId);
    if (el) {
      transformMode = 'rotate';
      const rect = canvasEl?.getBoundingClientRect() || { left: 0, top: 0 };
      const centerX = rect.left + el.x + el.width / 2;
      const centerY = rect.top + el.y + el.height / 2;
      originalPos = { x: centerX, y: centerY }; 
      originalRot = el.rotation || 0;
      const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
      transformHandle = String(startAngle);
    }
  };

  const addEquation = (val: string) => {
    myIsEditing = true;
    if (editingElementId) {
      const el = elements.find(e => e.id === editingElementId);
      if (el) {
         el.content += val;
         elements = [...elements];
         return;
      }
    }

    const newEl = {
      id: 'eq_' + Date.now(),
      type: 'text',
      content: val,
      x: window.innerWidth / 2 - 50,
      y: window.innerHeight / 3,
      width: 100,
      height: 40,
      rotation: 0,
      authorId: currentUserId,
      createdBy: currentUserName
    };
    elements.push(newEl);
    elements = [...elements];
    selectedElementId = newEl.id;
    editingElementId = newEl.id;
  };

  const addShape = (shape: string) => {
    myIsEditing = true;
    const newEl = {
      id: 'sh_' + Date.now(),
      type: shape.toLowerCase(),
      x: window.innerWidth / 2 - 50,
      y: window.innerHeight / 3,
      width: shape === 'Circle' ? 80 : 100,
      height: shape === 'Circle' ? 80 : 100,
      rotation: 0,
      authorId: currentUserId,
      createdBy: currentUserName
    };
    elements.push(newEl);
    elements = [...elements];
    selectedElementId = newEl.id;
  };

  const handleSend = () => {
    myIsEditing = false;
    
    // Prune empty typing layer blocks
    elements = elements.filter(el => el.type !== 'typing_layer' || (el.content && el.content.trim() !== ''));
    
    // Generate randomized curve properties for the sending paper plane animation
    const theta = Math.random() * 2 * Math.PI; // completely random direction
    const distance = 80; // cover a distance of about 80 pixels
    const halfX = (distance / 2) * Math.cos(theta);
    const halfY = (distance / 2) * Math.sin(theta);
    
    // Offset midpoint perpendicularly to create a beautiful curve
    const perpDir = Math.random() < 0.5 ? 1 : -1;
    const offsetMagnitude = 15 + Math.random() * 15; // 15 to 30px offset
    const perpAngle = theta + (Math.PI / 2) * perpDir;
    
    planeMidX = halfX + offsetMagnitude * Math.cos(perpAngle);
    planeMidY = halfY + offsetMagnitude * Math.sin(perpAngle);
    planeEndX = distance * Math.cos(theta);
    planeEndY = distance * Math.sin(theta);
    
    // Convert radians to degrees for rotation alignment + add some random rotation spin
    const targetDeg = theta * (180 / Math.PI);
    planeMidRot = targetDeg + (Math.random() * 30 - 15);
    planeEndRot = targetDeg + (Math.random() * 60 - 30);

    showSentMessage = true;
    setTimeout(() => { showSentMessage = false; }, 600);
    
    if (onsendcanvas) {
      const thumbnailData = generateThumbnail(elements);
      onsendcanvas(elements, thumbnailData);
    } else {
      let combinedFormula = elements.filter(e => e.type === 'equation').map(e => e.content).join(' ');
      if (!combinedFormula) combinedFormula = 'Math Diagram';
      onsend(combinedFormula, null);
    }
  };

  let isRecording = $state(false);
  let recordingDuration = $state(0);
  let recordingWaveform: number[] = $state([]);
  let mediaRecorder: MediaRecorder | null = null;
  let recordingInterval: any;
  let audioChunks: Blob[] = [];
  let audioContext: any = null;
  let analyser: AnalyserNode | null = null;

  const handleImageUpload = async (e: Event) => {
    if (!currentSessionId) return;
    const input = e.target as HTMLInputElement;
    if (!input.files?.length) return;
    
    const file = input.files[0];
    try {
      const { mediaService } = await import('../services/mediaService');
      const fileId = await mediaService.uploadFile(file, `image_${Date.now()}_${file.name}`);
      if (!fileId) throw new Error('Image upload failed');
      
      const fileUrl = mediaService.getFileView(fileId);
      const attachment = {
        type: 'image',
        fileId: fileId,
        url: fileUrl,
        name: file.name
      };
      
      const { error } = await supabase
        .from('live_canvas_messages')
        .insert([{
           document_id: currentSessionId,
           sender_id: currentUserId || 'anonymous',
           sender_name: currentUserName || 'You',
           text_content: '📷 Sent an image',
           message_type: 'image',
           attachments: [attachment]
        }]);
        
      if (error) console.error('Failed to send image message:', error);
    } catch (err) {
      console.error('Image upload error:', err);
    }
  };

  async function startRecording() {
    try {
      if (isRecording) {
         stopRecording();
         return;
      }
      try {
        const { audioPlaybackService } = await import('../services/audioPlaybackService.svelte');
        audioPlaybackService.pause();
      } catch (err) {
        console.warn('Could not pause audio playback on start recording:', err);
      }
      isRecording = true;
      recordingDuration = 0;
      recordingWaveform = [];
      audioChunks = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/aac')) {
        mimeType = 'audio/aac';
      }

      mediaRecorder = new MediaRecorder(stream, { mimeType });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        
        if (audioChunks.length === 0) return;

        const audioBlob = new Blob(audioChunks, { type: mimeType });
        if (audioBlob.size < 100) return;
        
        const optmMsgId = generateUUID();
        const localUrl = URL.createObjectURL(audioBlob);

        const tempAttachment = {
           type: 'audio',
           url: localUrl,
           duration: recordingDuration,
           waveform: recordingWaveform,
        };

        const newMsg = {
           id: optmMsgId,
           senderId: currentUserId || 'anonymous',
           senderName: currentUserName || 'You',
           text: '🎤 Sent a voice message',
           message_type: 'audio',
           attachments: [tempAttachment],
           timestamp: new Date()
        };
        
        liveMessages = [...liveMessages, newMsg];
        scrollToBottom();

        try {
          // Immediately cache it locally for local playback so it perfectly plays while uploading
          const { audioPlaybackService } = await import('../services/audioPlaybackService.svelte');
          await audioPlaybackService.cacheLocalBlob(optmMsgId, audioBlob);
          
          const { mediaService } = await import('../services/mediaService');
          const fileId = await mediaService.uploadFile(audioBlob, `voice_message_${Date.now()}.opus`);
          if (!fileId) throw new Error('Voice note upload failed');

          const audioUrl = mediaService.getFileView(fileId);
          
          const audioAttachment = {
            type: 'audio',
            fileId: fileId,
            url: audioUrl,
            duration: recordingDuration,
            waveform: recordingWaveform,
            name: 'voice_message.opus',
            size: audioBlob.size,
          };

          const { error, data } = await supabase
            .from('live_canvas_messages')
            .insert([{
               id: optmMsgId,
               document_id: currentSessionId,
               sender_id: currentUserId || 'anonymous',
               sender_name: currentUserName || 'You',
               text_content: '🎤 Sent a voice message',
               message_type: 'audio',
               attachments: [audioAttachment]
            }]).select();
            
          if (error) {
             console.error('Failed to send voice message:', error);
             liveMessages = liveMessages.filter(m => m.id !== optmMsgId);
          }
        } catch (uploadErr) {
          console.error('Failed to send voice message:', uploadErr);
          liveMessages = liveMessages.filter(m => m.id !== optmMsgId);
        }
      };

      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioContext = new AudioCtx();
        const src = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        src.connect(analyser);

        recordingInterval = setInterval(() => {
          recordingDuration += 0.25;
          analyser?.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          const normalized = Math.min(100, Math.floor((average / 255) * 100));
          recordingWaveform = [...recordingWaveform, normalized];
        }, 250);
      } catch (e) {
         console.error('Analyser failed', e);
         recordingInterval = setInterval(() => {
            recordingDuration += 0.25;
         }, 250);
      }

      mediaRecorder.start(250);
    } catch (err: any) {
      isRecording = false;
      console.error('Recording initialization failed:', err);
    }
  }

  function stopRecording() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      isRecording = false;
      if (recordingInterval) clearInterval(recordingInterval);
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
      }
    }
  }

  const handleTextSend = async () => {
     if (!chatText.trim() || !currentSessionId) return;
     const text = chatText.trim();
     chatText = '';
     
     const optmMsgId = generateUUID();
     const newMsg = {
        id: optmMsgId,
        text,
        senderId: currentUserId || 'anonymous',
        senderName: currentUserName || 'You',
        timestamp: new Date()
     };
     liveMessages = [...liveMessages, newMsg];
     scrollToBottom();
     
     try {
        const { error } = await supabase
           .from('live_canvas_messages')
           .insert([{
              id: optmMsgId,
              document_id: currentSessionId,
              sender_id: currentUserId || 'anonymous',
              sender_name: currentUserName || 'You',
              text_content: text
           }]);

        if (error) {
           console.error('Failed to insert live message to database:', error);
           liveMessages = liveMessages.filter(m => m.id !== optmMsgId);
        }
     } catch (err) {
        console.error('Error inserting live message:', err);
        liveMessages = liveMessages.filter(m => m.id !== optmMsgId);
     }
  };

  const onSendTap = (e: MouseEvent) => {
    e.stopPropagation();
    handleSend();
  };

</script>

{#if isOpen}
<div class="fixed inset-0 z-[150] font-sans select-none overflow-hidden touch-none" style="background-image: linear-gradient(90deg, transparent 44px, rgba(254, 188, 167, 0.5) 44px, rgba(254, 188, 167, 0.5) 45px, transparent 45px), repeating-linear-gradient(transparent 0px, transparent calc(var(--chat-line-height, 1.75rem) - 1px), rgba(226, 232, 240, 0.5) calc(var(--chat-line-height, 1.75rem) - 1px), rgba(226, 232, 240, 0.5) var(--chat-line-height, 1.75rem)); background-color: var(--color-theme-card); background-size: 100% var(--chat-line-height, 1.75rem); background-attachment: local;">
  
  <!-- Floating Header Overlay -->
  <div class="absolute top-4 left-4 right-5 flex items-center justify-between z-50 pointer-events-none">
    <div class="pointer-events-auto">
      <button onclick={() => isOpen=false} class="p-2 text-slate-700 hover:text-slate-900 hover:bg-slate-200/50 rounded-full cursor-pointer transition-all border-none bg-transparent">
        <X size={28} strokeWidth={2.5} />
      </button>
    </div>
    
    <div class="flex flex-col items-center justify-center pointer-events-auto">
       {#if initialDoc && initialDoc.versionAuthorNames && initialDoc.currentVersionIndex !== undefined && initialDoc.versionAuthorNames[initialDoc.currentVersionIndex]}
          <span class="text-[10px] md:text-xs text-slate-500 font-bold tracking-widest uppercase mb-1 select-none">
             Edited by {initialDoc.versionAuthorNames[initialDoc.currentVersionIndex]}
          </span>
       {/if}
       {#if initialDoc && initialDoc.versionChainIds}
          <div class="flex items-center gap-2 px-3 py-1 bg-transparent">
             <button onclick={(e) => { e.stopPropagation(); if (initialDoc!.currentVersionIndex! > 0) loadVersion(initialDoc!.currentVersionIndex! - 1); }} 
                     disabled={!initialDoc.currentVersionIndex || isNavigating}
                     class="p-0.5 text-slate-400 hover:text-orange-500 disabled:opacity-20 border-none bg-transparent cursor-pointer transition-colors">
                <ChevronLeft size={18} strokeWidth={2.5} />
              </button>
              
              <div class="flex gap-1.5 items-center mx-1">
                 {#if initialDoc.versionChainIds.length <= 3}
                    {#each initialDoc.versionChainIds as _, i}
                       <div class="w-1.5 h-1.5 rounded-full {i === (initialDoc.currentVersionIndex || 0) ? 'bg-orange-500' : 'bg-slate-300'} transition-colors"></div>
                    {/each}
                 {:else}
                    <div class="w-1.5 h-1.5 rounded-full {initialDoc.currentVersionIndex === 0 ? 'bg-orange-500' : 'bg-slate-300'} transition-colors"></div>
                    <div class="w-1.5 h-1.5 rounded-full {initialDoc.currentVersionIndex! > 0 && initialDoc.currentVersionIndex! < initialDoc.versionChainIds.length - 1 ? 'bg-orange-500' : 'bg-slate-300'} transition-colors"></div>
                    <div class="w-1.5 h-1.5 rounded-full {initialDoc.currentVersionIndex === initialDoc.versionChainIds.length - 1 ? 'bg-orange-500' : 'bg-slate-300'} transition-colors"></div>
                 {/if}
              </div>
              
              <button onclick={(e) => { e.stopPropagation(); if (initialDoc!.currentVersionIndex! < initialDoc.versionChainIds!.length - 1) loadVersion(initialDoc!.currentVersionIndex! + 1); }} 
                      disabled={initialDoc.currentVersionIndex === initialDoc.versionChainIds.length - 1 || isNavigating}
                      class="p-0.5 disabled:opacity-20 border-none bg-transparent cursor-pointer transition-colors {(initialDoc.currentVersionIndex || 0) < initialDoc.versionChainIds.length - 1 ? 'text-slate-400 hover:text-orange-500' : 'text-slate-400 hover:text-orange-500'}">
                 <ChevronRight size={18} strokeWidth={2.5} />
              </button>
          </div>
       {/if}
    </div>

    <div class="flex items-center pointer-events-auto relative">
       <button class="p-2 border-none bg-transparent cursor-pointer group">
         <Users size={28} strokeWidth={2.5} class="text-slate-600 group-hover:text-slate-800 transition-colors" />
         <div class="absolute top-1 right-0 bg-[#ff6b00]/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border-2 border-[var(--color-theme-card)] shadow-sm transform translate-x-1/2 -translate-y-1/2">
             {activePresences.length + 1}
          </div>
        </button>
     </div>
  </div>

  <!-- Right Floating Toolbar (Tools) -->
  <div class="absolute top-[80px] right-4 bg-theme-card rounded-3xl shadow-[0_6px_32px_rgba(0,0,0,0.12)] border border-gray-100 flex flex-col items-center py-2 px-1.5 gap-2.5 z-40 w-[52px] pointer-events-auto transition-all duration-[600ms] ease-[cubic-bezier(0.34,1.56,0.64,1.15)]"
       style="transform: translateX({showToolbar ? '0' : '82px'}); opacity: {showToolbar ? '1' : '0'}; pointer-events: {showToolbar ? 'auto' : 'none'};">
    <button onclick={(e) => { e.stopPropagation(); activeTool = 'pointer'; myIsEditing=false; toolbarDrawerOpen=null; }} 
            style="transition: all 400ms cubic-bezier(0.34, 1.56, 0.64, 1.15); transition-delay: {showToolbar ? '957ms' : '0ms'}; transform: scale({showToolbar ? 1 : 0}); opacity: {showToolbar ? 1 : 0};"
            class="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors border-none {activeTool === 'pointer' ? 'bg-[#ffeee5] text-[#ff6b00]' : 'bg-transparent hover:bg-gray-50 text-slate-700'}">
       <MousePointer2 size={18} strokeWidth={2.5} class="transform -translate-x-0.5 translate-y-0.5" />
    </button>
    <button onclick={(e) => { e.stopPropagation(); activeTool = 'pen'; myIsEditing=true; toggleDrawer('shapes'); }} 
            style="transition: all 400ms cubic-bezier(0.34, 1.56, 0.64, 1.15); transition-delay: {showToolbar ? '924ms' : '0ms'}; transform: scale({showToolbar ? 1 : 0}); opacity: {showToolbar ? 1 : 0};"
            class="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors border-none {activeTool === 'pen' ? 'bg-[#ffeee5] text-[#ff6b00]' : 'bg-transparent hover:bg-gray-50 text-slate-700'}">
       <Pencil size={18} strokeWidth={2.5} />
    </button>
    <button onclick={(e) => { e.stopPropagation(); activeTool = 'text'; myIsEditing=true; addEquation(''); }} 
            style="transition: all 400ms cubic-bezier(0.34, 1.56, 0.64, 1.15); transition-delay: {showToolbar ? '891ms' : '0ms'}; transform: scale({showToolbar ? 1 : 0}); opacity: {showToolbar ? 1 : 0};"
            class="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors border-none {activeTool === 'text' ? 'bg-[#ffeee5] text-[#ff6b00]' : 'bg-transparent hover:bg-gray-50 text-slate-700'}" title="Text">
       <Type size={18} strokeWidth={2.5} />
    </button>
    <button onclick={(e) => { e.stopPropagation(); activeTool = 'line'; myIsEditing=true; addShape('Line'); }} 
            style="transition: all 400ms cubic-bezier(0.34, 1.56, 0.64, 1.15); transition-delay: {showToolbar ? '858ms' : '0ms'}; transform: scale({showToolbar ? 1 : 0}); opacity: {showToolbar ? 1 : 0};"
            class="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors border-none {activeTool === 'line' ? 'bg-[#ffeee5] text-[#ff6b00]' : 'bg-transparent hover:bg-gray-50 text-slate-700'}">
       <div class="w-5 h-[2px] bg-current transform -rotate-45 rounded-full"></div>
    </button>
    <button onclick={(e) => { e.stopPropagation(); activeTool = 'curve'; myIsEditing=true; addShape('Curve'); }} 
            style="transition: all 400ms cubic-bezier(0.34, 1.56, 0.64, 1.15); transition-delay: {showToolbar ? '825ms' : '0ms'}; transform: scale({showToolbar ? 1 : 0}); opacity: {showToolbar ? 1 : 0};"
            class="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors border-none {activeTool === 'curve' ? 'bg-[#ffeee5] text-[#ff6b00]' : 'bg-transparent hover:bg-gray-50 text-slate-700'}" title="Curve">
       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12c4-8 8-8 16 0"/></svg>
    </button>
    <button onclick={(e) => { e.stopPropagation(); activeTool = 'circle'; myIsEditing=true; addShape('Circle'); }} 
            style="transition: all 400ms cubic-bezier(0.34, 1.56, 0.64, 1.15); transition-delay: {showToolbar ? '792ms' : '0ms'}; transform: scale({showToolbar ? 1 : 0}); opacity: {showToolbar ? 1 : 0};"
            class="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors border-none {activeTool === 'circle' ? 'bg-[#ffeee5] text-[#ff6b00]' : 'bg-transparent hover:bg-gray-50 text-slate-700'}">
       <Circle size={18} strokeWidth={2.5} />
    </button>
    <button onclick={(e) => { e.stopPropagation(); activeTool = 'library'; toggleDrawer('library'); }} 
            style="transition: all 400ms cubic-bezier(0.34, 1.56, 0.64, 1.15); transition-delay: {showToolbar ? '759ms' : '0ms'}; transform: scale({showToolbar ? 1 : 0}); opacity: {showToolbar ? 1 : 0};"
            class="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors border-none {activeTool === 'library' || toolbarDrawerOpen === 'library' ? 'bg-[#ffeee5] text-[#ff6b00]' : 'bg-transparent hover:bg-gray-50 text-slate-700'}">
       <BookOpen size={18} strokeWidth={2.5} />
    </button>
    <button onclick={(e) => { e.stopPropagation(); activeTool = 'star'; myIsEditing=true; }} 
            style="transition: all 400ms cubic-bezier(0.34, 1.56, 0.64, 1.15); transition-delay: {showToolbar ? '726ms' : '0ms'}; transform: scale({showToolbar ? 1 : 0}); opacity: {showToolbar ? 1 : 0};"
            class="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors border-none {activeTool === 'star' ? 'bg-[#ffeee5] text-[#ff6b00]' : 'bg-transparent hover:bg-gray-50 text-slate-700'}">
       <Star size={18} strokeWidth={2.5} />
    </button>
    <button onclick={(e) => { e.stopPropagation(); activeTool = 'settings'; toggleDrawer('more'); }} 
            style="transition: all 400ms cubic-bezier(0.34, 1.56, 0.64, 1.15); transition-delay: {showToolbar ? '693ms' : '0ms'}; transform: scale({showToolbar ? 1 : 0}); opacity: {showToolbar ? 1 : 0};"
            class="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors border-none {activeTool === 'settings' || toolbarDrawerOpen === 'more' ? 'bg-[#ffeee5] text-[#ff6b00]' : 'bg-transparent hover:bg-gray-50 text-slate-700'}">
       <SlidersHorizontal size={18} strokeWidth={2.5} />
    </button>
    <button onclick={(e) => { e.stopPropagation(); activeTool = 'equation'; toggleDrawer('equation'); }} 
            style="transition: all 400ms cubic-bezier(0.34, 1.56, 0.64, 1.15); transition-delay: {showToolbar ? '660ms' : '0ms'}; transform: scale({showToolbar ? 1 : 0}); opacity: {showToolbar ? 1 : 0};"
            class="w-9 h-9 rounded-[14px] flex items-center justify-center cursor-pointer transition-colors border-none mx-auto mt-2 {activeTool === 'equation' || toolbarDrawerOpen === 'equation' ? 'bg-transparent text-[#ff6b00] border-2 border-[#ff6b00]' : 'bg-transparent hover:bg-gray-50 text-[#ff6b00] border-2 border-[#ff6b00]'}" title="Equation">
       <Sigma size={18} strokeWidth={2.5} />
    </button>
  </div>
  
  <!-- Canvas Area -->
  <div class="absolute inset-0 z-0 overflow-hidden"
       bind:this={canvasEl}
       onpointermove={onCanvasPointerMove}
       onpointerup={onCanvasPointerUp}
       ontouchstart={onCanvasTouchStart}
       ontouchend={onCanvasTouchEnd}
       onclick={onCanvasClick}
       ondblclick={onCanvasDoubleClick}>
       
     <!-- Remote Cursors -->
     {#each activePresences.filter(p => p.userId !== currentUserId) as presence}
        <div class="absolute inset-0 pointer-events-none z-50 transition-opacity duration-300"
             style="transform: translate({presence.cursorX}px, {presence.cursorY}px);">
           <MousePointer2 size={18} fill={presence.color || '#3b82f6'} class="text-white drop-shadow-md relative -left-1.5 -top-1.5" />
           <div class="absolute top-4 left-3 px-2 py-0.5 rounded shadow-sm text-[10px] font-bold text-white whitespace-nowrap {presence.isChalkHolder ? 'bg-orange-500' : 'bg-blue-500'}">
              {presence.displayName}
              {#if presence.isChalkHolder}
                <span class="ml-1 text-[8px] uppercase tracking-widest opacity-80">Editing</span>
               {/if}
            </div>
         </div>
      {/each}

      <!-- Start Hint -->
     {#if elements.length === 0}
        <div class="absolute inset-0 flex flex-col items-center justify-center opacity-60 pointer-events-none">
           <div class="flex gap-4 mb-8">
              <div class="w-12 h-12 rounded-full border-2 border-[#0a1d33]/20 flex items-center justify-center font-serif text-xl italic text-slate-400">√x</div>
              <div class="w-12 h-12 rounded-full border-2 border-[#0a1d33]/20 flex items-center justify-center font-serif text-xl italic text-slate-400">x²</div>
           </div>
           <div class="text-sm font-bold text-slate-700">Double tap to write</div>
           <div class="text-xs text-slate-500 mt-2 max-w-[200px] text-center leading-relaxed font-sans">Use the toolbar to add math elements, equations, diagrams and more.</div>
        </div>
     {/if}
     
     <!-- Elements -->
     {#each elements.filter(el => el.type !== 'typing_layer') as el (el.id)}
        {#if !el.isAnnotation || showAnnotations}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="absolute group touch-none {el.isAnnotation ? 'z-20' : 'z-10'} {selectedElementId === el.id ? '!z-30' : ''} {activeTool === 'eraser' ? 'hover:outline hover:outline-2 hover:outline-red-500/80 hover:bg-red-500/5 hover:-translate-y-0.5 transition-all cursor-pointer' : 'cursor-move'}"
               style="transform: translate({el.x}px, {el.y}px) rotate({el.rotation || 0}deg); width: {el.width}px; height: {el.height}px;"
               onpointerdown={(e) => onElementPointerDown(e, el.id)}
               ondblclick={(e) => { e.stopPropagation(); if(el.type === 'text' || el.type === 'equation') { editingElementId = el.id; } else { propertiesLightboxOpen = el.id; } }}>
            
            <!-- CreatedBy Tag for Annotations/Sticky Notes -->
            {#if el.isAnnotation && el.createdBy}
               <div class="absolute -top-5 left-0 text-[8px] font-bold text-slate-400 bg-black/80 px-1 py-0.5 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  {el.createdBy}
               </div>
            {/if}

            <!-- Content rendering based on type -->
           {#if el.type === 'equation' || el.type === 'text'}
             {#if editingElementId === el.id}
               <!-- svelte-ignore a11y_autofocus -->
               <textarea 
                  bind:value={el.content} 
                  bind:this={activeTextareaRef}
                  inputmode="none" use:virtualKeyboardManual
                  class="w-full h-full bg-transparent border-none outline-none font-handwriting text-5xl caret-current tracking-normal resize-none {getInkClass(el, 'text')}" 
                  autofocus
                  onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                  onmouseup={() => { if(document.getSelection()?.toString().trim().length) propertiesLightboxOpen = el.id; }}
               ></textarea>
             {:else}
               <div class="w-full h-full flex items-center justify-center font-handwriting text-5xl tracking-normal pointer-events-none whitespace-pre-wrap text-center select-none {getInkClass(el, 'text')}" onselectstart={(e) => e.stopPropagation()}>
                 {el.content}
               </div>
             {/if}
           {:else if el.type === 'probability_tree'}
             <div class="w-full h-full border-2 border-dashed rounded-xl flex items-center justify-center text-xs font-bold pointer-events-none relative overflow-hidden {getInkClass(el, 'border')} {getInkClass(el, 'bg')}">
                <div class="absolute w-[2px] h-[50%] rotate-45 top-[10%] left-[30%]" style="background-color: {getInkClass(el, 'stroke')}"></div>
                <div class="absolute w-[2px] h-[50%] -rotate-45 bottom-[10%] left-[30%]" style="background-color: {getInkClass(el, 'stroke')}"></div>
                <div class="z-10 bg-theme-card/85 border px-2 py-0.5 rounded shadow-xs text-[10px] {getInkClass(el, 'text')} {getInkClass(el, 'border')}">Prob. Tree</div>
             </div>
           {:else if el.type === 'venn_diagram'}
             <div class="w-full h-full relative pointer-events-none flex items-center justify-center">
                <div class="absolute w-[60%] h-[60%] border-2 rounded-full left-[10%] {getInkClass(el, 'border')} {getInkClass(el, 'bg')}"></div>
                <div class="absolute w-[60%] h-[60%] border-2 rounded-full right-[10%] {getInkClass(el, 'border')} {getInkClass(el, 'bg')}"></div>
                <span class="text-xs font-bold z-10 {getInkClass(el, 'text')}">Venn</span>
             </div>
           {:else if el.type === 'matrix_grid'}
             <div class="w-full h-full flex items-center justify-center font-mono text-xs pointer-events-none border-l-2 border-r-2 rounded-sm {getInkClass(el, 'border')} {getInkClass(el, 'text')}">
                <div class="grid grid-cols-2 gap-2 text-center p-2">
                   <span>a</span><span>b</span>
                   <span>c</span><span>d</span>
                </div>
             </div>
           {:else if el.type === 'trig_unit_circle'}
             <div class="w-full h-full relative pointer-events-none border rounded-xl flex items-center justify-center overflow-hidden {getInkClass(el, 'border')} {getInkClass(el, 'bg')}">
                <div class="absolute w-full h-[1px]" style="background-color: {getInkClass(el, 'stroke')}40"></div>
                <div class="absolute h-full w-[1px]" style="background-color: {getInkClass(el, 'stroke')}40"></div>
                <div class="absolute w-[80%] h-[80%] border-2 {getInkClass(el, 'border')}"></div>
                <div class="absolute w-[40%] h-[1.5px] origin-left rotate-[-30deg]" style="background-color: {getInkClass(el, 'stroke')}"></div>
             </div>
           {:else if el.type === 'pie_chart'}
             <div class="w-full h-full rounded-full border-2 border-dashed pointer-events-none flex items-center justify-center text-xs font-bold {getInkClass(el, 'border')} {getInkClass(el, 'bg')} {getInkClass(el, 'text')}">Pie Chart</div>
           {:else if el.type === 'table'}
             <div class="w-full h-full border-2 grid grid-cols-2 grid-rows-2 pointer-events-none text-xs text-center {getInkClass(el, 'border')} {getInkClass(el, 'bg')} {getInkClass(el, 'text')}">
                <div class="border-b border-r p-1" style="border-color: {getInkClass(el, 'stroke')}40">A</div>
                <div class="border-b p-1" style="border-color: {getInkClass(el, 'stroke')}40">B</div>
                <div class="border-r p-1" style="border-color: {getInkClass(el, 'stroke')}40">C</div>
                <div class="p-1">D</div>
             </div>
           {:else if el.type === 'curve'}
             <div class="w-full h-full border-b-2 border-l-2 relative pointer-events-none flex items-end {getInkClass(el, 'border')}">
                <div class="w-full h-[150%] border-b-2 border-l-2 rounded-bl-full" style="border-radius: 0 0 0 100%; border-color: {getInkClass(el, 'stroke')}; font-size: 1rem;"></div>
             </div>
           {:else if el.type === 'rectangle'}
             <div class="w-full h-full border-2 pointer-events-none {getInkClass(el, 'border')} {getInkClass(el, 'bg')}"></div>
           {:else if el.type === 'circle'}
             <div class="w-full h-full border-2 pointer-events-none {getInkClass(el, 'border')} {getInkClass(el, 'bg')}" style="border-radius: 50%;"></div>
           {:else}
             <div class="w-full h-full border border-dashed flex items-center justify-center text-xs pointer-events-none {getInkClass(el, 'border')} {getInkClass(el, 'bg')} {getInkClass(el, 'text')}">{el.type}</div>
           {/if}
            
           <!-- Transform Box & Handles -->
           {#if selectedElementId === el.id}
             <!-- Transform box border -->
             <div class="absolute inset-0 border-[1.5px] border-[#ff6b00]/90 border-dashed pointer-events-none z-10"></div>
             
             <!-- Handles -->
             <div class="absolute w-3.5 h-3.5 bg-theme-card border border-[#ff6b00]/90 rounded-full -top-2 -left-2 cursor-nwse-resize z-20 hover:scale-125 transition-transform" onpointerdown={(e) => startDraggingScale(e, 'nw')}></div>
             <div class="absolute w-[14px] h-[14px] bg-theme-card border border-[#ff6b00]/90 rounded-full -top-2 -right-2 cursor-nesw-resize z-20 hover:scale-125 transition-transform" onpointerdown={(e) => startDraggingScale(e, 'ne')}></div>
             <div class="absolute w-[14px] h-[14px] bg-theme-card border border-[#ff6b00]/90 rounded-full -bottom-2 -left-2 cursor-nesw-resize z-20 hover:scale-125 transition-transform" onpointerdown={(e) => startDraggingScale(e, 'sw')}></div>
             <div class="absolute w-[14px] h-[14px] bg-theme-card border border-[#ff6b00]/90 rounded-full -bottom-2 -right-2 cursor-nwse-resize z-20 hover:scale-125 transition-transform" onpointerdown={(e) => startDraggingScale(e, 'se')}></div>
             
             <!-- Rotate handle -->
             <!-- svelte-ignore a11y_click_events_have_key_events -->
             <!-- svelte-ignore a11y_no_static_element_interactions -->
             <div class="absolute w-4 h-4 bg-theme-card border border-[#ff6b00]/90 rounded-full -top-8 left-1/2 -translate-x-1/2 cursor-grab z-20 flex items-center justify-center hover:scale-125 transition-transform active:cursor-grabbing" onpointerdown={startRotating}>
                <div class="w-1.5 h-1.5 rounded-full bg-[#ff6b00]/90"></div>
             </div>
             <!-- Rotate link line -->
             <div class="absolute w-[1.5px] h-5 bg-[#ff6b00]/90 -top-5 left-1/2 pointer-events-none"></div>
           {/if}
        </div>
       {/if}
     {/each}

      <!-- Wordprocessor-style Typing Layer (Sits above other elements) -->
      {#each elements.filter(el => el.type === 'typing_layer') as el (el.id)}
         <!-- svelte-ignore a11y_click_events_have_key_events -->
         <!-- svelte-ignore a11y_no_static_element_interactions -->
         <div class="absolute select-text z-20 pointer-events-auto typing-block-container text-base md:text-lg font-handwriting leading-relaxed {getInkClass(el, 'text')}"
              style="left: {el.x}px; top: {el.y}px;"
              bind:clientWidth={el.width}
              bind:clientHeight={el.height}
              onpointerdown={(e) => e.stopPropagation()}
              onclick={(e) => {
                 if (activeTool === 'eraser') {
                    e.stopPropagation();
                    elements = elements.filter(item => item.id !== el.id);
                    myIsEditing = true;
                    if (selectedElementId === el.id) selectedElementId = null;
                 }
              }}
              ondblclick={(e) => {
                 e.stopPropagation();
                 editingElementId = el.id;
              }}>
              {#if editingElementId === el.id}
                 <!-- svelte-ignore a11y_autofocus -->
                 <span class="typing-block-grow">{el.content || ''}&nbsp;&nbsp;</span>
                 <textarea
                    bind:value={el.content}
                    bind:this={activeTextareaRef}
                    placeholder=""
                    inputmode="none" use:virtualKeyboardManual
                    autofocus
                    class="typing-block-textarea text-base md:text-lg font-handwriting leading-relaxed {getInkClass(el, 'text')}"
                    style=""
                    onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                    onkeypress={(e) => {
                       if (e.key === 'Enter' && e.shiftKey) {
                          // Allow standard Enter behaviors
                       }
                    }}
                    onkeydown={(e) => {
                       if (e.key === 'Escape') {
                          e.preventDefault();
                          (e.target as HTMLTextAreaElement).blur();
                       } else if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          (e.target as HTMLTextAreaElement).blur();
                       }
                    }}
                    onblur={() => {
                       if (!el.content || !el.content.trim()) {
                          elements = elements.filter(item => item.id !== el.id);
                       }
                       editingElementId = null;
                    }}
                 ></textarea>
              {:else}
                 <div class="text-base md:text-2xl font-handwriting select-text whitespace-pre-wrap leading-relaxed cursor-text p-1 hover:bg-slate-200/40 rounded transition-all duration-200 {getInkClass(el, 'text')}"
                      style="font-size: 1.5rem; padding-right: 2ch;">
                    {#if el.content}
                       {el.content}
                    {:else if activeTool !== 'eraser'}
                       <span class="opacity-45 italic text-[13px]">Double tap to edit text</span>
                    {/if}
                 </div>
              {/if}
         </div>
      {/each}

     <!-- Transform Quick Actions floating toolbar -->
     {#if selectedElementId && !propertiesLightboxOpen}
       <div class="absolute bottom-6 left-1/2 -translate-x-1/2 bg-theme-card rounded-full shadow-[0_4px_20px_-4px_rgba(0,0,0,0.15)] border border-gray-100 px-3 py-1.5 flex gap-2 z-30 animate-in slide-in-from-bottom-4 duration-200">
         <button class="p-2 text-gray-600 hover:text-black hover:bg-gray-50 rounded-full border-none bg-transparent cursor-pointer"><Copy size={18} /></button>
         <button class="p-2 text-gray-600 hover:text-black hover:bg-gray-50 rounded-full border-none bg-transparent cursor-pointer"><Lock size={18} /></button>
         <button onclick={(e) => { e.stopPropagation(); elements = elements.filter(el => el.id !== selectedElementId); selectedElementId = null; myIsEditing = true; }} class="p-2 text-gray-600 hover:text-red-500 hover:bg-red-50 rounded-full border-none bg-transparent cursor-pointer"><Trash2 size={18} /></button>
         <div class="w-[1px] h-6 bg-gray-200 my-auto"></div>
         <button class="p-2 text-gray-600 hover:text-black hover:bg-gray-50 rounded-full border-none bg-transparent cursor-pointer"><MoreHorizontal size={18} /></button>
       </div>
     {/if}
  </div>

  <!-- Expanded Tools Drawers -->
  {#if toolbarDrawerOpen === 'equation'}
    <div class="absolute bottom-[90px] left-0 right-0 bg-theme-card shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.1)] rounded-t-3xl flex flex-col z-40 max-h-[60vh] overflow-hidden animate-in slide-in-from-bottom-6 duration-200">
      <div class="flex justify-between items-center p-4 border-b border-gray-50">
         <h3 class="font-bold text-sm text-gray-900 m-0">Equation</h3>
         <button onclick={() => toolbarDrawerOpen = null} class="p-1 -mr-1 text-gray-400 hover:text-gray-600 border-none bg-transparent cursor-pointer"><X size={18}/></button>
      </div>
      <div class="overflow-hidden flex flex-col flex-1">
         <div class="flex overflow-x-auto gap-2 px-4 py-2 border-b border-gray-50 shrink-0 no-scrollbar">
            {#each equationPages as page, i}
               <button onclick={() => currentEqPage = i} class="px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-colors border-none {currentEqPage === i ? 'bg-[#0f172a] text-white' : 'bg-transparent text-gray-500 hover:bg-gray-100'}">
                 {page.title}
               </button>
            {/each}
         </div>
         <div class="overflow-y-auto p-4 flex-1">
            <div class="grid grid-cols-5 gap-3">
               {#each equationPages[currentEqPage].tools as tool}
                 <button onclick={(e) => { e.stopPropagation(); addEquation(tool.val); }} class="h-12 rounded-xl bg-theme-card hover:bg-gray-50 border border-gray-200 flex items-center justify-center font-serif text-lg font-medium text-gray-800 cursor-pointer transition-colors active:scale-95 shadow-sm">
                   {tool.label}
                 </button>
               {/each}
            </div>
         </div>
      </div>
    </div>
  {:else if toolbarDrawerOpen === 'shapes'}
    <div class="absolute bottom-[90px] left-0 right-0 bg-theme-card shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.1)] rounded-t-3xl flex flex-col z-40 max-h-[60vh] overflow-hidden animate-in slide-in-from-bottom-6 duration-200">
      <div class="flex justify-between items-center p-4 border-b border-gray-50">
         <h3 class="font-bold text-sm text-gray-900 m-0">Shapes</h3>
         <button onclick={() => toolbarDrawerOpen = null} class="p-1 -mr-1 text-gray-400 hover:text-gray-600 border-none bg-transparent cursor-pointer"><X size={18}/></button>
      </div>
      <div class="overflow-y-auto p-4 flex-1">
         <div class="grid grid-cols-4 gap-4">
            {#each shapesTools as shape}
              <button onclick={(e) => { e.stopPropagation(); addShape(shape.label); }} class="flex flex-col items-center gap-2 cursor-pointer border-none bg-transparent hover:opacity-75 active:scale-95 transition-all">
                <div class="w-12 h-12 rounded-full border border-gray-200 shadow-sm flex items-center justify-center text-gray-700 bg-theme-card">
                    <div class="font-bold font-sans text-xl">{shape.symbol}</div>
                </div>
                <span class="text-[10px] text-gray-600 font-medium">{shape.label}</span>
              </button>
            {/each}
         </div>
      </div>
    </div>
  {:else if toolbarDrawerOpen === 'more'}
    <div class="absolute bottom-[90px] left-0 right-0 bg-[#f8f9fa] shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.1)] rounded-t-3xl flex flex-col z-40 max-h-[70vh] overflow-hidden animate-in slide-in-from-bottom-6 duration-200 border-t border-gray-100">
       <div class="p-6 overflow-y-auto">
          <div class="flex flex-col gap-3">
             <button class="bg-theme-card p-4 rounded-2xl flex items-center justify-start gap-4 border border-gray-100 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors w-full text-left">
               <div class="text-xl font-serif text-gray-800 w-10 text-center font-bold italic">L<span class="text-sm">A</span>T<span class="text-sm">E</span>X</div>
               <div class="flex flex-col">
                  <span class="text-sm font-bold text-gray-900">LaTeX Support</span>
                  <span class="text-xs text-gray-500">Write in LaTeX syntax</span>
               </div>
             </button>
             <button class="bg-theme-card p-4 rounded-2xl flex items-center justify-start gap-4 border border-gray-100 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors w-full text-left">
               <div class="text-2xl font-serif text-gray-800 w-10 text-center text-[#ff8c00]">≔</div>
               <div class="flex flex-col">
                  <span class="text-sm font-bold text-gray-900">Steps (Show Work)</span>
                  <span class="text-xs text-gray-500">Get step-by-step solutions</span>
               </div>
             </button>
             <button onclick={(e) => { e.stopPropagation(); addShape('table'); }} class="bg-theme-card p-4 rounded-2xl flex items-center justify-start gap-4 border border-gray-100 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors w-full text-left">
               <div class="w-10 flex justify-center text-gray-800"><LineChart size={24} /></div>
               <div class="flex flex-col">
                  <span class="text-sm font-bold text-gray-900">Statistics</span>
                  <span class="text-xs text-gray-500">Mean, median, mode and more</span>
               </div>
             </button>
             <button class="bg-theme-card p-4 rounded-2xl flex items-center justify-start gap-4 border border-gray-100 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors w-full text-left">
               <div class="text-2xl font-mono text-gray-800 w-10 text-center">[A]</div>
               <div class="flex flex-col">
                  <span class="text-sm font-bold text-gray-900">Matrices & Vectors</span>
                  <span class="text-xs text-gray-500">Create and manipulate</span>
               </div>
             </button>
             <button class="bg-theme-card p-4 rounded-2xl flex items-center justify-start gap-4 border border-gray-100 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors w-full text-left">
               <div class="w-10 flex justify-center text-gray-800"><Settings size={24} /></div>
               <div class="flex flex-col">
                  <span class="text-sm font-bold text-gray-900">Settings</span>
                  <span class="text-xs text-gray-500">Canvas, preferences & more</span>
               </div>
             </button>
          </div>
       </div>
    </div>
  {:else if toolbarDrawerOpen === 'library'}
    <div class="absolute bottom-[90px] left-0 right-0 bg-theme-card shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.1)] rounded-t-3xl flex flex-col z-40 max-h-[60vh] overflow-hidden animate-in slide-in-from-bottom-6 duration-200">
      <div class="flex justify-between items-center p-4 border-b border-gray-50">
         <h3 class="font-bold text-sm text-gray-900 m-0">Library</h3>
         <button onclick={() => toolbarDrawerOpen = null} class="p-1 -mr-1 text-gray-400 hover:text-gray-600 border-none bg-transparent cursor-pointer"><X size={18}/></button>
      </div>
      <div class="overflow-y-auto p-5 flex-1">
         <div class="flex flex-col gap-6">
             <div>
                <h4 class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">My Elements</h4>
                <div class="grid grid-cols-2 gap-3">
                   <div class="bg-gray-50 border border-gray-200 p-3 rounded-xl text-center text-xs text-gray-500 font-bold cursor-pointer hover:bg-gray-100">+ Save Current</div>
                   <div class="bg-theme-card border border-indigo-200 p-3 rounded-xl text-center text-sm font-serif text-indigo-900 shadow-sm cursor-pointer hover:bg-indigo-50">x² + y² = r²</div>
                </div>
             </div>
             <div>
                <h4 class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Community</h4>
                <div class="grid grid-cols-2 gap-3">
                   <div class="bg-theme-card border border-gray-200 p-3 rounded-xl text-center text-sm font-serif text-gray-800 shadow-sm cursor-pointer hover:bg-gray-50">E = mc²</div>
                   <div class="bg-theme-card border border-gray-200 p-3 rounded-xl text-center text-sm font-serif text-gray-800 shadow-sm cursor-pointer hover:bg-gray-50">A = πr²</div>
                </div>
             </div>
             <div>
                <h4 class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Factory Presets</h4>
                <div class="grid grid-cols-2 gap-3">
                   <button onclick={(e) => { e.stopPropagation(); addShape('Probability_Tree'); }} class="bg-theme-card border border-gray-200 p-3 rounded-xl flex items-center justify-center min-h-[60px] shadow-sm cursor-pointer hover:bg-gray-50 transition-colors">
                       <span class="text-sm font-bold text-gray-500">Probability Tree</span>
                   </button>
                   <button onclick={(e) => { e.stopPropagation(); addShape('Matrix_Grid'); }} class="bg-theme-card border border-gray-200 p-3 rounded-xl flex items-center justify-center min-h-[60px] shadow-sm cursor-pointer hover:bg-gray-50 transition-colors">
                       <span class="text-sm font-bold text-gray-500">2x2 Matrix</span>
                   </button>
                   <button onclick={(e) => { e.stopPropagation(); addShape('Venn_Diagram'); }} class="bg-theme-card border border-gray-200 p-3 rounded-xl flex items-center justify-center min-h-[60px] shadow-sm cursor-pointer hover:bg-gray-50 transition-colors">
                       <span class="text-sm font-bold text-gray-500">Venn Diagram</span>
                   </button>
                   <button onclick={(e) => { e.stopPropagation(); addShape('Trig_Unit_Circle'); }} class="bg-theme-card border border-gray-200 p-3 rounded-xl flex items-center justify-center min-h-[60px] shadow-sm cursor-pointer hover:bg-gray-50 transition-colors">
                       <span class="text-sm font-bold text-gray-500">Unit Circle</span>
                   </button>
                </div>
             </div>
         </div>
      </div>
    </div>
  {/if}

  <!-- Tool Properties Lightbox -->
  {#if propertiesLightboxOpen}
    <!-- Backdrop -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="absolute inset-0 bg-black/40 z-40 transition-opacity" onclick={(e) => { e.stopPropagation(); propertiesLightboxOpen = null; }}></div>
    
    <div class="absolute bottom-0 left-0 right-0 bg-theme-card rounded-t-3xl flex flex-col z-50 max-h-[80vh] animate-in slide-in-from-bottom-full duration-300">
      <div class="flex justify-between items-center p-5 pb-3 border-b border-gray-50">
         <h3 class="font-bold text-[15px] text-gray-900 m-0">Properties</h3>
         <button onclick={() => propertiesLightboxOpen = null} class="p-1 -mr-2 text-gray-400 hover:text-gray-600 border-none bg-transparent cursor-pointer bg-gray-50 rounded-full"><X size={18}/></button>
      </div>
      
      <div class="p-5 overflow-y-auto space-y-6">
         <!-- Example Table Properties UI from the image -->
         <div>
            <div class="flex items-center justify-between mb-4">
               <span class="text-sm font-semibold text-gray-700">Rows</span>
               <div class="flex items-center gap-4 bg-gray-50 rounded-full px-2 py-1">
                  <button class="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-800 pointer">-</button>
                  <span class="text-sm font-bold w-4 text-center">2</span>
                  <button class="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-800 pointer">+</button>
               </div>
            </div>
            <div class="flex items-center justify-between mb-4">
               <span class="text-sm font-semibold text-gray-700">Columns</span>
               <div class="flex items-center gap-4 bg-gray-50 rounded-full px-2 py-1">
                  <button class="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-800 pointer">-</button>
                  <span class="text-sm font-bold w-4 text-center">6</span>
                  <button class="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-800 pointer">+</button>
               </div>
            </div>
            
            <div class="flex items-center justify-between mb-4">
               <span class="text-sm font-semibold text-gray-700">Header Row</span>
               <div class="w-10 h-6 bg-indigo-600 rounded-full relative cursor-pointer"><div class="absolute right-1 top-1 bg-theme-card w-4 h-4 rounded-full shadow-sm"></div></div>
            </div>
            
            <div class="mb-4">
               <span class="text-sm font-semibold text-gray-700 block mb-3">Border Style</span>
               <div class="flex gap-2">
                  <button class="flex-1 py-3 border border-indigo-600 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-bold text-sm cursor-pointer"><Square size={18}/></button>
                  <button class="flex-1 py-3 border border-gray-200 bg-theme-card rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-50 cursor-pointer font-bold text-sm">—</button>
                  <button class="flex-1 py-3 border border-gray-200 bg-theme-card rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-50 cursor-pointer font-bold text-sm">▯</button>
                  <button class="flex-1 py-3 border border-gray-200 bg-theme-card rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-50 cursor-pointer font-bold text-sm">⊞</button>
               </div>
            </div>
         </div>
      </div>
    </div>
  {/if}

  {#if editingElementId}
    {@const editingIdx = elements.findIndex(e => e.id === editingElementId)}
    {#if editingIdx !== -1}
      <div class="absolute bottom-0 left-0 right-0 bg-theme-card border-t border-gray-100 z-50 shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.15)] animate-in slide-in-from-bottom duration-200"
           onpointerdown={(e) => e.stopPropagation()}
           onclick={(e) => e.stopPropagation()}>
         <MathKeyboard 
           bind:value={elements[editingIdx].content}
           textareaRef={activeTextareaRef} 
           isOpen={true}
           onsend={() => activeTextareaRef?.blur()} />
      </div>
    {/if}
  {:else}
  {#if showLiveChat}
  <!-- Full-screen backdrop masking canvas and drawing operations below -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="absolute inset-0 bg-slate-900/10 backdrop-blur-[2px] z-[60] pointer-events-auto transition-all animate-in fade-in duration-200" onclick={() => { showLiveChat = false; liveChatKeyboardOpen = false; }} ondblclick={(e) => e.stopPropagation()}></div>

  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="absolute bottom-0 left-0 right-0 bg-theme-card rounded-t-[32px] shadow-[0_-12px_45px_rgba(0,0,0,0.15)] border-t border-gray-100 z-[70] pointer-events-auto flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 duration-200 transition-all duration-300 {liveChatKeyboardOpen ? 'h-[85vh] sm:h-[680px]' : 'h-[50vh] sm:h-[420px]'}" ondblclick={(e) => e.stopPropagation()}>
     <!-- Chat Header -->
     <div onclick={() => liveChatKeyboardOpen = false} class="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50/50 cursor-pointer">
        <div class="flex items-center gap-2">
           <MessageSquareQuote size={18} class="text-indigo-600" />
           <h3 class="font-bold text-sm text-gray-800 m-0">Live Conversation</h3>
        </div>
        <button onclick={() => { showLiveChat = false; liveChatKeyboardOpen = false; }} class="p-1 -mr-1 text-gray-400 hover:text-gray-600 border-none bg-transparent cursor-pointer transition-colors"><X size={18}/></button>
     </div>
     
     <!-- Chat Messages -->
     <div bind:this={liveMessagesContainerRef} onclick={() => liveChatKeyboardOpen = false} class="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-[100px] scrollbar-thin">
        {#if liveMessages.length === 0}
           <div class="flex flex-col items-center justify-center h-full text-gray-400 gap-2 opacity-50">
              <MessageSquareQuote size={32} />
              <p class="text-[11px] font-bold uppercase tracking-widest text-center m-0">No messages yet<br/>Type a message below to chat</p>
           </div>
        {:else}
           {#each liveMessages as msg (msg.id)}
              <div class="flex flex-col {msg.senderId === currentUserId ? 'items-end' : 'items-start'}">
                 <div class="flex items-end gap-1.5 max-w-[85%] {msg.senderId === currentUserId ? 'flex-row-reverse' : ''}">
                    <!-- Avatar placeholder -->
                    <div class="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-[10px] text-white font-bold shadow-sm">
                       {msg.senderName.charAt(0).toUpperCase()}
                    </div>
                    <div class="flex flex-col {msg.senderId === currentUserId ? 'items-end' : 'items-start'}">
                       <span class="text-[9px] font-bold text-gray-400 mb-0.5 ml-1">{msg.senderName}</span>
                       <div class="px-3 py-2 rounded-2xl {msg.senderId === currentUserId ? 'bg-[#ff6b00] text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'} shadow-sm text-[13px] leading-relaxed w-full">
                          {#if msg.message_type === 'image' && msg.attachments?.[0]?.url}
                             <img src={msg.attachments[0].url} alt="file" class="max-w-[180px] w-full h-auto rounded-none object-cover border-0 shadow-none" style="border-radius: 0;" />
                          {:else if msg.message_type === 'audio' && msg.attachments?.[0]?.url}
                             <AudioMessagePlayer 
                               messageId={msg.id} 
                               url={msg.attachments[0].url} 
                               duration={msg.attachments[0].duration || 0} 
                               waveform={msg.attachments[0].waveform || []} 
                               isMe={msg.senderId === currentUserId}
                               status={msg.status}
                             />
                          {:else}
                             {msg.text}
                          {/if}
                       </div>
                    </div>
                 </div>
              </div>
           {/each}
        {/if}
     </div>

     <!-- Contained Chat Input Area -->
     <div onclick={(e) => e.stopPropagation()} class="px-4 py-3 border-t border-gray-100 bg-gray-50 flex flex-col shrink-0">
        <div class="flex items-center gap-2">
           <!-- Mic Icon Button -->
           <button onclick={startRecording} class="w-[38px] h-[38px] rounded-full bg-theme-card border border-gray-100 {isRecording ? 'text-red-500 animate-pulse' : 'text-slate-500 hover:text-indigo-600'} flex items-center justify-center cursor-pointer hover:bg-indigo-50 transition-all flex-shrink-0 shadow-sm hover:scale-105 active:scale-95" title="Voice Message">
              {#if isRecording}
                 <Square fill="currentColor" size={14} />
              {:else}
                 <Mic size={18} strokeWidth={2.2} />
              {/if}
           </button>

           <!-- Image Icon Button -->
           <button onclick={() => document.getElementById('live-chat-image-input')?.click()} class="w-[38px] h-[38px] rounded-full bg-theme-card border border-gray-100 text-slate-500 hover:text-indigo-600 flex items-center justify-center cursor-pointer hover:bg-indigo-50 transition-all flex-shrink-0 shadow-sm hover:scale-105 active:scale-95" title="Upload Image">
              <ImageIcon size={18} strokeWidth={2.2} />
           </button>
           <input type="file" accept="image/*" id="live-chat-image-input" class="hidden" onchange={handleImageUpload} />

           <!-- Text Area using inputmode="none" for customized virtual keyboard -->
           <textarea 
              bind:this={chatTextareaRef}
              bind:value={chatText} 
              inputmode="none" use:virtualKeyboardManual
              onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); liveChatKeyboardOpen = true; }}
              onfocus={() => liveChatKeyboardOpen = true}
              onclick={(e) => { e.stopPropagation(); liveChatKeyboardOpen = true; }}
              placeholder="Type a message..." 
              onkeydown={(e) => { 
                 if (e.key === 'Enter' && !e.shiftKey) { 
                    e.preventDefault(); 
                    handleTextSend(); 
                 } 
              }} 
              class="flex-1 bg-theme-card border border-gray-200 rounded-2xl px-4 py-2 text-[14px] placeholder-gray-400 text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 max-h-[80px] min-h-[38px] resize-none leading-normal shadow-inner" 
              rows={1}
           ></textarea>

           <!-- Msg Send Button -->
           <button 
              onclick={handleTextSend} 
              class="w-[38px] h-[38px] rounded-full bg-indigo-600 text-white flex items-center justify-center border-none cursor-pointer hover:bg-indigo-700 transition-all flex-shrink-0 shadow-sm hover:scale-105 active:scale-95"
              title="Send Message"
           >
              <Send size={15} strokeWidth={2.5} />
           </button>
        </div>
     </div>

     <!-- Custom Embedded Keyboard Slot -->
     {#if liveChatKeyboardOpen}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div onclick={(e) => e.stopPropagation()} class="border-t border-gray-200 shrink-0 bg-[#f2f4f6] pb-4" style="touch-action: none;">
           <MathKeyboard 
              bind:value={chatText}
              textareaRef={chatTextareaRef} 
              isOpen={true}
              onsend={handleTextSend} />
        </div>
     {/if}
  </div>
  {/if}

  <!-- Floating Bottom Controls -->
  <div class="absolute bottom-6 left-5 right-5 flex flex-col gap-3 z-40 pointer-events-none items-center">
    
    <!-- Chat Actions Row -->
    <div class="flex items-center justify-center gap-3 pointer-events-auto" ondblclick={(e) => e.stopPropagation()}>
       <div class="bg-theme-card/95 backdrop-blur-md rounded-full px-2.5 md:px-4 h-[48px] md:h-[56px] shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-100 flex items-center gap-1.5 md:gap-3">
          
          <!-- Erase Icon inside capsule -->
          <button 
             onclick={(e) => { 
                e.stopPropagation(); 
                activeTool = activeTool === 'eraser' ? 'pointer' : 'eraser'; 
             }}
             ondblclick={(e) => {
                e.stopPropagation();
                elements = [];
                selectedElementId = null;
                myIsEditing = true;
             }}
             class="w-[34px] h-[34px] md:w-[40px] md:h-[40px] rounded-full transition-colors flex items-center justify-center border-none cursor-pointer {activeTool === 'eraser' ? 'bg-red-50 text-red-600 font-bold' : 'bg-transparent text-slate-500 hover:bg-slate-50'}"
             title="Tap to Erase Element, Double Tap to Clear Whiteboard"
          >
             <Eraser size={20} strokeWidth={2.5} />
          </button>

          <div class="w-px h-6 bg-gray-100"></div>

          <!-- 1. Live Conversation toggle icon -->
          <button onclick={() => showLiveChat = !showLiveChat} class="w-[34px] h-[34px] md:w-[40px] md:h-[40px] rounded-full {showLiveChat ? 'bg-[#ffeee5] text-[#ff6b00]' : 'bg-transparent text-slate-500 hover:bg-slate-50'} flex items-center justify-center border-none cursor-pointer transition-colors" title="Text Chat Toggle">
             <MessageSquareQuote size={22} strokeWidth={2.5} />
          </button>

          <div class="w-px h-6 bg-gray-100"></div>

          <!-- 2. Mic Icon -->
          <button class="w-[34px] h-[34px] md:w-[40px] md:h-[40px] rounded-full bg-transparent text-slate-500 flex items-center justify-center border-none cursor-pointer hover:bg-slate-50 transition-colors" title="Voice Note">
             <Mic size={20} strokeWidth={2.5} />
          </button>

          <!-- 3. Hand Raise Icon -->
          <button class="w-[34px] h-[34px] md:w-[40px] md:h-[40px] rounded-full bg-transparent text-slate-500 flex items-center justify-center border-none cursor-pointer hover:bg-slate-50 transition-colors" title="Raise Hand">
             <Hand size={20} strokeWidth={2.5} />
          </button>

          <!-- 4. Playback Icon -->
          <button class="w-[34px] h-[34px] md:w-[40px] md:h-[40px] rounded-full bg-transparent text-slate-500 flex items-center justify-center border-none cursor-pointer hover:bg-slate-50 transition-colors" title="Play Back">
             <Play size={20} strokeWidth={2.5} class="translate-x-0.5" />
          </button>

          <div class="w-px h-6 bg-gray-100"></div>

          <!-- 5. Original Canvas Send Button -->
          <button onclick={onSendTap} class="w-[34px] h-[34px] md:w-[40px] md:h-[40px] rounded-full bg-[#ff5e00] text-white flex items-center justify-center border-none cursor-pointer hover:bg-[#e65500] transition-colors" title="Send Canvas">
             <Send size={20} strokeWidth={2} class="-ml-0.5" />
          </button>

          <div class="w-px h-6 bg-gray-100"></div>

          <!-- Show/Hide Toolbar toggler inside capsule -->
          <button 
             onclick={(e) => { 
                e.stopPropagation(); 
                showToolbar = !showToolbar; 
             }}
             class="w-[34px] h-[34px] md:w-[40px] md:h-[40px] rounded-full transition-colors flex items-center justify-center border-none cursor-pointer text-slate-500 hover:text-[#ff6b00] hover:bg-slate-50"
             title={showToolbar ? "Hide Toolbar" : "Show Toolbar"}
          >
             {#if showToolbar}
                <EyeOff size={20} strokeWidth={2.5} />
             {:else}
                <Eye size={20} strokeWidth={2.5} />
             {/if}
          </button>

       </div>
    </div>
  </div>
  {/if}

  <!-- Sent Message Overlay (Rendered Over Everything) -->
  {#if showSentMessage}
    <div class="absolute inset-x-0 top-[76px] z-[250] flex items-center justify-center pointer-events-none">
       <div class="bg-gray-950/90 backdrop-blur-md text-[#ff6b00] border border-[#ff6b00]/30 text-xs font-bold tracking-widest uppercase py-1.5 px-4 rounded-full shadow-[0_4px_16px_rgba(255,107,0,0.15)] flex items-center gap-1.5 select-none" 
            in:fly={{ y: -10, duration: 250 }} 
            out:fade={{ duration: 150 }}>
         <span>Sent</span>
       </div>
    </div>
  {/if}

</div>
{/if}

<style>
  @keyframes flyOffPlane {
    0% {
      transform: translate(0, 0) rotate(0deg) scale(1.1);
      opacity: 1;
    }
    40% {
      transform: translate(var(--mid-x), var(--mid-y)) rotate(var(--mid-rot)) scale(0.9);
      opacity: 0.7;
    }
    100% {
      transform: translate(var(--end-x), var(--end-y)) rotate(var(--end-rot)) scale(0.4);
      opacity: 0;
    }
  }

  .fly-off-animation {
    animation: flyOffPlane 50ms cubic-bezier(0.1, 0.4, 0.35, 1) forwards;
  }

  .typing-block-container {
    display: inline-grid;
    grid-template-columns: minmax(2ch, max-content);
    align-items: center;
    min-width: 2ch;
    max-width: 85vw;
    border-radius: 8px;
    padding: 4px;
    padding-right: 2ch;
    box-sizing: border-box;
  }

  .typing-block-grow {
    grid-area: 1 / 1;
    white-space: pre-wrap;
    word-break: break-all;
    visibility: hidden;
    padding: 0;
    margin: 0;
  }

  .typing-block-textarea {
    grid-area: 1 / 1;
    width: 100%;
    height: 100%;
    resize: none;
    overflow: hidden;
    background: transparent;
    border: none;
    outline: none;
    border-style: none;
    box-shadow: none;
    padding: 0;
    margin: 0;
    caret-color: #ff6b00;
  }
  .typing-block-container > div:not(.typing-block-grow) {
    padding: 0 !important;
  }
</style>
