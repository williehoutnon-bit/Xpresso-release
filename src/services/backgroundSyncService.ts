import { databases, APPWRITE_CONFIG, isAppwriteConfigured } from './appwriteService';
import { Permission, Role } from './appwriteService';
import { dbService } from './dbService';
import { authService } from './authService';
import { mediaCacheDB } from './mediaCacheService';

let syncTimer: any = null;
let onlineDebounceTimeout: any = null;
let isSyncing = false;

/**
 * Utility to identify transient network errors or offline states
 */
function isOnline(): boolean {
  if (typeof window !== 'undefined' && window.navigator) {
    return window.navigator.onLine;
  }
  return true;
}

/**
 * Robustly uploads and synchronizes any pending or errored offline messages
 * utilizing chunked batches, throttling, and connection health monitoring
 * to avoid API rate limits and conserve device resources.
 */
export async function triggerBackgroundSync(): Promise<void> {
  if (!isOnline()) {
    console.log('[BackgroundSync] Offline. Synchronization deferred.');
    return;
  }

  if (isSyncing) {
    console.log('[BackgroundSync] Sync already in progress, skipping.');
    return;
  }

  if (!isAppwriteConfigured || !APPWRITE_CONFIG.databaseId || !APPWRITE_CONFIG.collections.messages) {
    console.log('[BackgroundSync] Appwrite not configured. Synchronization skipped.');
    return;
  }

  isSyncing = true;
  console.log('[BackgroundSync] Starting chunked background sync...');

  try {
    const user = await authService.getCurrentUser();
    if (!user) {
      console.log('[BackgroundSync] No authenticated user. Deferring sync.');
      isSyncing = false;
      return;
    }

    const db = await dbService.getRawDB();
    if (!db || !db.messages) {
      console.log('[BackgroundSync] Local message collection not loaded.');
      isSyncing = false;
      return;
    }

    // Find all messages that are pending or in error state
    const unsentMessages = await db.messages.find({
      selector: {
        $or: [
          { status: 'pending' },
          { status: 'error' }
        ]
      }
    }).exec();

    if (unsentMessages.length === 0) {
      console.log('[BackgroundSync] No unsent messages found.');
      isSyncing = false;
      return;
    }

    console.log(`[BackgroundSync] Found ${unsentMessages.length} unsent/errored messages.`);

    // Before uploading messages, ensure all unique conversations for these messages exist on the server!
    const uniqueConversationIds = Array.from(new Set(unsentMessages.map(m => m.conversationId)));
    
    if (uniqueConversationIds.length > 0) {
      try {
        const { messagingService } = await import('./messagingService');
        for (const cid of uniqueConversationIds) {
          if (cid) {
            console.log(`[BackgroundSync] Restoring conversation/participants for ${cid} if missing...`);
            await messagingService.ensureConversationOnSupabase(cid).catch((e: any) => console.warn(`Failed ensuring convo ${cid}:`, e));
          }
        }
      } catch (err) {
        console.warn('[BackgroundSync] Failed to import/run ensureConversationOnSupabase:', err);
      }
    }

    // Group messages into small chunk sizes to enforce rate limits & prioritize network stability
    const CHUNK_SIZE = 4;
    const THROTTLE_DELAY_MS = 1000; // 1-second delay between individual document creations
    const COOLDOWN_DELAY_MS = 3000; // 3-second recovery delay between batch chunks

    const chunks: any[][] = [];
    for (let i = 0; i < unsentMessages.length; i += CHUNK_SIZE) {
      chunks.push(unsentMessages.slice(i, i + CHUNK_SIZE));
    }

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      // Network stability: Abort processing immediately if network dropped
      if (!isOnline()) {
        console.warn(`[BackgroundSync] Network went offline. Suspending processing at chunk ${chunkIndex + 1}/${chunks.length}`);
        break;
      }

      const currentChunk = chunks[chunkIndex];
      console.log(`[BackgroundSync] Syncing chunk ${chunkIndex + 1}/${chunks.length} (contains ${currentChunk.length} messages)`);

      for (const rxDoc of currentChunk) {
        // Continuous online checking: break immediately if network drops mid-chunk
        if (!isOnline()) {
          console.warn('[BackgroundSync] Network dropped mid-chunk. Halting uploads.');
          break;
        }

        const msg = rxDoc.toJSON();

        // Only attempt to synchronize our own messages to avoid auth/write permission issues
        if (msg.senderId !== user.$id) {
          continue;
        }

        console.log(`[BackgroundSync] Processing message ${msg.id} (type: ${msg.type})`);

        try {
          let attachments = Array.isArray(msg.attachments) ? msg.attachments : [];
          let content = msg.content;

          // Check if there are any attachments that require a media upload
          const isPendingBlob = attachments.some((a: any) => a?.url && (a.url.startsWith('blob:') || a.fileId?.startsWith('pending_')));

          if (isPendingBlob) {
            console.log(`[BackgroundSync] Message ${msg.id} has pending media. Retrieving from cache...`);
            
            let fileBlob: Blob | null = await mediaCacheDB.get(msg.id);

            // Fallback to audioCacheDB for voice recordings
            if (!fileBlob && msg.type === 'f:audio') {
              try {
                const { audioCacheDB } = await import('./audioPlaybackService.svelte');
                fileBlob = await audioCacheDB.get(msg.id);
              } catch (audioCacheErr) {
                console.warn('[BackgroundSync] Could not import or query audioCacheDB:', audioCacheErr);
              }
            }

            if (!fileBlob) {
              console.warn(`[BackgroundSync] Media file not found in cache for message ${msg.id}. Marking as error.`);
              await db.messages.upsert({
                ...msg,
                status: 'error'
              });
              continue;
            }

            console.log(`[BackgroundSync] Uploading media file for message ${msg.id}...`);
            const { mediaService } = await import('./mediaService');
            
            const fileName = msg.type === 'f:audio' ? `voice_${msg.id}.opus` : `image_${msg.id}.png`;
            const fileId = await mediaService.uploadFile(fileBlob, fileName);
            
            if (!fileId) {
              throw new Error('Media upload failed');
            }

            const fileUrl = mediaService.getFileView(fileId);
            console.log(`[BackgroundSync] Media upload success. FileId: ${fileId}`);

            const oldAttachment = attachments[0] || {};
            const finalAttachment = {
              ...oldAttachment,
              fileId: fileId,
              url: fileUrl
            };
            attachments = [finalAttachment];

            // Pack attachments in content for special file message types if needed
            try {
              if (content && (content.startsWith('{') || content.startsWith('['))) {
                const parsed = JSON.parse(content);
                parsed.a = attachments;
                content = JSON.stringify(parsed);
              } else {
                content = JSON.stringify({ c: content, a: attachments });
              }
            } catch {
              if (msg.type === 'f:audio') {
                content = JSON.stringify({ c: '🎤 Sent a voice message', a: attachments });
              } else {
                content = JSON.stringify({ c: '', a: attachments });
              }
            }

            // Update local RxDB first with the final non-pending attachment payload
            await db.messages.upsert({
              ...msg,
              content,
              attachments,
              status: 'pending' // Ready for remote upload
            });

            // Wait a brief moment to let local writes complete
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          // Now, push the message to Appwrite!
          console.log(`[BackgroundSync] Uploading document to Appwrite for message ${msg.id}...`);

          const appwriteDoc = {
            conversationId: msg.conversationId,
            senderId: msg.senderId,
            content: content,
            type: msg.type || 'text',
            status: 'sent',
            ip: msg.ip || '0.0.0.0',
            isPinned: msg.isPinned || false,
            attachments: attachments,
            mathMeta: msg.mathMeta ? msg.mathMeta : null
          };

          const permissions = [
            Permission.read(Role.any()),
            Permission.write(Role.any()),
            Permission.update(Role.any()),
            Permission.delete(Role.any()),
          ];

          try {
            await databases.createDocument(
              APPWRITE_CONFIG.databaseId,
              APPWRITE_CONFIG.collections.messages,
              msg.id,
              appwriteDoc,
              permissions
            );
            console.log(`[BackgroundSync] Appwrite document created successfully for ${msg.id}`);
          } catch (appwriteErr: any) {
            const code = appwriteErr.code || appwriteErr.status;
            const errMsg = (appwriteErr.message || '').toLowerCase();
            
            if (code === 409 || errMsg.includes('already exists') || errMsg.includes('unique_index_violation')) {
              console.info(`[BackgroundSync] Message ${msg.id} already exists on Appwrite remote.`);
            } else {
              throw appwriteErr; // Propagate non-conflict errors to outer catch block
            }
          }

          // Successfully synchronized! Update local message status to 'sent'
          await db.messages.upsert({
            ...msg,
            content,
            attachments,
            status: 'sent'
          });

          // Delete from mediaCacheDB to free up space since it's now on Appwrite!
          try {
            await mediaCacheDB.delete(msg.id);
          } catch (delErr) {
            console.warn('[BackgroundSync] Error cleaning media cache:', delErr);
          }

          console.log(`[BackgroundSync] Message ${msg.id} fully synchronized.`);

        } catch (itemErr: any) {
          console.error(`[BackgroundSync] Failed to sync message ${msg.id}:`, itemErr);
          // Leave the message with its status so it can be retried during the next sync run
        }

        // Intra-chunk throttling delay to prevent API rate limiting
        await new Promise(resolve => setTimeout(resolve, THROTTLE_DELAY_MS));
      }

      // Inter-chunk cooling delay to let connections settle down
      if (chunkIndex < chunks.length - 1 && isOnline()) {
        console.log(`[BackgroundSync] Cooling down for ${COOLDOWN_DELAY_MS}ms before processing next batch chunk...`);
        await new Promise(resolve => setTimeout(resolve, COOLDOWN_DELAY_MS));
      }
    }

  } catch (err) {
    console.error('[BackgroundSync] Critical error during background sync:', err);
  } finally {
    isSyncing = false;
    console.log('[BackgroundSync] Chunked background sync completed.');
  }
}

