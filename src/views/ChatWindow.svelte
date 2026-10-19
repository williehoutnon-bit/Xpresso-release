<style>
  :global(.hide-scrollbar::-webkit-scrollbar) {
    display: none !important;
  }
  :global(.hide-scrollbar) {
    -ms-overflow-style: none !important;  /* IE/Edge */
    scrollbar-width: none !important;  /* Firefox */
  }
  @keyframes cursor-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
  .animate-cursor-blink {
    animation: cursor-blink 1s step-end infinite;
  }
</style>

<script lang="ts">
  function virtualKeyboardManual(node: HTMLElement) {
    node.setAttribute('virtualkeyboardpolicy', 'manual');
  }
  import { onMount, tick, onDestroy, untrack } from 'svelte';
  import { Plus, ChevronLeft, Pencil, ChevronRight, ChevronDown, Send, Phone, Video, PlayCircle, Mic, Paperclip, Camera, Image as ImageIcon, Check, CheckCheck, X, Clock, Pause, Play, Trash2, Share, Pin, CornerUpLeft, MessageSquare, Download, Pi, Keyboard, Palette, Baseline, Undo, Redo, Type, Eraser } from 'lucide-svelte';
  import { jsPDF } from 'jspdf';
  // @ts-ignore
  import audioPlaybackServiceRaw from '../services/audioPlaybackService.svelte.ts?raw';
  // @ts-ignore
  import audioMessagePlayerRaw from '../components/AudioMessagePlayer.svelte?raw';
  // @ts-ignore
  import dbServiceRaw from '../services/dbService.ts?raw';
  // @ts-ignore
  import messagingServiceRaw from '../services/messagingService.ts?raw';
  // @ts-ignore
  import readActionRaw from '../services/readAction.ts?raw';
  import MathKeyboard from '../components/MathKeyboard.svelte';
  import { NATIVE_BACK_EVENT, hideSystemKeyboard } from '../native';
  import { type MathNode, type CursorPath, getContainer, replaceContainer } from '../math/mathModel';
  import { serializeTree, deserializeTree, formatMathAsPlainText } from '../math/mathSerialization';
  import { sliceTree } from '../math/treeSlice';
  import { collectCursorCandidates, resolveTapToCursor, resolveSpatialTap, getSelectedNodeIds } from '../math/mathPointerResolver';
  import { deleteNodes } from '../math/mathOperations';
  import MathNodeRenderer from '../math/MathNodeRenderer.svelte';
  import StaticMathRenderer from '../math/StaticMathRenderer.svelte';
  import InkOverlay from '../components/InkOverlay.svelte';
  import InkCanvasOverlay from '../components/InkCanvasOverlay.svelte';
  import AnnotatableText from '../components/AnnotatableText.svelte';
  import ChatAnnotationLayer from '../components/ChatAnnotationLayer.svelte';
  import type { StrokeElement } from '../types/ink';
  import {
    StrokeStabilizer,
    processStrokeEnd,
    pointsToBezierSvgPath,
    bezierSegmentsToSvgPath,
    type CubicBezierSegment
  } from '../math/inkMath';
  // @ts-ignore
  import inboxViewRaw from '../views/InboxView.svelte?raw';
  // @ts-ignore
  import chatWindowRaw from './ChatWindow.svelte?raw';
  // @ts-ignore
  import webrtcServiceRaw from '../services/webrtcService.ts?raw';
  // @ts-ignore
  import setupCallsDbRaw from '../../setup-calls-db.mjs?raw';

  import { messagingService, typingStore } from '../services/messagingService';
  import { authService } from '../services/authService';
  import { dbService } from '../services/dbService';
  import { markRead } from '../services/readAction';
  import { supabaseAdmin } from '../services/supabaseService';
  import UserProfileLightbox from '../components/UserProfileLightbox.svelte';
  // @ts-ignore
  import AudioMessagePlayer from '../components/AudioMessagePlayer.svelte';
  import MathMessageCanvas from './MathMessageCanvas.svelte';
  import BracketWrapper from '../components/BracketWrapper.svelte';
  import SqrtWrapper from '../components/SqrtWrapper.svelte';
  import { downloadMathDocument, uploadMathDocument } from '../services/mathStorage';
  import { audioPlaybackService } from '../services/audioPlaybackService.svelte';
  import { webrtcService } from '../services/webrtcService';
  import { getFallbackColor } from '../utils/dominantColor';

  let loadedImages = $state<Record<string, boolean>>({});

  let toast = $state<{ title: string; body: string; type: 'info' | 'error' | 'success' } | null>(null);
  let toastTimer: any = null;

  function triggerNotification(title: string, options: any) {
    console.log(`Notification: ${title}`, options);
    toast = {
      title,
      body: options?.body || '',
      type: options?.type || 'info'
    };
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast = null;
    }, 4000);
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

  function hasSuperscript(nodes: any[]): boolean {
    if (!nodes || !Array.isArray(nodes)) return false;
    for (const node of nodes) {
      if (node.type === 'bracket' && node.bracketType === 'superscript_group') {
        return true;
      }
      if (node.type === 'sqrt' && hasSuperscript(node.content)) {
        return true;
      }
      if (node.type === 'bracket' && hasSuperscript(node.content)) {
        return true;
      }
      if (node.type === 'fraction' && (hasSuperscript(node.numerator) || hasSuperscript(node.denominator))) {
        return true;
      }
    }
    return false;
  }

  function hasSubscript(nodes: any[]): boolean {
    if (!nodes || !Array.isArray(nodes)) return false;
    for (const node of nodes) {
      if (node.type === 'bracket' && node.bracketType === 'subscript_group') {
        return true;
      }
      if (node.type === 'sqrt' && hasSubscript(node.content)) {
        return true;
      }
      if (node.type === 'bracket' && hasSubscript(node.content)) {
        return true;
      }
      if (node.type === 'fraction' && (hasSubscript(node.numerator) || hasSubscript(node.denominator))) {
        return true;
      }
    }
    return false;
  }

  let { conversationId, contactName = 'Learner', onback } = $props<{
    conversationId: string;
    contactName?: string;
    onback?: () => void;
  }>();

  let currentTree = $state<MathNode[]>([]);
  let currentCursorPath = $state<CursorPath | null>({ containerPath: [], offset: 0 });
  let selectionAnchorPath = $state<CursorPath | null>(null);
  let selectedNodeIds = $derived(
    (selectionAnchorPath && currentCursorPath && JSON.stringify(selectionAnchorPath) !== JSON.stringify(currentCursorPath))
      ? getSelectedNodeIds(currentTree, selectionAnchorPath, currentCursorPath)
      : new Set<string>()
  );
  let msg = $derived(serializeTree(currentTree));

  // Automatically prune any trailing whitespaces/newlines that are after the current cursor position
  $effect(() => {
    if (currentCursorPath && currentCursorPath.containerPath.length === 0) {
      const offset = currentCursorPath.offset;
      if (offset < currentTree.length) {
        // Check if all elements from offset to the end of the tree are spaces or newlines
        let allSpacesOrNewlines = true;
        for (let i = offset; i < currentTree.length; i++) {
          const node = currentTree[i];
          if (node.type !== 'char' || ((node as any).value !== ' ' && (node as any).value !== '\n')) {
            allSpacesOrNewlines = false;
            break;
          }
        }
        if (allSpacesOrNewlines) {
          currentTree = currentTree.slice(0, offset);
        }
      }
    }
  });

  // Dynamically allocate the empty spacer height below the draft bubble based on the current caret position
  let caretLinesBelow = $derived.by(() => {
    if (!currentCursorPath || currentCursorPath.containerPath.length > 0) {
      return 0;
    }
    const offset = currentCursorPath.offset;
    let count = 0;
    for (let i = offset; i < currentTree.length; i++) {
      const node = currentTree[i];
      if (node.type === 'char' && (node as any).value === '\n') {
        count++;
      }
    }
    return count;
  });

  let keyboardSpacingSpacerHeight = $derived.by(() => {
    if (!showMathKeyboard) return 16;
    // Comfort height below caret line to keep it above keyboard (approx keyboard height)
    const keyboardHeight = 350; 
    let currentLineHeight = 28;
    if (textareaEl) {
      const computed = parseFloat(window.getComputedStyle(textareaEl).lineHeight);
      if (!isNaN(computed) && computed > 0) currentLineHeight = computed;
    }
    const linesBelowHeight = caretLinesBelow * currentLineHeight;
    return Math.max(16, keyboardHeight - linesBelowHeight);
  });

  // Undo/Redo & Formatting States
  let msgHistory = $state<string[]>(['']);
  let historyIndex = $state(0);
  let isUndoRedoAction = false;

  let activeTextColorIndex = $state(0);
  const textColors = [
    { name: 'Default', value: 'default', displayColor: '#1d4ed8' },
    { name: 'Crimson Red', value: '#dc2626', displayColor: '#dc2626' },
    { name: 'Forest Green', value: '#16a34a', displayColor: '#16a34a' }
  ];

  function stampUncoloredNodes(nodes: MathNode[], color: string): MathNode[] {
    if (!nodes || !Array.isArray(nodes)) return [];
    return nodes.map(n => {
      const nodeColor = n.color || color;
      if (n.type === 'char') {
        return { ...(n as any), color: nodeColor };
      } else if (n.type === 'fraction') {
        return {
          ...(n as any),
          color: nodeColor,
          numerator: stampUncoloredNodes(n.numerator, nodeColor),
          denominator: stampUncoloredNodes(n.denominator, nodeColor)
        };
      } else if (n.type === 'exponent') {
        return {
          ...(n as any),
          color: nodeColor,
          base: stampUncoloredNodes(n.base, nodeColor),
          exponent: stampUncoloredNodes(n.exponent, nodeColor)
        };
      } else if (n.type === 'subscript') {
        return {
          ...(n as any),
          color: nodeColor,
          base: stampUncoloredNodes(n.base, nodeColor),
          subscript: stampUncoloredNodes(n.subscript, nodeColor)
        };
      } else if (n.type === 'sqrt') {
        return {
          ...(n as any),
          color: nodeColor,
          content: stampUncoloredNodes(n.content, nodeColor)
        };
      } else if (n.type === 'nthroot') {
        return {
          ...(n as any),
          color: nodeColor,
          index: stampUncoloredNodes(n.index, nodeColor),
          content: stampUncoloredNodes(n.content, nodeColor)
        };
      } else if (n.type === 'longdiv') {
        return {
          ...(n as any),
          color: nodeColor,
          index: stampUncoloredNodes(n.index, nodeColor),
          content: stampUncoloredNodes(n.content, nodeColor),
          quotient: n.quotient ? stampUncoloredNodes(n.quotient, nodeColor) : undefined
        };
      } else if (n.type === 'bracket') {
        return {
          ...(n as any),
          color: nodeColor,
          content: stampUncoloredNodes(n.content, nodeColor),
          subscript: n.subscript ? stampUncoloredNodes(n.subscript, nodeColor) : undefined,
          superscript: n.superscript ? stampUncoloredNodes(n.superscript, nodeColor) : undefined
        };
      } else if (n.type === 'integral') {
        return {
          ...(n as any),
          color: nodeColor,
          content: stampUncoloredNodes(n.content, nodeColor),
          subscript: n.subscript ? stampUncoloredNodes(n.subscript, nodeColor) : undefined,
          superscript: n.superscript ? stampUncoloredNodes(n.superscript, nodeColor) : undefined
        };
      } else if (n.type === 'underbrace') {
        return {
          ...(n as any),
          color: nodeColor,
          content: stampUncoloredNodes(n.content, nodeColor),
          label: stampUncoloredNodes(n.label, nodeColor)
        };
      }
      return { ...(n as any), color: nodeColor };
    });
  }

  function selectTextColor(newIndex: number) {
    if (newIndex === activeTextColorIndex) return;
    const prevColor = textColors[activeTextColorIndex].displayColor;
    if (currentTree && currentTree.length > 0) {
      currentTree = stampUncoloredNodes(currentTree, prevColor);
    }
    activeTextColorIndex = newIndex;
  }

  let isBold = $state(true);
  let isItalic = $state(false);
  let isUnderlined = $state(false);
  let activeFontFamily = $state("'Kalam', cursive");
  let showFormattingPanel = $state(false);

  // Auto-record history of typed text
  $effect(() => {
    const currentVal = msg;
    if (isUndoRedoAction) {
      isUndoRedoAction = false;
      return;
    }
    if (currentVal !== msgHistory[historyIndex]) {
      const nextHistory = msgHistory.slice(0, historyIndex + 1);
      nextHistory.push(currentVal);
      msgHistory = nextHistory;
      historyIndex = msgHistory.length - 1;
    }
  });

  function handleDraftUndo() {
    if (historyIndex > 0) {
      isUndoRedoAction = true;
      historyIndex--;
      currentTree = deserializeTree(msgHistory[historyIndex]);
      currentCursorPath = { containerPath: [], offset: currentTree.length };
    }
  }

  function handleDraftRedo() {
    if (historyIndex < msgHistory.length - 1) {
      isUndoRedoAction = true;
      historyIndex++;
      currentTree = deserializeTree(msgHistory[historyIndex]);
      currentCursorPath = { containerPath: [], offset: currentTree.length };
    }
  }
  let cursorPosition = $state(0);
  let selectionStart = $state(0);
  let selectionEnd = $state(0);
  
  const updateCursor = () => {
    // Legacy cursor tracking
  };
  const handleSelectionChange = () => {
    if (document.activeElement === textareaEl) {
      updateCursor();
    }
  };
  let showMathKeyboard = $state(false);
  let hasSeenTypingInstructions = $state(false);
  function lockNativeKeyboard(e: any) {
    if (showMathKeyboard && e.target && typeof e.target.blur === 'function') {
      if (e.target === textareaEl) return;
      e.target.blur();
    }
  }
  
  let showContextMenu = $state(false);
  let contextMenuPos = $state({ x: 0, y: 0 });

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    touchGestureType = 'long_press';
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    showContextMenu = true;
    contextMenuPos = { x: e.clientX, y: e.clientY };
  }

  async function copyToClipboard(text: string) {
    if (!navigator.clipboard) {
      fallbackCopyTextToClipboard(text);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      fallbackCopyTextToClipboard(text);
    }
  }

  function fallbackCopyTextToClipboard(text: string) {
    var textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Fallback: Oops, unable to copy', err);
    }
    document.body.removeChild(textArea);
  }

  function execCopy() {
    if (selectedNodeIds && selectedNodeIds.size > 0) {
      const selectedNodes = sliceTree(currentTree, selectedNodeIds);
      const str = serializeTree(selectedNodes);
      copyToClipboard(str);
    }
    showContextMenu = false;
  }

  function execCut() {
    if (selectedNodeIds && selectedNodeIds.size > 0) {
      const selectedNodes = sliceTree(currentTree, selectedNodeIds);
      const str = serializeTree(selectedNodes);
      copyToClipboard(str);
      
      currentTree = deleteNodes(currentTree, selectedNodeIds);
      selectionAnchorPath = null;
      currentCursorPath = { containerPath: [], offset: 0 };
    }
    showContextMenu = false;
  }

  

  async function execPaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        if (selectedNodeIds && selectedNodeIds.size > 0) {
            currentTree = deleteNodes(currentTree, selectedNodeIds);
            selectionAnchorPath = null;
            currentCursorPath = { containerPath: [], offset: 0 };
        }
        
        const parsed = deserializeTree(text);
        if (parsed.length > 0) {
            const currentColor = textColors[activeTextColorIndex].displayColor;
            const stamped = stampUncoloredNodes(parsed, currentColor);
            const container = getContainer(currentTree, currentCursorPath?.containerPath || []);
            const offset = currentCursorPath?.offset || 0;
            const newContainer = [
                ...container.slice(0, offset),
                ...stamped,
                ...container.slice(offset)
            ];
            currentTree = replaceContainer(currentTree, currentCursorPath?.containerPath || [], newContainer);
            currentCursorPath = {
                containerPath: currentCursorPath?.containerPath || [],
                offset: offset + stamped.length
            };
        }
      }
    } catch (err) {
      console.error('Failed to read clipboard', err);
      alert('Clipboard access denied or not supported. Please use keyboard shortcut (Ctrl+V or Cmd+V) to paste.');
    }
    showContextMenu = false;
  }

  type TouchGestureType = 'undetermined' | 'single_tap' | 'scroll' | 'long_press' | 'drag_select';
  let touchGestureType = $state<TouchGestureType>('undetermined');
  let startPointerPos = { x: 0, y: 0 };
  let startPointerTime = 0;
  let hasMovedBeyondSlop = false;
  let longPressTimer: any = null;
  let pointerDownTargetEl: HTMLElement | null = null;
  let lastScrollTimestamp = 0;

  function cleanupPointerListeners() {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerCancel);
  }

  function handlePointerDown(e: PointerEvent) {
    if (isSketchMode) return;
    // For mobile/touch: allow all pointer types. For mouse: only left button (0)
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    
    showContextMenu = false;

    // If the chat view was recently scrolling or momentum scrolling, treat this as a scroll interaction
    if (Date.now() - lastScrollTimestamp < 220) {
      touchGestureType = 'scroll';
      return;
    }

    touchGestureType = 'undetermined';
    startPointerPos = { x: e.clientX, y: e.clientY };
    startPointerTime = Date.now();
    hasMovedBeyondSlop = false;
    pointerDownTargetEl = (e.target as HTMLElement)?.closest?.('.math-root') as HTMLElement || textareaEl;
    
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);

    // Start long-press detection timer (380ms)
    // If held without movement, definitively classify as LONG PRESS - preventing caret auto-placement!
    if (longPressTimer) clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
        if (!hasMovedBeyondSlop && touchGestureType === 'undetermined') {
            // Touch type is definitively determined: LONG PRESS!
            touchGestureType = 'long_press';
            showContextMenu = true;
            contextMenuPos = { x: startPointerPos.x, y: startPointerPos.y - 40 };
            cleanupPointerListeners();
            // Caret auto-placement is completely prevented on long press!
        }
    }, 380);
  }

  function handlePointerMove(e: PointerEvent) {
    if (touchGestureType === 'scroll' || touchGestureType === 'long_press') return;
    
    const dx = e.clientX - startPointerPos.x;
    const dy = e.clientY - startPointerPos.y;
    const dist = Math.hypot(dx, dy);

    // Slop threshold (8px) to distinguish a stationary touch from a scroll or drag
    if (dist > 8) {
       hasMovedBeyondSlop = true;
       if (longPressTimer) {
         clearTimeout(longPressTimer);
         longPressTimer = null;
       }

       // If vertical movement is detected or dominates, it is definitively a SCROLL gesture!
       if (Math.abs(dy) >= 6 || Math.abs(dy) >= Math.abs(dx) * 0.5) {
          touchGestureType = 'scroll';
          cleanupPointerListeners();
          // Caret is NEVER repositioned on scroll!
          return;
       }

       // Only if movement is strongly horizontal across text lines do we consider drag_select
       if (Math.abs(dx) >= 16 && Math.abs(dx) > Math.abs(dy) * 2) {
          touchGestureType = 'drag_select';
          const activeEl = pointerDownTargetEl || textareaEl;
          if (activeEl) {
            const res = resolveSpatialTap(e.clientX, e.clientY, activeEl, currentTree);
            if (res) {
              currentTree = res.tree;
              currentCursorPath = res.path;
            }
          }
       }
    }
  }

  function handlePointerCancel() {
    touchGestureType = 'scroll';
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    cleanupPointerListeners();
  }

  function handlePointerUp(e: PointerEvent) {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    cleanupPointerListeners();

    // 1. If touch was determined to be a scroll, long-press, or moved beyond slop, DO NOT place the caret!
    if (touchGestureType === 'scroll' || touchGestureType === 'long_press' || hasMovedBeyondSlop) {
      return;
    }

    // 2. If recent scroll occurred within 220ms, prevent caret placement
    if (Date.now() - lastScrollTimestamp < 220) {
      touchGestureType = 'scroll';
      return;
    }

    // 3. If user dragged to select text
    if (touchGestureType === 'drag_select') {
      if (selectedNodeIds && selectedNodeIds.size > 0) {
        showContextMenu = true;
        contextMenuPos = { x: e.clientX, y: e.clientY - 40 };
      }
      return;
    }

    // 4. Touch type determination: It is a genuine SINGLE TAP only if:
    // - Movement stayed strictly within slop threshold (<= 8px)
    // - Duration was within a genuine tap window (>= 30ms and < 380ms)
    // - It was not cancelled, scrolled, or held
    const elapsed = Date.now() - startPointerTime;
    const finalDist = Math.hypot(e.clientX - startPointerPos.x, e.clientY - startPointerPos.y);

    if (touchGestureType === 'undetermined' && !hasMovedBeyondSlop && finalDist <= 8 && elapsed >= 30 && elapsed < 380) {
      touchGestureType = 'single_tap';
      
      // Now, and ONLY now after the touch type is definitively determined as single tap, place the caret!
      showMathKeyboard = true;
      hasSeenTypingInstructions = true;
      
      const activeEl = pointerDownTargetEl || textareaEl;
      if (activeEl) {
        const res = resolveSpatialTap(startPointerPos.x, startPointerPos.y, activeEl, currentTree);
        if (res) {
          currentTree = res.tree;
          currentCursorPath = res.path;
          selectionAnchorPath = null;
        }
      }

      tick().then(() => {
        textareaEl?.focus();
      });
    }
  }

  function handleCopy(e: ClipboardEvent) {
    if (selectedNodeIds.size > 0) {
      e.preventDefault();
      // Extract selected nodes and serialize
      const selectedNodes = sliceTree(currentTree, selectedNodeIds);
      const str = serializeTree(selectedNodes); // Wait, this just serializes the top-level matching nodes?
      // Actually serializeTree on the whole tree but only keeping selected node logic is better,
      // but users copy simple text mostly, or we can just serialize the raw text they highlighted.
      // For now let's just write a quick serialization.
      e.clipboardData?.setData('text/plain', str);
    }
  }

  function handleCut(e: ClipboardEvent) {
    if (selectedNodeIds.size > 0) {
      handleCopy(e);
      // Delete selected nodes
      currentTree = deleteNodes(currentTree, selectedNodeIds);
      selectionAnchorPath = null;
      // We should probably reset currentCursorPath to something valid.
      currentCursorPath = { containerPath: [], offset: 0 };
    }
  }

  function handlePaste(e: ClipboardEvent) {
    const files = e.clipboardData?.files;
    if (files && files.length > 0) {
      const imgFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
      if (imgFiles.length > 0) {
        e.preventDefault();
        handleImageUpload({ target: { files: imgFiles, value: '' } } as any);
        return;
      }
    }

    const text = e.clipboardData?.getData('text/plain');
    if (text) {
      e.preventDefault();
      if (selectedNodeIds && selectedNodeIds.size > 0) {
        currentTree = deleteNodes(currentTree, selectedNodeIds);
        selectionAnchorPath = null;
        currentCursorPath = { containerPath: [], offset: 0 };
      }
      const parsed = deserializeTree(text);
      if (parsed.length > 0) {
        const currentColor = textColors[activeTextColorIndex].displayColor;
        const stamped = stampUncoloredNodes(parsed, currentColor);
        const container = getContainer(currentTree, currentCursorPath?.containerPath || []);
        const offset = currentCursorPath?.offset || 0;
        const newContainer = [
          ...container.slice(0, offset),
          ...stamped,
          ...container.slice(offset)
        ];
        currentTree = replaceContainer(currentTree, currentCursorPath?.containerPath || [], newContainer);
        currentCursorPath = {
          containerPath: currentCursorPath?.containerPath || [],
          offset: offset + stamped.length
        };
      }
    }
  }
  let textareaEl = $state<HTMLElement | null>(null);
  let activeCall = $state<{ 
    callId?: string,
    type: 'audio' | 'video', 
    active: boolean, 
    localStream?: MediaStream | null,
    remoteStreams: Map<string, MediaStream>
  } | null>(null);
  let incomingCallDoc = $state<any>(null); // holds Appwrite Call document for incoming call ring
  let messagesContainer = $state<HTMLElement | null>(null);
  let unreadMarkerEl = $state<HTMLElement | null>(null);

  let cachedDraftId = $state<string | null>('draft');

  function getOrCreateDraftId(): string {
    if (!cachedDraftId) cachedDraftId = 'draft';
    return cachedDraftId;
  }

  const offlineUser = typeof window !== 'undefined' ? authService.getOfflineUser() : null;
  const initialCachedMsgs = conversationId ? messagingService.getCachedMessages(conversationId) : [];
  let messages = $state<any[]>(initialCachedMsgs);
  let currentUserId = $state(offlineUser?.$id || offlineUser?.id || '');
  let currentUserName = $state(offlineUser?.prefs?.fullName || offlineUser?.name || 'Learner');
  let subscriptions: any[] = [];
  let isProfileLightboxOpen = $state(false);
  let profileData = $state<any>(null);
  let isComrade = $state(false);
  let isInvited = $state(false);

  // Real-time local & remote typing indicators setup
  let typingTimer: any = null;
  let isCurrentlyTyping = false;

  const handleTyping = () => {
    if (!isCurrentlyTyping) {
      isCurrentlyTyping = true;
      messagingService.sendTypingIndicator(activeConversationId, true);
    }

    if (typingTimer) clearTimeout(typingTimer);
    
    typingTimer = setTimeout(() => {
      isCurrentlyTyping = false;
      messagingService.sendTypingIndicator(activeConversationId, false);
    }, 3000);
  };

  const typingUsersInThisConvo = $derived(
    Object.entries($typingStore)
      .filter(([userId, convoId]) => convoId === activeConversationId && userId !== currentUserId)
      .map(([userId]) => userId)
  );

  $effect(() => {
    if (typingUsersInThisConvo.length > 0 && isNearBottom) {
      scrollToBottom('smooth');
    }
  });

  let isLoading = $state(initialCachedMsgs.length === 0);
  let isSyncing = $state(false);
  let isNewChat = $state(false);
  let isInitialLoadDone = $state(initialCachedMsgs.length > 0);
  let elevatingToId: string | null = null;
  let isElevating = false;
  let conversationResolutionPromise: Promise<string | null> | null = null;
  let activeConversationId = $state(conversationId);
  async function ensureRealConversationId(): Promise<string | null> {
    if (!activeConversationId || !activeConversationId.startsWith('local_convo_')) return activeConversationId;
    if (conversationResolutionPromise) return conversationResolutionPromise;

    const partnerId = activeConversationId.replace('local_convo_', '');
    isElevating = true;
    conversationResolutionPromise = (async () => {
      const convo = await messagingService.getOrCreateConversation(partnerId);
      if (!convo) return null;
      elevatingToId = convo.id;
      activeConversationId = convo.id;
      return convo.id;
    })();

    try {
      return await conversationResolutionPromise;
    } catch (e) {
      console.error("Failed to elevate conversation", e);
      return null;
    } finally {
      isElevating = false;
      conversationResolutionPromise = null;
    }
  }

  let syncTimeout: any;

  // Optimization: derived only for visible attributes
  const renderedMessages = $derived.by(() => {
    const activeUserId = currentUserId;
    if (messages.length === 0) return [];
    return messages
      .filter(m => !isMarkCarrier(m))
      .map(m => ({
        ...m,
        isMe: m.sender_id === activeUserId || m.senderId === activeUserId
      }));
  });

  // Scroll Tracking State
  let isNearBottom = $state(true);
  let showNewMsgBtn = $state(false);
  let unreadCountBelow = $state(0);
  let prevMessageCount = 0;
  let isInitialScrollDone = false;
  let participantLastReadAt = $state('1970-01-01T00:00:00.000Z');

  // First unread message index
  const firstUnreadIndex = $derived.by(() => {
    return renderedMessages.findIndex(m => {
       return !m.isMe && new Date((m.createdAt ?? m.created_at)).getTime() > new Date(participantLastReadAt).getTime();
    });
  });

  $effect(() => {
    if (messages.length > 0) {
      isLoading = false;
      isSyncing = false;
    }
  });

  $effect(() => {
    const _placeholderVal = msg;
    const _convoPlaceholder = activeConversationId;
    if (textareaEl) {
      textareaEl.style.height = 'auto';
      textareaEl.style.height = `${textareaEl.scrollHeight}px`;
      if (showMathKeyboard && !isSketchMode && document.activeElement !== textareaEl) {
        textareaEl.focus();
      }
    }
  });

  let lastReadUpdate = 0;
  let lastReadConvoId = '';
  const READ_UPDATE_COOLDOWN = 3000; // 3s

  const throttledMarkAsRead = (id: string, force = false) => {
     if (!id || id.startsWith('local_convo_')) return;
     const now = Date.now();
     if (force || id !== lastReadConvoId || now - lastReadUpdate > READ_UPDATE_COOLDOWN) {
        lastReadUpdate = now;
        lastReadConvoId = id;
        messagingService.markConversationAsRead(id);
     }
  };

  function readOnVisible(node: HTMLElement, m: any) {
     if (m.isMe || m.status === 'read') return {};
     
     const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
           if (entry.isIntersecting) {
              messagingService.markAsRead(m.id);
              throttledMarkAsRead(m.conversationId || activeConversationId);
              observer.unobserve(node);
           }
        });
     }, { threshold: 0.1 });
     
     observer.observe(node);
     
     return {
        destroy() { observer.disconnect(); }
     };
  }

  $effect(() => {
    // This effect acts like afterUpdate in Svelte 4, running after DOM update.
    if (!isInitialScrollDone && messages.length > 0 && messagesContainer) {
      scrollToBottom('instant');
      isInitialScrollDone = true;
      throttledMarkAsRead(activeConversationId, true);
      prevMessageCount = messages.length;
      unreadCountBelow = 0;
      showNewMsgBtn = false;
      return;
    }
    
    if (isInitialScrollDone && renderedMessages.length > prevMessageCount && messagesContainer) {
      if (isSketchMode) {
        prevMessageCount = messages.length;
        return;
      }
      const latestMsg = renderedMessages[renderedMessages.length - 1];
      const isMine = latestMsg?.isMe;
      
      const isMarkingInProgress = isSketchMode && hasPendingMarks;
      if (isMine) {
        cancelScrollAnim();
        scrollToBottom('instant', true);
      } else if (isNearBottom && !isMarkingInProgress) {
        scrollToBottom('smooth');
        if (!isMathCanvasOpen) throttledMarkAsRead(activeConversationId);
      } else {
        const countDiff = Math.max(1, renderedMessages.length - prevMessageCount);
        unreadCountBelow += countDiff;
        showNewMsgBtn = true;
      }
      prevMessageCount = messages.length;
    }
  });

  $effect(() => {
     // Keep Math Canvas synced in realtime with incoming versions
     if (isMathCanvasOpen && activeMathMessage && activeMathDocument && activeMathMessage.id) {
         const latestMsg = renderedMessages.find(m => m.id === activeMathMessage.id);
         if (latestMsg && latestMsg.mathMeta) {
             const newMeta = latestMsg.mathMeta;
             const oldVersionCount = activeMathDocument.versionChainIds?.length || 0;
             const newVersionCount = newMeta.versionChainIds?.length || 0;
             if (newVersionCount > oldVersionCount) {
                 // The message has a newer version! Update state slightly so the Next arrow activates
                 activeMathDocument = {
                     ...activeMathDocument,
                     versionChainIds: newMeta.versionChainIds,
                     versionFileIds: newMeta.versionFileIds,
                     versionAuthorIds: newMeta.versionAuthorIds,
                     versionAuthorNames: newMeta.versionAuthorNames
                 };
                 activeMathMessage = {
                     ...latestMsg
                 };
             } else if (newMeta.chalkHolder !== activeMathMessage.mathMeta?.chalkHolder) {
                 // Even if no new version is saved, if chalk holder changed or someone is editing, update it
                 activeMathMessage = { ...latestMsg };
             }
         }
     }
  });

  // Specialised Math Canvas & Message State
  let isMathCanvasOpen = $state(false);
  let activeMathDocument = $state<any>(null);
  let activeMathMessage = $state<any>(null);
  let mathFormula = $state('');
  let mathCanvasEl = $state<HTMLCanvasElement | null>(null);
  let isSketchMode = $state(false);
  let annotatableRefs: Record<string, any> = $state({});
  let sketchHistory = $state<ImageData[]>([]);
  let sketchHistoryIndex = $state(-1);
  let isDrawing = false;
  let canvasContext: CanvasRenderingContext2D | null = null;
  let penColor = $state('#00274d');
  let penWidth = $state(3);
  let eraserMode = $state(false);

  interface StagedDraftImage {
    id: string;
    file: File;
    url: string;
    dominantColor: string;
    name: string;
    gapTextTree: MathNode[];
  }

  // Staged Images for Draft Composer (allows multiple images and typing in the gaps below)
  let stagedImages = $state<StagedDraftImage[]>([]);
  let selectedDraftImageId = $state<string | null>(null);
  let lastSelectedDraftImageId = $state<string | null>(null);
  let focusedGapImageId = $state<string | null>(null);

  const stagedImage = $derived(stagedImages.length > 0 ? stagedImages[0] : null);

  function selectDraftImage(imgId: string) {
    if (selectedDraftImageId === imgId) {
      selectedDraftImageId = null;
    } else {
      selectedDraftImageId = imgId;
      lastSelectedDraftImageId = imgId;
    }
  }

  function removeStagedImage(imgId: string) {
    const idx = stagedImages.findIndex(i => i.id === imgId);
    if (idx === -1) return;
    if (selectedDraftImageId === imgId) selectedDraftImageId = null;
    if (lastSelectedDraftImageId === imgId) lastSelectedDraftImageId = null;

    const remaining = stagedImages.filter(i => i.id !== imgId);
    stagedImages = remaining;
    if (remaining.length === 0) {
      focusedGapImageId = null;
    } else {
      const nextFocus = remaining[Math.min(idx, remaining.length - 1)];
      switchFocusedGap(nextFocus.id);
    }
  }

  function switchFocusedGap(targetImgId: string) {
    if (Date.now() - lastScrollTimestamp < 220 || touchGestureType === 'scroll') return;
    if (focusedGapImageId === targetImgId) return;
    if (focusedGapImageId) {
      const prev = stagedImages.find(i => i.id === focusedGapImageId);
      if (prev) {
        prev.gapTextTree = [...currentTree];
      }
    }
    focusedGapImageId = targetImgId;
    const target = stagedImages.find(i => i.id === targetImgId);
    if (target) {
      currentTree = [...(target.gapTextTree || [])];
      currentCursorPath = { containerPath: [], offset: currentTree.length };
    }
    selectedDraftImageId = null;
    tick().then(() => textareaEl?.focus());
  }

  // Vector Ink Annotation State
  let currentStrokes = $state<StrokeElement[]>([]);
  let strokeWidth = $state(2.5);
  let isEraser = $state(false);
  let strokeHistory = $state<StrokeElement[][]>([[]]);
  let strokeHistoryIndex = $state(0);
  let isStrokeUndoRedo = false;

  const stagedImageStrokes = $derived(
    currentStrokes.filter(s => s.targetContainer === 'image' || s.targetElement === 'image')
  );
  const draftTextStrokes = $derived(
    currentStrokes.filter(s => s.targetContainer !== 'image' && s.targetElement !== 'image')
  );

  $effect(() => {
    if (focusedGapImageId && stagedImages.length > 0) {
      const cur = stagedImages.find(i => i.id === focusedGapImageId);
      if (cur) {
        cur.gapTextTree = currentTree;
      }
    }
  });

  // Unsent ink drawn over existing bubbles, keyed by the target message id.
  const DRAFT_TARGET = '__draft__';
  let pendingMarks = $state<Record<string, StrokeElement[]>>({});
  let sketchUndoLog = $state<string[]>([]);
  let sketchRedoLog = $state<{ target: string; stroke?: StrokeElement }[]>([]);
  const hasPendingMarks = $derived(Object.values(pendingMarks).some((list) => list.length > 0));
  const canSketchUndo = $derived(strokeHistoryIndex > 0 || sketchUndoLog.length > 0);
  const canSketchRedo = $derived(
    strokeHistoryIndex < strokeHistory.length - 1 || sketchRedoLog.length > 0
  );

  function parseMeta(m: any): any {
    let meta = m?.mathMeta || m?.math_meta;
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta); } catch { meta = null; }
    }
    return meta && typeof meta === 'object' ? meta : null;
  }

  const receivedMarksByTarget = $derived.by(() => {
    const map: Record<string, StrokeElement[]> = {};
    for (const m of messages) {
      const anns = parseMeta(m)?.annotations;
      if (!Array.isArray(anns)) continue;
      for (const s of anns) {
        if (s?.targetMessageId) (map[s.targetMessageId] ??= []).push(s);
      }
    }
    return map;
  });

  // A message that only carries marks for other bubbles has nothing of its own to show.
  function isMarkCarrier(m: any): boolean {
    const meta = parseMeta(m);
    const anns = meta?.annotations;
    if (!Array.isArray(anns) || anns.length === 0) return false;
    if (!anns.every((s: any) => s?.targetMessageId)) return false;
    if (typeof m.content === 'string' && m.content.trim()) return false;
    if (Array.isArray(meta.nodes) && meta.nodes.length > 0) return false;
    if (Array.isArray(meta.strokes) && meta.strokes.some((s: any) => !s?.targetMessageId)) return false;
    const hasMedia = Array.isArray(m.attachments) && m.attachments.some((a: any) => a && a.type !== 'style' && a.type !== 'reply');
    return !hasMedia;
  }

  function addPendingMark(targetId: string, stroke: StrokeElement) {
    const existing = pendingMarks[targetId] ?? [];
    if (existing.some((s) => s.id === stroke.id)) return;
    const mark: StrokeElement = { ...stroke, targetMessageId: targetId, createdBy: currentUserId, createdAt: Date.now() };
    pendingMarks = { ...pendingMarks, [targetId]: [...existing, mark] };
    sketchUndoLog = [...sketchUndoLog, targetId];
    sketchRedoLog = [];
  }

  function handleMarkStrokesChanged(targetId: string, survivors: any[]) {
    const existing = pendingMarks[targetId] ?? [];
    const survivingIds = new Set(survivors.map((s) => s?.id));
    const kept = existing.filter((s) => survivingIds.has(s.id));
    if (kept.length !== existing.length) {
      pendingMarks = { ...pendingMarks, [targetId]: kept };
    }
  }

  function handleLayerStrokeCommitted(targetId: string, stroke: StrokeElement) {
    if (targetId === DRAFT_TARGET || targetId === '__draft__' || targetId === 'draft') {
      if (!currentStrokes.some(s => s.id === stroke.id)) {
        handleStrokesChanged([...currentStrokes, stroke]);
      }
    } else {
      addPendingMark(targetId, stroke);
    }
  }

  function isStrokeHit(stroke: any, clientX: number, clientY: number, targetRect: DOMRect): boolean {
    const pts = stroke.points || stroke.rawPoints;
    if (!Array.isArray(pts) || pts.length === 0) return false;
    const hitRadius = 24;
    for (const p of pts) {
      const pxNorm = typeof p === 'object' && !Array.isArray(p) ? (p.x ?? 0) : (Array.isArray(p) ? p[0] : 0);
      const pyNorm = typeof p === 'object' && !Array.isArray(p) ? (p.y ?? 0) : (Array.isArray(p) ? p[1] : 0);
      const screenX = targetRect.left + pxNorm * targetRect.width;
      const screenY = targetRect.top + pyNorm * targetRect.height;
      if (Math.hypot(screenX - clientX, screenY - clientY) <= hitRadius) {
        return true;
      }
    }
    return false;
  }

  function handleGlobalErase(clientX: number, clientY: number) {
    let pendingChanged = false;
    const newPendingMarks: Record<string, StrokeElement[]> = {};
    for (const [targetId, marks] of Object.entries(pendingMarks)) {
      const el = document.getElementById(`msg-${targetId}`) || document.querySelector(`[data-message-id="${targetId}"]`);
      const imgContainer = el?.querySelector<HTMLElement>('[data-image-container]');
      const wrap = el?.querySelector<HTMLElement>('.annotatable-wrap') || el;
      if (!imgContainer && !wrap) {
        newPendingMarks[targetId] = marks;
        continue;
      }
      const remaining = marks.filter(s => {
        const isImage = s.targetContainer === 'image' || s.targetElement === 'image';
        if (isImage && imgContainer) {
          return !isStrokeHit(s, clientX, clientY, imgContainer.getBoundingClientRect());
        }
        if (!isImage && wrap) {
          return !isStrokeHit(s, clientX, clientY, wrap.getBoundingClientRect());
        }
        if (imgContainer && isStrokeHit(s, clientX, clientY, imgContainer.getBoundingClientRect())) return false;
        if (wrap && isStrokeHit(s, clientX, clientY, wrap.getBoundingClientRect())) return false;
        return true;
      });
      if (remaining.length !== marks.length) {
        pendingChanged = true;
      }
      if (remaining.length > 0) {
        newPendingMarks[targetId] = remaining;
      }
    }
    if (pendingChanged) {
      pendingMarks = newPendingMarks;
    }

    if (currentStrokes.length > 0 && draftBubbleEl) {
      const imgContainer = draftBubbleEl.querySelector<HTMLElement>('[data-image-container]');
      const wrap = draftBubbleEl.querySelector<HTMLElement>('.annotatable-wrap') || draftBubbleEl;
      const remaining = currentStrokes.filter(s => {
        const isImage = s.targetContainer === 'image' || s.targetElement === 'image';
        if (isImage && imgContainer) {
          return !isStrokeHit(s, clientX, clientY, imgContainer.getBoundingClientRect());
        }
        if (!isImage && wrap) {
          return !isStrokeHit(s, clientX, clientY, wrap.getBoundingClientRect());
        }
        if (imgContainer && isStrokeHit(s, clientX, clientY, imgContainer.getBoundingClientRect())) return false;
        if (wrap && isStrokeHit(s, clientX, clientY, wrap.getBoundingClientRect())) return false;
        return true;
      });
      if (remaining.length !== currentStrokes.length) {
        handleStrokesChanged(remaining);
      }
    }
  }

  function resetSketchState() {
    pendingMarks = {};
    sketchUndoLog = [];
    sketchRedoLog = [];
  }

  function getResolvedStrokes(m: any): any[] {
    if (!m) return [];
    if (m._resolvedStrokes && Array.isArray(m._resolvedStrokes)) {
      return m._resolvedStrokes;
    }
    
    // Priority 1: mathMeta.strokes (new standard location)
    let meta = m.mathMeta || m.math_meta;
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta); } catch (e) { meta = null; }
    }
    if (meta && Array.isArray(meta.strokes) && meta.strokes.length > 0) {
      m._resolvedStrokes = meta.strokes;
      return meta.strokes;
    }
    
    // Priority 2: Legacy - attachments with annotation_layer
    if (Array.isArray(m.attachments)) {
      const annAtt = m.attachments.find((a: any) => a && a.type === 'annotation_layer');
      if (annAtt) {
        if (Array.isArray(annAtt.strokes) && annAtt.strokes.length > 0) {
          m._resolvedStrokes = annAtt.strokes;
          return annAtt.strokes;
        }
        if (Array.isArray(annAtt.annotations) && annAtt.annotations.length > 0) {
          m._resolvedStrokes = annAtt.annotations;
          return annAtt.annotations;
        }
        if (Array.isArray(annAtt.annotation_strokes) && annAtt.annotation_strokes.length > 0) {
          m._resolvedStrokes = annAtt.annotation_strokes;
          return annAtt.annotation_strokes;
        }
      }
    }
    
    // Priority 3: Very old messages - top-level strokes
    if (Array.isArray(m.strokes) && m.strokes.length > 0) {
      m._resolvedStrokes = m.strokes;
      return m.strokes;
    }
    
    // Priority 4: Very old messages - top-level annotations
    if (Array.isArray(m.annotations) && m.annotations.length > 0) {
      m._resolvedStrokes = m.annotations;
      return m.annotations;
    }
    
    // Priority 5: Very old messages - mathMeta.annotations or mathMeta.annotation_strokes
    if (meta) {
      if (Array.isArray(meta.annotation_strokes) && meta.annotation_strokes.length > 0) {
        m._resolvedStrokes = meta.annotation_strokes;
        return meta.annotation_strokes;
      }
      const ownAnnotations = Array.isArray(meta.annotations)
        ? meta.annotations.filter((s: any) => !s?.targetMessageId)
        : [];
      if (ownAnnotations.length > 0) {
        m._resolvedStrokes = ownAnnotations;
        return ownAnnotations;
      }
    }
    
    m._resolvedStrokes = [];
    return [];
  }

  function getAnnotationBounds(strokes: any[]): { maxY: number; extraBottomPadding: number; minHeight: number } {
    if (!strokes || !Array.isArray(strokes) || strokes.length === 0) {
      return { maxY: 1, extraBottomPadding: 0, minHeight: 0 };
    }
    let maxY = 1;
    for (const s of strokes) {
      if (s?.boundingBox && typeof s.boundingBox.y1 === 'number') {
        maxY = Math.max(maxY, s.boundingBox.y1);
      } else if (Array.isArray(s?.points)) {
        for (const pt of s.points) {
          const py = Array.isArray(pt) ? pt[1] : (pt?.y ?? 0);
          maxY = Math.max(maxY, py);
        }
      } else if (s?.start && Array.isArray(s?.segments)) {
        maxY = Math.max(maxY, s.start.y || 0);
        for (const seg of s.segments) {
          if (seg?.end?.y) maxY = Math.max(maxY, seg.end.y);
        }
      }
    }

    let extraBottomPadding = 0;
    if (maxY > 1.0) {
      // Stroke extends below the text container: pad card dynamically
      extraBottomPadding = Math.ceil((maxY - 1.0) * 32) + 12;
    } else if (maxY > 0.82) {
      extraBottomPadding = 8;
    }

    const minHeight = Math.max(64, Math.ceil(maxY * 90) + 16);
    return { maxY, extraBottomPadding, minHeight };
  }

  function handleStrokesChanged(newStrokes: StrokeElement[]) {
    if (isStrokeUndoRedo) {
      isStrokeUndoRedo = false;
      return;
    }
    const nextHist = strokeHistory.slice(0, strokeHistoryIndex + 1);
    nextHist.push([...newStrokes]);
    strokeHistory = nextHist;
    strokeHistoryIndex = strokeHistory.length - 1;
    currentStrokes = newStrokes;
    sketchUndoLog = [...sketchUndoLog, DRAFT_TARGET];
    sketchRedoLog = [];
  }

  function handleSketchUndo() {
    const last = sketchUndoLog[sketchUndoLog.length - 1];
    if (last && last !== DRAFT_TARGET) {
      const list = pendingMarks[last] ?? [];
      const removed = list[list.length - 1];
      sketchUndoLog = sketchUndoLog.slice(0, -1);
      if (removed) {
        pendingMarks = { ...pendingMarks, [last]: list.slice(0, -1) };
        sketchRedoLog = [...sketchRedoLog, { target: last, stroke: removed }];
      }
      return;
    }
    if (strokeHistoryIndex > 0) {
      strokeHistoryIndex--;
      currentStrokes = [...strokeHistory[strokeHistoryIndex]];
      if (last === DRAFT_TARGET) sketchUndoLog = sketchUndoLog.slice(0, -1);
      sketchRedoLog = [...sketchRedoLog, { target: DRAFT_TARGET }];
    }
  }

  function handleSketchRedo() {
    const next = sketchRedoLog[sketchRedoLog.length - 1];
    if (next && next.target !== DRAFT_TARGET && next.stroke) {
      sketchRedoLog = sketchRedoLog.slice(0, -1);
      pendingMarks = { ...pendingMarks, [next.target]: [...(pendingMarks[next.target] ?? []), next.stroke] };
      sketchUndoLog = [...sketchUndoLog, next.target];
      return;
    }
    if (strokeHistoryIndex < strokeHistory.length - 1) {
      strokeHistoryIndex++;
      currentStrokes = [...strokeHistory[strokeHistoryIndex]];
      if (next) sketchRedoLog = sketchRedoLog.slice(0, -1);
      sketchUndoLog = [...sketchUndoLog, DRAFT_TARGET];
    }
  }

  function clearStrokes() {
    currentStrokes = [];
    handleStrokesChanged([]);
  }

  let canvasZoom = $state(1.0);
  let canvasPanX = $state(0);
  let canvasPanY = $state(0);
  let isPinching = $state(false);

  let lockedSketchScrollTop: number | null = null;

  function handleCanvasTransform(scale: number, panX: number, panY: number, pinching: boolean) {
    canvasZoom = scale;
    canvasPanX = panX;
    canvasPanY = panY;
    isPinching = pinching;
  }

  function toggleSketchMode() {
    const savedScroll = messagesContainer ? messagesContainer.scrollTop : 0;
    isSketchMode = !isSketchMode;
    cancelScrollAnim();
    if (isSketchMode) {
      lockedSketchScrollTop = savedScroll;
      showFormattingPanel = false;
      showContextMenu = false;
      if (messagesContainer) {
        messagesContainer.scrollTop = savedScroll;
      }
    } else {
      lockedSketchScrollTop = null;
      canvasZoom = 1.0;
      canvasPanX = 0;
      canvasPanY = 0;
      isPinching = false;
    }
  }

  // Voice Recording state & Analyser variables
  let isRecording = $state(false);
  let recordingDuration = $state(0);
  let recordingWaveform = $state<number[]>([]);
  let recordingInterval: any = null;
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;

  // Start Voice Recording
  async function startRecording() {
    try {
      try {
        audioPlaybackService.pause();
      } catch (e) {
        console.warn('Could not pause audio playback on start recording:', e);
      }
      isRecording = true;
      recordingDuration = 0;
      recordingWaveform = [];
      audioChunks = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Determine best audio codec
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
        // Stop all tracks on the stream
        stream.getTracks().forEach(track => track.stop());
        
        if (audioChunks.length === 0) return;

        const audioBlob = new Blob(audioChunks, { type: mimeType });
        if (audioBlob.size < 100) return; // ignore tiny files

        try {
           await messagingService.sendVoiceMessage(activeConversationId, audioBlob, recordingDuration, recordingWaveform);
           ensureRealConversationId();
        } catch (uploadErr) {
          console.error('Failed to send voice message:', uploadErr);
          triggerNotification("Upload Failed", { body: "Could not upload voice message.", type: 'error' });
        }
      };

      // Set up real-time Web Audio API amplitude analyser
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
          
          if (analyser) {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let j = 0; j < bufferLength; j++) {
              sum += dataArray[j];
            }
            const average = sum / bufferLength;
            // map amplitude to range [15, 95]
            const amplitude = Math.max(15, Math.min(95, Math.round((average / 128) * 80) + 15));
            recordingWaveform = [...recordingWaveform, amplitude];
          }
        }, 250);
      } catch (audioContextError) {
        console.warn('AudioContext failed, falling back to random visual wave:', audioContextError);
        recordingInterval = setInterval(() => {
          recordingDuration += 0.25;
          const amplitude = Math.abs(Math.sin(recordingDuration * 1.5)) * 60 + 20;
          recordingWaveform = [...recordingWaveform, Math.round(amplitude)];
        }, 250);
      }

      mediaRecorder.start(1000); // 1-second chunks to ensure data availability on strict browsers
    } catch (err: any) {
      console.error('Failed to start voice message recording:', err);
      isRecording = false;
      triggerNotification("Recording Failed", { body: "Microphone access is required to record voice messages.", type: 'error' });
    }
  }

  // Stop & Send
  function stopAndSendRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    clearInterval(recordingInterval);
    if (audioContext) {
      audioContext.close();
    }
    isRecording = false;
  }

  // Discard Recording
  function discardRecording() {
    audioChunks = [];
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    clearInterval(recordingInterval);
    if (audioContext) {
      audioContext.close();
    }
    isRecording = false;
  }

  // Format recording time
  function formatTime(secs: number): string {
    if (isNaN(secs) || secs === Infinity) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  const openMathCanvas = () => {
    activeMathDocument = null;
    activeMathMessage = null;
    isMathCanvasOpen = true;
    mathFormula = '';
    eraserMode = false;
    tick().then(() => {
      if (mathCanvasEl) {
        mathCanvasEl.width = 600;
        mathCanvasEl.height = 360;
        const ctx = mathCanvasEl.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, mathCanvasEl.width, mathCanvasEl.height);
        }
      }
    });
  };

  const openCanvas = async (message: any) => {
    if (!message || !message.mathMeta) return;
    try {
      activeMathMessage = message;
      triggerNotification('Downloading Canvas', { body: 'Fetching whiteboard content...', type: 'info' });
      
      const mathMeta = message.mathMeta;
      const versionChain = mathMeta.versionChainIds || [mathMeta.documentId];
      const versionFileChain = mathMeta.versionFileIds || [mathMeta.fileId];
      const versionAudioChain = mathMeta.versionAudioIds || Array(versionFileChain.length).fill("");
      
      // Load user's last seen version index from localStorage
      const storageKey = `last_seen_${message.id}_${currentUserId}`;
      let lastIndexVal = localStorage.getItem(storageKey);
      let targetIndex = lastIndexVal !== null ? parseInt(lastIndexVal, 10) : 0;
      if (isNaN(targetIndex) || targetIndex < 0 || targetIndex >= versionChain.length) {
         targetIndex = versionChain.length - 1; // Default to latest
      }

      // If "autoShowLatest" is true, load the latest version
      const autoShowLatestKey = `auto_show_latest_${currentUserId}`;
      const autoShowLatest = localStorage.getItem(autoShowLatestKey) === 'true';
      if (autoShowLatest) {
         targetIndex = versionChain.length - 1;
      }
      
      const fileIdToLoad = versionFileChain[targetIndex] || mathMeta.fileId;
      const doc = await downloadMathDocument(fileIdToLoad);
      // Map version info from metadata
      doc.versionChainIds = versionChain;
      doc.versionFileIds = versionFileChain;
      doc.versionAudioIds = versionAudioChain;
      doc.versionAuthorIds = mathMeta.versionAuthorIds || [currentUserId];
      doc.versionAuthorNames = mathMeta.versionAuthorNames || ['Unknown'];
      doc.currentVersionIndex = targetIndex;
      activeMathDocument = doc;
      isMathCanvasOpen = true;
      triggerNotification('Canvas Loaded', { body: 'Whiteboard opened successfully!', type: 'success' });
    } catch (err) {
      console.error('Failed to open canvas document:', err);
      triggerNotification('Load Error', { body: 'Could not fetch sandbox document. Opening fresh.', type: 'error' });
      activeMathDocument = null;
      activeMathMessage = null;
      isMathCanvasOpen = true;
    }
  };

  const startDrawing = (e: MouseEvent | TouchEvent) => {
    isDrawing = true;
    if (!mathCanvasEl) return;
    canvasContext = mathCanvasEl.getContext('2d');
    if (!canvasContext) return;
    
    canvasContext.beginPath();
    const coords = getCanvasCoords(e);
    canvasContext.moveTo(coords.x, coords.y);
  };

  const draw = (e: MouseEvent | TouchEvent) => {
    if (!isDrawing || !mathCanvasEl || !canvasContext) return;
    e.preventDefault();
    
    const coords = getCanvasCoords(e);
    
    canvasContext.lineWidth = penWidth;
    canvasContext.lineCap = 'round';
    canvasContext.lineJoin = 'round';
    canvasContext.strokeStyle = eraserMode ? '#ffffff' : penColor;
    
    canvasContext.lineTo(coords.x, coords.y);
    canvasContext.stroke();
  };

  const saveSketchState = () => {
    if (!mathCanvasEl || !canvasContext) return;
    const imageData = canvasContext.getImageData(0, 0, mathCanvasEl.width, mathCanvasEl.height);
    sketchHistory = sketchHistory.slice(0, sketchHistoryIndex + 1);
    sketchHistory.push(imageData);
    sketchHistoryIndex++;
  };



  const stopDrawing = () => {
    if (isDrawing) {
      isDrawing = false;
      saveSketchState();
    }
  };

  const getCanvasCoords = (e: MouseEvent | TouchEvent): { x: number; y: number } => {
    if (!mathCanvasEl) return { x: 0, y: 0 };
    const rect = mathCanvasEl.getBoundingClientRect();
    
    let clientX = 0;
    let clientY = 0;
    
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: ((clientX - rect.left) / rect.width) * mathCanvasEl.width,
      y: ((clientY - rect.top) / rect.height) * mathCanvasEl.height
    };
  };

  const clearCanvas = () => {
    if (!mathCanvasEl) return;
    const ctx = mathCanvasEl.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, mathCanvasEl.width, mathCanvasEl.height);
  };

  const insertMathSymbol = (sym: string) => {
    mathFormula += sym;
  };

  const isCanvasBlank = (canvas: HTMLCanvasElement): boolean => {
    const context = canvas.getContext('2d');
    if (!context) return true;
    
    const buffer = new Uint32Array(
      context.getImageData(0, 0, canvas.width, canvas.height).data.buffer
    );
    
    return !buffer.some(color => color !== 0xFFFFFFFF);
  };

  const sendMathMessage = async () => {
    isMathCanvasOpen = false;
    let sketchUrl = '';
    
    if (mathCanvasEl) {
      const isBlank = isCanvasBlank(mathCanvasEl);
      if (!isBlank) {
        sketchUrl = mathCanvasEl.toDataURL('image/png');
      }
    }
    
    if (!mathFormula.trim() && !sketchUrl) {
      triggerNotification("Empty Message", { body: "Please draw something or type an equation.", type: 'warning' });
      return;
    }
    
    let attachments = [];
    if (sketchUrl) {
      attachments.push({
        type: 'math_sketch',
        url: sketchUrl
      });
    }
    
    if (replyingToMessage) {
      attachments.push({
        type: 'reply',
        replyToId: replyingToMessage.id,
        replyToSenderId: replyingToMessage.sender_id || replyingToMessage.senderId,
        replyToContent: replyingToMessage.content,
        replyToType: replyingToMessage.type
      });
      replyingToMessage = null;
    }
    
    try {
      await messagingService.sendMessage(activeConversationId, mathFormula, 'math', attachments);
      ensureRealConversationId();
    } catch (err: any) {
      console.error('Failed to send math message:', err);
      triggerNotification("Send Failed", { body: err.message || "Math message could not be sent", type: 'error' });
    }
  };

  const mathSymbols = [
    { label: '+', value: ' + ' },
    { label: '−', value: ' − ' },
    { label: '×', value: ' × ' },
    { label: '÷', value: ' ÷ ' },
    { label: '=', value: ' = ' },
    { label: '≠', value: ' ≠ ' },
    { label: '±', value: ' ± ' },
    { label: 'x²', value: '²' },
    { label: 'x^y', value: '^' },
    { label: '√x', value: '√' },
    { label: 'π', value: 'π' },
    { label: 'θ', value: 'θ' },
    { label: 'α', value: 'α' },
    { label: 'β', value: 'β' },
    { label: 'λ', value: 'λ' },
    { label: '∫', value: '∫' },
    { label: '∑', value: '∑' },
    { label: '∞', value: '∞' },
    { label: '(', value: '(' },
    { label: ')', value: ')' }
  ];

  // Image Zoom State
  let zoomedImageId = $state<string | null>(null);

  // Attachment Menu
  let showAttachmentMenu = $state(false);
  let replyingToMessage = $state<any | null>(null);

  const setReplyingTo = (message: any) => {
    replyingToMessage = message;
    tick().then(() => {
      const inputEl = document.querySelector('input[type="text"]') as HTMLInputElement;
      if (inputEl) inputEl.focus();
    });
  };



  let highlightedMessageId = $state<string | null>(null);

  // Pinned List logic
  let showPinnedList = $state(false);
  const pinnedMessages = $derived(messages.filter(m => m.is_pinned));
  const lastPinnedMessage = $derived(pinnedMessages[pinnedMessages.length - 1]);

  // Swipe logic
  let swipingMessageId = $state<string | null>(null);
  let swipingPinnedId = $state<string | null>(null);
  let swipingAllPins = $state(false);
  let swipingUndo = $state(false);
  let swipeDistance = $state(0);
  let swipeDirection = $state<'left' | 'right' | null>(null);
  let startX = 0;
  let startY = 0;
  let isVerticalScroll = false;
  let isGestureConfirmed = false;

  // Undo state
  let lastDeletedMessage = $state<any>(null);
  let undoTimeout: any = null;

  // Long press logic
  let pressTimer: any = null;

  // Media swiping logic
  const mediaMessages = $derived.by(() => {
    if (messages.length === 0) return [];
    return messages.filter(m => {
       const mt = m.type?.startsWith('f:') ? m.type.substring(2) : m.type;
       return mt === 'image' || m.attachments?.some((a: any) => typeof a === 'object' && (a.type === 'image' || a.type === 'video'));
    });
  });
  const currentMediaIndex = $derived(mediaMessages.findIndex(m => m.id === zoomedImageId));

  let lastTapTime = 0;
  let lastTouchDblTapTime = 0;

  function handleTouchStart(e: TouchEvent, id: string | 'all' | 'undo', type: 'msg' | 'pin' | 'all' | 'undo' = 'msg') {
    if (isSketchMode) return;
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTapTime;
    if (tapLength < 300 && tapLength > 0) {
      lastTouchDblTapTime = currentTime;
      showMathKeyboard = !showMathKeyboard;
      if (showMathKeyboard) {
        hasSeenTypingInstructions = true;
        tick().then(() => {
          textareaEl?.focus();
          scrollToBottom('smooth');
          setTimeout(() => scrollToBottom('smooth'), 150);
          setTimeout(() => scrollToBottom('smooth'), 350);
        });
      }
    }
    lastTapTime = currentTime;

    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isVerticalScroll = false;
    isGestureConfirmed = false;
    swipeDirection = null;
    swipeDistance = 0;
    if (type === 'pin') {
      swipingPinnedId = id === 'all' ? null : id;
    } else if (type === 'all') {
      swipingAllPins = true;
    } else if (type === 'undo') {
      swipingUndo = true;
    } else {
      swipingMessageId = id === 'all' ? null : id;
    }
    
    // Long press detection (only for chat messages)
    if (type === 'msg' && id !== 'all' && id !== 'undo') {
      pressTimer = setTimeout(() => {
        handlePin(id);
      }, 600);
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (!swipingMessageId && !swipingPinnedId && !swipingAllPins && !swipingUndo) return;
    if (isVerticalScroll) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startX;
    const diffY = currentY - startY;
    const absX = Math.abs(diffX);
    const absY = Math.abs(diffY);
    
    // Message swiping with strict anti-wobble and 30px resistance threshold
    if (swipingMessageId) {
      if (!isGestureConfirmed) {
        // If movement is predominantly vertical, lock out swiping to allow natural smooth scrolling
        if (absY > absX && absY > 8) {
          isVerticalScroll = true;
          swipingMessageId = null;
          swipeDistance = 0;
          swipeDirection = null;
          return;
        }

        // 30px initial resistance threshold: card stays completely stationary
        if (absX < 30) {
          swipeDistance = 0;
          return;
        }

        // Horizontal gesture confirmed past threshold
        isGestureConfirmed = true;
        clearTimeout(pressTimer);
      }

      // Card only translates horizontally after crossing the 30px threshold
      const effectiveDiff = absX - 30;
      swipeDirection = diffX < 0 ? 'left' : 'right';
      swipeDistance = Math.min(effectiveDiff * 1.15, 120);
    } else if (swipingPinnedId || swipingAllPins) {
      if (diffX < 0) {
        swipeDirection = 'left';
        swipeDistance = Math.min(absX, 120);
      }
    } 
    // Undo swiping (Right swipe = positive diff)
    else if (swipingUndo) {
      if (diffX > 0) {
        swipeDirection = 'right';
        swipeDistance = Math.min(diffX, 120);
      }
    }
  }

  async function handleTouchEnd() {
    clearTimeout(pressTimer);
    const dist = swipeDistance;
    const msgId = swipingMessageId;
    const pinId = swipingPinnedId;
    const isAll = swipingAllPins;
    const isUndo = swipingUndo;
    const dir = swipeDirection;

    // Left swipe actions (Delete/Unpin)
    if (dir === 'left' && (msgId || pinId || isAll)) {
      if (msgId) {
        if (dist >= 50) await handleDelete(msgId);
      } else if (pinId && dist > 40) {
        await handlePin(pinId);
      } else if (isAll && dist > 40) {
        await handleClearAllPins();
      }
    }
    // Right swipe actions (Undo/Reply)
    else if (dir === 'right') {
      if (msgId && dist >= 45) {
        const msgObject = messages.find(m => m.id === msgId);
        if (msgObject) {
          setReplyingTo(msgObject);
        }
      } else if (isUndo && dist > 80) {
        await handleUndo();
      }
    }
    
    // Reset state
    swipingMessageId = null;
    swipingPinnedId = null;
    swipingAllPins = false;
    swipingUndo = false;
    swipeDistance = 0;
    swipeDirection = null;
    isVerticalScroll = false;
    isGestureConfirmed = false;
  }

  async function handleDelete(id: string) {
    const msgToDelete = messages.find(m => m.id === id);
    if (msgToDelete) {
      lastDeletedMessage = JSON.parse(JSON.stringify(msgToDelete));
      if (undoTimeout) clearTimeout(undoTimeout);
      undoTimeout = setTimeout(() => { lastDeletedMessage = null; }, 5000);
      
      await messagingService.deleteMessage(id);
      triggerNotification("Deleted", { body: "Message removed. Swipe right to undo.", type: 'info' });
    }
  }

  async function handleUndo() {
    if (lastDeletedMessage) {
      await messagingService.restoreMessage(lastDeletedMessage);
      lastDeletedMessage = null;
      if (undoTimeout) clearTimeout(undoTimeout);
      triggerNotification("Restored", { body: "Message restored", type: 'success' });
    }
  }

  async function handleClearAllPins() {
    if (confirm('Unpin all messages?')) {
      for (const pm of pinnedMessages) {
        await messagingService.pinMessage(pm.id);
      }
      showPinnedList = false;
    }
  }

  async function handlePin(id: string) {
    const msgToPin = messages.find(m => m.id === id);
    const wasPinned = msgToPin?.is_pinned;
    await messagingService.pinMessage(id);
    triggerNotification(!wasPinned ? "Pinned" : "Unpinned", { 
      body: !wasPinned ? "Added to pins" : "Removed from pins", 
      type: 'info' 
    });
  }

  function handleShare(m: any) {
    if (navigator.share) {
      navigator.share({
        title: 'Share Message',
        text: m.content || 'Check out this message from Exup',
        url: window.location.href
      }).catch(err => {
        if (err.name !== 'AbortError' && !err.message?.includes('Share canceled')) {
          console.error('Share failed:', err);
        }
      });
    } else {
      triggerNotification("Share", { body: "Sharing not supported on this browser", type: 'warning' });
    }
  }

  function navigateMedia(dir: number) {
    const nextIdx = currentMediaIndex + dir;
    if (nextIdx >= 0 && nextIdx < mediaMessages.length) {
      zoomedImageId = mediaMessages[nextIdx].id;
    }
  }



  let isInitialLoad = true;

  // Optimized scroll handler to reduce CPU usage
  let scrollTimeout: any;
  const handleScroll = (e: any) => {
    lastScrollTimestamp = Date.now();
    if (touchGestureType === 'undetermined') {
      touchGestureType = 'scroll';
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }
    const el = e.target;
    
    if (isSketchMode && lockedSketchScrollTop !== null && messagesContainer) {
      if (messagesContainer.scrollTop !== lockedSketchScrollTop) {
        messagesContainer.scrollTop = lockedSketchScrollTop;
      }
      return;
    }

    // Responsive scroll logic with low-latency throttle
    if (scrollTimeout) return;
    scrollTimeout = setTimeout(() => {
      scrollTimeout = null;
      const threshold = 100;
      const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      
      isNearBottom = distanceToBottom < threshold;
      
      if (isNearBottom) {
        showNewMsgBtn = false;
        unreadCountBelow = 0;
      } else {
        showNewMsgBtn = true;
      }
    }, 50);
  };

  // Handle Case where conversationId prop changes OR on initial mount
  let lastProcessedProp = '';
  $effect(() => {
    if (conversationId && conversationId !== lastProcessedProp) {
        lastProcessedProp = conversationId;
        isInitialScrollDone = false;
        showNewMsgBtn = false;
        unreadCountBelow = 0;
        stagedImages = [];
        selectedDraftImageId = null;
        lastSelectedDraftImageId = null;
        focusedGapImageId = null;
        
        // Fast-path: check in-memory cache first for instant 0ms render
        const memCached = messagingService.getCachedMessages(conversationId);
        if (memCached && memCached.length > 0) {
          messages = memCached;
          isLoading = false;
          isInitialLoadDone = true;
        }

        // Check local database cache to ensure messages in local DB are displayed immediately
        dbService.getMessages(conversationId).then(cached => {
          if (cached && cached.length > 0) {
            messages = cached;
            messagingService.setCachedMessages(conversationId, cached);
            isLoading = false;
            isInitialLoadDone = true;
          } else if (messages.length === 0) {
            isLoading = false;
          }
        }).catch(() => {
          if (messages.length === 0) isLoading = false;
        });
        
        // Re-run resolution if needed
        if (conversationId.startsWith('user_')) {
            const actualUserId = conversationId.replace('user_', '');
            partnerUserId = actualUserId;
            
            // Immediately set a placeholder while resolving
            activeConversationId = `local_convo_${actualUserId}`;
            
            authService.getCurrentUser().then(user => {
               if (!user) return;
               dbService.getRawDB().then(db => {
                  db.participants.find({
                    selector: { userId: user.$id }
                  }).exec().then(participations => {
                     let existingConvoId = null as string | null;
                     const checkPromises = participations.map(async p => {
                        const otherPart = await db.participants.findOne({
                           selector: { conversationId: p.conversationId, userId: actualUserId }
                        }).exec();
                        if (otherPart) {
                           const convoDoc = await db.conversations.findOne(p.conversationId).exec();
                           if (convoDoc && !convoDoc.isGroup) {
                             existingConvoId = p.conversationId as string;
                             if (messagingService.isConversationDeleted(p.conversationId)) {
                               messagingService.restoreConversation(p.conversationId);
                               const newDeletedAt = new Date().toISOString();
                               dbService.safePatchParticipant(p.id || p.$id, { isDeleted: false });
                               
                               // Also push this to Supabase so other clients realize it's restored
                               try {
                                  supabaseAdmin
                                    .from("participants")
                                    .update({ is_deleted: false })
                                    .eq("id", p.id || p.$id)
                                    .then(() => {});
                               } catch (e) {}
                             }
                           }
                        }
                     });
                     
                     Promise.all(checkPromises).then(() => {
                        if (existingConvoId) {
                           activeConversationId = existingConvoId;
                        } 
                        
                        // Also trigger messages sync
                        messagingService.getMessages(activeConversationId).then(msgs => {
                           isNewChat = msgs.length === 0;
                        }).catch(() => {});
                     });
                  });
               });
            });
            
        } else {
            activeConversationId = conversationId;
            messagingService.getMessages(conversationId).then(msgs => {
              isNewChat = msgs.length === 0;
            }).catch(() => {});
        }
    }
  });

  // Reactive Message Subscription
  $effect(() => {
    let sub: any = null;
    let convoToWatch = activeConversationId;
    
    if (convoToWatch && currentUserId) {
        dbService.getMessages$(convoToWatch).then(messages$ => {
          if (sub) sub.unsubscribe();
          sub = messages$.subscribe(latest => {
            // Prevent flicker from the old subscription when messages are migrated out
            if (isElevating && convoToWatch.startsWith('local_convo_') && latest.length === 0 && messages.length > 0) {
               return; 
            }
            // Prevent flicker from the new subscription's initial empty state
            if (elevatingToId === convoToWatch && latest.length === 0 && messages.length > 0) {
               return; 
            }
            if (elevatingToId === convoToWatch && latest.length > 0) {
               elevatingToId = null; // Successfully received elevated messages
            }
            
            // Map and normalize incoming docs from RxDB
            const normalizedLatest = latest.map(m => {
              const data = typeof m.toJSON === 'function' ? m.toJSON() : { ...m };
              
              // Ensure every message has a stable id field
              // RxDB uses _id as primary key, so fall back to that if id is missing
              if (!data.id && data._id) {
                data.id = data._id;
              }
              if (!data.id && m.id) {
                data.id = m.id;
              }
              if (!data.id && m._id) {
                data.id = m._id;
              }
              
              if (data.type?.startsWith('f:')) {
                try {
                  const contentObj = JSON.parse(data.content);
                  if (contentObj.a && Array.isArray(contentObj.a)) {
                     data.attachments = contentObj.a;
                  }
                  if (contentObj.c) {
                     data.content = contentObj.c;
                  }
                } catch (e) {
                   // Not JSON or parsing failed, fallback gracefully
                }
              }
              
              if (!data.attachments) data.attachments = [];
              if (data.attachments.length === 0) {
                if (data.type === 'f:image') {
                  data.attachments = [{
                    type: 'image',
                    fileId: 'fallback_' + data.id,
                    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23eeeeee"/><text x="50%" y="54%" font-family="sans-serif" font-size="12" fill="%23888888" dominant-baseline="middle" text-anchor="middle">Image</text></svg>'
                  }];
                } else if (data.type === 'f:audio') {
                  data.attachments = [{
                    type: 'audio',
                    fileId: 'fallback_' + data.id,
                    url: 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU5LjI3LjEwMAAAAAAAAAAAAAAA//OEwAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqo=',
                    duration: 3,
                    waveform: Array.from({length: 20}, () => Math.floor(Math.random() * 40) + 10)
                  }];
                } else if (data.type === 'f:video') {
                  data.attachments = [{
                    type: 'video',
                    fileId: 'fallback_' + data.id,
                    url: '',
                    duration: 3
                  }];
                }
              } else {
                data.attachments.forEach((att: any) => {
                  if (att.type === 'image') {
                    if (!att.url || att.url.length < 5) {
                      att.url = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23eeeeee"/><text x="50%" y="54%" font-family="sans-serif" font-size="12" fill="%23888888" dominant-baseline="middle" text-anchor="middle">Image</text></svg>';
                    }
                  }
                });
              }
              return data;
            });

            const latestMap = new Map(normalizedLatest.map(m => [m.id || m._id, m]));

            // Seamless Optimistic UI:
            // Retain any in-flight optimistic messages so the sent bubble never disappears
            // between clicking send and database/upload acknowledgement!
            const pendingOptimistic = messages.filter(m => m._isOptimistic && !latestMap.has(m.id || m._id));

            // Merge confirmed messages with any corresponding optimistic message in local state
            // to preserve rich styling, strokes, and attachments smoothly
            const confirmedMerged = normalizedLatest.map(doc => {
              const docId = doc.id || doc._id;
              const existingOpt = messages.find(m => (m.id || m._id) === docId);
              if (existingOpt) {
                return {
                  ...existingOpt,
                  ...doc,
                  id: docId,
                  _isOptimistic: false,
                  attachments: (doc.attachments && doc.attachments.length > 0) ? doc.attachments : (existingOpt.attachments || []),
                  mathMeta: doc.mathMeta || existingOpt.mathMeta || existingOpt.math_meta,
                  strokes: (doc.strokes && doc.strokes.length > 0) ? doc.strokes : (existingOpt.strokes || [])
                };
              }
              return doc;
            });

            const combined = [...confirmedMerged, ...pendingOptimistic];
            combined.sort((a, b) => {
              const timeA = new Date(a.createdAt ?? a.created_at ?? 0).getTime();
              const timeB = new Date(b.createdAt ?? b.created_at ?? 0).getTime();
              return timeA - timeB;
            });

            messages = combined;
            messagingService.setCachedMessages(convoToWatch, combined);

            isLoading = false;
            isInitialLoadDone = true;
          });
        });
    }

    return () => {
      if (sub) {
        if (typeof sub === 'function') sub();
        else if (sub.unsubscribe) sub.unsubscribe();
      }
    };
  });

  let myProfile = $state<any>(null);

  onMount(async () => {
    document.addEventListener('focusin', lockNativeKeyboard, true);
    document.addEventListener('selectionchange', handleSelectionChange);
    try {
      const user = await authService.getCurrentUser();
      currentUserId = user?.$id || '';
      if (currentUserId) {
        authService.getProfile(currentUserId).then(p => {
          myProfile = p;
        });
      }
      currentUserName = user?.prefs?.fullName || user?.profile?.fullName || user?.prefs?.lastName || user?.name || 'Learner';
      
      let initialConvoId = activeConversationId;

      // Handle case where userId was passed instead of conversationId
      const isUserIdPrefix = conversationId && conversationId.startsWith('user_');
      if (isUserIdPrefix) {
          const actualUserId = conversationId.replace('user_', '');
          console.log('ChatWindow: Resolving userId to conversationId:', actualUserId);
          
          partnerUserId = actualUserId;
          
          const db = await dbService.getRawDB();
          const participations = await db.participants.find({
            selector: { userId: currentUserId }
          }).exec();
          
          let existingConvoId = null;
          for (const p of participations) {
            const otherPart = await db.participants.findOne({
              selector: { conversationId: p.conversationId, userId: actualUserId }
            }).exec();
            if (otherPart) {
               const convoDoc = await db.conversations.findOne(p.conversationId).exec();
               if (convoDoc && !convoDoc.isGroup) {
                 existingConvoId = p.conversationId;
                 // If marked deleted, restore it immediately to prevent duplicate races
                 const checkConvoId = p.conversation_id || p.conversationId;
                 if (messagingService.isConversationDeleted(checkConvoId)) {
                   console.log('ChatWindow: Restoring matched conversation from deleted status:', checkConvoId);
                   messagingService.restoreConversation(checkConvoId);
                   const newDeletedAt = new Date().toISOString();
                    dbService.safePatchParticipant(p.id || p.$id, { is_deleted: false, isDeleted: false });
                   
                     try {
                        supabaseAdmin
                          .from("participants")
                          .update({ is_deleted: false })
                          .eq("id", p.id || p.$id)
                          .then(() => {});
                     } catch (e) {}
                 }
                 break;
               }
            }
          }

          if (existingConvoId) {
             activeConversationId = existingConvoId;
          } else {
             activeConversationId = `local_convo_${actualUserId}`;
             
             
          }
          
          // Show placeholder immediately if we're resolving a user
          isLoading = false;
          isInitialLoadDone = true;
      }

      const db = await dbService.getRawDB();
      const currentConvoId = activeConversationId;
      
      // Fetch participant info for lastReadAt
      const participant = await db.participants.findOne({
        selector: { conversationId: currentConvoId, userId: currentUserId }
      }).exec();
      
      if (participant) {
        participantLastReadAt = participant.lastReadAt || participant.last_read_at || '1970-01-01T00:00:00.000Z';
      }

      // Trigger background sync with a small delay for smoother transition
      isSyncing = true;
      messagingService.getMessages(currentConvoId).then(msgs => {
         if (msgs.length === 0) {
            // If local and remote both return nothing, it's definitely a new chat
            isNewChat = true;
            isLoading = false;
         } else {
            isNewChat = false;
         }
         isInitialLoadDone = true;
         isSyncing = false;
      }).catch(() => {
         isSyncing = false;
         if (messages.length === 0) isLoading = false;
      });
    } catch (err) {
      console.error('Failed to init chat window:', err);
      isLoading = false;
      isInitialLoadDone = true;
    }
  });

  function handleNativeBack(e: Event) {
    if (showMathKeyboard) {
      e.preventDefault();
      showMathKeyboard = false;
    }
  }

  $effect(() => {
    window.addEventListener(NATIVE_BACK_EVENT, handleNativeBack);
    return () => window.removeEventListener(NATIVE_BACK_EVENT, handleNativeBack);
  });

  $effect(() => {
    if (showMathKeyboard) hideSystemKeyboard();
  });



  onDestroy(() => {
    document.removeEventListener('focusin', lockNativeKeyboard, true);
    document.removeEventListener('selectionchange', handleSelectionChange);
    if (activeConversationId && activeConversationId.startsWith('local_convo_')) {
      activeConversationId = '';
    }
    if (typingTimer) clearTimeout(typingTimer);
    if (isCurrentlyTyping) {
      messagingService.sendTypingIndicator(activeConversationId, false);
    }
    subscriptions.forEach(sub => {
      if (typeof sub === 'function') sub();
      else if (sub && typeof sub.unsubscribe === 'function') sub.unsubscribe();
    });
    audioPlaybackService.stop();
    clearInterval(recordingInterval);
    if (audioContext) {
      audioContext.close();
    }
  });

  let draftBubbleEl = $state<HTMLDivElement | null>(null);
  let activeScrollAnim: number | null = null;

  const cancelScrollAnim = () => {
    if (activeScrollAnim !== null) {
      cancelAnimationFrame(activeScrollAnim);
      activeScrollAnim = null;
    }
  };

  const snappyScrollTo = (element: HTMLElement, targetTop: number, isInstant = false) => {
    if (isSketchMode) return;
    cancelScrollAnim();

    if (isInstant) {
      element.scrollTop = targetTop;
      return;
    }

    const startTop = element.scrollTop;
    const distance = targetTop - startTop;
    if (Math.abs(distance) < 2) {
      element.scrollTop = targetTop;
      return;
    }

    const duration = 180; // Fast 180ms - snappy but smooth
    const startTime = performance.now();

    // Fast, responsive ease-out curve
    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuart(progress);
      
      element.scrollTop = startTop + distance * easedProgress;

      if (progress < 1) {
        activeScrollAnim = requestAnimationFrame(step);
      } else {
        element.scrollTop = targetTop;
        activeScrollAnim = null;
      }
    };

    activeScrollAnim = requestAnimationFrame(step);
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth', forceBottom = false) => {
    if (isSketchMode) return;
    tick().then(() => {
      if (messagesContainer) {
        const isInstant = behavior === 'instant' || forceBottom;
        if (!forceBottom && showMathKeyboard && draftBubbleEl) {
           const clientHeight = messagesContainer.clientHeight;
           const visibleHeight = clientHeight - 360; // Approximate visible area above keyboard
           const bubbleTop = draftBubbleEl.offsetTop;
           const bubbleHeight = draftBubbleEl.offsetHeight;
           const bubbleBottom = bubbleTop + bubbleHeight;
           
           let targetScroll = bubbleTop - 84; // Default: 3 lines down from header
           const bottomLeeway = 84; // 3 lines of leeway at the bottom
           
           if (bubbleBottom + bottomLeeway > targetScroll + visibleHeight) {
               targetScroll = bubbleBottom + bottomLeeway - visibleHeight;
           }
           
           snappyScrollTo(messagesContainer, Math.max(0, targetScroll), isInstant);
        } else {
           if (isInstant) {
             cancelScrollAnim();
             messagesContainer.scrollTop = messagesContainer.scrollHeight;
           } else {
             const targetScroll = Math.max(0, messagesContainer.scrollHeight - messagesContainer.clientHeight);
             snappyScrollTo(messagesContainer, targetScroll, false);
           }
        }
      }
      showNewMsgBtn = false;
      unreadCountBelow = 0;
    });
  };

  const scrollToMessage = (id: string) => {
    if (!id) return;
    const el = document.getElementById(`msg-${id}`);
    if (el && messagesContainer) {
      const containerRect = messagesContainer.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const relativeTop = elRect.top - containerRect.top + messagesContainer.scrollTop;
      const targetTop = relativeTop - (containerRect.height / 2) + (elRect.height / 2);
      
      snappyScrollTo(messagesContainer, Math.max(0, targetTop));
      
      highlightedMessageId = id;
      setTimeout(() => {
        if (highlightedMessageId === id) {
          highlightedMessageId = null;
        }
      }, 1500); // 1.5 seconds highlight duration
    } else {
      console.log(`Message ${id} not found in DOM`);
    }
  };

  const retryMessageSend = async (messageId: string) => {
    try {
      await messagingService.retryMessage(messageId);
    } catch (error: any) {
      console.error('Retry message send failed:', error?.message || error);
    }
  };

  const handleSend = async () => {
    let sketchUrl = '';
    if (mathCanvasEl && isSketchMode) {
      if (!isCanvasBlank(mathCanvasEl)) {
        sketchUrl = mathCanvasEl.toDataURL('image/png');
      }
    }

    const draftStrokes = Array.isArray(currentStrokes) ? currentStrokes : [];
    const targetStrokes: StrokeElement[] = JSON.parse(JSON.stringify(Object.values(pendingMarks).flat()));
    const strokesToSend = JSON.parse(JSON.stringify(draftStrokes));
    if (!msg.trim() && !sketchUrl && strokesToSend.length === 0 && targetStrokes.length === 0 && currentTree.length === 0 && stagedImages.length === 0) return;
    const textToSend = msg.trim();
    
    // Generate stable UUID for the message - this will be the canonical ID
    // both for optimistic rendering and the final RxDB doc
    const msgId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const conversationIdForSend = activeConversationId;
    const sendStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    
    // Store current state for optimistic UI
    const treeToClear = currentTree;
    const strokesToClear = currentStrokes;
    const pathToClear = currentCursorPath;
    
    isCurrentlyTyping = false;
    if (typingTimer) clearTimeout(typingTimer);
    
    // Send typing indicator first
    messagingService.sendTypingIndicator(activeConversationId, false);

    // Handle sending staged images with captions in the gaps below
    if (stagedImages.length > 0) {
      if (focusedGapImageId) {
        const cur = stagedImages.find(i => i.id === focusedGapImageId);
        if (cur) cur.gapTextTree = [...currentTree];
      }

      const imagesToUpload = stagedImages.map(img => img.file);
      const sections = stagedImages.map((img, idx) => ({
        imageIndex: idx,
        text: serializeTree(img.gapTextTree),
        nodes: img.gapTextTree
      }));
      const combinedCaption = sections
        .map(s => s.text.trim())
        .filter(Boolean)
        .join('\n\n') || textToSend;

      stagedImages = [];
      selectedDraftImageId = null;
      lastSelectedDraftImageId = null;
      focusedGapImageId = null;

      let mathMetaToSend: any = undefined;
      if (strokesToSend.length > 0 || targetStrokes.length > 0 || (Array.isArray(treeToClear) && treeToClear.length > 0)) {
        mathMetaToSend = {
          ...(strokesToSend.length > 0 ? { strokes: strokesToSend } : {}),
          ...(targetStrokes.length > 0 ? { annotations: targetStrokes } : {}),
          ...(Array.isArray(treeToClear) && treeToClear.length > 0 ? { nodes: treeToClear } : {})
        };
      }

      // Clear draft state and exit typing mode IMMEDIATELY for instant UX
      currentTree = [];
      currentCursorPath = { containerPath: [], offset: 0 };
      currentStrokes = [];
      resetSketchState();
      strokeHistory = [[]];
      strokeHistoryIndex = 0;
      isSketchMode = false;
      isEraser = false;
      showFormattingPanel = false;
      showContextMenu = false;
      msgHistory = [''];
      historyIndex = 0;
      showMathKeyboard = false;

      cancelScrollAnim();
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }

      try {
        await messagingService.sendImageMessage(
          conversationIdForSend, 
          imagesToUpload, 
          combinedCaption, 
          mathMetaToSend,
          sections
        );
        ensureRealConversationId();
        pendingMarks = {};
      } catch (err: any) {
        console.error('Image message send failed:', err);
        triggerNotification("Send Failed", { body: err.message || "Could not send image message", type: 'error' });
      }
      return;
    }

    // Sandbox Call Demo Interceptors
    if (textToSend === '/incoming' || textToSend === '/call') {
       incomingCallDoc = {
          $id: 'sim_incoming_call',
          type: 'video',
          conversationId: activeConversationId,
          status: 'ongoing',
          initiatorId: 'peerClassmate'
       };
       triggerNotification("Incoming Call Simulated", { body: `Simulating inbound video call from ${contactName}...`, type: 'info' });
       return;
    }
    if (textToSend === '/ring') {
       incomingCallDoc = {
          $id: 'sim_incoming_call',
          type: 'audio',
          conversationId: activeConversationId,
          status: 'ongoing',
          initiatorId: 'peerClassmate'
       };
       triggerNotification("Incoming Ring Simulated", { body: `Simulating inbound voice call from ${contactName}...`, type: 'info' });
       return;
    }
    
    let attachments = [];
    if (sketchUrl) {
       attachments.push({
         type: 'math_sketch',
         url: sketchUrl
       });
    }

    if (replyingToMessage) {
      attachments.push({
        type: 'reply',
        replyToId: replyingToMessage.id,
        replyToSenderId: replyingToMessage.sender_id || replyingToMessage.senderId,
        replyToContent: replyingToMessage.content,
        replyToType: replyingToMessage.type
      });
      replyingToMessage = null;
    }

    // Attach text styling info
    if (isBold !== true || isItalic !== false || isUnderlined !== false || activeTextColorIndex !== 0) {
      attachments.push({
        type: 'style',
        color: textColors[activeTextColorIndex].value === 'default' ? null : textColors[activeTextColorIndex].value,
        isBold,
        isItalic,
        isUnderlined
      });
    }
    
    try {
      // Send as regular message with strokes in mathMeta
      const msgType = 'text';
      let mathMetaToSend: any = undefined;
      if (strokesToSend.length > 0 || targetStrokes.length > 0 || (Array.isArray(treeToClear) && treeToClear.length > 0)) {
        mathMetaToSend = {
          ...(strokesToSend.length > 0 ? { strokes: strokesToSend } : {}),
          ...(targetStrokes.length > 0 ? { annotations: targetStrokes } : {}),
          ...(Array.isArray(treeToClear) && treeToClear.length > 0 ? { nodes: treeToClear } : {})
        };
      }
      const safeAttachments = Array.isArray(attachments) ? JSON.parse(JSON.stringify(attachments)) : [];
      const safeMathMeta = mathMetaToSend && typeof mathMetaToSend === 'object' ? JSON.parse(JSON.stringify(mathMetaToSend)) : undefined;
      
      const nowIso = new Date().toISOString();
      // Add optimistic message to the list immediately with the canonical ID
      const optimisticMsg = {
        id: msgId,
        conversationId: activeConversationId,
        senderId: currentUserId,
        sender_id: currentUserId,
        content: textToSend,
        type: msgType,
        createdAt: nowIso,
        created_at: nowIso,
        status: 'pending',
        attachments: safeAttachments,
        mathMeta: safeMathMeta,
        math_meta: safeMathMeta,
        strokes: strokesToSend,
        _isOptimistic: true
      };
      messages = [...messages, optimisticMsg];
      
      // Clear draft state and exit typing mode IMMEDIATELY for instant UX
      currentTree = [];
      currentCursorPath = { containerPath: [], offset: 0 };
      currentStrokes = [];
      resetSketchState();
      strokeHistory = [[]];
      strokeHistoryIndex = 0;
      isSketchMode = false;
      isEraser = false;
      showFormattingPanel = false;
      showContextMenu = false;
      msgHistory = [''];
      historyIndex = 0;
      showMathKeyboard = false;
      
      // Instantly anchor view to bottom without any upward scroll animation
      cancelScrollAnim();
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
      tick().then(() => {
        cancelScrollAnim();
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      });
      
      // Persist locally immediately; resolve first-chat ids in parallel, then send that message directly.
      messagingService.sendMessage(conversationIdForSend, textToSend, msgType, safeAttachments, safeMathMeta, msgId, sendStartedAt)
        .then(async (result) => {
          let resolvedConversationId = conversationIdForSend;
          if (conversationIdForSend.startsWith('local_convo_')) {
            const realConversationId = await ensureRealConversationId();
            if (realConversationId && !realConversationId.startsWith('local_convo_')) {
              resolvedConversationId = realConversationId;
              try {
                await messagingService.pushPendingMessageToSupabase(msgId, realConversationId);
              } catch (error: any) {
                console.warn('First-chat message remains queued for retry:', error?.message || error);
              }
            } else {
              try {
                await messagingService.pushPendingMessageToSupabase(msgId);
              } catch (error: any) {
                console.warn('First-chat message remains queued until its conversation can be resolved:', error?.message || error);
              }
            }
          }
          messages = messages.map(m => m.id === msgId
            ? {
                ...m,
                ...result,
                id: msgId,
                status: ['sent', 'delivered', 'read'].includes(m.status) ? m.status : (result?.status || m.status || 'pending'),
                conversationId: resolvedConversationId,
                _isOptimistic: false
              }
            : m);
        })
        .catch((err: any) => {
          console.error('Local message save failed:', err);
          messages = messages.filter(m => m.id !== msgId);
          currentTree = treeToClear;
          currentCursorPath = pathToClear;
          currentStrokes = strokesToClear;
          showMathKeyboard = true;
          triggerNotification("Send Failed", { body: err.message || "Message could not be saved", type: 'error' });
        });
      
      // Start first-chat resolution as soon as possible. The send callback awaits the same promise.
      if (conversationIdForSend.startsWith('local_convo_')) void ensureRealConversationId();
      
      // Reset rich styles after successful send
      isBold = true;
      isItalic = false;
      isUnderlined = false;
      activeTextColorIndex = 0;
    } catch (err: any) {
      console.error('Send setup failed:', err);
      messages = messages.filter(m => m.id !== msgId);
      currentTree = treeToClear;
      currentCursorPath = pathToClear;
      currentStrokes = strokesToClear;
      showMathKeyboard = true;
      triggerNotification("Send Failed", { body: err.message || "Message could not be sent", type: 'error' });
    }
  };





  const requestAudioCall = async () => {
    try {
      await ensureRealConversationId();
      const { call, stream } = await webrtcService.startCall(activeConversationId, 'audio');
      activeCall = { callId: call.$id, type: 'audio', active: true, localStream: stream, remoteStreams: new Map() };
      triggerNotification("Call Started", { body: `Ringing ${contactName}...`, type: 'info' });
    } catch (err) {
      triggerNotification("Call Error", { body: "Could not start audio call.", type: 'error' });
    }
  };

  const requestVideoCall = async () => {
    try {
      await ensureRealConversationId();
      const { call, stream } = await webrtcService.startCall(activeConversationId, 'video');
      activeCall = { callId: call.$id, type: 'video', active: true, localStream: stream, remoteStreams: new Map() };
      triggerNotification("Video Call Started", { body: `Ringing ${contactName}...`, type: 'info' });
    } catch (err) {
      triggerNotification("Call Error", { body: "Could not start video call.", type: 'error' });
    }
  };

  let isMuted = $state(false);
  let isCameraOn = $state(true);

  const toggleMute = () => {
    isMuted = !isMuted;
    if (activeCall?.localStream) {
       activeCall.localStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
    }
  };

  const toggleCamera = () => {
    isCameraOn = !isCameraOn;
    if (activeCall?.localStream) {
       activeCall.localStream.getVideoTracks().forEach(t => t.enabled = isCameraOn);
    }
  };

  const endCall = () => {
    webrtcService.leaveCall();
    activeCall = null;
    incomingCallDoc = null;
    isMuted = false;
    isCameraOn = true;
  };

  const answerIncomingCall = async () => {
    if (!incomingCallDoc) return;
    try {
      const call = incomingCallDoc;
      incomingCallDoc = null;
      const stream = await webrtcService.joinCall(call.$id || call.id, call.type);
      activeCall = { callId: call.$id || call.id, type: call.type, active: true, localStream: stream, remoteStreams: new Map() };
      triggerNotification("Call Joined", { body: "You joined the call", type: 'info' });
    } catch (err: any) {
      console.error("Failed to join call:", err);
      triggerNotification("Call Error", { body: "Could not join calling session: " + err.message, type: 'error' });
    }
  };

  const declineIncomingCall = () => {
    incomingCallDoc = null;
  };

  let unsubscribeIncomingCalls: (() => void) | null = null;

  // We should initialize webrtcService somewhere. We will do it in onMount.
  onMount(() => {
    authService.getCurrentUser().then(user => {
      if (user) {
        webrtcService.init(
          user.$id,
          (uid, stream) => {
            if (activeCall) {
              const newMap = new Map(activeCall.remoteStreams);
              newMap.set(uid, stream);
              activeCall = { ...activeCall, remoteStreams: newMap };
            }
          },
          () => {
             endCall();
          }
        );

        // Listen to incoming calls
        unsubscribeIncomingCalls = webrtcService.listenForIncomingCalls(user.$id, (call) => {
          if (call.conversationId === activeConversationId && call.status === 'ongoing' && !activeCall) {
            incomingCallDoc = call;
          }
        });
      }
    });

    return () => {
      if (unsubscribeIncomingCalls) unsubscribeIncomingCalls();
    };
  });

  const setStream = (node: HTMLVideoElement, stream: MediaStream | null | undefined) => {
    if (stream) node.srcObject = stream;
    return {
      update(newStream: MediaStream | null | undefined) {
        if (newStream) node.srcObject = newStream;
      }
    };
  };

  const handleKeyup = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleSend();
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const handleAttachment = () => {
     triggerNotification("Attachment", { body: "Attachment feature coming soon!", type: 'info' });
  };

  let fetchingProfileId = $state<string | null>(null);
  let partnerUserId = $state<string | null>(null);
  let resolvedProfile = $state<any>(null); // cache

  let currentTime = $state(Date.now());
  $effect(() => {
    const interval = setInterval(() => {
      currentTime = Date.now();
    }, 15000);
    return () => clearInterval(interval);
  });
  
  let isPartnerOnline = $derived(
    resolvedProfile ? authService.computeIsOnline(resolvedProfile, currentTime) : false
  );

  $effect(() => {
    const data = profileData;
    if (data && partnerUserId && (data.userId === partnerUserId || data.user_id === partnerUserId)) {
      untrack(() => {
        if (resolvedProfile) {
          resolvedProfile.fullName = data.fullName || data.name;
          resolvedProfile.avatarUrl = data.avatarUrl;
          resolvedProfile.bio = data.bio;
          resolvedProfile.school = data.school;
          resolvedProfile.role = data.role;
          resolvedProfile.studentClass = data.studentClass;
          resolvedProfile.age = data.age;
          resolvedProfile.house = data.house;
          resolvedProfile.preferredSubjects = data.preferredSubjects;
          resolvedProfile.subjectCombination = data.subjectCombination;
          resolvedProfile.clubs = data.clubs;
          resolvedProfile.isOnline = data.isOnline;
          resolvedProfile.lastSeenAt = data.lastSeenAt;
        } else {
          resolvedProfile = {
            fullName: data.fullName || data.name,
            avatarUrl: data.avatarUrl,
            bio: data.bio,
            school: data.school,
            role: data.role,
            studentClass: data.studentClass,
            age: data.age,
            house: data.house,
            preferredSubjects: data.preferredSubjects,
            subjectCombination: data.subjectCombination,
            clubs: data.clubs,
            isOnline: data.isOnline,
            lastSeenAt: data.lastSeenAt
          };
        }
      });
    }
  });

  // Find partner userId when conversationId changes or participants loaded
  $effect(() => {
    if (activeConversationId && currentUserId) {
      if (activeConversationId.startsWith('local_convo_')) {
          partnerUserId = activeConversationId.replace('local_convo_', '');
      } else if (conversationId && conversationId.startsWith('user_')) {
          partnerUserId = conversationId.replace('user_', '');
      }
      
      dbService.getRawDB().then(db => {
        db.participants.find({
          selector: { conversationId: activeConversationId }
        }).exec().then(parts => {
          const partner = parts.find(p => (p.userId || p.user_id) !== currentUserId);
          if (partner && !partnerUserId) {
            partnerUserId = partner.userId || partner.user_id;
          }
        });
      });
    }
  });

  let partnerProfileSubscription: any = null;
  $effect(() => {
     if (partnerUserId) {
        if (!partnerProfileSubscription || fetchingProfileId !== partnerUserId) {
             if (partnerProfileSubscription) {
                partnerProfileSubscription.unsubscribe();
                partnerProfileSubscription = null;
             }
             
             fetchingProfileId = partnerUserId;
             
             // 1. Immediately subscribe to local RxDB to render cached data with 0ms delay!
             dbService.getRawDB().then(db => {
                const sub = db.profiles.findOne(partnerUserId!).$.subscribe(p => {
                    if (p) {
                      resolvedProfile = p.toJSON();
                    }
                });
                partnerProfileSubscription = sub;
                subscriptions.push(sub);
             }).catch(console.error);

             // 2. Load/sync in the background asynchronously to refresh DB which triggers updates
             authService.getProfile(partnerUserId).then((prof) => {
                if (prof && !resolvedProfile) {
                   resolvedProfile = prof;
                }
             }).catch(console.error).finally(() => {
                if (fetchingProfileId === partnerUserId) fetchingProfileId = null;
             });

             // 3. Keep online status synced using polling since realtime publications might not be active
             const profileSyncInterval = setInterval(() => {
                 authService.getProfile(partnerUserId, true).catch(() => {});
             }, 15000);
             subscriptions.push({ unsubscribe: () => clearInterval(profileSyncInterval) });

             // 4. Listen directly to Supabase presence changes for the partner for sub-second real-time updates!
             import('../services/supabaseService').then(({ supabase }) => {
               const partnerChannel = supabase
                 .channel(`partner-presence-${partnerUserId}`)
                 .on(
                   'postgres_changes',
                   { event: '*', schema: 'public', table: 'presence', filter: `user_id=eq.${partnerUserId}` },
                   (payload: any) => {
                     const rec = payload.new;
                     if (rec && rec.last_seen_at) {
                       // Update local RxDB profile which propagates to Svelte
                       dbService.getRawDB().then(db => {
                         db.profiles.findOne(partnerUserId!).exec().then(p => {
                            if (p) {
                              p.incrementalPatch({ lastSeenAt: rec.last_seen_at }).catch(() => {});
                            }
                         });
                       });
                     }
                   }
                 )
                 .subscribe();
               subscriptions.push({ unsubscribe: () => supabase.removeChannel(partnerChannel) });
             }).catch(console.error);
        }
     }
  });

  const handleImageUpload = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length) return;
    
    const files = Array.from(input.files);
    for (const file of files) {
      try {
        const url = URL.createObjectURL(file);
        let dominantColor = '#e2e8f0';
        try {
          const { getAverageColor } = await import('../utils/dominantColor');
          dominantColor = await getAverageColor(file);
        } catch (err) {}

        const newImageItem: StagedDraftImage = {
          id: `draft_img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          file,
          url,
          dominantColor,
          name: file.name,
          gapTextTree: []
        };

        // 1. If a user selects an image, inserting another one swaps out the selection!
        if (selectedDraftImageId) {
          const selIdx = stagedImages.findIndex(img => img.id === selectedDraftImageId);
          if (selIdx !== -1) {
            // Respect the text in the gap below the swapped image!
            newImageItem.gapTextTree = stagedImages[selIdx].gapTextTree;
            stagedImages[selIdx] = newImageItem;
            selectedDraftImageId = newImageItem.id;
            lastSelectedDraftImageId = newImageItem.id;
            focusedGapImageId = newImageItem.id;
          } else {
            stagedImages = [...stagedImages, newImageItem];
            selectedDraftImageId = newImageItem.id;
            lastSelectedDraftImageId = newImageItem.id;
            focusedGapImageId = newImageItem.id;
          }
        } else {
          // 2. But without selection another image gets inserted below the current selection still respecting the text between the gaps!
          if (stagedImages.length === 0) {
            // First image being inserted: existing text in draft becomes gap 1 below it
            newImageItem.gapTextTree = [...currentTree];
            stagedImages = [newImageItem];
            lastSelectedDraftImageId = newImageItem.id;
            focusedGapImageId = newImageItem.id;
          } else {
            // Find insertion position below the last selected/current image (or at the end)
            const targetIdx = lastSelectedDraftImageId
              ? stagedImages.findIndex(img => img.id === lastSelectedDraftImageId)
              : stagedImages.length - 1;

            const insertIdx = targetIdx !== -1 ? targetIdx + 1 : stagedImages.length;
            const updatedList = [...stagedImages];
            updatedList.splice(insertIdx, 0, newImageItem);
            stagedImages = updatedList;
            lastSelectedDraftImageId = newImageItem.id;
            focusedGapImageId = newImageItem.id;
            // Clear current editor for the new gap below this inserted image
            currentTree = [];
            currentCursorPath = { containerPath: [], offset: 0 };
          }
        }

        showMathKeyboard = true;
        hasSeenTypingInstructions = true;
        tick().then(() => {
          textareaEl?.focus();
          scrollToBottom('smooth');
        });
      } catch (err: any) {
        console.error('Image staging failed:', err);
        triggerNotification("Upload Failed", { body: err.message || "Could not stage image", type: 'error' });
      }
    }
    input.value = '';
  };

  const openProfileLightbox = async () => {
     const userId = partnerUserId;
     
     profileData = {
         userId,
         name: resolvedProfile?.fullName || resolvedProfile?.name || contactName,
         avatarUrl: resolvedProfile?.avatarUrl,
         avatar: resolvedProfile?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${resolvedProfile?.fullName || contactName}`,
         role: resolvedProfile?.role || 'Network Member',
         school: resolvedProfile?.school || '',
         bio: resolvedProfile?.bio,
         points: resolvedProfile?.points,
         studentClass: resolvedProfile?.studentClass,
         preferredSubjects: resolvedProfile?.preferredSubjects,
         subjectCombination: resolvedProfile?.subjectCombination,
         age: resolvedProfile?.age,
         house: resolvedProfile?.house,
         clubs: resolvedProfile?.clubs
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
     
     if (userId && !resolvedProfile) {
        fetchingProfileId = userId;
        try {
            const profile = await dbService.getProfile(userId);
            if (profile && fetchingProfileId === userId) {
                 resolvedProfile = profile;
                 if (isProfileLightboxOpen) {
                     profileData = {
                         ...profileData,
                         name: profile.fullName || profile.name || profileData.name,
                         avatarUrl: profile.avatarUrl || profileData.avatarUrl,
                         avatar: profile.avatarUrl || profileData.avatar,
                         bio: profile.bio !== undefined ? profile.bio : profileData.bio,
                         points: profile.points !== undefined ? profile.points : profileData.points,
                         school: profile.school || profileData.school,
                         role: profile.role || profileData.role,
                         studentClass: profile.studentClass || profileData.studentClass,
                         preferredSubjects: profile.preferredSubjects || profileData.preferredSubjects,
                         subjectCombination: profile.subjectCombination || profileData.subjectCombination,
                         age: profile.age !== undefined ? profile.age : profileData.age,
                         house: profile.house || profileData.house,
                         clubs: profile.clubs || profileData.clubs
                     };
                 }
            }
        } catch (err) {
            console.error('Failed to profile fetch', err);
        } finally {
            if (fetchingProfileId === userId) fetchingProfileId = null;
        }
     }
  };
  function formatDividerDate(dateInput: any): string {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
       return 'today';
    } else if (date.toDateString() === yesterday.toDateString()) {
       return 'yesterday';
    }
    
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }).toLowerCase();
  }

  function formatMessageTime(dateInput: any): string {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  function getDisplayContent(m: any) {
    let content = m.content;
    if (m.type?.startsWith('f:')) {
      try {
        const parsed = JSON.parse(m.content);
        content = parsed.c ?? m.content;
      } catch (e) {
        content = m.content;
      }
    }
    if (content === 'Image' || content === '[Image message]') return '';
    return content;
  }
  
  function downloadDiagnosticPDF() {
    const doc = new jsPDF();
    
    // Setup document properties
    doc.setProperties({
      title: 'Desmos-Quality Math Text Area Architecture',
      subject: 'Architecture & Implementation of the Advanced Math Input',
      author: 'EXUP Engineering team',
    });

    const pageHeight = 297; // A4 height
    const pageWidth = 210; // A4 width
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;
    let pageCount = 1;

    // Helper to draw clean page decoration
    const drawPageDecoration = (pageNum: number) => {
      // Small grey band at top
      doc.setDrawColor(200, 210, 225);
      doc.setLineWidth(0.5);
      doc.line(margin, 12, pageWidth - margin, 12);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 115, 130);
      doc.text("EXUP DESMOS-QUALITY TEXT AREA BLUEPRINT", margin, 9);
      doc.text(`Page ${pageNum}`, pageWidth - margin, 9, { align: 'right' });

      // Footer
      doc.setDrawColor(220, 225, 235);
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
      doc.text("CONFIDENTIAL ENGINEERING SPECIFICATION - EXUP DEVELOPMENT GROUP", margin, pageHeight - 8);
      doc.text("Generated via EXUP Architecture Export", pageWidth - margin, pageHeight - 8, { align: 'right' });
    };

    let y = 15;

    const checkY = (neededHeight: number) => {
      if (y + neededHeight > pageHeight - 20) {
        doc.addPage();
        pageCount++;
        drawPageDecoration(pageCount);
        y = 22; // Resets y on new page
      }
    };

    const drawSectionHeader = (title: string) => {
      checkY(20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(0, 39, 77); // App Navy
      doc.text(title, margin, y);
      y += 3;
      
      doc.setDrawColor(0, 39, 77);
      doc.setLineWidth(0.4);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
    };

    const drawCodeBlock = (codeLines: string[]) => {
      doc.setFont("courier", "normal");
      doc.setFontSize(6);
      doc.setTextColor(30, 40, 50);
      
      codeLines.forEach((rawLine) => {
        const splitLines = doc.splitTextToSize(rawLine, contentWidth - 4);
        splitLines.forEach((line: string) => {
          checkY(3.2);
          // Draw left vertical aesthetic line to represent IDE code block
          doc.setDrawColor(180, 200, 220);
          doc.setLineWidth(0.5);
          doc.line(margin - 2, y - 1.5, margin - 2, y + 1.5);
          
          doc.text(line, margin, y);
          y += 2.8;
        });
      });
      y += 4; // Margin after code block
    };

    // --- COVER PAGE ---
    doc.setFillColor(0, 39, 77); // App Navy #00274d
    doc.rect(0, 0, pageWidth, 75, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text("DESMOS-QUALITY MATH TEXT AREA", margin, 25);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Architecture & Implementation Details", margin, 35);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(190, 210, 230);
    doc.text("A comprehensive review of the math parsing engine, custom selection mapping,", margin, 46);
    doc.text("rendering logic, and seamless cursor tracking mechanisms.", margin, 52);
    doc.setFont("helvetica", "italic");
    doc.text("System: EXUP Interactive Math Communication", margin, 60);
    doc.setFont("helvetica", "normal");
    doc.text("Blueprint Generated On: " + new Date().toLocaleString(), margin, 66);

    doc.setTextColor(50, 50, 50);

    // Cover Page Table of Contents / Executive Summary
    y = 86;
    drawSectionHeader("1. EXECUTIVE SUMMARY & CORE CONCEPTS");
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    
    const summaryText = "The Desmos-quality math text area provides a seamless, WYSIWYG editing experience. Behind the scenes, it utilizes an invisible native textarea for handling mobile keyboards, input events, and selection ranges, while an overlaid custom DOM renderer visually constructs mathematical elements (fractions, square roots, brackets) based on a unified parsing pipeline. A complex mapping strategy guarantees that cursor manipulation across deeply nested HTML structures remains 100% in sync with the underlying linear text indices.";
    const splitSummary = doc.splitTextToSize(summaryText, contentWidth);
    doc.text(splitSummary, margin, y);
    y += splitSummary.length * 4.2 + 6;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("Key Architectural Components:", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    
    const shiftDetails = [
      "1. Dual-Layer Input Architecture: A transparent <textarea> captures all native browser events, maintaining native accessibility and virtual keyboard support. The visible layer acts as a visual representation proxy.",
      "2. mathRender.ts Parser: A recursive parsing algorithm that processes raw linear text strings containing unicode mathematical operators. It generates an Abstract Syntax Tree (AST) representing roots, fractions, scripts, and groups.",
      "3. Bidirectional Index Mapping: During AST generation, every visible character receives an 'originalIndices' map linking it back to the exact character index in the raw string. This powers precise text selection highlighting.",
      "4. Cursor Interpolation & Pointer Events: By calculating pointer click locations on individual character spans (`pointer-events-auto`), we translate precise mouse clicks back to the underlying transparent textarea selection state.",
    ];
    
    shiftDetails.forEach((detail) => {
      const splitDetail = doc.splitTextToSize(detail, contentWidth - 5);
      doc.text(splitDetail, margin + 3, y);
      y += splitDetail.length * 4 + 3.5;
    });

    drawPageDecoration(pageCount);

    // --- SECTION 2: AST STRUCTURE ---
    drawSectionHeader("2. ABSTRACT SYNTAX TREE (AST)");
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text("The mathRender.ts utility parses raw string inputs into a robust AST structure.", margin, y);
    y += 6;

    const astCode = [
      "// MathNode Abstract Syntax Tree (AST) Type Definitions",
      "export type MathNode = ",
      "  | { type: 'text', text: string, originalIndices?: number[] }",
      "  | { type: 'cursor' }",
      "  | { type: 'sqrt', content: MathNode[]; hasOuterSuperscript?: boolean }",
      "  | { type: 'bracket', bracketType: 'round' | 'square' | 'absolute' | 'curly' | 'fraction_group' | 'superscript_group' | 'subscript_group', content: MathNode[] }",
      "  | { type: 'fraction', numerator: MathNode[], denominator: MathNode[] };",
      "",
      "// originalIndices bridges the gap between structured mathematical representation",
      "// and the linear string selection indices native to the invisible text-area layer."
    ];
    drawCodeBlock(astCode);

    // --- SECTION 3: SELECTION MAPPING ---
    drawSectionHeader("3. INDEX PRESERVATION & SELECTION HIGHLIGHTING");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    
    const selectionStrategy = "Unlike standard Markdown parsers, our parser does not drop state. Instead of just emitting output components, every single character node carries its original origin index via the `originalIndices` array. During the final 'traverseAndMerge' phase of AST generation, nodes are coalesced, yet the mapped arrays retain exact index fidelity.";
    const splitSelection = doc.splitTextToSize(selectionStrategy, contentWidth);
    doc.text(splitSelection, margin, y);
    y += splitSelection.length * 4.2 + 4;

    const selectionCode = [
      "// Snippet showing how selection logic is implemented in the Svelte View",
      "{#each part.text.split('') as char, i}",
      "   {@const idx = part.originalIndices && part.originalIndices[i] !== undefined ? part.originalIndices[i] : -1}",
      "   {@const isSelected = selectionStart !== selectionEnd && idx >= selectionStart && idx < selectionEnd}",
      "   <span ",
      "      class=\"inline-block transition-colors duration-75 relative pointer-events-auto\"",
      "      class:bg-blue-500={isSelected}",
      "      class:bg-opacity-30={isSelected}",
      "      style=\"cursor: text; user-select: none;\"",
      "      onclick={(e) => {",
      "         if (idx !== -1 && textareaEl) {",
      "            e.preventDefault(); e.stopPropagation();",
      "            textareaEl.focus();",
      "            const rect = e.currentTarget.getBoundingClientRect();",
      "            const isRightHalf = e.clientX > rect.left + rect.width / 2;",
      "            const newPos = idx + (isRightHalf ? 1 : 0);",
      "            textareaEl.selectionStart = textareaEl.selectionEnd = newPos;",
      "            updateCursor();",
      "         }",
      "      }}",
      "   >{char}</span>",
      "{/each}"
    ];
    drawCodeBlock(selectionCode);

    // --- SECTION 4: DOM RENDERING OVERLAYS ---
    drawSectionHeader("4. FRACTION & COMPONENT RENDERING");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const fractionStrategy = "Math components inherently demand unique layouts. Fractions use vertical flexboxes to stack numerators and denominators over a custom drawn border. Square roots employ dynamically stretched SVGs that calculate internal dimensions to encapsulate their child AST nodes beautifully. All components are seamlessly recursive.";
    const splitFraction = doc.splitTextToSize(fractionStrategy, contentWidth);
    doc.text(splitFraction, margin, y);
    y += splitFraction.length * 4.2 + 4;

    const fractionCode = [
      "// Recursive Svelte Layout for Fractions",
      "{:else if part.type === 'fraction'}",
      "  <span class=\"inline-flex flex-col items-center justify-center align-middle mx-1 relative top-[-0.1em]\" style=\"font-size: 0.85em;\">",
      "     <span class=\"px-0.5 border-b-[1.5px] border-current w-full text-center flex justify-center items-center leading-none\" ...>",
      "        {#each part.numerator as sub}",
      "           {@render renderMathNode(sub)}",
      "        {/each}",
      "     </span>",
      "     <span class=\"px-0.5 w-full text-center flex justify-center items-center leading-none\" ...>",
      "        {#each part.denominator as sub}",
      "           {@render renderMathNode(sub)}",
      "        {/each}",
      "     </span>",
      "  </span>"
    ];
    drawCodeBlock(fractionCode);

    // Save final document
    doc.save("Desmos_Quality_TextArea_Architecture.pdf");
  }

  function debugMessage(m: any) {
    // Only log if it's f:image or f:audio and attachments seem broken
    if (m.type?.startsWith('f:')) {
      if (!m.attachments || !Array.isArray(m.attachments) || m.attachments.length === 0) {
         console.error('Message missing valid attachments!', m.id, m.type, m.attachments, m.content);
      }
    }
  }
</script>

<div class="h-full bg-theme-paper flex flex-col overflow-hidden font-chat pb-safe relative" style="background-image: radial-gradient(#cbd5e1 1.2px, transparent 1.2px); background-size: 20px 20px;">
  <!-- Header: Elegant Notebook Styled Loose Sheet with adhesive tape matching the classroom theme (without background lines to reduce clutter) -->
  <header class="bg-theme-card text-slate-800 pt-4 pb-2.5 px-5 flex items-center justify-center sticky top-0 z-50 w-full shadow-md border-b border-stone-200/50 overflow-visible">
    <!-- Aesthetic Semi-transparent scotch/masking tapes on left/right corners -->
    <div class="absolute -top-1.5 left-[12%] w-10 h-4 bg-yellow-50/45 backdrop-blur-[0.5px] border border-yellow-200/20 rotate-[-18deg] shadow-sm pointer-events-none z-[60] select-none"></div>
    <div class="absolute -top-1.5 right-[12%] w-10 h-4 bg-yellow-50/45 backdrop-blur-[0.5px] border border-yellow-200/20 rotate-[18deg] shadow-sm pointer-events-none z-[60] select-none"></div>

    <div class="flex items-center justify-between w-full max-w-2xl relative z-50">
      <div class="flex items-center gap-2.5">
        <button onclick={() => onback?.()} class="p-1.5 -ml-1 text-slate-600 hover:text-[#1d4ed8] hover:bg-slate-100 rounded-lg transition-colors border-none bg-transparent cursor-pointer focus:outline-none relative z-50 pointer-events-auto" title="Back">
          <ChevronLeft size={22} strokeWidth={2.5} />
        </button>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="flex items-center gap-2.5 cursor-pointer" onclick={openProfileLightbox}>
          <div class="relative">
            <div class="w-10 h-10 rounded-full overflow-hidden border border-slate-200 shadow-sm bg-theme-card">
               <img src={resolvedProfile?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${resolvedProfile?.fullName || contactName}`} alt={contactName} class="w-full h-full object-cover" />
            </div>
            <div class={`absolute bottom-0 right-0 w-2.5 h-2.5 ${isPartnerOnline ? 'bg-orange-500' : 'bg-slate-400'} border border-white rounded-full`}></div>
          </div>
          <div>
            <h3 class="text-[15px] font-bold tracking-tight text-slate-800 font-sans mb-0">{resolvedProfile?.fullName || contactName}</h3>
            <span class="text-[11px] text-slate-500 flex items-center gap-1.5 font-bold font-sans">
               <div class={`w-1.5 h-1.5 ${isPartnerOnline ? 'bg-orange-500' : 'bg-slate-400'} rounded-full`}></div> {isPartnerOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>
      
      <div class="flex gap-1">
        <button onclick={downloadDiagnosticPDF} class="p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border-none bg-transparent cursor-pointer" title="Download Diagnostic"><Download size={19} /></button>
        <button onclick={requestAudioCall} class="p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border-none bg-transparent cursor-pointer" title="Voice Call"><Phone size={19} /></button>
        <button onclick={requestVideoCall} class="p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border-none bg-transparent cursor-pointer" title="Video Call"><Video size={19} /></button>
      </div>
    </div>
  </header>

  <div class="flex-1 relative flex flex-col overflow-hidden bg-theme-card rounded-t-[32px] sm:rounded-t-[40px] z-10 shadow-[0_-15px_35px_rgba(0,0,0,0.06)] max-w-2xl mx-auto w-full border-x border-stone-300">
    <!-- Pinned Message Banner -->
    {#if pinnedMessages.length > 0}
    <div class="mx-5 mt-5 flex flex-col gap-1 overflow-visible relative">
      <div 
        role="button"
        tabindex="0"
        class="p-4 bg-theme-card/5 backdrop-blur-3xl rounded-2xl shadow-xl border border-white/10 flex items-center justify-between group cursor-pointer hover:bg-theme-card/10 transition-all active:scale-95 z-20 relative overflow-visible"
        style={swipingAllPins ? `transform: translateX(-${swipeDistance}px)` : ''}
        ontouchstart={(e) => handleTouchStart(e, 'all', 'all')}
        ontouchmove={handleTouchMove}
        ontouchend={handleTouchEnd}
        ontouchcancel={handleTouchEnd}
        onkeydown={(e) => { if(e.key === 'Enter') showPinnedList = !showPinnedList }}
      >
        <!-- Swipe indicator for all pins -->
        {#if swipingAllPins && swipeDistance > 30}
           <div class="absolute inset-y-0 right-[-100px] w-[100px] bg-orange-500 flex items-center justify-center text-white rounded-r-2xl">
              <span class="text-[10px] font-bold uppercase">Unpin All</span>
           </div>
        {/if}

        <div 
          role="button"
          tabindex="0"
          class="flex items-center gap-4 flex-1 min-w-0 outline-none"
          onclick={() => {
            if (lastPinnedMessage) scrollToMessage(lastPinnedMessage.id);
            else {
              const representative = messages.find(m => (m.attachments && m.attachments.length > 0) || m.type === 'video');
              if (representative) scrollToMessage(representative.id);
            }
          }}
          onkeydown={(e) => { if(e.key === 'Enter' && lastPinnedMessage) scrollToMessage(lastPinnedMessage.id) }}
        >
          <div class="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-500">
             <Pin size={20} fill="currentColor" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[10px] uppercase tracking-widest font-bold text-orange-500 mb-0.5">Pinned Message</p>
            <p class="text-sm font-semibold text-[#00274d] truncate max-w-[200px]">
               {lastPinnedMessage?.content || (lastPinnedMessage?.type === 'image' ? 'Image' : lastPinnedMessage?.type === 'audio' ? 'Voice Message' : "Shared resources folder")}
            </p>
          </div>
        </div>
        <div 
          class="flex items-center gap-2"
        >
          {#if showPinnedList}
             <button 
               onclick={(e) => { e.stopPropagation(); handleClearAllPins(); }} 
               class="text-[9px] font-bold text-orange-500 uppercase tracking-widest hover:underline bg-transparent border-none cursor-pointer"
             >
               Clear All
             </button>
          {/if}
          <button 
            onclick={(e) => { e.stopPropagation(); showPinnedList = !showPinnedList; }}
            class="p-2 hover:bg-gray-100 rounded-full transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center"
            aria-label={showPinnedList ? 'Hide pinned list' : 'Show pinned list'}
          >
            <ChevronLeft size={16} class="text-gray-400 transition-transform duration-300 {showPinnedList ? 'rotate-[-90deg]' : 'rotate-180'}" />
          </button>
        </div>
      </div>

      {#if showPinnedList && pinnedMessages.length > 0}
        <div class="flex flex-col gap-1 animate-in slide-in-from-top-2 duration-300">
          {#each pinnedMessages as pm (pm.id)}
            <div 
              role="button"
              tabindex="0"
              class="p-3 mx-2 bg-theme-card/5 backdrop-blur-md rounded-xl border border-white/5 flex items-center justify-between group cursor-pointer hover:bg-theme-card/10 transition-all active:scale-95 relative overflow-hidden"
              ontouchstart={(e) => handleTouchStart(e, pm.id, 'pin')}
              ontouchmove={handleTouchMove}
              ontouchend={handleTouchEnd}
              ontouchcancel={handleTouchEnd}
              onkeydown={(e) => { if(e.key === 'Enter') scrollToMessage(pm.id) }}
            >
              <!-- Unpin Indicator background -->
              {#if swipingPinnedId === pm.id && swipeDistance > 10}
                <div 
                  class="absolute inset-y-0 right-0 bg-orange-500 flex items-center justify-center text-white"
                  style="width: {swipeDistance}px;"
                >
                  <X size={16} />
                </div>
              {/if}

              <div 
                role="button"
                tabindex="0"
                class="flex items-center gap-3 flex-1 min-w-0 outline-none"
                style={swipingPinnedId === pm.id ? `transform: translateX(-${swipeDistance}px)` : ''}
                onclick={() => { scrollToMessage(pm.id); showPinnedList = false; }}
                onkeydown={(e) => { if(e.key === 'Enter') { scrollToMessage(pm.id); showPinnedList = false; } }}
              >
                <div class="w-7 h-7 bg-orange-50 rounded-lg flex items-center justify-center text-orange-400">
                   <Pin size={12} fill="currentColor" />
                </div>
                <p class="text-xs font-medium text-[#00274d] truncate">
                  {pm.content || (pm.type === 'image' ? 'Image' : pm.type === 'audio' ? 'Voice note' : 'Pinned Item')}
                </p>
              </div>
              
              {#if swipingPinnedId === pm.id && swipeDistance > 30}
                <div class="absolute inset-y-0 right-[-60px] w-14 bg-orange-500 flex items-center justify-center text-white">
                  <X size={16} />
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
    {/if}

    <!-- Full-Screen Interactive Annotation Layer -->
    <ChatAnnotationLayer
      isActive={isSketchMode}
      {isEraser}
      activeColor={textColors[activeTextColorIndex].displayColor}
      {strokeWidth}
      containerEl={messagesContainer}
      onStrokeCommitted={handleLayerStrokeCommitted}
      onErase={handleGlobalErase}
      onCanvasTransform={handleCanvasTransform}
      zoomScale={canvasZoom}
    />

    <div 
      bind:this={messagesContainer} 
      onscroll={handleScroll}
      ondblclick={() => { 
        if (isSketchMode) return;
        if (Date.now() - lastTouchDblTapTime < 800) return;
        showMathKeyboard = !showMathKeyboard; 
        if (showMathKeyboard) {
          hasSeenTypingInstructions = true;
          tick().then(() => {
             textareaEl?.focus();
             scrollToBottom('smooth');
             // Give layout time to shift before scrolling again to be safe
             setTimeout(() => scrollToBottom('smooth'), 150);
             setTimeout(() => scrollToBottom('smooth'), 350);
          });
        }
      }}
      data-math-canvas-open={isMathCanvasOpen}
      class="flex-1 overflow-y-auto px-5 pt-6 {showMathKeyboard ? 'pb-[360px]' : 'pb-40'} relative"
      style="scrollbar-gutter: stable; {isSketchMode ? 'touch-action: none; overscroll-behavior: none;' : ''} background-image: linear-gradient(90deg, transparent 44px, rgba(254, 188, 167, 0.5) 44px, rgba(254, 188, 167, 0.5) 45px, transparent 45px), repeating-linear-gradient(transparent 0px, transparent calc(var(--chat-line-height, 1.75rem) - 1px), rgba(226, 232, 240, 0.5) calc(var(--chat-line-height, 1.75rem) - 1px), rgba(226, 232, 240, 0.5) var(--chat-line-height, 1.75rem)); background-color: var(--color-theme-card); background-size: 100% var(--chat-line-height, 1.75rem); background-attachment: local;"
      ontouchstart={(e) => { 
        if (isSketchMode) return; 
        if (!swipingMessageId && !swipingPinnedId) handleTouchStart(e, 'undo', 'undo'); 
      }}
      ontouchmove={(e) => { 
        if (isSketchMode) return; 
        handleTouchMove(e); 
      }}
      ontouchend={(e) => { 
        if (isSketchMode) return; 
        handleTouchEnd(); 
      }}
      ontouchcancel={(e) => { 
        if (isSketchMode) return; 
        handleTouchEnd(); 
      }}
    >
      <div 
        class="canvas-stage w-full min-h-full space-y-8 origin-top-left"
        style="transform: translate({canvasPanX}px, {canvasPanY}px) scale({canvasZoom}); transform-origin: 0 0; transition: {isPinching ? 'none' : 'transform 0.15s ease-out'}; will-change: transform;"
      >
      {#if isLoading && messages.length === 0}
        <div class="flex-1 flex flex-col items-center justify-center pt-32 gap-6">
           <div class="relative">
              <div class="w-16 h-16 border-4 border-orange-500/20 rounded-full"></div>
              <div class="absolute inset-0 w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
           </div>
           <div class="flex flex-col items-center gap-1">
             <p class="text-sm font-bold text-[#00274d] animate-pulse uppercase tracking-widest">Opening Secure Channel</p>
             <p class="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">Syncing learning stories...</p>
           </div>
        </div>
      {:else if messages.length === 0 && !isLoading}
        <div class="flex-1 flex flex-col items-center justify-center pt-20 pb-4 text-center px-10 animate-in fade-in duration-300">
             <p class="text-sm text-slate-400 uppercase tracking-wider font-semibold">No messages yet</p>
        </div>
      {/if}
      
      {#if isSyncing && messages.length > 0}
         <div class="absolute top-2 left-1/2 -translate-x-1/2 z-50">
            <div class="px-3 py-1 bg-[#00274d]/80 backdrop-blur-md rounded-full text-[9px] font-bold text-white uppercase tracking-widest flex items-center gap-2 shadow-xl border border-white/10 animate-in slide-in-from-top-4">
               <div class="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></div>
               Updating Chat...
            </div>
         </div>
      {/if}
      {#snippet replyBox(msgObj)}
        {#if msgObj.attachments?.find((a: any) => a.type === 'reply')}
          {@const replyInfo = msgObj.attachments.find((a: any) => a.type === 'reply')}
          <button 
             type="button"
             onclick={(e) => { e.stopPropagation(); scrollToMessage(replyInfo.replyToId); }}
             class="mb-2 p-1.5 px-2.5 text-left cursor-pointer transition-all hover:brightness-95 hover:scale-[1.01] active:scale-[0.98] w-full rounded-r-lg rounded-l-[4px] border-none flex flex-col gap-0.5 bg-black/[0.04] dark:bg-theme-card/[0.06] border-l-[4px] relative overflow-hidden self-stretch"
             style="border-left-color: {replyInfo.replyToSenderId === currentUserId ? '#E58A3A' : '#00274d'}; text-align: left; display: flex; flex-direction: column;"
             title="Jump to original message"
          >
             <span class="font-bold text-[11px] leading-tight" style="color: {replyInfo.replyToSenderId === currentUserId ? '#E58A3A' : '#00274d'};">
                {replyInfo.replyToSenderId === currentUserId ? 'You' : contactName}
             </span>
             <p class="text-[11px] font-medium text-slate-700 dark:text-slate-300 leading-normal w-full m-0 break-words whitespace-normal line-clamp-4">
                {replyInfo.replyToType === 'audio' ? '🎤 Voice note' : replyInfo.replyToType === 'image' ? '📷 Image' : replyInfo.replyToType === 'video' ? '🎥 Video' : formatMathAsPlainText(replyInfo.replyToContent)}
             </p>
          </button>
        {/if}
      {/snippet}
      {#snippet statusTicks(msgObj: any, textClass: string = 'text-gray-400', readColorClass: string = 'text-orange-500')}
        <div class="flex items-center transition-all duration-300">
          {#if msgObj.status === 'pending'}
            <Check size={12} class="{textClass} opacity-70" />
          {:else if msgObj.status === 'sent'}
            <Check size={12} class={textClass} />
          {:else if msgObj.status === 'delivered'}
            <CheckCheck size={12} class={textClass} />
          {:else if msgObj.status === 'read'}
            <CheckCheck size={12} class={readColorClass} />
          {:else if msgObj.status === 'error'}
            <button type="button" title="Retry sending" aria-label="Retry sending message" class="flex items-center" onclick={(event) => { event.stopPropagation(); void retryMessageSend(msgObj.id); }}>
              <X size={12} class="text-red-500 font-bold" />
            </button>
          {:else}
            <Check size={12} class={textClass} />
          {/if}
        </div>
      {/snippet}

      <!-- Undo Indicator (Right swipe) -->
      {#if swipingUndo && swipeDistance > 30}
         <div class="absolute inset-y-0 left-0 w-[140px] bg-green-500 flex items-center justify-center text-white z-50 rounded-r-[32px] shadow-2xl animate-in slide-in-from-left duration-300">
            <span class="text-xs font-bold uppercase flex items-center gap-2 px-4 text-center leading-tight">
               <ChevronLeft size={18} class="rotate-180 flex-shrink-0" /> 
               {lastDeletedMessage ? 'Release to Restore' : 'Nothing to undo'}
            </span>
         </div>
      {/if}
      {#each renderedMessages as m, i (m.id)}
        {@const isMe = m.isMe}
        {@const msgType = m.type?.startsWith('f:') ? m.type.substring(2) : m.type}
        {@const audioAttachment = m.attachments?.find((a: any) => typeof a === 'object' && a.type === 'audio')}
        {@const displayContent = getDisplayContent(m)}
        {@const _d = debugMessage(m)}
        {@const styleAttachment = m.attachments?.find((a: any) => typeof a === 'object' && a.type === 'style')}
        {@const textStyleColor = styleAttachment?.color || (isMe ? '#1d4ed8' : '#0f172a')}
        {@const isMsgBold = styleAttachment ? styleAttachment.isBold : true}
        {@const isMsgItalic = styleAttachment?.isItalic || false}
        {@const isMsgUnderlined = styleAttachment?.isUnderlined || false}

        <!-- Horizontal Date Divider from image -->
        {@const dateStr = formatDividerDate(m.createdAt ?? m.created_at)}
        {@const showDateDivider = i === 0 || formatDividerDate(renderedMessages[i - 1]?.createdAt ?? renderedMessages[i - 1]?.created_at) !== dateStr}
        {#if showDateDivider}
          <div class="flex items-center gap-4 my-8 px-4 w-full select-none flex-shrink-0 font-sans opacity-90 overflow-hidden">
             <div class="flex-1 max-w-[120px] ml-auto">
               <svg class="w-full h-2 block pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 8">
                 <path d="M0,4 Q25,3.85 50,4 T100,4" fill="none" class="stroke-[#253b70] dark:stroke-[#5b7290]" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
               </svg>
             </div>
             <span class="text-[14px] text-[#253b70] dark:text-[#5b7290] tracking-normal px-0 bg-transparent flex items-center mb-1 font-medium" style="font-family: 'Kalam', cursive;">
               {dateStr}
             </span>
             <div class="flex-1 max-w-[120px] mr-auto">
               <svg class="w-full h-2 block pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 8">
                 <path d="M0,4 Q25,4.15 50,4 T100,4" fill="none" class="stroke-[#253b70] dark:stroke-[#5b7290]" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
               </svg>
             </div>
          </div>
        {/if}

        <!-- Unread divider based on PDF -->
        {#if i === firstUnreadIndex}
          <div 
            bind:this={unreadMarkerEl}
            class="flex items-center gap-3 my-6 px-1.5 w-full select-none"
          >
            <div class="flex-1 h-[1.5px] bg-blue-600/50"></div>
            <div class="flex items-center gap-2 px-3 text-[#1d4ed8] font-bold text-[11px] uppercase tracking-widest font-sans">
              <span class="text-[8px]">•</span>
              <span>Unread Messages</span>
              <span class="text-[8px] font-bold">•</span>
            </div>
            <div class="flex-1 h-[1.5px] bg-blue-600/50"></div>
          </div>
        {/if}
        
        <div 
          id={`msg-${m.id}`} 
          data-message-id={m.id}
          use:readOnVisible={m}
          class={`flex flex-col w-full group transition-all duration-500 rounded-2xl relative overflow-visible items-start ${highlightedMessageId === m.id ? 'bg-orange-500/15 ring-2 ring-orange-500/30 scale-[1.02] shadow-md z-10 duration-200' : ''}`}
          ontouchstart={(e) => { 
            if (isSketchMode) return; 
            handleTouchStart(e, m.id, 'msg'); 
          }}
          ontouchmove={(e) => { if (isSketchMode) return; handleTouchMove(e); }}
          ontouchend={(e) => { if (isSketchMode) return; handleTouchEnd(); }}
          ontouchcancel={(e) => { if (isSketchMode) return; handleTouchEnd(); }}
          oncontextmenu={(e) => { e.preventDefault(); handlePin(m.id); }}
          use:markRead={{ messageId: m.id, myUserId: currentUserId, senderId: m.senderId ?? m.sender_id, disabled: isMathCanvasOpen }}
        >
          <!-- Reply Indicator background -->
          {#if swipingMessageId === m.id && swipeDirection === 'right' && swipeDistance > 10}
            <div 
              class="absolute inset-y-0 left-0 bg-blue-500 flex items-center justify-start text-white pl-6"
              style="width: {swipeDistance}px;"
            >
              <CornerUpLeft size={24} class={swipeDistance > 55 ? 'scale-110 text-white transition-all' : 'scale-90 text-white/75 transition-all'} />
            </div>
          {/if}

          <!-- Delete Indicator background -->
          {#if swipingMessageId === m.id && swipeDirection === 'left' && swipeDistance > 10}
            <div 
              class="absolute inset-y-0 right-0 bg-red-500 flex items-center justify-center text-white"
              style="width: {swipeDistance}px;"
            >
              <Trash2 size={24} />
            </div>
          {/if}

          <div 
            class={`flex items-start transition-transform duration-100 w-full pl-[27px] pr-4 relative`}
            style={swipingMessageId === m.id ? `transform: translateX(${swipeDirection === 'left' ? '-' : ''}${swipeDistance}px)` : ''}
          >
            <div class="flex-1 relative flex flex-col items-start min-w-0 w-full">
              {#if m.is_pinned}
                <div class="flex items-center gap-1 text-[9px] font-bold text-orange-500 uppercase tracking-tighter mb-1">
                  <Pin size={10} fill="currentColor" /> Pinned
                </div>
              {/if}
              
              {#if msgType === 'video' && m.attachments?.find((a: any) => typeof a === 'object' && a.type === 'video')}
                 {@const videoAttachment = m.attachments.find((a: any) => typeof a === 'object' && a.type === 'video')}
                 {@const videoStrokes = getResolvedStrokes(m)}
                 {@render replyBox(m)}
                 <div 
                   data-image-container={m.id}
                   class="w-full aspect-video relative cursor-pointer group/video overflow-hidden border-l-2 border-dashed border-ink/20 rotate-[-1deg] transition-all hover:scale-[1.01]"
                   style="clip-path: {getTornClipPath(m.id)}; filter: drop-shadow(0px 2px 4px rgba(10, 29, 51, 0.03)) drop-shadow(0px 8px 16px rgba(10, 29, 51, 0.06)); background-color: {getFallbackColor(m.id)};"
                   onclick={() => { if (!isSketchMode) zoomedImageId = m.id; }}
                 >
                    <div class="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1.5 w-16 h-4 bg-yellow-100/60 rotate-[-3deg] border-x border-dashed border-yellow-200/50 backdrop-blur-[0.5px] shadow-sm z-20"></div>
                    {#if videoAttachment.thumbnail}
                      <img 
                        src={videoAttachment.thumbnail} 
                        alt="video thumbnail" 
                        class="w-full h-full object-cover opacity-80 transition-opacity duration-500 {loadedImages[m.id + '_video'] ? 'opacity-80' : 'opacity-0'}" 
                        onload={() => loadedImages[m.id + '_video'] = true}
                      />
                    {/if}
                    <div class="absolute inset-0 flex items-center justify-center">
                       <div class="w-12 h-12 rounded-full bg-theme-card/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 group-hover/video:scale-110 transition-transform">
                          <PlayCircle size={32} fill="white" />
                       </div>
                    </div>
                    {#if videoStrokes && videoStrokes.length > 0}
                       <InkOverlay strokes={videoStrokes} {isMe} />
                    {/if}
                    <div class="absolute top-3 left-3 px-2 py-1 bg-black/40 backdrop-blur-md rounded-full text-[10px] font-bold text-white flex items-center gap-1.5 border border-white/10">
                       <Video size={12} />
                       VIDEO
                    </div>
                    <div class="absolute bottom-3 right-3 text-[10px] font-bold text-white/90 drop-shadow-md flex items-center gap-2">
                       <div class="flex items-center gap-[10px]">
                          <span>{new Date((m.createdAt ?? m.created_at)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {#if isMe}{@render statusTicks(m, 'text-white/80', 'text-white')}{/if}
                       </div>
                       <button onclick={(e) => { e.stopPropagation(); setReplyingTo(m); }} class="text-white/80 hover:text-white bg-transparent border-none cursor-pointer" title="Reply"><CornerUpLeft size={12} /></button>
                       <button onclick={(e) => { e.stopPropagation(); handleShare(m); }} class="text-white/80 hover:text-white bg-transparent border-none cursor-pointer" title="Share"><Share size={12} /></button>
                    </div>
                  </div>
              {:else if msgType === 'image'}
                 {@const imgAttachments = m.attachments?.filter((a: any) => typeof a === 'object' && a.type === 'image') || []}
                 {@const primaryAttachment = imgAttachments[0] || (typeof m.attachments?.[0] === 'object' ? m.attachments[0] : null)}
                 {@const imageStrokes = getResolvedStrokes(m)}
                 {@const receivedMarks = receivedMarksByTarget[m.id] ?? []}
                 {@const draftMarks = pendingMarks[m.id] ?? []}
                 {@const allMarks = [...(imageStrokes || []), ...receivedMarks, ...draftMarks]}
                 {@const imageStrokesForCard = allMarks.filter(s => s.targetContainer === 'image' || s.targetElement === 'image' || (!s.targetContainer && !displayContent))}
                 {@const textStrokesForCard = allMarks.filter(s => s.targetContainer === 'text' || s.targetElement === 'text' || (!s.targetContainer && displayContent))}
                 {@render replyBox(m)}
                 {#if imgAttachments.length > 0}
                    <div class="flex flex-col gap-3 w-full items-start">
                       {#each imgAttachments as att, imgIdx (att.fileId || att.url || imgIdx)}
                          <div 
                            data-image-container={m.id}
                            class="relative max-w-full inline-block group/img overflow-hidden rounded-none cursor-pointer transition-transform hover:scale-[1.005] bg-transparent border-0 shadow-none"
                            style="background: transparent; border: none; box-shadow: none; border-radius: 0;"
                            onclick={() => { if (!isSketchMode) zoomedImageId = m.id; }}
                          >
                             <img 
                               src={att.url} 
                               alt={att.name || 'attached'} 
                               class="w-auto max-w-full h-auto max-h-[520px] object-contain rounded-none block border-0 shadow-none transition-opacity duration-500 {loadedImages[`${m.id}_${imgIdx}`] || loadedImages[m.id] ? 'opacity-100' : 'opacity-0'}" 
                               style="aspect-ratio: auto; max-width: 100%; height: auto; border-radius: 0;"
                               onload={() => { loadedImages[`${m.id}_${imgIdx}`] = true; loadedImages[m.id] = true; }}
                             />
                             {#if imgIdx === 0 && imageStrokesForCard && imageStrokesForCard.length > 0}
                                <InkOverlay strokes={imageStrokesForCard} {isMe} />
                             {/if}
                             {#if imgIdx === imgAttachments.length - 1}
                                <div class="absolute bottom-3 right-3 text-[10px] font-bold text-white/90 drop-shadow-md flex items-center gap-2">
                                   <div class="flex items-center gap-[10px]">
                                      <span>{new Date((m.createdAt ?? m.created_at)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                      {#if isMe}{@render statusTicks(m, 'text-white/80', 'text-white')}{/if}
                                   </div>
                                   <button onclick={(e) => { e.stopPropagation(); setReplyingTo(m); }} class="text-white/80 hover:text-white bg-transparent border-none cursor-pointer" title="Reply"><CornerUpLeft size={12} /></button>
                                   <button onclick={(e) => { e.stopPropagation(); handleShare(m); }} class="text-white/80 hover:text-white bg-transparent border-none cursor-pointer" title="Share"><Share size={12} /></button>
                                </div>
                             {/if}
                          </div>
                       {/each}
                    </div>
                 {:else if primaryAttachment}
                    <div 
                      data-image-container={m.id}
                      class="relative max-w-full inline-block group/img overflow-hidden rounded-none cursor-pointer transition-transform hover:scale-[1.005] bg-transparent border-0 shadow-none"
                      style="background: transparent; border: none; box-shadow: none; border-radius: 0;"
                      onclick={() => { if (!isSketchMode) zoomedImageId = m.id; }}
                    >
                       <img 
                         src={primaryAttachment.url} 
                         alt="attached" 
                         class="w-auto max-w-full h-auto max-h-[520px] object-contain rounded-none block border-0 shadow-none transition-opacity duration-500 {loadedImages[m.id] ? 'opacity-100' : 'opacity-0'}" 
                         style="aspect-ratio: auto; max-width: 100%; height: auto; border-radius: 0;"
                         onload={() => loadedImages[m.id] = true}
                       />
                       {#if imageStrokesForCard && imageStrokesForCard.length > 0}
                          <InkOverlay strokes={imageStrokesForCard} {isMe} />
                       {/if}
                       <div class="absolute bottom-3 right-3 text-[10px] font-bold text-white/90 drop-shadow-md flex items-center gap-2">
                          <div class="flex items-center gap-[10px]">
                             <span>{new Date((m.createdAt ?? m.created_at)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                             {#if isMe}{@render statusTicks(m, 'text-white/80', 'text-white')}{/if}
                          </div>
                          <button onclick={(e) => { e.stopPropagation(); setReplyingTo(m); }} class="text-white/80 hover:text-white bg-transparent border-none cursor-pointer" title="Reply"><CornerUpLeft size={12} /></button>
                          <button onclick={(e) => { e.stopPropagation(); handleShare(m); }} class="text-white/80 hover:text-white bg-transparent border-none cursor-pointer" title="Share"><Share size={12} /></button>
                       </div>
                    </div>
                 {/if}
                 {#if displayContent}
                    <div class="mt-2 w-full transition-all">
                       {@render replyBox(m)}
                       <div class="relative w-full inline-block">
                         <AnnotatableText
                           text={displayContent}
                           nodes={m.mathMeta?.nodes || null}
                           annotations={textStrokesForCard}
                           readonly={!isSketchMode}
                           {isSketchMode}
                           {isEraser}
                           activeColor={textColors[activeTextColorIndex].displayColor}
                           activeWidth={strokeWidth}
                           onAnnotationCreate={(stroke) => addPendingMark(m.id, { ...stroke, targetContainer: 'text', targetElement: 'text' })}
                           onStrokesChanged={(survivors) => handleMarkStrokesChanged(m.id, [...imageStrokesForCard, ...survivors])}
                           {isMe}
                           textColor={textStyleColor}
                           isBold={isMsgBold}
                           isItalic={isMsgItalic}
                           isUnderlined={isMsgUnderlined}
                           fontFamily={activeFontFamily}
                         />
                       </div>
                       <div class="flex items-center gap-2 mt-0.5 select-none w-full justify-start">
                          <div class="flex items-center gap-[10px]">
                             <span class={`text-[9px] font-mono font-extrabold uppercase tracking-wider ${isMe ? 'text-blue-800/50' : 'text-slate-400'}`}>
                                {new Date((m.createdAt ?? m.created_at)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                             </span>
                             {#if isMe}
                                {@render statusTicks(m, 'text-blue-400/60', 'text-orange-500')}
                             {/if}
                          </div>
                          <button onclick={() => setReplyingTo(m)} class="text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer p-0" title="Reply"><CornerUpLeft size={11} /></button>
                          <button onclick={() => handleShare(m)} class="text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer p-0" title="Share"><Share size={11} /></button>
                       </div>
                    </div>
                 {/if}
              {:else if msgType === 'audio' || audioAttachment}
                 {@render replyBox(m)}
                 <div class="w-full flex flex-col gap-1.5">
                    <AudioMessagePlayer 
                      messageId={m.id} 
                      url={audioAttachment?.url || ''} 
                      duration={audioAttachment?.duration || 0} 
                      waveform={audioAttachment?.waveform || []} 
                      isMe={isMe}
                      status={m.status}
                    />
                    <!-- Details & Actions (Timestamp, Reply/Share) -->
                    <div class="flex items-center gap-2 justify-start px-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
                       <div class="flex items-center gap-[10px]">
                          <span class="text-[9px] font-bold text-gray-500 font-sans tracking-wide">
                             {new Date((m.createdAt ?? m.created_at)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                       </div>
                       <button onclick={(e) => { e.stopPropagation(); setReplyingTo(m); }} class="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer p-0" title="Reply"><CornerUpLeft size={11} /></button>
                       <button onclick={(e) => { e.stopPropagation(); handleShare(m); }} class="text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer p-0" title="Share"><Share size={11} /></button>
                    </div>
                 </div>
              {:else if msgType === 'math_canvas'}
                  {@render replyBox(m)}
                  {#if m.mathMeta}
                     <div 
                        data-image-container={m.id}
                        class="w-full aspect-[16/10] relative overflow-hidden cursor-pointer group/mathcanvas bg-theme-card p-3 border-l-2 border-dashed border-ink/20"
                        style="clip-path: {getTornClipPath(m.id)}; filter: drop-shadow(0px 2px 4px rgba(10, 29, 51, 0.03)) drop-shadow(0px 8px 16px rgba(10, 29, 51, 0.06));"
                        onclick={() => { if (!isSketchMode) openCanvas(m); }}
                        role="button"
                        tabindex="0"
                        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCanvas(m); } }}
                     >
                        <img src={m.mathMeta.thumbnailData} alt="Math canvas" class="w-full h-full object-contain p-2" />
                        
                        <!-- pi badge positioned absolute top-right of the image -->
                        <div class="absolute top-3 right-3 bg-indigo-600 text-white w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center font-serif font-bold text-sm shadow-md select-none z-10 leading-none">
                           π
                        </div>

                        <!-- Subject tag at bottom-left if any -->
                        {#if m.mathMeta.subject && m.mathMeta.subject.toLowerCase() !== 'mathematics'}
                           <div class="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wider uppercase z-10">
                              {m.mathMeta.subject}
                           </div>
                        {/if}

                        <!-- If another user is currently editing: show chalk indicator -->
                        {#if m.mathMeta.chalkHolder && m.mathMeta.chalkHolder !== currentUserId}
                           <div class="absolute inset-x-3 top-3 left-3 max-w-[170px] bg-amber-500/95 backdrop-blur-sm text-white px-2 py-1 rounded-lg text-[9px] font-bold flex items-center gap-1 shadow-sm font-sans z-10 animate-pulse">
                              ✏️ {m.mathMeta.chalkHolderName || 'Someone'} is editing
                           </div>
                        {/if}
                        
                        <div class="absolute bottom-2.5 right-2.5 text-[9px] font-bold text-gray-700 bg-theme-card/75 backdrop-blur-[2px] px-2 py-0.5 rounded-full flex items-center gap-2 z-10">
                           <div class="flex items-center gap-[10px]">
                              <span>{new Date((m.createdAt ?? m.created_at)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {#if isMe}{@render statusTicks(m)}{/if}
                           </div>
                           <button onclick={(e) => { e.stopPropagation(); setReplyingTo(m); }} class="text-gray-400 hover:text-gray-800 bg-transparent border-none cursor-pointer p-0" title="Reply"><CornerUpLeft size={10} /></button>
                           <button onclick={(e) => { e.stopPropagation(); handleShare(m); }} class="text-gray-400 hover:text-gray-800 bg-transparent border-none cursor-pointer p-0" title="Share"><Share size={10} /></button>
                     </div>
                  </div>
               {/if}
              {:else}
                 {@const resolvedStrokes = getResolvedStrokes(m)}
                 {@const receivedMarks = receivedMarksByTarget[m.id] ?? []}
                 {@const draftMarks = pendingMarks[m.id] ?? []}
                 {@const allMarks = [...(resolvedStrokes || []), ...receivedMarks, ...draftMarks]}
                 {@const imageMarks = allMarks.filter(s => s.targetContainer === 'image' || s.targetElement === 'image')}
                 {@const textMarks = allMarks.filter(s => s.targetContainer !== 'image' && s.targetElement !== 'image')}
                 {@const annBounds = getAnnotationBounds(allMarks)}
                 {@const sketchAttachment = m.attachments?.find((a: any) => typeof a === 'object' && a.type === 'math_sketch')}
                 <div class="w-full relative" style={annBounds.extraBottomPadding > 0 ? `padding-bottom: ${annBounds.extraBottomPadding}px;` : ''}>
                    {@render replyBox(m)}
                    {#if sketchAttachment}
                       <div 
                         data-image-container={m.id}
                         class="w-full text-left p-0 overflow-hidden relative block rounded-none transition-all mb-2 cursor-pointer bg-transparent border-0 shadow-none"
                         style="background: transparent; border: none; box-shadow: none; border-radius: 0;"
                         onclick={() => { if (!isSketchMode) zoomedImageId = m.id; }}
                       >
                          <img 
                            src={sketchAttachment.url} 
                            alt="Math Sketch" 
                            class="w-auto max-w-full h-auto max-h-[520px] object-contain rounded-none block border-0 shadow-none transition-opacity duration-500 {loadedImages[m.id + '_sketch'] ? 'opacity-100' : 'opacity-0'}" 
                            style="aspect-ratio: auto; max-width: 100%; height: auto; border-radius: 0;"
                            onload={() => loadedImages[m.id + '_sketch'] = true}
                          />
                          {#if imageMarks.length > 0}
                             <InkOverlay strokes={imageMarks} {isMe} />
                          {/if}
                       </div>
                    {/if}
                    <div class="relative w-full inline-block {(!displayContent && textMarks && textMarks.length > 0) ? 'min-h-[140px]' : ''}">
                      <AnnotatableText
                        text={displayContent}
                        nodes={m.mathMeta?.nodes || null}
                        annotations={textMarks}
                        strokes={[]}
                        readonly={!isSketchMode}
                        {isSketchMode}
                        {isEraser}
                        bind:this={annotatableRefs[m.id]}
                        activeColor={textColors[activeTextColorIndex].displayColor}
                        activeWidth={strokeWidth}
                        onAnnotationCreate={(stroke) => addPendingMark(m.id, { ...stroke, targetContainer: 'text', targetElement: 'text' })}
                        onStrokesChanged={(survivors) => handleMarkStrokesChanged(m.id, [...imageMarks, ...survivors])}
                        {isMe}
                        textColor={textStyleColor}
                        isBold={isMsgBold}
                        isItalic={isMsgItalic}
                        isUnderlined={isMsgUnderlined}
                        fontFamily={activeFontFamily}
                      />
                    </div>
                 </div>
                 
                 <!-- Timestamp & Actions outside of bubble -->
                 <div class="flex items-center gap-2 mt-0.5 select-none w-full justify-start">
                    <div class="flex items-center gap-[10px]">
                       <span class={`text-[9px] font-mono font-extrabold uppercase tracking-wider ${isMe ? 'text-blue-800/50' : 'text-slate-400'}`}>
                          {formatMessageTime(m.createdAt ?? m.created_at)}
                       </span>
                       {#if isMe}
                          {@render statusTicks(m, 'text-blue-400/60', 'text-orange-500')}
                       {/if}
                    </div>
                    <button onclick={() => setReplyingTo(m)} class="text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer p-0 opacity-0 group-hover:opacity-100 transition-opacity animate-in fade-in duration-200" title="Reply"><CornerUpLeft size={11} /></button>
                    <button onclick={() => handleShare(m)} class="text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer p-0 opacity-0 group-hover:opacity-100 transition-opacity animate-in fade-in duration-200" title="Share"><Share size={11} /></button>
                 </div>
              {/if}

              <!-- Reactions Blocked in Text Bubbles (User Request) -->
            </div>

            <!-- Avatar on its own layer on top: never takes horizontal flex space and allows touch events through to bubble -->
            {#if !isMe}
              <div class="absolute top-0 right-4 pointer-events-none z-20 select-none">
                <div class="w-9 h-9 rounded-full overflow-hidden border-2 border-white shadow-sm bg-slate-100 flex items-center justify-center pointer-events-none">
                  <img src={resolvedProfile?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${resolvedProfile?.fullName || contactName}`} alt="partner avatar" class="w-full h-full object-cover pointer-events-none select-none" />
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/each}

      {#if typingUsersInThisConvo.length > 0}
        <div class="flex items-start gap-3 my-4 max-w-[300px] animate-in fade-in slide-in-from-bottom-2 duration-300">
           <div class="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-black/5 bg-[#ffe7db] flex items-center justify-center">
              {#if resolvedProfile?.avatarUrl}
                 <img src={resolvedProfile.avatarUrl} alt="Avatar" class="w-full h-full object-cover" />
              {:else}
                 <span class="text-xs font-bold text-orange-600">
                   {contactName.charAt(0).toUpperCase()}
                 </span>
              {/if}
           </div>
           <div class="flex flex-col gap-1">
              <span class="text-[10px] font-bold text-gray-500 capitalize tracking-wider px-1">{contactName} is typing...</span>
              <div class="py-2.5 px-4 rounded-[20px] rounded-bl-[4px] bg-blue-100 text-blue-950 border border-blue-200 flex items-center justify-center gap-1 w-12 h-8">
                 <div class="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style="animation-delay: -0.3s;"></div>
                 <div class="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style="animation-delay: -0.15s;"></div>
                 <div class="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" style="animation-delay: 0s;"></div>
              </div>
           </div>
        </div>
      {/if}

      <!-- Draft Editable Bubble -->
      {#if showMathKeyboard || msg.trim().length > 0 || isSketchMode || currentStrokes.length > 0 || stagedImages.length > 0}
        {@const draftBounds = getAnnotationBounds(currentStrokes)}
        <div bind:this={draftBubbleEl} data-draft-id="draft" oncontextmenu={handleContextMenu}
                      onpointerdown={!isSketchMode ? handlePointerDown : undefined} 
                      class="flex flex-col w-full items-start group relative overflow-visible transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
          <div class="flex items-start transition-transform duration-100 w-full pl-[27px] pr-4">
             <div class="flex-1 relative flex flex-col items-start min-w-0 w-full">
                {#if stagedImages.length > 0}
                   {#each stagedImages as img, imgIdx (img.id)}
                      <!-- Draft Image Container (No bevels, retains natural shape & ratio) -->
                      <div 
                        data-image-container="draft"
                        class="relative max-w-full inline-block group/draftimg overflow-visible mb-2 transition-all rounded-none cursor-pointer bg-transparent border-0 shadow-none {selectedDraftImageId === img.id ? 'ring-2 ring-blue-500' : ''}"
                        style="background: transparent; border: none; box-shadow: none; border-radius: 0;"
                        onclick={() => { if (!isSketchMode) selectDraftImage(img.id); }}
                      >
                         <div class="rounded-none overflow-hidden bg-transparent border-0 shadow-none" style="border-radius: 0;">
                           <img 
                             src={img.url} 
                             alt={img.name || 'staged attachment'} 
                             class="w-auto max-w-full h-auto max-h-[520px] object-contain rounded-none block border-0 shadow-none"
                             style="aspect-ratio: auto; max-width: 100%; height: auto; border-radius: 0;"
                           />
                         </div>
                         {#if stagedImageStrokes && stagedImageStrokes.length > 0}
                            <InkOverlay strokes={stagedImageStrokes} isMe={true} />
                         {/if}

                         <!-- Action bar for selected/hovered image -->
                         <div class="absolute top-2 right-2 flex items-center gap-1.5 z-30">
                           {#if selectedDraftImageId === img.id}
                              <span class="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                Selected
                              </span>
                              <button 
                                type="button"
                                onclick={(e) => { 
                                  e.stopPropagation(); 
                                  selectedDraftImageId = img.id; 
                                  document.getElementById('image-input')?.click(); 
                                }}
                                class="px-2 py-1 rounded-lg bg-black/60 hover:bg-black/80 text-white text-[11px] font-semibold flex items-center gap-1 shadow-md transition-all active:scale-95 border border-white/20 cursor-pointer"
                                title="Swap this image"
                              >
                                Swap
                              </button>
                              <button 
                                type="button"
                                onclick={(e) => { 
                                  e.stopPropagation(); 
                                  lastSelectedDraftImageId = img.id; 
                                  selectedDraftImageId = null; 
                                  document.getElementById('image-input')?.click(); 
                                }}
                                class="px-2 py-1 rounded-lg bg-black/60 hover:bg-black/80 text-white text-[11px] font-semibold flex items-center gap-1 shadow-md transition-all active:scale-95 border border-white/20 cursor-pointer"
                                title="Insert another image below this one"
                              >
                                + Below
                              </button>
                           {/if}
                           <button 
                             type="button"
                             onclick={(e) => { e.stopPropagation(); removeStagedImage(img.id); }}
                             class="w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-transform hover:scale-110 active:scale-95 shadow-md border border-white/20 z-30 cursor-pointer"
                             title="Remove image"
                             aria-label="Remove image"
                           >
                              <X size={15} strokeWidth={2.5} />
                           </button>
                         </div>
                      </div>

                      <!-- Text gap below this image -->
                      <div 
                        class="w-full transition-all relative mb-3 {isSketchMode ? 'min-h-[72px]' : ''}" 
                        style={draftBounds.extraBottomPadding > 0 ? `padding-bottom: ${draftBounds.extraBottomPadding}px;` : ''}
                        onclick={() => { switchFocusedGap(img.id); }}
                      >
                         {#if (!focusedGapImageId && imgIdx === 0) || focusedGapImageId === img.id}
                            <AnnotatableText
                              isEditor={true}
                              nodes={currentTree}
                              annotations={draftTextStrokes}
                              readonly={false}
                              {isSketchMode}
                              {isEraser}
                              activeColor={textColors[activeTextColorIndex].displayColor}
                              activeWidth={strokeWidth}
                              textColor={textColors[activeTextColorIndex].displayColor}
                              {isBold}
                              {isItalic}
                              {isUnderlined}
                              fontFamily={activeFontFamily}
                              {currentCursorPath}
                              {selectedNodeIds}
                              bind:textareaEl
                              onAnnotationCreate={(newAnn) => {
                                const annWithTarget = { ...newAnn, targetContainer: 'text', targetElement: 'text' };
                                if (!currentStrokes.some(s => s.id === annWithTarget.id)) {
                                  currentStrokes = [...currentStrokes, annWithTarget];
                                }
                              }}
                              onStrokesChanged={(survivors) => {
                                handleStrokesChanged([...stagedImageStrokes, ...survivors]);
                              }}
                              oncopy={handleCopy}
                              oncut={handleCut}
                              onpaste={handlePaste}
                              onkeydown={(e) => {
                                if (isSketchMode) return;
                                if (e.key === 'Backspace' && selectedNodeIds.size > 0) {
                                  e.preventDefault();
                                  currentTree = deleteNodes(currentTree, selectedNodeIds);
                                  selectionAnchorPath = null;
                                  currentCursorPath = { containerPath: [], offset: 0 };
                                }
                              }}
                              onpointerdown={!isSketchMode ? handlePointerDown : undefined}
                            />
                         {:else}
                            <div class="cursor-text w-full min-h-[1.75rem] py-0.5">
                               <AnnotatableText
                                 isEditor={false}
                                 nodes={img.gapTextTree && img.gapTextTree.length > 0 ? img.gapTextTree : null}
                                 text={img.gapTextTree && img.gapTextTree.length > 0 ? '' : 'Type text in this gap...'}
                                 annotations={[]}
                                 readonly={true}
                                 textColor={img.gapTextTree && img.gapTextTree.length > 0 ? textColors[activeTextColorIndex].displayColor : '#94a3b8'}
                               />
                            </div>
                         {/if}
                      </div>
                   {/each}
                {:else}
                   <!-- Default editor when no images are staged -->
                   <div class="w-full transition-all relative {isSketchMode ? 'min-h-[72px]' : ''}" style={draftBounds.extraBottomPadding > 0 ? `padding-bottom: ${draftBounds.extraBottomPadding}px;` : ''}>
                       <AnnotatableText
                         isEditor={true}
                         nodes={currentTree}
                         annotations={draftTextStrokes}
                         readonly={false}
                         {isSketchMode}
                         {isEraser}
                         activeColor={textColors[activeTextColorIndex].displayColor}
                         activeWidth={strokeWidth}
                         textColor={textColors[activeTextColorIndex].displayColor}
                         {isBold}
                         {isItalic}
                         {isUnderlined}
                         fontFamily={activeFontFamily}
                         {currentCursorPath}
                         {selectedNodeIds}
                         bind:textareaEl
                         onAnnotationCreate={(newAnn) => {
                           const annWithTarget = { ...newAnn, targetContainer: 'text', targetElement: 'text' };
                           if (!currentStrokes.some(s => s.id === annWithTarget.id)) {
                             currentStrokes = [...currentStrokes, annWithTarget];
                           }
                         }}
                         onStrokesChanged={(survivors) => {
                           handleStrokesChanged([...stagedImageStrokes, ...survivors]);
                         }}
                         oncopy={handleCopy}
                         oncut={handleCut}
                         onpaste={handlePaste}
                         onkeydown={(e) => {
                           if (isSketchMode) return;
                           if (e.key === 'Backspace' && selectedNodeIds.size > 0) {
                             e.preventDefault();
                             currentTree = deleteNodes(currentTree, selectedNodeIds);
                             selectionAnchorPath = null;
                             currentCursorPath = { containerPath: [], offset: 0 };
                           }
                         }}
                         onpointerdown={!isSketchMode ? handlePointerDown : undefined}
                       />
                   </div>
                {/if}
             </div>
          </div>
        </div>
        <div 
          class="w-full shrink-0 transition-[height] duration-300 pointer-events-auto"
          style="height: {keyboardSpacingSpacerHeight}px;"
          onpointerdown={!isSketchMode ? handlePointerDown : undefined}
        ></div>
      {/if}
      </div>
    </div>

    <!-- Full Screen Image Preview Overlay -->
    {#if zoomedImageId}
      {@const zoomedMsg = messages.find(m => m.id === zoomedImageId)}
      {@const zoomedImg = zoomedMsg?.attachments?.find((a: any) => a.type === 'image' || a.type === 'math_sketch')}
      {@const zoomedVideo = zoomedMsg?.attachments?.find((a: any) => a.type === 'video')}
      
      <div 
        class="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 select-none"
        onclick={() => zoomedImageId = null}
        ontouchstart={(e) => startX = e.touches[0].clientX}
        ontouchend={(e) => {
          const diff = e.changedTouches[0].clientX - startX;
          if (diff > 50) navigateMedia(-1);
          if (diff < -50) navigateMedia(1);
        }}
      >
         <button class="absolute top-10 right-10 text-white bg-theme-card/10 p-4 rounded-full border-none cursor-pointer hover:bg-theme-card/20 transition-colors z-[110]">
            <X size={32} />
         </button>

         {#if currentMediaIndex > 0}
            <button onclick={(e) => { e.stopPropagation(); navigateMedia(-1); }} class="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-theme-card/10 p-4 rounded-full border-none cursor-pointer hover:bg-theme-card/20 z-[110]">
              <ChevronLeft size={32} />
            </button>
         {/if}

         {#if currentMediaIndex < mediaMessages.length - 1}
            <button onclick={(e) => { e.stopPropagation(); navigateMedia(1); }} class="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-theme-card/10 p-4 rounded-full border-none cursor-pointer hover:bg-theme-card/20 z-[110]">
              <ChevronRight size={32} />
            </button>
         {/if}

         <div class="relative w-full h-full flex items-center justify-center pointer-events-none">
           {#if zoomedImg}
              <div 
                class="relative flex items-center justify-center rounded-none overflow-hidden pointer-events-auto shadow-none transition-all max-w-[90vw] max-h-[90vh]"
                style="background: transparent; border-radius: 0; min-width: 150px; min-height: 150px;"
              >
                 <img 
                   src={zoomedImg.url} 
                   alt="Zoomed" 
                   class="max-w-full max-h-[90vh] object-contain rounded-none animate-in zoom-in-95 duration-200 transition-opacity duration-300 {loadedImages[(zoomedMsg?.id || '') + '_zoomed'] ? 'opacity-100' : 'opacity-0'}" 
                   style="border-radius: 0;"
                   onload={() => loadedImages[(zoomedMsg?.id || '') + '_zoomed'] = true}
                 />
              </div>
           {:else if zoomedVideo}
              <video 
                src={zoomedVideo.url} 
                controls 
                autoplay
                class="max-w-full max-h-full rounded-xl shadow-2xl pointer-events-auto"
              >
                <track kind="captions" />
              </video>
           {/if}

           <div class="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/60 text-sm font-bold bg-theme-card/10 px-4 py-2 rounded-full backdrop-blur-md">
              {currentMediaIndex + 1} / {mediaMessages.length}
           </div>
         </div>
      </div>
    {/if}

    <div class="absolute bottom-0 left-0 right-0 z-40 pointer-events-none flex flex-col items-center">
      <footer class="w-full px-3 sm:px-5 pt-3 sm:pt-4 {showMathKeyboard ? 'pb-2 sm:pb-3' : 'pb-6 sm:pb-10'} flex justify-center pointer-events-none transition-all duration-300">
        <div class="w-full max-w-lg pointer-events-auto bg-transparent relative">
        
        {#if replyingToMessage}
          <div class="mb-3 p-3 bg-theme-card rounded-2xl shadow-[0_10px_25px_rgba(0,0,0,0.1)] border border-gray-100 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-2 fade-in duration-200">
             <div class="flex items-center gap-2 min-w-0 flex-1 self-stretch">
                <div class="w-1 self-stretch min-h-[36px] bg-orange-500 rounded-full flex-shrink-0"></div>
                <div class="flex flex-col min-w-0 flex-1 justify-center">
                   <span class="text-[9px] font-bold text-orange-500 uppercase tracking-wider leading-tight">
                      Replying to {replyingToMessage.isMe ? 'yourself' : contactName}
                   </span>
                   <p class="text-xs text-gray-600 italic break-words whitespace-normal line-clamp-3 leading-snug m-0 mt-0.5">
                      {replyingToMessage.type === 'audio' ? '🎤 Voice note' : replyingToMessage.type === 'image' ? '📷 Image' : replyingToMessage.type === 'video' ? '🎥 Video' : formatMathAsPlainText(replyingToMessage.content)}
                   </p>
                </div>
             </div>
             <button onclick={() => replyingToMessage = null} class="p-1 text-gray-400 hover:text-gray-600 border-none bg-transparent cursor-pointer">
                <X size={16} />
             </button>
          </div>
        {/if}
        
        <div class="w-full flex items-center justify-center pointer-events-auto">
          {#if isRecording}
             <div class="flex-1 h-11 bg-rose-50/90 backdrop-blur-md border border-rose-200/40 rounded-xl px-4 flex items-center justify-between gap-3 transition-all duration-300 shadow-sm">
                <div class="flex items-center gap-2 flex-shrink-0">
                   <div class="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
                   <span class="text-xs font-mono font-bold text-red-750">{formatTime(recordingDuration)}</span>
                </div>
                
                <!-- Streaming Sound Waves viz -->
                <div class="flex-1 h-8 flex items-center justify-center gap-[2px] overflow-hidden select-none px-2">
                   {#each recordingWaveform.slice(-25) as amp}
                      <div 
                         class="w-[3px] bg-red-500/80 rounded-full transition-all duration-75"
                         style:height="{amp}%"
                      ></div>
                   {/each}
                </div>

                <div class="flex items-center gap-1.5 flex-shrink-0">
                   <button onclick={discardRecording} class="p-2 text-gray-500 hover:text-red-650 hover:bg-red-50 rounded-lg border-none bg-transparent cursor-pointer transition-colors" title="Discard">
                      <Trash2 size={16} />
                   </button>
                   <button onclick={stopAndSendRecording} class="w-8 h-8 bg-red-650 text-white rounded-lg flex items-center justify-center shadow hover:bg-red-750 hover:scale-105 active:scale-95 transition-all border-none cursor-pointer" title="Send Voice Message">
                      <Send size={13} />
                   </button>
                </div>
             </div>
          {:else}
             <div class="flex items-center justify-center gap-2 sm:gap-3.5 md:gap-4 w-full relative px-[5px] sm:px-3">
                <!-- 1. Formatting button and menu -->
                <div class="relative shrink-0">
                    <button 
                      onclick={() => showFormattingPanel = !showFormattingPanel} 
                      class="transition-all border border-blue-600 shadow-sm cursor-pointer flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full shrink-0 hover:scale-105 active:scale-95 text-[#00274d] hover:bg-blue-50/50 bg-white" 
                      title="Text Formatting & Colors"
                    >
                       <Type size={20} strokeWidth={2.2} />
                    </button>

                    {#if showFormattingPanel}
                       <!-- Column containing 2 rows: one for colors, one for text formatting -->
                       <div class="absolute bottom-12 left-0 z-50 mb-1 bg-white/95 backdrop-blur border border-gray-200 shadow-xl rounded-2xl p-5 flex flex-col gap-3.5 min-w-[170px] sm:min-w-[190px] animate-in fade-in slide-in-from-bottom-2 duration-150">
                          <!-- Row 1: Colors selection -->
                          <div class="flex items-center justify-center gap-3">
                             {#each textColors as color, idx}
                                <button
                                  onclick={() => { selectTextColor(idx); showFormattingPanel = false; }}
                                  class="w-8 h-8 rounded-full transition-all flex items-center justify-center cursor-pointer hover:scale-110 active:scale-95 border border-black/10 relative shadow-sm shrink-0"
                                  style="background-color: {color.displayColor};"
                                  title={color.name}
                                >
                                   {#if activeTextColorIndex === idx}
                                      <Check size={14} strokeWidth={3} class="text-white drop-shadow-sm font-bold" />
                                   {/if}
                                </button>
                             {/each}
                          </div>

                          <!-- Row 2: Text Formatting -->
                          <div class="flex items-center justify-center gap-3 border-t border-gray-100 pt-3.5">
                             <!-- Bold Button -->
                             <button
                               onclick={() => { isBold = !isBold; showFormattingPanel = false; }}
                               class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all border {isBold ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-50'}"
                               title="Bold"
                             >
                                <span class="font-extrabold text-sm font-sans">B</span>
                             </button>
                             <!-- Italic Button -->
                             <button
                               onclick={() => { isItalic = !isItalic; showFormattingPanel = false; }}
                               class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all border {isItalic ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-50'}"
                               title="Italic"
                             >
                                <span class="italic font-serif font-bold text-sm">I</span>
                             </button>
                             <!-- Underline Button -->
                             <button
                               onclick={() => { isUnderlined = !isUnderlined; showFormattingPanel = false; }}
                               class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all border {isUnderlined ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-50'}"
                               title="Underline"
                             >
                                <span class="underline underline-offset-2 font-bold text-sm font-sans">U</span>
                             </button>
                          </div>
                       </div>
                    {/if}
                </div>

                <!-- 2. Pencil button (Sketch / Annotation Mode) -->
                <div class="relative shrink-0">
                  <button 
                    onclick={toggleSketchMode} 
                    oncontextmenu={(e) => { e.preventDefault(); selectTextColor((activeTextColorIndex + 1) % textColors.length); }}
                    style="background-color: {textColors[activeTextColorIndex].displayColor};"
                    class="transition-all shadow-sm cursor-pointer flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full shrink-0 hover:scale-105 active:scale-95 text-white border {isSketchMode ? 'border-white ring-2 ring-offset-2 ring-[#00274d] shadow-md scale-105' : 'border-black/15 hover:shadow-md'}" 
                    title={isSketchMode ? `Exit Annotation Mode (Ink: ${textColors[activeTextColorIndex].name})` : `Annotation Tool (Ink: ${textColors[activeTextColorIndex].name} - Right-click to cycle color)`}
                  >
                     <Pencil size={20} strokeWidth={2.2} />
                  </button>
                </div>

                {#if isSketchMode}
                  <!-- Eraser button when sketch mode is active -->
                  <div class="relative shrink-0">
                    <button 
                      onclick={() => { isEraser = !isEraser; }} 
                      class="transition-all border shadow-sm cursor-pointer flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full shrink-0 hover:scale-105 active:scale-95 {isEraser ? 'bg-rose-600 text-white border-transparent ring-2 ring-rose-500/30' : 'text-[#00274d] hover:bg-blue-50/50 bg-white border-blue-600'}" 
                      title={isEraser ? "Eraser Active (Tap to Draw)" : "Eraser (Tap to Erase Strokes)"}
                    >
                       <Eraser size={20} strokeWidth={2.2} />
                    </button>
                  </div>
                {/if}

                <!-- 3. Plus button (Attach) -->
                <button 
                  onclick={() => { document.getElementById('image-input')?.click(); }} 
                  class="text-[#00274d] hover:bg-blue-50/50 transition-all bg-white border border-blue-600 shadow-sm cursor-pointer flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full shrink-0 hover:scale-105 active:scale-95" 
                  title="Attach Image"
                >
                   <Plus size={20} strokeWidth={2.2} />
                </button>

                <!-- 4. Mic trigger -->
                <button onclick={startRecording} class="text-[#00274d] hover:bg-blue-50/50 transition-colors bg-white border border-blue-600 shadow-sm cursor-pointer flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full shrink-0 hover:scale-105 active:scale-95" title="Record Voice Message">
                   <Mic size={20} strokeWidth={2.2} />
                </button>

                <!-- 5. Pi formula trigger -->
                <button onclick={openMathCanvas} class="text-[#00274d] hover:bg-blue-50/50 transition-colors bg-white border border-blue-600 shadow-sm cursor-pointer flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full shrink-0 hover:scale-105 active:scale-95" title="Math Assistant & Canvas">
                   <Pi size={20} strokeWidth={2.2} />
                </button>

                <!-- 6. Undo -->
                {#if (isSketchMode && canSketchUndo) || (!isSketchMode && historyIndex > 0)}
                   <button 
                     onclick={isSketchMode ? handleSketchUndo : handleDraftUndo} 
                     class="text-[#00274d] hover:bg-blue-50/50 transition-all bg-white border border-blue-600 shadow-sm cursor-pointer flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full shrink-0 hover:scale-105 active:scale-95" 
                     title="Undo"
                   >
                      <Undo size={20} strokeWidth={2.2} />
                   </button>
                {:else}
                   <button 
                     disabled 
                     class="text-blue-300 bg-white border border-blue-200 shadow-sm flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full shrink-0 cursor-not-allowed" 
                     title="Undo (No history)"
                   >
                      <Undo size={20} strokeWidth={2.2} />
                   </button>
                {/if}

                <!-- 7. Redo -->
                {#if (isSketchMode && canSketchRedo) || (!isSketchMode && historyIndex < msgHistory.length - 1)}
                   <button 
                     onclick={isSketchMode ? handleSketchRedo : handleDraftRedo} 
                     class="text-[#00274d] hover:bg-blue-50/50 transition-all bg-white border border-blue-600 shadow-sm cursor-pointer flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full shrink-0 hover:scale-105 active:scale-95" 
                     title="Redo"
                   >
                      <Redo size={20} strokeWidth={2.2} />
                   </button>
                {:else}
                   <button 
                     disabled 
                     class="text-blue-300 bg-white border border-blue-200 shadow-sm flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full shrink-0 cursor-not-allowed" 
                     title="Redo (No history)"
                   >
                      <Redo size={20} strokeWidth={2.2} />
                   </button>
                {/if}

                <!-- 8. Send button & anchored jump button -->
                <div class="relative shrink-0 flex items-center justify-center">
                  {#if showNewMsgBtn}
                    <button 
                      onclick={() => scrollToBottom('smooth')}
                      aria-label="Scroll to bottom"
                      class="absolute {replyingToMessage ? 'bottom-[calc(100%+70px)]' : 'bottom-full mb-3'} right-0 z-[45] w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white hover:bg-blue-50/50 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#00274d] dark:text-blue-300 border border-blue-600 dark:border-blue-400 shadow-sm flex items-center justify-center active:scale-95 hover:scale-105 transition-all duration-200 cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 animate-in fade-in zoom-in-75"
                    >
                      <ChevronDown size={18} class="text-[#00274d] dark:text-blue-300 group-hover:translate-y-0.5 transition-transform" strokeWidth={2.5} />
                      {#if unreadCountBelow > 0}
                        <span class="absolute -top-1.5 -right-1.5 px-1 min-w-[18px] h-4.5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md tabular-nums border border-white dark:border-slate-800 animate-in zoom-in-75 duration-150">
                          {unreadCountBelow > 99 ? '99+' : unreadCountBelow}
                        </span>
                      {/if}
                    </button>
                  {/if}

                  <button 
                    onclick={handleSend}
                    class="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#ff6b00] hover:bg-[#e15d00] text-white flex items-center justify-center transition-all cursor-pointer border-none shadow-md active:scale-95 shrink-0 hover:scale-105"
                    title="Send Message"
                  >
                    <Send size={18} strokeWidth={2.5} class="ml-0.5" />
                  </button>
                </div>
             </div>
          {/if}
        </div>
        </div>
      </footer>
      
      
  {#if showContextMenu}
    <div 
      class="fixed z-[9999] bg-white border border-gray-200 shadow-xl rounded-lg flex items-center overflow-hidden"
      style="left: {Math.max(10, Math.min(window.innerWidth - 150, contextMenuPos.x))}px; top: {Math.max(10, contextMenuPos.y)}px;"
    >
      {#if selectedNodeIds && selectedNodeIds.size > 0}
        <button 
          class="px-4 py-3 text-sm font-medium hover:bg-gray-50 border-r border-gray-200 text-gray-800"
          onclick={(e) => { e.stopPropagation(); execCopy(); }}
        >Copy</button>
        <button 
          class="px-4 py-3 text-sm font-medium hover:bg-gray-50 border-r border-gray-200 text-gray-800"
          onclick={(e) => { e.stopPropagation(); execCut(); }}
        >Cut</button>
      {/if}
      <button 
        class="px-4 py-3 text-sm font-medium hover:bg-gray-50 text-gray-800"
        onclick={(e) => { e.stopPropagation(); execPaste(); }}
      >Paste</button>
    </div>
  {/if}

      {#if showMathKeyboard}
        <div class="w-full shrink-0 shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.15)] relative z-[60] bg-[#f2f4f6] border-t border-zinc-200 transition-all duration-200 {isSketchMode ? 'opacity-40 pointer-events-none select-none grayscale cursor-not-allowed' : 'pointer-events-auto'}">
          <MathKeyboard 
            bind:currentTree={currentTree}
            bind:currentCursorPath={currentCursorPath}
            bind:selectionAnchorPath={selectionAnchorPath}
            {selectedNodeIds}
            activeColor={textColors[activeTextColorIndex].displayColor}
            isOpen={true}
            onsend={handleSend} />
        </div>
      {/if}

      <input type="file" accept="image/*" capture="environment" id="camera-input" class="hidden" onchange={handleImageUpload} />
      <input type="file" accept="image/*" id="image-input" class="hidden" multiple onchange={handleImageUpload} />
    </div>
  </div>

  {#if activeCall}
    <div class="absolute inset-0 z-[100] bg-gray-900/95 text-white flex flex-col items-center justify-center p-6 backdrop-blur-xl">
      <div class="relative w-full max-w-sm flex-1 max-h-[70vh] bg-black rounded-[40px] overflow-hidden shadow-2xl mt-10 flex flex-col items-center justify-center">
        {#if activeCall.type === 'video'}
           <!-- Render Remote Streams First -->
           {#if activeCall.remoteStreams && activeCall.remoteStreams.size > 0}
              {#each [...activeCall.remoteStreams.entries()] as [uid, stream]}
                <!-- svelte-ignore a11y_media_has_caption -->
                <video
                  class="w-full h-full object-cover"
                  autoplay
                  playsinline
                  use:setStream={stream}
                ></video>
              {/each}
              
              <!-- Local stream small overlay -->
              <div class="absolute bottom-4 right-4 w-24 h-32 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl">
                <!-- svelte-ignore a11y_media_has_caption -->
                <video
                  class="w-full h-full object-cover"
                  autoplay
                  muted
                  playsinline
                  use:setStream={activeCall?.localStream}
                ></video>
              </div>
           {:else}
              <!-- Only local stream available -->
              <!-- svelte-ignore a11y_media_has_caption -->
              <video
                class="w-full h-full object-cover"
                autoplay
                muted
                playsinline
                use:setStream={activeCall?.localStream}
              ></video>
              <div class="absolute inset-0 flex items-center justify-center bg-black/40 text-white font-medium text-lg">
                 Waiting for others...
              </div>
           {/if}
        {:else}
           <div class="w-full h-full flex flex-col items-center justify-center bg-gray-800/50">
             <div class="w-24 h-24 rounded-full overflow-hidden border-4 border-white/20 shadow-xl mb-6">
               <img src={resolvedProfile?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${resolvedProfile?.fullName || contactName}`} alt="avatar" class="w-full h-full object-cover bg-theme-card" />
             </div>
             <h2 class="text-2xl font-bold mb-2">{resolvedProfile?.fullName || contactName}</h2>
             <p class="text-sm text-gray-400">00:00</p>
             <div class="flex gap-2 mt-8">
               <div class="w-2 h-2 bg-green-400 rounded-full animate-bounce"></div>
               <div class="w-2 h-2 bg-green-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
               <div class="w-2 h-2 bg-green-400 rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
             </div>
           </div>
        {/if}
      </div>

      <div class="mt-8 flex items-center gap-6 mb-10">
        <button 
          onclick={toggleMute} 
          class="w-16 h-16 rounded-full flex items-center justify-center cursor-pointer border-none shadow-lg transition-colors text-white {isMuted ? 'bg-red-650' : 'bg-theme-card/10 hover:bg-theme-card/20'}"
          title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
        >
          <Mic size={24} />
        </button>
        <button onclick={endCall} class="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center cursor-pointer border-none shadow-lg hover:bg-red-700 text-white" title="End Call">
          <Phone size={32} class="rotate-[135deg]" />
        </button>
        <button 
          onclick={toggleCamera} 
          class="w-16 h-16 rounded-full flex items-center justify-center cursor-pointer border-none shadow-lg transition-colors text-white {!isCameraOn ? 'bg-red-650' : 'bg-theme-card/10 hover:bg-theme-card/20'}"
          title={isCameraOn ? "Turn Camera Off" : "Turn Camera On"}
        >
          <Video size={24} />
        </button>
      </div>
    </div>
  {/if}

  {#if incomingCallDoc}
    <!-- Incoming Call Ring Overlay -->
    <div class="fixed inset-x-4 top-4 z-[110] max-w-lg mx-auto p-4 bg-slate-950/95 text-white rounded-3xl border border-white/10 flex items-center justify-between shadow-2xl backdrop-blur-3xl">
      <div class="flex items-center gap-3">
        <div class="relative">
          <div class="w-12 h-12 rounded-2xl overflow-hidden bg-[#00274d] flex items-center justify-center border border-white/10 shadow-lg">
            <Phone size={20} class="text-green-400 rotate-[90deg] animate-pulse" />
          </div>
          <div class="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
          <div class="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full"></div>
        </div>
        <div>
          <h4 class="text-sm font-bold tracking-tight leading-snug">Incoming {incomingCallDoc.type === 'video' ? 'Video' : 'Voice'} Call</h4>
          <p class="text-[11px] text-white/60 font-medium">{contactName} is calling...</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button onclick={declineIncomingCall} class="px-3.5 py-1.5 rounded-xl bg-red-650 hover:bg-red-700 transition-all border-none text-xs font-bold text-white cursor-pointer shadow-md active:scale-95 hover:scale-105">Decline</button>
        <button onclick={answerIncomingCall} class="px-4 py-1.5 rounded-xl bg-green-500 hover:bg-green-600 transition-all border-none text-xs font-bold text-white cursor-pointer shadow-md active:scale-95 hover:scale-105 animate-pulse">Answer</button>
      </div>
    </div>
  {/if}

  {#if toast}
    <div class="fixed top-24 left-1/2 -translate-x-1/2 z-[150] w-[90%] max-w-sm bg-slate-950/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-white/10 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
      <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 {toast.type === 'error' ? 'bg-red-500/20 text-red-400' : toast.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}">
        {#if toast.type === 'error'}
          <X size={20} />
        {:else if toast.type === 'success'}
          <Check size={20} />
        {:else}
          <Clock size={20} />
        {/if}
      </div>
      <div class="flex-grow font-sans">
        <h4 class="text-xs font-bold text-white tracking-wide leading-none mb-1">{toast.title}</h4>
        <p class="text-[11px] text-gray-300 leading-normal font-medium">{toast.body}</p>
      </div>
      <button onclick={() => toast = null} class="text-gray-400 hover:text-white p-1 bg-transparent border-none cursor-pointer">
        <X size={16} />
      </button>
    </div>
  {/if}
  
  {#if isMathCanvasOpen}
     <MathMessageCanvas 
       bind:isOpen={isMathCanvasOpen} 
       initialDoc={activeMathDocument}
       mathMessage={activeMathMessage}
       unreadCount={renderedMessages.filter(m => !m.isMe && m.status !== 'read').length}
       onsend={async (formula, imgUrl) => {
          try {
             let attachments = [];
             if (imgUrl) attachments.push({ url: imgUrl, type: 'math_sketch' });
             triggerNotification('Sending Math', { body: 'Processing mathematical data...', type: 'info' });
             await messagingService.sendMessage(activeConversationId, formula, 'math', attachments);
             ensureRealConversationId();
             triggerNotification('Sent', { body: 'Math message sent successfully.', type: 'success' });
             clearCanvas();
             mathFormula = '';
          } catch (err) {
             console.error('Failed to send math message:', err);
             triggerNotification('Error', { body: 'Failed to send math message.', type: 'error' });
          }
       }}
       onsendcanvas={async (elementsList, thumbnailData) => {
          try {
             triggerNotification('Uploading Canvas', { body: 'Saving whiteboard changes...', type: 'info' });
             
             // 1. Prepare MathDocument
             const docId = crypto.randomUUID();
             const parentSessionId = activeMathDocument?.parentDocumentId || activeMathDocument?.documentId || docId;
             
             const newDoc: any = {
                documentId: docId,
                parentDocumentId: parentSessionId,
                subject: activeMathDocument?.subject || 'Mathematics',
                curriculumLevel: activeMathDocument?.curriculumLevel || 'gcse',
                viewport: activeMathDocument?.viewport || { x: 0, y: 0, zoom: 1 },
                createdBy: currentUserId,
                createdAt: new Date().toISOString(),
                version: (activeMathDocument?.version || 0) + 1,
                elements: elementsList,
                operations: []
             };
             
             // 2. Upload MsgPack file to storage
             const fileId = await uploadMathDocument(newDoc);
             
             // 3. Create mathMeta payload
             const mathMeta = {
                fileId,
                documentId: docId,
                parentDocumentId: parentSessionId,
                subject: newDoc.subject,
                curriculumLevel: newDoc.curriculumLevel,
                thumbnailData,
                elementCount: elementsList.length, versionAudioIds: activeMathDocument?.versionAudioIds ? [...activeMathDocument.versionAudioIds, ""] : [""],
                annotationCount: elementsList.filter((e: any) => e.isAnnotation).length,
                chalkHolder: null,
                chalkHolderName: null,
                versionChainIds: activeMathDocument?.versionChainIds ? [...activeMathDocument.versionChainIds, docId] : [docId],
                versionFileIds: activeMathDocument?.versionFileIds ? [...activeMathDocument.versionFileIds, fileId] : [fileId],
                versionAuthorIds: activeMathDocument?.versionAuthorIds ? [...activeMathDocument.versionAuthorIds, currentUserId] : [currentUserId],
                versionAuthorNames: activeMathDocument?.versionAuthorNames ? [...activeMathDocument.versionAuthorNames, currentUserName] : [currentUserName],
                currentVersionIndex: activeMathDocument?.versionChainIds ? activeMathDocument.versionChainIds.length : 0
             };
             
             // 4. Record the canvas session in local RxDB which replicates automatically
             const db = await dbService.getRawDB();
             const msgId = activeMathMessage ? activeMathMessage.id : 'msg_' + crypto.randomUUID().substring(0, 16);
             
             let editChain = [docId];
             if (parentSessionId && parentSessionId !== docId) {
                try {
                   const parentSession = await db.canvas_sessions.findOne(parentSessionId).exec();
                   if (parentSession) {
                      editChain = [...(parentSession.editChain || []), docId];
                   }
                } catch (e) {
                   console.warn('Failed tracking editChain:', e);
                 }
              }
              
              await db.canvas_sessions.upsert({
                 id: docId,
                 threadId: activeConversationId,
                 messageId: msgId,
                 parentSessionId,
                 subject: newDoc.subject,
                 curriculumLevel: newDoc.curriculumLevel,
                 createdBy: currentUserId,
                 createdAt: new Date().toISOString(),
                 chalkHolder: null,
                 chalkHolderName: null,
                 chalkAcquiredAt: null,
                 activeUsers: [currentUserId],
                 editChain,
                 operationCount: 0
              });
              
              // 5. Send or update chat message
              if (activeMathMessage) {
                 await messagingService.updateMathMessage(activeMathMessage.id, mathMeta);
                 
                 // Also persist the last seen to local storage
                 if (mathMeta.currentVersionIndex !== undefined) {
                    const lastSeenKey = `last_seen_${activeMathMessage.id}_${currentUserId}`;
                    localStorage.setItem(lastSeenKey, String(mathMeta.currentVersionIndex));
                 }
                 
                 activeMathMessage = {
                    ...activeMathMessage,
                    mathMeta
                 };
                 
                 triggerNotification('Updated Whiteboard', { body: 'Whiteboard version added successfully.', type: 'success' });
              } else {
                 const sentMessage = await messagingService.sendMessage(
                    activeConversationId, 
                    `Collaborative Math Whiteboard`, 
                    'math_canvas', 
                    [], 
                    mathMeta
                 );
                 ensureRealConversationId();
                 activeMathMessage = sentMessage;
                 triggerNotification('Sent Whiteboard', { body: 'Whiteboard message sent successfully.', type: 'success' });
              }
              
              newDoc.versionChainIds = mathMeta.versionChainIds;
              newDoc.versionFileIds = mathMeta.versionFileIds;
              newDoc.versionAuthorIds = mathMeta.versionAuthorIds;
              newDoc.versionAuthorNames = mathMeta.versionAuthorNames;
              newDoc.versionAudioIds = mathMeta.versionAudioIds || [];
              newDoc.currentVersionIndex = mathMeta.currentVersionIndex;
              
              activeMathDocument = newDoc;
           } catch (err) {
              console.error('Failed to send whiteboard canvas:', err);
              triggerNotification('Error', { body: 'Failed to send math whiteboard.', type: 'error' });
           }
        }}
     />
  {/if}

  <UserProfileLightbox 
     bind:isOpen={isProfileLightboxOpen} 
     bind:user={profileData} 
     isComrade={isComrade}
     isInvited={isInvited}
     onMessage={(u) => { triggerNotification('Messaging', { body: `You are already chatting with ${u.name}.`, type: 'info' }) }}
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
        } else {
            triggerNotification('Error', { body: 'Failed to remove comrade.', type: 'error' });
        }
     }}
  />
</div>
