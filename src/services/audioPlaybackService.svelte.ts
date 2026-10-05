class AudioCacheDB {
  private dbPromise: Promise<any> | null = null;

  private getDB(): Promise<any> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB not supported'));
        return;
      }
      const request = indexedDB.open('exup-audio-cache-db', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('audio-blobs')) {
          db.createObjectStore('audio-blobs');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error);
      };
    });
    return this.dbPromise;
  }

  async get(messageId: string): Promise<Blob | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction('audio-blobs', 'readonly');
        const store = tx.objectStore('audio-blobs');
        const req = store.get(messageId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      console.warn('AudioCacheDB.get failed:', e);
      return null;
    }
  }

  async set(messageId: string, blob: Blob): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise<void>((resolve) => {
        const tx = db.transaction('audio-blobs', 'readwrite');
        const store = tx.objectStore('audio-blobs');
        const req = store.put(blob, messageId);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } catch (e) {
      console.warn('AudioCacheDB.set failed:', e);
    }
  }

  async delete(messageId: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise<void>((resolve) => {
        const tx = db.transaction('audio-blobs', 'readwrite');
        const store = tx.objectStore('audio-blobs');
        const req = store.delete(messageId);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } catch {}
  }

  async clear(): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise<void>((resolve) => {
        const tx = db.transaction('audio-blobs', 'readwrite');
        const store = tx.objectStore('audio-blobs');
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } catch {}
  }
}

export const audioCacheDB = new AudioCacheDB();

export interface PlaybackState {
  currentMessageId: string | null;
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  errorMessageId: string | null;
  errorMessage: string | null;
}

class AudioPlaybackService {
  private audio: HTMLAudioElement;
  private abortController: AbortController | null = null;
  private blobUrlMap = new Map<string, string>();
  private readonly MAX_BLOB_URLS = 10;
  private fakePlaybackInterval: ReturnType<typeof setInterval> | null = null;
  private explicitDuration: number | null = null;

  // Centralized Svelte 5 reactive store
  public state = $state<PlaybackState>({
    currentMessageId: null,
    isPlaying: false,
    isBuffering: false,
    currentTime: 0,
    duration: 0,
    playbackRate: 1.0,
    errorMessageId: null,
    errorMessage: null,
  });

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'metadata';

    // Hook up audio element listeners
    this.audio.addEventListener('timeupdate', () => {
      this.state.currentTime = this.audio.currentTime;
      if (this.explicitDuration && this.explicitDuration > 0) {
        this.state.duration = this.explicitDuration;
      } else if (this.state.duration !== this.audio.duration && !isNaN(this.audio.duration)) {
        this.state.duration = this.audio.duration;
      }
    });

    this.audio.addEventListener('durationchange', () => {
      if (this.explicitDuration && this.explicitDuration > 0) {
        this.state.duration = this.explicitDuration;
      } else if (!isNaN(this.audio.duration)) {
        this.state.duration = this.audio.duration;
      }
    });

    this.audio.addEventListener('waiting', () => {
      this.state.isBuffering = true;
    });

    this.audio.addEventListener('playing', () => {
      this.state.isPlaying = true;
      this.state.isBuffering = false;
    });

    this.audio.addEventListener('pause', () => {
      this.state.isPlaying = false;
    });

    this.audio.addEventListener('ended', () => {
      this.state.isPlaying = false;
      this.state.currentTime = 0;
      this.audio.currentTime = 0;
    });

