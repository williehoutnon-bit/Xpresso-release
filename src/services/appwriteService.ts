import { supabase, supabaseAdmin } from './supabaseService';

export class AppwriteException extends Error {
  code: number;
  status: number;
  constructor(message: string, code: number) {
    super(message);
    this.name = 'AppwriteException';
    this.code = code;
    this.status = code;
  }
}

export const isAppwriteConfigured = true;

export function disableAppwrite() {
  console.warn('Appwrite has been disabled dynamically (e.g. project paused).');
}

export const APPWRITE_CONFIG = {
  databaseId: 'supabase-mock-db',
  collections: {
    annotations: 'annotations',
    conversations: 'conversations',
    messages: 'messages',
    participants: 'participants',
    messageStatus: 'messageStatus',
    attachments: 'attachments',
    profiles: 'profiles',
    accounts: 'accounts',
    friendships: 'friendships',
    schools: 'schools',
    classes: 'classes',
    calls: 'calls',
    signals: 'signals',
    math_elements: 'math_elements',
    element_operations: 'element_operations',
    canvas_sessions: 'canvas_sessions',
    presence: 'presence',
  },
  bucketId: 'chat_media'
};

export const isStorageConfigured = true;

export class ID {
  static unique() { return 'unique()'; }
  static custom(id: string) { return id; }
}

export class Query {
  static equal(attribute: string, value: any) { return { method: 'eq', attribute, value }; }
  static notEqual(attribute: string, value: any) { return { method: 'neq', attribute, value }; }
  static lessThan(attribute: string, value: any) { return { method: 'lt', attribute, value }; }
  static lessThanEqual(attribute: string, value: any) { return { method: 'lte', attribute, value }; }
  static greaterThan(attribute: string, value: any) { return { method: 'gt', attribute, value }; }
  static greaterThanEqual(attribute: string, value: any) { return { method: 'gte', attribute, value }; }
  static isNull(attribute: string) { return { method: 'is', attribute, value: null }; }
  static isNotNull(attribute: string) { return { method: 'not.is', attribute, value: null }; }
  static search(attribute: string, value: string) { return { method: 'ilike', attribute, value: `%${value}%` }; }
  static orderDesc(attribute: string) { return { method: 'order', attribute, options: { ascending: false } }; }
  static orderAsc(attribute: string) { return { method: 'order', attribute, options: { ascending: true } }; }
  static limit(limit: number) { return { method: 'limit', value: limit }; }
  static offset(offset: number) { return { method: 'offset', value: offset }; }
  static or(queries: any[]) { return { method: 'or', queries }; }
  static and(queries: any[]) { return { method: 'and', queries }; }
  static contains(attribute: string, value: any) { return { method: 'contains', attribute, value }; }
}

export class Permission {
  static read(role: any) { return `read:${role}`; }
  static write(role: any) { return `write:${role}`; }
  static update(role: any) { return `update:${role}`; }
  static delete(role: any) { return `delete:${role}`; }
}

export class Role {
  static any() { return '*'; }
  static user(id: string) { return `user:${id}`; }
  static users() { return 'users'; }
}

