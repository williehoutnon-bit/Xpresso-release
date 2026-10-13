// === RxDB Database setup for Offline-First capability ===
import { createRxDatabase, addRxPlugin, RxDatabase, RxCollection } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { replicateRxCollection } from 'rxdb/plugins/replication';
import { supabase, supabaseAdmin } from './supabaseService';

// Add plugins
addRxPlugin(RxDBMigrationSchemaPlugin);
addRxPlugin(RxDBLeaderElectionPlugin);
addRxPlugin(RxDBQueryBuilderPlugin);

export interface Annotation {
  _id: string;
  userId: string; // Associated with user
  text: string;
  color: string;
  note?: string;
  timestamp: number;
}

type AnnotationDocType = Annotation;

type DatabaseCollections = {
  annotations: RxCollection<AnnotationDocType>;
  messages: RxCollection<any>;
  conversations: RxCollection<any>;
  participants: RxCollection<any>;
  attachments: RxCollection<any>;
  profiles: RxCollection<any>;
  accounts: RxCollection<any>;
  friendships: RxCollection<any>;
  math_elements: RxCollection<any>;
  element_operations: RxCollection<any>;
  canvas_sessions: RxCollection<any>;
  presence: RxCollection<any>;
};

/**
 * Normalizes attachments into an array of plain objects, preventing malformed strings/objects
 * from breaking frontend consumers or RxDB storage.
 */
export function normalizeAttachments(attachments: any): any[] {
  if (!attachments) return [];
  if (Array.isArray(attachments)) {
    return attachments.map((a: any) => {
      if (typeof a === 'string') {
        try {
          const parsed = JSON.parse(a);
          return typeof parsed === 'object' && parsed !== null ? parsed : { url: a };
        } catch {
          return { url: a };
        }
      }
      return a;
    });
  }
  if (typeof attachments === 'string') {
    try {
      const parsed = JSON.parse(attachments);
      if (Array.isArray(parsed)) return normalizeAttachments(parsed);
      if (parsed && typeof parsed === 'object') return [parsed];
      return [{ url: attachments }];
    } catch {
      return [{ url: attachments }];
    }
  }
  if (typeof attachments === 'object') {
    return [attachments];
  }
  return [];
}

/**
 * Ensures any document or data passed into RxDB is a plain JSON-serializable object
 * and stripped of Svelte 5 reactive Proxies, getters, and non-cloneable references.
 */
export function toPlainObject<T>(obj: T): T {
  if (obj === undefined || obj === null) return obj;
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return obj;
  }
}

// Singleton pattern: We store the database promise so we only initialize it once
let dbPromise: Promise<RxDatabase<DatabaseCollections>> | null = null;

