<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { Delete, CornerDownLeft, ChevronLeft, ChevronRight, Send } from 'lucide-svelte';
  import { type MathNode, type CursorPath, getContainer } from '../math/mathModel';
  import { insertFraction, jumpToOppositeFractionSlot, exitFraction, insertExponent, jumpOrExitExponent, insertSqrt, exitSqrt, insertNthroot, jumpToOppositeNthrootSlot, exitNthroot,
  insertLongdiv, jumpToOppositeLongdivSlot, jumpToLongdivQuotientSlot, exitLongdiv, insertChar, backspace, insertSubscript, jumpOrExitSubscript, insertBracket, closeAndExitBracket, handleEvaluationBracket, insertIntegral, insertIntegralWithLimits, handleEvaluationBar, insertEvaluationBar, insertUnderbrace, jumpToOppositeUnderbraceSlot, exitUnderbrace } from '../math/mathOperations';

  import { serializeTree, deserializeTree } from '../math/mathSerialization';
  import { getNodeById } from '../math/mathModel';

  export let currentTree: MathNode[] = [];
  export let currentCursorPath: CursorPath | null = null;
  export let selectionAnchorPath: CursorPath | null = null;
  export let selectedNodeIds: Set<string> = new Set();
  import { deleteNodes } from "../math/mathOperations";
  import { keyHaptic } from '../native';
  export let value: string | undefined = undefined;
  export let isOpen = true;
  export let activeColor: string = '#1d4ed8';
  export let onsend: (() => void) | null = null;
  export let textareaRef: HTMLTextAreaElement | null = null;

  // Sync value -> currentTree only when value changes externally
  let prevValue = value;
  $: if (value !== undefined && value !== prevValue) {
    prevValue = value;
    const serialized = serializeTree(currentTree);
    if (value !== serialized) {
      currentTree = deserializeTree(value);
      currentCursorPath = { containerPath: [], offset: currentTree.length };
    }
  }

  function getPrecedingText(): string {
    if (!currentCursorPath) return '';
    const container = getContainer(currentTree, currentCursorPath.containerPath);
    const precedingNodes = container.slice(0, currentCursorPath.offset);
    let text = '';
    for (const node of precedingNodes) {
      if (node.type === 'char') {
        text += node.value;
      } else {
        text += ' ';
      }
    }
    return text;
  }

  function autoCapitalizeIfNeeded() {
    if (shiftState === 'capslock') return;
    const text = getPrecedingText();
    const shouldCapitalize = /(^|[\.\?!]|\n)\s*$/.test(text);
    if (shouldCapitalize) {
      shiftState = 'once';
      abcMode = 'upper';
    } else {
      shiftState = 'none';
      abcMode = 'lower';
    }
  }

  onMount(() => {
    autoCapitalizeIfNeeded();
  });

  $: if (activeTab === 'abc' && (currentTree || currentCursorPath)) {
    autoCapitalizeIfNeeded();
  }

  // Helper to sync currentTree -> value internally
  function syncValue() {
    if (value !== undefined) {
      const serialized = serializeTree(currentTree);
      if (value !== serialized) {
        value = serialized;
        prevValue = value;
      }
    }
  }

  let activeTab: '123' | 'fn' | 'abc' | 'greek' | 'sym' = 'abc';
  let abcMode: 'lower' | 'upper' = 'lower';
  let shiftState: 'none' | 'once' | 'capslock' = 'none';
  let shiftLongPressTimer: any = null;
  let isShiftLongPressed = false;

  function handleShiftDown(e: PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    isShiftLongPressed = false;
    
    // Start long press timer
    shiftLongPressTimer = setTimeout(() => {
      shiftState = 'capslock';
      abcMode = 'upper';
      isShiftLongPressed = true;
    }, 500); // 500ms long press threshold
  }

  function handleShiftUp(e: PointerEvent) {
    e.stopPropagation();
    if (shiftLongPressTimer) {
      clearTimeout(shiftLongPressTimer);
      shiftLongPressTimer = null;
    }
    
    if (!isShiftLongPressed) {
      // Toggle logic
      if (shiftState === 'none') {
        shiftState = 'once';
        abcMode = 'upper';
      } else {
        shiftState = 'none';
        abcMode = 'lower';
      }
    }
    isShiftLongPressed = false;
  }

  function clearShiftTimer() {
    if (shiftLongPressTimer) {
      clearTimeout(shiftLongPressTimer);
      shiftLongPressTimer = null;
    }
  }

  let fractionState: 'none' | 'num' | 'den' = 'none';
  let fractionTapTimer: any = null;
  let fractionTapCount = 0;
  let underbraceState: 'none' | 'content' | 'label' = 'none';

  onDestroy(() => {
    if (fractionTapTimer) {
      clearTimeout(fractionTapTimer);
    }
  });

  function executeFractionAction(count: number) {
    if (!currentCursorPath) return;
    if (count >= 2) {
      const result = insertFraction(currentTree, currentCursorPath, activeColor);
      currentTree = result.tree;
      currentCursorPath = result.cursor;
    } else {
      if (fractionState === 'none') {
        const result = insertFraction(currentTree, currentCursorPath, activeColor);
        currentTree = result.tree;
        currentCursorPath = result.cursor;
        fractionState = 'num';
      } else if (fractionState === 'num') {
        currentCursorPath = jumpToOppositeFractionSlot(currentTree, currentCursorPath);
        fractionState = 'den';
      } else if (fractionState === 'den') {
        currentCursorPath = exitFraction(currentTree, currentCursorPath);
        fractionState = 'none';
      }
    }
    syncValue();
  }

  let nthrootState: 'none' | 'index' | 'content' = 'none';
  let longdivState: 'none' | 'index' | 'content' | 'quotient' = 'none';
  let isInsideSuperscript = false;
  let isInsideSubscript = false;
  let isInsideSquareLimit = false;
  let isInsideSquareSuperscript = false;
  let isInsideSquareSubscript = false;
  
  let isInsideEvalBarLimit = false;
  let isInsideEvalBarSuperscript = false;
  let isInsideEvalBarSubscript = false;
  let isInsideIntegralLimit = false;
  let isInsideIntegralSuperscript = false;
  let isInsideIntegralSubscript = false;
  let isSquareRootMode = false;
  let isBracketMode = false;

  function updateActiveStates() {
    if (!currentCursorPath) {
      fractionState = 'none';
      nthrootState = 'none';
      longdivState = 'none';
      underbraceState = 'none';
      isInsideSuperscript = false;
      isInsideSubscript = false;
      isInsideSquareLimit = false;
      isInsideSquareSuperscript = false;
      isInsideSquareSubscript = false;
      isInsideEvalBarLimit = false;
      isInsideEvalBarSuperscript = false;
      isInsideEvalBarSubscript = false;
      isInsideIntegralLimit = false;
      isInsideIntegralSuperscript = false;
      isInsideIntegralSubscript = false;
      isSquareRootMode = false;
      isBracketMode = false;
      return;
    }
    
    const idxFrac = currentCursorPath.containerPath.findLastIndex(c => c.slot === 'numerator' || c.slot === 'denominator');
    fractionState = idxFrac !== -1 ? (currentCursorPath.containerPath[idxFrac].slot === 'numerator' ? 'num' : 'den') : 'none';

    const idxNth = currentCursorPath.containerPath.findIndex(c => {
      const node = getNodeById(currentTree, c.nodeId);
      return node?.type === 'nthroot' && (c.slot === 'index' || c.slot === 'content');
    });
    nthrootState = idxNth !== -1 ? (currentCursorPath.containerPath[idxNth].slot === 'index' ? 'index' : 'content') : 'none';

    const idxUnder = currentCursorPath.containerPath.findIndex(c => {
      const node = getNodeById(currentTree, c.nodeId);
      return node?.type === 'underbrace' && (c.slot === 'content' || c.slot === 'label');
    });
    underbraceState = idxUnder !== -1 ? (currentCursorPath.containerPath[idxUnder].slot as any) : 'none';

    const idxLong = currentCursorPath.containerPath.findIndex(c => {
      const node = getNodeById(currentTree, c.nodeId);
      return node?.type === 'longdiv' && (c.slot === 'index' || c.slot === 'content' || c.slot === 'quotient');
    });
    longdivState = idxLong !== -1 ? (currentCursorPath.containerPath[idxLong].slot as any) : 'none';

    // Normal exponent and subscript
    isInsideSuperscript = currentCursorPath.containerPath.some(c => c.slot === 'exponent' && getNodeById(currentTree, c.nodeId)?.type === 'exponent');
    isInsideSubscript = currentCursorPath.containerPath.some(c => c.slot === 'subscript' && getNodeById(currentTree, c.nodeId)?.type === 'subscript');

    // Evaluation and Square limits
    const squareBracketIdx = currentCursorPath.containerPath.findIndex(c => {
      const node = getNodeById(currentTree, c.nodeId);
      return c.nodeId !== 'root' && node?.type === 'bracket' && node.bracketKind === 'square' && (c.slot === 'subscript' || c.slot === 'superscript');
    });
    isInsideSquareLimit = squareBracketIdx !== -1;
    isInsideSquareSuperscript = currentCursorPath.containerPath.some(c => c.slot === 'superscript' && getNodeById(currentTree, c.nodeId)?.type === 'bracket' && getNodeById(currentTree, c.nodeId)?.bracketKind === 'square');
    isInsideSquareSubscript = currentCursorPath.containerPath.some(c => c.slot === 'subscript' && getNodeById(currentTree, c.nodeId)?.type === 'bracket' && getNodeById(currentTree, c.nodeId)?.bracketKind === 'square');

    const evalBarBracketIdx = currentCursorPath.containerPath.findIndex(c => {
      const node = getNodeById(currentTree, c.nodeId);
      return c.nodeId !== 'root' && node?.type === 'bracket' && node.bracketKind === 'evaluation' && (c.slot === 'subscript' || c.slot === 'superscript');
    });
    isInsideEvalBarLimit = evalBarBracketIdx !== -1;
    isInsideEvalBarSuperscript = currentCursorPath.containerPath.some(c => c.slot === 'superscript' && getNodeById(currentTree, c.nodeId)?.type === 'bracket' && getNodeById(currentTree, c.nodeId)?.bracketKind === 'evaluation');
    isInsideEvalBarSubscript = currentCursorPath.containerPath.some(c => c.slot === 'subscript' && getNodeById(currentTree, c.nodeId)?.type === 'bracket' && getNodeById(currentTree, c.nodeId)?.bracketKind === 'evaluation');

    const integralLimitIdx = currentCursorPath.containerPath.findIndex(c => c.nodeId !== 'root' && getNodeById(currentTree, c.nodeId)?.type === 'integral' && (c.slot === 'subscript' || c.slot === 'superscript'));
    isInsideIntegralLimit = integralLimitIdx !== -1;
    isInsideIntegralSuperscript = currentCursorPath.containerPath.some(c => c.slot === 'superscript' && getNodeById(currentTree, c.nodeId)?.type === 'integral');
    isInsideIntegralSubscript = currentCursorPath.containerPath.some(c => c.slot === 'subscript' && getNodeById(currentTree, c.nodeId)?.type === 'integral');

    isSquareRootMode = currentCursorPath.containerPath.some(c => c.slot === 'content' && c.nodeId !== 'root' && getNodeById(currentTree, c.nodeId)?.type === 'sqrt');
    isBracketMode = currentCursorPath.containerPath.some(c => c.slot === 'content' && c.nodeId !== 'root' && getNodeById(currentTree, c.nodeId)?.type === 'bracket');
  }

  $: {
    // Reactive dependency on currentCursorPath to update states
    if (currentCursorPath || !currentCursorPath) {
      updateActiveStates();
    }
  }

  const dispatch = createEventDispatcher();

  const deleteSelection = () => {
    if (selectedNodeIds && selectedNodeIds.size > 0 && selectionAnchorPath) {
      currentTree = deleteNodes(currentTree, selectedNodeIds);
      currentCursorPath = { containerPath: [], offset: 0 };
      selectionAnchorPath = null;
      selectedNodeIds = new Set();
    } else {
      selectionAnchorPath = null;
      syncValue();
    }
  };

  const handleChar = (char: string) => {
    if (!currentCursorPath) return;
    deleteSelection();
    const result = insertChar(currentTree, currentCursorPath, char, activeColor);
    currentTree = result.tree;
    currentCursorPath = result.cursor;
  };

  const handleBackspace = () => {
    if (!currentCursorPath) return;
    if (selectedNodeIds && selectedNodeIds.size > 0 && selectionAnchorPath) {
      deleteSelection();
      syncValue();
      return;
    }
    const result = backspace(currentTree, currentCursorPath);
    currentTree = result.tree;
    currentCursorPath = result.cursor;
    syncValue();
  };

  const moveCursor = (dir: -1 | 1) => {
    // Implement tree traversal based cursor movement
    // For simplicity right now, this requires walking the tree
    // However, the spec mostly requires tap-based repositioning, so we can defer complex keyboard movement
  };

  const onPress = (key: string) => {
    if (!currentCursorPath) return;

    if (key !== 'fraction') {
      if (fractionTapTimer) {
        clearTimeout(fractionTapTimer);
        fractionTapTimer = null;
        const count = fractionTapCount;
        fractionTapCount = 0;
        executeFractionAction(count);
      }
    }

    if (key !== 'BACKSPACE' && key !== 'ENTER' && key !== 'LEFT' && key !== 'RIGHT') {
      deleteSelection();
    }

    if (key === 'fraction') {
      fractionTapCount++;
      if (!fractionTapTimer) {
        fractionTapTimer = setTimeout(() => {
          const count = fractionTapCount;
          fractionTapCount = 0;
          fractionTapTimer = null;
          executeFractionAction(count);
        }, 250);
      }
      return;
    }

    if (key === '□ⁿ' || key === 'e^' || key === '10^') {
      const idx = currentCursorPath.containerPath.findLastIndex(c => c.slot === 'exponent' && getNodeById(currentTree, c.nodeId)?.type === 'exponent');
      if (idx === -1) {
        if (key === 'e^') handleChar('e');
        if (key === '10^') { handleChar('1'); handleChar('0'); }
        const result = insertExponent(currentTree, currentCursorPath, activeColor);
        currentTree = result.tree;
        currentCursorPath = result.cursor;
      } else {
        currentCursorPath = jumpOrExitExponent(currentTree, currentCursorPath);
      }
      return;
    }

    if (key === '√') {
      const idx = currentCursorPath.containerPath.findIndex(c => c.slot === 'content' && c.nodeId !== 'root' && getNodeById(currentTree, c.nodeId)?.type === 'sqrt');
      if (idx === -1) {
        const result = insertSqrt(currentTree, currentCursorPath, activeColor);
        currentTree = result.tree;
        currentCursorPath = result.cursor;
      } else {
        currentCursorPath = exitSqrt(currentTree, currentCursorPath);
      }
      return;
    }

    
    if (key === 'longdiv') {
      if (longdivState === 'none') {
        const result = insertLongdiv(currentTree, currentCursorPath, activeColor);
        currentTree = result.tree;
        currentCursorPath = result.cursor;
        longdivState = 'index';
      } else if (longdivState === 'index') {
        currentCursorPath = jumpToOppositeLongdivSlot(currentTree, currentCursorPath);
        longdivState = 'content';
      } else if (longdivState === 'content') {
        currentCursorPath = jumpToLongdivQuotientSlot(currentTree, currentCursorPath);
        longdivState = 'quotient';
      } else if (longdivState === 'quotient') {
        currentCursorPath = exitLongdiv(currentTree, currentCursorPath);
        longdivState = 'none';
      }
      return;
    }

    if (key === 'nthroot') {
      if (nthrootState === 'none') {
        const result = insertNthroot(currentTree, currentCursorPath, activeColor);
        currentTree = result.tree;
        currentCursorPath = result.cursor;
        nthrootState = 'index';
      } else if (nthrootState === 'index') {
        currentCursorPath = jumpToOppositeNthrootSlot(currentTree, currentCursorPath);
        nthrootState = 'content';
      } else if (nthrootState === 'content') {
        currentCursorPath = exitNthroot(currentTree, currentCursorPath);
        nthrootState = 'none';
      }
      return;
    }

    if (key === '□ₙ') {
      const idx = currentCursorPath.containerPath.findLastIndex(c => c.slot === 'subscript' && getNodeById(currentTree, c.nodeId)?.type === 'subscript');
      if (idx === -1) {
        const result = insertSubscript(currentTree, currentCursorPath, activeColor);
        currentTree = result.tree;
        currentCursorPath = result.cursor;
      } else {
        currentCursorPath = jumpOrExitSubscript(currentTree, currentCursorPath);
      }
      return;
    }

    if (key === 'underbrace') {
      if (underbraceState === 'none') {
        const result = insertUnderbrace(currentTree, currentCursorPath, activeColor);
        currentTree = result.tree;
        currentCursorPath = result.cursor;
        underbraceState = 'content';
      } else if (underbraceState === 'content') {
        currentCursorPath = jumpToOppositeUnderbraceSlot(currentTree, currentCursorPath);
        underbraceState = 'label';
      } else if (underbraceState === 'label') {
        currentCursorPath = exitUnderbrace(currentTree, currentCursorPath);
        underbraceState = 'none';
      }
      syncValue();
      return;
    }

    if (key === '|□|') {
      const result = insertBracket(currentTree, currentCursorPath, 'absolute', activeColor);
      currentTree = result.tree;
      currentCursorPath = result.cursor;
      return;
    }

    if (key === '()' || key === '(') {
      const result = insertBracket(currentTree, currentCursorPath, 'parentheses', activeColor);
      currentTree = result.tree;
      currentCursorPath = result.cursor;
      return;
    }

    if (key === '[' || key === '{') {
      const result = insertBracket(currentTree, currentCursorPath, key === '[' ? 'square' : 'curly', activeColor);
      currentTree = result.tree;
      currentCursorPath = result.cursor;
      return;
    }

    if (key === ']subsup') {
      const result = handleEvaluationBracket(currentTree, currentCursorPath, activeColor);
      currentTree = result.tree;
      currentCursorPath = result.cursor;
      syncValue();
      return;
    }

    if (key === 'evaluation') {
      const result = insertEvaluationBar(currentTree, currentCursorPath, activeColor);
      currentTree = result.tree;
      currentCursorPath = result.cursor;
      syncValue();
      return;
    }

    if (key === 'evaluation_subsup') {
      const result = handleEvaluationBar(currentTree, currentCursorPath, activeColor);
      currentTree = result.tree;
      currentCursorPath = result.cursor;
      syncValue();
      return;
    }

    if (key === 'integration') {
      const result = insertIntegral(currentTree, currentCursorPath, activeColor);
      currentTree = result.tree;
      currentCursorPath = result.cursor;
      syncValue();
      return;
    }

    if (key === 'integration_subsup') {
      const result = insertIntegralWithLimits(currentTree, currentCursorPath, activeColor);
      currentTree = result.tree;
      currentCursorPath = result.cursor;
      syncValue();
      return;
    }

    if (key === ')' || key === ']' || key === '}') {
      const result = closeAndExitBracket(currentTree, currentCursorPath, key);
      currentTree = result.tree;
      currentCursorPath = result.cursor;
      syncValue();
      return;
    }

    if (key === 'Tab') {
      handleChar(' ');
      handleChar(' ');
      handleChar(' ');
      if (shiftState === 'once') {
        shiftState = 'none';
        abcMode = 'lower';
      }
      syncValue();
      return;
    }

    if (key === 'BACKSPACE') {
      handleBackspace();
    } else if (key === 'ENTER') {
      const result = insertChar(currentTree, currentCursorPath, '\n', activeColor);
      currentTree = result.tree;
      currentCursorPath = result.cursor;
    } else if (key === 'LEFT') {
      moveCursor(-1);
    } else if (key === 'RIGHT') {
      moveCursor(1);
    } else if (key === 'SHIFT') {
      if (shiftState === 'none') {
        shiftState = 'once';
        abcMode = 'upper';
      } else {
        shiftState = 'none';
        abcMode = 'lower';
      }
    } else if (key === 'ABC') {
      activeTab = 'abc';
      abcMode = 'lower';
      shiftState = 'none';
    } else if (key === 'GREEK') {
      activeTab = 'greek';
    } else {
      handleChar(key);
      if (shiftState === 'once') {
        shiftState = 'none';
        abcMode = 'lower';
      }
    }
    
    syncValue();
  };

  let touchStartX = 0;
  let touchEndX = 0;
  let isSwiping = false;
  let ignoreSwipe = false;

  const tabs: ('fn' | 'abc' | 'greek' | 'sym' | '123')[] = ['greek', 'fn', '123', 'abc', 'sym'];

  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length > 1) {
      ignoreSwipe = true;
      return;
    }
    if (e.touches.length === 1) {
      ignoreSwipe = false;
    }
    isSwiping = false;
    touchStartX = e.touches[0].clientX;
  }

  function handleTouchEnd(e: TouchEvent) {
    if (ignoreSwipe) {
      if (e.touches.length === 0) ignoreSwipe = false;
      return;
    }
    touchEndX = e.changedTouches[0].clientX;
    handleSwipe();
  }

  function handleMouseDown(e: MouseEvent) {
    isSwiping = false;
    touchStartX = e.clientX;
  }

  function handleMouseUp(e: MouseEvent) {
    touchEndX = e.clientX;
    handleSwipe();
  }

  function handleSwipe() {
    const swipeThreshold = 50;
    const distance = touchEndX - touchStartX;
    if (distance < -swipeThreshold) {
      const currentIndex = tabs.indexOf(activeTab as any);
      activeTab = currentIndex === -1 ? 'greek' : tabs[(currentIndex + 1) % tabs.length];
      isSwiping = true;
    } else if (distance > swipeThreshold) {
      const currentIndex = tabs.indexOf(activeTab as any);
      activeTab = currentIndex === -1 ? 'sym' : tabs[(currentIndex - 1 + tabs.length) % tabs.length];
      isSwiping = true;
    }
  }

  let keyStartX = 0;
  let keyStartY = 0;

  function handleKeyStart(e: PointerEvent) {
    e.preventDefault();
    keyHaptic();
    keyStartX = e.clientX;
    keyStartY = e.clientY;
  }

  function checkKeyTap(e: PointerEvent): boolean {
    e.stopPropagation();
    const endX = e.clientX;
    const endY = e.clientY;
    const dist = Math.hypot(endX - keyStartX, endY - keyStartY);
    return dist < 15;
  }

  let backspaceTimeout: any = null;
  let backspaceInterval: any = null;
  let backspaceStartX = 0;
  let backspaceStartY = 0;

  function startBackspace(e: PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    clearBackspace();
    
    backspaceStartX = e.clientX;
    backspaceStartY = e.clientY;
    
    onPress('BACKSPACE');
    
    backspaceTimeout = setTimeout(() => {
      backspaceInterval = setInterval(() => {
        onPress('BACKSPACE');
      }, 75);
    }, 400);
  }

  function moveBackspace(e: PointerEvent) {
    if (backspaceTimeout || backspaceInterval) {
      const dist = Math.hypot(e.clientX - backspaceStartX, e.clientY - backspaceStartY);
      if (dist > 15) {
        clearBackspace();
      }
    }
  }

  function clearBackspace() {
    if (backspaceTimeout) {
      clearTimeout(backspaceTimeout);
      backspaceTimeout = null;
    }
    if (backspaceInterval) {
      clearInterval(backspaceInterval);
      backspaceInterval = null;
    }
  }
