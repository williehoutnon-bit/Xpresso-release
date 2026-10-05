import { Client, Databases } from 'node-appwrite';
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

async function run() {
  try {
     const collectionsList = await databases.listCollections(DATABASE_ID);
     console.log('Found collections:', collectionsList.collections.map(c => ({ id: c.$id, name: c.name })));
     for (const col of collectionsList.collections) {
        console.log(`\nCollection: ${col.$id} (${col.name})`);
        // Attributes are in col.attributes, let us display them
        const attrs = col.attributes || [];
        console.log('  Attributes:', attrs.map(a => `${a.key} (${a.type || a.status})`));
        
        // Let's get sample document to see content
        const docs = await databases.listDocuments(DATABASE_ID, col.$id, []);
        if (docs.documents.length > 0) {
           console.log(`  Document Count: ${docs.total}`);
           console.log('  Sample Document Keys:', Object.keys(docs.documents[0]));
        } else {
           console.log('  No documents.');
        }
     }
  } catch(e) {
     console.error('Error listing collections:', e.message || e);
  }
}

run();