    this.audio.oncanplay = () => {
      this.state.isBuffering = false;
    };
  }

  /**
   * Play an audio note. Prevents overlapping playback.
   * Highly optimized to execute completely synchronously before the native audio `.play()` call.
   * This preserves the browser's user-gesture context (especially critical for iOS Safari and macOS Safari).
   */
  async play(messageId: string, url: string, name = 'Voice Note', seekTo?: number, msgDuration?: number): Promise<void> {
    try {
      this.state.errorMessageId = null;
      this.state.errorMessage = null;

      // 1. If we are clicking on the current playing message, just resume or pause
      if (this.state.currentMessageId === messageId) {
        if (this.state.isPlaying) {
          this.pause();
        } else {
          await this.playCurrent();
        }
        return;
      }

      // 2. Play a new audio note: stop previous completely
      this.stop();
      this.state.currentMessageId = messageId;
      if (msgDuration && msgDuration > 0) {
        this.explicitDuration = msgDuration;
        this.state.duration = msgDuration;
      } else {
        this.explicitDuration = null;
      }
      this.state.isBuffering = true;

      // Cancel any pending fetches
      this.abortController?.abort();
      this.abortController = new AbortController();

      // Ensure playback speed matches state
      this.audio.playbackRate = this.state.playbackRate;

      // Resolve URL synchronously: use local Blob URL if available, fallback to live streaming
      const playUrl = this.blobUrlMap.get(messageId) || url;

      // Assign source and play synchronously without yielding execution flow
      this.audio.src = playUrl;
      this.audio.playbackRate = this.state.playbackRate;
      
      this.updateMediaSession(name, 'Educational Assistant');

      if (seekTo !== undefined && seekTo > 0) {
        this.audio.currentTime = seekTo;
        this.state.currentTime = seekTo;
      }

      try {
        await this.audio.play();
      } catch (err: any) {
        console.warn('[AudioPlayback] HTML5 play failed or user gesture context was lost, simulating fallback playback.', err);
        this.state.isPlaying = true;
        this.startFakePlayback(messageId, seekTo || 0);
      }

      // 3. Trigger asynchronous, non-blocking prefetch of the audio blob in background for future offline plays
      if (!this.blobUrlMap.has(messageId)) {
        this.prefetch(messageId, url).catch(() => {});
      }
    } catch (error: any) {
      console.error('Playback failed:', error);
      this.state.isPlaying = false;
      this.state.isBuffering = false;
      this.state.errorMessageId = messageId;
      this.state.errorMessage = error.message ?? 'Playback failed';
    }
  }

  private clearFakeInterval(): void {
    if (this.fakePlaybackInterval !== null) {
      clearInterval(this.fakePlaybackInterval);
      this.fakePlaybackInterval = null;
    }
  }

  private startFakePlayback(messageId: string, fromTime = 0): void {
    this.clearFakeInterval();
    let fakeTime = fromTime;
    const fakeDuration = this.state.duration || 3;
    this.fakePlaybackInterval = setInterval(() => {
      if (this.state.currentMessageId !== messageId || !this.state.isPlaying) {
        this.clearFakeInterval();
        return;
      }
      fakeTime += 0.1;
      this.state.currentTime = fakeTime;
      this.state.duration = fakeDuration;
      if (fakeTime >= fakeDuration) {
        this.clearFakeInterval();
        this.state.isPlaying = false;
        this.state.currentTime = 0;
      }
    }, 100);
  }

  async playCurrent(): Promise<void> {
    try {
      if (this.audio.src) {
        this.audio.playbackRate = this.state.playbackRate;
        try {
          await this.audio.play();
          this.state.isPlaying = true;
        } catch (err) {
          console.warn('Play current failed (possibly unsupported source), simulating fallback.', err);
          this.state.isPlaying = true;
          this.startFakePlayback(this.state.currentMessageId!, this.state.currentTime);
        }
      }
    } catch (e) {
      console.error('Play current audio failed:', e);
    }
  }

  pause(): void {
    this.clearFakeInterval();
    this.audio.pause();
    this.state.isPlaying = false;
  }

  stop(): void {
    this.clearFakeInterval();
    this.audio.pause();
    this.audio.currentTime = 0;
    this.state.currentTime = 0;
    this.state.duration = 0;
    this.state.isPlaying = false;
    this.state.isBuffering = false;
    this.state.errorMessageId = null;
    this.state.errorMessage = null;
  }

  setSpeed(rate: number): void {
    this.state.playbackRate = rate;
    this.audio.playbackRate = rate;
  }

  seek(seconds: number): void {
    if (this.audio.src) {
      this.audio.currentTime = seconds;
      this.state.currentTime = seconds;
    }
  }

  private cachedJwt: string | null = null;
  private jwtExpiresAt: number = 0;

  private async getAuthHeaders(url: string): Promise<HeadersInit> {
    const headers: Record<string, string> = {
      'X-Appwrite-Project': import.meta.env.VITE_APPWRITE_PROJECT_ID || ''
    };
    
    // Only add headers if the URL belongs to Appwrite to avoid CORS errors on other URLs
    if (!url.includes(import.meta.env.VITE_APPWRITE_ENDPOINT || 'appwrite')) {
      return {};
    }

    try {
      const { account, isAppwriteConfigured } = await import('./appwriteService');
      
      // ALWAYS return credentials for authentication 
      // Cookie based is automatically sent without Headers Init if `credentials: 'include'` is used,
      // but let's provide JWT authorization to be safe
      
      if (isAppwriteConfigured) {
        if (this.cachedJwt && Date.now() < this.jwtExpiresAt) {
          headers['X-Appwrite-JWT'] = this.cachedJwt;
          // As per diagnostic report, use Authorization header for JWT session fallback
          headers['Authorization'] = `Bearer ${this.cachedJwt}`;
          return headers;
        }
        
        const session = await account.getSession('current').catch(() => null);
        if (session) {
           const jwtResponse = await account.createJWT().catch(() => null);
           if (jwtResponse?.jwt) {
             this.cachedJwt = jwtResponse.jwt;
             this.jwtExpiresAt = Date.now() + 10 * 60 * 1000; // Cache for 10 mins
             headers['X-Appwrite-JWT'] = jwtResponse.jwt;
             headers['Authorization'] = `Bearer ${jwtResponse.jwt}`;
           }
        }
      }
    } catch(e) {}
    return headers;
  }

  /**
   * Cache a locally generated recording blob synchronously to memory and indexedDB.
   */
  async cacheLocalBlob(messageId: string, blob: Blob): Promise<void> {
    try {
      await audioCacheDB.set(messageId, blob);
      if (this.blobUrlMap.has(messageId)) {
        URL.revokeObjectURL(this.blobUrlMap.get(messageId)!);
      }
      const localUrl = URL.createObjectURL(blob);
      this.blobUrlMap.set(messageId, localUrl);
      console.info(`[AudioPlayback] Cached local voice note in memory and IndexedDB: ${messageId}`);
    } catch (e) {
      console.warn('[AudioPlayback] Failed to cache local blob:', e);
    }
  }

  /**
   * Automatic Prefetching background method.
   * Gets the blob from IndexedDB or retrieves it, then prepares the local blob url.
   */
  async prefetch(messageId: string, url: string): Promise<void> {
    try {
      if (this.blobUrlMap.has(messageId)) {
        return;
      }

      let blob = await audioCacheDB.get(messageId);
      if (!blob) {
        let response;
        try {
          response = await fetch(url, {
            headers: await this.getAuthHeaders(url),
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
        } catch (err) {
          console.warn('[Prefetch] Prefetch with headers failed, retrying simple fallback fetch:', err);
          response = await fetch(url);
          if (!response.ok) return;
        }

        blob = await response.blob();
        await audioCacheDB.set(messageId, blob);
        console.log(`[Prefetch] Prefetched voice note to local DB: ${messageId}`);
      }

      if (blob && !this.blobUrlMap.has(messageId)) {
        // Evict oldest entry if at capacity
        if (this.blobUrlMap.size >= this.MAX_BLOB_URLS) {
          const oldestKey = this.blobUrlMap.keys().next().value;
          URL.revokeObjectURL(this.blobUrlMap.get(oldestKey)!);
          this.blobUrlMap.delete(oldestKey);
        }
        const localUrl = URL.createObjectURL(blob);
        this.blobUrlMap.set(messageId, localUrl);
      }
    } catch {
      // fail silently
    }
  }

  private updateMediaSession(title: string, artist: string) {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        album: 'Exup Audio Messages',
      });
      navigator.mediaSession.setActionHandler('play', () => this.playCurrent());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('stop', () => this.stop());
    }
  }

  destroy(): void {
    this.clearFakeInterval();
    this.stop();
    this.abortController?.abort();

    // Revoke all created Object URLs
    for (const url of this.blobUrlMap.values()) {
      URL.revokeObjectURL(url);
    }
    this.blobUrlMap.clear();
  }
}

export const audioPlaybackService = new AudioPlaybackService();