export class Client {
  setEndpoint() { return this; }
  setProject() { return this; }
  subscribe(channel: string, callback: (response: any) => void) {
      // Very basic translation. E.g "databases.DATABASE_ID.collections.COLLECTION_ID.documents"
      let table = 'messages'; // fallback
      const parts = channel.split('.');
      if (parts.length >= 4 && parts[2] === 'collections') {
          table = parts[3];
      }

      if (table === 'profiles') {
          // Subscribe to both profiles and presence
          const subProfiles = supabaseAdmin.channel(`public:profiles:${Math.random().toString(36).substring(7)}`).on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'profiles' },
              async (payload: any) => {
                  let action = 'create';
                  if (payload.eventType === 'UPDATE') action = 'update';
                  if (payload.eventType === 'DELETE') action = 'delete';

                  const pData = payload.new || payload.old || {};
                  const uId = pData.user_id || pData.userId || pData.id;
                  if (!uId) return;

                  const eventsList = [
                      `databases.*.collections.profiles.documents.*`,
                      `databases.*.collections.profiles.documents.*.${action}`,
                      `databases.*.collections.*.documents.*.${action}`,
                      `databases.supabase-mock-db.collections.profiles.documents.${uId}.${action}`,
                      `databases.supabase-mock-db.collections.profiles.documents.${uId}`
                  ];

                  try {
                    const { data: pres } = await supabaseAdmin.from('presence').select('*').eq('user_id', uId).maybeSingle();
                    const merged = { 
                       ...pData, 
                       last_seen_at: pres?.last_seen_at !== undefined ? pres.last_seen_at : (pData.last_seen_at || pData.lastSeenAt || null),
                       lastSeenAt: pres?.last_seen_at !== undefined ? pres.last_seen_at : (pData.lastSeenAt || pData.last_seen_at || null)
                    };

                    // Sync remote update to local RxDB in background
                    try {
                       const { dbService } = await import('./dbService');
                       const localProfile: any = { userId: uId };
                       
                       if (pData.surname !== undefined) localProfile.surname = pData.surname;
                       if (pData.last_name !== undefined) localProfile.lastName = pData.last_name;
                       if (pData.lastName !== undefined) localProfile.lastName = pData.lastName;
                       if (pData.full_name !== undefined) localProfile.fullName = pData.full_name;
                       if (pData.fullName !== undefined) localProfile.fullName = pData.fullName;
                       if (pData.role !== undefined) localProfile.role = pData.role;
                       if (pData.school !== undefined) localProfile.school = pData.school;
                       if (pData.grade_class !== undefined) localProfile.studentClass = pData.grade_class;
                       if (pData.studentClass !== undefined) localProfile.studentClass = pData.studentClass;
                       if (pData.bio !== undefined) localProfile.bio = pData.bio;
                       if (pData.avatar_url !== undefined) localProfile.avatarUrl = pData.avatar_url;
                       if (pData.avatarUrl !== undefined) localProfile.avatarUrl = pData.avatarUrl;
                       if (pData.age !== undefined) localProfile.age = typeof pData.age === 'string' ? parseInt(pData.age, 10) : pData.age;
                       if (pData.country !== undefined) localProfile.country = pData.country;
                       if (pData.district !== undefined) localProfile.district = pData.district;
                       if (pData.whatsapp_contact !== undefined) localProfile.whatsappContact = pData.whatsapp_contact;
                       if (pData.whatsappContact !== undefined) localProfile.whatsappContact = pData.whatsappContact;
                       if (pData.parent_contact !== undefined) localProfile.parentContact = pData.parent_contact;
                       if (pData.parentContact !== undefined) localProfile.parentContact = pData.parentContact;
                       if (pData.exup_code !== undefined) localProfile.exupCode = pData.exup_code;
                       if (pData.exupCode !== undefined) localProfile.exupCode = pData.exupCode;
                       if (pData.points !== undefined) localProfile.points = pData.points;
                       if (pData.house !== undefined) localProfile.house = pData.house;
                       if (pData.subject_combination !== undefined) localProfile.subjectCombination = pData.subject_combination;
                       if (pData.subjectCombination !== undefined) localProfile.subjectCombination = pData.subjectCombination;
                       
                       if (pData.preferred_subjects !== undefined) {
                         localProfile.preferredSubjects = Array.isArray(pData.preferred_subjects) ? pData.preferred_subjects.join(', ') : pData.preferred_subjects;
                       }
                       if (pData.clubs !== undefined) {
                         localProfile.clubs = Array.isArray(pData.clubs) ? pData.clubs.join(', ') : pData.clubs;
                       }
                       
                       localProfile.lastSeenAt = merged.lastSeenAt;

                       await dbService.upsertProfile(localProfile);
                    } catch (syncErr) {
                       console.warn('[Realtime SubProfiles] Local sync failed:', syncErr);
                    }

                    callback({
                        events: eventsList,
                        payload: mapOutputDocument(merged)
                    });
                  } catch (e) {
                    callback({
                        events: eventsList,
                        payload: mapOutputDocument(pData)
                    });
                  }
              }
          ).subscribe();

          const subPresence = supabaseAdmin.channel(`public:presence:${Math.random().toString(36).substring(7)}`).on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'presence' },
              async (payload: any) => {
                  let action = 'create';
                  if (payload.eventType === 'UPDATE') action = 'update';
                  if (payload.eventType === 'DELETE') action = 'delete';

                  const pres = payload.new || payload.old || {};
                  const uId = pres.user_id;
                  if (!uId) return;
                  
                  const eventsList = [
                      `databases.*.collections.profiles.documents.*`,
                      `databases.*.collections.profiles.documents.*.${action}`,
                      `databases.*.collections.*.documents.*.${action}`,
                      `databases.supabase-mock-db.collections.profiles.documents.${uId}.${action}`,
                      `databases.supabase-mock-db.collections.profiles.documents.${uId}`
                  ];

                  try {
                    const { data: prof } = await supabaseAdmin.from('profiles').select('*').eq('user_id', uId).maybeSingle();
                    if (prof) {
                       const merged = { 
                          ...prof, 
                          last_seen_at: pres.last_seen_at || null,
                          lastSeenAt: pres.last_seen_at || null
                       };

                       try {
                          const { dbService } = await import('./dbService');
                          const localProfile: any = { userId: uId };
                          
                          if (prof.surname !== undefined) localProfile.surname = prof.surname;
                          if (prof.last_name !== undefined) localProfile.lastName = prof.last_name;
                          if (prof.full_name !== undefined) localProfile.fullName = prof.full_name;
                          if (prof.role !== undefined) localProfile.role = prof.role;
                          if (prof.school !== undefined) localProfile.school = prof.school;
                          if (prof.grade_class !== undefined) localProfile.studentClass = prof.grade_class;
                          if (prof.bio !== undefined) localProfile.bio = prof.bio;
                          if (prof.avatar_url !== undefined) localProfile.avatarUrl = prof.avatar_url;
                          if (prof.age !== undefined) localProfile.age = typeof prof.age === 'string' ? parseInt(prof.age, 10) : prof.age;
                          if (prof.country !== undefined) localProfile.country = prof.country;
                          if (prof.district !== undefined) localProfile.district = prof.district;
                          if (prof.whatsapp_contact !== undefined) localProfile.whatsappContact = prof.whatsapp_contact;
                          if (prof.parent_contact !== undefined) localProfile.parentContact = prof.parent_contact;
                          if (prof.exup_code !== undefined) localProfile.exupCode = prof.exup_code;
                          if (prof.points !== undefined) localProfile.points = prof.points;
                          if (prof.house !== undefined) localProfile.house = prof.house;
                          if (prof.subject_combination !== undefined) localProfile.subjectCombination = prof.subject_combination;
                          
                          if (prof.preferred_subjects !== undefined) {
                            localProfile.preferredSubjects = Array.isArray(prof.preferred_subjects) ? prof.preferred_subjects.join(', ') : prof.preferred_subjects;
                          }
                          if (prof.clubs !== undefined) {
                            localProfile.clubs = Array.isArray(prof.clubs) ? prof.clubs.join(', ') : prof.clubs;
                          }
                          
                          localProfile.lastSeenAt = merged.lastSeenAt;

                          await dbService.upsertProfile(localProfile);
                       } catch (syncErr) {
                          console.warn('[Realtime SubPresence] Local sync failed:', syncErr);
                       }

                       callback({
                           events: eventsList,
                           payload: mapOutputDocument(merged)
                       });
                    } else {
                       try {
                          const { dbService } = await import('./dbService');
                          await dbService.upsertProfile({
                             userId: uId,
                             lastSeenAt: pres.last_seen_at || null
                          });
                       } catch (syncErr) {
                          console.warn('[Realtime SubPresence Skeletal] Local sync failed:', syncErr);
                       }

                       callback({
                           events: eventsList,
                           payload: mapOutputDocument({ userId: uId, lastSeenAt: pres.last_seen_at })
                       });
                    }
                  } catch (e) {
                      try {
                         const { dbService } = await import('./dbService');
                         await dbService.upsertProfile({
                            userId: uId,
                            lastSeenAt: pres.last_seen_at || null
                         });
                      } catch (syncErr) {
                         console.warn('[Realtime SubPresence Fallback] Local sync failed:', syncErr);
                      }

                      callback({
                          events: eventsList,
                          payload: mapOutputDocument({ userId: uId, last_seen_at: pres.last_seen_at })
                      });
                  }
              }
          ).subscribe();
          
          return () => {
              supabaseAdmin.removeChannel(subProfiles);
              supabaseAdmin.removeChannel(subPresence);
          };
      }

      const sub = supabaseAdmin.channel(`public:${table}:${Math.random().toString(36).substring(7)}`).on(
          'postgres_changes',
          { event: '*', schema: 'public', table: table },
          (payload: any) => {
              let action = 'create';
              if (payload.eventType === 'UPDATE') action = 'update';
              if (payload.eventType === 'DELETE') action = 'delete';

              const doc = payload.new || payload.old || {};
              const docId = doc.id || doc.userId || doc.user_id || '';

              const eventsList = [
                  `databases.*.collections.${table}.documents.*`,
                  `databases.*.collections.${table}.documents.*.${action}`,
                  `databases.*.collections.*.documents.*.${action}`,
                  `databases.supabase-mock-db.collections.${table}.documents.${docId}.${action}`,
                  `databases.supabase-mock-db.collections.${table}.documents.${docId}`
              ];

              callback({
                  events: eventsList,
                  payload: mapOutputDocument(doc)
              });
          }
      ).subscribe();
      
      return () => {
          supabaseAdmin.removeChannel(sub);
      };
  }
}
export const client = new Client();

