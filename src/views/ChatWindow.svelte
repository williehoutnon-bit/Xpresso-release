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
                            {/if}
                         </div>

                         <!-- Text gap below this image: Exactly 1 line of text min-height, ZERO push on sketch toggle -->
                         <div 
                           class="w-full relative my-0 min-h-[1.75rem] flex flex-col items-start justify-start" 
                           style="min-height: 1.75rem;"
                           onclick={() => { if (!isSketchMode) switchFocusedGap(img.id); }}
                         >
                            {#if (!focusedGapImageId && imgIdx === 0) || focusedGapImageId === img.id}
                               <AnnotatableText
                                 isEditor={true}
                                 nodes={currentTree}
                                 annotations={[]}
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
                                   if (!currentStrokes.some(s => s.id === newAnn.id)) {
                                     currentStrokes = [...currentStrokes, newAnn];
                                   }
                                 }}
                                 onStrokesChanged={(survivors) => {
                                   handleStrokesChanged(survivors);
                                 }}
                                 oncopy={handleCopy}
                                 oncut={handleCut}
                                 onpaste={handlePaste}
                                 onkeydown={(e) => {
                                   if (isSketchMode) return;
                                   if (e.key === 'Backspace' && selectedNodeIds.size > 0) {
                                     e.preventDefault();
                                     deleteCurrentSelection();
                                   }
                                 }}
                                 onpointerdown={!isSketchMode ? handlePointerDown : undefined}
                               />
                            {:else}
                               <div class="cursor-text w-full min-h-[1.75rem] flex flex-col items-start justify-start">
                                  {#if img.gapTextTree && img.gapTextTree.length > 0}
                                     <AnnotatableText
                                       isEditor={false}
                                       nodes={img.gapTextTree}
                                       text=""
                                       annotations={[]}
                                       readonly={true}
                                       textColor={textColors[activeTextColorIndex].displayColor}
                                       isBold={isBold}
                                       isItalic={isItalic}
                                       isUnderlined={isUnderlined}
                                       fontFamily={activeFontFamily}
                                     />
                                  {:else}
                                     <div class="w-full h-[1.75rem] min-h-[1.75rem] flex items-center"></div>
                                  {/if}
                               </div>
                            {/if}
                         </div>
                      {/each}

                      <!-- Continuous ink overlay spanning all staged images and all gaps without cropping -->
                      {#if currentStrokes && currentStrokes.length > 0}
                         <InkOverlay strokes={currentStrokes} isMe={true} />
                      {/if}
                   </div>
                {:else}
                   <!-- Default editor when no images are staged: stable 1-line min-height, zero push on sketch toggle -->
                   <div class="w-full transition-all relative min-h-[1.75rem]" data-draft-content="true">
                       <AnnotatableText
                         isEditor={true}
                         nodes={currentTree}
                         annotations={currentStrokes}
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
                           if (!currentStrokes.some(s => s.id === newAnn.id)) {
                             currentStrokes = [...currentStrokes, newAnn];
                           }
                         }}
                         onStrokesChanged={(survivors) => {
                           handleStrokesChanged(survivors);
                         }}
                         oncopy={handleCopy}
                         oncut={handleCut}
                         onpaste={handlePaste}
                         onkeydown={(e) => {
                           if (isSketchMode) return;
                           if (e.key === 'Backspace' && selectedNodeIds.size > 0) {
                             e.preventDefault();
                             deleteCurrentSelection();
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
    {#if zoomedImageId && currentMediaItem}
      {@const zoomedMsg = currentMediaItem.message}
      {@const zoomedImg = currentMediaItem.type === 'image' || currentMediaItem.type === 'math_sketch' ? currentMediaItem.attachment : null}
      {@const zoomedVideo = currentMediaItem.type === 'video' ? currentMediaItem.attachment : null}
      
      <div 
        class="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 select-none"
        onclick={closeFullView}
        ontouchstart={(e) => startX = e.touches[0].clientX}
        ontouchend={(e) => {
          const diff = e.changedTouches[0].clientX - startX;
          if (diff > 50) navigateMedia(-1);
          if (diff < -50) navigateMedia(1);
        }}
      >
         <button class="absolute top-10 right-10 text-white bg-theme-card/10 p-4 rounded-full border-none cursor-pointer hover:bg-theme-card/20 transition-colors z-[110]" onclick={closeFullView}>
            <X size={32} />
         </button>

         {#if currentMediaIndex > 0}
            <button onclick={(e) => { e.stopPropagation(); navigateMedia(-1); }} class="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-theme-card/10 p-4 rounded-full border-none cursor-pointer hover:bg-theme-card/20 z-[110]">
              <ChevronLeft size={32} />
            </button>
         {/if}

         {#if currentMediaIndex < allMediaItems.length - 1}
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
                   alt={zoomedImg.name || "Zoomed"} 
                   class="max-w-full max-h-[90vh] object-contain rounded-none animate-in zoom-in-95 duration-200 transition-opacity duration-300 {loadedImages[currentMediaItem.key + '_zoomed'] ? 'opacity-100' : 'opacity-0'}" 
                   style="border-radius: 0;"
                   onload={() => loadedImages[currentMediaItem.key + '_zoomed'] = true}
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
              {currentMediaIndex + 1} / {allMediaItems.length}
           </div>
         </div>
      </div>
    {/if}

    <div class="absolute bottom-0 left-0 right-0 z-40 pointer-events-none flex flex-col items-center">
      <footer class="w-full px-3 sm:px-5 pt-3 sm:pt-4 {showMathKeyboard ? 'pb-2 sm:pb-3' : 'pb-6 sm:pb-10'} flex justify-center pointer-events-none transition-all duration-300">
        <div class="w-full max-w-lg pointer-events-auto bg-transparent relative">
        
        {#if showNewMsgBtn}
          <div class="w-full flex justify-center pointer-events-none absolute {replyingToMessage ? '-top-24' : '-top-14'} left-0 right-0 z-[45]">
            <button 
              onclick={() => {
                scrollToBottom('smooth');
                throttledMarkAsRead(activeConversationId, true);
              }}
              aria-label="Scroll to bottom"
              class="pointer-events-auto w-10 h-10 rounded-full bg-white hover:bg-blue-50/70 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#00274d] dark:text-blue-300 border border-blue-600 dark:border-blue-400 shadow-md flex items-center justify-center active:scale-95 hover:scale-105 transition-all duration-200 cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 animate-in fade-in zoom-in-75 relative"
            >
              <ChevronDown size={20} class="text-[#00274d] dark:text-blue-300 group-hover:translate-y-0.5 transition-transform" strokeWidth={2.5} />
              {#if unreadCountBelow > 0}
                <span class="absolute -top-1.5 -right-1.5 px-1 min-w-[18px] h-4.5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md tabular-nums border border-white dark:border-slate-800 animate-in zoom-in-75 duration-150">
                  {unreadCountBelow > 99 ? '99+' : unreadCountBelow}
                </span>
              {/if}
            </button>
          </div>
        {/if}

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
                    style={isSketchMode ? `background-color: ${textColors[activeTextColorIndex].displayColor};` : ''}
                    class="transition-all shadow-sm cursor-pointer flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full shrink-0 hover:scale-105 active:scale-95 {isSketchMode ? 'text-white border-transparent shadow-md scale-105' : 'text-[#00274d] hover:bg-blue-50/50 bg-white border border-blue-600'}" 
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

                <!-- 8. Send button -->
                <div class="relative shrink-0 flex items-center justify-center">
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
      {#if currentTree.length > 0}
        <button
          class="px-4 py-3 text-sm font-medium hover:bg-gray-50 border-r border-gray-200 text-gray-800"
          onclick={(e) => { e.stopPropagation(); execSelectAll(); }}
        >Select all</button>
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
