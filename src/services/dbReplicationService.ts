import { replicateRxCollection } from 'rxdb/plugins/replication';
import { databases, APPWRITE_CONFIG } from './appwriteService';
import { Query, Permission, Role } from './appwriteService';
import { convertStrokesToAnnotationStrokes } from '../math/inkMath';

/**
 * Validates if an ID is a valid ID for Appwrite Document IDs.
 */
function isValidAppwriteId(id: string): boolean {
    if (!id || typeof id !== 'string') return false;
    if (id.length > 36) return false;
    // Appwrite IDs must start with an alphanumeric character
    // and can only contain alphanumeric characters, underscores, hyphens, and periods.
    return /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(id);
}

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
 * Robustly create a document in Appwrite, dynamically pruning attributes that are not defined in the backend collection schema.
 */
async function createDocumentRobust(DB_ID: string, COL_ID: string, docId: string, initialPayload: any, permissions?: string[]) {
    if (!isValidAppwriteId(docId)) {
        console.warn(`[Replication] Skipping document with invalid Appwrite ID: "${docId}". Appwrite IDs must be <= 36 chars and start with alphanumeric.`);
        return null; // Return null to indicate skipped
    }
    const payload = { ...initialPayload };
    for (let attempt = 0; attempt < 10; attempt++) {
        try {
            return await databases.createDocument(DB_ID, COL_ID, docId, payload, permissions);
        } catch (e: any) {
            const errMsg = e.message || '';
            if (e.code === 429 || errMsg.toLowerCase().includes('rate limit') || errMsg.toLowerCase().includes('rate_limit')) {
                throw e; // Abort immediately on rate limit to let the replication layer retry later
            }
            if (errMsg.includes('Unknown attribute') || errMsg.includes('Invalid document structure')) {
                const match = errMsg.match(/attribute:?\s*"?([a-zA-Z0-9_-]+)"?/i);
                if (match && match[1]) {
                    const attributeName = match[1];
                    console.warn(`[Replication] Pruned unknown attribute from create: ${attributeName}`);
                    delete payload[attributeName];
                    continue;
                }
                
                let prunedSome = false;
                for (const key of Object.keys(payload)) {
                    if (errMsg.includes(key)) {
                        console.warn(`[Replication] Fallback pruned attribute from create: ${key}`);
                        delete payload[key];
                        prunedSome = true;
                        break;
                    }
                }
                if (prunedSome) continue;
            }
            throw e;
        }
    }
    throw new Error('Robust creation failed: exceeded max retry attempts due to unknown attributes');
}

/**
 * Robustly update a document in Appwrite, dynamically pruning attributes that are not defined in the backend collection schema.
 */
async function updateDocumentRobust(DB_ID: string, COL_ID: string, docId: string, initialPayload: any) {
    if (!isValidAppwriteId(docId)) {
        console.warn(`[Replication] Skipping update for document with invalid Appwrite ID: "${docId}"`);
        return null;
    }
    const payload = { ...initialPayload };
    for (let attempt = 0; attempt < 10; attempt++) {
        try {
            return await databases.updateDocument(DB_ID, COL_ID, docId, payload);
        } catch (e: any) {
            const errMsg = e.message || '';
            if (e.code === 429 || errMsg.toLowerCase().includes('rate limit') || errMsg.toLowerCase().includes('rate_limit')) {
                throw e; // Abort immediately on rate limit to let the replication layer retry later
            }
            if (errMsg.includes('Unknown attribute') || errMsg.includes('Invalid document structure')) {
                const match = errMsg.match(/attribute:?\s*"?([a-zA-Z0-9_-]+)"?/i);
                if (match && match[1]) {
                    const attributeName = match[1];
                    console.warn(`[Replication] Pruned unknown attribute from update: ${attributeName}`);
                    delete payload[attributeName];
                    continue;
                }
                
                let prunedSome = false;
                for (const key of Object.keys(payload)) {
                    if (errMsg.includes(key)) {
                        console.warn(`[Replication] Fallback pruned attribute from update: ${key}`);
                        delete payload[key];
                        prunedSome = true;
                        break;
                    }
                }
                if (prunedSome) continue;
            }
            throw e;
        }
    }
    throw new Error('Robust update failed: exceeded max retry attempts due to unknown attributes');
}

