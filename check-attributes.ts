import { Client, Databases } from 'node-appwrite';
import 'dotenv/config';

const ENDPOINT = process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const PROJECT_ID = process.env.VITE_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY || process.env.seeding || process.env.SEEDING || process.env.Seeding;
const DATABASE_ID = process.env.VITE_APPWRITE_DATABASE_ID || 'educore-db';

const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const databases = new Databases(client);

const collections = [
  { key: 'accounts', id: 'Accounts' },
  { key: 'profiles', id: 'profiles' },
  { key: 'conversations', id: 'conversations' },
  { key: 'messages', id: 'messages' },
  { key: 'participants', id: 'participants' },
  { key: 'friendships', id: 'friendships' },
  { key: 'math_elements', id: 'math_elements' },
  { key: 'element_operations', id: 'element_operations' },
  { key: 'canvas_sessions', id: 'canvas_sessions' },
  { key: 'presence', id: 'presence' }
];

async function run() {
  console.log('Fetching remote Appwrite collection configurations...');
  for (const coll of collections) {
    try {
      const colId = process.env[`VITE_APPWRITE_${coll.key.toUpperCase()}_COLLECTION_ID`] || coll.id;
      const res = await databases.getCollection(DATABASE_ID, colId);
      console.log(`\n=== Collection: ${coll.key} (ID: ${colId}) ===`);
      console.log('Attributes:');
      const attrRes = await databases.listAttributes(DATABASE_ID, colId);
      const attrs = attrRes.attributes.map((a: any) => ({
        key: a.key,
        type: a.type,
        required: a.required,
        array: a.array,
        status: a.status
      }));
      console.table(attrs);
    } catch (err: any) {
      console.error(`Error fetching collection ${coll.key}:`, err.message || err);
    }
  }
}

run();
