import { Client, Databases } from 'node-appwrite';
const client = new Client().setEndpoint(process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1').setProject(process.env.VITE_APPWRITE_PROJECT_ID).setKey(process.env.Seeding);
const db = new Databases(client);
const dbId = process.env.VITE_APPWRITE_DATABASE_ID;

async function run() {
    try {
        await db.createStringAttribute(dbId, 'profiles', 'studentClass', 100, false);
        await db.createStringAttribute(dbId, 'profiles', 'preferredSubjects', 1000, false); 
        await db.createStringAttribute(dbId, 'profiles', 'subjectCombination', 255, false);
        await db.createIntegerAttribute(dbId, 'profiles', 'age', false, 0, 150, 0);
        await db.createStringAttribute(dbId, 'profiles', 'house', 100, false);
        await db.createStringAttribute(dbId, 'profiles', 'clubs', 1000, false);
        console.log('Added schema fields');
    } catch(e) {
        console.error(e.message);
    }
}
run();
