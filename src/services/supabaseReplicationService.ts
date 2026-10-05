/**
 * Supabase-native replication service for RxDB
 * Replaces Appwrite-specific replication with direct Supabase integration
 */

import { replicateRxCollection } from 'rxdb/plugins/replication';
import { Subject } from 'rxjs';
import { supabase, supabaseAdmin } from './supabaseService';

/**
 * Utility helper to identify transient network transport errors, offline state,
 * or rate limit/unreachable server issues.
 */
function isNetworkError(err: any): boolean {
    if (typeof window !== 'undefined' && window.navigator && !window.navigator.onLine) {
        return true;
    }
    const msg = (err?.message || String(err)).toLowerCase();
    const isFetch = msg.includes('fetch') || 
                    msg.includes('network') || 
                    msg.includes('dns') || 
                    msg.includes('cors') || 
                    msg.includes('unreachable') || 
                    msg.includes('aborted') || 
                    msg.includes('load failed') || 
                    msg.includes('timeout') ||
                    msg.includes('websocket') || 
                    msg.includes('connection');
    const status = err?.status || err?.code;
    const isTransientStatus = status === 429 || status === 502 || status === 503 || status === 504 || status === 0;
    return isFetch || isTransientStatus;
}

/**
 * Field mapping: convert Supabase snake_case to our camelCase
 */
function toCamelCase(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
        return obj.map(toCamelCase);
    }
    
    const result: any = {};
    for (const key in obj) {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        result[camelKey] = toCamelCase(obj[key]);
    }
    return result;
}

/**
 * Field mapping: convert our camelCase to Supabase snake_case
 */
function toSnakeCase(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
        return obj.map(toSnakeCase);
    }
    
    const result: any = {};
    for (const key in obj) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        result[snakeKey] = toSnakeCase(obj[key]);
    }
    return result;
}

/**
 * Robustly fetch from Supabase with retry logic
 */
async function withRetrySupabase<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    let lastError: any;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (e: any) {
            lastError = e;
            if (isNetworkError(e)) {
                // For network errors, retry
                if (attempt < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                    continue;
                }
            }
            // For non-retryable errors, throw immediately
            throw e;
        }
    }
    throw lastError;
}

/**
 * Start replication for messages table with Supabase
 */
