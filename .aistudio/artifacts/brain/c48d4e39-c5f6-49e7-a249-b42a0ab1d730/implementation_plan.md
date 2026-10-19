# Image Gap Typing & Direct Image Annotation

Enable users to attach images with an editable text area below in the draft composer, and fix the annotation engine to allow smooth, uninterrupted drawing directly over images with precise anchor positioning.

> [!IMPORTANT]
> **Confirmed Decisions**:
> 1. **Image Gap Typing**: When attaching an image (via the '+' button or camera), the image is staged inside the draft bubble with a text area in the gap directly beneath it. This allows users to compose formulas, handwriting, and notes below the image before sending.
> 2. **Direct Image Annotation Anchoring**: Annotation strokes starting over an image anchor directly to the image container (`data-image-container`). Strokes scale and position relative to the image geometry, rendering via `InkOverlay` with support for real-time draft marks and synced annotations.
> 3. **Sketch Mode Interaction Isolation**: In sketch mode, clicking an image will not trigger the full-screen zoom preview, ensuring drawing gestures begin immediately on pointer-down.

---

## 1. Overview & Core Concept

### What It Does
- **Staged Image Draft Composer**: Clicking the attachment button (`+`) stages the selected image inside the active draft bubble. A torn-paper styled preview card displays the image, followed by an editable math/text gap below it where users can type formulas, text, or equations. Clicking Send transmits the image, caption text, and any annotations as a unified message.
- **Direct Image Inking**: In sketch/annotation mode, touching or dragging over any image in the chat (or in the draft) immediately starts drawing without opening the full-screen image viewer. The stroke coordinate space normalizes directly to the image element so ink stays aligned across window resizes, zoom levels, and layout shifts.
- **Live Draft Annotations on Images**: Pending marks drawn over sent image messages immediately display via the image's `InkOverlay` alongside historical and received strokes.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Attaching & Typing Under an Image**:
   - User taps the `+` button in the composer bar.
   - File picker opens; user selects an image.
   - The draft bubble activates and expands:
     - Top section: The selected image rendered with a slight torn-paper shadow and tape badge, plus a subtle top-right remove (`X`) button.
     - Gap below: The active `AnnotatableText` area with Kalam handwriting font, blinking caret, math keyboard toolbar, and text styling.
   - User types explanation text, math formulas, or draws annotations over the draft.
   - User taps Send: The image uploads, and the message is sent containing both the image attachment and the formatted text/math below it.
2. **Annotating Over Images**:
   - User activates Sketch Mode (pen icon).
   - User places finger/mouse on an image message and drags to draw.
   - The image does not pop open in a lightbox. Instead, the annotation stabilizer immediately draws a live stroke path on the canvas.
   - On release, the stroke is committed to the image container's coordinate system and rendered in `InkOverlay`.
   - Undo/Redo and Eraser tools interact seamlessly with image-anchored strokes.

### Visual Identity & Theme
- **Draft Image Card**: Matches the chat timeline's Polaroid/torn-paper aesthetic (`rotate-[1deg]`, subtle tape motif, soft drop shadow, border dashed `border-ink/20`).
- **Remove Button**: Compact circular `X` badge at the top-right corner of the draft image for one-tap cancellation before sending.
- **Typographic Gap**: Generous line spacing matching the chat notebook ruled-paper background with Kalam font styling.

---

## 3. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│                   ChatWindow.svelte                    │
│                                                        │
│  ┌────────────────────┐      ┌──────────────────────┐  │
│  │ ChatAnnotationLayer│ ───► │  resolveTarget()     │  │
│  │ (pointerdown/move) │      │  • Detects image-box │  │
│  └─────────┬──────────┘      │  • Prevents lightbox │  │
│            │                 └──────────┬───────────┘  │
│            ▼                            ▼              │
│  ┌────────────────────┐      ┌──────────────────────┐  │
│  │  onStrokeCommitted │ ───► │  addPendingMark()    │  │
│  └────────────────────┘      └──────────┬───────────┘  │
│                                         ▼              │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Image Message / Draft Bubble Container           │  │
│  │  • [data-image-container={m.id}]                 │  │
│  │  • <InkOverlay strokes={[allImageStrokes]} />    │  │
│  │  • Staged Draft Image + Dismiss 'X'              │  │
│  │  • Gap Below: <AnnotatableText isEditor={true} />│  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### Component & State Changes
1. **`src/views/ChatWindow.svelte`**:
   - Add `stagedImage` state: `{ file: File, url: string, dominantColor: string } | null`.
   - Update `handleImageUpload`: Stage the selected file into `stagedImage` and activate `showMathKeyboard = true` instead of sending instantly.
   - Draft Bubble Markup: Render the staged image above `<AnnotatableText>`, followed by the text gap.
   - `handleSend`: If `stagedImage` is present, upload the image via `messagingService` with the draft `msg` content and `currentStrokes`.
   - Image Message Template:
     - Add `data-image-container={m.id}` to image wrapper.
     - Prevent zoom preview if `isSketchMode` is active (`onclick={() => { if (!isSketchMode) zoomedImageId = m.id; }}`).
     - Update `InkOverlay` in `msgType === 'image'` to render all strokes: `[...(imageStrokes || []), ...(receivedMarksByTarget[m.id] ?? []), ...(pendingMarks[m.id] ?? [])]`.
2. **`src/components/ChatAnnotationLayer.svelte`**:
   - In `resolveTarget(clientX, clientY)`, add explicit check for `el.closest('[data-image-container]')`.
   - When an image container is hit, anchor `targetRect` to the image container's bounding rectangle.
   - For staged images in the draft, anchor to the draft image container or draft target.
3. **`src/components/InkOverlay.svelte`**:
   - Ensure pointer events are non-blocking (`pointer-events-none`) and SVG viewBox/scaling correctly respects image aspect ratios.

---

## 4. Verification Plan

1. **Compilation & Linting**: Run `compile_applet` and `lint_applet` to confirm clean builds.
2. **Draft Image Gap Typing**:
   - Select an image via the `+` button.
   - Verify image preview renders inside the draft bubble.
   - Verify caret appears in the gap below the image and user can type text and math formulas.
   - Send the message; verify it renders in the chat timeline with the image on top and text below.
   - Test removing the staged image using the `X` button.
3. **Direct Image Annotation**:
   - Toggle sketch/annotation mode on.
   - Click and drag directly on an image message.
   - Verify lightbox does NOT open.
   - Verify live stroke renders smoothly during drawing.
   - Verify stroke remains visible and perfectly positioned over the image after pointer release.
   - Verify strokes persist through window resizing.