</script>

{#if isOpen}
<div class="w-full bg-[#1e1f22] text-gray-100 flex flex-col font-sans select-none animate-in slide-in-from-bottom-5 duration-200 touch-none" style="-webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; padding-bottom: env(safe-area-inset-bottom);" oncontextmenu={(e) => e.preventDefault()} onselectstart={(e) => e.preventDefault()} ontouchstart={handleTouchStart} ontouchend={handleTouchEnd} onmousedown={handleMouseDown} onmouseup={handleMouseUp}>
  <!-- Tabs -->
  <div class="flex items-center px-4 py-2 gap-4 bg-[#1e1f22] border-none pt-2">
    <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { activeTab = 'greek'; } }} class="px-4.5 py-2.5 rounded-[6px] font-bold transition-colors cursor-pointer border-none {activeTab === 'greek' ? 'bg-[#2d2f33] text-[#8ab4f8]' : 'bg-[#2d2f33] text-gray-200'}">αβγ</button>
    <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { activeTab = 'fn'; } }} class="px-4.5 py-2.5 rounded-[6px] font-bold transition-colors cursor-pointer border-none {activeTab === 'fn' ? 'bg-[#2d2f33] text-[#8ab4f8]' : 'bg-[#2d2f33] text-gray-200'}">f(x)</button>
    <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { activeTab = 'abc'; abcMode = 'lower'; } }} class="px-4.5 py-2.5 rounded-[6px] font-bold transition-colors cursor-pointer border-none {activeTab === 'abc' ? 'bg-[#2d2f33] text-[#8ab4f8]' : 'bg-[#2d2f33] text-gray-200'}">abc</button>
    <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { activeTab = 'sym'; } }} class="px-4.5 py-2.5 rounded-[6px] font-bold transition-colors cursor-pointer border-none {activeTab === 'sym' ? 'bg-[#2d2f33] text-[#8ab4f8]' : 'bg-[#2d2f33] text-gray-200'}">#&amp;¬</button>
  </div>

  <!-- Keys -->
  <div class="keyboard-grid p-2 gap-2 flex flex-col pb-4 h-[290px]">
    {#if activeTab === '123'}
      <div class="flex gap-1 flex-1">
        {#each "1234567890".split('') as num}
          <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress(num); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">{num}</button>
        {/each}
      </div>
      <div class="flex gap-1 flex-1">
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('underbrace'); } }} class="flex-1 rounded-[6px] {underbraceState !== 'none' ? 'bg-[#8ab4f8] text-[#2d2f33]' : 'bg-[#3c4043] text-white'} shadow-none font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51] flex items-center justify-center">
            <div class="flex flex-col items-center justify-center relative w-10 h-10 select-none">
                <!-- Content (box above) -->
                <div class="w-3 h-3 border-[1.5px] {underbraceState === 'content' ? 'border-solid border-[#1d4ed8] bg-white' : 'border-dotted border-current'} rounded-[2px] mb-[2px]"></div>
                <!-- Underbrace path -->
                <svg class="w-6 h-2 fill-none stroke-current" viewBox="0 0 24 8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M 0 0 Q 0 4, 3 4 L 9 4 Q 12 4, 12 8 Q 12 4, 15 4 L 21 4 Q 24 4, 24 0" />
                </svg>
                <!-- Label (box below) -->
                <div class="w-2.5 h-2.5 border-[1.5px] {underbraceState === 'label' ? 'border-solid border-[#1d4ed8] bg-white' : 'border-dotted border-current'} rounded-[2px] mt-[1px]"></div>
            </div>
        </button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('evaluation'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">□|</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('evaluation_subsup'); } }} class="flex-1 rounded-[6px] {isInsideEvalBarLimit ? 'bg-[#8ab4f8] text-[#2d2f33]' : 'bg-[#3c4043] text-white'} shadow-none font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51] flex items-center justify-center">
            <div class="flex items-center justify-center relative w-8 h-8">
                <!-- Evaluation bar | -->
                <span class="absolute text-xl select-none leading-none font-sans left-[10px]">|</span>
                <!-- Superscript box (top right) -->
                <div class="absolute top-[3px] left-[18px] w-2.5 h-2.5 border-[1.5px] {isInsideEvalBarSuperscript ? 'border-solid border-[#1d4ed8] bg-white' : 'border-dotted border-current'} rounded-[2px]"></div>
                <!-- Subscript box (bottom right) -->
                <div class="absolute bottom-[3px] left-[18px] w-2.5 h-2.5 border-[1.5px] {isInsideEvalBarSubscript ? 'border-solid border-[#1d4ed8] bg-white' : 'border-dotted border-current'} rounded-[2px]"></div>
            </div>
        </button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('integration'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">∫</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('integration_subsup'); } }} class="flex-1 rounded-[6px] {isInsideIntegralLimit ? 'bg-[#8ab4f8] text-[#2d2f33]' : 'bg-[#3c4043] text-white'} shadow-none font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51] flex items-center justify-center">
            <div class="flex items-center justify-center relative w-8 h-8">
                <!-- Integration ∫ -->
                <span class="absolute text-xl select-none leading-none font-sans left-[6px]">∫</span>
                <!-- Superscript box (top right) -->
                <div class="absolute top-[3px] left-[18px] w-2.5 h-2.5 border-[1.5px] {isInsideIntegralSuperscript ? 'border-solid border-[#1d4ed8] bg-white' : 'border-dotted border-current'} rounded-[2px]"></div>
                <!-- Subscript box (bottom right) -->
                <div class="absolute bottom-[3px] left-[18px] w-2.5 h-2.5 border-[1.5px] {isInsideIntegralSubscript ? 'border-solid border-[#1d4ed8] bg-white' : 'border-dotted border-current'} rounded-[2px]"></div>
            </div>
        </button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('['); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">[</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress(']'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">]</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress(']subsup'); } }} class="flex-1 rounded-[6px] {isInsideSquareLimit ? 'bg-[#8ab4f8] text-[#2d2f33]' : 'bg-[#3c4043] text-white'} shadow-none font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51] flex items-center justify-center">
            <div class="flex items-center justify-center relative w-8 h-8">
                <!-- Bracket ] -->
                <span class="absolute text-xl select-none leading-none font-sans left-[8px]">]</span>
                <!-- Superscript box (top right) -->
                <div class="absolute top-[3px] left-[18px] w-2.5 h-2.5 border-[1.5px] {isInsideSquareSuperscript ? 'border-solid border-[#1d4ed8] bg-white' : 'border-dotted border-current'} rounded-[2px]"></div>
                <!-- Subscript box (bottom right) -->
                <div class="absolute bottom-[3px] left-[18px] w-2.5 h-2.5 border-[1.5px] {isInsideSquareSubscript ? 'border-solid border-[#1d4ed8] bg-white' : 'border-dotted border-current'} rounded-[2px]"></div>
            </div>
        </button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('×'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">×</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('÷'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">÷</button>
      </div>
      <div class="flex gap-1 flex-1">
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('□ⁿ'); } }} class="flex-1 rounded-[6px] {isInsideSuperscript ? 'bg-[#8ab4f8] text-[#2d2f33]' : 'bg-[#3c4043] text-white'} shadow-none font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">□ⁿ</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('□ₙ'); } }} class="flex-1 rounded-[6px] {isInsideSubscript ? 'bg-[#8ab4f8] text-[#2d2f33]' : 'bg-[#3c4043] text-white'} shadow-none font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">□ₙ</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('√'); } }} class="flex-1 rounded-[6px] {isSquareRootMode ? 'bg-[#8ab4f8] text-[#2d2f33]' : 'bg-[#3c4043] text-white'} shadow-none font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">√</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('nthroot'); } }} class="flex-1 rounded-[6px] {nthrootState !== 'none' ? 'bg-[#8ab4f8] text-[#2d2f33]' : 'bg-[#3c4043] text-white'} shadow-none font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51] flex items-center justify-center">
            <div class="flex items-center justify-center relative w-10 h-8">
               <!-- Index box (top left) -->
               <div class="absolute top-[3px] left-[3px] w-2.5 h-2.5 border-[1.5px] {nthrootState === 'index' ? 'border-solid border-[#1d4ed8] bg-white' : 'border-dotted border-current'} rounded-[2px]"></div>
               <!-- Root sign (larger, moved down) -->
               <span class="absolute top-[5px] left-[11px] text-[22px] select-none leading-none font-sans font-normal">√</span>
               <!-- Radicand box (inside root) -->
               <div class="absolute bottom-[3px] right-[4px] w-3 h-3 border-[1.5px] {nthrootState === 'content' ? 'border-solid border-[#1d4ed8] bg-white' : 'border-dotted border-current'} rounded-[2px]"></div>
            </div>
        </button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('longdiv'); } }} class="flex-1 rounded-[6px] {longdivState !== 'none' ? 'bg-[#8ab4f8] text-[#2d2f33]' : 'bg-[#3c4043] text-white'} shadow-none font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51] flex items-center justify-center">
            <div class="flex items-center justify-center relative w-10 h-8">
               <!-- Index box (left) -->
               <div class="absolute bottom-[4px] left-[2px] w-3 h-3 border-[1.5px] {longdivState === 'index' ? 'border-solid border-[#1d4ed8] bg-white' : 'border-dotted border-current'} rounded-[2px]"></div>
               <!-- Longdiv sign -->
               <svg class="absolute top-[4px] left-[14px] w-[12px] h-[22px]" viewBox="0 0 12 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                 <path d="M 1 20 Q 7 11, 1 2 L 11 2" />
               </svg>
               <!-- Quotient box (above longdiv) -->
               <div class="absolute top-[2px] right-[2px] w-2.5 h-2.5 border-[1.5px] {longdivState === 'quotient' ? 'border-solid border-[#1d4ed8] bg-white' : 'border-dotted border-current'} rounded-[2px]"></div>
               <!-- Content box (inside longdiv) -->
               <div class="absolute bottom-[4px] right-[2px] w-3 h-3 border-[1.5px] {longdivState === 'content' ? 'border-solid border-[#1d4ed8] bg-white' : 'border-dotted border-current'} rounded-[2px]"></div>
            </div>
        </button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('{'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">{"{"}</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('}'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">{"}"}</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('+'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">+</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('-'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">-</button>
      </div>
      <div class="flex gap-1 flex-1">
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('<'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">&lt;</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('>'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">&gt;</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('fraction'); } }} class="flex-1 rounded-[6px] {fractionState !== 'none' ? 'bg-[#8ab4f8] text-[#2d2f33]' : 'bg-[#3c4043] text-white'} shadow-none font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51] flex items-center justify-center">
            <div class="flex flex-col items-center gap-[2px]">
               <div class="w-3 h-3 border-[1.5px] {fractionState === 'num' ? 'border-solid border-[#1d4ed8] bg-white' : 'border-dotted border-current'} rounded-[2px]"></div>
               <div class="w-4 h-[1.5px] bg-current"></div>
               <div class="w-3 h-3 border-[1.5px] {fractionState === 'den' ? 'border-solid border-[#1d4ed8] bg-white' : 'border-dotted border-current'} rounded-[2px]"></div>
            </div>
        </button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('%'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51] flex items-center justify-center gap-1">%</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('('); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">(</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress(')'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">)</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('='); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">=</button>
        <button onpointerdown={startBackspace} onpointerup={clearBackspace} onpointerleave={clearBackspace} onpointercancel={clearBackspace} onpointermove={moveBackspace} class="flex-1 rounded-[6px] bg-[#9ca3af] shadow-none text-slate-800 flex justify-center items-center cursor-pointer border border-transparent active:bg-[#6b7280]">
           <Delete size={20} />
        </button>
      </div>
      <div class="flex gap-1 flex-1">
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { activeTab = 'abc'; abcMode = 'lower'; } }} class="flex-[1.5] rounded-[6px] bg-[#2d2f33] shadow-none text-white font-sans text-sm font-bold flex justify-center items-center cursor-pointer border border-transparent active:bg-[#3c4043]">abc</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress(','); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl flex justify-center items-center cursor-pointer border border-transparent active:bg-[#4a4d51]">,</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('Tab'); } }} class="flex-[1.2] rounded-[6px] bg-[#2d2f33] shadow-none text-white font-sans text-sm font-semibold flex justify-center items-center cursor-pointer border border-transparent active:bg-[#3c4043]">Tab</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress(' '); } }} class="flex-[4] rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl flex justify-center items-center cursor-pointer border border-transparent active:bg-[#4a4d51]">—</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('?'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl flex justify-center items-center cursor-pointer border border-transparent active:bg-[#4a4d51]">?</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('ENTER'); } }} class="flex-[1.5] rounded-[6px] bg-blue-500 shadow-sm flex justify-center items-center cursor-pointer border border-transparent active:bg-blue-600 text-white"><CornerDownLeft size={20}/></button>
      </div>
    
    {:else if activeTab === 'fn'}
      <div class="flex gap-1 flex-1">
        {#each "1234567890".split('') as num}
          <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress(num); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">{num}</button>
        {/each}
      </div>
      <div class="flex gap-1 flex-1">
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('sin'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">sin</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('cos'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">cos</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('tan'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">tan</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('%'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">%</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('!'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">!</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('$'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">$</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('°'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">°</button>
      </div>
      <div class="flex gap-1 flex-1 px-[2%]">
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('sin⁻¹'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">sin⁻¹</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('cos⁻¹'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">cos⁻¹</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('tan⁻¹'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">tan⁻¹</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('{'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">&#123;</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('}'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">&#125;</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('≤'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">≤</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('≥'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">≥</button>
      </div>
      <div class="flex gap-1 flex-1">
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('ln'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">ln</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('log₁₀'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">log₁₀</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('log_'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">log_</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('d/dx'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">d/dx</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('∫'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">∫</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('i'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">i</button>
        <button onpointerdown={startBackspace} onpointerup={clearBackspace} onpointerleave={clearBackspace} onpointercancel={clearBackspace} onpointermove={moveBackspace} class="flex-[1.2] rounded-[6px] bg-[#2d2f33] shadow-none text-white flex justify-center items-center cursor-pointer border border-transparent active:bg-[#3c4043]"><Delete size={20} /></button>
      </div>
      <div class="flex gap-1 flex-1">
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('e^'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">e^</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('10^'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">10^</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('∛'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">∛</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('□_□'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">□_□</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('ENTER'); } }} class="flex-[1.5] rounded-[6px] bg-blue-500 shadow-sm flex justify-center items-center cursor-pointer border border-transparent active:bg-blue-600 text-white"><CornerDownLeft size={20}/></button>
      </div>
    
    {:else if activeTab === 'abc'}
      <div class="flex gap-1 flex-1">
        {#each "1234567890".split('') as num}
          <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress(num); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">{num}</button>
        {/each}
      </div>
      <div class="flex gap-1 flex-1">
        {#each (abcMode === 'lower' ? "qwertyuiop".split('') : "QWERTYUIOP".split('')) as char}
          <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress(char); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">{char}</button>
        {/each}
      </div>
      <div class="flex gap-1 flex-1 px-[5%]">
        {#each (abcMode === 'lower' ? "asdfghjkl".split('') : "ASDFGHJKL".split('')) as char}
          <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress(char); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">{char}</button>
        {/each}
      </div>
      <div class="flex gap-1 flex-1">
        <button 
          onpointerdown={handleShiftDown} 
          onpointerup={handleShiftUp} 
          onpointerleave={clearShiftTimer} 
          onpointercancel={clearShiftTimer} 
          class="flex-[1.5] rounded-[6px] {shiftState !== 'none' ? 'bg-[#8ab4f8] text-[#2d2f33]' : 'bg-[#2d2f33] text-white'} shadow-none flex justify-center items-center cursor-pointer border border-transparent active:bg-[#3c4043] h-full"
          title="Shift"
        >
          <svg class="w-5 h-5" viewBox="0 0 16 20" fill="none" stroke="currentColor">
            <path d="M 8 1 L 15 8.5 L 11 8.5 L 11 15 L 5 15 L 5 8.5 L 1 8.5 Z" 
                  fill={shiftState !== 'none' ? 'currentColor' : 'none'} 
                  stroke="currentColor" 
                  stroke-width="1.8" 
                  stroke-linejoin="round"/>
            {#if shiftState === 'capslock'}
              <line x1="2" y1="18" x2="14" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            {/if}
          </svg>
        </button>
        {#each (abcMode === 'lower' ? "zxcvbnm".split('') : "ZXCVBNM".split('')) as char}
          <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress(char); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">{char}</button>
        {/each}
        <button onpointerdown={startBackspace} onpointerup={clearBackspace} onpointerleave={clearBackspace} onpointercancel={clearBackspace} onpointermove={moveBackspace} class="flex-[1.5] rounded-[6px] bg-[#2d2f33] shadow-none text-white flex justify-center items-center cursor-pointer border border-transparent active:bg-[#3c4043]"><Delete size={20} /></button>
      </div>
      <div class="flex gap-1 flex-1">
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { activeTab = '123'; } }} class="flex-[1.5] rounded-[6px] bg-[#2d2f33] shadow-sm font-sans text-sm font-bold flex justify-center items-center cursor-pointer border border-transparent active:bg-[#3c4043]">123</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('!'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl flex justify-center items-center cursor-pointer border border-transparent active:bg-[#4a4d51]">!</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('Tab'); } }} class="flex-[1.2] rounded-[6px] bg-[#2d2f33] shadow-none text-white font-sans text-sm font-semibold flex justify-center items-center cursor-pointer border border-transparent active:bg-[#3c4043]">Tab</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress(' '); } }} class="flex-[4] rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl flex justify-center items-center cursor-pointer border border-transparent active:bg-[#4a4d51]">—</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('.'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl flex justify-center items-center cursor-pointer border border-transparent active:bg-[#4a4d51]">.</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('ENTER'); } }} class="flex-[1.5] rounded-[6px] bg-blue-500 shadow-sm flex justify-center items-center cursor-pointer border border-transparent active:bg-blue-600 text-white"><CornerDownLeft size={20}/></button>
      </div>

    {:else if activeTab === 'greek'}
      <!-- Greek Output -->
      <div class="flex gap-1 flex-1">
        {#each "1234567890".split('') as num}
          <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress(num); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">{num}</button>
        {/each}
      </div>
      <div class="flex gap-1 flex-1">
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('φ'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">φ</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('ς'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">ς</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('ε'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">ε</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('ρ'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">ρ</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('τ'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">τ</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('υ'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">υ</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('θ'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">θ</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('ι'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">ι</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('ο'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">ο</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('π'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">π</button>
      </div>
      <div class="flex gap-1 flex-1">
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('Tab'); } }} class="flex-1 rounded-[6px] bg-[#2d2f33] shadow-none text-white font-sans text-sm font-semibold flex justify-center items-center cursor-pointer border border-transparent active:bg-[#3c4043]">Tab</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('α'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">α</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('σ'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">σ</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('δ'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">δ</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('φ'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">φ</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('γ'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">γ</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('η'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">η</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('ξ'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">ξ</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('κ'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">κ</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('λ'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">λ</button>
      </div>
      <div class="flex gap-1 flex-1">
        <button 
          onpointerdown={handleShiftDown} 
          onpointerup={handleShiftUp} 
          onpointerleave={clearShiftTimer} 
          onpointercancel={clearShiftTimer} 
          class="flex-[1.5] rounded-[6px] {shiftState !== 'none' ? 'bg-[#8ab4f8] text-[#2d2f33]' : 'bg-[#2d2f33] text-white'} shadow-none flex justify-center items-center cursor-pointer border border-transparent active:bg-[#3c4043] h-full"
          title="Shift"
        >
          <svg class="w-5 h-5" viewBox="0 0 16 20" fill="none" stroke="currentColor">
            <path d="M 8 1 L 15 8.5 L 11 8.5 L 11 15 L 5 15 L 5 8.5 L 1 8.5 Z" 
                  fill={shiftState !== 'none' ? 'currentColor' : 'none'} 
                  stroke="currentColor" 
                  stroke-width="1.8" 
                  stroke-linejoin="round"/>
            {#if shiftState === 'capslock'}
              <line x1="2" y1="18" x2="14" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            {/if}
          </svg>
        </button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('ζ'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">ζ</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('χ'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">χ</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('ψ'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">ψ</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('ω'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">ω</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('β'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">β</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('ν'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">ν</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('μ'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">μ</button>
        <button onpointerdown={startBackspace} onpointerup={clearBackspace} onpointerleave={clearBackspace} onpointercancel={clearBackspace} onpointermove={moveBackspace} class="flex-[1.5] rounded-[6px] bg-[#2d2f33] shadow-none text-white flex justify-center items-center cursor-pointer border border-transparent active:bg-[#3c4043]"><Delete size={20} /></button>
      </div>
      <div class="flex gap-1 flex-1">
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { activeTab = '123'; } }} class="flex-[1.5] rounded-[6px] bg-[#2d2f33] shadow-none text-white font-sans text-sm font-bold flex justify-center items-center cursor-pointer border border-transparent active:bg-[#3c4043]">123</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress(','); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl flex justify-center items-center cursor-pointer border border-transparent active:bg-[#4a4d51]">,</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress(' '); } }} class="flex-[4] rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl flex justify-center items-center cursor-pointer border border-transparent active:bg-[#4a4d51]">—</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('.'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl flex justify-center items-center cursor-pointer border border-transparent active:bg-[#4a4d51]">.</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('?'); } }} class="flex-[1.2] rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl flex justify-center items-center cursor-pointer border border-transparent active:bg-[#4a4d51]">?</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('\''); } }} class="flex-[1.2] rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl flex justify-center items-center cursor-pointer border border-transparent active:bg-[#4a4d51]">'</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('ENTER'); } }} class="flex-[1.5] rounded-[6px] bg-blue-500 shadow-sm flex justify-center items-center cursor-pointer border border-transparent active:bg-blue-600 text-white"><CornerDownLeft size={20}/></button>
      </div>
    
    {:else if activeTab === 'sym'}
      <div class="flex gap-1 flex-1">
        {#each "1234567890".split('') as num}
          <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress(num); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">{num}</button>
        {/each}
      </div>
      <div class="flex gap-1 flex-1">
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('∞'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">∞</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('≟'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">≟</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('≠'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">≠</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('∧'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">∧</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('∨'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">∨</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('¬'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">¬</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('⊗'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">⊗</button>
      </div>
      <div class="flex gap-1 flex-1">
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('//'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">//</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('⊥'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">⊥</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('∈'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">∈</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('⊂'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">⊂</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('⊆'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">⊆</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('∠'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">∠</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('→'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">→</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('bmatrix'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">bmatrix</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('pmatrix'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">pmatrix</button>
      </div>
      <div class="flex gap-1 flex-1">
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('·'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">·</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress(':'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">:</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('::'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">::</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('\\'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">\</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('&'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">&amp;</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('@'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">@</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('#'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">#</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('£'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">£</button>
        <button onpointerdown={startBackspace} onpointerup={clearBackspace} onpointerleave={clearBackspace} onpointercancel={clearBackspace} onpointermove={moveBackspace} class="flex-[1.5] rounded-[6px] bg-[#2d2f33] shadow-none text-white flex justify-center items-center cursor-pointer border border-transparent active:bg-[#3c4043]"><Delete size={20} /></button>
      </div>
      <div class="flex gap-1 flex-1">
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress(';'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">;</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress(':'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">:</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('\''); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">'</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('"'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">"</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('|'); } }} class="flex-1 rounded-[6px] bg-[#3c4043] shadow-none text-white font-sans font-medium text-xl cursor-pointer border border-transparent active:bg-[#4a4d51]">|</button>
        <button onpointerdown={handleKeyStart} onpointerup={(e) => { if (checkKeyTap(e)) { onPress('ENTER'); } }} class="flex-[1.5] rounded-[6px] bg-blue-500 shadow-sm flex justify-center items-center cursor-pointer border border-transparent active:bg-blue-600 text-white"><CornerDownLeft size={20}/></button>
      </div>
    {/if}
  </div>
</div>
{/if}

<style>
  .keyboard-grid {
    gap: 11px !important;
  }
  .keyboard-grid div.flex-1 {
    gap: 7px !important;
  }
</style>