export function startMessagesReplication(collection: any, userId: string) {
    if (!userId) return null;

    return replicateRxCollection({
        collection,
        replicationIdentifier: `msg-rep-${userId}`,
        live: true,
        retryTime: 5000,
        pull: {
            batchSize: 50,
            async handler(lastCheckpoint: any, batchSize) {
                const updatedAfter = lastCheckpoint?.updatedAt ?? 0;
                
                try {
                    // Fetch messages updated after checkpoint from Supabase
                    const { data, error } = await withRetrySupabase(() => 
                        supabaseAdmin
                            .from('messages')
                            .select('*')
                            .or(`created_at.gt.${new Date(updatedAfter).toISOString()},updated_at.gt.${new Date(updatedAfter).toISOString()}`)
                            .order('created_at', { ascending: true })
                            .limit(batchSize)
                    );
                    
                    if (error) {
                        throw error;
                    }

                    // Convert snake_case to camelCase
                    const docs = (data || []).map((doc: any) => {
                        const camelDoc = toCamelCase(doc);
                        
                        // Parse JSON fields
                        let attachments = camelDoc.attachments || [];
                        if (typeof attachments === 'string') {
                            try { attachments = JSON.parse(attachments); } catch { attachments = []; }
                        }
                        
                        let mathMeta = camelDoc.mathMeta;
                        if (typeof mathMeta === 'string') {
                            try { mathMeta = JSON.parse(mathMeta); } catch { mathMeta = null; }
                        } else if (camelDoc.math_meta && typeof camelDoc.math_meta === 'string') {
                            try { mathMeta = JSON.parse(camelDoc.math_meta); } catch { mathMeta = null; }
                        } else if (camelDoc.math_meta && typeof camelDoc.math_meta === 'object') {
                            mathMeta = camelDoc.math_meta;
                        }
                        
                        let strokes = camelDoc.strokes || [];
                        if (typeof strokes === 'string') {
                            try { strokes = JSON.parse(strokes); } catch { strokes = []; }
                        } else if (camelDoc.stroke && typeof camelDoc.stroke === 'string') {
                            try { strokes = JSON.parse(camelDoc.stroke); } catch { strokes = []; }
                        } else if (Array.isArray(camelDoc.stroke)) {
                            strokes = camelDoc.stroke;
                        }
                        
                        // Also check mathMeta for strokes
                        if ((!strokes || strokes.length === 0) && mathMeta) {
                            if (mathMeta && typeof mathMeta === 'object') {
                                if (Array.isArray(mathMeta.strokes) && mathMeta.strokes.length > 0) {
                                    strokes = mathMeta.strokes;
                                } else if (Array.isArray(mathMeta.annotation_strokes) && mathMeta.annotation_strokes.length > 0) {
                                    strokes = mathMeta.annotation_strokes;
                                } else if (Array.isArray(mathMeta.annotationStrokes) && mathMeta.annotationStrokes.length > 0) {
                                    strokes = mathMeta.annotationStrokes;
                                }
                            }
                        }

                        return {
                            id: camelDoc.id,
                            conversationId: camelDoc.conversationId,
                            senderId: camelDoc.senderId,
                            content: camelDoc.content,
                            type: camelDoc.type || 'text',
                            createdAt: camelDoc.createdAt,
                            updatedAt: camelDoc.updatedAt,
                            status: camelDoc.status || 'sent',
                            ip: camelDoc.ip || '',
                            isPinned: camelDoc.isPinned || false,
                            attachments,
                            strokes,
                            mathMeta,
                            _deleted: false,
                            updatedAtTime: new Date(camelDoc.updatedAt || camelDoc.createdAt).getTime()
                        };
                    });

                    const checkpoint = docs.length
                        ? { updatedAt: docs[docs.length - 1].updatedAtTime }
                        : lastCheckpoint;
                        
                    return { documents: docs, checkpoint };
                } catch (e: any) {
                    if (isNetworkError(e)) {
                        console.warn('[Replication] Pull replication deferred (offline or server unreachable). Offline-ready data in local RxDB will be fully interactive. Status:', e.message || e);
                    } else {
                        console.warn('[Replication] Pull replication deferred due to error:', e.message || e);
                    }
                    throw e;
                }
            }
        },
        push: {
            batchSize: 25,
            async handler(docs) {
                for (const { newDocumentState } of docs) {
                    // 1. Only push messages sent by the local user - never re-push received messages!
                    if (newDocumentState.senderId && newDocumentState.senderId !== userId) {
                        continue;
                    }

                    // 2. If message has pending media uploads (blob: URLs), don't push until media is uploaded
                    const hasPendingUpload = newDocumentState.attachments?.some((a: any) =>
                        a && (a.url?.startsWith('blob:') || a.fileId?.startsWith('pending_'))
                    );
                    if (hasPendingUpload && newDocumentState.status === 'pending') {
                        continue; // Wait until upload finishes and updates the message with real URL
                    }

                    if (newDocumentState._deleted) {
                        // Handle deletion
                        try {
                            const { error } = await supabaseAdmin
                                .from('messages')
                                .delete()
                                .eq('id', newDocumentState.id);
                            
                            if (error) {
                                if (error.code === 'PGRST116') {
                                    // Not found - already deleted
                                    console.info(`[Replication] Document ${newDocumentState.id} was already deleted from remote.`);
                                } else if (isNetworkError(error)) {
                                    console.warn(`[Replication] Deleting document ${newDocumentState.id} deferred (offline or server unreachable):`, error.message || error);
                                } else {
                                    console.warn(`[Replication] Failed to delete document ${newDocumentState.id}:`, error.message || error);
                                }
                                throw error;
                            }
                            console.info(`[Replication] Successfully deleted document ${newDocumentState.id} from remote.`);
                        } catch (e: any) {
                            if (isNetworkError(e)) {
                                console.warn(`[Replication] Deleting document ${newDocumentState.id} deferred (offline or server unreachable):`, e.message || e);
                            } else {
                                console.warn(`[Replication] Failed to delete document ${newDocumentState.id}:`, e.message || e);
                            }
                            throw e;
                        }
                        continue;
                    }
                    
                    try {
                        // Convert to snake_case for Supabase
                        const snakeDoc = toSnakeCase({
                            id: newDocumentState.id,
                            conversationId: newDocumentState.conversationId,
                            senderId: newDocumentState.senderId,
                            content: newDocumentState.content,
                            type: newDocumentState.type,
                            createdAt: newDocumentState.createdAt,
                            updatedAt: newDocumentState.updatedAt,
                            status: newDocumentState.status,
                            ip: newDocumentState.ip,
                            isPinned: newDocumentState.isPinned,
                            attachments: newDocumentState.attachments,
                            strokes: newDocumentState.strokes,
                            mathMeta: newDocumentState.mathMeta
                        });

                        let pushStatus = newDocumentState.status;
                        if (pushStatus === 'pending') pushStatus = 'sent';

                        // Handle mathMeta - Supabase expects JSON string or object
                        let mathMetaToPush = snakeDoc.math_meta;
                        if (!mathMetaToPush && snakeDoc.strokes && snakeDoc.strokes.length > 0) {
                            mathMetaToPush = {
                                annotation_strokes: snakeDoc.strokes,
                                strokes: snakeDoc.strokes
                            };
                        } else if (mathMetaToPush && snakeDoc.strokes && snakeDoc.strokes.length > 0) {
                            if (typeof mathMetaToPush === 'object') {
                                mathMetaToPush = {
                                    ...mathMetaToPush,
                                    annotation_strokes: snakeDoc.strokes,
                                    strokes: snakeDoc.strokes
                                };
                            }
                        }

                        const appwriteDoc = {
                            ...snakeDoc,
                            status: pushStatus,
                            math_meta: mathMetaToPush
                        };

                        // Atomic upsert to Supabase in a single network round-trip
                        const { error: upsertError } = await supabaseAdmin
                            .from('messages')
                            .upsert(appwriteDoc, { onConflict: 'id' });

                        if (upsertError) throw upsertError;

                        // Update local RxDB status if it changed from pending
                        if (pushStatus === 'sent' && newDocumentState.status !== 'sent') {
                            const db = await (await import('./dbService')).getDB();
                            await db.messages.incrementalUpsert({
                                ...newDocumentState,
                                status: 'sent'
                            });
                        }
                    } catch (e: any) {
                        const errStatus = e.code || e.status;
                        if (errStatus != 429 && errStatus != 'PGRST116') {
                            if (isNetworkError(e)) {
                                console.warn(`[Replication] Push processing deferred for document ${newDocumentState.id} (offline or server unreachable):`, e.message || e);
                            } else {
                                console.warn(`[Replication] Push processing failed for document ${newDocumentState.id}:`, e.message || e);
                            }
                        }
                        throw e;
                    }
                }
                return [];
            }
        }
    });
}

