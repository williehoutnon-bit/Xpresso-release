import { Client, Databases, Permission, Role } from 'node-appwrite';

const project = process.env.VITE_APPWRITE_PROJECT_ID;
const endpoint = process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const secretKey = process.env.Seeding;
const dbId = process.env.VITE_APPWRITE_DATABASE_ID;

const client = new Client()
    .setEndpoint(endpoint)
    .setProject(project)
    .setKey(secretKey);

const databases = new Databases(client);

async function run() {
    try {
        const friendshipsCollId = process.env.VITE_APPWRITE_FRIENDSHIPS_COLLECTION_ID || 'friendships';
        await databases.updateCollection(dbId, friendshipsCollId, friendshipsCollId, [
            Permission.read(Role.any()),
            Permission.create(Role.any()),
            Permission.update(Role.any()),
            Permission.delete(Role.any()),
            Permission.read(Role.users()),
            Permission.create(Role.users()),
            Permission.update(Role.users()),
            Permission.delete(Role.users()),
            Permission.read(Role.guests()),
            Permission.create(Role.guests()),
            Permission.update(Role.guests()),
            Permission.delete(Role.guests())
        ], false, true); // ensure documentLevelSecurity is false
        console.log("Friendships permissions updated.");
        
        await databases.updateCollection(dbId, 'accounts', 'accounts', [
            Permission.read(Role.any()),
            Permission.create(Role.any()),
            Permission.update(Role.any()),
            Permission.delete(Role.any()),
            Permission.read(Role.users()),
            Permission.create(Role.users()),
            Permission.update(Role.users()),
            Permission.delete(Role.users()),
            Permission.read(Role.guests()),
            Permission.create(Role.guests()),
            Permission.update(Role.guests()),
            Permission.delete(Role.guests())
        ], false, true);
        console.log("Accounts permissions updated.");
        
        await databases.updateCollection(dbId, 'profiles', 'profiles', [
            Permission.read(Role.any()),
             Permission.create(Role.any()),
            Permission.update(Role.any()),
            Permission.delete(Role.any()),
            Permission.read(Role.users()),
            Permission.create(Role.users()),
            Permission.update(Role.users()),
            Permission.delete(Role.users()),
            Permission.read(Role.guests()),
            Permission.create(Role.guests()),
            Permission.update(Role.guests()),
            Permission.delete(Role.guests())
        ], false, true);
        console.log("Profiles permissions updated.");
        
    } catch (e) {
        console.error(e);
    }
}
run();
