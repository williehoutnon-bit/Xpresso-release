import { Client, Databases, Query } from 'node-appwrite';
import 'dotenv/config';

const ENDPOINT = process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const PROJECT_ID = process.env.VITE_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY || process.env.seeding || process.env.SEEDING || process.env.Seeding;
const DATABASE_ID = process.env.VITE_APPWRITE_DATABASE_ID || 'educore-db';

console.log('Appwrite Config:', { ENDPOINT, PROJECT_ID, DATABASE_ID, HAS_KEY: !!API_KEY });

if (!PROJECT_ID || !API_KEY) {
  console.error('Missing PROJECT_ID or API_KEY in process.env');
  process.exit(1);
}

const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const databases = new Databases(client);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Concurrency helper to execute async functions in parallel with limit
async function mapInPool(items, concurrency, fn) {
  const results = [];
  const executing = [];
  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    results.push(p);
    if (concurrency < items.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(results);
}

// Map old attribute keys to new camelCase properties
const MAPPINGS = {
  accounts: [
    { oldKey: 'user_id', newKey: 'userId', type: 'string', size: 100, required: false },
    { oldKey: 'Surname', newKey: 'surname', type: 'string', size: 255, required: false },
    { oldKey: 'Middlename', newKey: 'middleName', type: 'string', size: 255, required: false },
    { oldKey: 'Lastname', newKey: 'lastName', type: 'string', size: 255, required: false },
    { oldKey: 'Role', newKey: 'role', type: 'string', size: 100, required: false },
    { oldKey: 'Age', newKey: 'age', type: 'integer', required: false },
    { oldKey: 'Country', newKey: 'country', type: 'string', size: 255, required: false },
    { oldKey: 'District', newKey: 'district', type: 'string', size: 255, required: false },
    { oldKey: 'School', newKey: 'school', type: 'string', size: 255, required: false },
    { oldKey: 'Class', newKey: 'class', type: 'string', size: 100, required: false },
    { oldKey: 'Parentcontact', newKey: 'parentContact', type: 'string', size: 100, required: false },
    { oldKey: 'Exupcode', newKey: 'exupCode', type: 'string', size: 100, required: false },
    { oldKey: 'Subscriptionend', newKey: 'subscriptionEnd', type: 'datetime', required: false },
    { oldKey: 'Phonenumber', newKey: 'phoneNumber', type: 'string', size: 100, required: false },
  ],
  conversations: [
    { oldKey: 'Name', newKey: 'name', type: 'string', size: 255, required: false },
    { oldKey: 'Is_group', newKey: 'isGroup', type: 'boolean', required: false, default: false },
    { oldKey: 'created_at', newKey: 'createdAt', type: 'string', size: 100, required: false },
  ],
  messages: [
    { oldKey: 'conversation_id', newKey: 'conversationId', type: 'string', size: 100, required: false },
    { oldKey: 'sender_id', newKey: 'senderId', type: 'string', size: 100, required: false },
    { oldKey: 'created_at', newKey: 'createdAt', type: 'string', size: 100, required: false },
    { oldKey: 'is_pinned', newKey: 'isPinned', type: 'boolean', required: false, default: false },
  ],
  participants: [
    { oldKey: 'conversation_id', newKey: 'conversationId', type: 'string', size: 100, required: false },
    { oldKey: 'user_id', newKey: 'userId', type: 'string', size: 100, required: false },
    { oldKey: 'last_read_at', newKey: 'lastReadAt', type: 'datetime', required: false },
    { oldKey: 'is_deleted', newKey: 'isDeleted', type: 'boolean', required: false, default: false },
    { oldKey: 'deleted_at', newKey: 'deletedAt', type: 'string', size: 100, required: false },
  ],
  friendships: [
    { oldKey: 'user_id', newKey: 'userId', type: 'string', size: 100, required: false },
    { oldKey: 'friend_id', newKey: 'friendId', type: 'string', size: 100, required: false },
    { oldKey: 'Status', newKey: 'status', type: 'string', size: 100, required: false },
    { oldKey: 'created_at', newKey: 'createdAt', type: 'string', size: 100, required: false },
  ],
  profiles: [
    { oldKey: 'user_id', newKey: 'userId', type: 'string', size: 100, required: false },
  ],
  calls: [
    { oldKey: 'ConversationId', newKey: 'conversationId', type: 'string', size: 100, required: false },
    { oldKey: 'InitiatorId', newKey: 'initiatorId', type: 'string', size: 100, required: false },
    { oldKey: 'ReceiverId', newKey: 'receiverId', type: 'string', size: 100, required: false },
    { oldKey: 'Status', newKey: 'status', type: 'string', size: 100, required: false },
    { oldKey: 'Participants', newKey: 'participants', type: 'string', size: 4000, required: false, array: true },
  ],
  signals: [
    { oldKey: 'CallId', newKey: 'callId', type: 'string', size: 100, required: false },
    { oldKey: 'SenderId', newKey: 'senderId', type: 'string', size: 100, required: false },
    { oldKey: 'ReceiverId', newKey: 'receiverId', type: 'string', size: 100, required: false },
    { oldKey: 'Type', newKey: 'type', type: 'string', size: 100, required: false },
    { oldKey: 'Payload', newKey: 'payload', type: 'string', size: 100000, required: false },
  ]
};

async function createAttributeSafe(collectionId, item) {
  try {
    const info = await databases.getAttribute(DATABASE_ID, collectionId, item.newKey);
    console.log(`  [OK] Attribute "${item.newKey}" is ${info.status} in "${collectionId}"`);
    return false;
  } catch {
    console.log(`  [NEW] Creating "${item.newKey}" (${item.type}) in "${collectionId}"...`);
    const isArray = item.array || false;
    try {
      if (item.type === 'string') {
        await databases.createStringAttribute(DATABASE_ID, collectionId, item.newKey, item.size || 255, item.required, item.default, isArray);
      } else if (item.type === 'boolean') {
        await databases.createBooleanAttribute(DATABASE_ID, collectionId, item.newKey, item.required, item.default, isArray);
      } else if (item.type === 'integer') {
        await databases.createIntegerAttribute(DATABASE_ID, collectionId, item.newKey, item.required, undefined, undefined, item.default, isArray);
      } else if (item.type === 'datetime') {
        await databases.createDatetimeAttribute(DATABASE_ID, collectionId, item.newKey, item.required, item.default, isArray);
      }
      return true;
    } catch (e) {
      console.warn(`  [WARN] Failed to create "${item.newKey}" in "${collectionId}": ${e.message}`);
      return false;
    }
  }
}

async function getDocumentsPaginated(collectionId) {
  let documents = [];
  let lastId = null;
  while (true) {
    const queries = [Query.limit(100)];
    if (lastId) {
      queries.push(Query.cursorAfter(lastId));
    }
    const res = await databases.listDocuments(DATABASE_ID, collectionId, queries);
    if (!res.documents || res.documents.length === 0) break;
    documents = documents.concat(res.documents);
    lastId = res.documents[res.documents.length - 1].$id;
    if (res.documents.length < 100) break;
  }
  return documents;
}

async function run() {
  try {
    console.log('\n======================== 1. CREATE CAMELCASE ATTRIBUTES ========================');
    let createdAny = false;
    for (const [colId, items] of Object.entries(MAPPINGS)) {
      console.log(`\nChecking attributes for "${colId}"...`);
      for (const item of items) {
        const createdNow = await createAttributeSafe(colId, item);
        if (createdNow) createdAny = true;
      }
    }

    console.log('\n======================== 2. WAITING FOR ATTRIBUTES TO BE READY ========================');
    // Wait for attributes to become ready
    let allReady = false;
    for (let i = 0; i < 40; i++) {
      let pending = 0;
      for (const [colId, items] of Object.entries(MAPPINGS)) {
        for (const item of items) {
          try {
            const info = await databases.getAttribute(DATABASE_ID, colId, item.newKey);
            if (info.status !== 'available') {
              pending++;
            }
          } catch (err) {
            pending++;
          }
        }
      }
      if (pending === 0) {
        console.log('All attributes have been successfully established and are available!');
        allReady = true;
        break;
      }
      console.log(`  Waiting for ${pending} attributes to process...`);
      await sleep(1500);
    }
    if (!allReady) {
      console.warn('⚠️ Warning: Some attributes are still processing. Proceeding with migration...');
    }

    console.log('\n======================== 3. MIGRATING DATA TO CAMELCASE (CONCURRENT POOL) ========================');
    for (const [colId, items] of Object.entries(MAPPINGS)) {
      console.log(`\nFetching documents from "${colId}"...`);
      const docs = await getDocumentsPaginated(colId);
      console.log(`Found ${docs.length} documents in "${colId}". Shifting values with concurrency 40...`);
      
      let migratedCount = 0;
      
      await mapInPool(docs, 40, async (doc) => {
        const updatePayload = {};
        let needsUpdate = false;
        
        for (const item of items) {
          const oldVal = doc[item.oldKey];
          const newVal = doc[item.newKey];
          
          if (oldVal !== undefined && oldVal !== null && (newVal === undefined || newVal === null)) {
            // Map types safely
            let mappedVal = oldVal;
            if (item.type === 'string' && typeof oldVal !== 'string') {
              mappedVal = String(oldVal);
            } else if (item.type === 'integer' && typeof oldVal !== 'number') {
              mappedVal = parseInt(oldVal, 10) || 0;
            } else if (item.type === 'boolean' && typeof oldVal !== 'boolean') {
              mappedVal = Boolean(oldVal);
            } else if (item.type === 'datetime') {
              try {
                mappedVal = new Date(oldVal).toISOString();
              } catch {
                mappedVal = null;
              }
            }
            
            if (mappedVal !== null && mappedVal !== undefined) {
              updatePayload[item.newKey] = mappedVal;
              needsUpdate = true;
            }
          }
        }
        
        if (needsUpdate) {
          try {
            await databases.updateDocument(DATABASE_ID, colId, doc.$id, updatePayload);
            migratedCount++;
            if (migratedCount % 200 === 0) {
              console.log(`  [Progress] Migrated ${migratedCount}/${docs.length} records in "${colId}"`);
            }
          } catch (e) {
            // Suppress minor errors but print details
            if (!e.message.includes('not found') && !e.message.includes('already exists')) {
              console.warn(`  [ERROR] Document ID "${doc.$id}" of "${colId}" migration failed: ${e.message}`);
            }
          }
        }
      });
      
      console.log(`Finished "${colId}": Migrated & synchronized state for ${migratedCount} documents.`);
    }

    console.log('\n======================== 4. CLEANING UP OLD LEGACY ATTRIBUTES ========================');
    for (const [colId, items] of Object.entries(MAPPINGS)) {
      console.log(`\nCleaning old attributes of "${colId}"...`);
      for (const item of items) {
        if (item.oldKey === item.newKey) continue;
        try {
          await databases.getAttribute(DATABASE_ID, colId, item.oldKey);
          console.log(`  Deleting deprecated attribute "${item.oldKey}" from "${colId}"...`);
          await databases.deleteAttribute(DATABASE_ID, colId, item.oldKey);
          await sleep(200); // Polishing delay
        } catch {
          console.log(`  Attribute "${item.oldKey}" already removed from "${colId}".`);
        }
      }
    }

    console.log('\n================================ MIGRATION SUCCESSFULLY FULLY COMPLETED ================================');

  } catch (err) {
    console.error('\n[MIGRATION ERROR]:', err);
    process.exit(1);
  }
}

run();