const attributeMap: Record<string, string> = {
  "$id": "id",
  "userId": "user_id",
  "friendId": "friend_id",
  "$updatedAt": "updated_at",
  "updatedAt": "updated_at",
  "$createdAt": "created_at",
  "createdAt": "created_at",
  "conversationId": "conversation_id",
  "messageId": "message_id",
  "lastMessageId": "last_message_id",
  "lastMessageAt": "last_message_at",
  "replyTo": "reply_to",
  "senderId": "sender_id",
  "status": "status",
  "isPinned": "is_pinned",
  "attachments": "attachments",
  "mathMeta": "math_meta",
  "messageType": "message_type",
  "fullName": "full_name",
  "exupCode": "exup_code",
  "parentContact": "parent_contact",
  "whatsappContact": "whatsapp_contact",
  "studentClass": "grade_class",
  "lastName": "last_name",
  "middleName": "middle_name",
  "avatarUrl": "avatar_url",
  "isGroup": "is_group",
  "hasUnreads": "has_unreads",
  "isOnline": "is_online",
  "lastSeenAt": "last_seen_at",
  "preferredSubjects": "preferred_subjects",
  "subjectCombination": "subject_combination",
  "threadId": "thread_id",
  "parentSessionId": "parent_session_id",
  "createdBy": "created_by",
  "chalkHolder": "chalk_holder",
  "chalkHolderName": "chalk_holder_name",
  "chalkAcquiredAt": "chalk_acquired_at",
  "activeUsers": "active_users",
  "isChalkHolder": "is_chalk_holder",
  "displayName": "display_name",
  "avatarColor": "avatar_color",
  "editChain": "edit_chain",
  "operationCount": "operation_count",
  "sessionId": "session_id",
  "elementId": "element_id",
  "operationType": "operation_type",
  "userName": "user_name",
  "previousPatch": "previous_patch",
  "sessionVersion": "session_version",
  "zIndex": "z_index",
  "lastEditedBy": "last_edited_by",
  "lastEditedAt": "last_edited_at",
  "isDeleted": "is_deleted",
  "lastReadAt": "last_read_at",
  "deletedAt": "deleted_at",
  "isAnnotation": "is_annotation",
  "annotationTargetId": "annotation_target_id",
  "lockedBy": "locked_by",
  "lockedAt": "locked_at"
};

const fallbackAttributeMap: Record<string, string> = {
  "$updatedAt": "updatedAt",
  "$createdAt": "createdAt",
};

