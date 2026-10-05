// Safe BroadcastChannel postMessage polyfill/monkeypatch to prevent "could not be cloned" DataCloneError
if (typeof window !== 'undefined' && typeof window.BroadcastChannel === 'function') {
  const OriginalBroadcastChannel = window.BroadcastChannel;
  const originalBCPostMessage = OriginalBroadcastChannel.prototype.postMessage;

  function safeClone<T>(val: T): any {
    try {
      return JSON.parse(
        JSON.stringify(val, (_key, value) => {
          if (typeof value === 'function' || typeof value === 'symbol') {
            return undefined;
          }
          return value;
        })
      );
    } catch {
      return undefined;
    }
  }

  OriginalBroadcastChannel.prototype.postMessage = function (message: any) {
    try {
      return originalBCPostMessage.call(this, message);
    } catch (err: any) {
      try {
        const sanitized = safeClone(message);
        if (sanitized !== undefined) {
          return originalBCPostMessage.call(this, sanitized);
        }
      } catch (retryErr) {
        console.warn('[BroadcastChannel Patch] Suppressed uncloneable BroadcastChannel message:', retryErr);
        return;
      }
      console.warn('[BroadcastChannel Patch] Suppressed uncloneable BroadcastChannel message:', err);
      return;
    }
  };
}

// Safe WebSocket send polyfill/monkeypatch to prevent InvalidStateError when in CONNECTING state
if (typeof window !== 'undefined' && window.WebSocket) {
  const OriginalWebSocket = window.WebSocket;
  let originalSend = OriginalWebSocket.prototype ? OriginalWebSocket.prototype.send : undefined;

  // Try to extract original send from a temporary instance if prototype.send is missing
  if (!originalSend && typeof OriginalWebSocket === 'function') {
    try {
      const dummyUrl = 'ws://localhost:12345';
      const dummy = new (OriginalWebSocket as any)(dummyUrl);
      if (dummy && dummy.send && typeof dummy.send === 'function') {
        originalSend = dummy.send;
      }
      try { dummy.close(); } catch {}
    } catch (e) {
      // ignore
    }
  }

  const patchedSend = function (this: any, data: any) {
    // Resolve original send dynamically (prioritize stored instance-level, then module-level, then prototype)
    const sendFn = this._originalSend || originalSend || (this.constructor && this.constructor.prototype && this.constructor.prototype.send);
    
    if (!sendFn || typeof sendFn !== 'function') {
      console.warn('[WebSocket Patch] No original send function found. Cannot send data:', data);
      return;
    }

    const handleQueueFlush = () => {
      if (this.readyState === 1 && this._sendQueue && this._sendQueue.length > 0) {
        while (this._sendQueue.length > 0) {
          const queuedData = this._sendQueue.shift();
          try {
            sendFn.call(this, queuedData);
          } catch (err) {
            console.warn('[WebSocket Patch] Error sending queued WebSocket message:', err);
          }
        }
      }
    };

    const setupFlushInterval = () => {
      if (this._flushIntervalId) return;
      this._flushIntervalId = setInterval(() => {
        if (this.readyState === 1) {
          handleQueueFlush();
          clearInterval(this._flushIntervalId);
          delete this._flushIntervalId;
        } else if (this.readyState > 1) { // CLOSING or CLOSED
          clearInterval(this._flushIntervalId);
          delete this._flushIntervalId;
          // Clear queue since socket closed/closing
          this._sendQueue = [];
        }
      }, 50);
    };

    if (this.readyState === 0) { // WebSocket.CONNECTING
      if (!this._sendQueue) {
        this._sendQueue = [];
        const onOpen = () => {
          this.removeEventListener('open', onOpen);
          handleQueueFlush();
        };
        this.addEventListener('open', onOpen);
        setupFlushInterval();
      }
      this._sendQueue.push(data);
    } else {
      try {
        sendFn.call(this, data);
      } catch (err: any) {
        const isConnectingError = err && (
          err.name === 'InvalidStateError' ||
          (err.message && (
            err.message.toLowerCase().includes('connecting') ||
            err.message.toLowerCase().includes('state')
          ))
        );

        if (isConnectingError) {
          console.warn('[WebSocket Patch] Caught raced connecting error. Queueing message...', err);
          // Fallback queueing if connection state raced
          if (!this._sendQueue) {
            this._sendQueue = [];
            const onOpen = () => {
              this.removeEventListener('open', onOpen);
              handleQueueFlush();
            };
            this.addEventListener('open', onOpen);
            setupFlushInterval();
          }
          this._sendQueue.push(data);
        } else {
          // If it is another kind of InvalidStateError (e.g. CLOSING/CLOSED), log as warning instead of throwing uncaught
          if (err && err.name === 'InvalidStateError') {
            console.warn('[WebSocket Patch] Prevented uncaught InvalidStateError:', err.message || err);
          } else {
            throw err;
          }
        }
      }
    }
  };

  // 1. Patch prototype directly if it exists
  if (OriginalWebSocket.prototype) {
    try {
      OriginalWebSocket.prototype.send = patchedSend;
    } catch (e) {
      console.warn('[WebSocket Patch] Could not patch OriginalWebSocket.prototype.send directly:', e);
    }
  }

  // 2. Wrap window.WebSocket constructor so that any constructed instance gets the patched send method bound
  const PatchedWebSocketConstructor = function (this: any, url: string | URL, protocols?: string | string[]) {
    const instance = new (OriginalWebSocket as any)(url, protocols);
    
    // Store original send on instance itself before overriding
    if (instance.send && instance.send !== patchedSend) {
      instance._originalSend = instance.send;
    }
    
    // Explicitly override send on the constructed instance so it can't resolve to any other cached native send
    instance.send = patchedSend;
    return instance;
  };

  // Inherit prototypes and copy statics
  if (OriginalWebSocket.prototype) {
    PatchedWebSocketConstructor.prototype = OriginalWebSocket.prototype;
  }

  const staticKeys = Object.getOwnPropertyNames(OriginalWebSocket);
  for (const staticKey of staticKeys) {
    if (!(staticKey in PatchedWebSocketConstructor)) {
      try {
        Object.defineProperty(PatchedWebSocketConstructor, staticKey, {
          get() { return (OriginalWebSocket as any)[staticKey]; },
          set(val) { (OriginalWebSocket as any)[staticKey] = val; },
          configurable: true,
          enumerable: true
        });
      } catch (e) {
        // ignore read-only properties
      }
    }
  }

  try {
    Object.defineProperty(window, 'WebSocket', {
      value: PatchedWebSocketConstructor,
      configurable: true,
      writable: true,
      enumerable: true
    });
  } catch (err) {
    console.warn('[WebSocket Patch] Could not redefine window.WebSocket with Object.defineProperty (property may be read-only). Prototype-level send patch remains active.', err);
  }
}