export function startMessagesReplication(collection: any, userId: string) {
    if (!APPWRITE_CONFIG.databaseId || !APPWRITE_CONFIG.collections.messages) return null;
    
    const DB_ID = APPWRITE_CONFIG.databaseId;
    const COL_ID = APPWRITE_CONFIG.collections.messages;

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
                    // Pull all messages the user has access to, updated after the last checkpoint.
                    // Appwrite security rules should ensure we only see relevant messages.
                    const res = await databases.listDocuments(DB_ID, COL_ID, [
                        Query.greaterThan('$createdAt', new Date(updatedAfter).toISOString()),
                        Query.orderAsc('$createdAt'),
                        Query.limit(batchSize),
                    ]);

                    const docs = res.documents.map(doc => {
                        const content = doc.content;
                        const type = doc.type;
                        let attachments = doc.attachments ? doc.attachments.map((a: any) => { try { return typeof a === 'string' ? JSON.parse(a) : a; } catch { return a; } }) : [];

                        // Fallback extraction of attachments from content JSON but DO NOT alter type and content!
                        if (type?.startsWith('f:') && content?.startsWith('{')) {
                            try {
                                const parsed = JSON.parse(content);
                                attachments = parsed.a || attachments;
                            } catch (e) {}
                        }

                        let mathMeta = undefined;
                        if (doc.mathMeta) {
                            try {
                                mathMeta = typeof doc.mathMeta === 'string' ? JSON.parse(doc.mathMeta) : doc.mathMeta;
                            } catch (e) {
                                console.warn('[Replication] Failed parsing mathMeta:', e);
                            }
                        }

                        let strokes = doc.strokes || [];
                        if ((!strokes || strokes.length === 0) && mathMeta) {
                            if (Array.isArray(mathMeta.strokes) && mathMeta.strokes.length > 0) {
                                strokes = mathMeta.strokes;
                            } else if (Array.isArray(mathMeta.annotation_strokes) && mathMeta.annotation_strokes.length > 0) {
                                strokes = mathMeta.annotation_strokes;
                            }
                        }

                        return {
                            id: doc.$id || doc.id || doc._id,
                            conversationId: doc.conversationId,
                            senderId: doc.senderId,
                            content,
                            type: type || 'text',
                            createdAt: doc.createdAt || doc.$createdAt,
                            status: doc.status || 'sent',
                            ip: doc.ip || '',
                            isPinned: doc.isPinned || false,
                            attachments,
                            strokes,
                            mathMeta,
                            _deleted: false,
                            updatedAt: new Date(doc.$createdAt || doc.createdAt).getTime()
                        };
                    });

                    const checkpoint = docs.length
                        ? { updatedAt: docs[docs.length - 1].updatedAt }
                        : lastCheckpoint;
                        
                    return { documents: docs, checkpoint };
                } catch (e: any) {
                    if (isNetworkError(e)) {
                        console.warn('[Replication] Pull replication deferred (offline or server unreachable). Offline-ready data in local RxDB will be fully interactive. Status:', e.message || e);
                    } else {
                        console.warn('[Replication] Pull replication deferred due to error:', e.message || e);
                    }
                    throw e; // Signal RxDB replication engine to gracefully retry after exponential backoff
                }
            }
        },
        push: {
            batchSize: 25,
            async handler(docs) {
                // Ensure all relevant conversations are synced first
                const cids = Array.from(new Set(docs.map(d => d.newDocumentState?.conversationId).filter(Boolean)));
                if (cids.length > 0) {
                    try {
                        const { messagingService } = await import('./messagingService');
                        for (const cid of cids) {
                            if (typeof cid === 'string') {
                                await messagingService.ensureConversationOnAppwrite(cid).catch(e => console.warn(`Replication: Convo sync failed ${cid}`, e));
                            }
                        }
                    } catch (e) {
                        console.warn('Replication: Failed to import messagingService', e);
                    }
                }

                const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
                for (const { newDocumentState } of docs) {
                    if (newDocumentState._deleted) {
                        // Handle deletion
                        try {
                            if (isValidAppwriteId(newDocumentState.id)) {
                                await databases.deleteDocument(DB_ID, COL_ID, newDocumentState.id);
                                console.info(`[Replication] Successfully deleted document ${newDocumentState.id} from remote.`);
                            }
                        } catch (e: any) {
                            const errCode = e.code || e.status;
                            if (errCode === 404) {
                                // Already deleted on remote, this is fine
                                console.info(`[Replication] Document ${newDocumentState.id} was already deleted from remote.`);
                            } else {
                                if (isNetworkError(e)) {
                                    console.warn(`[Replication] Deleting document ${newDocumentState.id} deferred (offline or server unreachable):`, e.message || e);
                                } else {
                                    console.warn(`[Replication] Failed to delete document ${newDocumentState.id}:`, e.message || e);
                                }
                                throw e; // Let RxDB retry if it's a transient error (e.g. 429, 500)
                            }
                        }
                        continue;
                    }

                    const attachments = newDocumentState.attachments || [];
                    // Check if there are any attachments waiting for their media uploader to finish
                    const isPendingBlob = attachments.some((a: any) => a.url && (a.url.startsWith('blob:') || a.fileId?.startsWith('pending_')));
                    if (isPendingBlob) {
                        console.log(`[Replication] Skipping push for message ${newDocumentState.id} due to pending media upload.`);
                        continue;
                    }

                    await sleep(150); // Respect Appwrite endpoint rate limits by spacing operations
                    try {
                        let pushStatus = newDocumentState.status;
                        if (pushStatus === 'pending') pushStatus = 'sent';

                        let mathMetaToPush = newDocumentState.mathMeta;
                        if (!mathMetaToPush && newDocumentState.strokes && newDocumentState.strokes.length > 0) {
                            mathMetaToPush = {
                                annotation_strokes: convertStrokesToAnnotationStrokes(newDocumentState.strokes),
                                strokes: newDocumentState.strokes
                            };
                        } else if (mathMetaToPush && newDocumentState.strokes && newDocumentState.strokes.length > 0 && !mathMetaToPush.annotation_strokes) {
                            mathMetaToPush = {
                                ...mathMetaToPush,
                                annotation_strokes: convertStrokesToAnnotationStrokes(newDocumentState.strokes),
                                strokes: newDocumentState.strokes
                            };
                        }

                        const appwriteDoc = {
                            conversationId: newDocumentState.conversationId,
                            senderId: newDocumentState.senderId,
                            content: newDocumentState.content,
                            type: newDocumentState.type,
                            status: pushStatus,
                            ip: newDocumentState.ip,
                            isPinned: newDocumentState.isPinned,
                            attachments: attachments,
                            mathMeta: mathMetaToPush ? (typeof mathMetaToPush === 'string' ? mathMetaToPush : JSON.stringify(mathMetaToPush)) : null
                        };

                        const permissions = [
                            Permission.read(Role.any()),
                            Permission.write(Role.any()),
                            Permission.update(Role.any()),
                            Permission.delete(Role.any()),
                        ];

                        try {
                            await createDocumentRobust(
                                DB_ID,
                                COL_ID,
                                newDocumentState.id,
                                appwriteDoc,
                                permissions
                            );
                            
                            // Update local RxDB status if it changed from pending
                            if (pushStatus === 'sent' && newDocumentState.status !== 'sent') {
                                await collection.upsert({
                                    ...newDocumentState,
                                    status: 'sent'
                                });
                            }
                        } catch (e: any) {
                            const errorCode = e.code || e.status;
                            const errorMessage = (e.message || '').toLowerCase();
                            
                            // 409 Conflict or explicit "already exists" -> patch instead
                            if (errorCode == 409 || errorMessage.includes('already exists') || errorMessage.includes('unique_index_violation')) {
                                console.info(`[Replication] Document ${newDocumentState.id} already exists on remote, switching to update.`);
                                const appwriteDocUpdate = {
                                    status: pushStatus,
                                    isPinned: newDocumentState.isPinned,
                                    attachments: attachments,
                                    content: newDocumentState.content // Also update content just in case it was edited locally
                                };
                                try {
                                    await updateDocumentRobust(
                                        DB_ID,
                                        COL_ID,
                                        newDocumentState.id,
                                        appwriteDocUpdate
                                    );
                                    
                                    // Update local RxDB status if it changed from pending
                                    if (pushStatus === 'sent' && newDocumentState.status !== 'sent') {
                                        await collection.upsert({
                                            ...newDocumentState,
                                            status: 'sent'
                                        });
                                    }
                                } catch (updateErr: any) {
                                    // If update also fails, log it and let RxDB handle retry if it's a transient error
                                    const upErrCode = updateErr.code || updateErr.status;
                                    if (upErrCode == 429) throw updateErr; // Rate limit - retry later
                                    
                                    // If it's a 404, it means we probably can't see it due to permissions or it was just deleted.
                                    if (upErrCode === 404) continue;
                                    
                                    if (isNetworkError(updateErr)) {
                                        console.warn(`[Replication] Push update fallback deferred for ${newDocumentState.id} (offline or server unreachable):`, updateErr.message || updateErr);
                                    } else {
                                        console.warn(`[Replication] Push update fallback failed for ${newDocumentState.id}:`, updateErr.message || updateErr);
                                    }
                                }
                            } else {
                                throw e; // Rethrow non-conflict errors to outer catch
                            }
                        }
                    } catch (e: any) {
                        const errStatus = e.code || e.status;
                        // Avoid noisy logging for common transient network errors or expected conflicts
                        if (errStatus != 429 && errStatus != 409) {
                            if (isNetworkError(e)) {
                                console.warn(`[Replication] Push processing deferred for document ${newDocumentState.id} (offline or server unreachable):`, e.message || e);
                            } else {
                                console.warn(`[Replication] Push processing failed for document ${newDocumentState.id}:`, e.message || e);
                            }
                        }
                        throw e; // Propagate to let RxDB handle retry
                    }
                }
                return []; // conflicts resolved
            }
        }
    });
}

