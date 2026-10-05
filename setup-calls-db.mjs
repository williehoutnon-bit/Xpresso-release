import { Client, Databases } from 'node-appwrite';
import 'dotenv/config';

// Load variables from .env
const ENDPOINT = process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const PROJECT_ID = process.env.VITE_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID = process.env.VITE_APPWRITE_DATABASE_ID;

const CALLS_ID = process.env.VITE_APPWRITE_CALLS_COLLECTION_ID || 'calls';
const SIGNALS_ID = process.env.VITE_APPWRITE_SIGNALS_COLLECTION_ID || 'signals';

if (!PROJECT_ID || !DATABASE_ID || !API_KEY) {
    console.error("Missing VITE_APPWRITE_PROJECT_ID, VITE_APPWRITE_DATABASE_ID, or APPWRITE_API_KEY in .env");
    console.log("Please ensure they are set. You need an API Key with database permission to create collections programmatically.");
    process.exit(1);
}

const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID)
    .setKey(API_KEY);

const databases = new Databases(client);

async function createAppwriteCollections() {
    try {
        console.log(`Setting up Call collections in Database ${DATABASE_ID}...`);
        
        // --- 1. CALLS COLLECTION ---
        console.log(`\nChecking collection: ${CALLS_ID}`);
        try {
            await databases.getCollection(DATABASE_ID, CALLS_ID);
            console.log(`Collection ${CALLS_ID} already exists.`);
        } catch (e) {
            console.log(`Creating collection ${CALLS_ID}...`);
            await databases.createCollection(DATABASE_ID, CALLS_ID, 'Live Calls');
            
            // Attributes
            await databases.createStringAttribute(DATABASE_ID, CALLS_ID, 'conversationId', 50, true);
            await databases.createStringAttribute(DATABASE_ID, CALLS_ID, 'type', 10, true);
            await databases.createStringAttribute(DATABASE_ID, CALLS_ID, 'status', 20, true);
            await databases.createStringAttribute(DATABASE_ID, CALLS_ID, 'initiatorId', 50, true);
            await databases.createStringAttribute(DATABASE_ID, CALLS_ID, 'participants', 100, true, undefined, true); // array of strings
            
            console.log(`Created attributes for ${CALLS_ID}`);
        }

        // --- 2. SIGNALS COLLECTION ---
        console.log(`\nChecking collection: ${SIGNALS_ID}`);
        try {
            await databases.getCollection(DATABASE_ID, SIGNALS_ID);
            console.log(`Collection ${SIGNALS_ID} already exists.`);
        } catch (e) {
            console.log(`Creating collection ${SIGNALS_ID}...`);
            await databases.createCollection(DATABASE_ID, SIGNALS_ID, 'WebRTC Signals');
            
            // Attributes
            await databases.createStringAttribute(DATABASE_ID, SIGNALS_ID, 'callId', 50, true);
            await databases.createStringAttribute(DATABASE_ID, SIGNALS_ID, 'senderId', 50, true);
            await databases.createStringAttribute(DATABASE_ID, SIGNALS_ID, 'receiverId', 50, true);
            await databases.createStringAttribute(DATABASE_ID, SIGNALS_ID, 'type', 20, true); // e.g. offer, answer, ice-candidate
            // Payload needs to hold SDP strings which can be large, up to 10k bytes
            await databases.createStringAttribute(DATABASE_ID, SIGNALS_ID, 'payload', 100000, true); 
            
            console.log(`Created attributes for ${SIGNALS_ID}`);
        }

        console.log("\n✅ Setup complete! The application is now prepared for group call architecture.");
    } catch (err) {
        console.error("Failed to setup Appwrite databases:", err);
    }
}

createAppwriteCollections();