export function toUuid(id: any): string {
  if (!id) return '';
  const str = String(id).trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const looseUuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (uuidRegex.test(str) || looseUuidRegex.test(str)) {
    return str;
  }

  let h1 = 0x12345678, h2 = 0x23456789, h3 = 0x3456789a, h4 = 0x456789ab;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    h1 = (h1 * 33) ^ char;
    h2 = (h2 * 37) ^ char;
    h3 = (h3 * 41) ^ char;
    h4 = (h4 * 43) ^ char;
  }
  
  const hex1 = Math.abs(h1).toString(16).padStart(8, '0');
  const hex2 = Math.abs(h2).toString(16).padStart(8, '0');
  const hex3 = Math.abs(h3).toString(16).padStart(8, '0');
  const hex4 = Math.abs(h4).toString(16).padStart(8, '0');
  
  const combined = (hex1 + hex2 + hex3 + hex4).substring(0, 32);
  
  const part1 = combined.substring(0, 8);
  const part2 = combined.substring(8, 12);
  const part3 = '4' + combined.substring(13, 16);
  const part4 = 'a' + combined.substring(17, 20);
  const part5 = combined.substring(20, 32);
  
  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}

const uuidFields = new Set([
  'id', '$id',
  'user_id', 'userId',
  'friend_id', 'friendId',
  'conversation_id', 'conversationId',
  'sender_id', 'senderId',
  'message_id', 'messageId',
  'reply_to', 'replyTo'
]);

export function cleanUuidValue(field: string, val: any): any {
  if (!uuidFields.has(field)) return val;
  if (val === null || val === undefined) return val;
  if (Array.isArray(val)) {
    return val.map((v: any) => (typeof v === 'string' ? toUuid(v) : v));
  }
  if (typeof val === 'string') {
    return toUuid(val);
  }
  return val;
}

function buildLogicString(q: any, mapping: Record<string, string>): string {
  if (!q) return '';
  if (q.method === 'and') {
    return `and(${q.queries.map((subQ: any) => buildLogicString(subQ, mapping)).filter(Boolean).join(',')})`;
  }
  if (q.method === 'or') {
    return `or(${q.queries.map((subQ: any) => buildLogicString(subQ, mapping)).filter(Boolean).join(',')})`;
  }
  
  const attr = mapping[q.attribute] || q.attribute;
  const rawFieldName = q.attribute;
  
  let method = q.method;
  let val = q.value;
  
  val = cleanUuidValue(rawFieldName, val);
  val = cleanUuidValue(attr, val);

  if (method === 'eq' && Array.isArray(val)) {
    method = 'in';
  } else if (method === 'neq' && Array.isArray(val)) {
    method = 'not.in';
  }
  
  if (Array.isArray(val)) {
    val = `(${val.map((v: any) => String(v).replace(/,/g, '\\,')).join(',')})`;
  } else if (val === null) {
    val = 'null';
  } else {
    val = String(val);
  }
  
  return `${attr}.${method}.${val}`;
}

export function getCollectionAttributeMap(collectionId?: string): Record<string, string> {
  const map = { ...attributeMap };
  if (collectionId === 'conversations') {
    map['name'] = 'title';
  }
  return map;
}

function mapOutputDocument(d: any, collectionId?: string) {
   const mapped = { ...d };
   const compMap = getCollectionAttributeMap(collectionId);
   for (const key of Object.keys(compMap)) {
      const snakeKey = compMap[key];
      if (d[snakeKey] !== undefined) {
         mapped[key] = d[snakeKey];
      }
   }
   mapped.$id = d.id || d.userId || d.user_id || d._id;
   mapped.$createdAt = d.createdAt || d.created_at || new Date().toISOString();
   mapped.$updatedAt = d.updatedAt || d.updated_at || new Date().toISOString();
   
   if (d.surname || d.last_name || d.lastName) {
      mapped.fullName = `${d.surname || ''} ${d.last_name || d.lastName || ''}`.trim();
   }

   // Ensure mathMeta / math_meta is safely parsed if returned as string from JSONB
   if (mapped.mathMeta && typeof mapped.mathMeta === 'string') {
      try {
         mapped.mathMeta = JSON.parse(mapped.mathMeta);
      } catch (e) {}
   }
   if (mapped.math_meta && typeof mapped.math_meta === 'string') {
      try {
         mapped.math_meta = JSON.parse(mapped.math_meta);
      } catch (e) {}
   }

   // If strokes is not directly in Supabase table, extract from mathMeta or math_meta
   if ((!mapped.strokes || mapped.strokes.length === 0) && mapped.mathMeta?.strokes) {
      mapped.strokes = mapped.mathMeta.strokes;
   } else if ((!mapped.strokes || mapped.strokes.length === 0) && mapped.math_meta?.strokes) {
      mapped.strokes = mapped.math_meta.strokes;
   }

   return mapped;
}

function applyQueries(builder: any, queries: any[] = [], mapping: Record<string, string> = attributeMap) {
  if (!builder) return builder;
  for (const q of queries) {
    if (q.method === 'limit') {
      builder = builder.limit(q.value);
    } else if (q.method === 'offset') {
      builder = builder.range(q.value, q.value + 1000);
    } else if (q.method === 'or') {
      const orString = q.queries.map((subQ: any) => buildLogicString(subQ, mapping)).filter(Boolean).join(',');
      builder = builder.or(orString);
    } else if (q.method === 'and') {
       // Ignore or handle recursion if top-level and needed
    } else if (q.method === 'contains') {
      const attr = mapping[q.attribute] || q.attribute;
      let val = cleanUuidValue(q.attribute, q.value);
      val = cleanUuidValue(attr, val);
      if (Array.isArray(val)) {
        builder = builder.in(attr, val);
      } else {
        builder = builder.ilike(attr, `%${val}%`);
      }
    } else {
      const attr = mapping[q.attribute] || q.attribute;
      const rawFieldName = q.attribute;
      let val = cleanUuidValue(rawFieldName, q.value);
      val = cleanUuidValue(attr, val);

      if (q.method === 'order') builder = builder.order(attr, q.options);
      else if (q.method === 'ilike') builder = builder.ilike(attr, val);
      else if (q.method === 'is' || q.method === 'not.is') builder = builder.is(attr, val);
      else if (q.method === 'eq' && Array.isArray(val)) builder = builder.in(attr, val);
      else if (q.method === 'neq' && Array.isArray(val)) builder = builder.not('in', attr, val);
      else builder = builder[q.method](attr, val);
    }
  }
  return builder;
}

