import { ID, Query, Permission, Role } from './appwriteService';
import { databases, APPWRITE_CONFIG, getUserIP, isAppwriteConfigured, client, safeListDocuments, withRetry } from './appwriteService';
import { dbService } from './dbService';
import { authService } from './authService';
import { getAverageColor } from '../utils/dominantColor';
import { writable } from 'svelte/store';

export const typingStore = writable<Record<string, string>>({}); // userId -> conversationId
const typingTimeouts = new Map<string, any>();

let activeSubscriptions: any[] = [];
let isPreloaded = false;
let syncConvosPromise: Promise<void> | null = null;
let lastConvoSyncTime = 0;
const CONVO_SYNC_COOLDOWN = 90000; // 90 seconds cooldown for automatic background sync

const syncingMessagesPromises = new Map<string, Promise<void>>();
const processingPins = new Set<string>();

/**
 * Generates a client-side compliant UUID v4 to support offline-first RxDB.
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Validates if an ID is a valid ID for Appwrite Document IDs.
 * Appwrite IDs: at most 36 chars. Valid chars: a-z, A-Z, 0-9, ., -, _. 
 * Cannot start with a special character (must start with letter or number).
 */
function isValidId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  if (id.length > 36) return false;
  // Must start with alphanumeric, then can have allowed special chars
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(id);
}

function getDeletedConversations(): string[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    return JSON.parse(localStorage.getItem('deleted_convos') || '[]');
  } catch {
    return [];
  }
}

function isConversationDeleted(conversationId: string): boolean {
  if (!conversationId) return false;
  return getDeletedConversations().includes(conversationId);
}

function markConversationDeleted(conversationId: string) {
  if (!conversationId) return;
  try {
    if (typeof localStorage === 'undefined') return;
    const deleted = getDeletedConversations();
    if (!deleted.includes(conversationId)) {
      deleted.push(conversationId);
      localStorage.setItem('deleted_convos', JSON.stringify(deleted));
    }
  } catch (err) {
    console.warn('Failed to mark conversation as deleted in localStorage:', err);
  }
}

function restoreConversation(conversationId: string) {
  if (!conversationId) return;
  try {
    if (typeof localStorage === 'undefined') return;
    const deleted = getDeletedConversations();
    if (deleted.includes(conversationId)) {
      const filtered = deleted.filter(id => id !== conversationId);
      localStorage.setItem('deleted_convos', JSON.stringify(filtered));
      console.log(`[MessagingService] Restoring conversation ${conversationId}, removed from deleted list.`);
    }
  } catch (err) {
    console.warn('Failed to restore conversation in localStorage:', err);
  }
}

let isSettingUpRealtime = false;
let recentlyDeletedMessageIds = new Set<string>();
let recentlyDeletedConvoIds = new Set<string>();

