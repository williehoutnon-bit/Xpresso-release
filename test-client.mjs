import { Client, Databases, Query } from 'appwrite';

const project = process.env.VITE_APPWRITE_PROJECT_ID;
const endpoint = process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const dbId = process.env.VITE_APPWRITE_DATABASE_ID;

const client = new Client()
    .setEndpoint(endpoint)
    .setProject(project)

const databases = new Databases(client);

async function run() {
    try {
        const res = await databases.listDocuments(dbId, 'friendships', [Query.limit(1)]);
        console.log("Success:", res.documents.length);
    } catch(e) {
        console.error("Client Error:", e.message);
    }
}
run();