/**
 * Start replication for conversations table with Supabase
 */
export function startConversationsReplication(collection: any, userId: string) {
    if (!userId) return null;

    return replicateRxCollection({
        collection,
        replicationIdentifier: `conv-rep-${userId}`,
        live: true,
        retryTime: 5000,
        pull: {
            batchSize: 50,
            async handler(lastCheckpoint: any, batchSize) {
                const updatedAfter = lastCheckpoint?.updatedAt ?? 0;
                
                try {
                    const { data, error } = await withRetrySupabase(() =>
                        supabaseAdmin
                            .from('conversations')
                            .select('*')
                            .or(`created_at.gt.${new Date(updatedAfter).toISOString()},updated_at.gt.${new Date(updatedAfter).toISOString()}`)
                            .order('created_at', { ascending: true })
                            .limit(batchSize)
                    );
                    
                    if (error) throw error;

                    const docs = (data || []).map((doc: any) => {
                        const camelDoc = toCamelCase(doc);
                        return {
                            id: camelDoc.id,
                            name: camelDoc.name,
                            isGroup: camelDoc.isGroup || false,
                            createdAt: camelDoc.createdAt,
                            ip: camelDoc.ip || '',
                            _deleted: false,
                            updatedAtTime: new Date(camelDoc.updatedAt || camelDoc.createdAt).getTime()
                        };
                    });

                    const checkpoint = docs.length
                        ? { updatedAt: docs[docs.length - 1].updatedAtTime }
                        : lastCheckpoint;
                        
                    return { documents: docs, checkpoint };
                } catch (e: any) {
                    if (isNetworkError(e)) {
                        console.warn('[Replication] Pull replication deferred (offline or server unreachable):', e.message || e);
                    } else {
                        console.warn('[Replication] Pull replication failed:', e.message || e);
                    }
                    throw e;
                }
            }
        },
        push: {
            batchSize: 25,
            async handler(docs) {
                for (const { newDocumentState } of docs) {
                    if (newDocumentState._deleted) {
                        try {
                            const { error } = await supabaseAdmin
                                .from('conversations')
                                .delete()
                                .eq('id', newDocumentState.id);
                            if (error && error.code !== 'PGRST116') throw error;
                        } catch (e: any) {
                            if (!isNetworkError(e)) throw e;
                        }
                        continue;
                    }

                    try {
                        const snakeDoc = toSnakeCase({
                            id: newDocumentState.id,
                            name: newDocumentState.name,
                            isGroup: newDocumentState.isGroup,
                            createdAt: newDocumentState.createdAt,
                            ip: newDocumentState.ip
                        });

                        const { error } = await supabaseAdmin
                            .from('conversations')
                            .upsert(snakeDoc, { onConflict: 'id' });
                        
                        if (error) throw error;
                    } catch (e: any) {
                        if (isNetworkError(e)) {
                            console.warn(`[Replication] Push deferred for conversation ${newDocumentState.id}:`, e.message || e);
                        } else {
                            console.warn(`[Replication] Push failed for conversation ${newDocumentState.id}:`, e.message || e);
                        }
                        throw e;
                    }
                }
                return [];
            }
        }
    });
}