// Suppress Appwrite Realtime WebSocket errors that spam the console
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;

  const filterLogs = (originalFn: Function) => (...args: any[]) => {
    if (typeof args[0] === 'string' && (
        args[0].includes('Realtime got disconnected') || 
        args[0].includes('Still in CONNECTING state')
    )) {
      return;
    }
    // Also filter object errors that contain this message
    if (args[0] && typeof args[0] === 'object' && args[0].message && 
        args[0].message.includes('Still in CONNECTING state')) {
      return;
    }
    originalFn(...args);
  };

  console.error = filterLogs(originalConsoleError);
  console.log = filterLogs(originalConsoleLog);
  console.warn = filterLogs(originalConsoleWarn);

  // Suppress unhandled promise rejections and uncaught errors related to WebSocket state and transient fetch/network issues
  window.addEventListener('error', (event) => {
    const error = event.error || {};
    const msg = (event.message || error.message || '').toLowerCase();
    const name = (error.name || '').toLowerCase();
    
    if (msg.includes('connecting') || 
        msg.includes('invalidstateerror') ||
        msg.includes('websocket') || 
        msg.includes('send') ||
        msg.includes('fetch') ||
        msg.includes('network') ||
        msg.includes('load failed') ||
        msg.includes('broadcastchannel') ||
        msg.includes('could not be cloned') ||
        msg.includes('datacloneerror') ||
        name.includes('datacloneerror') ||
        name.includes('invalidstateerror') ||
        name.includes('typeerror')) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  }, { capture: true });

  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason || {};
    const msg = (error.message || '').toLowerCase();
    const name = (error.name || '').toLowerCase();

    if (msg.includes('connecting') ||
        msg.includes('invalidstateerror') ||
        msg.includes('websocket') ||
        msg.includes('fetch') ||
        msg.includes('network') ||
        msg.includes('load failed') ||
        msg.includes('broadcastchannel') ||
        msg.includes('could not be cloned') ||
        msg.includes('datacloneerror') ||
        name.includes('datacloneerror') ||
        name.includes('invalidstateerror') ||
        name.includes('typeerror')) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  }, { capture: true });
}
