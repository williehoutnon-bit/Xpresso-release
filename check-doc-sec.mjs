import { Client, Databases } from 'node-appwrite';

const project = process.env.VITE_APPWRITE_PROJECT_ID;
const endpoint = process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const secretKey = process.env.Seeding;
const dbId = process.env.VITE_APPWRITE_DATABASE_ID;

const client = new Client()
    .setEndpoint(endpoint)
    .setProject(project)
    .setKey(secretKey);

const databases = new Databases(client);

async function check() {
    const f = await databases.getCollection(dbId, 'friendships');
    console.log("friendships documentSecurity:", f.documentSecurity);
    const a = await databases.getCollection(dbId, 'accounts');
    console.log("accounts documentSecurity:", a.documentSecurity);
}
check();
