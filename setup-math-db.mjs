import { Client, Databases } from 'node-appwrite';
import 'dotenv/config';

console.log('Available Env Vars:', Object.keys(process.env).filter(k => k.toLowerCase().includes('seed') || k.toLowerCase().includes('appwrite') || k.toLowerCase().includes('endpoint') || k.toLowerCase().includes('project')));
const ENDPOINT = process.env.VITE_APPWRITE_ENDPOINT || process.env.endpoint || process.env.ENDPOINT || 'https://cloud.appwrite.io/v1';
const PROJECT_ID = process.env.VITE_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY || process.env.seeding || process.env.SEEDING || process.env.Seeding;
const DATABASE_ID = process.env.VITE_APPWRITE_DATABASE_ID || 'educore-db';

const MATH_ELEMENTS_ID = 'math_elements';
const ELEMENT_OPERATIONS_ID = 'element_operations';
const CANVAS_SESSIONS_ID = 'canvas_sessions';
const PRESENCE_ID = 'presence';
const MESSAGES_ID = process.env.VITE_APPWRITE_MESSAGES_COLLECTION_ID || 'messages';

console.log('Appwrite Setup Config:', {
  ENDPOINT,
  PROJECT_ID,
  DATABASE_ID,
  API_KEY: API_KEY ? '✔ PRESENT' : '✖ MISSING'
});

if (!PROJECT_ID || !API_KEY) {
  console.warn('⚠️ Appwrite PROJECT_ID or API_KEY is missing from environment. Skipping programmatic schema setup.');
  process.exit(0);
}

const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const databases = new Databases(client);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function safeCreateCollection(id, name) {
  try {
    await databases.getCollection(DATABASE_ID, id);
    console.log(`Collection "${id}" already exists.`);
    return false;
  } catch (e) {
    console.log(`Creating collection "${id}" ("${name}")...`);
    await databases.createCollection(DATABASE_ID, id, name);
    // Give it a tiny bit of time
    await sleep(1000);
    return true;
  }
}

