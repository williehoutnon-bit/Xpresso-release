import { Client, Databases, Query } from 'node-appwrite';
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

async function run() {
  try {
    const friendDocs = await databases.listDocuments(DATABASE_ID, 'friendships', [Query.limit(5)]);
    console.log('Sample friendships:', friendDocs.documents.map(d => ({
      id: d.id,
      $id: d.$id,
      userId: d.userId,
      friendId: d.friendId,
      createdAt: d.createdAt
    })));

    const msgDocs = await databases.listDocuments(DATABASE_ID, 'messages', [Query.limit(5)]);
    console.log('Sample messages:', msgDocs.documents.map(d => ({
      id: d.id,
      $id: d.$id,
      conversationId: d.conversationId,
      senderId: d.senderId,
      createdAt: d.createdAt,
      isPinned: d.isPinned
    })));
  } catch (err) {
    console.error('Error during inspection:', err.message);
  }
}

run();
