import { Client, Databases } from 'node-appwrite';
const client = new Client().setEndpoint(process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1').setProject(process.env.VITE_APPWRITE_PROJECT_ID).setKey(process.env.Seeding);
const db = new Databases(client);
const dbId = process.env.VITE_APPWRITE_DATABASE_ID;

async function run() {
    try {
        const p = await db.listDocuments(dbId, 'profiles');
        for(const d of p.documents) {
            await db.updateDocument(dbId, 'profiles', d.$id, {
                studentClass: 'S' + (Math.floor(Math.random()*6)+1),
                preferredSubjects: 'Math, Physics, Computing',
                subjectCombination: 'PCM/IT',
                age: Math.floor(Math.random()*5)+13,
                house: 'Mutesa House',
                clubs: 'Debate Club, Tech Club'
            });
            console.log('updated', d.fullName);
        }
    } catch(e) {
        console.error(e.message);
    }
}
run();