export const messagingService = {
  isConversationDeleted(conversationId: string): boolean {
    return isConversationDeleted(conversationId);
  },
  markConversationDeleted(conversationId: string) {
    markConversationDeleted(conversationId);
  },
  restoreConversation(conversationId: string) {
    restoreConversation(conversationId);
  },
  async restoreConversationLocallyAndRemotely(conversationId: string) {
    if (!conversationId) return;
    console.log(`[MessagingService] Restoring conversation ${conversationId} locally and remotely...`);
    
    // 1. Remove from local deleted lists/cache
    restoreConversation(conversationId);
    recentlyDeletedConvoIds.delete(conversationId);
    
    // 2. Fetch/Upsert conversation document from Appwrite/Supabase
    if (isAppwriteConfigured && APPWRITE_CONFIG.collections.conversations) {
      try {
        const convoDoc = await databases.getDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.conversations,
          conversationId
        );
        await dbService.upsertConversation({
          id: convoDoc.$id,
          name: (convoDoc as any).name || (convoDoc as any).Name || 'Restored Chat',
          is_group: (convoDoc as any).is_group || (convoDoc as any).isGroup || false,
          created_at: convoDoc.$createdAt || new Date().toISOString(),
          ip: (convoDoc as any).ip || '0.0.0.0'
        });
      } catch (convoErr) {
        console.warn(`[MessagingService] Failed to fetch/upsert conversation ${conversationId}:`, convoErr);
      }
    }
    
    // 3. Fetch all participants for this conversation from Appwrite/Supabase
    if (isAppwriteConfigured && APPWRITE_CONFIG.collections.participants) {
      try {
        const partsResult = await safeListDocuments(APPWRITE_CONFIG.collections.participants, [
          Query.equal('conversationId', conversationId)
        ]);
        
        const currentUser = await authService.getCurrentUser();
        
        for (const pDoc of partsResult.documents) {
          const isMe = (pDoc as any).userId === currentUser?.$id || (pDoc as any).user_id === currentUser?.$id;
          const isDeletedOnRemote = (pDoc as any).isDeleted || (pDoc as any).is_deleted || false;
          
          let lastReadAt = (pDoc as any).lastReadAt || (pDoc as any).last_read_at || new Date().toISOString();
          let lastMessageAt = (pDoc as any).lastMessageAt || (pDoc as any).last_message_at || new Date().toISOString();
          
          if (isMe && isDeletedOnRemote) {
            // Undelete our participant document on Appwrite/Supabase
            try {
              await databases.updateDocument(
                APPWRITE_CONFIG.databaseId,
                APPWRITE_CONFIG.collections.participants,
                pDoc.$id,
                { isDeleted: false, is_deleted: false }
              );
            } catch (updateErr) {
              console.warn(`[MessagingService] Failed to undelete participant ${pDoc.$id} remotely:`, updateErr);
            }
          }
          
          // Upsert participant document locally
          await dbService.upsertParticipant({
            id: pDoc.$id,
            conversationId: conversationId,
            userId: (pDoc as any).userId || (pDoc as any).user_id,
            isDeleted: isMe ? false : isDeletedOnRemote, // For other users, keep their deleted state as is
            lastReadAt,
            lastMessageAt,
            ip: (pDoc as any).ip || '0.0.0.0'
          });
        }
      } catch (partsErr) {
        console.warn(`[MessagingService] Failed to sync participants for restored conversation ${conversationId}:`, partsErr);
      }
    }
  },
  /**
   * Send typing status for the current user via Supabase
   */
  async sendTypingIndicator(conversationId: string, isTyping: boolean) {
    try {
      const user = await authService.getCurrentUser();
      if (!user) return;
      
      const userId = user.$id;
      
      // Update local typing store immediately for instant UI feedback
      typingStore.update(state => {
        if (isTyping) {
          return { ...state, [userId]: conversationId };
        } else {
          const newState = { ...state };
          delete newState[userId];
          return newState;
        }
      });
    
      // Send to Supabase for realtime sync with other clients
      const { supabase } = await import('./supabaseService');
      const payload = {
        user_id: userId,
        conversation_id: isTyping ? conversationId : null,
        is_typing: isTyping
      };
      
      const { error } = await supabase
        .from('typing_indicators')
        .upsert(payload, { onConflict: 'user_id' });
      
      if (error) {
        console.warn('Supabase sendTypingIndicator failed:', error.message);
      }
    } catch (err) {
      console.warn('sendTypingIndicator failed:', err);
    }
  },

  /**
   * Fetch all conversations for the current user with internal caching to reduce CPU usage
   */
  async getConversations(forceSync = false) {
    const user = await authService.getCurrentUser();
    if (!user) return [];

    const now = Date.now();
    
    // 1. Get from local RxDB
    const localConversations = await dbService.getMyConversations(user.$id);
    
    if (localConversations.length === 0 && isAppwriteConfigured) {
        // Fallback for initial load
        await this.syncConversations();
        const refreshedLocal = await dbService.getMyConversations(user.$id);
        if (refreshedLocal.length === 0) return [];
        localConversations.push(...refreshedLocal);
    }

    const db = await dbService.getRawDB();
    const profilesCache = new Map<string, any>();
    
    // FETCH ALL PARTICIPANTS FOR USER IN ONE GO
    const userParticipations = await db.participants.find({
        selector: { userId: user.$id }
    }).exec();
    const readAtMap = new Map(userParticipations.map(p => [p.conversationId, p.lastReadAt]));

    // 2. Fetch all participants for these conversations to find partners
    const allParticipants = await db.participants.find({
        selector: { conversationId: { $in: localConversations.map(c => c.id) } }
    }).exec();
    const participantMap = new Map<string, any[]>();
    allParticipants.forEach(p => {
        const convoId = p.conversationId;
        const list = participantMap.get(convoId) || [];
        list.push(p);
        participantMap.set(convoId, list);
    });

    // 3. Bulk fetch profiles for all partners
    const partnerIds = new Set<string>();
    localConversations.forEach(convo => {
        const parts = participantMap.get(convo.id) || [];
        const partner = parts.find(p => p.userId !== user.$id);
        if (partner) partnerIds.add(partner.userId);
    });
    
    // First from local
    const partnerProfilesArray = await db.profiles.find({
        selector: { userId: { $in: Array.from(partnerIds) } }
    }).exec();
    const profilesMap = new Map(partnerProfilesArray.map(p => [p.userId, p.toJSON()]));

    // Fetch missing from Appwrite/Cache in parallel
    const missingProfiles = Array.from(partnerIds).filter(id => !profilesMap.has(id));
    if (missingProfiles.length > 0) {
       await Promise.all(missingProfiles.map(async (mid) => {
          try {
             // getProfile uses internal memory cache in authService
             const rp = await authService.getProfile(mid);
             if (rp) {
                const mapped = {
                    userId: rp.userId || rp.$id,
                    fullName: rp.fullName || rp.name,
                    role: rp.role,
                    school: rp.school,
                    bio: rp.bio,
                    avatarUrl: rp.avatarUrl,
                    points: rp.points,
                    isOnline: authService.computeIsOnline(rp),
                    lastSeenAt: rp.lastSeenAt || null
                };
                profilesMap.set(mapped.userId, mapped);
                // Background update local cache
                dbService.upsertProfile(mapped).catch(() => {});
             }
          } catch (err) {
             console.warn(`messagingService: Failed to fetch missing profile for ${mid}`, err);
          }
       }));
    }

    // 4. Transform conversations
    const result = await Promise.all(localConversations.map(async (convo) => {
      const lastMessage = await dbService.getLastMessage(convo.id);
      const lastReadAt = readAtMap.get(convo.id) || '1970-01-01T00:00:00.000Z';
      
      let isOnline = false;
      let partnerName = convo.name || 'Anonymous';
      if (partnerName === 'Direct Chat') partnerName = 'Student';
      let avatarUrl = '';
      let partnerId = null;

      const isGroupConvo = convo.isGroup || false;
      if (!isGroupConvo) {
        const parts = participantMap.get(convo.id) || [];
        const partner = parts.find(p => p.userId !== user.$id);
        if (partner) {
           partnerId = partner.userId;
           const profile = profilesMap.get(partnerId);
           if (profile) {
              isOnline = authService.computeIsOnline(profile);
              partnerName = profile.fullName || partnerName;
              avatarUrl = profile.avatarUrl || '';
           }
        }
      }

      const partnerProfile = partnerId ? profilesMap.get(partnerId) : null;
      return {
        ...convo,
        name: partnerName,
        avatarUrl,
        partnerId,
        lastMessage,
        lastReadAt,
        isOnline,
        is_online: isOnline,
        lastSeenAt: partnerProfile?.lastSeenAt || partnerProfile?.last_seen_at || convo.lastSeenAt || null,
        isGroup: isGroupConvo,
        createdAt: convo.createdAt
      };
    }));

    // Deduplicate private conversations by partner
    const uniqueResultMap = new Map();
    for (const c of result) {
       const isGroupConvo = c.isGroup || false;
       if (isGroupConvo || !c.partnerId) {
          uniqueResultMap.set(c.id, c);
       } else {
          // If we already have a conversation for this partner, keep the one with the newest message or newest created date
          const existing = uniqueResultMap.get(c.partnerId);
          if (existing) {
             const timeC = new Date(c.lastMessage?.createdAt || c.lastMessage?.created_at || c.createdAt || c.created_at || '1970-01-01').getTime();
             const timeE = new Date(existing.lastMessage?.createdAt || existing.lastMessage?.created_at || existing.createdAt || existing.created_at || '1970-01-01').getTime();
             if (timeC > timeE) {
                uniqueResultMap.set(c.partnerId, c);
             }
          } else {
             uniqueResultMap.set(c.partnerId, c);
          }
       }
    }
    const finalResult = Array.from(uniqueResultMap.values());

    const sortConversations = (arr: any[]) => arr.sort((a, b) => {
      const timeA = a.lastMessage?.createdAt || a.createdAt || '1970-01-01';
      const timeB = b.lastMessage?.createdAt || b.createdAt || '1970-01-01';
      return new Date(timeB).getTime() - new Date(timeA).getTime();
    });

    const sortedConvos = sortConversations(finalResult);
    console.log(`[messagingService] getConversations returning ${sortedConvos.length} items:`, sortedConvos);

    // Handle background sync with extended cooldown
    if (isAppwriteConfigured) {
      const shouldSync = forceSync || (now - lastConvoSyncTime > CONVO_SYNC_COOLDOWN);
      if (shouldSync) {
        this.syncConversations().catch(console.error);
        lastConvoSyncTime = now;
      }
      this.setupRealtimeListeners().catch(console.error);
    }

    return sortedConvos;
  },

  /**
   * Setup Supabase Realtime Listeners
   */
  async setupRealtimeListeners() {
    if (activeSubscriptions.length > 0 || isSettingUpRealtime) return;
    isSettingUpRealtime = true;

    try {
      const user = await authService.getCurrentUser();
      if (!user) return;

      console.log('Setting up Supabase Realtime listeners for messages...');

      // Start Supabase-native RxDB Replication using centralized manager to avoid duplicates
      import('./supabaseReplicationService').then(async (m) => {
         const db = await dbService.getRawDB();
         
         // Use centralized replication manager to avoid duplicate instances
         const reps = m.supabaseReplicationService.startAllReplication(db, user.$id);
         
         reps.forEach(rep => {
            if (rep && rep.error$) {
               rep.error$.subscribe((err: any) => {
                  console.warn('[Supabase Replication] Sync error:', err?.message || err);
               });
            }
            if (rep) {
               activeSubscriptions.push({ unsubscribe: () => rep.cancel() });
            }
         });

         // Setup database-level listener for incoming messages to restore swipe-deleted conversations
         const dbSub = db.messages.$.subscribe(async (changeEvent: any) => {
            if (changeEvent.operation === 'INSERT' || changeEvent.operation === 'UPDATE') {
               const doc = changeEvent.documentData;
               if (doc && doc.id) {
                  const conversationId = doc.conversationId || doc.conversation_id;
                  const senderId = doc.senderId || doc.sender_id || doc.userId || doc.user_id;

                  if (senderId && senderId !== user.$id) {
                     try {
                        const isLocallyDeleted = isConversationDeleted(conversationId) || recentlyDeletedConvoIds.has(conversationId);
                        let isMissingLocally = false;
                        const existingConvo = await db.conversations.findOne(conversationId).exec();
                        if (!existingConvo) {
                           isMissingLocally = true;
                        }

                        const pDoc = await db.participants.findOne({
                           selector: { conversationId: conversationId, userId: user.$id }
                        }).exec();
                        const isParticipantDeleted = pDoc ? (pDoc.isDeleted || (pDoc as any).is_deleted || false) : false;

                        if (isLocallyDeleted || isMissingLocally || isParticipantDeleted || !pDoc) {
                           console.log(`[Supabase RxDB Observer] Swipe-deleted/missing conversation ${conversationId} received message ${doc.id}. Restoring...`);
                           await this.restoreConversationLocallyAndRemotely(conversationId);
                        }
                     } catch (err) {
                        console.warn('[Supabase RxDB Observer] Auto-restoration check failed:', err);
                     }
                  }
               }
            }
         });
         activeSubscriptions.push({ unsubscribe: () => dbSub.unsubscribe() });
      }).catch(err => console.warn('Failed to start Supabase replication:', err));

      // 1. Listen for new messages via Supabase Realtime
      import('./supabaseService').then(async ({ supabaseRealtime, supabaseAdmin }) => {
         const msgSub = supabaseRealtime.subscribeToMessages('*', async (payload: any) => {
            console.log('Supabase Realtime event received:', payload.eventType, payload.new?.id || payload.old?.id);
            
            if (payload.eventType === 'DELETE') {
               const oldId = payload.old?.id;
               if (oldId) {
                  dbService.deleteMessage(oldId).catch(() => {});
               }
               return;
            }

            const doc = payload.new;
            if (!doc || !doc.id) return;
            
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
               const conversationId = doc.conversation_id || doc.conversationId;
               const senderId = doc.sender_id || doc.senderId || doc.user_id || doc.userId;

               // Parse attachments safely
               let attachments = doc.attachments || [];
               if (typeof attachments === 'string') {
                  try { attachments = JSON.parse(attachments); } catch { attachments = []; }
               }

               // Parse mathMeta safely
               let mathMeta = doc.math_meta ?? doc.mathMeta;
               if (typeof mathMeta === 'string') {
                  try { mathMeta = JSON.parse(mathMeta); } catch { mathMeta = null; }
               }

               // Parse strokes safely
               let strokes = doc.strokes || [];
               if (typeof strokes === 'string') {
                  try { strokes = JSON.parse(strokes); } catch { strokes = []; }
               } else if (doc.stroke && typeof doc.stroke === 'string') {
                  try { strokes = JSON.parse(doc.stroke); } catch { strokes = []; }
               } else if (Array.isArray(doc.stroke)) {
                  strokes = doc.stroke;
               }

               if ((!strokes || strokes.length === 0) && mathMeta) {
                  if (Array.isArray(mathMeta.strokes) && mathMeta.strokes.length > 0) {
                     strokes = mathMeta.strokes;
                  } else if (Array.isArray(mathMeta.annotation_strokes) && mathMeta.annotation_strokes.length > 0) {
                     strokes = mathMeta.annotation_strokes;
                  } else if (Array.isArray(mathMeta.annotationStrokes) && mathMeta.annotationStrokes.length > 0) {
                     strokes = mathMeta.annotationStrokes;
                  }
               }

               // If remote user is still uploading media, wait for the update containing the public URL
               const hasPendingBlobUrl = attachments?.some((a: any) => a?.url?.startsWith('blob:'));
               if (hasPendingBlobUrl && senderId !== user.$id) {
                  return;
               }

               let localStatus = doc.status || 'sent';
               if (user && senderId && senderId !== user.$id && localStatus === 'sent') {
                  localStatus = 'delivered';
               }

               // 1. Immediately upsert into local RxDB!
               await dbService.upsertMessage({
                  id: doc.id,
                  conversationId,
                  senderId,
                  content: doc.content || '',
                  type: doc.type || 'text',
                  createdAt: doc.created_at || doc.createdAt || new Date().toISOString(),
                  status: localStatus,
                  ip: doc.ip || '0.0.0.0',
                  isPinned: doc.is_pinned ?? doc.isPinned ?? false,
                  attachments,
                  strokes,
                  mathMeta
               });

               // 2. If we are the recipient and status is 'sent', send immediate 'delivered' status receipt to Supabase!
               if (user && senderId && senderId !== user.$id && (doc.status === 'sent' || !doc.status)) {
                  supabaseAdmin
                     .from('messages')
                     .update({ status: 'delivered' })
                     .eq('id', doc.id)
                     .then(() => {})
                     .catch((err: any) => console.warn('[MessagingService] Failed to send delivery receipt:', err?.message || err));
               }

               // 2b. Trigger native notification for incoming message
               if (user && senderId && senderId !== user.$id && payload.eventType === 'INSERT') {
                  const preview = doc.content || (attachments?.length ? '[Attachment]' : 'New message');
                  dbService.getProfile(senderId, false).then((senderProfile: any) => {
                     const senderName = senderProfile?.fullName || senderProfile?.name || 'New message';
                     import('./nativeNotificationService').then(({ nativeNotificationService }) => {
                        nativeNotificationService.showLocalNotification({
                           title: senderName,
                           body: preview,
                           conversationId,
                           senderId,
                           senderName,
                        });
                     }).catch(() => {});
                  }).catch(() => {});
               }

               // 3. Update participant lastMessageAt so conversation sorting updates immediately
               if (user && conversationId) {
                  try {
                     const dbRaw = await dbService.getRawDB();
                     const pDoc = await dbRaw.participants.findOne({
                        selector: { conversationId, userId: user.$id }
                     }).exec();
                     if (pDoc) {
                        const participantId = pDoc.id || pDoc.$id;
                        const currentLastMsgAt = pDoc.lastMessageAt ? new Date(pDoc.lastMessageAt).getTime() : 0;
                        const newLastMsgAt = new Date(doc.created_at || doc.createdAt || new Date().toISOString()).getTime();
                        if (newLastMsgAt > currentLastMsgAt) {
                           await dbService.safePatchParticipant(participantId, {
                              lastMessageAt: new Date(newLastMsgAt).toISOString()
                           });
                        }
                     }
                  } catch (pErr) {}
               }

               // 4. Auto-restoration check for swipe-deleted / missing conversations
               if (senderId && senderId !== user.$id) {
                  try {
                     const isLocallyDeleted = isConversationDeleted(conversationId) || recentlyDeletedConvoIds.has(conversationId);
                     let isMissingLocally = false;
                     const db = await dbService.getRawDB();
                     const existingConvo = await db.conversations.findOne(conversationId).exec();
                     if (!existingConvo) {
                        isMissingLocally = true;
                     }

                     const pDoc = await db.participants.findOne({
                        selector: { conversationId: conversationId, userId: user.$id }
                     }).exec();
                     const isParticipantDeleted = pDoc ? (pDoc.isDeleted || (pDoc as any).is_deleted || false) : false;

                     if (isLocallyDeleted || isMissingLocally || isParticipantDeleted || !pDoc) {
                        await this.restoreConversationLocallyAndRemotely(conversationId);
                     }
                  } catch (restoreErr) {
                     console.warn('[Supabase MessagingService] Failed in auto-restoration check:', restoreErr);
                  }
               }
            }
         });
         activeSubscriptions.push({ unsubscribe: () => supabaseRealtime.removeChannel(msgSub) });
      }).catch(err => console.warn('Failed to start Supabase realtime:', err));

      // 2. Listen for typing indicators via Supabase
      import('./supabaseService').then(async ({ supabase }) => {
         const typingChannel = supabase
            .channel('typing_indicators')
            .on(
               'postgres_changes',
               { event: '*', schema: 'public', table: 'typing_indicators' },
               async (payload: any) => {
                  const doc = payload.new || payload.old;
                  if (!doc) return;
                  
                  const typingUserId = doc.user_id || doc.userId;
                  const typingConversationId = doc.conversation_id || doc.conversationId;
                  
                  const currentTimeoutId = typingTimeouts.get(typingUserId);
                  if (currentTimeoutId) {
                     clearTimeout(currentTimeoutId);
                     typingTimeouts.delete(typingUserId);
                  }

                  typingStore.update(state => {
                     if (typingConversationId) {
                        return { ...state, [typingUserId]: typingConversationId };
                     } else {
                        const newState = { ...state };
                        delete newState[typingUserId];
                        return newState;
                     }
                  });

                  if (typingConversationId) {
                     const timeout = setTimeout(() => {
                        typingStore.update(state => {
                           const newState = { ...state };
                           delete newState[typingUserId];
                           return newState;
                        });
                        typingTimeouts.delete(typingUserId);
                     }, 7000);
                     typingTimeouts.set(typingUserId, timeout);
                  }
               }
            )
            .subscribe();
         activeSubscriptions.push({ unsubscribe: () => supabase.removeChannel(typingChannel) });
      }).catch(err => console.warn('Failed to start Supabase typing channel:', err));

      // 3. Listen for new messages (Realtime triggers sync) - Appwrite fallback for compatibility
      if (isAppwriteConfigured && APPWRITE_CONFIG.databaseId && APPWRITE_CONFIG.collections.messages) {
         const channel = `databases.${APPWRITE_CONFIG.databaseId}.collections.${APPWRITE_CONFIG.collections.messages}.documents`;
         const msgSub = client.subscribe(
            channel,
            async (response: any) => {
          console.log('Realtime event received:', response.events[0], response.payload.$id);
          
          if (response.events.some((e: string) => e.includes('.create') || e.includes('.update'))) {
            const doc = response.payload;
            
            if (doc.type === 'typing') {
              const typingUserId = doc.sender_id || doc.senderId;
              const typingConversationId = doc.content || '';
              
              const currentTimeoutId = typingTimeouts.get(typingUserId);
              if (currentTimeoutId) {
                clearTimeout(currentTimeoutId);
                typingTimeouts.delete(typingUserId);
              }

              typingStore.update(state => {
                if (typingConversationId) {
                  return { ...state, [typingUserId]: typingConversationId };
                } else {
                  const newState = { ...state };
                  delete newState[typingUserId];
                  return newState;
                }
              });

              if (typingConversationId) {
                const timeout = setTimeout(() => {
                  typingStore.update(state => {
                    const newState = { ...state };
                    delete newState[typingUserId];
                    return newState;
                  });
                  typingTimeouts.delete(typingUserId);
                }, 7000);
                typingTimeouts.set(typingUserId, timeout);
              }
              return;
            }
            
            // Guard only applies to specific deleted MESSAGE ids, never conversation ids
            if (recentlyDeletedMessageIds.has(doc.$id)) {
                console.log(`Realtime: Skipping recently deleted document ${doc.$id}`);
                return;
            }
            
            const conversationId = doc.conversation_id || doc.conversationId;
            const senderId = doc.sender_id || doc.senderId || doc.user_id || doc.userId;

            // Highly robust single swipe-deletion auto-restoration block
            try {
              const isLocallyDeleted = isConversationDeleted(conversationId) || recentlyDeletedConvoIds.has(conversationId);
              let isMissingLocally = false;
              const db = await dbService.getRawDB();
              const existingConvo = await db.conversations.findOne(conversationId).exec();
              if (!existingConvo) {
                isMissingLocally = true;
              }
              
              const pDoc = await db.participants.findOne({
                selector: { conversationId: conversationId, userId: user.$id }
              }).exec();
              const isParticipantDeleted = pDoc ? (pDoc.isDeleted || (pDoc as any).is_deleted || false) : false;

              if (isLocallyDeleted || isMissingLocally || isParticipantDeleted || !pDoc) {
                await this.restoreConversationLocallyAndRemotely(conversationId);
              }
            } catch (restoreErr) {
              console.warn('[MessagingService] Failed in auto-restoration check:', restoreErr);
            }

            const content = doc.content;
            const type = doc.type;
            let attachments = (doc.attachments || []).map((a: string) => {
              try { return typeof a === 'string' ? JSON.parse(a) : a; } catch { return a; }
            });

            // Parse attachments from content if prefixed type
            if (type?.startsWith('f:') && content?.startsWith('{')) {
                try {
                    const parsed = JSON.parse(content);
                    if (parsed.a && Array.isArray(parsed.a)) {
                        attachments = parsed.a;
                    }
                } catch (e) {
                    console.warn('Realtime: Parsing attachments failed for message', doc.$id);
                }
            }

            let mathMeta = doc.mathMeta || doc.math_meta || null;
            if (mathMeta && typeof mathMeta === 'string') {
              try {
                mathMeta = JSON.parse(mathMeta);
              } catch (e) {
                console.warn('Realtime: Failed parsing mathMeta:', e);
              }
            }

            let strokes = doc.strokes || [];
            if (typeof strokes === 'string') {
              try {
                strokes = JSON.parse(strokes);
              } catch (e) {
                strokes = [];
              }
            }
            if ((!strokes || strokes.length === 0) && mathMeta) {
              if (Array.isArray(mathMeta.strokes) && mathMeta.strokes.length > 0) {
                strokes = mathMeta.strokes;
              } else if (Array.isArray(mathMeta.annotation_strokes) && mathMeta.annotation_strokes.length > 0) {
                strokes = mathMeta.annotation_strokes;
              }
            }

            // Sync to local RxDB
            await dbService.upsertMessage({
              id: doc.$id || doc.id || doc._id,
              conversationId: doc.conversationId || doc.conversation_id,
              senderId: doc.senderId || doc.sender_id || doc.userId || doc.user_id,
              content: content || '',
              type: type || 'text',
              createdAt: doc.$createdAt || doc.created_at || new Date().toISOString(),
              status: doc.status || 'delivered',
              ip: doc.ip || '0.0.0.0',
              attachments,
              strokes,
              mathMeta
            });

            if (user && senderId && senderId !== user.$id && (doc.status === 'sent' || !doc.status)) {
               try {
                 await databases.updateDocument(
                   APPWRITE_CONFIG.databaseId,
                   APPWRITE_CONFIG.collections.messages,
                   doc.$id,
                   { status: 'delivered' }
                 );
               } catch (e) {}
            }

            if (user) {
              const dbRaw = await dbService.getRawDB();
              const pDoc = await dbRaw.participants.findOne({
                  selector: { conversationId: conversationId, userId: user.$id }
              }).exec();
              if (pDoc) {
                  const participantId = pDoc.id || pDoc.$id;
                  const currentLastMsgAt = pDoc.lastMessageAt ? new Date(pDoc.lastMessageAt).getTime() : 0;
                  const newLastMsgAt = new Date(doc.$createdAt || doc.created_at || new Date().toISOString()).getTime();
                  if (newLastMsgAt > currentLastMsgAt) {
                      await dbService.safePatchParticipant(participantId, {
                          lastMessageAt: new Date(newLastMsgAt).toISOString()
                      });
                  }
              }
            }
          }
        }
      );
      activeSubscriptions.push(msgSub);
    }

    // 2. Listen for participant changes (new conversations)
    if (isAppwriteConfigured && APPWRITE_CONFIG.databaseId && APPWRITE_CONFIG.collections.participants) {
      const partSub = client.subscribe(
        `databases.${APPWRITE_CONFIG.databaseId}.collections.${APPWRITE_CONFIG.collections.participants}.documents`,
        async (response: any) => {
          if (response.events.some((e: string) => e.includes('.create'))) {
            const doc = response.payload;
            if (doc.user_id === user.$id || doc.userId === user.$id) {
              // New conversation participation for me!
              this.syncConversations(); 
            }
          }
        }
      );
      activeSubscriptions.push(partSub);
    }

    // 3. Listen for friendship notifications
    if (isAppwriteConfigured && APPWRITE_CONFIG.databaseId && APPWRITE_CONFIG.collections.friendships) {
        const friendSub = client.subscribe(
          `databases.${APPWRITE_CONFIG.databaseId}.collections.${APPWRITE_CONFIG.collections.friendships}.documents`,
          async (response: any) => {
            const data = response.payload;
            // Always trigger background sync to local RxDB so that local state matches the cloud instantly
            if (user?.$id) {
               try {
                 const { friendshipService } = await import('./friendshipService');
                 await friendshipService.syncFriendships(user.$id);
               } catch (syncErr) {
                 console.warn('Real-time friendship sync failed:', syncErr);
               }
            }

            if (response.events.some((e: string) => e.includes('.create'))) {
              // If someone else invited me (Appwrite attributes are usually Capitalized in this app)
              if ((data.friend_id === user.$id || data.friendId === user.$id) && (data.Status === 'Pending' || data.status === 'Pending')) {
                 try {
                   const notificationService = await import('./notificationService');
                   notificationService.triggerNotification('New Request', {
                      body: 'Someone wants to connect with you.',
                      type: 'info'
                   });
                 } catch (e) {}
              }
            } else if (response.events.some((e: string) => e.includes('.update'))) {
                // If my request was accepted
                if ((data.user_id === user.$id || data.userId === user.$id) && (data.Status === 'Accepted' || data.status === 'Accepted')) {
                   try {
                     const notificationService = await import('./notificationService');
                     notificationService.triggerNotification('Request Accepted', {
                        body: 'Your connection request was accepted!',
                        type: 'success'
                     });
                     // Refresh conversations to show the new one
                     this.syncConversations();
                   } catch (e) {}
                }
            }
          }
        );
        activeSubscriptions.push(friendSub);
      }

      // 4. Listen for profile changes (Presence/Online/Editing status)
      if (isAppwriteConfigured && APPWRITE_CONFIG.databaseId && APPWRITE_CONFIG.collections.profiles) {
        const profileSub = client.subscribe(
          `databases.${APPWRITE_CONFIG.databaseId}.collections.${APPWRITE_CONFIG.collections.profiles}.documents`,
          async (response: any) => {
                if (response.events.some((e: string) => e.includes('.update') || e.includes('.create'))) {
                  const doc = response.payload;
                  const userId = doc.userId || doc.user_id;

                  // Optimization: only upsert if status/data actually changed
                  const existing = await dbService.getProfile(userId, false);
                  const isOnlineVal = authService.computeIsOnline(doc);
                  const lastSeenAtVal = doc.lastSeenAt ?? existing?.lastSeenAt ?? null;
                  const avatarUrlVal = doc.avatarUrl ?? existing?.avatarUrl ?? '';
                  const fullNameVal = doc.fullName ?? existing?.fullName ?? '';
                  const schoolVal = doc.school ?? existing?.school ?? '';
                  const bioVal = doc.bio ?? existing?.bio ?? '';
                  const studentClassVal = doc.studentClass ?? existing?.studentClass ?? '';
                  const ageVal = doc.age !== undefined ? String(doc.age) : (existing?.age ?? '');
                  const houseVal = doc.house ?? existing?.house ?? '';
                  const preferredSubjectsVal = doc.preferredSubjects ?? existing?.preferredSubjects ?? '';
                  const subjectCombinationVal = doc.subjectCombination ?? existing?.subjectCombination ?? '';
                  const clubsVal = doc.clubs ?? existing?.clubs ?? '';
                  const pointsVal = doc.points !== undefined ? doc.points : (existing?.points ?? 0);

                  if (existing && 
                      existing.isOnline === isOnlineVal && 
                      existing.lastSeenAt === lastSeenAtVal &&
                      existing.avatarUrl === avatarUrlVal &&
                      existing.fullName === fullNameVal &&
                      existing.school === schoolVal &&
                      existing.bio === bioVal &&
                      existing.studentClass === studentClassVal &&
                      existing.age === ageVal &&
                      existing.house === houseVal &&
                      existing.preferredSubjects === preferredSubjectsVal &&
                      existing.subjectCombination === subjectCombinationVal &&
                      existing.clubs === clubsVal &&
                      existing.points === pointsVal) {
                    return;
                  }

                  const updatedProfile = {
                    userId: userId,
                    isOnline: isOnlineVal,
                    lastSeenAt: lastSeenAtVal,
                    avatarUrl: avatarUrlVal,
                    fullName: fullNameVal,
                    school: schoolVal,
                    bio: bioVal,
                    studentClass: studentClassVal,
                    age: ageVal,
                    house: houseVal,
                    preferredSubjects: preferredSubjectsVal,
                    subjectCombination: subjectCombinationVal,
                    clubs: clubsVal,
                    points: pointsVal
                  };
                  await dbService.upsertProfile(updatedProfile);
                  // Refresh memory cache in authService to keep things fast
                  authService.updateProfileCacheEntry(userId, updatedProfile);
                }
          }
        );
        activeSubscriptions.push(profileSub);
      }
    } finally {
      isSettingUpRealtime = false;
    }
  },

  /**
   * Sync conversations from Appwrite to RxDB
   */
  async syncConversations() {
    // All guards BEFORE assigning the lock — prevents permanent lock on early exit
    if (!isAppwriteConfigured ||
        !APPWRITE_CONFIG.collections.conversations ||
        !APPWRITE_CONFIG.collections.participants) return;
    if (syncConvosPromise) return syncConvosPromise;

    syncConvosPromise = (async () => {
      try {
        const user = await authService.getCurrentUser();
        if (!user) return;

        console.log('messagingService: Syncing conversations for user:', user.$id);

        let participantResult;
        try {
          participantResult = await withRetry(() => safeListDocuments(
            APPWRITE_CONFIG.collections.participants,
            [Query.equal('userId', user.$id), Query.limit(100)]
          ));
        } catch (e) {
          console.warn("[messagingService] Indexed sync failed for participants, falling back:", e);
          const { fallbackListAllDocuments } = await import('./appwriteService');
          participantResult = await fallbackListAllDocuments(
            APPWRITE_CONFIG.collections.participants, 
            (d: any) => d.userId === user.$id || d.user_id === user.$id
          );
        }

        console.log(`messagingService: Found ${participantResult.documents.length} participants in Appwrite.`);
        const conversationIds = participantResult.documents
          .map(p => (p as any).conversation_id || (p as any).conversationId)
          .filter(id => {
            if (!id) return false;
            if (recentlyDeletedConvoIds.has(id) || isConversationDeleted(id)) return false;
            return true;
          });
        
        if (conversationIds.length === 0) {
          console.log('messagingService: No active conversation participations found for user.');
          return;
        }

        // 1.5 Sync participants locally in bulk
        const participantsToUpsert = participantResult.documents
          .filter(pDoc => {
            const cid = (pDoc as any).conversationId || (pDoc as any).conversation_id;
            if (!cid) return false;
            if (recentlyDeletedConvoIds.has(cid) || isConversationDeleted(cid)) return false;
            return true;
          })
          .map(pDoc => ({
            id: pDoc.$id,
            conversationId: (pDoc as any).conversationId || (pDoc as any).conversation_id,
            userId: (pDoc as any).userId || (pDoc as any).user_id,
            lastReadAt: (pDoc as any).lastReadAt || (pDoc as any).last_read_at || new Date().toISOString(),
            ip: (pDoc as any).ip || '0.0.0.0',
            isDeleted: (pDoc as any).isDeleted || (pDoc as any).is_deleted || false,
            deletedAt: (pDoc as any).deletedAt || (pDoc as any).deleted_at || null,
            clearedAt: (pDoc as any).clearedAt || (pDoc as any).cleared_at || null,
            lastMessageAt: (pDoc as any).lastMessageAt || (pDoc as any).last_message_at || null
          }));
        await dbService.bulkUpsertParticipants(participantsToUpsert);
        console.log(`messagingService: Upserted ${participantsToUpsert.length} participants to local DB.`);

        // 2. Fetch the conversations themselves in batches (Appwrite has limits on Query.equal array size, usually 100 is fine but let's be safe)
        const uniqueConvoIds = [...new Set(conversationIds)];
        
        let convoResult;
        try {
          convoResult = await withRetry(() => safeListDocuments(
            APPWRITE_CONFIG.collections.conversations,
            [Query.equal('$id', uniqueConvoIds), Query.limit(100)]
          ));
        } catch (e) {
          console.warn("[messagingService] Indexed sync failed for conversations, falling back:", e);
          const { fallbackListAllDocuments } = await import('./appwriteService');
          convoResult = await fallbackListAllDocuments(
            APPWRITE_CONFIG.collections.conversations,
            (d: any) => uniqueConvoIds.includes(d.$id)
          );
        }

        // 2.5 Fetch all participants for these conversations in chunks
        const chunkSize = 25;
        const allParticipantsDocs = [];
        for (let i = 0; i < uniqueConvoIds.length; i += chunkSize) {
           const chunk = uniqueConvoIds.slice(i, i + chunkSize);
           try {
              const chunkResult = await withRetry(() => safeListDocuments(
                APPWRITE_CONFIG.collections.participants,
                [Query.equal('conversationId', chunk), Query.limit(100)]
              ));
              allParticipantsDocs.push(...chunkResult.documents);
           } catch(e) {
              console.warn('[messagingService] Indexed sync failed for conversationId, falling back', e);
              const { fallbackListAllDocuments } = await import('./appwriteService');
              const fallbackResult = await fallbackListAllDocuments(
                APPWRITE_CONFIG.collections.participants,
                (d: any) => chunk.includes(d.conversationId || d.conversation_id)
              );
              allParticipantsDocs.push(...fallbackResult.documents);
           }
         }

         const allParticipantsToUpsert = allParticipantsDocs
          .filter(pDoc => {
            const cid = (pDoc as any).conversationId || (pDoc as any).conversation_id;
            if (!cid) return false;
            if (recentlyDeletedConvoIds.has(cid) || isConversationDeleted(cid)) return false;
            return !!cid;
          })
          .map(pDoc => ({
            id: pDoc.$id,
            conversationId: (pDoc as any).conversationId || (pDoc as any).conversation_id,
            userId: (pDoc as any).userId || (pDoc as any).user_id,
            lastReadAt: (pDoc as any).lastReadAt || (pDoc as any).last_read_at || new Date().toISOString(),
            ip: (pDoc as any).ip || '0.0.0.0',
            isDeleted: (pDoc as any).isDeleted || (pDoc as any).is_deleted || false,
            deletedAt: (pDoc as any).deletedAt || (pDoc as any).deleted_at || null,
            clearedAt: (pDoc as any).clearedAt || (pDoc as any).cleared_at || null,
            lastMessageAt: (pDoc as any).lastMessageAt || (pDoc as any).last_message_at || null
          }));
        await dbService.bulkUpsertParticipants(allParticipantsToUpsert);

        console.log(`messagingService: Fetched ${convoResult.documents.length} conversation details from Appwrite.`);

        if (convoResult.documents.length > 0) {
          const convosToUpsert = convoResult.documents
            .filter(convoDoc => {
              const cid = convoDoc.$id;
              if (cid && (recentlyDeletedConvoIds.has(cid) || isConversationDeleted(cid))) {
                return false;
              }
              return true;
            })
            .map(convoDoc => ({
              id: convoDoc.$id,
              name: (convoDoc as any).fullName || (convoDoc as any).Name || (convoDoc as any).name,
              isGroup: (convoDoc as any).isGroup || (convoDoc as any).Is_group || (convoDoc as any).is_group || false,
              createdAt: convoDoc.$createdAt,
              ip: (convoDoc as any).ip || '0.0.0.0'
            }));
          await dbService.bulkUpsertConversations(convosToUpsert);
          console.log(`messagingService: Upserted ${convosToUpsert.length} conversations to local DB.`);
          
          // Trigger a background sync for the messages of these active conversations
          // to ensure their last messages appear in the inbox view.
          convosToUpsert.forEach(c => this.syncMessages(c.id, 1).catch(() => {}));
        }
      } catch (err) {
        console.error('Sync conversations failed:', err);
      } finally {
        syncConvosPromise = null;
      }
    })();

    return syncConvosPromise;
  },

  /**
   * Get messages for a specific conversation
   */
  async getMessages(conversationId: string) {
    // 1. Get from local RxDB
    const localMessages = await dbService.getMessages(conversationId);
    console.log(`[OFFLINE-DB] Retrieved ${localMessages.length} messages for ${conversationId} from local storage.`);
    
    // 2. Trigger background sync
    this.ensureConversationOnSupabase(conversationId).then(() => {
       this.syncMessages(conversationId).catch(console.error);
    }).catch(err => {
       console.warn('[MessagingService] Error in ensureConversationOnSupabase:', err);
       this.syncMessages(conversationId).catch(console.error);
    });
    
    return localMessages;
  },

  /**
   * Sync messages for a conversation
   */
  async syncMessages(conversationId: string, limit: number = 50) {
    if (!isAppwriteConfigured || !APPWRITE_CONFIG.collections.messages) return;
    if (conversationId.startsWith('local_convo_') || conversationId.startsWith('mock_')) return;

    if (syncingMessagesPromises.has(conversationId)) {
       return syncingMessagesPromises.get(conversationId);
    }

    const syncPromise = (async () => {
      console.log(`messagingService: Syncing messages for conversation ${conversationId}...`);
      try {
        let result;
        try {
          result = await withRetry(() => safeListDocuments(
            APPWRITE_CONFIG.collections.messages,
            [
              Query.equal('conversationId', conversationId),
              Query.orderDesc('$createdAt'),
              Query.limit(limit)
            ]
          ));
        } catch (e) {
          console.warn(`[messagingService] Indexed sync failed for messages in ${conversationId}, falling back...`, e);
          const { fallbackListAllDocuments } = await import('./appwriteService');
          const allDocsResult = await fallbackListAllDocuments(
             APPWRITE_CONFIG.collections.messages,
             (d: any) => d.conversationId === conversationId || d.conversation_id === conversationId
          );
          result = {
             documents: allDocsResult.documents
                .sort((a: any, b: any) => new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime())
                .slice(0, limit)
          };
        }

        console.log(`messagingService: Found ${result.documents.length} messages in Appwrite for ${conversationId}.`);

        // Process messages in background
        if (result.documents.length > 0) {
          const docsToUpsert = result.documents
            .filter(doc => !recentlyDeletedMessageIds.has(doc.$id))
            .map(doc => {
            const content = (doc as any).content;
            const type = (doc as any).type;
            let attachments = ((doc as any).attachments || []).map((a: string) => {
              try { return JSON.parse(a); } catch { return a; }
            });

            // Fallback extraction of attachments from content JSON but DO NOT alter type and content!
            if (type?.startsWith('f:') && content?.startsWith('{')) {
              try {
                const parsed = JSON.parse(content);
                attachments = parsed.a || attachments;
              } catch (e) {}
            }

            let mathMeta = (doc as any).mathMeta || (doc as any).math_meta || null;
            if (mathMeta && typeof mathMeta === 'string') {
              try {
                mathMeta = JSON.parse(mathMeta);
              } catch (e) {
                console.warn('SyncMessages: Failed parsing mathMeta:', e);
              }
            }

            let strokes = (doc as any).strokes || [];
            if (typeof strokes === 'string') {
              try {
                strokes = JSON.parse(strokes);
              } catch (e) {
                strokes = [];
              }
            }
            if ((!strokes || strokes.length === 0) && mathMeta) {
              if (Array.isArray(mathMeta.strokes) && mathMeta.strokes.length > 0) {
                strokes = mathMeta.strokes;
              } else if (Array.isArray(mathMeta.annotation_strokes) && mathMeta.annotation_strokes.length > 0) {
                strokes = mathMeta.annotation_strokes;
              }
            }

            return {
              id: doc.$id,
              conversationId: (doc as any).conversationId || (doc as any).conversation_id,
              senderId: (doc as any).senderId || (doc as any).sender_id,
              content,
              type: type || 'text',
              createdAt: doc.$createdAt,
              status: (doc as any).status || 'sent',
              ip: (doc as any).ip || '0.0.0.0',
              attachments,
              strokes,
              mathMeta
            };
          });

          await dbService.bulkUpsertMessages(docsToUpsert);

          if (docsToUpsert.length > 0) {
            const latestMsg = docsToUpsert.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
            const user = await authService.getCurrentUser();
            if (user) {
              const db = await dbService.getRawDB();
              const pDoc = await db.participants.findOne({
                  selector: { conversationId: conversationId, userId: user.$id }
              }).exec();
              if (pDoc) {
                  const participantId = pDoc.id || pDoc.$id;
                  const currentLastMsgAt = pDoc.lastMessageAt ? new Date(pDoc.lastMessageAt).getTime() : 0;
                  const newLastMsgAt = new Date(latestMsg.createdAt).getTime();
                  if (newLastMsgAt > currentLastMsgAt) {
                    await dbService.safePatchParticipant(participantId, {
                        lastMessageAt: latestMsg.createdAt
                    });
                  }
              }
            }
          }
        }
      } catch (err) {
        console.error(`Sync messages failed for ${conversationId}:`, err);
      } finally {
         // Clear after a short delay to allow background processes to settle
         setTimeout(() => syncingMessagesPromises.delete(conversationId), 2000);
      }
    })();

    syncingMessagesPromises.set(conversationId, syncPromise);
    return syncPromise;
  },

  /**
   * Preload all messages for all conversations
   * Designed to be called after login to warm up the local cache
   */
  async preloadAllMessages() {
    if (!isAppwriteConfigured || isPreloaded) return;
    
    isPreloaded = true;
    console.log('messagingService: Starting background preload of all messages...');
    
    try {
      // 1. Sync conversations first to know what to fetch
      await this.syncConversations();
      
      // 2. Setup realtime early
      await this.setupRealtimeListeners();
      
      const user = await authService.getCurrentUser();
      if (!user) {
        isPreloaded = false;
        return;
      }
      
      const localConversations = await dbService.getMyConversations(user.$id);
      
      // 3. Batch sync messages for each conversation
      // We do this with a slight delay between each to avoid bogging down
      for (const convo of localConversations) {
        // Sync last 20 messages for each conversation to warm up the inbox
        await this.syncMessages(convo.id, 20);
        // Small breathing room
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      console.log('messagingService: Background preload complete.');
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes('fetch') || err?.toString?.().toLowerCase().includes('fetch')) {
         console.warn('messagingService: Preload pending network availability');
      } else {
         console.error('Preload failed:', err);
      }
    }
  },

  /**
   * Reset sync state (e.g. on logout)
   */
  resetSyncState() {
    isPreloaded = false;
    activeSubscriptions.forEach(sub => {
      if (typeof sub === 'function') {
        sub();
      } else if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    });
    activeSubscriptions = [];
  },



  /**
   * Send a voice message (optimistic)
   */
  async sendVoiceMessage(conversationId: string, audioBlob: Blob, duration: number, waveform: number[]) {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const msgId = generateUUID();
    const localAudioUrl = URL.createObjectURL(audioBlob);
    
    // Convert to native array to avoid typed array serialization issues
    const safeWaveform = Array.from(waveform || []);

    const initialAttachment = {
        type: 'audio',
        fileId: 'pending_' + Date.now(),
        url: localAudioUrl,
        duration: duration,
        waveform: JSON.stringify(safeWaveform),
        name: 'voice_message.opus',
        size: audioBlob.size,
    };

    // Immediately cache it locally for local playback
    const { audioPlaybackService } = await import('./audioPlaybackService.svelte');
    await audioPlaybackService.cacheLocalBlob(msgId, audioBlob);

    try {
      const { mediaCacheDB } = await import('./mediaCacheService');
      await mediaCacheDB.set(msgId, audioBlob);
    } catch (e) {
      console.warn('Failed to cache audio in mediaCacheDB:', e);
    }

    // 1. Optimistic write to RxDB
    const localDoc = await dbService.sendMessage({
      id: msgId,
      conversationId: conversationId,
      senderId: user.$id,
      content: JSON.stringify({ c: '🎤 Sent a voice message', a: [initialAttachment] }),
      type: 'f:audio',
      attachments: [initialAttachment]
    });

    this.ensureConversationOnSupabase(conversationId).catch(console.error);

    // 2. Background upload
    (async () => {
      try {
        const { mediaService } = await import('./mediaService');
        const fileId = await mediaService.uploadFile(audioBlob, `voice_message_${Date.now()}.opus`);
        if (!fileId) throw new Error('Upload failed');

        const audioUrl = mediaService.getFileView(fileId);
        
        const finalAttachment = {
          type: 'audio',
          fileId: fileId,
          url: audioUrl,
          duration: duration,
          waveform: JSON.stringify(safeWaveform),
          name: 'voice_message.opus',
          size: audioBlob.size,
        };
        
        await dbService.upsertMessage({
          id: msgId,
          conversationId: conversationId,
          senderId: user.$id,
          status: 'sent', 
          content: JSON.stringify({ c: '🎤 Sent a voice message', a: [finalAttachment] }),
          type: 'f:audio',
          attachments: [finalAttachment],
          ip: '0.0.0.0',
          createdAt: localDoc.createdAt || new Date().toISOString()
        });

        // Direct fast-path push to Supabase for instant delivery of the uploaded voice note
        const { supabaseAdmin } = await import('./supabaseService');
        await supabaseAdmin.from('messages').upsert({
          id: msgId,
          conversation_id: conversationId,
          sender_id: user.$id,
          status: 'sent',
          content: JSON.stringify({ c: '🎤 Sent a voice message', a: [finalAttachment] }),
          type: 'f:audio',
          attachments: [finalAttachment],
          ip: '0.0.0.0',
          created_at: localDoc.createdAt || new Date().toISOString()
        }, { onConflict: 'id' }).catch(() => {});
      } catch (err) {
        console.error('Voice message background task failed:', err);
        const docData = typeof localDoc.toJSON === 'function' ? localDoc.toJSON() : localDoc;
        await dbService.upsertMessage({ ...docData, id: msgId, status: 'error' });
      }
    })();

    return localDoc;
  },
  async sendImageMessage(conversationId: string, imageFile: File) {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const msgId = generateUUID();
    const localImageUrl = URL.createObjectURL(imageFile);
    
    let dominantColor = '#e2e8f0';
    try {
      dominantColor = await getAverageColor(imageFile);
    } catch (colorErr) {
      console.warn('Failed to extract dominant color:', colorErr);
    }
    
    const initialAttachment = {
        type: 'image',
        fileId: 'pending_' + Date.now(),
        url: localImageUrl,
        dominantColor
    };

    try {
      const { mediaCacheDB } = await import('./mediaCacheService');
      await mediaCacheDB.set(msgId, imageFile);
    } catch (e) {
      console.warn('Failed to cache image in mediaCacheDB:', e);
    }

    // 1. Optimistic write to RxDB
    const localDoc = await dbService.sendMessage({
      id: msgId,
      conversationId: conversationId,
      senderId: user.$id,
      content: JSON.stringify({ c: '', a: [initialAttachment] }),
      type: 'f:image',
      attachments: [initialAttachment]
    });

    // Ensure conversation and its participants exist on Supabase
    this.ensureConversationOnSupabase(conversationId).catch(console.error);

    // 2. Background upload 
    (async () => {
      try {
        const { mediaService } = await import('./mediaService');
        const fileId = await mediaService.uploadFile(imageFile);
        if (!fileId) throw new Error('Upload failed');

        const imageUrl = mediaService.getFileView(fileId);
        
        const finalAttachment = {
          type: 'image',
          fileId: fileId,
          url: imageUrl,
          dominantColor
        };
        
        await dbService.upsertMessage({
          id: msgId,
          conversationId: conversationId,
          senderId: user.$id,
          status: 'sent', 
          content: JSON.stringify({ c: '', a: [finalAttachment] }),
          type: 'f:image',
          attachments: [finalAttachment],
          ip: '0.0.0.0',
          createdAt: localDoc.createdAt || new Date().toISOString()
        });

        // Direct fast-path push to Supabase for instant delivery of the uploaded image
        const { supabaseAdmin } = await import('./supabaseService');
        await supabaseAdmin.from('messages').upsert({
          id: msgId,
          conversation_id: conversationId,
          sender_id: user.$id,
          status: 'sent',
          content: JSON.stringify({ c: '', a: [finalAttachment] }),
          type: 'f:image',
          attachments: [finalAttachment],
          ip: '0.0.0.0',
          created_at: localDoc.createdAt || new Date().toISOString()
        }, { onConflict: 'id' }).catch(() => {});
      } catch (err) {
        console.error('Image message background task failed:', err);
        const docData = typeof localDoc.toJSON === 'function' ? localDoc.toJSON() : localDoc;
        await dbService.upsertMessage({ ...docData, id: msgId, status: 'error' });
      }
    })();

    return localDoc;
  },

  /**
   * Send a message
   */
  async sendMessage(conversationId: string, content: string, type: string = 'text', attachments: any[] = [], mathMeta?: any, id?: string) {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error("Must be logged in to send messages");

    const msgId = id || generateUUID();
    
    // Fallback: If it's a file type, pack attachments into content to bypass strict schema pruning
    let finalContent = content;
    if (type.startsWith('f:') && attachments.length > 0) {
      finalContent = JSON.stringify({ c: content, a: attachments });
    }

    let finalMathMeta = mathMeta ? { ...mathMeta } : null;

    // 1. Optimistic write to RxDB
    const localDoc = await dbService.sendMessage({
      id: msgId,
      conversationId: conversationId,
      senderId: user.$id,
      content: finalContent,
      type,
      attachments,
      strokes: (finalMathMeta?.strokes && Array.isArray(finalMathMeta.strokes)) ? finalMathMeta.strokes : [],
      mathMeta: finalMathMeta
    });

    // 2. Update lastMessageAt on participant
    try {
      const db = await dbService.getRawDB();
      const pDoc = await db.participants.findOne({
          selector: { conversationId: conversationId, userId: user.$id }
      }).exec();
      if (pDoc) {
          const participantId = pDoc.id || pDoc.$id;
          await dbService.safePatchParticipant(participantId, {
              lastMessageAt: localDoc.createdAt
          });
      }
    } catch(e) {}

    // Ensure conversation and its participants exist on Supabase
    this.ensureConversationOnSupabase(conversationId).catch(console.error);

    // 3. Instant direct push to Supabase for sub-100ms remote delivery
    if (!conversationId.startsWith('local_convo_') && !conversationId.startsWith('mock_')) {
      import('./supabaseService').then(({ supabaseAdmin }) => {
        let mathMetaToPush = finalMathMeta;
        const strokesToSend = (finalMathMeta?.strokes && Array.isArray(finalMathMeta.strokes)) ? finalMathMeta.strokes : [];
        if (!mathMetaToPush && strokesToSend.length > 0) {
          mathMetaToPush = { annotation_strokes: strokesToSend, strokes: strokesToSend };
        }
        supabaseAdmin.from('messages').upsert({
          id: msgId,
          conversation_id: conversationId,
          sender_id: user.$id,
          content: finalContent,
          type,
          status: 'sent',
          attachments,
          strokes: strokesToSend,
          math_meta: mathMetaToPush,
          created_at: localDoc.createdAt || new Date().toISOString()
        }, { onConflict: 'id' }).then(({ error }) => {
          if (!error) {
            dbService.getRawDB().then(db => {
              db.messages.incrementalUpsert({ ...localDoc, status: 'sent' }).catch(() => {});
            });

            // Dispatch background push notification to wake offline recipients
            import('./nativeNotificationService').then(({ nativeNotificationService }) => {
              nativeNotificationService.dispatchPushNotification({
                conversationId,
                senderId: user.$id,
                senderName: user.name || user.prefs?.lastName || 'Xpresso User',
                content: finalContent,
              });
            }).catch(() => {});
          }
        }).catch(() => {});
      }).catch(() => {});
    }

    // Return the local doc with the msgId to ensure UI can track it properly
    // This ensures the message id is available immediately for rendering
    return { ...localDoc, id: msgId };
  },

  /**
   * Mark a whole conversation as read (updates participant lastReadAt)
   */
  async markConversationAsRead(conversationId: string) {
    const user = await authService.getCurrentUser();
    if (!user) return;
    const userId = user.$id;
    const now = new Date().toISOString();

    try {
      const db = await dbService.getRawDB();
      // 1. Patch RxDB immediately
      const doc = await db.participants.findOne({
        selector: { conversationId: conversationId, userId: userId }
      }).exec();
      
      let participantId: string | undefined;

      if (doc) {
        participantId = doc.id || doc.$id;
        await dbService.safePatchParticipant(doc.id || doc.$id, { lastReadAt: now });
      }

      // 2. Sync to Appwrite in background
      if (participantId && isAppwriteConfigured && APPWRITE_CONFIG.collections.participants) {
        if (!isValidId(participantId)) {
          console.warn('markConversationAsRead: Skipping remote update for invalid participant ID:', participantId);
          return;
        }

        databases.updateDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.participants,
          participantId,
          { lastReadAt: now }
        ).catch(err => {
           if (err.code === 404 || err.message?.includes('not found')) {
             console.log('markConversationAsRead: Participant not found on remote, likely local-seeded data. Skipping sync.');
           } else {
             if (err.message && err.message.toLowerCase().includes('fetch')) {
               console.warn('markConversationAsRead backend sync deferred (offline or network block).');
             } else {
               console.warn('Failed to sync lastReadAt:', err.message || err);
             }
           }
        });
      }
    } catch (err) {
      console.error('Error marking conversation as read:', err);
    }
  },

  /**
   * Mark a message as read
   */
  async markAsRead(messageId: string) {
    // 1. Optimistic local update
    await dbService.markMessageAsRead(messageId);

    // 2. Remote update
    if (isAppwriteConfigured && APPWRITE_CONFIG.collections.messages) {
      if (!isValidId(messageId)) {
        console.warn('markAsRead: Skipping remote update for invalid Appwrite ID:', messageId);
        return;
      }
      
      try {
        console.log('markAsRead: Updating Appwrite message status to read:', messageId);
        await databases.updateDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.messages,
          messageId,
          { status: 'read' }
        );
      } catch (err: any) {
        // Silently fail for 404s (e.g. local-only messages or deleted)
        if (err.code !== 404) {
          console.error('Failed to mark message as read on Appwrite:', err);
        }
      }
    }
  },

  /**
   * Delete an entire conversation (local and remote)
   */
  async deleteConversation(conversationId: string) {
    if (!conversationId) return;
    try {
      recentlyDeletedConvoIds.add(conversationId);
      markConversationDeleted(conversationId);
      
      const user = await authService.getCurrentUser();
      const now = new Date().toISOString();
      let participantId: string | undefined;

      // 1. Find participant ID and local message IDs before they are wiped locally
      let messageIds: string[] = [];
      if (user) {
        const db = await dbService.getRawDB();
        const pDoc = await db.participants.findOne({
          selector: { conversationId: conversationId, userId: user.$id }
        }).exec();
        if (pDoc) {
          participantId = pDoc.id || pDoc.$id;
        }

        const msgDocs = await db.messages.find({ selector: { conversationId: conversationId } }).exec();
        messageIds = msgDocs.map(doc => doc.id || doc.$id || (doc as any)._id).filter(id => !!id);
      }

      // 2. IMMEDIATELY and physically delete local conversation, participants, and messages from local RxDB
      try {
        await dbService.deleteConversation(conversationId);
      } catch (err) {
        console.warn('Failed to delete conversation locally in dbService:', err);
      }

      // 3. Mark participant as deleted on Appwrite in the background (non-blocking)
      if (participantId && isAppwriteConfigured && APPWRITE_CONFIG.collections.participants && isValidId(participantId)) {
        databases.updateDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.participants,
          participantId,
          {
             isDeleted: true,
             clearedAt: now
          }
        ).catch(err => {
          console.warn('deleteConversation: Failed to update participant remotely:', err);
        });
      }

      // 4. Actually delete the conversation contents (messages) remotely on Appwrite in the background (non-blocking)
      if (isAppwriteConfigured && APPWRITE_CONFIG.collections.messages && messageIds.length > 0) {
        messageIds.forEach(mid => {
          if (isValidId(mid)) {
            databases.deleteDocument(
               APPWRITE_CONFIG.databaseId, 
               APPWRITE_CONFIG.collections.messages, 
               mid
            ).catch(()=>{});
          }
        });
      }

      setTimeout(() => recentlyDeletedConvoIds.delete(conversationId), 30_000);
    } catch (err: any) {
      console.warn('Failed to delete conversation:', err.message || err);
    }
  },

  /**
   * Delete a message
   */
  async deleteMessage(messageId: string) {
    if (recentlyDeletedMessageIds.has(messageId)) return;
    recentlyDeletedMessageIds.add(messageId);
    try {
      await dbService.deleteMessage(messageId);
      setTimeout(() => recentlyDeletedMessageIds.delete(messageId), 30_000);

      if (isAppwriteConfigured && APPWRITE_CONFIG.collections.messages) {
        if (!isValidId(messageId)) return;
        try {
          await databases.deleteDocument(
            APPWRITE_CONFIG.databaseId, APPWRITE_CONFIG.collections.messages, messageId);
        } catch (err: any) {
          if (err.code !== 404) console.warn('Failed to delete message on Appwrite:', err.message || err);
        }
      }
    } catch (err: any) {
      console.warn('deleteMessage warning:', err.message || err);
    }
  },

  /**
   * Pin or unpin a message
   */
  async pinMessage(messageId: string) {
    if (processingPins.has(messageId)) return;
    processingPins.add(messageId);

    try {
      // 1. Local update
      await dbService.toggleMessagePin(messageId);

      // 2. Remote update if isPinned attribute exists
      if (isAppwriteConfigured && APPWRITE_CONFIG.collections.messages) {
         if (!isValidId(messageId)) return;
         try {
           await databases.updateDocument(
             APPWRITE_CONFIG.databaseId,
             APPWRITE_CONFIG.collections.messages,
             messageId,
             { isPinned: true }
           ).catch(() => {});
         } catch (err) {}
      }
    } finally {
      setTimeout(() => processingPins.delete(messageId), 2000);
    }
  },

  /**
   * Get or create a 1-on-1 conversation between two users
   */
  async getOrCreateConversation(otherUserId: string) {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const db = await dbService.getRawDB();
    const tempConvoId = `local_convo_${otherUserId}`;
    
    const migrateAndCleanTemp = async (convoIdToUse: string) => {
        try {
            const localMsgs = await db.messages.find({
                selector: { conversationId: tempConvoId }
            }).exec();
            if (localMsgs.length > 0) {
                console.log(`[Messaging] Migrating ${localMsgs.length} local messages from ${tempConvoId} to ${convoIdToUse}`);
                for (const mDoc of localMsgs) {
                    await mDoc.incrementalPatch({ conversationId: convoIdToUse });
                }
            }
            const tempConvo = await db.conversations.findOne(tempConvoId).exec();
            if (tempConvo) await tempConvo.remove();
            
            const tempParts = await db.participants.find({
                selector: { conversationId: tempConvoId }
            }).exec();
            for (const pDoc of tempParts) {
                await pDoc.remove();
            }
        } catch (migrateErr) {
            console.error('[Messaging] Error during local temp conversation migration:', migrateErr);
        }
    };

    try {
      // 1. Check if a 1-on-1 conversation already exists between these two users
      const myParticipations = await db.participants.find({
        selector: { userId: user.$id }
      }).exec();

      let matchingConvos: { p: any, convo: any }[] = [];

      for (const p of myParticipations) {
        const convoId = p.conversationId;
        // Check if this conversation is a 1-on-1
        const convo = await db.conversations.findOne(convoId).exec();
        const convoIsGroup = convo?.isGroup || false;
        if (convo && !convoIsGroup) {
          // Check if the other user is also a participant
          const otherPart = await db.participants.findOne({
            selector: { conversationId: convoId, userId: otherUserId }
          }).exec();
          if (otherPart) {
            matchingConvos.push({ p, convo });
          }
        }
      }

      if (matchingConvos.length > 0) {
        // Sort to get the most recently created or updated conversation, so we don't return an old duplicate
        matchingConvos.sort((a, b) => {
          const timeA = new Date(a.convo.createdAt || a.convo.created_at || '1970-01-01').getTime();
          const timeB = new Date(b.convo.createdAt || b.convo.created_at || '1970-01-01').getTime();
          return timeB - timeA;
        });

        const bestMatch = matchingConvos[0];
        const { p, convo } = bestMatch;
        const convoId = p.conversationId;

        // Found existing! If it was marked deleted, restore it!
        if (isConversationDeleted(convoId) || p.isDeleted) {
           restoreConversation(convoId);
           try {
              await dbService.safePatchParticipant(p.id || p.$id, { isDeleted: false });
              if (isAppwriteConfigured && APPWRITE_CONFIG.collections.participants) {
                 databases.updateDocument(
                    APPWRITE_CONFIG.databaseId,
                    APPWRITE_CONFIG.collections.participants,
                    p.id || p.$id,
                    { isDeleted: false, is_deleted: false }
                 ).catch(() => {});
              }
           } catch (err) {}
        }
        return convo.toJSON();
      }

      if (!isAppwriteConfigured) {
        throw new Error('Appwrite not configured');
      }

      // 2. If not in local DB, check Appwrite.
      // We look at candidate participants for both the current user and the other user.
      // This is crucial because if one of the users deleted the conversation, their participant record
      // may be marked deleted or even physically deleted from Appwrite. By querying both user's participations,
      // we guarantee we can find the old conversation document if it still exists on Appwrite.
      const [remoteMyParts, remoteOtherPartsList] = await Promise.all([
        safeListDocuments(
          APPWRITE_CONFIG.collections.participants,
          [Query.equal('userId', user.$id), Query.limit(100)]
        ).catch(() => ({ documents: [] })),
        safeListDocuments(
          APPWRITE_CONFIG.collections.participants,
          [Query.equal('userId', otherUserId), Query.limit(100)]
        ).catch(() => ({ documents: [] }))
      ]);

      const candidateConvoIds = new Set<string>();
      for (const p of remoteMyParts.documents) {
        const cid = (p as any).conversation_id || (p as any).conversationId;
        if (cid) candidateConvoIds.add(cid);
      }
      for (const p of remoteOtherPartsList.documents) {
        const cid = (p as any).conversation_id || (p as any).conversationId;
        if (cid) candidateConvoIds.add(cid);
      }

      let remoteMatchingConvos: any[] = [];
      
      for (const convoId of candidateConvoIds) {
        try {
          const convoDoc = await databases.getDocument(
            APPWRITE_CONFIG.databaseId,
            APPWRITE_CONFIG.collections.conversations,
            convoId
          );

          if (!(convoDoc as any).isGroup && !(convoDoc as any).Is_group && !(convoDoc as any).is_group) {
            // Fetch all participant docs on Appwrite for this conversation
            const allPartsResult = await safeListDocuments(
              APPWRITE_CONFIG.collections.participants,
              [Query.equal('conversationId', convoId)]
            );
            
            const allPartsDocs = [...allPartsResult.documents];
            const hasMe = allPartsDocs.some(pDoc => ((pDoc as any).userId === user.$id || (pDoc as any).user_id === user.$id));
            const hasOther = allPartsDocs.some(pDoc => ((pDoc as any).userId === otherUserId || (pDoc as any).user_id === otherUserId));

            const isMatch = (hasMe && hasOther) || (!hasMe && hasOther && allPartsDocs.length === 1);

            if (isMatch) {
               remoteMatchingConvos.push({
                   convoId,
                   convoDoc,
                   allPartsDocs,
                   hasMe
               });
            }
          }
        } catch (convoErr) {
          console.warn(`Could not fetch/verify candidate conversation ${convoId}:`, convoErr);
        }
      }

      if (remoteMatchingConvos.length > 0) {
         remoteMatchingConvos.sort((a, b) => {
            const timeA = new Date(a.convoDoc.$createdAt || '1970-01-01').getTime();
            const timeB = new Date(b.convoDoc.$createdAt || '1970-01-01').getTime();
            return timeB - timeA;
         });

         const bestRemoteMatch = remoteMatchingConvos[0];
         const { convoId, convoDoc, allPartsDocs } = bestRemoteMatch;

         const ip = await getUserIP();
         const permissions = [
            Permission.read(Role.any()), Permission.write(Role.any()),
            Permission.update(Role.any()), Permission.delete(Role.any()),
         ];

         let myPartDoc = allPartsDocs.find((pDoc: any) => (pDoc.userId === user.$id || pDoc.user_id === user.$id));

              if (!myPartDoc) {
                // Recreate missing participant record for current user on Appwrite
                console.log(`[Messaging] Recreating missing participant record for user ${user.$id} in conversation ${convoId}`);
                let pPayload: any = {
                  conversationId: convoId,
                  userId: user.$id,
                  ip,
                  lastReadAt: new Date().toISOString(),
                  isDeleted: false
                };
                
                while (true) {
                  try {
                    myPartDoc = await databases.createDocument(
                      APPWRITE_CONFIG.databaseId,
                      APPWRITE_CONFIG.collections.participants,
                      generateUUID(),
                      pPayload,
                      permissions
                    );
                    break;
                  } catch (pErr: any) {
                    if (pErr.message?.includes('Unknown attribute:')) {
                      const match = pErr.message.match(/"([^"]+)"/);
                      if (match && match[1]) {
                        delete pPayload[match[1]];
                        if (Object.keys(pPayload).length === 0) break;
                        continue;
                      }
                    }
                    throw pErr;
                  }
                }
                if (myPartDoc) allPartsDocs.push(myPartDoc);
              } else {
                // If the participant doc exists on Appwrite but is marked deleted, restore it!
                const isMeDeleted = (myPartDoc as any).is_deleted || (myPartDoc as any).isDeleted || false;
                if (isConversationDeleted(convoId) || isMeDeleted) {
                  restoreConversation(convoId);
                  try {
                    await databases.updateDocument(
                      APPWRITE_CONFIG.databaseId,
                      APPWRITE_CONFIG.collections.participants,
                      myPartDoc.$id,
                      { is_deleted: false, isDeleted: false }
                    );
                  } catch (ue) {}
                }
              }

              // Restore conservation from localStorage if still marked deleted locally
              restoreConversation(convoId);

              // Try to get a better name than the one stored in conversation doc if it's generic
              let nameValue = (convoDoc as any).name || (convoDoc as any).fullName || (convoDoc as any).Name;
              
              if (!nameValue || nameValue === 'Direct Chat') {
                try {
                  const otherProfileRes = await databases.listDocuments(
                    APPWRITE_CONFIG.databaseId,
                    APPWRITE_CONFIG.collections.profiles,
                    [Query.equal('userId', otherUserId), Query.limit(1)]
                  );
                  if (otherProfileRes.documents.length > 0) {
                     nameValue = otherProfileRes.documents[0].fullName;
                  }
                } catch (e) {}
              }
              
              if (!nameValue || nameValue === 'Direct Chat') nameValue = 'Learner';

              // Optimistically write conversation locally
              await dbService.upsertConversation({
                id: convoDoc.$id,
                name: nameValue,
                isGroup: false,
                createdAt: convoDoc.$createdAt,
                ip: (convoDoc as any).ip || '0.0.0.0'
              });

              // Save all participant docs locally
              for (const pDoc of allPartsDocs) {
                await dbService.upsertParticipant({
                  id: pDoc.$id,
                  conversationId: (pDoc as any).conversationId || (pDoc as any).conversation_id,
                  userId: (pDoc as any).userId || (pDoc as any).user_id,
                  lastReadAt: (pDoc as any).lastReadAt || (pDoc as any).last_read_at || new Date().toISOString(),
                  ip: (pDoc as any).ip || '0.0.0.0',
                  isDeleted: (pDoc.$id === myPartDoc?.$id) ? false : ((pDoc as any).isDeleted || (pDoc as any).is_deleted || false),
                  deletedAt: (pDoc as any).deletedAt || (pDoc as any).deleted_at || null
                });
              }

              await migrateAndCleanTemp(convoDoc.$id);
              await this.syncConversations();
              return {
                id: convoDoc.$id,
                name: nameValue,
                isGroup: false,
                createdAt: convoDoc.$createdAt
              };
      }

      // 3. Create new conversation if none found
      const convoId = generateUUID();
      const ip = await getUserIP();
      const permissions = [
        Permission.read(Role.any()), Permission.write(Role.any()),
        Permission.update(Role.any()), Permission.delete(Role.any()),
      ];

      // Fetch other user's profile to name the conversation
      const otherProfileRes = await databases.listDocuments(
        APPWRITE_CONFIG.databaseId,
        APPWRITE_CONFIG.collections.profiles,
        [Query.equal('userId', otherUserId)]
      );
      const otherName = otherProfileRes.documents[0]?.fullName || 'Learner';

      // Helper to repeatedly try creating document and stripping unknown attributes
      // as Appwrite throws "Unknown attribute: \"<name>\"" one by one.
      let currentPayload: any = { 
         name: otherName, 
         isGroup: false, 
         type: 'direct',
         ip 
      };

      while (true) {
         try {
            await databases.createDocument(
               APPWRITE_CONFIG.databaseId,
               APPWRITE_CONFIG.collections.conversations,
               convoId,
               currentPayload,
               permissions
            );
            break; // Success
         } catch (err: any) {
            if (err.message?.includes('Unknown attribute:')) {
               const match = err.message.match(/"([^"]+)"/);
               if (match && match[1]) {
                  delete currentPayload[match[1]];
                  if (Object.keys(currentPayload).length === 0) {
                     // We ran out of attributes to try
                     console.error("All attributes rejected by Appwrite schema for conversations.");
                     break;
                  }
                  continue; // Retry without the offending attribute
               }
            }
            throw err; // Re-throw if it wasn't an unknown attribute error
         }
      }

      // Create participants with robust attribute stripping
      async function createParticipantRobust(userId: string) {
         let pPayload: any = { 
             conversationId: convoId,
             userId: userId,
             ip, 
             lastReadAt: new Date().toISOString(),
             isDeleted: false
         };
         while (true) {
            try {
               const doc = await databases.createDocument(
                  APPWRITE_CONFIG.databaseId,
                  APPWRITE_CONFIG.collections.participants,
                  generateUUID(),
                  pPayload,
                  permissions
               );
               return doc;
            } catch (err: any) {
               if (err.message?.includes('Unknown attribute:')) {
                  const match = err.message.match(/"([^"]+)"/);
                  if (match && match[1]) {
                     delete pPayload[match[1]];
                     if (Object.keys(pPayload).length === 0) return null;
                     continue;
                  }
               }
               throw err;
            }
         }
      }

      const [pMe, pOther] = await Promise.all([
         createParticipantRobust(user.$id),
         createParticipantRobust(otherUserId)
      ]);

      // Write BOTH the conversation and participant records locally to RxDB IMMEDIATELY
      await dbService.upsertConversation({
         id: convoId,
         name: otherName,
         isGroup: false,
         createdAt: new Date().toISOString(),
         ip
      });

      if (pMe) {
         await dbService.upsertParticipant({
            id: pMe.$id,
            conversationId: convoId,
            userId: user.$id,
            lastReadAt: pMe.lastReadAt || pMe.last_read_at || new Date().toISOString(),
            ip: pMe.ip || ip
         });
      } else {
         await dbService.upsertParticipant({
            id: `part_${user.$id}_${convoId}`,
            conversationId: convoId,
            userId: user.$id,
            lastReadAt: new Date().toISOString(),
            ip
         });
      }

      if (pOther) {
         await dbService.upsertParticipant({
            id: pOther.$id,
            conversationId: convoId,
            userId: otherUserId,
            lastReadAt: pOther.lastReadAt || pOther.last_read_at || new Date().toISOString(),
            ip: pOther.ip || ip
         });
      } else {
         await dbService.upsertParticipant({
            id: `part_${otherUserId}_${convoId}`,
            conversationId: convoId,
            userId: otherUserId,
            lastReadAt: new Date().toISOString(),
            ip
         });
      }

      // Also query the other user's profile to save it locally
      if (otherProfileRes.documents[0]) {
         const rp = otherProfileRes.documents[0];
         await dbService.upsertProfile({
            userId: rp.userId || rp.user_id,
            fullName: rp.fullName,
            role: rp.role || 'Network Member',
            school: rp.school || '',
            bio: rp.bio || '',
            avatarUrl: rp.avatarUrl || '',
            points: rp.points || 0,
            isOnline: authService.computeIsOnline(rp),
            lastSeenAt: rp.lastSeenAt || null
         }).catch(() => {});
      }

      await migrateAndCleanTemp(convoId);
      await this.syncConversations();
      return { id: convoId, name: otherName, is_group: false, created_at: new Date().toISOString() };

    } catch (err) {
      console.warn('Failed to get or create conversation on Appwrite, falling back to local conversation creation:', err);
      // Fallback local conversation creation
      const convoId = `local_convo_${otherUserId}`;
      try {
         const otherProfile = await db.profiles.findOne(otherUserId).exec();
         const otherName = otherProfile?.fullName || otherProfile?.name || 'Local Student';

         await dbService.upsertConversation({
            id: convoId,
            name: otherName,
            is_group: false,
            created_at: new Date().toISOString(),
            ip: '127.0.0.1'
         });

         await dbService.upsertParticipant({
            id: `part_${user.$id}_${convoId}`,
            conversationId: convoId,
            userId: user.$id,
            lastReadAt: new Date().toISOString(),
            ip: '127.0.0.1'
         });

         await dbService.upsertParticipant({
            id: `part_${otherUserId}_${convoId}`,
            conversationId: convoId,
            userId: otherUserId,
            lastReadAt: new Date().toISOString(),
            ip: '127.0.0.1'
         });

         return {
            id: convoId,
            name: otherName,
            is_group: false,
            created_at: new Date().toISOString()
         };
      } catch (localErr) {
         console.error('Failed fallback local conversation creation as well:', localErr);
         return null;
      }
    }
  },

  /**
   * Restore a deleted message (Undo)
   */
  async restoreMessage(message: any) {
    // 1. Restore locally
    await dbService.upsertMessage(message);

    // 2. Restore remotely
    if (isAppwriteConfigured && APPWRITE_CONFIG.collections.messages) {
      if (!isValidId(message.id)) {
        console.warn('restoreMessage: Cannot restore remotely, invalid Appwrite ID:', message.id);
        return;
      }
      
      try {
        const permissions = [
          Permission.read(Role.any()),
          Permission.write(Role.any()),
          Permission.update(Role.any()),
          Permission.delete(Role.any()),
        ];
        
        await databases.createDocument(
          APPWRITE_CONFIG.databaseId,
          APPWRITE_CONFIG.collections.messages,
          message.id,
          {
            id: message.id,
            conversation_id: message.conversation_id,
            sender_id: message.sender_id,
            content: message.content,
            type: message.type,
            ip: message.ip,
            status: message.status,
            attachments: (message.attachments || []).map((a: any) => JSON.stringify(a))
          },
          permissions
        );
      } catch (err: any) {
        if (err.code !== 409) {
          console.error('Failed to restore message on Appwrite:', err);
        }
      }
    }
  },

  /**
   * Ensure a conversation and its participants exist on Appwrite.  /**
   * Ensure conversation and participants exist (delegates to Supabase)
   */
  async ensureConversationOnAppwrite(conversationId: string) {
    return this.ensureConversationOnSupabase(conversationId);
  },

  async updateMathMessage(messageId: string, mathMeta: any) {
    try {
      const db = await dbService.getRawDB();
      const doc = await db.messages.findOne(messageId).exec() || await db.messages.findOne({ selector: { id: messageId } }).exec();
      if (doc) {
        await doc.incrementalPatch({
          mathMeta
        });
      }
      if (isValidId(messageId)) {
        const { supabaseAdmin } = await import('./supabaseService');
        await supabaseAdmin
          .from('messages')
          .update({
            math_meta: mathMeta
          })
          .eq('id', messageId);
      }
    } catch (err: any) {
      console.warn('[MessagingService] Failed to update math message:', err?.message || err);
    }
  },

  /**
   * Ensure a conversation and its participants exist on Supabase.
   * This is the Supabase-native version, replacing the Appwrite fallback.
   */
  async ensureConversationOnSupabase(conversationId: string) {
    if (conversationId.startsWith('local_convo_') || conversationId.startsWith('mock_')) return;

    try {
      const { supabase, supabaseAdmin } = await import('./supabaseService');
      const db = await dbService.getRawDB();
      const user = await authService.getCurrentUser();
      if (!user) return;

      // 1. Check if conversation exists on Supabase
      const { data: existingConvo, error: fetchError } = await supabaseAdmin
        .from('conversations')
        .select('id')
        .eq('id', conversationId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // Not a "not found" error, log and continue
        console.warn(`[MessagingService] Error checking conversation ${conversationId} on Supabase:`, fetchError.message);
      }

      if (existingConvo) {
        // Conversation exists, no action needed
        return;
      }

      console.log(`[MessagingService] Conversation ${conversationId} missing on Supabase. Creating...`);

      // 2. Get local conversation data to restore
      const localConvo = await db.conversations.findOne(conversationId).exec();
      if (!localConvo) {
        console.log(`[MessagingService] Local conversation ${conversationId} not found, unable to restore.`);
        return;
      }

      const localConvoData = localConvo.toJSON();
      const localParts = await db.participants.find({
        selector: { conversationId: conversationId }
      }).exec();

      const ip = '0.0.0.0';

      // 3. Create conversation on Supabase
      const { error: convoError } = await supabaseAdmin
        .from('conversations')
        .insert({
          id: conversationId,
          name: localConvoData.name || 'Direct Chat',
          is_group: localConvoData.isGroup || false,
          created_at: localConvoData.createdAt || new Date().toISOString(),
          ip: localConvoData.ip || ip
        });

      if (convoError) {
        if (convoError.code === '23505') {
          // Already exists (race condition)
          console.log(`[MessagingService] Conversation ${conversationId} already exists on Supabase (race condition).`);
          return;
        }
        console.error(`[MessagingService] Failed to create conversation ${conversationId} on Supabase:`, convoError.message);
        return;
      }

      // 4. Create participant records on Supabase
      for (const p of localParts) {
        const lp = p.toJSON();
        const { error: partError } = await supabaseAdmin
          .from('participants')
          .insert({
            id: lp.id || `part_${lp.userId}_${conversationId}`,
            conversation_id: conversationId,
            user_id: lp.userId,
            last_read_at: lp.lastReadAt || new Date().toISOString(),
            ip: lp.ip || ip,
            is_deleted: lp.isDeleted || false,
            last_message_at: lp.lastMessageAt || null,
            cleared_at: lp.clearedAt || null
          });

        if (partError) {
          if (partError.code !== '23505') {
            console.error(`[MessagingService] Failed to create participant for ${conversationId} on Supabase:`, partError.message);
          }
        }
      }

      console.log(`[MessagingService] Successfully restored conversation ${conversationId} and participants on Supabase.`);
    } catch (err: any) {
      console.error('[MessagingService] ensureConversationOnSupabase failed:', err.message || err);
    }
  }
};