async function run() {
  try {
    // 0. Modify Messages collection
    console.log('\n--- Checking Messages collection for mathMeta attribute ---');
    try {
      await databases.getAttribute(DATABASE_ID, MESSAGES_ID, 'mathMeta');
      console.log('mathMeta attribute already exists on messages.');
    } catch {
      console.log('Adding "mathMeta" large string attribute to messages collection...');
      await databases.createStringAttribute(DATABASE_ID, MESSAGES_ID, 'mathMeta', 200000, false);
      await sleep(1000);
    }

    // 1. Math Elements Collection
    const mathElCreated = await safeCreateCollection(MATH_ELEMENTS_ID, 'Math Elements');
    if (mathElCreated) {
      console.log('Creating attributes for math_elements...');
      await databases.createStringAttribute(DATABASE_ID, MATH_ELEMENTS_ID, 'sessionId', 50, true);
      await databases.createStringAttribute(DATABASE_ID, MATH_ELEMENTS_ID, 'type', 50, true);
      await databases.createFloatAttribute(DATABASE_ID, MATH_ELEMENTS_ID, 'x', true);
      await databases.createFloatAttribute(DATABASE_ID, MATH_ELEMENTS_ID, 'y', true);
      await databases.createFloatAttribute(DATABASE_ID, MATH_ELEMENTS_ID, 'width', true);
      await databases.createFloatAttribute(DATABASE_ID, MATH_ELEMENTS_ID, 'height', true);
      await databases.createFloatAttribute(DATABASE_ID, MATH_ELEMENTS_ID, 'rotation', false, 0);
      await databases.createIntegerAttribute(DATABASE_ID, MATH_ELEMENTS_ID, 'zIndex', true);
      await databases.createStringAttribute(DATABASE_ID, MATH_ELEMENTS_ID, 'content', 10000, false);
      await databases.createStringAttribute(DATABASE_ID, MATH_ELEMENTS_ID, 'style', 2000, false);
      await databases.createStringAttribute(DATABASE_ID, MATH_ELEMENTS_ID, 'createdBy', 50, true);
      await databases.createStringAttribute(DATABASE_ID, MATH_ELEMENTS_ID, 'createdAt', 40, true);
      await databases.createStringAttribute(DATABASE_ID, MATH_ELEMENTS_ID, 'lastEditedBy', 50, false);
      await databases.createStringAttribute(DATABASE_ID, MATH_ELEMENTS_ID, 'lastEditedAt', 40, false);
      await databases.createIntegerAttribute(DATABASE_ID, MATH_ELEMENTS_ID, 'version', true);
      await databases.createBooleanAttribute(DATABASE_ID, MATH_ELEMENTS_ID, 'isDeleted', true);
      await databases.createBooleanAttribute(DATABASE_ID, MATH_ELEMENTS_ID, 'isAnnotation', true);
      await databases.createStringAttribute(DATABASE_ID, MATH_ELEMENTS_ID, 'annotationTargetId', 50, false);
      await databases.createStringAttribute(DATABASE_ID, MATH_ELEMENTS_ID, 'lockedBy', 50, false);
      await databases.createStringAttribute(DATABASE_ID, MATH_ELEMENTS_ID, 'lockedAt', 40, false);
      
      console.log('Waiting for attributes to be ready before creating indexes...');
      await sleep(2000);
      
      console.log('Creating indexes for math_elements...');
      await databases.createIndex(DATABASE_ID, MATH_ELEMENTS_ID, 'idx_sessionId', 'key', ['sessionId']);
      console.log('Finished attributes & indexes for math_elements.');
    }

    // 2. Element Operations Collection
    const eleOpsCreated = await safeCreateCollection(ELEMENT_OPERATIONS_ID, 'Element Operations');
    if (eleOpsCreated) {
      console.log('Creating attributes for element_operations...');
      await databases.createStringAttribute(DATABASE_ID, ELEMENT_OPERATIONS_ID, 'sessionId', 50, true);
      await databases.createStringAttribute(DATABASE_ID, ELEMENT_OPERATIONS_ID, 'elementId', 50, true);
      await databases.createStringAttribute(DATABASE_ID, ELEMENT_OPERATIONS_ID, 'operationType', 50, true);
      await databases.createStringAttribute(DATABASE_ID, ELEMENT_OPERATIONS_ID, 'userId', 50, true);
      await databases.createStringAttribute(DATABASE_ID, ELEMENT_OPERATIONS_ID, 'userName', 100, true);
      await databases.createStringAttribute(DATABASE_ID, ELEMENT_OPERATIONS_ID, 'timestamp', 40, true);
      await databases.createStringAttribute(DATABASE_ID, ELEMENT_OPERATIONS_ID, 'patch', 5000, false);
      await databases.createStringAttribute(DATABASE_ID, ELEMENT_OPERATIONS_ID, 'previousPatch', 5000, false);
      await databases.createIntegerAttribute(DATABASE_ID, ELEMENT_OPERATIONS_ID, 'sessionVersion', true);
      
      console.log('Waiting for attributes to be ready before creating indexes...');
      await sleep(2000);
      
      console.log('Creating indexes for element_operations...');
      await databases.createIndex(DATABASE_ID, ELEMENT_OPERATIONS_ID, 'idx_sessionId', 'key', ['sessionId']);
      await databases.createIndex(DATABASE_ID, ELEMENT_OPERATIONS_ID, 'idx_elementId', 'key', ['elementId']);
      
      console.log('Finished attributes & indexes for element_operations.');
    }

    // 3. Canvas Sessions Collection
    const sessionsCreated = await safeCreateCollection(CANVAS_SESSIONS_ID, 'Canvas Sessions');
    if (sessionsCreated) {
      console.log('Creating attributes for canvas_sessions...');
      await databases.createStringAttribute(DATABASE_ID, CANVAS_SESSIONS_ID, 'threadId', 50, true);
      await databases.createStringAttribute(DATABASE_ID, CANVAS_SESSIONS_ID, 'messageId', 50, true);
      await databases.createStringAttribute(DATABASE_ID, CANVAS_SESSIONS_ID, 'parentSessionId', 50, false);
      await databases.createStringAttribute(DATABASE_ID, CANVAS_SESSIONS_ID, 'subject', 100, true);
      await databases.createStringAttribute(DATABASE_ID, CANVAS_SESSIONS_ID, 'curriculumLevel', 50, true);
      await databases.createStringAttribute(DATABASE_ID, CANVAS_SESSIONS_ID, 'createdBy', 50, true);
      await databases.createStringAttribute(DATABASE_ID, CANVAS_SESSIONS_ID, 'createdAt', 40, true);
      await databases.createStringAttribute(DATABASE_ID, CANVAS_SESSIONS_ID, 'chalkHolder', 50, false);
      await databases.createStringAttribute(DATABASE_ID, CANVAS_SESSIONS_ID, 'chalkHolderName', 100, false);
      await databases.createStringAttribute(DATABASE_ID, CANVAS_SESSIONS_ID, 'chalkAcquiredAt', 40, false);
      await databases.createStringAttribute(DATABASE_ID, CANVAS_SESSIONS_ID, 'activeUsers', 1000, false, undefined, true); // string list
      await databases.createStringAttribute(DATABASE_ID, CANVAS_SESSIONS_ID, 'editChain', 2000, false, undefined, true); // string list
      await databases.createIntegerAttribute(DATABASE_ID, CANVAS_SESSIONS_ID, 'operationCount', false, 0);
      
      console.log('Waiting for attributes to be ready before creating indexes...');
      await sleep(2000);
      
      console.log('Creating indexes for canvas_sessions...');
      await databases.createIndex(DATABASE_ID, CANVAS_SESSIONS_ID, 'idx_threadId', 'key', ['threadId']);
      await databases.createIndex(DATABASE_ID, CANVAS_SESSIONS_ID, 'idx_messageId', 'key', ['messageId']);
      
      console.log('Finished attributes & indexes for canvas_sessions.');
    }

    // 4. Presence Collection
    const presenceCreated = await safeCreateCollection(PRESENCE_ID, 'Presence');
    if (presenceCreated) {
      console.log('Creating attributes for presence...');
      await databases.createStringAttribute(DATABASE_ID, PRESENCE_ID, 'sessionId', 50, true);
      await databases.createStringAttribute(DATABASE_ID, PRESENCE_ID, 'userId', 50, true);
      await databases.createStringAttribute(DATABASE_ID, PRESENCE_ID, 'displayName', 100, true);
      await databases.createStringAttribute(DATABASE_ID, PRESENCE_ID, 'avatarColor', 20, true);
      await databases.createFloatAttribute(DATABASE_ID, PRESENCE_ID, 'x', true);
      await databases.createFloatAttribute(DATABASE_ID, PRESENCE_ID, 'y', true);
      await databases.createStringAttribute(DATABASE_ID, PRESENCE_ID, 'tool', 50, true);
      await databases.createBooleanAttribute(DATABASE_ID, PRESENCE_ID, 'isChalkHolder', true);
      await databases.createStringAttribute(DATABASE_ID, PRESENCE_ID, 'updatedAt', 40, true);
      
      console.log('Waiting for attributes to be ready before creating indexes...');
      await sleep(2000);
      
      console.log('Creating indexes for presence...');
      await databases.createIndex(DATABASE_ID, PRESENCE_ID, 'idx_sessionId', 'key', ['sessionId']);
      
      console.log('Finished attributes & indexes for presence.');
    }

    console.log('\n✅ Math Blackboard appwrite schema integration setup successfully completed!');
  } catch (err) {
    console.error('Error during Appwrite programmatic provisioning:', err);
  }
}

run();