const createDB = async () => {
  const initDBWithCollections = async () => {
    // Debug toggle: bypass IndexedDB and force fresh fetch from Appwrite to purely use remote data
    const useRemoteOnly = false; // localStorage.getItem('USE_REMOTE_DB_ONLY') === 'true' || (window as any).USE_REMOTE_DB_ONLY;
    const storageOption = getRxStorageDexie();
    const dbName = useRemoteOnly ? `exup_db_remote_only` : 'exup_db';
    
    // In remote-only mode, we always start with a clean database to act like in-memory
    if (useRemoteOnly) {
       try {
         const { removeRxDatabase } = await import('rxdb');
         await removeRxDatabase(dbName, storageOption);
       } catch (e) {
         console.warn('Failed to clear remote-only RxDB:', e);
       }
    }

    // 1. Create the database instance
    const db = await createRxDatabase<DatabaseCollections>({
      name: dbName,
      storage: storageOption // Uses Memory or IndexedDB under the hood based on toggle
    });

    // 2. Add collections (tables) with schemas
    await db.addCollections({
    annotations: {
      schema: {
        title: 'annotation schema',
        version: 2, // Incremented for camelCase update
        primaryKey: '_id',
        type: 'object',
        properties: {
          _id: { type: 'string', maxLength: 100 },
          userId: { type: 'string', maxLength: 100 },
          text: { type: 'string' },
          color: { type: 'string' },
          note: { type: 'string' },
          timestamp: { type: 'number' }
        },
        required: ['_id', 'userId', 'text', 'color', 'timestamp']
      },
      migrationStrategies: {
        1: (oldDoc: any) => {
          oldDoc.userId = oldDoc.userId || oldDoc.user_id || '';
          delete oldDoc.user_id;
          return oldDoc;
        },
        2: (oldDoc: any) => {
          oldDoc.userId = oldDoc.userId || oldDoc.user_id || '';
          delete oldDoc.user_id;
          return oldDoc;
        }
      }
    },
    profiles: {
      schema: {
        title: 'profiles schema',
        version: 9, // Incremented
        primaryKey: 'userId',
        type: 'object',
        properties: {
          userId: { type: 'string', maxLength: 100 },
          surname: { type: 'string' },
          middleName: { type: 'string' },
          lastName: { type: 'string' },
          fullName: { type: 'string' },
          role: { type: 'string' },
          age: { type: 'number' },
          country: { type: 'string' },
          district: { type: 'string' },
          school: { type: 'string' },
          studentClass: { type: 'string' },
          parentContact: { type: 'string' },
          whatsappContact: { type: 'string' },
          exupCode: { type: 'string' },
          ipAddresses: { type: 'array', items: { type: 'string' } },
          bio: { type: 'string' },
          avatarUrl: { type: 'string' },
          points: { type: 'number' },
          preferredSubjects: { type: 'string' },
          subjectCombination: { type: 'string' },
          house: { type: 'string' },
          clubs: { type: 'string' },
          isOnline: { type: 'boolean' },
          lastSeenAt: { type: ['string', 'null'] }
        },
        required: ['userId', 'surname', 'lastName', 'role']
      },
      migrationStrategies: {
        1: function (oldDoc: any) { return oldDoc; },
        2: function (oldDoc: any) {
          oldDoc.userId = oldDoc.userId || oldDoc.user_id || '';
          delete oldDoc.user_id;
          return oldDoc;
        },
        3: function (oldDoc: any) { return oldDoc; },
        4: function (oldDoc: any) { return oldDoc; },
        5: function (oldDoc: any) { return oldDoc; },
        6: function (oldDoc: any) { return oldDoc; },
        7: function (oldDoc: any) {
          oldDoc.userId = oldDoc.userId || oldDoc.user_id || '';
          delete oldDoc.user_id;
          return oldDoc;
        },
        8: function (oldDoc: any) {
          oldDoc.age = parseInt(oldDoc.age) || 0;
          return oldDoc;
        },
        9: function (oldDoc: any) { return oldDoc; }
      }
    },
    conversations: {
      schema: {
        title: 'conversations schema',
        version: 2, // Incremented
        primaryKey: 'id',
        type: 'object',
        properties: {
          id: { type: 'string', maxLength: 100 },
          name: { type: 'string' },
          isGroup: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          ip: { type: 'string' }
        },
        required: ['id', 'isGroup', 'createdAt', 'ip'],
        indexes: ['createdAt']
      },
      migrationStrategies: {
        1: (oldDoc: any) => oldDoc,
        2: (oldDoc: any) => {
          oldDoc.isGroup = oldDoc.isGroup ?? oldDoc.is_group ?? false;
          oldDoc.createdAt = oldDoc.createdAt ?? oldDoc.created_at ?? new Date().toISOString();
          delete oldDoc.is_group;
          delete oldDoc.created_at;
          return oldDoc;
        }
      }
    },
    messages: {
      schema: {
        title: 'messages schema',
        version: 12, // Incremented for flexible stroke point formats and container metadata
        primaryKey: 'id',
        type: 'object',
        properties: {
          id: { type: 'string', maxLength: 100 },
          conversationId: { type: 'string', maxLength: 100 },
          senderId: { type: 'string' },
          content: { type: 'string' },
          type: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          status: { type: 'string' }, // pending, sent, delivered, read
          ip: { type: 'string' },
          isPinned: { type: 'boolean', default: false },
          attachments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                fileId: { type: 'string' },
                url: { type: 'string' },
                duration: { type: 'number' },
                waveform: { type: 'string' },
                name: { type: 'string' },
                size: { type: 'number' }
              }
            }
          },
          strokes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                color: { type: 'string' },
                width: { type: 'number' },
                strokeWidth: { type: 'number' },
                opacity: { type: 'number' },
                path: { type: 'string' },
                pathNormalized: { type: 'string' },
                createdAt: { type: 'number' },
                createdBy: { type: 'string' },
                coordSpace: { type: 'string' },
                containerWidth: { type: 'number' },
                containerHeight: { type: 'number' },
                containerAspectRatio: { type: 'number' },
                anchorElementIds: {
                  type: 'array',
                  items: { type: 'string' }
                },
                points: {
                  type: 'array',
                  items: {
                    type: ['array', 'object']
                  }
                },
                pointsNormalized: {
                  type: 'array',
                  items: {
                    type: ['array', 'object']
                  }
                },
                boundingBox: {
                  type: 'object',
                  properties: {
                    x0: { type: 'number' },
                    y0: { type: 'number' },
                    x1: { type: 'number' },
                    y1: { type: 'number' }
                  }
                },
                boundingBoxNormalized: {
                  type: 'object',
                  properties: {
                    x0: { type: 'number' },
                    y0: { type: 'number' },
                    x1: { type: 'number' },
                    y1: { type: 'number' }
                  }
                },
                anchors: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      nodeId: { type: 'string' },
                      dx: { type: 'number' },
                      dy: { type: 'number' },
                      weight: { type: 'number' }
                    }
                  }
                }
              }
            }
          },
          mathMeta: {
            type: ['object', 'null'],
            properties: {
              fileId: { type: 'string' },
              documentId: { type: 'string' },
              parentDocumentId: { type: ['string', 'null'] },
              subject: { type: 'string' },
              curriculumLevel: { type: 'string' },
              thumbnailData: { type: 'string' },
              elementCount: { type: 'number' },
              annotationCount: { type: 'number' },
              chalkHolder: { type: ['string', 'null'] },
              chalkHolderName: { type: ['string', 'null'] },
              strokes: { type: 'array' },
              annotation_strokes: { type: 'array' },
              versionChainIds: {
                type: 'array',
                items: { type: 'string' }
              },
              versionFileIds: {
                type: 'array',
                items: { type: 'string' }
              },
              versionAuthorIds: {
                type: 'array',
                items: { type: 'string' }
              },
              versionAuthorNames: {
                type: 'array',
                items: { type: 'string' }
              },
              versionAudioIds: {
                type: 'array',
                items: { type: 'string' }
              },
              currentVersionIndex: { type: 'number' }
            }
          }
        },
        required: ['id', 'conversationId', 'senderId', 'createdAt', 'ip'],
        indexes: [
          'createdAt',
          'conversationId',
          'senderId',
          ['conversationId', 'createdAt'],
          ['conversationId', 'senderId', 'createdAt']
        ]
      },
      migrationStrategies: {
        1: (oldDoc: any) => oldDoc,
        2: (oldDoc: any) => oldDoc,
        3: (oldDoc: any) => oldDoc,
        4: (oldDoc: any) => oldDoc,
        5: (oldDoc: any) => oldDoc,
        6: (oldDoc: any) => {
          oldDoc.conversationId = oldDoc.conversationId || oldDoc.conversation_id || '';
          oldDoc.senderId = oldDoc.senderId || oldDoc.sender_id || '';
          oldDoc.createdAt = oldDoc.createdAt || oldDoc.created_at || new Date().toISOString();
          oldDoc.isPinned = oldDoc.isPinned ?? oldDoc.is_pinned ?? false;
          delete oldDoc.conversation_id;
          delete oldDoc.sender_id;
          delete oldDoc.created_at;
          delete oldDoc.is_pinned;
          return oldDoc;
        },
        7: (oldDoc: any) => {
          if (oldDoc.mathMeta) {
            oldDoc.mathMeta.versionChainIds = oldDoc.mathMeta.versionChainIds || (oldDoc.mathMeta.documentId ? [oldDoc.mathMeta.documentId] : []);
            oldDoc.mathMeta.versionFileIds = oldDoc.mathMeta.versionFileIds || (oldDoc.mathMeta.fileId ? [oldDoc.mathMeta.fileId] : []);
            oldDoc.mathMeta.currentVersionIndex = oldDoc.mathMeta.currentVersionIndex ?? 0;
          }
          return oldDoc;
        },
        8: (oldDoc: any) => {
          if (oldDoc.mathMeta) {
            oldDoc.mathMeta.versionAuthorIds = oldDoc.mathMeta.versionAuthorIds || [];
            oldDoc.mathMeta.versionAuthorNames = oldDoc.mathMeta.versionAuthorNames || [];
          }
          return oldDoc;
        },
        9: (oldDoc: any) => {
          if (oldDoc.mathMeta) {
            oldDoc.mathMeta.versionAudioIds = oldDoc.mathMeta.versionAudioIds || [];
          }
          return oldDoc;
        },
        10: (oldDoc: any) => {
          oldDoc.strokes = oldDoc.strokes || [];
          return oldDoc;
        },
        11: (oldDoc: any) => {
          oldDoc.strokes = oldDoc.strokes || [];
          if (oldDoc.mathMeta) {
            oldDoc.mathMeta.strokes = oldDoc.mathMeta.strokes || oldDoc.strokes || [];
            oldDoc.mathMeta.annotation_strokes = oldDoc.mathMeta.annotation_strokes || [];
          }
          return oldDoc;
        },
        12: (oldDoc: any) => {
          oldDoc.strokes = oldDoc.strokes || [];
          return oldDoc;
        }
      }
    },
    participants: {
      schema: {
        title: 'participants schema',
        version: 4, // Incremented
        primaryKey: 'id', // Composite-like ID: conversationId + userId
        type: 'object',
        properties: {
          id: { type: 'string', maxLength: 200 },
          conversationId: { type: 'string', maxLength: 100 },
          userId: { type: 'string', maxLength: 100 },
          lastReadAt: { type: 'string', format: 'date-time' },
          ip: { type: 'string' },
          isDeleted: { type: 'boolean' },
          deletedAt: { type: 'string' },
          clearedAt: { type: 'string' },
          lastMessageAt: { type: 'string' }
        },
        required: ['id', 'conversationId', 'userId', 'lastReadAt', 'ip'],
        indexes: ['userId', 'conversationId']
      },
      migrationStrategies: {
        1: (oldDoc: any) => oldDoc,
        2: (oldDoc: any) => oldDoc,
        3: (oldDoc: any) => {
          oldDoc.conversationId = oldDoc.conversationId || oldDoc.conversation_id || '';
          oldDoc.userId = oldDoc.userId || oldDoc.user_id || '';
          oldDoc.lastReadAt = oldDoc.lastReadAt || oldDoc.last_read_at || new Date().toISOString();
          oldDoc.isDeleted = oldDoc.isDeleted ?? oldDoc.is_deleted ?? false;
          oldDoc.deletedAt = oldDoc.deletedAt ?? oldDoc.deleted_at ?? null;
          delete oldDoc.conversation_id;
          delete oldDoc.user_id;
          delete oldDoc.last_read_at;
          delete oldDoc.is_deleted;
          delete oldDoc.deleted_at;
          return oldDoc;
        },
        4: (oldDoc: any) => {
          oldDoc.clearedAt = oldDoc.clearedAt || null;
          oldDoc.lastMessageAt = oldDoc.lastMessageAt || null;
          return oldDoc;
        }
      }
    },
    accounts: {
      schema: {
        title: 'accounts schema',
        version: 4, // Incremented to 4 to relax required constraints
        primaryKey: 'userId',
        type: 'object',
        properties: {
          userId: { type: 'string', maxLength: 100 },
          email: { type: 'string' },
          accountStatus: { type: 'string' },
          registrationDate: { type: 'string' },
          lastLogin: { type: 'string' },
          membershipLevel: { type: 'string' },
          StudentLIN: { type: 'string' },
          ParentNIN: { type: 'string' },
          StudentNIN: { type: 'string' },
          text: { type: 'string' },
          color: { type: 'string' },
          note: { type: 'string' },
          timestamp: { type: 'number' },
          surname: { type: 'string' },
          middleName: { type: 'string' },
          lastName: { type: 'string' },
          role: { type: 'string' },
          age: { type: 'number' },
          country: { type: 'string' },
          district: { type: 'string' },
          school: { type: 'string' },
          class: { type: 'string' },
          parentContact: { type: 'string' },
          whatsappContact: { type: 'string' },
          exupCode: { type: 'string' },
          ip: { type: 'string' }
        },
        required: ['userId']
      },
      migrationStrategies: {
        1: (oldDoc: any) => oldDoc,
        2: (oldDoc: any) => {
          oldDoc.userId = oldDoc.userId || oldDoc.user_id || '';
          delete oldDoc.user_id;
          return oldDoc;
        },
        3: (oldDoc: any) => oldDoc,
        4: (oldDoc: any) => oldDoc
      }
    },
    friendships: {
      schema: {
        title: 'friendships schema',
        version: 2, // Incremented
        primaryKey: 'id',
        type: 'object',
        properties: {
          id: { type: 'string', maxLength: 100 },
          userId: { type: 'string', maxLength: 100 },
          friendId: { type: 'string', maxLength: 100 },
          status: { type: 'string' }, // Pending, Accepted
          createdAt: { type: 'string', format: 'date-time' }
        },
        required: ['id', 'userId', 'friendId', 'status'],
        indexes: ['userId', 'friendId', 'status']
      },
      migrationStrategies: {
        1: (oldDoc: any) => oldDoc,
        2: (oldDoc: any) => {
          oldDoc.userId = oldDoc.userId || oldDoc.user_id || '';
          oldDoc.friendId = oldDoc.friendId || oldDoc.friend_id || '';
          oldDoc.createdAt = oldDoc.createdAt || oldDoc.created_at || new Date().toISOString();
          delete oldDoc.user_id;
          delete oldDoc.friend_id;
          delete oldDoc.created_at;
          return oldDoc;
        }
      }
    },
    math_elements: {
      schema: {
        title: 'math elements schema',
        version: 2,
        primaryKey: 'id',
        type: 'object',
        properties: {
          id: { type: 'string', maxLength: 100 },
          sessionId: { type: 'string', maxLength: 100 },
          type: { type: 'string' },
          x: { type: 'number' },
          y: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
          rotation: { type: 'number', default: 0 },
          zIndex: { type: 'number' },
          content: { type: 'object' },
          style: { type: 'object' },
          createdBy: { type: 'string' },
          createdAt: { type: 'string' },
          lastEditedBy: { type: 'string' },
          lastEditedAt: { type: 'string' },
          version: { type: 'number' },
          isDeleted: { type: 'boolean' },
          isAnnotation: { type: 'boolean' },
          annotationTargetId: { type: ['string', 'null'] },
          lockedBy: { type: ['string', 'null'] },
          lockedAt: { type: ['string', 'null'] }
        },
        required: ['id', 'sessionId', 'type', 'x', 'y', 'width', 'height', 'zIndex', 'createdBy', 'createdAt', 'version', 'isDeleted', 'isAnnotation'],
        indexes: ['sessionId', 'zIndex']
      },
      migrationStrategies: {
        1: (oldDoc: any) => oldDoc,
        2: (oldDoc: any) => {
          oldDoc.annotationTargetId = oldDoc.annotationTargetId || null;
          oldDoc.lockedBy = oldDoc.lockedBy || null;
          oldDoc.lockedAt = oldDoc.lockedAt || null;
          return oldDoc;
        }
      }
    },
    element_operations: {
      schema: {
        title: 'element operations schema',
        version: 1,
        primaryKey: 'id',
        type: 'object',
        properties: {
          id: { type: 'string', maxLength: 100 },
          sessionId: { type: 'string', maxLength: 100 },
          elementId: { type: 'string', maxLength: 100 },
          operationType: { type: 'string' },
          userId: { type: 'string' },
          userName: { type: 'string' },
          timestamp: { type: 'string' },
          patch: { type: 'object' },
          previousPatch: { type: 'object' },
          sessionVersion: { type: 'number' }
        },
        required: ['id', 'sessionId', 'elementId', 'operationType', 'userId', 'userName', 'timestamp', 'sessionVersion'],
        indexes: ['sessionId', 'elementId']
      },
      migrationStrategies: {
        1: (oldDoc: any) => oldDoc
      }
    },
    canvas_sessions: {
      schema: {
        title: 'canvas sessions schema',
        version: 2,
        primaryKey: 'id',
        type: 'object',
        properties: {
          id: { type: 'string', maxLength: 100 },
          threadId: { type: 'string', maxLength: 100 },
          messageId: { type: 'string', maxLength: 100 },
          parentSessionId: { type: ['string', 'null'] },
          subject: { type: 'string' },
          curriculumLevel: { type: 'string' },
          createdBy: { type: 'string' },
          createdAt: { type: 'string' },
          chalkHolder: { type: ['string', 'null'] },
          chalkHolderName: { type: ['string', 'null'] },
          chalkAcquiredAt: { type: ['string', 'null'] },
          activeUsers: { type: 'array', items: { type: 'string' } },
          editChain: { type: 'array', items: { type: 'string' } },
          operationCount: { type: 'number', default: 0 }
        },
        required: ['id', 'threadId', 'messageId', 'subject', 'curriculumLevel', 'createdBy', 'createdAt']
      },
      migrationStrategies: {
        1: (oldDoc: any) => oldDoc,
        2: (oldDoc: any) => {
          oldDoc.parentSessionId = oldDoc.parentSessionId || null;
          oldDoc.chalkHolder = oldDoc.chalkHolder || null;
          oldDoc.chalkHolderName = oldDoc.chalkHolderName || null;
          oldDoc.chalkAcquiredAt = oldDoc.chalkAcquiredAt || null;
          return oldDoc;
        }
      }
    },
    presence: {
      schema: {
        title: 'canvas presence schema',
        version: 1,
        primaryKey: 'id',
        type: 'object',
        properties: {
          id: { type: 'string', maxLength: 200 },
          sessionId: { type: 'string', maxLength: 100 },
          userId: { type: 'string', maxLength: 100 },
          displayName: { type: 'string' },
          avatarColor: { type: 'string' },
          x: { type: 'number' },
          y: { type: 'number' },
          tool: { type: 'string' },
          isChalkHolder: { type: 'boolean' },
          updatedAt: { type: 'string' }
        },
        required: ['id', 'sessionId', 'userId', 'displayName', 'avatarColor', 'x', 'y', 'tool', 'isChalkHolder', 'updatedAt'],
        indexes: ['sessionId', 'userId']
      },
      migrationStrategies: {
        1: (oldDoc: any) => oldDoc
      }
    }
  });

  return db;
  };

  try {
    return await initDBWithCollections();
  } catch (err: any) {
    console.warn('[dbService] DB initialization failed (possible DB schema mismatch). Purging and recreating database...', err);
    try {
      const { removeRxDatabase } = await import('rxdb');
      await removeRxDatabase('exup_db', getRxStorageDexie());
      return await initDBWithCollections();
    } catch (retryErr) {
      console.error('[dbService] Critical error: failed to recreate database after purging:', retryErr);
      throw retryErr;
    }
  }
};