/**
 * Start replication for participants table with Supabase
 */
export function startParticipantsReplication(collection: any, userId: string) {
    if (!userId) return null;

    return replicateRxCollection({
        collection,
        replicationIdentifier: `part-rep-${userId}`,
        live: true,
        retryTime: 5000,
        pull: {
            batchSize: 50,
            async handler(lastCheckpoint: any, batchSize) {
                const updatedAfter = lastCheckpoint?.updatedAt ?? 0;
                
                try {
                    const { data, error } = await withRetrySupabase(() =>
                        supabaseAdmin
                            .from('participants')
                            .select('*')
                            .or(`created_at.gt.${new Date(updatedAfter).toISOString()},updated_at.gt.${new Date(updatedAfter).toISOString()}`)
                            .order('created_at', { ascending: true })
                            .limit(batchSize)
                    );
                    
                    if (error) throw error;

                    const docs = (data || []).map((doc: any) => {
                        const camelDoc = toCamelCase(doc);
                        return {
                            id: camelDoc.id,
                            conversationId: camelDoc.conversationId,
                            userId: camelDoc.userId,
                            lastReadAt: camelDoc.lastReadAt,
                            lastMessageAt: camelDoc.lastMessageAt,
                            clearedAt: camelDoc.clearedAt,
                            isDeleted: camelDoc.isDeleted || false,
                            createdAt: camelDoc.createdAt,
                            _deleted: false,
                            updatedAtTime: new Date(camelDoc.updatedAt || camelDoc.createdAt).getTime()
                        };
                    });

                    const checkpoint = docs.length
                        ? { updatedAt: docs[docs.length - 1].updatedAtTime }
                        : lastCheckpoint;
                        
                    return { documents: docs, checkpoint };
                } catch (e: any) {
                    if (isNetworkError(e)) {
                        console.warn('[Replication] Pull replication deferred:', e.message || e);
                    } else {
                        console.warn('[Replication] Pull replication failed:', e.message || e);
                    }
                    throw e;
                }
            }
        },
        push: {
            batchSize: 25,
            async handler(docs) {
                for (const { newDocumentState } of docs) {
                    if (newDocumentState.userId && newDocumentState.userId !== userId) {
                        continue;
                    }

                    if (newDocumentState._deleted) {
                        try {
                            const { error } = await supabaseAdmin
                                .from('participants')
                                .delete()
                                .eq('id', newDocumentState.id);
                            if (error && error.code !== 'PGRST116') throw error;
                        } catch (e: any) {
                            if (!isNetworkError(e)) throw e;
                        }
                        continue;
                    }

                    try {
                        const snakeDoc = toSnakeCase({
                            id: newDocumentState.id,
                            conversationId: newDocumentState.conversationId,
                            userId: newDocumentState.userId,
                            lastReadAt: newDocumentState.lastReadAt,
                            lastMessageAt: newDocumentState.lastMessageAt,
                            clearedAt: newDocumentState.clearedAt,
                            isDeleted: newDocumentState.isDeleted
                        });

                        const { error } = await supabaseAdmin
                            .from('participants')
                            .upsert(snakeDoc, { onConflict: 'id' });
                        
                        if (error) throw error;
                    } catch (e: any) {
                        if (isNetworkError(e)) {
                            console.warn(`[Replication] Push deferred for participant ${newDocumentState.id}:`, e.message || e);
                        } else {
                            console.warn(`[Replication] Push failed for participant ${newDocumentState.id}:`, e.message || e);
                        }
                        throw e;
                    }
                }
                return [];
            }
        }
    });
}