export function startMathElementsReplication(collection: any, userId: string) {
    if (!APPWRITE_CONFIG.databaseId || !APPWRITE_CONFIG.collections.math_elements) return null;
    const DB_ID = APPWRITE_CONFIG.databaseId;
    const COL_ID = APPWRITE_CONFIG.collections.math_elements;

    return replicateRxCollection({
        collection,
        replicationIdentifier: `math-el-rep-${userId}`,
        live: true,
        retryTime: 5000,
        pull: {
            batchSize: 50,
            async handler(lastCheckpoint: any, batchSize) {
                const updatedAfter = lastCheckpoint?.updatedAt ?? 0;
                try {
                    const res = await databases.listDocuments(DB_ID, COL_ID, [
                        Query.greaterThan('$updatedAt', new Date(updatedAfter).toISOString()),
                        Query.orderAsc('$updatedAt'),
                        Query.limit(batchSize),
                    ]);

                    const docs = res.documents.map(doc => {
                        let content = {};
                        let style = {};
                        try { content = doc.content ? JSON.parse(doc.content) : {}; } catch { content = {}; }
                        try { style = doc.style ? JSON.parse(doc.style) : {}; } catch { style = {}; }

                        return {
                            id: doc.$id,
                            sessionId: doc.sessionId,
                            type: doc.type,
                            x: doc.x,
                            y: doc.y,
                            width: doc.width,
                            height: doc.height,
                            rotation: doc.rotation ?? 0,
                            zIndex: doc.zIndex,
                            content,
                            style,
                            createdBy: doc.createdBy,
                            createdAt: doc.createdAt,
                            lastEditedBy: doc.lastEditedBy,
                            lastEditedAt: doc.lastEditedAt,
                            version: doc.version ?? 1,
                            isDeleted: doc.isDeleted ?? false,
                            isAnnotation: doc.isAnnotation ?? false,
                            annotationTargetId: doc.annotationTargetId,
                            lockedBy: doc.lockedBy,
                            lockedAt: doc.lockedAt,
                            _deleted: false,
                            updatedAt: new Date(doc.$updatedAt).getTime()
                        };
                    });

                    const checkpoint = docs.length ? { updatedAt: docs[docs.length - 1].updatedAt } : lastCheckpoint;
                    return { documents: docs, checkpoint };
                } catch (e: any) {
                    if (!isNetworkError(e)) {
                        console.warn('[Replication math_elements] Pull deferred error:', e.message || e);
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
                            if (isValidAppwriteId(newDocumentState.id)) {
                                await databases.deleteDocument(DB_ID, COL_ID, newDocumentState.id);
                            }
                        } catch (e: any) {
                            if (e.code !== 404 && !isNetworkError(e)) throw e;
                        }
                    } else {
                        try {
                            const appwriteDoc = {
                                sessionId: newDocumentState.sessionId,
                                type: newDocumentState.type,
                                x: newDocumentState.x,
                                y: newDocumentState.y,
                                width: newDocumentState.width,
                                height: newDocumentState.height,
                                rotation: newDocumentState.rotation ?? 0,
                                zIndex: newDocumentState.zIndex,
                                content: JSON.stringify(newDocumentState.content || {}),
                                style: JSON.stringify(newDocumentState.style || {}),
                                createdBy: newDocumentState.createdBy,
                                createdAt: newDocumentState.createdAt,
                                lastEditedBy: newDocumentState.lastEditedBy || null,
                                lastEditedAt: newDocumentState.lastEditedAt || null,
                                version: newDocumentState.version ?? 1,
                                isDeleted: newDocumentState.isDeleted ?? false,
                                isAnnotation: newDocumentState.isAnnotation ?? false,
                                annotationTargetId: newDocumentState.annotationTargetId || null,
                                lockedBy: newDocumentState.lockedBy || null,
                                lockedAt: newDocumentState.lockedAt || null,
                            };

                            if (newDocumentState.id && isValidAppwriteId(newDocumentState.id)) {
                                try {
                                    await databases.getDocument(DB_ID, COL_ID, newDocumentState.id);
                                    await updateDocumentRobust(DB_ID, COL_ID, newDocumentState.id, appwriteDoc);
                                } catch (e: any) {
                                    if (e.code === 404) {
                                        await createDocumentRobust(DB_ID, COL_ID, newDocumentState.id, appwriteDoc);
                                    } else {
                                        throw e;
                                    }
                                }
                            } else {
                                await createDocumentRobust(DB_ID, COL_ID, 'ID_AUTOMATIC', appwriteDoc);
                            }
                        } catch (e: any) {
                            if (e.code !== 409) throw e;
                        }
                    }
                }
                return [];
            }
        }
    });
}