function hasInvalidValues(queries: any[] = []): boolean {
  for (const q of queries) {
    if (!q) continue;
    if (q.method === 'or' || q.method === 'and') {
      if (q.queries && hasInvalidValues(q.queries)) return true;
    }
    if ('value' in q) {
      if (q.value === undefined || q.value === 'undefined' || q.value === '') return true;
      if (Array.isArray(q.value) && q.value.some((v: any) => v === undefined || v === 'undefined' || v === '')) return true;
    }
  }
  return false;
}

function parseMissingColumn(errorMessage: string): string | null {
  // 1. "Could not find the 'invalid_col' column of 'messages' in the schema cache"
  let match = errorMessage.match(/Could not find the '([^']+)' column/i);
  if (match) return match[1];

  // 2. "column \"invalid_col\" of relation \"messages\" does not exist"
  match = errorMessage.match(/column "([^"]+)" of relation"?[a-zA-Z0-9_-]*"? does not exist/i);
  if (match) return match[1];
  match = errorMessage.match(/column "([^"]+)" of relation /i);
  if (match) return match[1];

  // 3. "column \"invalid_col\" does not exist"
  match = errorMessage.match(/column "([^"]+)" does not exist/i);
  if (match) return match[1];

  return null;
}

export class Databases {
  async listDocuments(databaseId: string, collectionId: string, queries: any[] = []) {
    if (hasInvalidValues(queries)) {
      console.warn(`[Supabase Polyfill] Query with undefined or empty value intercepted for collection ${collectionId}. Returning empty results.`);
      return { total: 0, documents: [] };
    }

    let builder = supabaseAdmin.from(collectionId).select('*');
    builder = applyQueries(builder, queries, getCollectionAttributeMap(collectionId));
    
    let { data, error } = await builder;
    
    if (error && error.message.includes('does not exist')) {
      console.warn(`[Supabase Polyfill] Column missing using snake_case for ${collectionId}. Retrying with camelCase... original error: ${error.message}`);
      let retryBuilder = supabaseAdmin.from(collectionId).select('*');
      retryBuilder = applyQueries(retryBuilder, queries, fallbackAttributeMap);
      const retryRes = await retryBuilder;
      if (retryRes.error) {
        error = new Error(`Original: ${error.message} | Fallback: ${retryRes.error.message}`) as any;
      } else {
        error = null;
        data = retryRes.data;
      }
    }

    if (error) {
       if (error.message.includes('schema cache') || error.message.includes('not find the table') || (error.message.includes('relation') && error.message.includes('does not exist'))) {
         console.warn(`[Supabase Polyfill] Table ${collectionId} does not exist in schema. Returning empty results.`);
         return { total: 0, documents: [] };
       }
       if (error.message.includes('Failed to fetch')) {
         console.warn(`[Supabase Polyfill] Network error in listDocuments (${collectionId}). Assuming offline, returning empty.`);
         return { total: 0, documents: [] };
       }
       console.error(`Supabase Polyfill Error in listDocuments (${collectionId}):`, error.message);
       throw new Error(error.message);
    }

    if (collectionId === 'profiles' && data && data.length > 0) {
      try {
        const userIds = data.map((d: any) => d.user_id || d.userId).filter(Boolean);
        if (userIds.length > 0) {
          const { data: presenceData } = await supabaseAdmin.from('presence')
            .select('*')
            .in('user_id', userIds);
          
          if (presenceData && presenceData.length > 0) {
            const presenceMap = new Map(presenceData.map((p: any) => [p.user_id, p]));
            data = data.map((d: any) => {
              const uId = d.user_id || d.userId;
              const p = presenceMap.get(uId);
              if (p) {
                return {
                  ...d,
                  is_online: p.is_online,
                  last_seen_at: p.last_seen_at,
                  isOnline: p.is_online,
                  lastSeenAt: p.last_seen_at
                };
              }
              return d;
            });
          }
        }
      } catch (err) {
        console.warn("[appwriteService] Error fetching presence for profiles list:", err);
      }
    }

    return {
      total: data?.length || 0,
      documents: (data || []).map((d: any) => mapOutputDocument(d, collectionId))
    };
  }

