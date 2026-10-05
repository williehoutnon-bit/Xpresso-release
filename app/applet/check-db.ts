import { Client, Databases, Query } from 'node-appwrite';
import * as fs from 'fs';

let envStr = fs.readFileSync('.env.example', 'utf8');
const lines = envStr.split('\n');
const env: Record<string, string> = {};
lines.forEach(l => {
    const [k, v] = l.split('=');
    if (k && v) env[k.trim()] = v.trim();
});

const client = new Client()
    .setEndpoint(env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(env.VITE_APPWRITE_PROJECT_ID || 'educore-dev');

const databases = new Databases(client);

async function check() {
    try {
        console.log('Fetching users...');
        const res = await databases.listDocuments(
            env.VITE_APPWRITE_DATABASE_ID || 'educore-db',
            'friendships',
            [Query.limit(5)]
        );
        console.log('Friendships:', res.documents.length);
        console.log(res.documents);
    } catch(err) {
        console.error('Error:', err);
    }
}
check();