export function startElementOperationsReplication(collection: any, userId: string) {
    if (!APPWRITE_CONFIG.databaseId || !APPWRITE_CONFIG.collections.element_operations) return null;
    const DB_ID = APPWRITE_CONFIG.databaseId;
    const COL_ID = APPWRITE_CONFIG.collections.element_operations;

    return replicateRxCollection({
        collection,
        replicationIdentifier: `el-op-rep-${userId}`,
        live: true,
        retryTime: 5000,
        pull: {
            batchSize: 50,
            async handler(lastCheckpoint: any, batchSize) {
                const updatedAfter = lastCheckpoint?.updatedAt ?? 0;
                try {
                    const res = await databases.listDocuments(DB_ID, COL_ID, [
                        Query.greaterThan('$updatedAt', new Date(updatedAfter).toISOString()),
                        Query.orderAsc('$updatedAt'),
                        Query.limit(batchSize),
                    ]);

                    const docs = res.documents.map(doc => {
                        let patch = {};
                        let previousPatch = {};
                        try { patch = doc.patch ? JSON.parse(doc.patch) : {}; } catch { patch = {}; }
                        try { previousPatch = doc.previousPatch ? JSON.parse(doc.previousPatch) : {}; } catch { previousPatch = {}; }

                        return {
                            id: doc.$id,
                            sessionId: doc.sessionId,
                            elementId: doc.elementId,
                            operationType: doc.operationType,
                            userId: doc.userId,
                            userName: doc.userName,
                            timestamp: doc.timestamp,
                            patch,
                            previousPatch,
                            sessionVersion: doc.sessionVersion,
                            _deleted: false,
                            updatedAt: new Date(doc.$updatedAt).getTime()
                        };
                    });

                    const checkpoint = docs.length ? { updatedAt: docs[docs.length - 1].updatedAt } : lastCheckpoint;
                    return { documents: docs, checkpoint };
                } catch (e: any) {
                    if (!isNetworkError(e)) {
                        console.warn('[Replication element_operations] Pull deferred error:', e.message || e);
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
                            if (isValidAppwriteId(newDocumentState.id)) {
                                await databases.deleteDocument(DB_ID, COL_ID, newDocumentState.id);
                            }
                        } catch (e: any) {
                            if (e.code !== 404 && !isNetworkError(e)) throw e;
                        }
                    } else {
                        try {
                            const appwriteDoc = {
                                sessionId: newDocumentState.sessionId,
                                elementId: newDocumentState.elementId,
                                operationType: newDocumentState.operationType,
                                userId: newDocumentState.userId,
                                userName: newDocumentState.userName,
                                timestamp: newDocumentState.timestamp,
                                patch: JSON.stringify(newDocumentState.patch || {}),
                                previousPatch: JSON.stringify(newDocumentState.previousPatch || {}),
                                sessionVersion: newDocumentState.sessionVersion,
                            };

                            if (newDocumentState.id && isValidAppwriteId(newDocumentState.id)) {
                                try {
                                    await databases.getDocument(DB_ID, COL_ID, newDocumentState.id);
                                    await updateDocumentRobust(DB_ID, COL_ID, newDocumentState.id, appwriteDoc);
                                } catch (e: any) {
                                    if (e.code === 404) {
                                        await createDocumentRobust(DB_ID, COL_ID, newDocumentState.id, appwriteDoc);
                                    } else {
                                        throw e;
                                    }
                                }
                            } else {
                                await createDocumentRobust(DB_ID, COL_ID, 'ID_AUTOMATIC', appwriteDoc);
                            }
                        } catch (e: any) {
                            if (e.code !== 409) throw e;
                        }
                    }
                }
                return [];
            }
        }
    });
}