  async createDocument(databaseId: string, collectionId: string, documentId: string, data: any, permissions?: any[]) {
    let finalDocId = documentId;
    if (finalDocId && finalDocId !== 'unique()') {
      finalDocId = toUuid(finalDocId);
    }

    if (data.$id) delete data.$id;
    if (finalDocId && finalDocId !== 'unique()') {
      data.id = finalDocId;
    }
    
    const compMap = getCollectionAttributeMap(collectionId);
    let mappedData = { ...data };
    for (const key of Object.keys(mappedData)) {
      mappedData[key] = cleanUuidValue(key, mappedData[key]);
      
      if (compMap[key] && compMap[key] !== key) {
        mappedData[compMap[key]] = cleanUuidValue(compMap[key], mappedData[key]);
        delete mappedData[key];
      }
    }

    if (mappedData.strokes && Array.isArray(mappedData.strokes) && mappedData.strokes.length > 0) {
      if (!mappedData.math_meta) {
        mappedData.math_meta = { strokes: mappedData.strokes };
      } else if (typeof mappedData.math_meta === 'object' && !mappedData.math_meta.strokes) {
        mappedData.math_meta.strokes = mappedData.strokes;
      }
    }
    if (collectionId === 'messages') {
      delete mappedData.strokes;
    }

    if (mappedData.math_meta && typeof mappedData.math_meta === 'object') {
      mappedData.math_meta = JSON.stringify(mappedData.math_meta);
    }

    let resultData = null;
    let error = null;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      let { data: resData, error: insertError } = await supabaseAdmin.from(collectionId).insert([mappedData]).select().maybeSingle();
      
      if (insertError) {
         // Check if a column does not exist
         const missingCol = parseMissingColumn(insertError.message);
         if (missingCol) {
            console.warn(`[Supabase Polyfill] Stripping missing column '${missingCol}' from ${collectionId} creation payload.`);
            delete mappedData[missingCol];
            for (const origKey of Object.keys(data)) {
               if (compMap[origKey] === missingCol || origKey === missingCol) {
                  delete data[origKey];
               }
            }
            attempts++;
            continue;
         }

         // 1. Foreign Key Constraint - conversation_id
         if (insertError.message.includes('foreign key constraint') && insertError.message.includes('conversation_id')) {
            const convoId = mappedData.conversation_id;
            if (convoId) {
               console.warn(`[Supabase Polyfill] Foreign key violation on ${collectionId} (missing conversation ${convoId}). Self-healing by creating placeholder...`);
               await supabaseAdmin.from('conversations').insert([{
                  id: convoId,
                  name: 'Direct Chat',
                  is_group: false,
                  type: 'direct',
                  ip: '0.0.0.0'
               }]).select().maybeSingle();
               
               attempts++;
               continue; // Retry insert
            }
         }
         
         // 2. Foreign Key Constraint - reply_to
         if (insertError.message.includes('foreign key constraint') && insertError.message.includes('reply_to')) {
            console.warn(`[Supabase Polyfill] Foreign key violation on reply_to. Stripping reply_to and retrying...`);
            delete mappedData.reply_to;
            attempts++;
            continue;
         }
      }

      resultData = resData;
      error = insertError;
      break;
    }

    if (error) {
       if (error.message.includes('schema cache') || error.message.includes('not find the table') || (error.message.includes('relation') && error.message.includes('does not exist') && !error.message.toLowerCase().includes('column'))) {
         console.warn(`[Supabase Polyfill] Table ${collectionId} does not exist. Creating mock document.`);
         return mapOutputDocument({ ...data, id: finalDocId !== 'unique()' ? finalDocId : 'mock-doc-id' }, collectionId);
       }
       if (error.message.includes('foreign key constraint')) {
          console.warn(`[Supabase Polyfill] Foreign key constraint violated in ${collectionId}: ${error.message}. Simulating successful creation.`);
          return mapOutputDocument({ ...data, id: finalDocId !== 'unique()' ? finalDocId : 'mock-doc-id' }, collectionId);
       }
       if (error.code === '23505' || error.message.includes('duplicate key') || error.message.includes('already exists')) {
         throw new AppwriteException(`Document already exists in ${collectionId} with ID ${documentId}`, 409);
       }
       if (error.message.includes('Failed to fetch')) {
         console.warn(`[Supabase Polyfill] Network error in createDocument (${collectionId}). Assuming offline.`);
         // Silently return a mock result instead of throwing code 0 to avoid global error toasts for common network events
         return mapOutputDocument({ ...data, id: finalDocId }, collectionId);
       }
       console.error(`Supabase Polyfill Error in createDocument (${collectionId}):`, error.message);
       throw new AppwriteException(`[Supabase Error] ${error.message}`, 500);
    }
    