/**
 * Initializes the background synchronization service.
 * Registers event listeners for browser network status transitions,
 * triggers an immediate run, and starts a low-overhead periodic timer.
 */
export function startBackgroundSyncService(): void {
  if (typeof window === 'undefined') return;

  if (syncTimer) {
    console.log('[BackgroundSync] Service already started.');
    return;
  }

  console.log('[BackgroundSync] Initializing background sync service with throttling...');

  // 1. Listen specifically for browser network transitions from offline to online
  window.addEventListener('online', () => {
    console.log('[BackgroundSync] Network event: Online detected. Setting debounce timer...');
    if (onlineDebounceTimeout) {
      clearTimeout(onlineDebounceTimeout);
    }
    // Debounce/Throttle trigger: Wait 1500ms after online event to guarantee stable network state
    onlineDebounceTimeout = setTimeout(() => {
      console.log('[BackgroundSync] Network state settled. Initiating sync run.');
      triggerBackgroundSync().catch(console.error);
    }, 1500);
  });

  // 2. Trigger an immediate run on start (highly efficient)
  setTimeout(() => {
    triggerBackgroundSync().catch(console.error);
  }, 4000);

  // 3. Setup a periodic background interval (e.g. every 45 seconds for periodic fallback checking)
  syncTimer = setInterval(() => {
    triggerBackgroundSync().catch(console.error);
  }, 45000);
}

/**
 * Stops the background synchronization service periodic timer
 */
export function stopBackgroundSyncService(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
    console.log('[BackgroundSync] Service stopped.');
  }
  if (onlineDebounceTimeout) {
    clearTimeout(onlineDebounceTimeout);
    onlineDebounceTimeout = null;
  }
}