export function startCanvasSessionsReplication(collection: any, userId: string) {
    if (!APPWRITE_CONFIG.databaseId || !APPWRITE_CONFIG.collections.canvas_sessions) return null;
    const DB_ID = APPWRITE_CONFIG.databaseId;
    const COL_ID = APPWRITE_CONFIG.collections.canvas_sessions;

    return replicateRxCollection({
        collection,
        replicationIdentifier: `canvas-sess-rep-${userId}`,
        live: true,
        retryTime: 5000,
        pull: {
            batchSize: 50,
            async handler(lastCheckpoint: any, batchSize) {
                const updatedAfter = lastCheckpoint?.updatedAt ?? 0;
                try {
                    const res = await databases.listDocuments(DB_ID, COL_ID, [
                        Query.greaterThan('$updatedAt', new Date(updatedAfter).toISOString()),
                        Query.orderAsc('$updatedAt'),
                        Query.limit(batchSize),
                    ]);

                    const docs = res.documents.map(doc => {
                        let activeUsers: string[] = [];
                        let editChain: string[] = [];
                        try {
                            activeUsers = doc.activeUsers ? (typeof doc.activeUsers === 'string' ? JSON.parse(doc.activeUsers) : doc.activeUsers) : [];
                        } catch { activeUsers = []; }
                        try {
                            editChain = doc.editChain ? (typeof doc.editChain === 'string' ? JSON.parse(doc.editChain) : doc.editChain) : [];
                        } catch { editChain = []; }

                        return {
                            id: doc.$id,
                            threadId: doc.threadId,
                            messageId: doc.messageId,
                            parentSessionId: doc.parentSessionId,
                            subject: doc.subject,
                            curriculumLevel: doc.curriculumLevel,
                            createdBy: doc.createdBy,
                            createdAt: doc.createdAt,
                            chalkHolder: doc.chalkHolder,
                            chalkHolderName: doc.chalkHolderName,
                            chalkAcquiredAt: doc.chalkAcquiredAt,
                            activeUsers,
                            editChain,
                            operationCount: doc.operationCount ?? 0,
                            _deleted: false,
                            updatedAt: new Date(doc.$updatedAt).getTime()
                        };
                    });

                    const checkpoint = docs.length ? { updatedAt: docs[docs.length - 1].updatedAt } : lastCheckpoint;
                    return { documents: docs, checkpoint };
                } catch (e: any) {
                    if (!isNetworkError(e)) {
                        console.warn('[Replication canvas_sessions] Pull deferred error:', e.message || e);
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
                            if (isValidAppwriteId(newDocumentState.id)) {
                                await databases.deleteDocument(DB_ID, COL_ID, newDocumentState.id);
                            }
                        } catch (e: any) {
                            if (e.code !== 404 && !isNetworkError(e)) throw e;
                        }
                    } else {
                        try {
                            const appwriteDoc = {
                                threadId: newDocumentState.threadId,
                                messageId: newDocumentState.messageId,
                                parentSessionId: newDocumentState.parentSessionId || null,
                                subject: newDocumentState.subject,
                                curriculumLevel: newDocumentState.curriculumLevel,
                                createdBy: newDocumentState.createdBy,
                                createdAt: newDocumentState.createdAt,
                                chalkHolder: newDocumentState.chalkHolder || null,
                                chalkHolderName: newDocumentState.chalkHolderName || null,
                                chalkAcquiredAt: newDocumentState.chalkAcquiredAt || null,
                                activeUsers: newDocumentState.activeUsers || [],
                                editChain: newDocumentState.editChain || [],
                                operationCount: newDocumentState.operationCount ?? 0,
                            };

                            if (newDocumentState.id && isValidAppwriteId(newDocumentState.id)) {
                                try {
                                    await databases.getDocument(DB_ID, COL_ID, newDocumentState.id);
                                    await updateDocumentRobust(DB_ID, COL_ID, newDocumentState.id, appwriteDoc);
                                } catch (e: any) {
                                    if (e.code === 404) {
                                        await createDocumentRobust(DB_ID, COL_ID, newDocumentState.id, appwriteDoc);
                                    } else {
                                        throw e;
                                    }
                                }
                            } else {
                                await createDocumentRobust(DB_ID, COL_ID, 'ID_AUTOMATIC', appwriteDoc);
                            }
                        } catch (e: any) {
                            if (e.code !== 409) throw e;
                        }
                    }
                }
                return [];
            }
        }
    });
}