    const finalResult = resultData || mappedData;
    return mapOutputDocument({ ...data, ...finalResult, $id: finalDocId !== 'unique()' ? finalDocId : undefined }, collectionId);
  }

  async updateDocument(databaseId: string, collectionId: string, documentId: string, data: any, permissions?: any[]) {
    delete data.$id;
    delete data.$createdAt;
    delete data.$updatedAt;
    delete data.$permissions;
    delete data.$databaseId;
    delete data.$collectionId;
    
    const finalDocId = toUuid(documentId);

    const compMap = getCollectionAttributeMap(collectionId);
    let mappedData = { ...data };
    for (const key of Object.keys(mappedData)) {
      mappedData[key] = cleanUuidValue(key, mappedData[key]);
      
      if (compMap[key] && compMap[key] !== key) {
        mappedData[compMap[key]] = cleanUuidValue(compMap[key], mappedData[key]);
        delete mappedData[key];
      }
    }
    
    if (mappedData.strokes && Array.isArray(mappedData.strokes) && mappedData.strokes.length > 0) {
      if (!mappedData.math_meta) {
        mappedData.math_meta = { strokes: mappedData.strokes };
      } else if (typeof mappedData.math_meta === 'object' && !mappedData.math_meta.strokes) {
        mappedData.math_meta.strokes = mappedData.strokes;
      }
    }
    if (collectionId === 'messages') {
      delete mappedData.strokes;
    }

    if (mappedData.math_meta && typeof mappedData.math_meta === 'object') {
      mappedData.math_meta = JSON.stringify(mappedData.math_meta);
    }
    
    let idCol = 'id';
    if (collectionId === 'profiles' || collectionId === 'accounts') idCol = 'user_id';
    
    let resultData = null;
    let error = null;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      let { data: resData, error: updateError } = await supabaseAdmin.from(collectionId).update(mappedData).eq(idCol, finalDocId).select().maybeSingle();
      
      if (updateError) {
         const missingCol = parseMissingColumn(updateError.message);
         if (missingCol) {
            console.warn(`[Supabase Polyfill] Stripping missing column '${missingCol}' from ${collectionId} update payload.`);
            delete mappedData[missingCol];
            for (const origKey of Object.keys(data)) {
               if (compMap[origKey] === missingCol || origKey === missingCol) {
                  delete data[origKey];
               }
            }
            attempts++;
            continue;
         }

         if (updateError.message.includes('foreign key constraint') && updateError.message.includes('conversation_id')) {
            const convoId = mappedData.conversation_id;
            if (convoId) {
               console.warn(`[Supabase Polyfill] Foreign key violation on update ${collectionId} (missing conversation ${convoId}). Self-healing...`);
               await supabaseAdmin.from('conversations').insert([{
                  id: convoId,
                  name: 'Direct Chat',
                  is_group: false,
                  type: 'direct',
                  ip: '0.0.0.0'
               }]).select().maybeSingle();
               
               attempts++;
               continue; // Retry update
            }
         }
      }

      resultData = resData;
      error = updateError;
      break;
    }

    if (error) {
       if (error.message.includes('schema cache') || error.message.includes('not find the table') || (error.message.includes('relation') && error.message.includes('does not exist') && !error.message.toLowerCase().includes('column'))) {
         console.warn(`[Supabase Polyfill] Table ${collectionId} does not exist. Mocking update.`);
         return mapOutputDocument({ ...data, id: finalDocId }, collectionId);
       }
       if (error.message.includes('foreign key constraint')) {
          console.warn(`[Supabase Polyfill] Foreign key constraint violated in update for ${collectionId}: ${error.message}. Simulating successful update.`);
          return mapOutputDocument({ ...data, id: finalDocId }, collectionId);
       }
       if (error.message.includes('Failed to fetch')) {
         console.warn(`[Supabase Polyfill] Network error in updateDocument (${collectionId}). Assuming offline.`);
         // Return current data to simulate local-only update
         return mapOutputDocument({ ...data, id: finalDocId }, collectionId);
       }
       console.error(`Supabase Polyfill Error in updateDocument (${collectionId}):`, error.message);
       throw new AppwriteException(`[Supabase Error] ${error.message}`, 500);
    }

    if (resultData === null) {
       throw new AppwriteException(`Document to update not found in ${collectionId} with ID ${documentId}`, 404);
    }

    return mapOutputDocument({ ...data, ...resultData, $id: finalDocId }, collectionId);
  }

  async deleteDocument(databaseId: string, collectionId: string, documentId: string) {
    const finalDocId = toUuid(documentId);
    let idCol = 'id';
    if (collectionId === 'profiles' || collectionId === 'accounts') idCol = 'user_id';
    
    let { error } = await supabaseAdmin.from(collectionId).delete().eq(idCol, finalDocId);
    
    if (error && error.message.includes('does not exist')) {
       let fallbackIdCol = 'id';
       if (collectionId === 'profiles' || collectionId === 'accounts') fallbackIdCol = 'userId';
       const retryRes = await supabaseAdmin.from(collectionId).delete().eq(fallbackIdCol, finalDocId);
       if (retryRes.error) {
         error = new Error(`Original: ${error.message} | Fallback: ${retryRes.error.message}`) as any;
       } else error = null;
     }
    
    if (error) {
       if (error.message.includes('schema cache') || error.message.includes('not find the table') || (error.message.includes('relation') && error.message.includes('does not exist'))) {
         console.warn(`[Supabase Polyfill] Table ${collectionId} does not exist. Mocking delete.`);
         return {};
       }
       if (error.message.includes('Failed to fetch')) {
         console.warn(`[Supabase Polyfill] Network error in deleteDocument (${collectionId}). Assuming offline.`);
         return {}; // Silent success for local-first deletion
       }
       throw new AppwriteException(error.message, 500);
    }
    return {};
  }
  
  async getDocument(databaseId: string, collectionId: string, documentId: string) {
    if (!documentId || documentId === 'undefined') {
       throw new AppwriteException(`[Supabase Polyfill] getDocument called with invalid documentId for collection ${collectionId}.`, 400);
    }
    
    const finalDocId = toUuid(documentId);
    let idCol = 'id';
    if (collectionId === 'profiles' || collectionId === 'accounts') idCol = 'user_id';
    
    let { data, error } = await supabaseAdmin.from(collectionId).select('*').eq(idCol, finalDocId).maybeSingle();
    
    if (error && error.message.includes('does not exist')) {
       let fallbackIdCol = 'id';
       if (collectionId === 'profiles' || collectionId === 'accounts') fallbackIdCol = 'userId';
       const retryRes = await supabaseAdmin.from(collectionId).select('*').eq(fallbackIdCol, finalDocId).maybeSingle();
       if (retryRes.error) {
         error = new Error(`Original: ${error.message} | Fallback: ${retryRes.error.message}`) as any;
       } else {
         error = null;
         data = retryRes.data;
       }
    }
    
    if (error) {
       if (error.message.includes('schema cache') || error.message.includes('not find the table') || (error.message.includes('relation') && error.message.includes('does not exist'))) {
         console.warn(`[Supabase Polyfill] Table ${collectionId} does not exist. Returning mock/empty document.`);
         return mapOutputDocument({ id: finalDocId, user_id: finalDocId });
       }
       if (error.message.includes('Failed to fetch')) {
         console.warn(`[Supabase Polyfill] Network error in getDocument (${collectionId}). Assuming offline.`);
         // Returning mock/empty instead of throwing to prevent boot-up errors for profile preloads
         return mapOutputDocument({ id: finalDocId, user_id: finalDocId }, collectionId);
       }
       throw new AppwriteException(error.message, 500);
    }

    if (data === null) {
       throw new AppwriteException(`Document not found in ${collectionId} with ID ${documentId}`, 404);
    }

    if (collectionId === 'profiles' && data) {
      try {
        const uId = data.user_id || data.userId || finalDocId;
        const { data: pres } = await supabaseAdmin.from('presence')
          .select('*')
          .eq('user_id', uId)
          .maybeSingle();
        if (pres) {
          data = {
            ...data,
            is_online: pres.is_online,
            last_seen_at: pres.last_seen_at,
            isOnline: pres.is_online,
            lastSeenAt: pres.last_seen_at
          };
        }
      } catch (err) {
        console.warn("[appwriteService] Error fetching single presence for profile:", err);
      }
    }

    return mapOutputDocument({ ...data, $id: finalDocId });
  }

}

