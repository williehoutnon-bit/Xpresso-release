import { Client, Databases, Query } from 'node-appwrite';
const client = new Client().setEndpoint(process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1').setProject(process.env.VITE_APPWRITE_PROJECT_ID).setKey(process.env.Seeding);
const db = new Databases(client);
db.listDocuments(process.env.VITE_APPWRITE_DATABASE_ID, 'accounts', [Query.limit(10)]).then(r => console.log(r.documents.map(d=>d.$id))).catch(e => console.error(e.message));
