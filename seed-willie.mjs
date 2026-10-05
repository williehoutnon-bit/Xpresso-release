import { Client, Databases, ID } from 'node-appwrite';

const project = process.env.VITE_APPWRITE_PROJECT_ID;
const endpoint = process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const secretKey = process.env.Seeding;
const dbId = process.env.VITE_APPWRITE_DATABASE_ID;
const WILLIE_ID = '6a037aac0000618c52aa';

const client = new Client()
    .setEndpoint(endpoint)
    .setProject(project)
    .setKey(secretKey);

const databases = new Databases(client);

async function run() {
    const mockUsers = [
        'user_grace',
        'user_brian',
        'user_kato',
        'user_sarah',
        'user_daniel',
        'user_moses'
    ];

    try {
        for (const m of mockUsers) {
            await databases.createDocument(dbId, 'friendships', ID.unique(), {
                user_id: WILLIE_ID,
                friend_id: m,
                Status: 'Accepted'
            });
            await databases.createDocument(dbId, 'friendships', ID.unique(), {
                user_id: m,
                friend_id: WILLIE_ID,
                Status: 'Accepted'
            });
            console.log("Friendship created for", m);
        }
    } catch(e) {
        console.error(e.message);
    }
}
run();