/**
 * Start replication for profiles table with Supabase
 */
export function startProfilesReplication(collection: any, userId: string) {
    if (!userId) return null;

    return replicateRxCollection({
        collection,
        replicationIdentifier: `prof-rep-${userId}`,
        live: true,
        retryTime: 5000,
        pull: {
            batchSize: 50,
            async handler(lastCheckpoint: any, batchSize) {
                const updatedAfter = lastCheckpoint?.updatedAt ?? 0;
                
                try {
                    const { data, error } = await withRetrySupabase(() =>
                        supabaseAdmin
                            .from('profiles')
                            .select('*')
                            .or(`created_at.gt.${new Date(updatedAfter).toISOString()},updated_at.gt.${new Date(updatedAfter).toISOString()}`)
                            .order('created_at', { ascending: true })
                            .limit(batchSize)
                    );
                    
                    if (error) throw error;

                    const docs = (data || []).map((doc: any) => {
                        const camelDoc = toCamelCase(doc);
                        return {
                            ...camelDoc,
                            userId: camelDoc.userId || camelDoc.user_id,
                            _deleted: false,
                            updatedAtTime: new Date(camelDoc.updatedAt || camelDoc.createdAt).getTime()
                        };
                    });

                    const checkpoint = docs.length
                        ? { updatedAt: docs[docs.length - 1].updatedAtTime }
                        : lastCheckpoint;
                        
                    return { documents: docs, checkpoint };
                } catch (e: any) {
                    if (isNetworkError(e)) {
                        console.warn('[Replication] Pull replication deferred:', e.message || e);
                    } else {
                        console.warn('[Replication] Pull replication failed:', e.message || e);
                    }
                    throw e;
                }
            }
        },
        push: {
            batchSize: 25,
            async handler(docs) {
                for (const { newDocumentState } of docs) {
                    if (newDocumentState.userId && newDocumentState.userId !== userId) {
                        continue;
                    }

                    if (newDocumentState._deleted) {
                        try {
                            const { error } = await supabaseAdmin
                                .from('profiles')
                                .delete()
                                .eq('user_id', newDocumentState.userId);
                            if (error && error.code !== 'PGRST116') throw error;
                        } catch (e: any) {
                            if (!isNetworkError(e)) throw e;
                        }
                        continue;
                    }

                    try {
                        const snakeDoc = toSnakeCase({
                            ...newDocumentState,
                            userId: newDocumentState.userId
                        });

                        const { error } = await supabaseAdmin
                            .from('profiles')
                            .upsert(snakeDoc, { onConflict: 'user_id' });
                        
                        if (error) throw error;
                    } catch (e: any) {
                        if (isNetworkError(e)) {
                            console.warn(`[Replication] Push deferred for profile ${newDocumentState.userId}:`, e.message || e);
                        } else {
                            console.warn(`[Replication] Push failed for profile ${newDocumentState.userId}:`, e.message || e);
                        }
                        throw e;
                    }
                }
                return [];
            }
        }
    });
}

