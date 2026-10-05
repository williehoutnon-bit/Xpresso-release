import { Client, Databases } from 'node-appwrite';
const client = new Client().setEndpoint(process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1').setProject(process.env.VITE_APPWRITE_PROJECT_ID).setKey(process.env.Seeding);
const db = new Databases(client);
const dbId = process.env.VITE_APPWRITE_DATABASE_ID;

async function run() {
    try {
        const p = await db.listDocuments(dbId, 'profiles');
        for(const d of p.documents) {
            await db.updateDocument(dbId, 'profiles', d.$id, {
                avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + d.userId,
                bio: 'Passionate about learning and growing. I enjoy discovering new ideas.',
                points: Math.floor(Math.random()*5000) + 1000,
                school: 'King\'s College Budo'
            });
            console.log('updated', d.fullName);
        }
    } catch(e) {
        console.error(e.message);
    }
}
run();