export const databases = new Databases();

class Account {
  async get() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw new Error(error.message);
    if (!user) throw new Error("No user");
    
    // Attempt to merge with profile for appwrite-like structure
    const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('user_id', user.id).single();
    return {
      $id: user.id,
      email: user.email,
      name: profile?.fullName || '',
      prefs: profile || {}
    };
  }

  async getSession(id: string) {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) throw new Error("No session");
    return session;
  }
  
  async deleteSession(id: string) {
     await supabase.auth.signOut();
  }
  
  async createEmailPasswordSession(email: string, pass: string) {
     const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
     if (error) throw new Error(error.message);
     return data.session;
  }
  
  async create(id: string, email: string, pass: string, name: string) {
      const { data, error } = await supabase.auth.signUp({
          email,
          password: pass,
          options: { data: { full_name: name } }
      });
      if (error) throw new Error(error.message);
      return { $id: data.user?.id, email, name };
  }
  
  async createJWT() {
      const { data: { session } } = await supabase.auth.getSession();
      return { jwt: session?.access_token || '' };
  }
  
  async updatePrefs(prefs: any) {
       // Do nothing in mock, handled heavily by updateProfile
  }
  async updateName(name: string) {
       // Do nothing
  }
}

export const account = new Account();

class Storage {
   getFileView(bucketId: string, fileId: string) {
      if (fileId && fileId.startsWith('data:')) return fileId;
      const { data } = supabaseAdmin.storage.from(bucketId).getPublicUrl(fileId);
      return data.publicUrl;
   }
   getFileDownload(bucketId: string, fileId: string) {
      if (fileId && fileId.startsWith('data:')) return fileId;
      const { data } = supabaseAdmin.storage.from(bucketId).getPublicUrl(fileId);
      return data.publicUrl;
   }
   getFilePreview(bucketId: string, fileId: string) {
      if (fileId && fileId.startsWith('data:')) return fileId;
      const { data } = supabaseAdmin.storage.from(bucketId).getPublicUrl(fileId);
      return data.publicUrl;
   }
   async createFile(bucketId: string, fileId: string, file: File) {
      let fileName = file.name || 'file';
      const actualFileId = fileId === 'unique()' ? `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.\-_]/g, '')}` : fileId;
      const { data, error } = await supabaseAdmin.storage.from(bucketId).upload(actualFileId, file);
      
      if (error) {
         console.warn("[Storage Polyfill] Bucket/Policy error encoding file to Base64 fallback.", error.message);
         return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve({ $id: reader.result });
            reader.onerror = e => reject(e);
         });
      }
      
      return { $id: data.path }; // Emulate Appwrite response
   }
}

export const storage = new Storage();

let cachedIP = '';
export async function getUserIP() {
  if (cachedIP) return cachedIP;
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    if (response.ok) {
      const data = await response.json();
      cachedIP = data.ip;
      return cachedIP;
    }
  } catch (err) {
  }
  return '0.0.0.0';
}

export async function safeListDocuments(collectionId: string, queries: any[] = []) {
  return await databases.listDocuments(APPWRITE_CONFIG.databaseId, collectionId, queries);
}

export async function fallbackListAllDocuments(collectionId: string, filterFn?: (doc: any) => boolean) {
   let allDocs: any[] = [];
   const limitStr = 1000;
   let offset = 0;
   try {
     for (let i = 0; i < 5; i++) {
       const res = await databases.listDocuments(APPWRITE_CONFIG.databaseId, collectionId, [
         Query.limit(limitStr),
         Query.offset(offset)
       ]);
       const matched = filterFn ? res.documents.filter(filterFn) : res.documents;
       allDocs = allDocs.concat(matched);
       if (res.documents.length < limitStr) break;
       offset += limitStr;
     }
   } catch (err: any) {}
   return { documents: allDocs, total: allDocs.length };
}

export async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 500): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (retries > 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 1.5);
    }
    throw err;
  }
}