export function startPresenceReplication(collection: any, userId: string) {
    if (!userId) return null;

    return replicateRxCollection({
        collection,
        replicationIdentifier: `presence-rep-${userId}`,
        live: true,
        retryTime: 5000,
        pull: {
            batchSize: 50,
            async handler(lastCheckpoint: any, batchSize) {
                const updatedAfter = lastCheckpoint?.updatedAt ?? 0;
                
                try {
                    const { data, error } = await withRetrySupabase(() =>
                        supabaseAdmin
                            .from('presence')
                            .select('*')
                            .gte('updated_at', new Date(updatedAfter).toISOString())
                            .order('updated_at', { ascending: true })
                            .limit(batchSize)
                    );
                    
                    if (error) throw error;

                    const docs = (data || []).map((doc: any) => {
                        const camelDoc = toCamelCase(doc);
                        return {
                            id: camelDoc.id || camelDoc.sessionId,
                            sessionId: camelDoc.sessionId,
                            userId: camelDoc.userId,
                            displayName: camelDoc.displayName,
                            avatarColor: camelDoc.avatarColor,
                            x: camelDoc.x,
                            y: camelDoc.y,
                            tool: camelDoc.tool,
                            isChalkHolder: camelDoc.isChalkHolder ?? false,
                            updatedAt: camelDoc.updatedAt,
                            _deleted: false,
                            updatedAtTime: new Date(camelDoc.updatedAt).getTime()
                        };
                    });

                    const checkpoint = docs.length
                        ? { updatedAt: docs[docs.length - 1].updatedAtTime }
                        : lastCheckpoint;
                        
                    return { documents: docs, checkpoint };
                } catch (e: any) {
                    if (!isNetworkError(e)) {
                        console.warn('[Replication presence] Pull deferred error:', e.message || e);
                    }
                    throw e;
                }
            }
        },
        push: {
            batchSize: 25,
            async handler(docs) {
                for (const { newDocumentState } of docs) {
                    if (newDocumentState.userId && newDocumentState.userId !== userId) {
                        continue;
                    }

                    if (newDocumentState._deleted) {
                        try {
                            const { error } = await supabaseAdmin
                                .from('presence')
                                .delete()
                                .eq('session_id', newDocumentState.sessionId);
                            if (error && error.code !== 'PGRST116') throw error;
                        } catch (e: any) {
                            if (!isNetworkError(e)) throw e;
                        }
                        continue;
                    }

                    try {
                        const snakeDoc = toSnakeCase({
                            sessionId: newDocumentState.sessionId,
                            userId: newDocumentState.userId,
                            displayName: newDocumentState.displayName,
                            avatarColor: newDocumentState.avatarColor,
                            x: newDocumentState.x,
                            y: newDocumentState.y,
                            tool: newDocumentState.tool,
                            isChalkHolder: newDocumentState.isChalkHolder
                        });

                        const { error } = await supabaseAdmin
                            .from('presence')
                            .upsert(snakeDoc, { onConflict: 'session_id' });
                        
                        if (error) throw error;
                    } catch (e: any) {
                        if (isNetworkError(e)) {
                            console.warn(`[Replication] Push deferred for presence ${newDocumentState.sessionId}:`, e.message || e);
                        } else {
                            console.warn(`[Replication] Push failed for presence ${newDocumentState.sessionId}:`, e.message || e);
                        }
                        throw e;
                    }
                }
                return [];
            }
        }
    });
}

// Track started replication to avoid duplicates
const activeReplications: Set<string> = new Set();

// Export all replication starters
export const supabaseReplicationService = {
    startMessagesReplication,
    startConversationsReplication,
    startParticipantsReplication,
    startProfilesReplication,
    startPresenceReplication,
    toCamelCase,
    toSnakeCase,
    /**
     * Start all necessary replication for a user
     * Prevents duplicate replication instances
     */
    startAllReplication(db: any, userId: string) {
        if (!userId) return [];
        
        const replicationKeys = [
            `msg-rep-${userId}`,
            `conv-rep-${userId}`,
            `part-rep-${userId}`,
            `prof-rep-${userId}`,
            `presence-rep-${userId}`
        ];
        
        const reps: any[] = [];
        
        for (const key of replicationKeys) {
            if (activeReplications.has(key)) {
                console.log(`[Replication] Already started: ${key}`);
                continue;
            }
            
            activeReplications.add(key);
            let rep: any = null;
            
            switch (key) {
                case `msg-rep-${userId}`:
                    rep = startMessagesReplication(db.messages, userId);
                    break;
                case `conv-rep-${userId}`:
                    rep = startConversationsReplication(db.conversations, userId);
                    break;
                case `part-rep-${userId}`:
                    rep = startParticipantsReplication(db.participants, userId);
                    break;
                case `prof-rep-${userId}`:
                    rep = startProfilesReplication(db.profiles, userId);
                    break;
                case `presence-rep-${userId}`:
                    rep = startPresenceReplication(db.presence, userId);
                    break;
            }
            
            if (rep) {
                reps.push(rep);
                if (rep.error$) {
                    rep.error$.subscribe((err: any) => {
                        console.warn(`[Replication] Error in ${key}:`, err?.message || err);
                    });
                }
            }
        }
        
        return reps;
    },
    /**
     * Stop replication for a user
     */
    stopReplication(userId: string) {
        const keysToRemove = [
            `msg-rep-${userId}`,
            `conv-rep-${userId}`,
            `part-rep-${userId}`,
            `prof-rep-${userId}`,
            `presence-rep-${userId}`
        ];
        for (const key of keysToRemove) {
            activeReplications.delete(key);
        }
    }
};