export const getDB = (): Promise<RxDatabase<DatabaseCollections>> => {
  if (!dbPromise) {
    dbPromise = createDB();
  }
  return dbPromise;
};

async function safeRemove(doc: any, findFresh: () => Promise<any>) {
  let currentDoc = doc;
  while (true) {
    try {
      if (!currentDoc) return;
      if (currentDoc.deleted) return;
      await currentDoc.remove();
      break;
    } catch (err: any) {
      if (err.status === 409 || err.code === 'CONFLICT') {
        const fresh = await findFresh();
        if (!fresh) break; // If it's no longer found, it's already removed!
        currentDoc = fresh;
      } else {
        throw err;
      }
    }
  }
}

export const dbService = {
  async getRawDB() {
    return getDB();
  },
  async saveAnnotation(annotation: { text: string; color: string; note?: string; userId?: string }) {
    const db = await getDB();
    const doc: Annotation = {
      _id: Date.now().toString(),
      userId: annotation.userId || 'anonymous',
      text: annotation.text,
      color: annotation.color,
      note: annotation.note,
      timestamp: Date.now()
    };
    try {
      const response = await db.annotations.insert(doc);
      return response.toJSON();
    } catch (err) {
      console.error('Error saving annotation to RxDB:', err);
      throw err;
    }
  },

  async getAnnotations() {
    try {
      const db = await getDB();
      const result = await db.annotations.find().exec();
      return result.map(doc => doc.toJSON());
    } catch (err) {
      console.error('Error fetching annotations from RxDB:', err);
      return [];
    }
  },

  async deleteAnnotation(id: string) {
    try {
      const db = await getDB();
      const query = db.annotations.findOne(id);
      await query.remove();
    } catch (err) {
      console.error('Error deleting annotation:', err);
    }
  },

  // === MESSAGING METHODS ===

  async getConversations() {
    try {
      const db = await getDB();
      const result = await db.conversations.find().sort({ createdAt: 'desc' }).exec();
      return result.map(doc => doc.toJSON());
    } catch (err) {
      console.error('Error fetching conversations:', err);
      return [];
    }
  },

  async getMessages(conversationId: string) {
    try {
      const db = await getDB();
      const result = await db.messages.find({
        selector: { conversationId: conversationId },
        sort: [{ createdAt: 'asc' }]
      }).exec();
      let messages = result.map(doc => doc.toJSON());
      try {
        const { authService } = await import('./authService');
        const user = authService.getOfflineUser();
        if (user) {
          const participant = await db.participants.findOne({
            selector: { conversationId: conversationId, userId: user.$id || user.id }
          }).exec();
          if (participant) {
             const pData = participant.toJSON() as any;
             if (pData.clearedAt) {
                 const cutOff = new Date(pData.clearedAt).getTime();
                 if (!isNaN(cutOff)) {
                     messages = messages.filter(m => {
                         const data = typeof m.toJSON === 'function' ? m.toJSON() : m;
                         const cTime = new Date(data.createdAt || data.created_at).getTime();
                         return cTime > cutOff;
                     });
                 }
             }
          }
        }
      } catch (err) {}
      return messages;
    } catch (err) {
      console.error('Error fetching messages:', err);
      return [];
    }
  },

  async getLastMessage(conversationId: string) {
    try {
      const db = await getDB();
      
      let clearedAt = null;
      try {
        const { authService } = await import('./authService');
        const user = authService.getOfflineUser();
        if (user) {
          const participant = await db.participants.findOne({
            selector: { conversationId: conversationId, userId: user.$id || user.id }
          }).exec();
          if (participant && participant.clearedAt) {
            clearedAt = participant.clearedAt;
          }
        }
      } catch (err) {}

      // Using RxDB sort & limit is more efficient than fetching all and sorting in JS
      const result = await db.messages.find({
        selector: { 
          conversationId: conversationId
        },
        sort: [{ createdAt: 'desc' }],
        limit: 1
      }).exec();
      
      if (result.length === 0) return null;
      const docJson = result[0].toJSON();
      if (clearedAt && new Date(docJson.createdAt).getTime() <= new Date(clearedAt).getTime()) {
         return null;
      }
      docJson.attachments = normalizeAttachments(docJson.attachments);
      return docJson;
    } catch (err) {
      console.error('Error fetching last message:', err);
      // Fallback if sorting fails due to missing index on some environment
      try {
        const db = await getDB();
        const all = await db.messages.find({
          selector: { conversationId: conversationId }
        }).exec();
        if (all.length === 0) return null;
        let messages = all.map(doc => doc.toJSON());
        
        let clearedAt = null;
        try {
          const { authService } = await import('./authService');
          const user = await authService.getCurrentUser();
          if (user) {
            const participant = await db.participants.findOne({
              selector: { conversationId: conversationId, userId: user.$id }
            }).exec();
            if (participant && participant.clearedAt) {
              clearedAt = participant.clearedAt;
            }
          }
        } catch (err) {}

        if (clearedAt) {
          messages = messages.filter(m => new Date(m.createdAt).getTime() > new Date(clearedAt).getTime());
        }
        if (messages.length === 0) return null;

        messages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const top = messages[0];
        top.attachments = normalizeAttachments(top.attachments);
        return top;
      } catch (innerErr) {
        return null;
      }
    }
  },

  async getUnreadCount(conversationId: string, userId: string): Promise<number> {
    try {
      const db = await getDB();

      // 1. Get participant's lastReadAt watermark (O(1) lookup)
      const participant = await db.participants.findOne({
        selector: { conversationId: conversationId, userId: userId }
      }).exec();
      
      let lastReadAt = participant?.lastReadAt ?? '1970-01-01T00:00:00.000Z';
      const clearedAt = participant?.clearedAt;
      if (clearedAt && new Date(clearedAt).getTime() > new Date(lastReadAt).getTime()) {
        lastReadAt = clearedAt;
      }

      // 2. Count only messages newer than the watermark that were not sent by us
      const docs = await db.messages.find({
        selector: {
          conversationId: conversationId,
          senderId: { $ne: userId },
          createdAt: { $gt: lastReadAt },
        }
      }).exec();

      return docs.length;
    } catch (err) {
      console.error('Error fetching unread count:', err);
      return 0;
    }
  },

  /**
   * Returns an observable for messages in a conversation
   * Uses Supabase-native replication for real-time sync
   */
  async getMessages$(conversationId: string) {
    const db = await getDB();
    const { authService } = await import('./authService');
    const user = authService.getOfflineUser();
    
    if (!user) {
      return db.messages.find({
        selector: { conversationId: conversationId },
        sort: [{ createdAt: 'asc' }]
      }).$;
    }

    const { combineLatest, map } = await import('rxjs');

    const messages$ = db.messages.find({
      selector: { conversationId: conversationId },
      sort: [{ createdAt: 'asc' }]
    }).$;

    const participant$ = db.participants.findOne({
      selector: { conversationId: conversationId, userId: user.$id || user.id }
    }).$;

    return combineLatest([messages$, participant$]).pipe(
      map(([messages, participant]) => {
         let cutOff: number | null = null;
         if (participant) {
            const pData = participant.toJSON() as any;
            if (pData.clearedAt) {
               cutOff = new Date(pData.clearedAt).getTime();
            }
         }
         if (cutOff && !isNaN(cutOff)) {
            const validMessages = messages.filter((m: any) => {
               const data = typeof m.toJSON === 'function' ? m.toJSON() : m;
               const time = new Date(data.createdAt || data.created_at).getTime();
               return time > cutOff!;
            });
            return validMessages;
         }
         return messages;
      })
    );
  },

  /**
   * Returns an observable for all my conversations
   * Uses Supabase-native replication for real-time sync
   */
  async getMyConversations$(userId: string) {
    const db = await getDB();
    
    return db.participants.find({
      selector: { userId: userId }
    }).$;
  },

  /**
   * Returns an observable for all messages
   */
  async getMessagesStream$() {
    const db = await getDB();
    return db.messages.find().$;
  },

  /**
   * Returns an observable for all participants
   */
  async getParticipantsStream$() {
    const db = await getDB();
    return db.participants.find().$;
  },

  async sendMessage(message: { 
    id?: string; 
    conversationId: string; 
    senderId: string; 
    content: string; 
    type?: string; 
    attachments?: any[];
    mathMeta?: any;
  }) {
    const db = await getDB();
    let id = message.id || `msg_${Date.now()}`;
    
    // Ensure ID is Appwrite-compliant (at most 36 chars, starts with alphanumeric)
    if (!/^[a-zA-Z0-9]/.test(id)) {
        id = 'm_' + id;
    }
    if (id.length > 36) {
        id = id.substring(0, 36);
    }
    
    const resolvedConversationId = message.conversationId;
    const resolvedSenderId = message.senderId;

    const doc = {
      id,
      conversationId: resolvedConversationId,
      senderId: resolvedSenderId,
      content: message.content,
      type: message.type || 'text',
      createdAt: new Date().toISOString(),
      status: 'pending',
      ip: '0.0.0.0', // Set by server/appwrite, dummy local
      attachments: normalizeAttachments(message.attachments),
      strokes: (message as any).strokes || (message as any).mathMeta?.strokes || [],
      mathMeta: (message as any).mathMeta || null
    };

    try {
      // 1. Insert into RxDB immediately (Optimistic UI) with deep plain object clone
      const rxDoc = await db.messages.insert(toPlainObject(doc));
      
      // 2. Return the local doc with the original id (not RxDB's _id) so UI can track it
      const result = rxDoc.toJSON();
      return { ...result, id: doc.id };
    } catch (err) {
      console.error('Error in sendMessage:', err);
      throw err;
    }
  },

  async upsertConversation(conversation: any) {
    const db = await getDB();
    try {
      // Clean up fields to camelCase
      const clean = {
        id: conversation.id,
        name: conversation.name,
        isGroup: conversation.isGroup || false,
        createdAt: conversation.createdAt || new Date().toISOString(),
        ip: conversation.ip || '0.0.0.0'
      };
      await db.conversations.incrementalUpsert(toPlainObject(clean));
    } catch (err) {
      console.error('Error upserting conversation:', err);
    }
  },

  async upsertParticipant(participant: any) {
    const db = await getDB();
    try {
      // Clean up fields to camelCase
      const clean = {
        id: participant.id,
        conversationId: participant.conversationId,
        userId: participant.userId,
        lastReadAt: participant.lastReadAt || new Date().toISOString(),
        ip: participant.ip || '0.0.0.0',
        isDeleted: participant.isDeleted || false,
        deletedAt: participant.deletedAt || null,
        clearedAt: participant.clearedAt || null,
        lastMessageAt: participant.lastMessageAt || null
      };
      await db.participants.incrementalUpsert(toPlainObject(clean));
    } catch (err) {
      console.error('Error upserting participant:', err);
    }
  },

  async safePatchParticipant(participantId: string, patch: any) {
    const db = await getDB();
    try {
      if (!participantId) return;
      let doc = await db.participants.findOne(participantId).exec();
      if (!doc) {
        doc = await db.participants.findOne({ selector: { id: participantId } }).exec();
      }
      if (!doc) {
        console.warn(`[dbService] Participant not found for safePatchParticipant: ${participantId}`);
        return;
      }
      try {
        await doc.incrementalPatch(patch);
      } catch (err) {
        console.warn(`[dbService] Initial patch failed for ${participantId} due to conflict, retrying with fresh document...`);
        const freshDoc = await db.participants.findOne(participantId).exec() || await db.participants.findOne({ selector: { id: participantId } }).exec();
        if (freshDoc) {
          await freshDoc.incrementalPatch(patch);
        } else {
          throw new Error('Fresh document not found on retry');
        }
      }
    } catch (err) {
      console.error(`[dbService] Error in safePatchParticipant for ${participantId}:`, err);
    }
  },

  async bulkUpsertParticipants(participants: any[]) {
    const db = await getDB();
    try {
      const cleanList = participants.map(p => ({
        id: p.id,
        conversationId: p.conversationId,
        userId: p.userId,
        lastReadAt: p.lastReadAt || new Date().toISOString(),
        ip: p.ip || '0.0.0.0',
        isDeleted: p.isDeleted || false,
        deletedAt: p.deletedAt || null,
        clearedAt: p.clearedAt || null,
        lastMessageAt: p.lastMessageAt || null
      }));
      await db.participants.bulkUpsert(cleanList.map(toPlainObject));
    } catch (err) {
      console.error('Error bulk upserting participants:', err);
    }
  },

  async getParticipants(conversationId: string) {
    const db = await getDB();
    const result = await db.participants.find({
      selector: { conversationId: conversationId }
    }).exec();
    return result.map(doc => doc.toJSON());
  },

  async getMyConversations(userId: string) {
    const db = await getDB();
    console.log('RxDB: getMyConversations for user:', userId);
    // 1. Find all participant records for this user
    const userParticipation = await db.participants.find({
      selector: { userId: userId }
    }).exec();
    
    console.log(`RxDB: Found ${userParticipation.length} participations matches.`);
    if (userParticipation.length === 0) {
      // Try fallback to seeing if we have ANY participants to debug
      const allParts = await db.participants.find().limit(5).exec();
      if (allParts.length > 0) {
        console.log('RxDB Query Debug: Sample participants in DB:', allParts.map(p => ({ u: p.userId, c: p.conversationId })));
      }
      return [];
    }

    let deletedConvoIds: string[] = [];
    try {
      if (typeof localStorage !== 'undefined') {
        deletedConvoIds = JSON.parse(localStorage.getItem('deleted_convos') || '[]');
      }
    } catch (e) {}

    const convoIds: string[] = [];
    for (const p of userParticipation) {
      if (p.isDeleted) continue;
      if (deletedConvoIds.includes(p.conversationId)) continue;
      
      let lastMsgAt = p.lastMessageAt;
      if (!lastMsgAt) {
        // Look up local messages to see if there is any message
        const latestMsg = await db.messages.findOne({
          selector: { conversationId: p.conversationId },
          sort: [{ createdAt: 'desc' }]
        }).exec();
        if (latestMsg) {
          lastMsgAt = latestMsg.createdAt;
          // Dynamically backfill participant to avoid future queries
          try {
            await db.participants.findOne({ selector: { id: p.id } }).update({
              $set: { lastMessageAt: lastMsgAt }
            });
          } catch (err) {}
        }
      }

      if (!lastMsgAt) {
        // Keep newly created conversations (e.g. created in last 5 minutes) so user can send initial messages
        const convoDoc = await db.conversations.findOne({ selector: { id: p.conversationId } }).exec();
        if (convoDoc) {
          const ageMs = Date.now() - new Date(convoDoc.createdAt || Date.now()).getTime();
          if (ageMs > 5 * 60 * 1000) {
            continue;
          }
        } else {
          continue;
        }
      }

      if (p.clearedAt && lastMsgAt) {
        if (new Date(lastMsgAt).getTime() <= new Date(p.clearedAt).getTime()) {
           continue;
        }
      }

      convoIds.push(p.conversationId);
    }
    
    // 2. Fetch the actual conversations
    const result = await db.conversations.find({
      selector: {
        id: { $in: convoIds }
      },
      sort: [{ createdAt: 'desc' }]
    }).exec();
    
    console.log(`RxDB: Found ${result.length} unique conversations.`);
    return result.map(doc => doc.toJSON());
  },

  async bulkUpsertMessages(messages: any[]) {
    const db = await getDB();
    try {
      const ids = messages.map(m => m.id);
      const existingDocs = await db.messages.find({ selector: { id: { $in: ids } } }).exec();
      const existingMap = new Map(existingDocs.map(doc => {
        const json = doc.toJSON();
        return [json.id, json];
      }));
      
      const processedMessages = messages.map(msg => {
        const existing = existingMap.get(msg.id);
        const cleanMsg = {
          id: msg.id,
          conversationId: msg.conversationId,
          senderId: msg.senderId,
          content: msg.content,
          type: msg.type ?? 'text',
          createdAt: msg.createdAt || new Date().toISOString(),
          status: msg.status ?? 'sent',
          ip: msg.ip ?? '0.0.0.0',
          isPinned: msg.isPinned || false,
          attachments: normalizeAttachments(msg.attachments),
          strokes: msg.strokes ?? [],
          mathMeta: msg.mathMeta || null
        };
        if (existing) {
          if (existing.createdAt) {
            cleanMsg.createdAt = existing.createdAt;
          }
          // Preserve strokes if incoming update has none (e.g. from status updates like delivered/read)
          if ((!cleanMsg.strokes || cleanMsg.strokes.length === 0) && existing.strokes && existing.strokes.length > 0) {
            cleanMsg.strokes = existing.strokes;
          }
          // Preserve mathMeta or nested strokes if missing
          if (!cleanMsg.mathMeta && existing.mathMeta) {
            cleanMsg.mathMeta = existing.mathMeta;
          } else if (cleanMsg.mathMeta && (!cleanMsg.mathMeta.strokes || cleanMsg.mathMeta.strokes.length === 0) && existing.mathMeta?.strokes?.length > 0) {
            cleanMsg.mathMeta = {
              ...cleanMsg.mathMeta,
              strokes: existing.mathMeta.strokes,
              ...(existing.mathMeta.annotation_strokes ? { annotation_strokes: existing.mathMeta.annotation_strokes } : {})
            };
          }
        }
        // Ensure cleanMsg.strokes is populated from mathMeta if still empty
        if ((!cleanMsg.strokes || cleanMsg.strokes.length === 0) && cleanMsg.mathMeta?.strokes?.length > 0) {
          cleanMsg.strokes = cleanMsg.mathMeta.strokes;
        }
        return cleanMsg;
      });

      await db.messages.bulkUpsert(processedMessages.map(toPlainObject));
    } catch (err) {
      console.error('Error bulk upserting messages:', err);
    }
  },

  async bulkUpsertConversations(conversations: any[]) {
    const db = await getDB();
    try {
      const cleanList = conversations.map(c => ({
        id: c.id,
        name: c.name,
        isGroup: c.isGroup || false,
        createdAt: c.createdAt || new Date().toISOString(),
        ip: c.ip ?? '0.0.0.0'
      }));
      await db.conversations.bulkUpsert(cleanList.map(toPlainObject));
    } catch (err) {
      console.error('Error bulk upserting conversations:', err);
    }
  },

  async upsertMessage(message: any) {
    const db = await getDB();
    try {
      const existing = await db.messages.findOne(message.id).exec();
      const cleanMsg = {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        content: message.content,
        type: message.type ?? 'text',
        createdAt: message.createdAt || new Date().toISOString(),
        status: message.status ?? 'sent',
        ip: message.ip ?? '0.0.0.0',
        isPinned: message.isPinned || false,
        attachments: normalizeAttachments(message.attachments),
        strokes: message.strokes ?? [],
        mathMeta: message.mathMeta || null
      };
      if (existing) {
        const oldDoc = existing.toJSON();
        if (oldDoc.createdAt) {
          cleanMsg.createdAt = oldDoc.createdAt;
        }
        // Preserve strokes if incoming update has none
        if ((!cleanMsg.strokes || cleanMsg.strokes.length === 0) && oldDoc.strokes && oldDoc.strokes.length > 0) {
          cleanMsg.strokes = oldDoc.strokes;
        }
        // Preserve mathMeta or nested strokes if missing
        if (!cleanMsg.mathMeta && oldDoc.mathMeta) {
          cleanMsg.mathMeta = oldDoc.mathMeta;
        } else if (cleanMsg.mathMeta && (!cleanMsg.mathMeta.strokes || cleanMsg.mathMeta.strokes.length === 0) && oldDoc.mathMeta?.strokes?.length > 0) {
          cleanMsg.mathMeta = {
            ...cleanMsg.mathMeta,
            strokes: oldDoc.mathMeta.strokes,
            ...(oldDoc.mathMeta.annotation_strokes ? { annotation_strokes: oldDoc.mathMeta.annotation_strokes } : {})
          };
        }
      }
      // Ensure cleanMsg.strokes is populated from mathMeta if still empty
      if ((!cleanMsg.strokes || cleanMsg.strokes.length === 0) && cleanMsg.mathMeta?.strokes?.length > 0) {
        cleanMsg.strokes = cleanMsg.mathMeta.strokes;
      }
      await db.messages.incrementalUpsert(toPlainObject(cleanMsg));
    } catch (err) {
      console.error('Error upserting message:', err);
    }
  },

  async markMessageAsRead(messageId: string) {
    const db = await getDB();
    try {
      const doc = await db.messages.findOne(messageId).exec();
      if (doc && doc.status !== 'read') {
        if (doc.deleted) return;
        try {
          await doc.incrementalPatch({ status: 'read' });
        } catch (patchErr: any) {
          if (patchErr.status === 409 || patchErr.code === 'CONFLICT') {
             console.log('RxDB: Read status conflict, ignoring:', messageId);
          } else {
             throw patchErr;
          }
        }
      }
    } catch (err) {
      console.error('Error marking message as read:', err);
    }
  },
  
  async deleteMessage(messageId: string) {
    const db = await getDB();
    try {
      // Robust find: try direct ID first, then selector
      let doc = await db.messages.findOne(messageId).exec();
      if (!doc) {
        doc = await db.messages.findOne({ selector: { id: messageId } }).exec();
      }
      
      if (doc) {
        await safeRemove(doc, async () => {
          return await db.messages.findOne(messageId).exec() || await db.messages.findOne({ selector: { id: messageId } }).exec();
        });
        console.log('RxDB: Message removed successfully (or was already deleted):', messageId);
      } else {
        console.warn('RxDB: Message not found for deletion:', messageId);
      }
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  },

  async deleteConversation(conversationId: string) {
    const db = await getDB();
    try {
      // 1. Remove conversation
      const doc = await db.conversations.findOne(conversationId).exec() || await db.conversations.findOne({ selector: { id: conversationId } }).exec();
      if (doc) {
        await safeRemove(doc, async () => {
          return await db.conversations.findOne(conversationId).exec() || await db.conversations.findOne({ selector: { id: conversationId } }).exec();
        });
        console.log('RxDB: Conversation removed successfully:', conversationId);
      } else {
        console.warn('RxDB: Conversation not found for deletion:', conversationId);
      }
      
      // 2. Remove participants
      const parts = await db.participants.find({ selector: { conversationId: conversationId } }).exec();
      for (const p of parts) {
        await safeRemove(p, async () => {
          return await db.participants.findOne(p.id).exec() || await db.participants.findOne({ selector: { id: p.id } }).exec();
        });
      }
      
      // 3. Remove messages
      const msgs = await db.messages.find({ selector: { conversationId: conversationId } }).exec();
      for (const m of msgs) {
        await safeRemove(m, async () => {
          return await db.messages.findOne(m.id).exec() || await db.messages.findOne({ selector: { id: m.id } }).exec();
        });
      }
    } catch (err) {
      console.error('Error deleting conversation and dependents:', err);
    }
  },

  async toggleMessagePin(messageId: string) {
    const db = await getDB();
    try {
      const doc = await db.messages.findOne(messageId).exec() || await db.messages.findOne({ selector: { id: messageId } }).exec();
      if (doc) {
        if (doc.deleted) return;
        try {
          await doc.incrementalPatch({ isPinned: !doc.isPinned });
        } catch (patchErr: any) {
          if (patchErr.status === 409 || patchErr.code === 'CONFLICT') {
            console.log('RxDB: Pin toggle conflict, ignoring:', messageId);
          } else {
            throw patchErr;
          }
        }
      } else {
        console.warn('RxDB: Message not found for pinning:', messageId);
      }
    } catch (err) {
      console.error('Error toggling pin:', err);
    }
  },

  async upsertProfile(profile: any) {
    const db = await getDB();
    try {
      const userId = profile.userId;
      if (!userId) {
         console.warn('upsertProfile: profile has no userId:', profile);
         return;
      }
      const existing = await db.profiles.findOne(userId).exec();
      const existingData = existing ? existing.toJSON() : {};
      const currentIPs = existingData?.ipAddresses || [];
      const newIPs = profile.ipAddresses || [];
      
      // Merge unique IPs
      const mergedIPs = Array.from(new Set([...currentIPs, ...newIPs]));
      
      const cleanProfile = {
        surname: '',
        lastName: '',
        role: 'student',
        ...existingData,
        ...profile,
        userId,
        ipAddresses: mergedIPs
      };
      delete cleanProfile.user_id; // Clean up old snake_case key if present

      await db.profiles.incrementalUpsert(cleanProfile);
    } catch (err) {
      console.error('Error upserting profile:', err);
    }
  },

  async getProfile(userId: string, remoteFallback = true) {
    const db = await getDB();
    const result = await db.profiles.findOne(userId).exec();
    const localProfile = result ? result.toJSON() : null;

    if (remoteFallback && (!localProfile || !localProfile.bio || !localProfile.avatarUrl || !localProfile.studentClass)) {
      try {
        const { data: remoteProfile } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .or(`user_id.eq.${userId},id.eq.${userId}`)
          .maybeSingle();

        if (remoteProfile) {
          const { authService } = await import('./authService');
          const mergedProfile = {
            ...(localProfile || {}),
            userId: remoteProfile.user_id || remoteProfile.userId || userId,
            fullName: remoteProfile.full_name || remoteProfile.fullName || `${remoteProfile.surname || ''} ${remoteProfile.last_name || ''}`.trim(),
            surname: remoteProfile.surname || (remoteProfile.full_name ? remoteProfile.full_name.split(' ')[0] : (localProfile?.surname || '')),
            lastName: remoteProfile.last_name || remoteProfile.lastName || (remoteProfile.full_name ? remoteProfile.full_name.split(' ').pop() : (localProfile?.lastName || 'User')),
            role: remoteProfile.role || localProfile?.role || 'student',
            school: remoteProfile.school,
            bio: remoteProfile.bio,
            avatarUrl: remoteProfile.avatar_url || remoteProfile.avatarUrl,
            points: remoteProfile.points ?? 0,
            studentClass: remoteProfile.grade_class || remoteProfile.student_class || remoteProfile.studentClass,
            preferredSubjects: remoteProfile.preferred_subjects || remoteProfile.preferredSubjects,
            subjectCombination: remoteProfile.subject_combination || remoteProfile.subjectCombination,
            age: remoteProfile.age,
            house: remoteProfile.house,
            clubs: remoteProfile.clubs,
            isOnline: authService.computeIsOnline(remoteProfile),
            lastSeenAt: remoteProfile.last_seen_at || remoteProfile.lastSeenAt || null,
          };
          // cache locally in background
          dbService.upsertProfile(mergedProfile).catch(e => console.error('bg sync profile err', e));
          return mergedProfile;
        }
      } catch (err: any) {
        console.warn('Background Supabase profile sync failed:', err?.message || err);
      }
    }
    return localProfile;
  },

  async upsertAccount(account: any) {
    const db = await getDB();
    try {
      const clean = {
        userId: account.userId,
        surname: account.surname,
        middleName: account.middleName,
        lastName: account.lastName,
        role: account.role,
        age: account.age,
        country: account.country,
        district: account.district,
        school: account.school,
        class: account.class,
        parentContact: account.parentContact,
        whatsappContact: account.whatsappContact,
        exupCode: account.exupCode,
        ip: account.ip
      };
      await db.accounts.incrementalUpsert(clean);
    } catch (err) {
      console.error('Error upserting account:', err);
    }
  },
  
  async upsertFriendship(friendship: any) {
    const db = await getDB();
    try {
      const clean = {
        id: friendship.id,
        userId: friendship.userId,
        friendId: friendship.friendId,
        status: friendship.status,
        createdAt: friendship.createdAt || new Date().toISOString()
      };
      await db.friendships.incrementalUpsert(clean);
    } catch (err) {
      console.error('Error upserting friendship:', err);
    }
  },

  async bulkUpsertFriendships(friendships: any[]) {
    const db = await getDB();
    try {
      const cleanList = friendships.map(f => ({
        id: f.id,
        userId: f.userId,
        friendId: f.friendId,
        status: f.status,
        createdAt: f.createdAt || new Date().toISOString()
      }));
      await db.friendships.bulkUpsert(cleanList);
    } catch (err) {
      console.error('Error bulk upserting friendships:', err);
    }
  },

  async getLocalFriendships(userId: string) {
    const db = await getDB();
    const results = await db.friendships.find({
      selector: {
        $or: [
          { userId: userId },
          { friendId: userId }
        ]
      }
    }).exec();
    return results.map(doc => doc.toJSON());
  },

  async getLocalAcceptedFriendIds(userId: string) {
    const db = await getDB();
    const results = await db.friendships.find({
      selector: {
        $and: [
          { status: 'Accepted' },
          { $or: [{ userId: userId }, { friendId: userId }] }
        ]
      }
    }).exec();
    
    const ids = new Set<string>();
    results.forEach(doc => {
      const data = doc.toJSON();
      if (data.userId !== userId) ids.add(data.userId);
      if (data.friendId !== userId) ids.add(data.friendId);
    });
    return Array.from(ids);
  },

  async getLocalPendingRequestIds(userId: string) {
    const db = await getDB();
    const results = await db.friendships.find({
      selector: {
        userId: userId,
        status: 'Pending'
      }
    }).exec();
    return results.map(doc => doc.toJSON().friendId);
  },

  async getLocalIncomingPendingRequests(userId: string) {
    const db = await getDB();
    const results = await db.friendships.find({
      selector: {
        friendId: userId,
        status: 'Pending'
      }
    }).exec();
    return results.map(doc => doc.toJSON());
  },

  async deleteLocalFriendship(id: string) {
    const db = await getDB();
    try {
      const doc = await db.friendships.findOne(id).exec();
      if (doc) {
        await safeRemove(doc, async () => {
          return await db.friendships.findOne(id).exec();
        });
      }
    } catch (err) {
      console.error('Error deleting local friendship:', err);
    }
  }
};