export function startPresenceReplication(collection: any, userId: string) {
    if (!APPWRITE_CONFIG.databaseId || !APPWRITE_CONFIG.collections.presence) return null;
    const DB_ID = APPWRITE_CONFIG.databaseId;
    const COL_ID = APPWRITE_CONFIG.collections.presence;

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
                    const res = await databases.listDocuments(DB_ID, COL_ID, [
                        Query.greaterThan('$updatedAt', new Date(updatedAfter).toISOString()),
                        Query.orderAsc('$updatedAt'),
                        Query.limit(batchSize),
                    ]);

                    const docs = res.documents.map(doc => {
                        return {
                            id: doc.$id,
                            sessionId: doc.sessionId,
                            userId: doc.userId,
                            displayName: doc.displayName,
                            avatarColor: doc.avatarColor,
                            x: doc.x,
                            y: doc.y,
                            tool: doc.tool,
                            isChalkHolder: doc.isChalkHolder ?? false,
                            updatedAt: doc.updatedAt,
                            _deleted: false,
                            updatedAtTime: new Date(doc.$updatedAt).getTime()
                        };
                    });

                    const checkpoint = docs.length ? { updatedAt: docs[docs.length - 1].updatedAtTime } : lastCheckpoint;
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
                    if (newDocumentState._deleted) {
                        try {
                            if (isValidAppwriteId(newDocumentState.id)) {
                                await databases.deleteDocument(DB_ID, COL_ID, newDocumentState.id);
                            }
                        } catch (e: any) {
                            if (e.code !== 404 && !isNetworkError(e)) throw e;
                        }
                    } else {
                        try {
                            const appwriteDoc = {
                                sessionId: newDocumentState.sessionId,
                                userId: newDocumentState.userId,
                                displayName: newDocumentState.displayName,
                                avatarColor: newDocumentState.avatarColor,
                                x: newDocumentState.x,
                                y: newDocumentState.y,
                                tool: newDocumentState.tool,
                                isChalkHolder: newDocumentState.isChalkHolder ?? false,
                                updatedAt: newDocumentState.updatedAt,
                            };

                            if (newDocumentState.id && isValidAppwriteId(newDocumentState.id)) {
                                try {
                                    await databases.getDocument(DB_ID, COL_ID, newDocumentState.id);
                                    await updateDocumentRobust(DB_ID, COL_ID, newDocumentState.id, appwriteDoc);
                                } catch (e: any) {
                                    if (e.code === 404) {
                                        await createDocumentRobust(DB_ID, COL_ID, newDocumentState.id, appwriteDoc);
                                    } else {
                                        throw e;
                                    }
                                }
                            } else {
                                await createDocumentRobust(DB_ID, COL_ID, 'ID_AUTOMATIC', appwriteDoc);
                            }
                        } catch (e: any) {
                            if (e.code !== 409) throw e;
                        }
                    }
                }
                return [];
            }
        }
    });
}
