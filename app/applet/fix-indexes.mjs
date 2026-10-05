import { Client, Databases } from 'node-appwrite';
const client = new Client()
    .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(process.env.VITE_APPWRITE_PROJECT_ID)
    .setKey(process.env.Seeding);
const db = new Databases(client);

const dbId = process.env.VITE_APPWRITE_DATABASE_ID;
const participantsId = process.env.VITE_APPWRITE_PARTICIPANTS_COLLECTION_ID;

async function checkAndAddIndexes() {
    try {
        console.log("Adding userId index to participants");
        await db.createIndex(dbId, participantsId, "idx_userId", "key", ["userId"]);
    } catch(e) { console.log(e.message); }
    
    try {
        console.log("Adding conversationId index to participants");
        await db.createIndex(dbId, participantsId, "idx_conversationId", "key", ["conversationId"]);
    } catch(e) { console.log(e.message); }
    
    try {
        console.log("Adding conversationId to messages");
        await db.createIndex(dbId, process.env.VITE_APPWRITE_MESSAGES_COLLECTION_ID, "idx_conversationId", "key", ["conversationId"]);
    } catch(e) { console.log(e.message); }

    console.log("Finished adding indexes");
}
checkAndAddIndexes();
