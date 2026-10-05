# Audio Message Module Architecture

This document details the architecture, data flow, and components of the audio messaging module used in the application.

## Overview
The audio message module is designed to provide global, singleton-based playback of audio voice notes, ensuring that only one audio trace plays at a time. It implements caching via IndexedDB to minimize network round-trips for previously downloaded audio blobs, and features a globally synced reactive state using Svelte 5 runes.

## Core Components

### 1. `AudioPlaybackService` (Global Singleton)
Located in `src/services/audioPlaybackService.svelte.ts`.

- **Singleton `HTMLAudioElement`**: A single instance of the native native `Audio` object is used across the entire application. This prevents overlapping audio playbacks from multiple messages.
- **Reactive State (`$state`)**: Maintains the universal playback details including:
  - `currentMessageId`: Tracks which audio message is currently loaded.
  - `isPlaying`: Boolean reflecting if the audio is successfully playing.
  - `isBuffering`: Boolean reflecting if the audio is waiting for data.
  - `currentTime`, `duration`, `playbackRate`: Numeric states mapped directly to the active `HTMLAudioElement`.
- **Event Listeners**: It attaches native event listeners (`timeupdate`, `playing`, `waiting`, `ended`, `durationchange`) to sync the UI's reactive state simultaneously.
- **Fallback Simulation**: If standard formats (like mock base64 audio strings) fail native `audio.play()` execution due to `NotSupportedError`, the playback service smoothly simulates playback progression to preserve UI interactivity.

### 2. `AudioCacheDB` (IndexedDB Wrapper)
Located in `src/services/audioPlaybackService.svelte.ts`.

- **Purpose**: Persistently caches audio blobs locally on the client's device to save bandwidth on subsequent replays.
- **Store Structure**: Uses `indexedDB` under the hood. 
  - Database name: `exup-audio-cache-db`
  - Object store: `audio-blobs`
- **Flow**: Before downloading an audio URL, the service checks this cache via `messageId`. If it's a hit, it uses `URL.createObjectURL(blob)`, eliminating the network request.

### 3. `AudioMessagePlayer.svelte` (UI Component)
Located in `src/components/AudioMessagePlayer.svelte`.

- **Data Binding**: Uses `$derived` runes to connect uniquely to the `AudioPlaybackService` state by verifying if `audioPlaybackService.state.currentMessageId === messageId`.
- **Interactions**:
  - Play / Pause toggler.
  - Playback speed toggler (e.g. 1x, 1.5x, 2x).
  - Seek bar logic that calls global `audioPlaybackService.seek(time)`.
- **Rendering**: Uses dynamic Tailwind classes to paint progress chunks or a waveform relative to `currentTime / duration`.

### 4. Input & Mocking (`ChatWindow.svelte`)
- Extracts real voice notes from `navigator.mediaDevices.getUserMedia` attached to a `MediaRecorder`.
- Identifies system-simulated audio via the `f:audio` attachment type identifier, gracefully failing over to generic `data:audio/mp3;base64` stubs for test environments.

## Data Flow Diagram (Playback)
1. **User Action**: Clicks Play on `AudioMessagePlayer`.
2. **Fetch or Load**: The player invokes `audioPlaybackService.play(messageId, url)`.
3. **Cache Check**: `AudioCacheDB` queries `messageId`. 
   - *Hit*: Load saved blob.
   - *Miss*: Fetch blob over network, load, and run `AudioCacheDB.set`.
4. **Setup Audio Context**: `URL.createObjectURL(blob)` is assigned to `this.audio.src`.
5. **Execution**: System triggers `this.audio.play()`.
6. **Reactivity**: Svelte automatically reacts to the singleton's `currentTime` changes and adjusts styling proportionally within the specific corresponding `AudioMessagePlayer` component matching `messageId`.
